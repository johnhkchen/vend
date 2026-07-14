# T-052-01 — Plan

_Three ordered steps, each independently verifiable. One atomic commit at the end (pure wiring + its
proof land together). No live spend._

## Testing strategy

- **Unit (the whole AC):** `graph-real-play-core.test.ts` — three new assertions. Pure: imports the
  core + `runGraphConcurrent` + `allocate`, never the impure shell. No addon, no spawn, no model.
  - Arithmetic pin of `realPlayMacro` (exact per-denomination formula).
  - Coverage proof: the real diamond under the real-play-sized wallet authorizes all four nodes (join
    runs, spend bounded) — driven through the same pure dispatcher `castGraph` delegates to.
  - Not-per-node contrast: a one-propose-sized wallet budget-stops propose-2.
- **Typecheck:** `bun run build` (tsc) — confirms the new option + the `castGraph(…, allocate(macro))`
  call typecheck (third arg is `Wallet`, matching graph.ts:101).
- **No integration/live test in this ticket.** The metered re-cast (E-052 "Done looks like") is
  T-052-02. T-052-01's verification criterion is exactly the AC: green `bun test` + typecheck on the
  pure wiring.

## Verification criteria (AC restated)

1. `GraphRealPlayOptions` carries `macroBudget?: Budget`.
2. `castRealPlayGraph` builds the envelope via `allocate(...)` and calls `castGraph(nodes, edges,
   wallet)` (the third arg is a `Wallet`).
3. New `graph-real-play-core.test.ts` assertions pin the wallet is sized to cover ALL FOUR nodes (not
   per-node).
4. `bun test` + typecheck stay green.

## Step 1 — pure sizing in the core

**Files:** `src/play/graph-real-play-core.ts`

- Add `import type { Budget } from "../budget/budget.ts";`.
- Add the exported `realPlayMacro(survey, propose, note): Budget` with the per-denomination formula
  (tokens = survey + 2×propose + note; timeMs = survey + propose + note) and the docstring from
  structure.md §1.

**Verify:** `bun run build` typechecks the core in isolation (no other file references it yet, so this
just confirms the function compiles and the import resolves).

## Step 2 — the proof in the core test

**Files:** `src/play/graph-real-play-core.test.ts`

- Add imports: `runGraphConcurrent` (graph-core.ts), `allocate` (wallet.ts), `Budget` (budget.ts),
  `DagNode` (dag-core.ts), and `realPlayMacro` from the core.
- Add a `costedStub(id, produced, price)` helper + the four real-play node prices
  (`{survey:{300k,1.8M}, propose:{150k,1.8M}, note:{8k,600k}}`).
- Add `describe("realPlayMacro: ONE envelope sized to cover the whole diamond (E-052, AC)")`:
  - **test A (arithmetic):** `expect(realPlayMacro(SURVEY_P, PROPOSE_P, NOTE_P)).toEqual({ tokens:
    608_000, timeMs: 4_200_000 })`.
  - **test B (covers all four):** build a `DagSpec` of four `costedStub`s over `REAL_PLAY_EDGES`,
    `priceOf` from the price map, wallet = `allocate(realPlayMacro(...))`, run
    `runGraphConcurrent(spec, {wallet, priceOf})`. Assert: `[...result.nodes.keys()].sort()` ===
    `["capture-note","propose-1","propose-2","survey"]`; `result.skipped` is `[]`; `result.halted`
    false; `result.outcome` `"success"`; `result.walletRemaining.tokens ≥ 0` and `.timeMs ≥ 0`.
  - **test C (not per-node):** same spec, wallet = `allocate({ tokens: 300_000 + 150_000 + 8_000,
    timeMs: 4_200_000 })` (only ONE propose's tokens). Assert propose-2 (or propose-1 — whichever the
    walk reaches second) appears in `skipped` with a `/budget-stopped/` reason and `capture-note` did
    NOT run (`result.nodes.has(NOTE_NODE)` false; join cascade-skipped). This pins WHY both proposes
    must be counted.

**Verify:** `bun test src/play/graph-real-play-core.test.ts` — the three new tests green alongside the
existing fan-out/join wiring tests. Step 1's function is now proven.

> Note on test C exactness: `authorizeWave` walks the ready-set in declaration order and greedily
> dispatches. With a one-propose token envelope, propose-1 fits (cumulative 150k ≤ remaining after
> survey), propose-2 does not (cumulative 300k > remaining), so **propose-2** is the stopped one and
> capture-note cascade-skips (its upstream propose-2 never proceeded). The assertion targets
> propose-2 by id and the join's absence — robust to the greedy order.

## Step 3 — wire the shell

**Files:** `src/play/graph-real-play.ts`

- Add `import { allocate } from "../budget/wallet.ts";` and `realPlayMacro` to the core import group.
- Add `macroBudget?: Budget` to `GraphRealPlayOptions` (after `noteBudget`).
- Rewrite `castRealPlayGraph` to compute `macro` (`opts.macroBudget ?? realPlayMacro(resolved
  budgets)`) and `return castGraph(nodes, edges, allocate(macro))`.
- Update the `castRealPlayGraph` JSDoc + the module header's shared-wallet line so the prose says it
  now threads ONE shared wallet (E-052).

**Verify:**
- `bun run build` — typecheck green (third arg now a `Wallet`).
- `bun test` — the FULL suite green (the shell isn't unit-imported, but the run confirms nothing else
  regressed and the core test still passes).
- `bun run lint` — format/lint clean.

## Step 4 — gate + commit (atomic)

- Run the project gate: `bun test` + `bun run build` + `bun run lint` (the precommit gate — tests
  green, typecheck clean, lint clean).
- Single commit: `feat(play): thread ONE shared wallet through castRealPlayGraph (T-052-01)` —
  pure sizing + its proof + the wire land together (the test proves the function the wire uses; no
  value in splitting). End with the Co-Authored-By trailer.

## Risks & mitigations

- **R1: a too-loose envelope hides under-counting.** Mitigated by test C — the tight one-propose
  contrast fails if the macro under-counts, and test A pins the exact numbers.
- **R2: greedy-order ambiguity in test C** (which propose stops). Mitigated by asserting on
  propose-2's id + the join's absence, not a positional guess — see the Step 2 note.
- **R3: back-compat surprise** — a caller relying on the legacy no-wallet path. Only two callers exist
  (the `import.meta.main` entry and T-052-02), both of which WANT the budgeted path; this is the
  intended change, documented in the JSDoc.
- **R4: `allocate` RangeError** on a bad override. The computed default is always positive integers;
  a caller override is their contract (matches `allocate`'s existing guard semantics).
