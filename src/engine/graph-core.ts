// The graph executor's PURE core (T-046-02, story S-046-01, epic E-046) — `runChain` generalized
// from a linear walk into a DAG walk over T-046-01's typed model. Where `runChain` threads ONE
// `upstream` string into each step and halts the whole tail on the first non-success, `runGraph`:
//
//   1. JOIN     — a node receives the `produced` of ALL its upstream (in-edge) nodes, keyed by the
//                 from-node (a `NodeUpstreams` map): source ⇒ empty, linear ⇒ 1-entry, join ⇒ many.
//                 This is the load-bearing generalization — the linear engine structurally cannot
//                 deliver two upstreams to one node.
//   2. FAN-OUT  — a node's `produced` feeds EVERY out-edge; each downstream reads it (keyed by this
//                 node's id) in its own upstream map. Topological order guarantees a node runs only
//                 after all its upstreams.
//   3. HALT THE DEPENDENT SUBGRAPH — a node that fails / produces nothing skips exactly the nodes
//                 that transitively depend on it (its downstream closure); independent siblings
//                 still run. The per-edge gate is the SAME `decideThread` `runChain` uses (reused,
//                 not reimplemented). Elaborate cross-branch error semantics are OUT (E-046 scope).
//
// TWO EXECUTORS, ONE PURE CORE: this module hosts BOTH graph executors —
//   - `runGraph` (T-046-02)            — the SEQUENTIAL reference: awaits each node one-at-a-time in
//                                        topo order. Correctness, not parallelism, is its contract.
//   - `runGraphConcurrent` (T-046-03)  — its CONCURRENT twin: a wave dispatcher that `Promise.all`s
//                                        each topological ready-set, and (E-048, T-048-02) optionally
//                                        threads ONE SHARED WALLET across the wave — authorize the
//                                        ready-set before dispatch (`authorizeWave`), debit after it
//                                        settles (`debitWave`, tokens SUM / wall-clock MAX), hard-stop
//                                        at the wave boundary so concurrent branches cannot collectively
//                                        overspend the envelope (P7 under concurrency).
// Both are the SAME join/fan-out/halt semantics over the same primitives; the concurrent twin returns
// the same {@link GraphResult}, assembled in topo order so it is deterministic despite concurrent settle.
//
// PURITY (the chain-core.ts discipline): every import is a TYPE (erased under verbatimModuleSyntax) or a
// PURE value — `decideThread` (chain-core.ts), `topoSort` (dag-core.ts), and (E-048) the pure budget
// algebra `authorizeWave` (spend-core.ts) + `debitWave` (wallet.ts) + `countTokens` (budget.ts). No fs,
// clock, network, process, or native addon. BOTH executors are "pure given their injected casts" — they
// SPAWN NOTHING; the `cast` thunks are injected (`DagNode.cast`), exactly as graph-core.test.ts injects
// fakes returning canned summaries and T-046-03's `castGraph` injects `adapt → castPlay`. The
// `Promise.all` in `runGraphConcurrent` only awaits those injected thunks — it adds CONCURRENCY, not
// IMPURITY; the SPAWNING (value-importing `castPlay`) is the impure shell's job (`castGraph`, graph.ts),
// which is why `bun test` imports THIS core but never graph.ts. Same spec + same casts ⇒ byte-identical
// result (ordering is `topoSort`'s declaration-order tie-break).

import type { RunOutcome } from "../log/run-log.ts";
import type { RunSummary } from "./cast.ts";
import { decideThread } from "./chain-core.ts";
import { topoSort, type DagEdge, type DagNode, type DagSpec, type NodeId, type NodeUpstreams } from "./dag-core.ts";
import { authorizeWave } from "./spend-core.ts";
import { debitWave, type Wallet } from "../budget/wallet.ts";
import { countTokens, type Budget } from "../budget/budget.ts";

/** The terminal outcome a thrown node cast is marked with (E-054). A throw is NOT a crash:
 *  the runner wraps it into a non-proceeding summary carrying this outcome, so it routes
 *  through the SAME `decideThread` halt path every other non-success outcome uses — no new
 *  branch. Named once here so the literal `"errored"` and {@link RUN_OUTCOMES} cannot drift. */
