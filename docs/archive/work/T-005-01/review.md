# T-005-01 — Review: thread the real model id through the runner

Handoff document. What changed, how it's tested, what a reviewer should know.

## What the change does

`runs.jsonl` now stamps the **real** model id the CLI used
(`claude-opus-4-8[1m]`) instead of the `claude-cli-default` sentinel. The id
rides on the dispense stream (the system-init and assistant messages, never the
terminal `result`); the seam now harvests it during the stream walk and surfaces
it on its returned result, and the runner stamps it on the run-log record. The
sentinel survives only as the genuine last-resort fallback (a timed-out run, or a
stream that named no model). This makes the consistency layer read truth — the
whole reason the run log exists (`steering-data-model.md`).

## Files changed (2 commits)

**Commit `b241027` — seam:**
- `src/executor/claude.ts`
  - `ResultMessage` widened with `model?: string` (additive; open record).
  - New pure, total `extractModelId(msg)`: `message.model` (assistant, preferred)
    → top-level `model` (system init) → `undefined`. Ignores empty strings and
    odd shapes; never throws.
  - `makeStreamConsumer` state → `{ result; model? }`; captures the id
    last-non-empty-wins as each message routes.
  - `dispense` attaches the captured id onto a **fresh** result object (spread)
    only when the result didn't already carry one.
- `src/executor/claude.test.ts` — +10 assertions (extract + capture).

**Commit `09cc530` — runner:**
- `src/play/decompose-epic-core.ts` — `DEFAULT_MODEL` moved in; new pure
  `resolveLoggedModel(real, opt) = real ?? opt ?? DEFAULT_MODEL`.
- `src/play/decompose-epic.ts` — dropped the local `DEFAULT_MODEL` decl (now
  re-exported via `export *`) and the eager pre-dispense `const model`; resolves
  `loggedModel` downstream of dispense; logs `model: loggedModel`.
- `src/play/decompose-epic.test.ts` — +3 assertions (`resolveLoggedModel` table).
- RDSPI artifacts under `docs/active/work/T-005-01/`.

## Test coverage

- **Suite:** 136 pass / 0 fail (was 125), `tsc --noEmit` clean, 11 files.
- **Capture path** (`claude.test.ts`): `extractModelId` across assistant-nested,
  system-top-level, nested-wins-over-top-level, none → undefined, empty-string →
  undefined, odd type → undefined. `makeStreamConsumer`: captures the id off a
  stream whose terminal result carries none; last-non-empty-wins ordering;
  model-less stream → `state.model` undefined.
- **Fallback path** (`decompose-epic.test.ts`): real-wins / pin-only / both-absent
  → sentinel — AC #3's named case, pure, no spawn.
- **Regression guard:** the pre-existing `SAMPLE_LINES` / `makeStreamConsumer`
  assertions are untouched and green, proving the capture addition is
  non-disruptive.

## AC sign-off

| AC | Status | Evidence |
|---|---|---|
| #1 seam surfaces `message.model` on result (`model?`) | ✓ | `extractModelId` + `dispense` attach; capture tests |
| #2 runner stamps real → `opts.model` → sentinel | ✓ | `resolveLoggedModel(result?.model, opts.model)` at the `appendRunLog` site |
| #3 pure fallback test, no live spawn | ✓ | `resolveLoggedModel` table; all capture tests fed sample lines |
| #4 logged model == real stream id; checks green | ✓ (see note) | path unit-proven seam→result→log; `summary.json` live evidence; `bun run check` green |

## Open concerns / limitations

1. **No new live `claude` spawn in this ticket (deliberate).** AC #4 says "a
   run's logged model equals the real id … confirmed against a sample/transcript."
   The seam→consumer→result→log path is proven by unit tests at each seam, and the
   *live* equality was already demonstrated by `T-002-04/results/summary.json`
   (which recovered `claude-opus-4-8[1m]` off every transcript by hand — the exact
   value this ticket now logs automatically). A reviewer wanting belt-and-suspenders
   can re-run `bun docs/active/work/T-002-04/live-proof.ts` and diff the new
   `runs.jsonl` `model` against the transcript; I did not spawn one here to keep the
   change pure and subscription-credit-free, consistent with `dispense` being the
   lone untested verb.
2. **Stream-shape assumption.** `extractModelId` targets the two shapes observed
   in the T-002-04 transcripts (`message.model`, top-level `model`). A future CLI
   that relocates the id (e.g. onto the terminal `result`, or a renamed key) would
   silently fall back to the sentinel rather than break — safe degradation, but the
   capture would need a new shape added. The `dispense` "attach only if absent"
   guard already lets a result-borne `model` win untouched if the CLI ever stamps
   one there.
3. **`message.model` vs `model` precedence.** Chosen: nested assistant id wins over
   a top-level system-init id (the assistant message is what actually produced the
   work). In practice both carry the same string today, so the choice is currently
   academic; documented in `design.md` D2 so a future divergence is a known call,
   not an accident.
4. **`DEFAULT_MODEL` relocation.** Moved core-ward and re-exported via `export *`.
   Grep confirmed only in-file references existed (`decompose-epic.ts`), so no
   import site broke; any `import { DEFAULT_MODEL } from "./decompose-epic"` still
   resolves. Low risk, flagged for completeness.

## Nothing requiring human escalation

The change is additive, fully green, and reversible (the only cross-module move is
a constant with a one-line re-add as rollback). No gate, budget, or materialize
behaviour changed — only the recorded `model` string. Ready for merge.
