# T-009-03 — Review: register-and-cast-propose-epic

Self-assessment and handoff. Commit `e6592b2`. The third play — `propose-epic`, a Blue
permanent — is authored, registered, and casts through the **same** generic `castPlay` as
`decompose-epic` and `capture-note`. **Three plays now cast through one engine** — the casting
engine (E-007) is proven play-agnostic across three contrasting colors/types/rarities. The
change is **purely additive**: 3 new source files + 6 work artifacts; no edit to the engine,
`propose-core.ts`, `note.ts`, dispatch, or the CLI.

## What changed

Three files **created**, nothing modified or deleted:

| File | Lines | What |
|---|---|---|
| `src/play/propose-effect.ts` | 87 | The addon-free, impure effect: mint + guard + render + write. Plus `EPIC_DIR`, `ProposeEpicInputs`. |
| `src/play/propose-epic.ts` | 167 | The impure shell: `proposeEpicPlay` (six members), `registry.register`, `parseProposeEpic`, `assembleProposeEpicInputs`, `castProposeEpic`. |
| `src/play/propose-effect.test.ts` | 149 | 6 offline pins (temp-dir board) — effect + classify wiring. |

Plus the six RDSPI work artifacts under `docs/active/work/T-009-03/`.

**No live-board mutation.** `baml_client/` (gitignored) was regenerated but not staged. The
pre-existing dirty Lisa ticket files (`T-009-0{1,2,3}.md` — phase management) were left untouched
and uncommitted, per the workflow contract. No real `E-0XX.md` was written (tests use temp roots).

## Public surface delivered

- `proposeEpicPlay: Play<ProposeEpicInputs, EpicCard>` — registered on the shelf-wide `registry`
  at module load. Mono-blue permanent, rare; inlined 30m/16k fallback budget.
- `castProposeEpic(opts): Promise<RunSummary>` — assembles inputs for ONE pulled signal and casts
  via `castPlay`. The parallel of `runDecomposeEpic` / `castCaptureNote`.
- `assembleProposeEpicInputs(opts)` — the impure input verb (charter + snapshot + live epic ids).
- `proposeEpicEffect(card, ctx)`, `EPIC_DIR`, `ProposeEpicInputs` (propose-effect.ts).
- `parseProposeEpic(text)`, `ProposeEpicOptions`, `PLAY`, `RunSummary` re-export (propose-epic.ts).

## Acceptance criteria — all met

- **AC#1** — `proposeEpicPlay` is registered (smoke confirms it on the registry);
  `castProposeEpic` assembles inputs and casts via the unchanged generic `castPlay` — **zero
  per-play engine branches** (the engine, `cast.ts`, and `play.ts` are byte-for-byte untouched). ✓
