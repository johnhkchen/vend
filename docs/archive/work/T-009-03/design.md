# T-009-03 — Design: register-and-cast-propose-epic

Decisions, with rationale, grounded in the Research map. The shape is fixed by the mandate
"mirror `note.ts`"; the open questions are (a) where the impure effect lives, (b) the effect's
id policy (trust the model's id vs. re-mint), (c) how the offline cast is proven.

## D1 — Where the effect lives: a NEW addon-free module `src/play/propose-effect.ts`

**Options.**
- (a) Put `proposeEpicEffect` in the `b`-importing shell `propose-epic.ts`. Rejected: the shell
  loads the BAML addon, so no bun-test could value-import the effect — it would be untestable
  offline, and the AC#3 demonstration (a fixture cast writing a real card) would have nowhere to
  live.
- (b) Add the effect to the existing `propose-core.ts` (the `note-core.ts` precedent — note put
  `captureNoteEffect` in its core). Tempting (one fewer file, exact note mirror). Rejected:
  `propose-core.ts` was authored and reviewed (T-009-02) with a LOUD pure contract ("PURE: no fs,
  clock, network, process"). Adding a world-touching `mkdir`+`writeFile`+`readdir` verb forces a
  header rewrite and re-opens a committed, clean module. The T-009 split deliberately put the
  pure judgment in 02 and the world-touching shell in 03; the effect is world-touching.
- (c) **A new addon-free module `propose-effect.ts`** that imports the pure `renderCard`/
  `nextEpicId` (propose-core), `detectCollisions` (id-guard), `listIdsIn` (project-context), and
  node `fs`. **Chosen.** It keeps `propose-core.ts` pristinely pure (no churn to a reviewed
  file), isolates the one impure verb, and is fully testable offline against a temp projectRoot —
  the `note-core.ts` testability property without violating 02's purity claim. The cost (one
  extra file) is small and the separation of "judgment" from "world-touch" is the house grain.

This module also owns the play's input type `ProposeEpicInputs` and `EPIC_DIR`, since both are
shared by the effect and the shell.

## D2 — The effect's id policy: re-mint authoritatively via `nextEpicId`, guard at write time

The gate already verifies `card.id` is well-formed `E-0XX` and disjoint (structural gate). So
why mint again? Because the `ProposeEpic` BAML signature is `(signal, charter, project)` — the
model is given NO way to learn the next free slot, so it guesses an id blind.

**Options.**
- (a) **Trust the model's gate-passed `card.id`; write `${card.id}.md`.** Coherent with the
  gate, but a model that guesses `E-007` (taken) gets a `structural` STOP on an otherwise-fine
  proposal — a brittle gesture, and it leaves `nextEpicId` (exported by 02 expressly for the
  effect) unused.
- (b) **Re-mint via `nextEpicId(liveBoard)` at write time; write `renderCard({…card, id:
  minted})`.** Chosen. The effect re-reads the LIVE epic dir, mints the authoritative next id,
  renders the card under it, and writes. This (i) uses `nextEpicId` for its stated purpose,
  (ii) is TOCTOU-safe — a board change between gate and effect (or two concurrent casts) cannot
  clobber, and (iii) makes the gesture robust: a sound proposal always lands, regardless of the
  model's id guess.

The structural gate's `card.id` check is NOT thereby pointless: it stays a quality pre-flight on
the model's output (a proposer that can't emit a coherent, board-aware, disjoint id is producing
careless work — a PE-quality signal worth stopping on), while the effect is the authoritative
assignment. This is exactly `materialize`'s philosophy — gates judge the plan's ids; the effect
does a final cross-board check before writing.

**Guard.** After minting, run `detectCollisions([minted], liveBoard)`. By construction it is
empty; if it is ever non-empty (a logic error or an exotic ragged-id board) the effect returns
`{ ok:false, outcome:"id-collision", detail }` — the `decomposeEffect` relabel precedent — never
clobbering. A genuine fs failure throws (not a clean outcome), mirroring `captureNoteEffect`.

## D3 — `ProposeEpicInputs` carries `existingEpicIds` (a snapshot) for the pure gate

`castPlay` derives both the gate context and the effect context from the play's typed `inputs`.
The gate is PURE and cannot read the board, so the snapshot of epic ids must be IN the inputs:

