# T-052-01 — Design

_Decision: add a PURE `realPlayMacro(survey, propose, note)` sizing function to
`graph-real-play-core.ts`, a `macroBudget?: Budget` override to `GraphRealPlayOptions`, and have
`castRealPlayGraph` `allocate(...)` ONE wallet and pass it as `castGraph`'s third arg. Prove the
sizing in `graph-real-play-core.test.ts` by driving the real diamond through the pure
`runGraphConcurrent` under the real-play-sized wallet — all four nodes authorized, none budget-stopped._

## The decision in one paragraph

`castRealPlayGraph` resolves the three node budgets exactly as `buildRealPlayGraph` does
(`opts.surveyBudget ?? surveyPlay.budget`, …), computes the macro envelope via a new pure
`realPlayMacro`, `allocate`s ONE `Wallet`, and calls `castGraph(nodes, edges, wallet)`. The macro is
sized per-denomination to cover the whole diamond's wave schedule: **tokens = survey + 2×propose +
note** (the fan-out's two proposes both burn real tokens), **timeMs = survey + propose + note** (the
two proposes overlap, so wall-clock counts one). A `macroBudget?: Budget` option lets a caller
override the envelope (T-052-02 sizes/funds the live cast). The sizing arithmetic lives in the PURE
core so the addon-free test pins it without importing the impure shell.

## Where each piece lives — and why

### 1. `realPlayMacro` in `graph-real-play-core.ts` (the pure judgment)

```ts
export function realPlayMacro(survey: Budget, propose: Budget, note: Budget): Budget {
  return {
    tokens: survey.tokens + 2 * propose.tokens + note.tokens, // SUM — both proposes burn real tokens
    timeMs: survey.timeMs + propose.timeMs + note.timeMs,      // proposes OVERLAP → one propose's time
  };
}
```

Why here, not in the shell: the shell is impure (loads the addon), so no `bun test` may import it
(graph-real-play.ts:22–27). The macro's correctness is a pure, load-bearing judgment — it must be
testable without spawning. This is the exact discipline that put `pickSignal`/`buildConsolidationTopic`
in the core rather than the shell. `Budget` is a type-only import (erased) plus arithmetic; no
fs/clock/addon — it satisfies the core's purity contract (core header lines 14–18).

