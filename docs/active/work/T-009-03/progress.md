# T-009-03 — Progress: register-and-cast-propose-epic

Implementation log. The plan was followed without deviation; one parse-time mechanical fixup
(a stray tag from file authoring) noted below. **Three plays now cast through one engine.**

## Step 1 — `src/play/propose-effect.ts` ✓
The addon-free, impure effect module. `EPIC_DIR = "docs/active/epic"`, `ProposeEpicInputs`,
`proposeEpicEffect`. The effect re-reads the LIVE board (`listIdsIn`), mints via `nextEpicId`,
guards with `detectCollisions` (relabels `id-collision`, never clobbers), renders
`renderCard({...card, id: minted})`, and writes `<root>/docs/active/epic/<minted>.md`. No BAML
import — only the pure `renderCard`/`nextEpicId` + `detectCollisions` + `listIdsIn`. `tsc` clean.

## Step 2 — `src/play/propose-effect.test.ts` ✓
Six offline pins (no addon, temp-dir projectRoot):
- effect on a seeded `E-001…E-009` board → writes the **minted** `E-010.md` (ignores
  `card.id` `E-999` — proves the re-mint, D2), round-trips title/serves/intent/value + trailer.
- empty board → mints `E-001`, creates the dir.
- ragged board `[E-001, E-009, E-099]` → mints `E-100` (disjoint; agrees with `nextEpicId`).
- `clear → classify` wiring: a cleared card → `success` + `materialize` + three passed gate
  rows; a `bounds` STOP (advances `N4`) → `gate-failed` + no materialize; a `structural` STOP
  (id collides) → `gate-failed` + no materialize.

## Step 3 — `src/play/propose-epic.ts` ✓
The impure shell, mirroring `note.ts`: `parseProposeEpic` (catches `b.parse` throw →
`EMPTY_CARD`), `proposeEpicPlay` (six members; mono-blue permanent rare; inlined 30m/16k
budget), `registry.register(...)`, `ProposeEpicOptions`, `assembleProposeEpicInputs` (reads the
real charter, lists stories/tickets/epics, builds the light snapshot), `castProposeEpic` (ONE
pulled signal → `castPlay`, PE-1 — no board drain). `tsc` clean.

## Step 4 — full check + the three-plays smoke ✓
- `bun run check` (baml:gen → tsc → bun test): **309 pass / 0 fail** (was 303; +6 propose-effect
  pins), tsc clean, deterministic.
- Registration smoke:
  ```
  $ bun -e 'import "./src/play/decompose-epic.ts"; import "./src/play/note.ts";
            import "./src/play/propose-epic.ts"; import {registry} from "./src/engine/play.ts";
            console.log(registry.names())'
  registered plays: [ "decompose-epic", "capture-note", "propose-epic" ]
  three plays through one engine: true
  ```

## Deviations
- **Authoring fixup (not a design change):** the three new source files were initially written
  with a stray trailing `</content>` line that `tsc` flagged as `TS1110: Type expected`; stripped
  it, re-ran — green. No logic affected.
- No other deviation. `castPlay`, `propose-core.ts`, `note.ts`, the engine, and dispatch are
  untouched — the change is purely additive (the T-007-04 property).

## What remains
- Review artifact (next).
- A live model cast is intentionally NOT run offline (no API; would write a real `E-010.md`),
  exactly as DecomposeEpic's / capture-note's live casts are left untested — documented in review.

## Staging note (D-005 discipline)
Committed: the three source files + the six work artifacts. Explicitly NOT staged: `baml_client/`
(gitignored build artifact) and the pre-existing dirty Lisa ticket files (`T-009-0{1,2,3}.md` —
phase management, the workflow contract leaves them to Lisa). No real `E-0XX.md` written (tests
use temp roots).
</content>