export const NODE_ERRORED: RunOutcome = "errored";

/**
 * Map a thrown node cast into a deterministic, NON-PROCEEDING {@link RunSummary} — the single
 * routing primitive both runners reuse (T-054-02) so a throw becomes a marked node, never an
 * uncaught rejection that crashes the wave and discards independent siblings' work. PURE &
 * DETERMINISTIC: `runId` is a pure function of `id` (no clock, no random), so the same throwing
 * spec yields a byte-identical summary under `runGraph` and `runGraphConcurrent` — the
 * precondition the dual-runner equivalence (T-054-03) leans on.
 *
 * The summary is truthful about a throw: `materialized: false` (nothing landed), `produced`
 * absent (nothing to thread ⇒ {@link decideThread} refuses it ⇒ its dependents skip via the
 * EXISTING halt-dependent-subgraph machinery), and `actuals` absent (nothing measured ⇒
 * {@link actualsDelta} contributes {0,0} ⇒ no phantom wallet charge under a budgeted wave).
 */
export function erroredSummary(id: NodeId): RunSummary {
  return { runId: `errored:${id}`, outcome: NODE_ERRORED, materialized: false };
}

/**
 * A node NOT cast because its dependent subgraph was halted (the graph analog of `runChain`'s
 * "skipped downstream step"). Records the in-edge upstream(s) that did not proceed and a human
 * andon — so a skipped node is visibly accounted for, never silently dropped.
 */
export interface SkippedNode {
  readonly id: NodeId;
  /** The in-edge upstream node(s) whose edge did NOT fire — the cause of this skip. Either the
   *  upstream did not proceed (failed, produced nothing, or was itself skipped — a HALT), or the
   *  upstream proceeded but this edge's `when` predicate rejected its `produced` (a BRANCH-NOT-TAKEN,
   *  E-049). The {@link reason} distinguishes the two. */
  readonly blockedBy: readonly NodeId[];
  /** The andon: which halted upstream(s) skipped this node, and why each did not proceed. */
  readonly reason: string;
}

/**
 * The outcome of running a graph — the {@link DagSpec} analog of `ChainResult`.
 *  - `nodes`     : one {@link RunSummary} per CAST node, keyed by id (skipped nodes are absent —
 *                  they appear in `skipped`). Each corresponds to one run-log record downstream.
 *  - `skipped`   : the dependent-subgraph nodes a halt skipped; independent siblings are NOT here
 *                  (they ran). Each carries its blocking upstream(s) + andon.
 *  - `outcome`   : the terminal outcome a caller maps to an exit code — the FIRST non-success cast
 *                  outcome in topological order, else `success`. (A success-but-no-`produced` halt
 *                  leaves this `success` with `halted` true, mirroring `runChain` exactly.)
 *  - `halted`    : did any node skip a dependent subgraph (`skipped.length > 0`).
 *  - `produced`  : the SINK (leaf, out-degree-0) nodes' `produced` refs, keyed by id — the graph's
 *                  net output(s); a graph may have several leaves. A sink that failed / produced
 *                  nothing / was skipped is absent.
 *  - `haltReason`: the first skip's cause, present only when `halted`.
 */
export interface GraphResult {
  readonly nodes: ReadonlyMap<NodeId, RunSummary>;
  readonly skipped: readonly SkippedNode[];
  readonly outcome: RunOutcome;
  readonly halted: boolean;
  readonly produced: ReadonlyMap<NodeId, string>;
  readonly haltReason?: string;
  /** The shared wallet's remaining balance at the run's end — the budget readout (E-048, T-048-02).
   *  Present ONLY when a wallet was threaded through {@link runGraphConcurrent}; `undefined` on the
   *  sequential {@link runGraph} path and the legacy (no-wallet) concurrent path. Total debited is
   *  `funded − walletRemaining` per denomination (IA-8, never conflated). */
  readonly walletRemaining?: Budget;
}