- **AC#2** — on pass, `proposeEpicEffect` writes the **minted** `E-0XX.md` under the project root
  (id minted disjoint via `nextEpicId` against the live board; PE gates passed upstream by
  `castPlay`'s `classify`); on a gate STOP, `classify` returns `materialize:false` so the effect
  never runs (nothing written) and the `GateVerdict.reason` names the offense (surfaced on stdout
  by `castPlay`'s `stopReason`). Both pinned. ✓
- **AC#3** — the offline fixture cast (propose-effect.test.ts) produces a valid epic card written
  to a real temp board; a real cast appends exactly one run-log record (structural in `castPlay`,
  `play: "propose-epic"`); the registration smoke shows **three plays through one engine**. ✓
- **AC#4** — `bun run check:*` green: `baml:gen` clean, `tsc --noEmit` clean, **309 pass / 0 fail**
  (was 303; +6), deterministic across repeated runs. ✓

## Test coverage

6 new tests / full suite **309 pass / 0 fail**.

| Area | Pins | Kind |
|---|---|---|
| effect mint + write | seeded `E-001…E-009` board → minted `E-010.md`, round-trips card, ignores `card.id` (re-mint) | real temp-dir |
| effect on empty board | mints `E-001`, creates the dir | real temp-dir |
| mint disjointness | ragged `[E-001,E-009,E-099]` → `E-100`, agrees with `nextEpicId` | real temp-dir |
| classify wiring | clear → success + materialize + 3 passed gate rows | pure (engine wiring) |
| classify wiring | bounds STOP (`N4`) → gate-failed + no materialize | pure |
| classify wiring | structural STOP (id collides) → gate-failed + no materialize | pure |

The pure judgment (gates, `renderCard`, `nextEpicId`) is already fully pinned in
`propose-core.test.ts` (T-009-02, 18 tests); render/parse via `b` are pinned offline in
`propose.test.ts` (T-009-01, the bridge). This ticket adds the effect + the cast wiring.

**Gaps (by design, consistent with the house pattern):**
- **No live end-to-end model cast.** `castPlay` value-imports `dispense` (spawns `claude`) and
  `render`/`parse` call BAML; neither is offline, and a live cast would write a real
  `docs/active/epic/E-010.md`. Its logic is the engine's tested pure core + the three pinned
  halves above. Identical to how DecomposeEpic's and capture-note's live casts are left untested.
- **The shell (`propose-epic.ts`) is untested** — house rule: it loads the BAML addon, so no
  bun-test value-imports it. `assembleProposeEpicInputs` / `castProposeEpic` / the
  `parseProposeEpic` catch-arm are impure verbs whose logic is propose-core + propose-effect +
  the engine core + the bridge-pinned `b.parse` behavior.

## Design decisions a reviewer should know

1. **The effect RE-MINTS the id (D2).** It ignores the model's gate-passed `card.id` and writes
   under `nextEpicId(liveBoard)`. Rationale: the `ProposeEpic` BAML signature gives the model no
   way to know the next free slot, so trusting its guess would STOP sound proposals; re-minting
   makes a sound proposal always land and is TOCTOU-safe (the `materialize` precedent). The
   structural gate's `card.id` check remains a quality pre-flight on the model's output. **If a
   reviewer wants the written id to equal the model's id, this is the line to change** —
   `renderCard({...card, id: minted})` → `renderCard(card)` + a live disjointness guard on
   `card.id`. Flagged as the main judgment call.
2. **The effect lives in a NEW module, not in `propose-core.ts` (D1).** Note put its effect in
   `note-core.ts`; here `propose-core.ts` carries a loud pure contract (T-009-02, committed/
   reviewed), so the world-touching verb went to `propose-effect.ts` to keep the pure core
   untouched while staying offline-testable. One extra file; cleaner separation.
3. **`parse` is made total (D4).** `b.parse.ProposeEpic` throws on garbage (EpicCard has required
   scalars); `castPlay` has no error channel, so `parseProposeEpic` catches → `EMPTY_CARD` → a
   clean `value`-gate STOP. Re-confirms the engine-level sharp edge T-007-04 flagged (see below).
4. **PE-1 pull-discipline by signature (D6).** `castProposeEpic` takes ONE `signal` and never
   reads/iterates `demand.md` — the deliberate single-signal gesture IS the pull-discipline.
5. **Light snapshot, mono-blue rare (D5).** `srcFiles: []` mirrors `assembleNoteInputs`; `card`
   honors the ticket's "Blue Permanent" with `rare` chosen between note's common and decompose's
   mythic.

## Open concerns / flags for human attention

1. **`Play.parse` can throw — an engine-level sharp edge, still patched per-play (MEDIUM).**
   Same finding as T-007-04's review #1: `castPlay` calls `play.parse` with no error channel, so
   each play with required scalars (Note, EpicCard) must self-harden its parse. Two plays now do.
   **Recommend** lifting this into the engine: have `castPlay` wrap `play.parse` and classify a
   throw as `gate-failed`/malformed, so every future play gets it for free. Out of scope here.
2. **The model never sees existing EPICS in the snapshot (LOW).** `buildProjectSnapshot` lists
   stories + tickets, not epics, so the proposer can't see prior epics to avoid duplicating an
   intent. The structural gate + the effect's re-mint prevent an *id* clash, but not a *semantic*
   duplicate. A clean follow-up: extend `buildProjectSnapshot` (a shared, tested module) to carry
   epics, or feed `existingEpicIds` into the prompt. Flagged, not fixed (avoids editing a shared
   module out of scope).
3. **`status: open` in the rendered card (LOW, inherited from T-009-02).** A freshly proposed card
   renders `status: open`. If lisa expects another status for a board-resident epic, it is a
   one-line change in `renderCard`. Carried forward from the T-009-02 flag.
4. **A real cast creates `docs/active/epic/E-0XX.md` on the live board (LOW).** Intended (a real
   artifact). Tests redirect via a temp `projectRoot`, so no test writes the live board.

## Bottom line

The casting engine is proven genuinely play-agnostic across **three** plays of contrasting
identity — Azorius permanent mythic (decompose), Mono-Red sorcery common (capture-note), Mono-Blue
permanent rare (propose-epic) — each with its own BAML function, gates, effect, budget, and card,
all through one unchanged `castPlay`. The signal → epic step of the pipeline is live and gated.
The one real surprise (parse can throw) is contained by a documented, tested per-play guard with a
standing recommendation to lift it into the engine contract. No blocking issues.
</content>
