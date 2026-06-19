# T-009-03 — Plan: register-and-cast-propose-epic

Ordered, independently-verifiable steps. Testing strategy: the impure effect is proven offline
against a temp projectRoot (the `note-core.test.ts` model); the shell is untested by house rule
(loads the addon); the keystone is a `bun -e` registration smoke. AC mapping at the end.

## Step 1 — `src/play/propose-effect.ts` (the impure effect + shared types)

Create the addon-free effect module per Structure:
- `EPIC_DIR`, `ProposeEpicInputs`, `proposeEpicEffect`.
- Effect: read live board (`listIdsIn`) → `nextEpicId` mint → `detectCollisions` guard
  (relabel `id-collision`, never clobber) → `renderCard({…card, id: minted})` → `mkdir`+
  `writeFile` → `EffectResult` with the artifact path. fs throw propagates.
- Header doc-comment: addon-free, impure (one fs verb), the `note-core.ts` testability
  property; why the effect re-mints (D2) and why id-collision is data not a throw.

**Verify:** `tsc --noEmit` clean (types resolve; `CastContext<ProposeEpicInputs>` shape fits
`Play.effect`).

## Step 2 — `src/play/propose-effect.test.ts` (the AC#3 offline demonstration)

Create the offline test per Structure: effect writes the minted `E-010.md` (round-trips the
card, MINTED id even when the fixture id differs), mints `E-001` on an empty board, and the
`classify` wiring (clear→materialize+3 passed rows; each gate STOP→gate-failed+no-write). All
against a temp projectRoot; type-only BAML imports with string-literal enum members.

**Verify:** `bun test src/play/propose-effect.test.ts` green; no addon loads (no flakiness);
re-run twice to confirm determinism. No real board write (temp roots only).

## Step 3 — `src/play/propose-epic.ts` (the impure shell, mirrors `note.ts`)

Create the shell per Structure: `parseProposeEpic` (catch→`EMPTY_CARD`), `proposeEpicPlay`
(six members, mono-blue permanent rare, inlined budget), `registry.register(...)`,
`ProposeEpicOptions`, `assembleProposeEpicInputs` (impure: read charter, list stories/tickets/
epics, build snapshot), `castProposeEpic` (PE-1 single pulled signal → `castPlay`). Header
doc-comment: third play, dependency-up, no-test-value-imports rule, PE-1 pull-discipline.

**Verify:** `tsc --noEmit` clean — `proposeEpicPlay` satisfies `Play<ProposeEpicInputs, EpicCard>`;
`gates`/`effect` ctx types line up; `castProposeEpic` returns `RunSummary`.

## Step 4 — Full check + the three-plays registration smoke

- `bun run check` (baml:gen → tsc → bun test): whole suite green, +the propose-effect pins, no
  regressions.
- `bun -e` smoke: value-import `./src/play/decompose-epic.ts`, `./src/play/note.ts`,
  `./src/play/propose-epic.ts`; assert `registry.names()` ⊇ `{decompose-epic, capture-note,
  propose-epic}` and `registry.has("propose-epic")`. This is the **three-plays-through-one-engine**
  proof (AC#3's keystone half). Capture the output in `progress.md`.

**Verify:** smoke prints the three names; check is green and deterministic across two runs.

## Step 5 — Commit (Implement-phase artifact)

Stage ONLY the three source files + this ticket's work artifacts. Explicitly DO NOT stage:
- `baml_client/` (gitignored build artifact),
- the pre-existing dirty Lisa ticket files (`T-009-01.md`, `T-009-02.md`, `T-009-03.md` — phase
  management; the workflow contract leaves them to Lisa),
- any real `docs/active/epic/E-0XX.md` (none is written — tests use temp roots).
Commit message records the third play + the keystone. (`check:committed` is the on-stop gate;
committing here keeps HEAD green — the D-005 discipline.)

## Testing strategy summary

| Surface | How proven | Where |
|---|---|---|
| `proposeEpicEffect` (mint+write+guard) | real temp-dir fixture | propose-effect.test.ts |
| `clear` → `classify` cast wiring | pure, offline | propose-effect.test.ts |
| `renderCard`/`nextEpicId`/gates | already pinned (T-009-02) | propose-core.test.ts |
| render/parse (`b.request`/`b.parse`) | already pinned (T-009-01) | propose.test.ts (bridge) |
| three plays on one registry | `bun -e` smoke | progress.md |
| live end-to-end cast | left to a real run (no API offline) | documented in review |

## AC → step mapping

- **AC#1** (registered; `castProposeEpic` assembles + casts via `castPlay`, zero per-play engine
  branches) → Steps 3, 4. `castPlay` is untouched; the shell only registers + calls it.
- **AC#2** (on pass writes the minted disjoint `E-0XX.md`; on STOP nothing written, andon names
  the reason) → Steps 1, 2 (effect mint+write; classify stop→no-write; gate STOP carries the
  reason via `GateVerdict`).
- **AC#3** (a fixture cast → valid epic card + run-log record; three plays through one engine) →
  Steps 2, 4 (effect writes a valid card; `castPlay` appends one run-log record per cast —
  structural, untouched; the smoke proves three plays).
- **AC#4** (`bun run check:*` green) → Step 4.

## Risks

- **`tsc` enum-member typing** in the test fixture — mitigated by string-literal casts (the
  propose-core.test.ts precedent: `"Permanent" as CardType`).
- **`Play.parse` throw** crashing a real cast — mitigated by `parseProposeEpic`'s catch (D4).
- **Accidental real-board write** — mitigated: tests use temp roots; no step writes a real
  `E-0XX.md`; staging is explicit (Step 5).
</content>
