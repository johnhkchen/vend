# T-007-04 — Structure: second-play-proves-agnostic

The blueprint — files created/modified, their public surfaces, boundaries, and the order
that keeps the tree red-free. Not code; the shape of the code. The change is **purely
additive**: five new files + one new BAML function. No edit to the engine, DecomposeEpic, or
any dispatch surface.

## File inventory

| File | Action | Loads BAML addon? | Tested |
|------|--------|-------------------|--------|
| `baml_src/note.baml` | **create** | (authoring source) | via bridge |
| `src/play/note-core.ts` | **create** | no (type-only) | yes (pure + real-fs) |
| `src/play/note-core.test.ts` | **create** | no | — (is the test) |
| `src/play/note.ts` | **create** | **yes** (value-imports `b`) | no (impure shell) |
| `src/baml/note-bridge.ts` | **create** | yes (child process only) | via its own test |
| `src/baml/note.test.ts` | **create** | no (spawns the bridge) | — (is the test) |
| `baml_client/**` | regenerated | — | — (gitignored build product) |

Nothing else changes. `castPlay`, `play.ts`, `decompose-epic.ts`, `cli.ts`, `dispatch.ts`,
`press.ts`, `run-log.ts` are untouched.

## `baml_src/note.baml` — the second BAML function

```
class Note {
  title   string   @description("a short, specific title for the note")
  summary string   @description("one or two sentences capturing the essence")
  points  string[] @description("3-6 concrete takeaways; never empty")
}

function CaptureNote(topic: string, project: string) -> Note {
  client ClaudeStub          // render-only, shared with DecomposeEpic
  prompt #" … {{ topic }} … {{ project }} … {{ ctx.output_format }} "#
}
```

- Reuses the existing `ClaudeStub` client (clients.baml) — render-only, never transport.
- After authoring, `bun run baml:gen` makes `b.request.CaptureNote` / `b.parse.CaptureNote`
  available and emits the `Note` type into `baml_client/`.
- The prompt frames the Red-sorcery role (fast capture, ground in go-and-see, no speculation).

## `src/play/note-core.ts` — PURE core (the tested module)

Addon-free: `import type { GateVerdict, CastContext, EffectResult }` from
`../engine/play.ts`; `import type { Note }` from `../../baml_client/index.ts`. Plus
`node:fs/promises` + `node:path` for the one impure-fs verb (like `materialize.ts`).

Public surface:
- `interface NoteInputs { readonly topic: string; readonly project: string; }` — the play's
  typed inputs (what `render` consumes).
- `const NOTES_DIR = "docs/active/notes"` — default artifact dir, relative to project root.
- `function slugify(title: string): string` — PURE. Lowercase, non-alphanumerics → `-`,
  collapse/trim dashes; falls back to `"note"` when a title slugs to empty. The artifact
  filename stem.
- `interface RenderedNote { readonly name: string; readonly body: string; }`
- `function renderNoteFile(note: Note): RenderedNote` — PURE. `{slug}.md` name; body =
  `# {title}` + blank + `{summary}` + blank + `## Points` + `- {point}` list + a trailer
  line naming the `capture-note` play. Mirrors `renderTicketFile`'s shape.
- `function clearNote(note: Note): GateVerdict` — PURE. The single `substance` gate:
  empty `title`/`summary`/`points` → STOP naming the unit; else `{status:"clear",
  cleared:["substance"]}`. Mirrors `clear` (gates.ts) in spirit.
- `async function captureNoteEffect(note: Note, ctx: CastContext<NoteInputs>):
  Promise<EffectResult>` — the impure-fs verb. Computes the path under
  `join(ctx.projectRoot, NOTES_DIR)`, `mkdir -p`, `writeFile`, returns `{ok:true,
  detail, artifacts:[path]}`. No BAML, no spawn → testable on a temp dir.

Boundary: this module knows nothing of `b`/the registry/`castPlay`. It is a leaf the shell
composes.

## `src/play/note.ts` — IMPURE shell (untested; self-registers)

Value-imports `b` from `baml_client/sync_client.ts` (loads the addon) — so **no `bun:test`
file imports this module**. Imports: `extractPromptText` (decompose-bridge.ts, the shared
pure reach-in), the engine `Play`/`Card`/`castPlay`/`registry`, `Budget` (type), the
note-core surface, and the exported `buildProjectSnapshot` + `listIdsIn` (project-context.ts)
for the thin assembler.

Public surface:
- `const PLAY = "capture-note"` — registry key / run-log `play` value.
- `const captureNotePlay: Play<NoteInputs, Note>`:
  - `render`: `extractPromptText(b.request.CaptureNote(i.topic, i.project) as …)`.
  - `parse`: `b.parse.CaptureNote(text)`.
  - `gates`: `(note) => clearNote(note)`.
  - `effect`: `captureNoteEffect`.
  - `budget`: `{timeMs: 600_000, tokens: 8_000}`.
  - `card`: `{color:["red"], type:"sorcery", rarity:"common"} satisfies Card`.
