# T-066-01-02 — story-completeness-gate — Progress

All plan steps executed in order; both commits landed on `main`; `bun run check` green at each
commit point. No sibling-owned file touched.

## Completed

- [x] **Step 1 — `src/gate/gates.ts`**: `GATE_NAMES` widened to five (`story-completeness` at
      position 2); `STORY_CONTRACT_FIELDS` + `StoryContractField` moved in (canonical home,
      `satisfies` pin intact); `storyCompletenessGate` added between value and allocation;
      `GATES` table row inserted; header + `clear()` doc comments updated (four → five,
      ordering line, story-contract division-of-labor paragraph).
- [x] **Step 2 — `src/play/decompose-epic-core.ts`**: local declarations replaced with
      `export { STORY_CONTRACT_FIELDS } from "../gate/gates.ts"` + the split type re-export;
      section comment names the new canonical home; `STORY_CONTRACT_EXEMPLAR` untouched.
      *Deviation (small, forced by tsc):* the module's `StoryDraft` type import became unused
      after the move and was removed from the import line — not in the plan's text, required
      for the typecheck to pass, zero behavior change.
- [x] **Step 3 — `src/gate/gates.test.ts`**: `story()` fixture enriched with contract-shaped
      defaults (no-over-refusal proof: all 19 pre-existing tests keep their verdicts); new
      `describe("story-completeness gate")` with 7 tests — shell-all-five (andon token + all
      five names + story id), partial-exact-two (byte-exact reason pins schema order and
      non-inclusion), whitespace-is-missing, contract-shaped passes, first-offending-story
      unit, and both ordering probes (value still first; story-completeness before allocation).
      26 pass / 0 fail.
- [x] **Step 4 — Commit 1** `8fa03e7` `feat(gates): story-completeness gate — a shell story
      STOPs before the effect (T-066-01-02)` — full `bun run check` green first
      (1531 pass / 1 pre-existing skip / 0 fail).
- [x] **Step 5 — `src/play/story-gate-cast.test.ts`** (new): stub executor dispenses
      `JSON.stringify(SHELL_PLAN)` through the real `castPlay`; fixture play wires the REAL
      `clear` (same context shape as `decomposeEpicPlay.gates`) and the REAL `materialize`.
      Refused cast: `gate-failed`, `materialized: false`, stories/tickets dirs never created
      (readdir ⇒ ENOENT), runs.jsonl `gateResults` equals the single failed row
      `S-900: story-incomplete — missing: <all five>`. Contrast cast: `success`, one story +
      one ticket file exist, five passed gate rows in order. 2 pass / 0 fail. Live stdout
      showed the designed andon line verbatim.
- [x] **Step 6 — `docs/knowledge/playbook-decompose-epic.md`**: story-completeness inserted as
      entry 2 of §"The clearing gates"; entries 3–5 renumbered. (The later rule-set section
      references gates by NAME, not number — checked, no renumber fallout.)
- [x] **Step 7 — Commit 2** — full `bun run check` green (1533 pass / 1 skip / 0 fail,
      1534 tests / 104 files), then commit
      `test(play): cast-level proof a dispensed shell never reaches the effect (T-066-01-02)`.

## Deviations from plan

Only the Step-2 unused-import removal noted above. Everything else landed as planned; no scope
was added and no fence (materialize.ts, rdspi-workflow.md) was crossed.

## Remaining

Nothing — both ACs implemented and verified. Review phase (review.md) follows.
