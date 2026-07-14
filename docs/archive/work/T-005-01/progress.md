# T-005-01 — Progress

## Status: implementation complete, full green bar

`bun run check:typecheck` clean; `bun test` → **136 pass / 0 fail** across 11
files (was 125 before this ticket — +11 new assertions, none regressed).

## Steps executed (per plan.md)

- [x] **Step 1 — seam capture (`src/executor/claude.ts`)**
  - Widened `ResultMessage` with `model?: string` (open record, additive).
  - Added pure, total `extractModelId(msg)` — checks `message.model` (assistant,
    preferred), then top-level `model` (system init); ignores empty/odd shapes.
  - `makeStreamConsumer` state widened to `{ result; model? }`; captures the id
    last-non-empty-wins as messages route.
  - `dispense` attaches `state.model` onto a **fresh** result object (spread, so
    the by-reference `onMessage` message is never mutated), only when the result
    didn't already carry a `model`.
- [x] **Step 2 — seam tests (`claude.test.ts`)** — 10 new assertions across
  `extractModelId` (assistant / system / nested-wins / none / empty) and
  `makeStreamConsumer` model capture (captured-off-stream / last-wins /
  model-less → undefined). Existing `SAMPLE_LINES` assertions untouched.
- [x] **Commit 1** `2e?` "seam surfaces real model id off the dispense stream".
- [x] **Step 3 — core (`decompose-epic-core.ts`)** — moved `DEFAULT_MODEL` in;
  added pure `resolveLoggedModel(real, opt)` = `real ?? opt ?? DEFAULT_MODEL`.
- [x] **Step 4 — runner (`decompose-epic.ts`)** — removed the local
  `DEFAULT_MODEL` decl (now re-exported from core via `export *`) and the eager
  pre-dispense `const model`; imported `resolveLoggedModel`; resolved
  `loggedModel = resolveLoggedModel(result?.model, opts.model)` **after** the
  seam try/catch; `appendRunLog({ … model: loggedModel })`.
- [x] **Step 5 — core test (`decompose-epic.test.ts`)** — `resolveLoggedModel`
  fallback table (real-wins / pin / sentinel), importing `DEFAULT_MODEL`.
- [ ] **Commit 2** — pending (this progress note + review land with it).

## Deviations from plan

None of substance. As plan.md predicted, steps 3 and 4 were done as one
edit-unit (the duplicate `DEFAULT_MODEL` export collides through `export *`
between them, so no typecheck was attempted at the in-between state).

## AC status

- AC #1 (seam surfaces `message.model` on result, type `model?`) — **done**,
  tested.
- AC #2 (runner stamps real → pin → sentinel) — **done**, wired downstream of
  dispense.
- AC #3 (pure unit test of the fallback, no live spawn) — **done**
  (`resolveLoggedModel` table; all capture tests fed sample lines).
- AC #4 (logged model == real stream id; checks green) — capture+stamp path is
  unit-proven at every seam; the live equality was already evidenced by
  `T-002-04/results/summary.json` (`claude-opus-4-8[1m]`). `bun run check` green.
  No new live spawn added (deliberate — see review §open concerns).
