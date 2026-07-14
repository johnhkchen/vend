# T-016-01 — Progress

Execution log for the plan. Updated as steps land.

## Status: COMPLETE — all steps done, `bun run check` green (499 pass / 0 fail)

| Step | What | State |
|---|---|---|
| 1 | `baml_src/expand.baml` (SignalTier + Signal + ExpandFragment) + `baml:gen` | ✅ done |
| 2 | `src/play/expand-core.ts` (3 gates + renderer + ExpandClearContext) | ✅ done |
| 3 | `src/play/expand-core.test.ts` (11 pure tests) | ✅ done — green, addon-free, 7ms |
| 4 | `src/baml/expand-bridge.ts` (subprocess render/parse) | ✅ done |
| 5 | `src/baml/expand.test.ts` (3 offline pins) | ✅ done — green, 96ms |
| 6 | `bun run check` (baml:gen + typecheck + suite) | ✅ done — 499 pass, 0 fail |

## What landed

- **`baml_src/expand.baml`** — `enum SignalTier {Keystone|High|Standard|Leaf}`, `class Signal`
  (what · why · tier · budget · advances · grounding · readiness), `function ExpandFragment(fragment,
  charter, project) -> Signal` with the demand-extractor prompt encoding read-never-invent + the
  honest-empty (abstain-blank) contract. `baml:gen` emits `Signal`/`SignalTier` into `baml_client`
  (untracked/generated — only the `.baml` source is committed).
- **`src/play/expand-core.ts`** — pure, zero runtime imports. `clear(signal, ctx)` runs the ordered
  gate table `honest-empty → read-never-invent → value-link`, returns the engine's `GateVerdict`
  (first STOP wins; CLEAR echoes all three names). `renderSignalRow(signal)` is the pure demand-row
  renderer (tier member→alias; throws `RangeError` on drift). `ExpandClearContext = { charter }`.
- **`src/play/expand-core.test.ts`** — 11 pure tests: clears all gates; honest-empty (blank what/why
  + SAP-degraded empty); read-never-invent (blank grounding); value-link (empty / non-goal /
  dangling / free-text-passes); renderer round-trip + drift throw.
- **`src/baml/expand-bridge.ts`** — clone of `propose-bridge.ts`; `runOp` over
  `b.request`/`b.parse.ExpandFragment`; `extractPromptText` imported from `decompose-bridge.ts`.
- **`src/baml/expand.test.ts`** — 3 offline pins via one child spawn: parse-of-canned → typed
  Signal; SAP-reject garbage → `ok:false` "required field"; render → 3 sentinels + framing.

## Deviations from plan

None. The plan's step order held exactly. Per-step commits were consolidated into two logical
commits (BAML authoring; then core + bridge + tests) for a cleaner history — the plan flagged this
folding was acceptable (Step 2/4 "folded into" their test commits).

## Notes for the reviewer / T-016-02

- The core returns a `GateVerdict` and the renderer is pure — both drop straight into the T-016-02
  `Play.gates` / staging effect with no adapter (verified: `clear`'s return type IS `GateVerdict`).
- `budget` is a model-proposed string default; T-016-02's effect/assemble is where the **measured
  E-013 envelope** pre-fill replaces it (out of scope here, by design — keeps the core ledger-free).
- The lisa-managed ticket frontmatter and an unrelated untracked `docs/active/pm/
  brainstorm-block-utilization-depth.md` were left untouched (not part of this ticket).
