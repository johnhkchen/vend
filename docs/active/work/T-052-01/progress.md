# T-052-01 — Progress

_Pure wiring half of E-052: thread ONE shared wallet through `castRealPlayGraph`. No live spend._

## Status: COMPLETE — all AC satisfied, gate green, committed.

## Steps (per plan.md)

- [x] **Step 1 — pure sizing in the core.** Added `realPlayMacro(survey, propose, note): Budget` to
  `src/play/graph-real-play-core.ts` (+ a type-only `Budget` import). Tokens = survey + 2×propose +
  note; timeMs = survey + propose + note (the two proposes overlap → one propose's wall-clock). Lives
  in the PURE core so the addon-free test can pin it.
- [x] **Step 2 — the proof in the core test.** Added a `describe("realPlayMacro: ONE envelope …")`
  block to `graph-real-play-core.test.ts` with three tests: (A) arithmetic pin
  → `{tokens: 608_000, timeMs: 4_200_000}`; (B) the REAL diamond (`REAL_PLAY_EDGES`) under
  `allocate(realPlayMacro(...))` through the pure `runGraphConcurrent` — all four nodes cast,
  `skipped` empty, not halted, `walletRemaining` exactly `{0,0}` (envelope fully+exactly drawn); (C)
  not-per-node contrast — a one-propose-sized wallet budget-stops propose-2 and skips the join. Added
  a local `costedStub` helper + `costedDiamond` fixture + the four node prices. Imports only pure
  modules — never `graph-real-play.ts`, never `graph.ts`.
- [x] **Step 3 — wire the shell.** `src/play/graph-real-play.ts`: added `import { allocate }`,
  `realPlayMacro` to the core import group, `macroBudget?: Budget` to `GraphRealPlayOptions`, and
  rewrote `castRealPlayGraph` to `allocate` the macro (`opts.macroBudget ?? realPlayMacro(resolved
  budgets)`) and `return castGraph(nodes, edges, allocate(macro))`. Updated the JSDoc to document the
  E-052 shared-wallet threading. `import.meta.main` live entry unchanged (now auto-funds the default
  envelope).
- [x] **Step 4 — gate + commit.** See below.

## Verification

- `bun test src/play/graph-real-play-core.test.ts` → 9 pass (the 3 new + the 6 existing wiring tests).
- `bun run build` (tsc --noEmit) → clean (the third arg is a `Wallet`, matching `castGraph`'s
  `wallet?` param).
- `bun test` (full) → **1191 pass, 0 fail**, 77 files.
- `bun run check:precommit` → `precommit: ok — tests green`.

## AC mapping

| AC clause | satisfied by |
|-----------|--------------|
| `GraphRealPlayOptions` carries a macro/wallet override | `macroBudget?: Budget` (graph-real-play.ts) |
| `castRealPlayGraph` builds it via `allocate(...)` and calls `castGraph(nodes, edges, wallet)` | rewritten `castRealPlayGraph` body |
| new test assertions pin the third arg is a Wallet sized to cover all four nodes (not per-node) | test B (covers all four) + test C (not-per-node contrast) + test A (exact sizing) |
| `bun test` + typecheck stay green | full suite 1191 pass; tsc clean |

## Deviations from plan

None. Implemented exactly as planned. Test C asserts on propose-2's id + the join's absence (not a
positional guess), as flagged in plan.md's Step 2 note — robust to `authorizeWave`'s greedy order
(propose-1 fits the one-propose token envelope, propose-2 is the one stopped).

## Out of scope (T-052-02)

The LIVE metered re-cast (~4 real `claude -p`) and the settled verdict + cast log proving the join ran
on real upstreams — E-052's "Done looks like". This ticket is the pure wiring + deterministic proof
that the envelope covers the diamond; T-052-02 spends it for real.
