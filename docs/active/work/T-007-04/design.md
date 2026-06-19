# T-007-04 — Design: second-play-proves-agnostic

Decide the shape of the second play and how it proves the engine play-agnostic. Grounded in
Research: the engine (`castPlay`) is already generic; this slice *exercises* it with a
second `Play` that has its own BAML function, gate, and real effect. All decisions favor a
**minimal, additive** change (new files + one BAML function; no edit to the engine or
DecomposeEpic).

## D1 — What the second play IS: `capture-note`, a Red sorcery

**Decision:** Author `CaptureNote` — a fast one-shot that distills a *topic*, grounded in
the project's go-and-see snapshot, into a structured **Note** (title, summary, points), and
writes it as a real markdown artifact under `docs/active/notes/<slug>.md`.

- **Card:** `{color:["red"], type:"sorcery", rarity:"common"}`. Red = speed/impulse (a quick
  capture). Sorcery = single-use. A deliberate **contrast** to DecomposeEpic's Azorius
  permanent mythic — proving the engine spans the card axis, not two near-identical plays.
- **Budget (mana):** small/fast — `{timeMs: 600_000, tokens: 8_000}` (10 min, 8k). A
  one-shot capture warrants a fraction of DecomposeEpic's 2h/50k envelope.

**Why a note, not `ProposeEpic` or the survey:** the ticket explicitly defers `ProposeEpic`
and the E-006 survey-as-cast to *follow-up registrations onto the now-proven engine*. The
keystone is "≥2 plays through one engine," not "the next real play." A note is **minimal but
real** (the effect writes a genuine, useful markdown artifact — not a toy echo) and avoids
the larger semantics of those deferred plays.

**Rejected — reuse DecomposeEpic's WorkPlan/materialize:** that would prove nothing new; the
point is a *different* BAML function, *different* gate, *different* effect (card-model
"different colors"). A note's three-field shape is the smallest output that still needs a
real SAP parse and a real substance gate.

## D2 — The output shape: `Note { title, summary, points[] }`

**Decision:** a BAML class with two required strings and one array:

```
class Note {
  title   string   @description("a short, specific title for the note")
  summary string   @description("one or two sentences capturing the essence")
  points  string[] @description("3-6 concrete takeaways; never empty")
}
```

- Smallest shape that exercises a *real* gate (string presence + array non-emptiness) and a
  *real* render (the markdown file has a heading, a summary line, and a bullet list).