/**
 * Run a {@link DagSpec} in topological order — PURE given injected casts, TOTAL, DETERMINISTIC.
 * Threads each node's upstreams' `produced` into its cast (JOIN), fans a node's `produced` to every
 * downstream (FAN-OUT), and skips exactly the transitive dependents of any node that does not
 * proceed (HALT THE DEPENDENT SUBGRAPH — siblings independent of it still run).
 *
 * A node runs iff EVERY one of its in-edge upstreams proceeded (succeeded AND surfaced a `produced`
 * to thread — the reused {@link decideThread} gate). Topological order guarantees every upstream is
 * decided first, so a non-proceeding node's skip cascades through its whole downstream closure.
 *
 * TOTAL: a CYCLIC spec violates the precondition — {@link validateDag} is the cycle gate and refuses
 * cyclic graphs before they reach here — but rather than hang, `runGraph` refuses it cleanly: it
 * casts NOTHING, marks every node skipped, and returns `outcome: "gate-failed"`, `halted: true`.
 * The empty graph is a vacuous `success` no-op (mirrors the empty chain).
 */
export async function runGraph(spec: DagSpec): Promise<GraphResult> {
  const sorted = topoSort(spec);

  // CYCLE — precondition violation (validateDag gates this). Refuse totally rather than hang:
  // nothing cast, every node skipped, a non-success terminal outcome the caller maps to non-zero.
  if ("cycle" in sorted) {
    const reason = `graph is cyclic — runGraph runs only acyclic specs (validateDag is the cycle gate); cycle: ${sorted.cycle.join(", ")}`;
    return {
      nodes: new Map(),
      skipped: spec.nodes.map((node) => ({ id: node.id, blockedBy: sorted.cycle, reason })),
      outcome: "gate-failed",
      halted: true,
      produced: new Map(),
      haltReason: reason,
    };
  }

  const order = sorted.order;

  // First-declared node per id (parity with topoSort's first-index rule for any duplicate id;
  // validateDag is what refuses duplicates — here we just stay total and deterministic).
  const byId = new Map<NodeId, DagNode>();
  for (const node of spec.nodes) if (!byId.has(node.id)) byId.set(node.id, node);

  // Adjacency over DECLARED endpoints only — an edge touching an unknown id contributes nothing
  // (parity with topoSort's "unknown endpoint → no dependency"); validateDag refuses dangling edges.
  // `inEdges` keys are exactly the declared ids, so `inEdges.has(id)` doubles as "id is declared".
  // It stores the whole DagEdge (not just the from-id) so the per-edge `when` predicate (E-049) is in
  // scope when deciding whether each in-edge fires.
  const inEdges = new Map<NodeId, DagEdge[]>();
  const outDegree = new Map<NodeId, number>();
  for (const id of order) {
    inEdges.set(id, []);
    outDegree.set(id, 0);
  }
  for (const edge of spec.edges) {
    if (!inEdges.has(edge.from) || !inEdges.has(edge.to)) continue; // unknown endpoint → ignored
    inEdges.get(edge.to)?.push(edge);
    outDegree.set(edge.from, (outDegree.get(edge.from) ?? 0) + 1);
  }

  const summaries = new Map<NodeId, RunSummary>();
  const proceeded = new Set<NodeId>(); // nodes that cast AND passed decideThread (have a threadable produced)
  const producedAll = new Map<NodeId, string>(); // every proceeded node's produced — the fan-out source
  const haltReasonOf = new Map<NodeId, string>(); // why a CAST node did not proceed (for skip andons)
  const skipped: SkippedNode[] = [];
  let firstFail: RunSummary | undefined;

  for (const id of order) {
    const ins = inEdges.get(id) ?? [];

    // CLASSIFY each in-edge. An edge FIRES (is satisfied) iff its upstream proceeded AND its `when`
    // predicate (if any) holds over that upstream's `produced` (E-049). A node runs iff EVERY in-edge
    // fires. Two distinct unsatisfied kinds, kept apart so each is its own andon:
    //  - halted   : the upstream did not proceed (failed / produced nothing / was itself skipped);
    //  - not-taken: the upstream proceeded, but this edge's predicate rejected its `produced`.
    const halted: NodeId[] = [];
    const notTaken: NodeId[] = [];
    for (const edge of ins) {
      if (!proceeded.has(edge.from)) {
        halted.push(edge.from);
        continue;
      }
      if (edge.when !== undefined) {
        const p = producedAll.get(edge.from); // proceeded ⇒ present; defensive: undefined ⇒ not-firing
        if (p === undefined || !edge.when(p)) notTaken.push(edge.from);
      }
    }

    // SKIP if any in-edge did not fire. A HALT is the louder andon and takes precedence over a
    // not-taken (something upstream actually failed, vs. a successful branch decision); a node with
    // ONLY not-taken in-edges gets the DISTINCT branch-not-taken reason — the cascade below it reuses
    // the existing halted-upstream machinery (a skipped node never enters `proceeded`).
    if (halted.length > 0 || notTaken.length > 0) {
      const blockedBy = [...halted, ...notTaken];
      const reason =
        halted.length > 0
          ? `skipped — dependent on halted upstream ${halted
              .map((from) =>
                haltReasonOf.has(from) ? `'${from}' (${haltReasonOf.get(from)})` : `'${from}' (upstream skipped)`,
              )
              .join(", ")}`
          : `skipped — branch not taken: upstream ${notTaken
              .map((from) => `'${from}'`)
              .join(", ")} produced a result this edge's predicate rejected`;
      skipped.push({ id, blockedBy, reason });
      continue;
    }

    // JOIN: gather this node's upstreams' `produced`, keyed by from-node. Every in-edge fired
    // ⇒ each `produced` is present and non-empty. Source ⇒ empty map; linear ⇒ 1-entry; join ⇒ many.
    const upstreams: NodeUpstreams = new Map(
      ins.flatMap((edge) => {
        const p = producedAll.get(edge.from);
        return p === undefined ? [] : [[edge.from, p] as const];
      }),
    );

    const node = byId.get(id);
    if (node === undefined) continue; // unreachable (id ∈ order ⊆ declared); guards the Map lookup
    const summary = await node.cast(upstreams);
    summaries.set(id, summary);
    if (firstFail === undefined && summary.outcome !== "success") firstFail = summary;

    // FAN-OUT + thread gate: on proceed, record `produced` — every downstream's in-edge reads it
    // next. On no-proceed, record the andon; this node's downstreams will skip (the cascade root).
    const decision = decideThread(summary);
    if (decision.proceed) {
      proceeded.add(id);
      if (summary.produced !== undefined) producedAll.set(id, summary.produced);
    } else {
      haltReasonOf.set(id, decision.reason ?? "did not proceed");
    }
  }

  // SINKS: the leaves' `produced` are the graph's net output(s). A sink absent from `producedAll`
  // (it failed, produced nothing, or was skipped) is omitted.
  const produced = new Map<NodeId, string>();
  for (const id of order) {
    if ((outDegree.get(id) ?? 0) !== 0) continue;
    const p = producedAll.get(id);
    if (p !== undefined) produced.set(id, p);
  }

  const halted = skipped.length > 0;
  return {
    nodes: summaries,
    skipped,
    outcome: firstFail?.outcome ?? "success",
    halted,
    produced,
    ...(halted ? { haltReason: skipped[0]?.reason } : {}),
  };
}

