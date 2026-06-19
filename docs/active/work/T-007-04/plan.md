# T-007-04 — Plan: second-play-proves-agnostic

Ordered, independently-verifiable steps. Each leaves `tsc` clean and the suite green so any
step can commit atomically. Testing strategy is per-step. The work is additive (new files +
one BAML function); no existing module is edited.

## Step 1 — Author the BAML function and regenerate the client

- Create **`baml_src/note.baml`**: the `Note` class (title, summary, points[]) and
  `function CaptureNote(topic, project) -> Note` using the shared render-only `ClaudeStub`.
- Run `bun run baml:gen` to emit `Note` + `b.{request,parse}.CaptureNote` into `baml_client/`.
- **Verify:** `bun run baml:gen` exits 0; `grep` confirms `Note` and `CaptureNote` exist in
  `baml_client/`. `bun run check:typecheck` still clean (nothing imports the new type yet).
- **Atomic:** yes — pure authoring, no consumer.

## Step 2 — The pure core (`note-core.ts`) + its test (the AC#3 demonstration)

- Create **`src/play/note-core.ts`**: `NoteInputs`, `NOTES_DIR`, `slugify`, `RenderedNote`,
  `renderNoteFile`, `clearNote`, `captureNoteEffect`. Addon-free imports only (type-only
  `GateVerdict`/`CastContext`/`EffectResult` + type-only `Note`; `node:fs/promises`/`node:path`
  for the verb).
- Create **`src/play/note-core.test.ts`**: `slugify`, `renderNoteFile`, `clearNote`
  (clear + the three STOP units), `captureNoteEffect` (writes to a `mkdtemp` dir, asserts the
  file + contents + `artifacts`), and the `classify` integration (clear→materialize,
  stop→`gate-failed` no-materialize).
- **Verify:** `bun test src/play/note-core.test.ts` green; `bun run check:typecheck` clean.
  This step alone satisfies **AC#3** (artifact produced, gate passes, line stops on fail).
- **Testing:** unit + real-fs fixture (the `materialize.test.ts` pattern). Temp dir torn down.
- **Atomic:** yes.

## Step 3 — The render/parse bridge (`note-bridge.ts`) + its test (AC#1)

- Create **`src/baml/note-bridge.ts`**: `NoteBridgeOp`/`NoteBridgeResult`, `runOp` (render via
  `b.request.CaptureNote` + the shared `extractPromptText`; parse via `b.parse.CaptureNote`),
  and the `import.meta.main` stdin/stdout entry. Mirrors `decompose-bridge.ts`.
- Create **`src/baml/note.test.ts`**: spawn the bridge once, batch a canned-reply parse, a
  malformed-reply parse (→ empty note), and a render op; assert the typed `Note` round-trip,
  the SAP degradation, and the prompt sentinels.
- **Verify:** `bun test src/baml/note.test.ts` green; typecheck clean. Satisfies **AC#1**'s
  "its own BAML function (render + SAP parse)".
- **Testing:** subprocess-bridge integration (BAML runs only in the child).
- **Atomic:** yes — depends on Step 1's generated client.

## Step 4 — The play + registration + cast entry (`note.ts`)

- Create **`src/play/note.ts`**: `PLAY`, `captureNotePlay` (the six members), the
  `registry.register(...)` side effect, `CaptureNoteOptions`, `assembleNoteInputs`,
  `castCaptureNote`, and the `RunSummary` re-export. Value-imports `b` — **no test imports
  this module**.
- **Verify:** `bun run check:typecheck` clean (the play typechecks as `Play<NoteInputs,
  Note>`); `bun run check:test` still green (the new module is off every test path, so the
  suite count rises only by Steps 2–3's tests).
- **Testing:** none direct (impure shell; its logic is note-core + the engine's tested core).
- **Atomic:** yes.

## Step 5 — Registration smoke (the ≥2-plays keystone)

- Run a `bun -e` one-liner that imports **both** `./src/play/decompose-epic.ts` and
  `./src/play/note.ts`, then prints `registry.names()` and the `get("capture-note")` card +
  budget. (A `bun -e` child has no per-process addon limit and makes no native call —
  registration is just object insertion.)
- **Verify (expected):** `registry.names()` ⇒ `["decompose-epic","capture-note"]`;
  `get("capture-note").found === true` with `card={color:["red"],type:"sorcery",
  rarity:"common"}`, `budget={timeMs:600000,tokens:8000}`; `get("decompose-epic").found ===
  true` still. This is the documented proof of **≥2 plays through one engine** (AC#2's
  registry half).
- **Atomic:** verification only — no file change.

## Step 6 — Full green + progress

- Run `bun run check:typecheck` and `bun run check:test` over the whole suite.
- **Verify:** typecheck clean; all prior 252 tests + the new note-core/note tests green; zero
  flakiness across a couple of runs (the addon-leak guard, R1).
- Write `progress.md` (what landed, the smoke output, any deviations).

## Testing strategy summary

| AC | Proof | Step |
|----|-------|------|
| #1 second play authored + registered (BAML render+parse, gate, real effect) | bridge test + core test + smoke | 1,2,3,5 |
| #2 both cast through one `castPlay`, each appends a run-log record, zero loop branches | structural (`castPlay` untouched + `castCaptureNote` calls it) + smoke | 4,5 |
| #3 test demonstrates artifact + gate pass + gate-fail stops the line | `note-core.test.ts` (`captureNoteEffect` + `clearNote` + `classify`) | 2 |
| #4 `check:test` / `check:typecheck` green | full-suite run | 6 |

## Risk guards (from Structure R1–R4)

- **R1 (addon leak):** no test imports `note.ts`/`b`; tests use note-core or spawn the bridge.
  Verified by the suite staying deterministic in Step 6.
- **R2 (baml:gen drift):** Step 1 regenerates before any consumer typechecks; `check` runs
  `baml:gen` first.
- **R3 (live-board write):** every effect test uses a `mkdtemp` `projectRoot`.
- **R4 (SAP empty degradation):** the bridge test pins the empty-note case; the gate STOPs on
  it.

## Commit shape

A single logical commit (additive feature): `baml_src/note.baml`, the two `src/play/note-*`
files, the two `src/baml/note*` files. `baml_client/**` stays gitignored (regenerated).
Deviations, if any, recorded in `progress.md` before proceeding.