- **Inherits the SAP-leniency hazard** (decompose.baml's pin): a class with arrays/strings
  is never *rejected* by `b.parse` — a malformed reply degrades to empty strings / `[]`. The
  gate (D3) must therefore classify an empty note as a STOP, exactly as the value gate treats
  an empty WorkPlan. This is a *feature* for AC#3: a degraded note is the natural gate-fail
  fixture.

## D3 — The gate: one `substance` gate, returning `GateVerdict` directly

**Decision:** `clearNote(note): GateVerdict` — a single gate named `"substance"`:
- `title` non-empty (trimmed), else STOP `{gate:"substance", unit:"title", reason}`.
- `summary` non-empty, else STOP `unit:"summary"`.
- `points` is a non-empty array with ≥1 non-empty entry, else STOP `unit:"points"`.
- all pass → `{status:"clear", cleared:["substance"]}`.

**Why return the engine's `GateVerdict` directly** (not a play-local type structurally
assigned, the way gates.ts's `GateResult` is): a brand-new gate has no legacy type to
preserve, so it targets the contract type head-on — simpler, and the `cleared:["substance"]`
echo gives the run log one passed `substance` row (parity with DecomposeEpic's four rows).
Import is **type-only** (`import type { GateVerdict }`) → addon-free, so the gate lives in a
testable pure core.

**Rejected — multiple gates:** the ticket says *its own gate(s)* — one substance gate is
enough to demonstrate "passes its gate" and "stops the line when its gate fails." More gates
add code without adding proof.

## D4 — The effect: write a real markdown artifact (mirrors `materialize`)

**Decision:** `captureNoteEffect(note, ctx): Promise<EffectResult>`:
- compute `slug = slugify(note.title)`; path = `join(ctx.projectRoot, "docs/active/notes",
  slug + ".md")`.
- `renderNoteFile(note)` (PURE) → the markdown body (`# title`, summary, `- point` list, a
  trailer naming the `capture-note` play).
- `mkdir -p` the notes dir, `writeFile` the artifact.
- return `{ok:true, detail:"wrote <path>", artifacts:[path]}`.

**Structure mirrors `materialize.ts`:** pure `renderNoteFile` + pure `slugify` + the impure
write verb, all with a **type-only** `Note` import (addon-free) — so the effect is testable
against a real-fs temp dir, exactly like `materialize.test.ts`. The effect is *not* wrapped
in DecomposeEpic's collision/validate machinery — a note has no board ids and no lisa
validation; it just writes a file. (No `outcome` relabel needed → the loop logs the
`classify` outcome.)

**Rejected — write under `.vend/` or a temp-only dir:** `docs/active/notes/` is a real,
sensible home for a captured note and proves the effect "writes a real artifact" honestly.
Tests redirect via `ctx.projectRoot` (a temp dir), so the live board is never touched in
tests.

## D5 — Module layout: pure core + impure shell (house pattern)

**Decision:** two source modules, mirroring decompose-epic-core/decompose-epic:
- **`src/play/note-core.ts`** — PURE / addon-free (`import type { GateVerdict, CastContext,
  EffectResult }` from engine; `import type { Note }` from baml_client). Holds: `NoteInputs`,
  `slugify`, `renderNoteFile`, `clearNote`, and `captureNoteEffect` (the impure-fs verb, but
  no BAML — testable like `materialize`). This is the **fully-tested** module.
- **`src/play/note.ts`** — IMPURE shell that value-imports `b` (loads the addon). Holds the
  `captureNotePlay: Play<NoteInputs, Note>` (render via `b.request.CaptureNote`, parse via
  `b.parse.CaptureNote`, gates = `clearNote`, effect = `captureNoteEffect`, budget, card),
  `registry.register(captureNotePlay)`, and a thin `castCaptureNote(opts)` entry. **Untested**
  (its logic is the engine's tested core + note-core), exactly as decompose-epic.ts is.

**Why the effect lives in the core, not the shell:** putting `captureNoteEffect` in
note-core.ts (addon-free) makes it testable with a real-fs fixture — the strongest proof of
"produces its artifact" — and keeps note.ts a thin composition. This is the materialize.ts
precedent applied to the second play.

## D6 — Render/parse proof: a subprocess bridge (decompose pattern)

**Decision:** `src/baml/note-bridge.ts` + `src/baml/note.test.ts`, mirroring
decompose-bridge.ts: batch render+parse ops, spawn one child `bun`, assert on its JSON. Pins
AC#1's "render + SAP parse" for the *second* BAML function: render injects `topic`/`project`
into the prompt; a canned reply parses into a typed `Note`; a malformed reply degrades to an
empty note (the D2 hazard, which the gate then stops on).

**Why a dedicated bridge, not extending decompose-bridge:** lowest coupling, matches the
established one-bridge-per-function shape, and keeps each bridge's op types narrow. The cost
is two small files — worth it to genuinely prove the new function renders+parses.

**Rejected — skip the BAML test, rely on typecheck:** AC#1 explicitly requires the play have
"its own BAML function (render + SAP parse)"; proving it renders+parses is the same bar
DecomposeEpic held. Typecheck alone wouldn't catch a prompt that drops an input.

## D7 — Proving "≥2 plays through one engine" (the keystone)

**Decision:** three complementary proofs, none requiring a live model:
1. **Offline gate + effect test** (`note-core.test.ts`): `clearNote` clear/stop cases;
   `captureNoteEffect` writes the artifact to a temp dir; `classify` shows clear→materialize
   / stop→`gate-failed` no-materialize. This *is* AC#3 (artifact produced, gate passes, line
   stops on gate-fail) — offline, deterministic, addon-free.
2. **BAML render/parse bridge test** (`note.test.ts`): AC#1's render+parse.
3. **Registration smoke** (`bun -e`, documented in progress.md): import both plays → assert
   `registry.names()` is `["decompose-epic","capture-note"]` and `get("capture-note").found`,
   with its red/sorcery/common card and 10m/8k budget. This is the **≥2 plays through one
   registry/engine** keystone. It is a smoke (not a `bun:test`) because registration is an
   import side effect that loads the addon — and two plays would load it twice.

**Why not unit-test `castPlay` end-to-end with the note play:** `castPlay` value-imports
`dispense` (spawns `claude`) and the play's render calls BAML — neither is offline. The
welded runner set the precedent: the impure cast shell is *not* unit-tested; its logic is the
pure core. The note play casting "through the same `castPlay`" is **structural** — it
implements `Play` and `castCaptureNote` calls the same generic `castPlay` — identical to how
DecomposeEpic's live cast is proven (registration smoke + the pure core), not by a live run.

## D8 — Dispatch: a thin `castCaptureNote`, no epic-shaped-dispatch refactor

**Decision:** add `castCaptureNote(opts: CaptureNoteOptions)` in note.ts — assembles
`NoteInputs` (topic + a thin project snapshot reusing the *exported* `buildProjectSnapshot` +
`listIdsIn`) and calls `castPlay(captureNotePlay, inputs, budget, {subject: topic})`. **Do
not** touch `runPlay`/`cli.ts`/`press.ts` (their `RunOptions` are epic-shaped).

**Why defer generalizing by-name dispatch:** `runPlay`'s `RunOptions.epicPath` is
DecomposeEpic-shaped; making `vend run capture-note` work means generalizing input assembly
over *heterogeneous* shapes — a real refactor the ticket does not ask for. The keystone is
two plays through one `castPlay`; `castCaptureNote` (the parallel of `runDecomposeEpic`)
delivers exactly that. Generalizing dispatch is a clean, named follow-up (flagged in Review).

## Decisions summary

| # | Decision | Why |
|---|----------|-----|
| D1 | `capture-note`, Red sorcery, 10m/8k | minimal-but-real; contrasts the Blue/White permanent |
| D2 | `Note{title,summary,points[]}` | smallest shape needing a real parse + gate; SAP hazard → gate-fail fixture |
| D3 | one `substance` gate → `GateVerdict` | new gate targets the contract directly; `cleared` echo = run-log parity |
| D4 | effect writes `docs/active/notes/<slug>.md` | real artifact; mirrors `materialize`, testable on temp fs |
| D5 | `note-core.ts` (pure+fs verb) / `note.ts` (BAML shell) | house pure/impure split; effect testable |
| D6 | `note-bridge.ts` + `note.test.ts` | prove render + SAP parse (AC#1) |
| D7 | offline core test + bridge test + `bun -e` smoke | AC#3 + AC#1 + the ≥2-plays keystone, no live model |
| D8 | thin `castCaptureNote`, no dispatch refactor | keystone met without epic-shaped-dispatch scope creep |