/**
 * The shared-wallet context {@link runGraphConcurrent} threads when a caller opts into cross-branch
 * budgeting (E-048, T-048-02). `wallet` is the ONE envelope every wave draws from; `priceOf` is each
 * node's PREDICTED price (the `PlayNode.budget` measured envelope, IA-8 honest — `castGraph` builds the
 * map). Absent ⇒ the legacy path (every runnable node dispatched, no authorization, no debit).
 */
export interface ConcurrentBudget {
  readonly wallet: Wallet;
  readonly priceOf: (id: NodeId) => Budget;
}

/** A settled cast's actuals as a debit delta — `{ tokens: countTokens(usage), timeMs: wallMs }`. A
 *  summary without `actuals` (a hand-built stub, never today's `castPlay`) contributes `{0,0}`: the
 *  wallet simply does not move on what we could not measure (no ledger read — that is spend.ts's impure
 *  concern), never a phantom charge. PURE. */
function actualsDelta(summary: RunSummary | undefined): Budget {
  const a = summary?.actuals;
  if (a === undefined) return { tokens: 0, timeMs: 0 };
  return { tokens: countTokens(a.usage), timeMs: a.wallMs };
}

/**
 * The CONCURRENT wave dispatcher — `runGraph`'s twin with `Promise.all` per topological ready-set, and
 * (E-048) an optional SHARED WALLET threaded across the whole graph. PURE GIVEN INJECTED CASTS: it spawns
 * nothing (the `Promise.all` only awaits the injected `DagNode.cast` thunks — concurrency, not impurity);
 * the SPAWNING is `castGraph`'s job (graph.ts). It reuses `topoSort` (ordering + cycle authority),
 * `decideThread` (the per-edge halt gate), and — when budgeted — the pure `authorizeWave`/`debitWave`
 * algebra. The result is assembled in TOPO ORDER, so the {@link GraphResult} is deterministic even though
 * the wave's casts settle in nondeterministic order. Its join/fan-out/halt semantics are the ones
 * graph-core.test.ts proves on the sequential `runGraph`.
 *
 * BUDGET (when `budget` is supplied) — P7 under concurrency:
 *   1. AUTHORIZE before dispatch — `authorizeWave(wallet, readySet, priceOf)` partitions the runnable
 *      ready-set into `dispatch` (collectively affordable: tokens SUM, wall-clock MAX each-fits) and
 *      `stopped` (the wave-boundary HARD STOP). Only `dispatch` is cast.
 *   2. A `stopped` node is a CLEAN budget halt — recorded in `skipped`, never cast, never `proceeded`,
 *      so its dependent subgraph cascade-skips (the runGraph halt semantics) — a successful refusal
 *      (IA-9), not a failure outcome.
 *   3. DEBIT after settle — `debitWave(wallet, dispatchedActuals)` (tokens summed, wall-clock MAX)
 *      threads the fresh wallet into the next ready-set. The wallet is immutable; the fold is the single
 *      point of mutation, so concurrent casts never race the balance.
 * Each wave authorizes against the LIVE (depleting) wallet, so the run converges to a clean stop once
 * nothing fits (`spendDown`'s wallet-exhausted, at wave granularity) while independent affordable work
 * still proceeds. A linear graph is a sequence of single-node waves, where `authorizeWave` == `fitNext`
 * and `debitWave` == `debit` (T-048-01 single-node equivalence) — back-compat for the linear path.
 * Without `budget`, the dispatcher is byte-for-byte its pre-E-048 self.
 */