```
ProposeEpicInputs = { signal: string; charter: string; project: string;
                      existingEpicIds: readonly string[] }
```

`render` uses `signal`/`charter`/`project`; `gates` reads `charter` + `existingEpicIds` (→
`clear(card, { charter, existingEpicIds })`); the `effect` re-reads the LIVE board (D2) rather
than trusting the snapshot, so gate (pre-flight, snapshot) and effect (authoritative, live) are
deliberately layered — the TOCTOU design, not an inconsistency.

## D4 — `parse` must be total: catch `b.parse.ProposeEpic`'s throw → an empty card

`EpicCard` has required scalars, so `b.parse.ProposeEpic` THROWS on garbage (pinned in
propose.test.ts). `castPlay` calls `play.parse` with no error channel. So the shell wraps it
(the `parseNote` precedent): `try { return b.parse.ProposeEpic(text) } catch { return EMPTY_CARD }`.
`EMPTY_CARD` has blank strings + empty arrays; the value gate fires first (`serves` blank →
STOP), so a garbage reply becomes a clean `gate-failed` andon instead of crashing the cast.
(This re-confirms the engine-level sharp edge T-007-04's review flagged; out of scope to lift
into the engine here, but noted in review.)

## D5 — The play's `Card`: mono-Blue permanent, `rare`

The ticket fixes "Blue Permanent". Mono-`blue` (planning/knowledge — proposing is pure planning
judgment) `permanent` (a reusable, recast-forever play, unlike note's single-use sorcery).
Rarity is unspecified; `rare` — a strong reusable planning play, one tier below DecomposeEpic's
`mythic` keystone and above note's `common`. Documented as a judgment call.

`budget` is inlined (not imported from the shelf — that edge would cycle, per `note.ts`). A
proposal is a single bounded judgment: `30m / 16k` — heavier than note's one-shot capture
(10m/8k), lighter than DecomposeEpic's keystone decomposition (2h/50k). A fallback only; the
caller passes an explicit budget.

## D6 — `castProposeEpic` enforces pull-discipline (PE-1) by signature

`castProposeEpic({ signal, budget, projectRoot?, model?, runId?, transcriptDir? })` takes ONE
explicitly pulled `signal` string. It does not read or iterate `demand.md` — there is no loop,
no board drain. The deliberate, single-signal gesture IS the pull-discipline; a comment names
PE-1 at the function. `subject: opts.signal` stamps the run-log record (the at-cast-time label;
the minted id is not known until the effect runs).

## D7 — Proving the cast offline (AC#3), no live model run

`castPlay` spawns `claude` via `dispense` with no executor-injection seam, so a full end-to-end
cast cannot run in `bun test`. Mirroring how capture-note met the same AC, the offline proof is
three-legged:
1. **`propose-effect.test.ts`** — the AC#3 demonstration: a cleared `EpicCard` + a temp
   projectRoot seeded with `E-001…E-009` → the effect writes a valid `docs/active/epic/E-010.md`
   that round-trips the card, reports the artifact, and mints disjoint; plus `classify` wiring
   (clear → `success`+materialize; a `value`/`bounds`/`structural` STOP → `gate-failed`+no-write).
2. **A `bun -e` registration smoke** — value-import the three shells, assert `registry.names()`
   ⊇ `{decompose-epic, capture-note, propose-epic}`: **three plays on one engine**.
3. **The upstream bridge test** (T-009-01) already pins render/parse offline.

A live model cast is left for a real run (no API offline; it would mutate the board), exactly as
DecomposeEpic's and capture-note's live casts are left untested. Documented in review, not hidden.

## Rejected, briefly

- Generalizing `runPlay`/`dispatch.ts` for heterogeneous inputs so `vend run propose-epic`
  works — out of scope (note didn't either); `castProposeEpic` delivers the keystone.
- Adding existing-epic awareness to `buildProjectSnapshot` so the model sees prior epics —
  would edit a shared, tested module; out of scope. Flagged in review as a quality follow-up.
- Writing under `docs/active/epics/` (plural) — the board uses `docs/active/epic/` (singular);
  the effect targets the real dir.
</content>