- `registry.register(captureNotePlay)` at module load.
- `interface CaptureNoteOptions { topic; budget; projectRoot?; model?; runId?;
  transcriptDir?; }` — the per-cast values.
- `async function assembleNoteInputs(opts): Promise<NoteInputs>` — IMPURE. Builds `project`
  from `buildProjectSnapshot({root, srcFiles:[], stories, tickets})` using `listIdsIn` on the
  stories/tickets dirs (a thin go-and-see snapshot; a note needs no src tree). Returns
  `{topic, project}`.
- `async function castCaptureNote(opts): Promise<RunSummary>` — assembles inputs and calls
  `castPlay(captureNotePlay, inputs, opts.budget, {subject: opts.topic, …})`. The parallel of
  `runDecomposeEpic` — the proof the sorcery casts through the **same** `castPlay`.
- Re-export `RunSummary` from the engine (type-only) for callers.

Boundary: depends UP onto the engine (imports `castPlay` + the contract); the engine never
imports back. Graph stays acyclic, mirroring decompose-epic.ts.

## `src/baml/note-bridge.ts` — render/parse subprocess bridge

Mirrors `decompose-bridge.ts`. Value-imports `b` (runs only in a child `bun`). Surface:
- `type NoteBridgeOp = {mode:"render"; topic; project} | {mode:"parse"; text}`.
- `type NoteBridgeResult = {ok:true; mode:"render"; prompt} | {ok:true; mode:"parse"; note} |
  {ok:false; error}`.
- `function runOp(op): NoteBridgeResult` — render via `b.request.CaptureNote` +
  `extractPromptText` (imported from decompose-bridge.ts — the reach-in is shared, not
  re-implemented); parse via `b.parse.CaptureNote`.
- `if (import.meta.main)` entry: read `{ops}` from stdin, write `{results}` to stdout.

## `src/baml/note.test.ts` — render/parse pins (spawns the bridge)

All BAML imports **type-only** (`Note` for the assertion cast). Spawns `note-bridge.ts` in a
child `bun` once, batching: a canned reply → typed `Note` (title/summary/points round-trip);
a malformed reply → empty note (the SAP-leniency pin); a render op → prompt contains the
`topic`/`project` sentinels and the capture framing.

## `src/play/note-core.test.ts` — the AC#3 demonstration (offline)

Imports note-core (pure + the fs verb) and the engine's `classify` (pure). No BAML. Uses a
real temp dir (`fs.mkdtemp`) for the effect, torn down after — the `materialize.test.ts`
precedent. Cases:
- `slugify` — title → stem; empty/punctuation title → `"note"` fallback.
- `renderNoteFile` — body contains the title heading, summary, and each point as a bullet.
- `clearNote` — a full note clears with `cleared:["substance"]`; an empty-title / empty-
  summary / empty-points note STOPs naming the right unit.
- `captureNoteEffect` — writes `<temp>/docs/active/notes/<slug>.md`; the file exists and
  contains the rendered body; returns `ok:true` + `artifacts:[path]`.
- **integration via `classify`** — a clear verdict → `materialize:true, outcome:"success"`;
  a stop verdict → `materialize:false, outcome:"gate-failed"` (the line stops on gate-fail).

## Ordering (keeps `tsc` / tests green at every step)

1. **`baml_src/note.baml`** → `bun run baml:gen` (emits `Note` + `b.*.CaptureNote`). Tree
   still green (nothing imports the new type yet).
2. **`src/play/note-core.ts`** + **`note-core.test.ts`** — pure core + its test. `tsc` clean,
   new tests green; no addon in the test process. (AC#3 demonstrable here.)
3. **`src/baml/note-bridge.ts`** + **`src/baml/note.test.ts`** — render/parse proof (AC#1).
4. **`src/play/note.ts`** — the play + registration + `castCaptureNote`. `tsc` clean. Not
   imported by any test, so no addon enters `bun test`.
5. **Registration smoke** (`bun -e` importing both plays) — `registry.names()` ⇒ two plays.
6. `bun run check:typecheck` + `bun run check:test` green end to end.

## Risks the Plan must guard

- **R1 — addon leak into `bun test`:** if any test imports `note.ts` (or `b`), the suite goes
  flaky. Guard: tests import note-core / spawn the bridge only; never note.ts.
- **R2 — baml:gen drift:** `Note` type must exist before note-core/note.ts typecheck. Guard:
  step 1 regenerates first; CI's `check` runs `baml:gen` ahead of typecheck.
- **R3 — effect writing to the live board in a test:** guard via `ctx.projectRoot` = a temp
  dir in every effect test; never the repo root.
- **R4 — SAP empty-note degradation mistaken for a pass:** the `substance` gate must STOP on
  an empty note (D2/D3); the bridge test pins the degradation so the gate's job is explicit.
