# T-007-04 — Review: second-play-proves-agnostic

The handoff document. A second play — `capture-note`, a Red sorcery — is authored, registered,
and casts through the **same** generic `castPlay` as `decompose-epic`. E-007's keystone
done-signal (**≥2 plays through one engine**) is met. The change is **purely additive**: 6 new
files + 1 BAML function; no edit to the engine, DecomposeEpic, or any dispatch surface. `bun run
check` green — `tsc` clean, **266 pass / 0 fail** (was 252), deterministic across repeated runs.

## What changed

### New files (all created, none modified)
- **`baml_src/note.baml`** — `class Note { title, summary, points[] }` + `function
  CaptureNote(topic, project) -> Note` on the shared render-only `ClaudeStub`. The second
  authored BAML function. (`bun run baml:gen` emits `Note` + `b.{request,parse}.CaptureNote`
  into the gitignored `baml_client/`.)
- **`src/play/note-core.ts`** (~120 lines) — the PURE core (addon-free; all BAML/engine imports
  TYPE-ONLY). `NoteInputs`, `NOTES_DIR`, `NOTE_GATE`, `slugify`, `renderNoteFile`, `clearNote`
  (the `substance` gate → engine `GateVerdict`), `captureNoteEffect` (the impure-fs verb that
  writes the artifact). The fully-tested module.
- **`src/play/note-core.test.ts`** (10 tests) — slugify, render, gate (clear + 3 stop units),
  effect (real temp-dir write), and `classify` wiring. **This is the AC#3 demonstration.**
- **`src/play/note.ts`** (~130 lines) — the IMPURE shell: `captureNotePlay: Play<NoteInputs,
  Note>` (the six members), `registry.register(...)`, the hardened `parseNote`,
  `assembleNoteInputs`, `castCaptureNote`. Value-imports `b`; **no test imports it**.
- **`src/baml/note-bridge.ts`** + **`src/baml/note.test.ts`** (4 tests) — the render/parse
  subprocess bridge proving AC#1, mirroring `decompose-bridge.ts`.

### Not changed (deliberately)
`src/engine/*` (castPlay/play/cast-core), `src/play/decompose-epic.ts`, `src/cli.ts`,
`src/play/dispatch.ts`, `src/shelf/press.ts`, `src/log/run-log.ts`. The engine was already
play-agnostic; this slice exercises it, it does not modify it.

## Acceptance criteria — status

1. **A second play authored + registered — own BAML function (render + SAP parse), own gate(s),
   a real effect** ✓ — `CaptureNote` (BAML) renders + SAP-parses (pinned in note.test.ts via the
   bridge); `clearNote` is the `substance` gate; `captureNoteEffect` writes a real
   `docs/active/notes/<slug>.md` markdown artifact (pinned in note-core.test.ts). Registered on
   the shelf-wide `registry` at module load (smoke below).
2. **Both DecomposeEpic and the sorcery cast through the SAME `castPlay`, each appending its own
   countable run-log record — zero per-play branches** ✓ — `castPlay` is untouched and generic;
   `castCaptureNote` calls it exactly as `runDecomposeEpic` does. The run log's one-append-per-
   cast is structural (castPlay calls `appendRunLog` once with `play: "capture-note"`). The
   registration smoke confirms two plays on one registry.
3. **A test demonstrates the artifact under its budget + passing its gate (and stopping the line
   on gate-fail)** ✓ — note-core.test.ts: `captureNoteEffect` writes + reports the artifact;
   `clearNote(full)` clears; `clearNote(empty-*)` stops; `classify` shows clear→materialize and
   stop→`gate-failed` no-materialize (the andon).
4. **`check:test` / `check:typecheck` green** ✓ — `bun run check` clean, 266/266, deterministic.

## Test coverage

| Area | Test | Kind |
|------|------|------|
| gate pass + 3 stop units | note-core.test.ts | pure |
| effect writes real artifact | note-core.test.ts | real-fs temp dir |
| slugify / render body | note-core.test.ts | pure |
| classify: clear→materialize, stop→gate-failed | note-core.test.ts | pure (engine wiring) |
| render injects topic/project | note.test.ts | subprocess bridge |
| canned reply → typed Note | note.test.ts | subprocess bridge |
| garbage reply REJECTED; empty reply degrades | note.test.ts | subprocess bridge |
| ≥2 plays on one registry | `bun -e` smoke (progress.md) | smoke |

**Gaps (by design, consistent with the house pattern):**
- `castPlay` end-to-end with the note play is **not** unit-tested — it value-imports `dispense`
  (spawns `claude`) and render calls BAML; neither is offline. Its logic is the engine's tested
  pure core. Identical to how DecomposeEpic's live cast is left untested (registration smoke +
  pure core). No live model run was performed.
- `assembleNoteInputs` / `castCaptureNote` / the `parseNote` catch-arm are untested impure
  shells (their logic is note-core + the engine core + the bridge-pinned `b.parse` behavior).

## Open concerns / flags for the human reviewer

1. **`Play.parse` can throw — a contract gap the engine may want to absorb (MEDIUM).** Note's
   required scalar fields make `b.parse` *reject* (throw) a garbage reply, unlike WorkPlan's
   all-array degradation (both pinned in note.test.ts). `castPlay` calls `play.parse` with no
   error channel, so an uncaught throw would crash the cast. I hardened the note play's
   `parseNote` to catch → empty Note (→ clean `gate-failed`). **This is a per-play patch of an
   engine-level sharp edge.** Consider, as a follow-up: either document a "parse must be total"
   expectation on `Play.parse`, or have `castPlay` wrap `play.parse` and classify a parse throw
   as a malformed/`gate-failed` outcome — so every future play gets this for free. DecomposeEpic
   is unaffected (its parse never throws).

2. **By-name dispatch over heterogeneous inputs is deferred (LOW, expected).** `runPlay`/`cli.ts`/
   `press.ts` keep their epic-shaped `RunOptions`, so `vend run capture-note <topic>` is not yet
   wired — the note casts via `castCaptureNote`, the parallel of `runDecomposeEpic`. The keystone
   (≥2 plays through one `castPlay`) does not require it. The clean follow-up: generalize input
   assembly per play behind `runPlay` (the seam decompose-epic.ts's header already flagged).

3. **The effect writes under `docs/active/notes/` (LOW).** A real, sensible home and not a lisa
   stories/tickets dir, so the board DAG never sees it. Tests redirect via a temp `projectRoot`,
   so the live board is never written in tests. A real cast would create `docs/active/notes/` —
   intended (a real artifact), worth a human nod.

4. **`captureNoteEffect` overwrites an existing same-slug note (LOW).** Unlike `materialize`'s
   cross-board `IdCollisionError` guard, a note has no id namespace — re-capturing the same title
   silently overwrites. Acceptable for a single-use sorcery (idempotent re-capture), but flagged
   in case a future "don't clobber" guard is wanted.

## Bottom line

The engine is proven genuinely play-agnostic: two plays of contrasting color/type/rarity
(Azorius permanent mythic; Mono-Red sorcery common) cast through one unchanged `castPlay`, each
with its own BAML function, gate, effect, budget, and card. The one real surprise — Note's SAP
parse rejects where WorkPlan degrades — is contained by a documented, tested per-play parse
guard, with a clear recommendation to lift it into the engine contract.