Why the per-denomination asymmetry rather than "sum all four on both": it is the HONEST envelope, and
it is the same IA-8 divergence the dispatcher itself embodies — `authorizeWave` sums tokens but
each-fits time, `debitWave` sums tokens but maxes time (spend-core.ts:114–157, wallet.ts:149–168).
Summing all four on time would over-fund by one propose (1.8M ms) — harmless but dishonest about what
the wave actually draws, and it would weaken the test (a too-loose envelope can't distinguish "covers
the diamond" from "covers more than the diamond"). The tight envelope is the one that exactly
authorizes every wave and would fail if it under-counted either denomination.

### 2. `macroBudget?: Budget` on `GraphRealPlayOptions`

```ts
/** Override the ONE shared macro-wallet envelope the whole diamond draws from (E-052). Omitted ⇒
 *  realPlayMacro(survey, propose, note) — sized to cover survey + 2 proposes + note. */
readonly macroBudget?: Budget;
```

Mirrors the existing per-node-budget overrides (graph-real-play.ts:60–63): additive, optional, with a
computed default. The AC says "GraphRealPlayOptions carries a macro/wallet override" — a `Budget` (fed
through `allocate`) is chosen over a ready-made `Wallet` because every other override on this interface
is a `Budget`, `allocate` is a trivial pure constructor the shell already must call, and a `Budget`
keeps the override symmetric with `surveyBudget`/`proposeBudget`/`noteBudget`. (See Rejected
alternatives for why not `wallet?: Wallet`.)

### 3. `castRealPlayGraph` wires it (the impure shell)

```ts
export async function castRealPlayGraph(opts: GraphRealPlayOptions = {}): Promise<GraphResult> {
  const { nodes, edges } = buildRealPlayGraph(opts);
  const macro = opts.macroBudget ?? realPlayMacro(
    opts.surveyBudget ?? surveyPlay.budget,
    opts.proposeBudget ?? proposeEpicPlay.budget,
    opts.noteBudget ?? captureNotePlay.budget,
  );
  return castGraph(nodes, edges, allocate(macro));
}
```

The three `?? play.budget` resolutions duplicate `buildRealPlayGraph`'s lines 88–90. This minor,
local duplication is preferred over refactoring `buildRealPlayGraph` to also return its resolved
budgets — it keeps the change to two functions, reads top-to-bottom, and the duplication is three
trivial `??` fallbacks, not logic. (See Rejected alternatives.)

## Test design (the AC's proof, in the pure core test)

Add a `describe` block to `graph-real-play-core.test.ts` importing `realPlayMacro` (and `allocate`,
`runGraphConcurrent`, the node ids/edges):

1. **Arithmetic pin** — `realPlayMacro({300k,1.8M},{150k,1.8M},{8k,600k})` equals
   `{tokens: 608_000, timeMs: 4_200_000}`. Pins the exact per-denomination formula (tokens count BOTH
   proposes; time counts ONE). A regression that forgot the second propose, or summed time, fails here.
2. **Covers the whole diamond (the headline "sized to cover all four nodes")** — drive the REAL
   `REAL_PLAY_EDGES` diamond through the pure `runGraphConcurrent` with `costedStub`s priced at the
   real node budgets and a wallet = `allocate(realPlayMacro(...))`. Assert **all four nodes cast**
   (`result.nodes` has survey/propose-1/propose-2/capture-note), **`result.skipped` is empty** (no
   budget-stop — the join RAN), `result.halted === false`, and `walletRemaining` is ≥ 0 on both
   denominations (spend bounded by the envelope). This is the live cast's behavior proven
   deterministically — the wiring half of E-052's "Done looks like" #1/#4.
3. **Not-per-node contrast** — the SAME diamond under a wallet sized for only ONE propose's tokens
   (`allocate({tokens: survey + propose + note, timeMs: 4.2M})`) budget-STOPS propose-2: it lands in
   `skipped` with a `budget-stopped` reason and the join (capture-note) cascade-skips. This pins WHY
   the macro must count both proposes — the leak E-052 closes — mirroring graph-example.test.ts's
   shared-vs-per-node contrast (lines 126–183).

All three import only pure modules — no addon, no spawn, no live model — honoring the test header's
discipline.

## Rejected alternatives

- **`wallet?: Wallet` on the options instead of `macroBudget?: Budget`.** Rejected: breaks symmetry
  with the three existing `Budget` overrides; pushes the `allocate` call onto every caller; and a
  pre-funded wallet with a depleted `remaining` would be a confusing thing to hand a fresh cast. A
  `Budget` the shell `allocate`s is cleaner and is what the AC's "macro/wallet override" most
  naturally reads as ("macro" = the macro budget). `allocate` stays the shell's single funding point.
- **Sum all four nodes on BOTH denominations** (timeMs = survey + 2×propose + note). Rejected:
  over-funds wall-clock by one propose, contradicting the IA-8 concurrency divergence the dispatcher
  enforces, and loosens the test. The tight, honest envelope is the design's whole point.
- **Compute the macro inside `buildRealPlayGraph` and return it.** Rejected: `buildRealPlayGraph` is
  the "built, not cast, so a caller can inspect the spec" function (graph-real-play.ts:78–82) —
  returning a wallet muddies its single responsibility. Sizing belongs to the casting verb.
- **Put `realPlayMacro` in `wallet.ts` or `budget.ts`.** Rejected: it encodes THIS diamond's wave
  schedule (one survey, two overlapping proposes, one note) — domain knowledge of the real-play graph,
  not general budget algebra. It belongs beside `REAL_PLAY_EDGES` in the real-play core.
- **Derive the macro by summing `nodes.map(n => n.budget)` generically.** Rejected: a blind sum can't
  know the two proposes overlap on wall-clock — it would over-fund time and, worse, hide the
  concurrency-aware sizing that is the interesting judgment. Explicit `(survey, propose, note)` makes
  the wave schedule legible.
