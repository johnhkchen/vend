# T-007-04 — Progress: second-play-proves-agnostic

The `capture-note` sorcery is authored, registered, and casts through the same `castPlay` as
`decompose-epic` — E-007's keystone done-signal (**≥2 plays through one engine**) is met.
`bun run check` green: `tsc` clean, **266 pass / 0 fail** (was 252; +14 new tests),
deterministic across repeated runs. The change is **purely additive** — five new files + one
BAML function; no edit to the engine, DecomposeEpic, or any dispatch surface.

## Step 1 — BAML function + client regen ✓

- `baml_src/note.baml`: `class Note { title, summary, points[] }` + `function CaptureNote(topic,
  project) -> Note` on the shared render-only `ClaudeStub`.
- `bun run baml:gen` → 14 files written; `Note` lands in `baml_client/types.ts` (re-exported via
  `index.ts`), `b.{request,parse}.CaptureNote` in the client. Typecheck still clean.

## Step 2 — Pure core + the AC#3 demonstration ✓

- `src/play/note-core.ts`: `NoteInputs`, `NOTES_DIR`, `NOTE_GATE`, `slugify`, `renderNoteFile`,
  `clearNote` (the `substance` gate → `GateVerdict`), `captureNoteEffect` (the impure-fs verb).
  Addon-free (all BAML/engine imports TYPE-ONLY).
- `src/play/note-core.test.ts`: 10 tests — slugify, render, gate clear + the three STOP units,
  `captureNoteEffect` writing to a `mkdtemp` dir, and the `classify` wiring (clear→materialize,
  stop→`gate-failed` no-materialize). **This step is AC#3**: artifact produced, gate passes,
  line stops on gate-fail. `bun test` green; typecheck clean (after fixing the `BudgetOutcome`
  fixture to carry `spent`/`ceiling`/`remaining`).

## Step 3 — Render/parse bridge + its test (AC#1) ✓

- `src/baml/note-bridge.ts`: `NoteBridgeOp`/`NoteBridgeResult`/`runOp` + `import.meta.main`
  entry. Mirrors `decompose-bridge.ts`; imports `extractPromptText` from it (shared, not
  re-implemented).
- `src/baml/note.test.ts`: 4 tests — canned reply → typed `Note`; **garbage reply REJECTED by
  SAP**; present-but-empty reply degrades to empty; render injects the topic/project sentinels.

## Step 4 — The play + registration + cast entry ✓

- `src/play/note.ts`: `captureNotePlay: Play<NoteInputs, Note>` (the six members),
  `registry.register(...)`, `CaptureNoteOptions`, `assembleNoteInputs`, `castCaptureNote`. Value-
  imports `b` — **no test imports this module**. Typecheck clean; suite still green.

## Step 5 — Registration smoke (the ≥2-plays keystone) ✓

`bun -e` importing both plays:
```
names: ["decompose-epic","capture-note"]
capture-note found: true  card: {"color":["red"],"type":"sorcery","rarity":"common"}
                          budget: {"timeMs":600000,"tokens":8000}
decompose-epic found: true
miss message: play "nope" is not registered — available: decompose-epic, capture-note
```
Two plays, one registry/engine. (A smoke, not a `bun:test`: registration is an import side
effect that loads the addon.)

## Step 6 — Full green ✓

`bun run check` (baml:gen + tsc + bun test): **266 pass / 0 fail**, deterministic over two
runs — the addon-leak guard (R1) holds (no test imports `note.ts`/`b`; tests use note-core or
spawn the bridge).

## Deviation — SAP leniency differs by output shape (Note vs. WorkPlan)

**Planned assumption (Design D2):** Note inherits WorkPlan's empty-degradation hazard — a
malformed reply degrades to an empty note the gate stops on.

**What we found:** Note's required *scalar* fields (`title`/`summary`) make `b.parse` **REJECT
(throw)** a reply missing them — only a *present-but-empty* reply degrades. WorkPlan degrades
unconditionally because it is all-array. Since `castPlay` calls `play.parse` with no error
channel, an uncaught throw would crash the cast instead of logging a clean andon.

**Resolution (in scope, additive):** hardened the play's `parse` closure (`parseNote` in
note.ts) to catch the SAP rejection and return an empty Note → the `substance` gate STOPs the
line as a clean `gate-failed`, preserving decompose's "parse never throws; the gate catches
empty" invariant for a play whose parse otherwise could throw. Both SAP behaviors are pinned in
note.test.ts; the gate-stop on an empty note is pinned in note-core.test.ts. Documented for
Review as a finding the engine contract may want to absorb (a total-parse expectation on
`Play.parse`).

## Notes for Review

- Dispatch (`runPlay`/`cli.ts`/`press.ts`) is **deliberately untouched** — their `RunOptions`
  are epic-shaped. `castCaptureNote` (the parallel of `runDecomposeEpic`) delivers the keystone
  (second play through the same `castPlay`) without an epic-shaped-dispatch refactor. Wiring
  `vend run capture-note` (heterogeneous input assembly behind `runPlay`) is a clean follow-up.
- No live model run was performed (no offline path exists for it); the cast is proven
  structurally + by the registration smoke, exactly as DecomposeEpic's live cast is.