export async function runGraphConcurrent(spec: DagSpec, budget?: ConcurrentBudget): Promise<GraphResult> {
  const sorted = topoSort(spec);

  // CYCLE — precondition violation (validateDag is the cycle gate). Refuse totally rather than hang:
  // nothing cast, every node skipped, a non-success terminal outcome — byte-for-byte the runGraph path.
  if ("cycle" in sorted) {
    const reason = `graph is cyclic — castGraph runs only acyclic specs (validateDag is the cycle gate); cycle: ${sorted.cycle.join(", ")}`;
    return {
      nodes: new Map(),
      skipped: spec.nodes.map((node) => ({ id: node.id, blockedBy: sorted.cycle, reason })),
      outcome: "gate-failed",
      halted: true,
      produced: new Map(),
      haltReason: reason,
    };
  }

  const order = sorted.order;

  // First-declared node per id (parity with topoSort's first-index rule for any duplicate id;
  // validateDag is what refuses duplicates — here we just stay total and deterministic).
  const byId = new Map<NodeId, DagNode>();
  for (const node of spec.nodes) if (!byId.has(node.id)) byId.set(node.id, node);

  // Adjacency over DECLARED endpoints only — an edge touching an unknown id contributes nothing
  // (parity with runGraph/topoSort). `inEdges` keys are exactly the declared ids in `order`. It stores
  // the whole DagEdge (not just the from-id) so the per-edge `when` predicate (E-049) is in scope when
  // the wave-skip step decides whether each in-edge fires — mirroring the sequential `runGraph`.
  const inEdges = new Map<NodeId, DagEdge[]>();
  const outDegree = new Map<NodeId, number>();
  for (const id of order) {
    inEdges.set(id, []);
    outDegree.set(id, 0);
  }
  for (const edge of spec.edges) {
    if (!inEdges.has(edge.from) || !inEdges.has(edge.to)) continue; // unknown endpoint → ignored
    inEdges.get(edge.to)?.push(edge);
    outDegree.set(edge.from, (outDegree.get(edge.from) ?? 0) + 1);
  }

  const summaries = new Map<NodeId, RunSummary>();
  const proceeded = new Set<NodeId>(); // cast AND passed decideThread (has a threadable produced)
  const producedAll = new Map<NodeId, string>(); // every proceeded node's produced — the fan-out source
  const haltReasonOf = new Map<NodeId, string>(); // why a CAST or budget-stopped node did not proceed
  const decided = new Set<NodeId>(); // proceeded, halted-after-cast, budget-stopped, or skipped
  const skipped: SkippedNode[] = [];
  const remaining = new Set<NodeId>(order);

  // The ONE shared wallet, threaded across every wave (E-048). `let` because each settled wave folds a
  // FRESH wallet (debitWave is immutable) back in. Undefined ⇒ legacy path (no authorize/debit).
  let wallet: Wallet | undefined = budget?.wallet;

  // WAVE LOOP: each pass dispatches the AUTHORIZED ready nodes TOGETHER (Promise.all), then settles and
  // debits the shared wallet. A node is "ready" once all its upstreams are decided; runnable iff all
  // upstreams proceeded; DISPATCHED iff (budget ? it fits the shared wallet : always).
  while (remaining.size > 0) {
    const wave = order.filter(
      (id) => remaining.has(id) && (inEdges.get(id) ?? []).every((e) => decided.has(e.from)),
    );
    // `wave` is non-empty: `order` is a topo order over an acyclic graph, so the earliest remaining
    // node has all upstreams already decided. (Defensive: break to stay total rather than spin.)
    if (wave.length === 0) break;

    // SKIP: a wave node whose in-edges did not all FIRE. Classify each in-edge EXACTLY as the sequential
    // `runGraph` (the reference this must equal): an edge fires iff its upstream proceeded AND its `when`
    // predicate (if any) holds over that upstream's `produced` (E-049). Two distinct unsatisfied kinds:
    //  - halted   : the upstream did not proceed (failed / produced nothing / was itself skipped);
    //  - not-taken: the upstream proceeded, but this edge's predicate rejected its `produced`.
    // A wave node is formed only once every upstream is `decided`, so `proceeded`/`producedAll` are
    // already final for each in-edge here — the same settled state runGraph reads in topo order. The
    // classification is memoized so the record loop below does not re-evaluate (user) predicates.
    const classified = new Map<NodeId, { halted: NodeId[]; notTaken: NodeId[] }>();
    const toSkip = wave.filter((id) => {
      const halted: NodeId[] = [];
      const notTaken: NodeId[] = [];
      for (const edge of inEdges.get(id) ?? []) {
        if (!proceeded.has(edge.from)) {
          halted.push(edge.from);
          continue;
        }
        if (edge.when !== undefined) {
          const p = producedAll.get(edge.from); // proceeded ⇒ present; defensive: undefined ⇒ not-firing
          if (p === undefined || !edge.when(p)) notTaken.push(edge.from);
        }
      }
      classified.set(id, { halted, notTaken });
      return halted.length > 0 || notTaken.length > 0;
    });
    const skipSet = new Set(toSkip);
    // A HALT is the louder andon and takes precedence over a not-taken (something upstream actually
    // failed, vs. a successful branch decision); a node with ONLY not-taken in-edges gets the DISTINCT
    // branch-not-taken reason. The downstream cascade reuses the existing halt machinery — a skipped
    // node never enters `proceeded`, so its dependents classify their in-edge to it as halted. Reasons
    // are byte-for-byte runGraph's, so a predicated spec's GraphResult is identical under both runners.
    for (const id of toSkip) {
      const { halted, notTaken } = classified.get(id) ?? { halted: [], notTaken: [] };
      const blockedBy = [...halted, ...notTaken];
      const reason =
        halted.length > 0
          ? `skipped — dependent on halted upstream ${halted
              .map((from) =>
                haltReasonOf.has(from) ? `'${from}' (${haltReasonOf.get(from)})` : `'${from}' (upstream skipped)`,
              )
              .join(", ")}`
          : `skipped — branch not taken: upstream ${notTaken
              .map((from) => `'${from}'`)
              .join(", ")} produced a result this edge's predicate rejected`;
      skipped.push({ id, blockedBy, reason });
      decided.add(id);
      remaining.delete(id);
    }

    // The runnable ready nodes (all upstreams proceeded). AUTHORIZE them against the shared wallet:
    // `dispatch` is collectively affordable; `stopped` is P7's hard wall at the wave boundary.
    const runnable = wave.filter((id) => !skipSet.has(id));
    const { dispatch, stopped } =
      budget !== undefined && wallet !== undefined
        ? authorizeWave(wallet, runnable, budget.priceOf)
        : { dispatch: runnable, stopped: [] as readonly NodeId[] };

    // BUDGET STOP: a node the wave could not afford is a CLEAN halt — recorded, never cast, never
    // proceeded, so its dependent subgraph cascade-skips (the runGraph halt semantics). IA-9 refusal.
    for (const id of stopped) {
      const price = budget?.priceOf(id);
      const rem = wallet?.remaining;
      const detail =
        price !== undefined && rem !== undefined
          ? `price ${price.tokens} tok / ${price.timeMs} ms, remaining ${rem.tokens} tok / ${rem.timeMs} ms`
          : "shared wallet exhausted";
      const reason = `budget-stopped — wave envelope cannot afford this cast (${detail})`;
      skipped.push({ id, blockedBy: [], reason });
      haltReasonOf.set(id, `budget-stopped: ${detail}`);
      decided.add(id);
      remaining.delete(id);
    }

    // RUN: dispatch the authorized ready nodes CONCURRENTLY. Each gathers its JOIN map (every upstream
    // proceeded ⇒ each produced present) and awaits its injected cast.
    const cast = await Promise.all(
      dispatch.map(async (id) => {
        const upstreams: NodeUpstreams = new Map(
          (inEdges.get(id) ?? []).flatMap((e) => {
            const p = producedAll.get(e.from);
            return p === undefined ? [] : [[e.from, p] as const];
          }),
        );
        const node = byId.get(id);
        if (node === undefined) return [id, undefined] as const; // unreachable (id ∈ order ⊆ declared)
        return [id, await node.cast(upstreams)] as const;
      }),
    );

    // SETTLE: record summaries + the fan-out/thread gate (decideThread, REUSED).
    for (const [id, summary] of cast) {
      decided.add(id);
      remaining.delete(id);
      if (summary === undefined) continue;
      summaries.set(id, summary);
      const decision = decideThread(summary);
      if (decision.proceed) {
        proceeded.add(id);
        if (summary.produced !== undefined) producedAll.set(id, summary.produced);
      } else {
        haltReasonOf.set(id, decision.reason ?? "did not proceed");
      }
    }

    // DEBIT after settle: fold this wave's dispatched actuals into the ONE wallet (tokens SUM,
    // wall-clock MAX). The single fold is the only point of mutation — concurrent casts never race it.
    if (budget !== undefined && wallet !== undefined) {
      wallet = debitWave(
        wallet,
        dispatch.map((id) => actualsDelta(summaries.get(id))),
      ).wallet;
    }
  }

  // DETERMINISTIC ASSEMBLY in topo order — independent of the concurrent settle order above, so the
  // same spec + same casts yield the same GraphResult (parity with the sequential runGraph).
  let firstFail: RunSummary | undefined;
  for (const id of order) {
    const s = summaries.get(id);
    if (s !== undefined && firstFail === undefined && s.outcome !== "success") firstFail = s;
  }

  // SINKS: the leaves' produced are the graph's net output(s); a sink absent from producedAll
  // (failed, produced nothing, or skipped) is omitted.
  const produced = new Map<NodeId, string>();
  for (const id of order) {
    if ((outDegree.get(id) ?? 0) !== 0) continue;
    const p = producedAll.get(id);
    if (p !== undefined) produced.set(id, p);
  }

  // Skips were appended in wave order; re-key to topo order so the result is fully deterministic.
  skipped.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

  const halted = skipped.length > 0;
  return {
    nodes: summaries,
    skipped,
    outcome: firstFail?.outcome ?? "success",
    halted,
    produced,
    ...(halted ? { haltReason: skipped[0]?.reason } : {}),
    ...(wallet !== undefined ? { walletRemaining: wallet.remaining } : {}),
  };
}
