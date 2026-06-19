# T-017-01 — Progress

Following plan.md. All five steps complete; one design-level deviation recorded (the SAP hybrid).

## Steps

- [x] **Step 1 — `baml_src/survey.baml` + regenerate.** `Board { signals Signal[] }` +
  `Survey(project, charter) -> Board`, referencing the shared `Signal`/`SignalTier` (no redefinition).
  `bun run baml:gen` emitted `Board` (`baml_client/types.ts:109`) and `Survey` (sync_client + parser).
  Confirmed `b.request.Survey(project, charter)` signature matches the ticket.
- [x] **Step 2 — `src/baml/survey-bridge.ts`.** Mirrors `expand-bridge.ts`; `extractPromptText` imported
  from `decompose-bridge.ts`; render op `b.request.Survey(op.project, op.charter)`, parse op
  `b.parse.Survey`.
- [x] **Step 3 — `src/play/survey-core.ts`.** `SURVEY_GATE_NAMES`, `TIER_RANK` + `tierRank` (throws on
  drift), copied `nonEmpty`, the three gates, `clear(board)`, `renderBoard(board)` reusing
  `renderSignalRow` from `expand-core.ts`. Pure: no fs/process/addon (only value import is the pure
  `renderSignalRow`).
- [x] **Step 4 — `src/play/survey-core.test.ts`.** 10 pure tests: ranked grounded ⇒ clear; ties ⇒ clear;
  single ⇒ clear; empty ⇒ clear (the polarity proof); blank filler ⇒ honest-empty stop; ungrounded ⇒
  read-never-invent stop; out-of-order ⇒ leverage-rank stop (×2); drift ⇒ RangeError; renderBoard row
  count + empty + drift.
- [x] **Step 5 — `src/baml/survey.test.ts`.** 6 offline BAML pins via the child bridge: parse a canned
  ranked board; **object-garbage degrades to empty board**; **bare-string garbage is rejected** (the
  hybrid finding below); render carries both inputs + the `demand-surveyor` framing.

## Deviation — the SAP honest-empty handle is HYBRID, not pure-degrade (DESIGN UPDATE)

design.md / structure.md predicted "a garbage reply degrades to an empty board" by analogy to
`WorkPlan`. Probing the live parser revealed a divergence driven by **field count**:

- `WorkPlan` has **two** array fields → a bare string `"this is not a work plan at all"` falls to
  `{stories:[], tickets:[]}` (verified against `decompose-bridge.ts`).
- `Board` has **one** array field → SAP tries to coerce a bare string INTO `signals`, fails, and
  `b.parse` **THROWS** (`Failed to coerce value`). An **object**-shaped reply lacking `signals` still
  degrades to `{signals: []}`.

**Consequence:** Survey's honest-empty handle is a **hybrid**: object-garbage degrades (no closure
needed), but an unstructured reply throws and **T-017-02's parse closure must CATCH it and coerce to an
empty board** — exactly the catch expand's closure already does. This is now pinned by two distinct
tests, and is the single most important note carried to T-017-02. It does NOT affect the pure core
(`clear`/`renderBoard` are unchanged — both garbage shapes arrive as an empty board once T-017-02's
closure is in place, and honest-empty clears it).

## No other deviations

Gate semantics, ordering, the empty-board CLEAR polarity, the `renderSignalRow` reuse, and the
no-external-context `clear(board)` all landed as designed.

## Verification

- `bun test src/play/survey-core.test.ts src/baml/survey.test.ts` → **16 pass, 0 fail**.
- Full `bun run check` → **528 pass, 0 fail**, `tsc --noEmit` clean (recorded in review.md).
- **Commits deferred to the Lisa sweep** (this session writes artifacts + source and stops after
  review per the run directive; Lisa detects the artifacts, advances the phase, and the human/loop
  commits). plan.md's per-step commit messages stand as the suggested sweep breakdown.
