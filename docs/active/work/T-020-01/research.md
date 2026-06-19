# T-020-01 — Research: thin-input negative-control fixtures

> Descriptive map of the terrain the negative control sits on. What exists, where, how it connects.
> No solutions here — those are `design.md`.

## What the ticket asks

Add **deliberately-thin** survey-board and expand-fragment fixtures **plus probe targets**, so the
"**still abstains on truly empty**" polarity is *measurable*. This is the **negative control** the
E-020 honest-empty recalibration must satisfy: proof that the gate was **tightened, not disabled**.

The acceptance bar (AC#1): `run-consistency-probe.ts` run against the new thin fixtures records an
**honest-empty** outcome for **BOTH** survey and expand, **distinct** from the existing grounded
fixtures' outcome per play; `bun run check` stays green.

## Why this exists now (the E-020 context)

T-019-02's sweep (`docs/active/work/T-019-02/findings.md`) measured the honest-empty gate
**over-firing on grounded input**: survey abstained on 2/3 casts of a demand-rich board (67%) and
expand abstained on 1/3 of a real, evidenced fragment (33%) — false negatives. E-020 will
**recalibrate** the gate to fire *less* on grounded input. The danger of any "abstain less" tuning
is over-correction: a gate that no longer abstains *at all* is disabled, not tightened. The negative
control is the fixture where abstention is the **correct** answer — if, after recalibration, the
gate still abstains there, the tuning tightened rather than disabled it.

## The probe harness (the thing being extended)

`src/probe/run-consistency-probe.ts` — the impure, any-play consistency sweep. Shape:

```
bun run src/probe/run-consistency-probe.ts <play-name> [input.md] [N] [tokenBudget]
```

- A **`ProbeTarget`** per play (`play`, `seed`, `assemble`, `subject`, `outputDirs`, `isAbstention`).
  Targets today: `decompose-epic`, `survey`, `expand` (`expand-fragment`), `steer` (`SUPPORTED`).
- `seedTempRoot()` → `mkdtemp` + `lisa init`. Two invariants: **no ledger pollution** (run log into
  the temp root) and **no collision** (output dirs cleared before each cast).
- `seedCharter(root)` copies the **real** charter (`docs/knowledge/charter.md`) from `process.cwd()`
  into the temp root. `seedBoardSnapshot(root)` copies the **live** `docs/active/{stories,tickets}`
  from `process.cwd()` (absent dirs skipped).
- `classifyRun(summary, output, target)`: non-`success` → `budget-exhausted`; `success` →
  `target.isAbstention(output) ? "honest-empty" : "signal"`.
- `castN` clears `outputDirs`, assembles, casts via `castPlay`, collects materialized `*.md`,
  classifies, and keeps a raw `RunOutcome` tally.
- CLI arg parsing (`import.meta.main`): if `argv[3]` is numeric it is `N` (no input file) — so
  **input-less plays (survey, steer) take their first numeric positional as N**. `decompose-epic`
  and `expand` require an `input.md` (epic / fragment file) or `resolveTarget` returns `null`.

The pure core `src/probe/consistency.ts` only tallies + disperses an already-classified
`{outcome, output}[]`; classification is per-play in the harness (the impure/pure split). **No
change needed there** — the negative control reuses the same three buckets.

## How each play abstains (the polarity that the control probes)

Both gate cores checked: `src/play/survey-core.ts`, `src/play/expand-core.ts`. The honest-empty gate
is a **poka-yoke over the model's parsed reply**, not over the raw input — the fixture biases the
model toward an empty reply; the gate then classifies it.

- **expand-fragment** (`expand-core.ts:111` `honestEmptyGate`): a `Signal` with `what` AND `why`
  both blank ⇒ STOP (`gate-failed`). The model returns a blank signal when "the fragment closed no
  vision-distance." So a **vacuous fragment** drives the abstention. Probe consequence (design D4 in
  T-019-02): expand abstains by **STOPPING** ⇒ `gate-failed` ⇒ `classifyRun` folds it into
  `budget-exhausted`; the honest-empty is read off the **raw tally + the per-cast andon line**, not
  the headline mix. `isAbstention: emptyOutput` (nothing materializes).
- **survey** (`survey-core.ts:92` `honestEmptyGate`): the polarity **inverts**. An **EMPTY board**
  (`signals: []`) CLEARS honest-empty — it is the honest abstention — and the effect
  (`survey-effect.ts`) stages a legible marker note: `"# Survey — no demand staged"` /
  `"honest empty board"`. A *padded* board (a blank filler signal among real ones) is what the gate
  refuses. So survey abstains as a **`success` carrying the marker** — `surveyTarget.isAbstention`
  keys on `output.includes("no demand staged")`.

The model returns an empty board when the project grounds **no demand gradient**. A blank/contentless
charter risks the opposite failure (the model invents demand → `read-never-invent` STOP →
`gate-failed`, *not* honest-empty). So the reliable thin-survey input is a **complete / saturated
tiny project**: a thin charter for a frozen, finished tool + a board that already captures it ⇒ the
honest read is "nothing new to stage" ⇒ empty board ⇒ marker. (This matches T-019-02's note that a
saturated board *legitimately* reads as "nothing new"; here it is made unambiguous.)

## The asymmetry that forces a harness change

- **expand** already reads its fragment from the CLI `input.md`. A thin fragment file is exercised by
  the **existing** `expand` target with **zero code change**:
  `… expand docs/active/work/T-020-01/fixtures/thin-fragment.txt N`.
- **survey** takes **no input path** — it reads the whole seeded project, and `surveyTarget` hard-
  wires the charter + board source to `process.cwd()` (the live repo). There is **no seam** to point
  survey at a thin fixture. This is the one thing that genuinely needs new harness code.

## Existing fixtures & conventions

- `docs/active/work/T-019-02/fixtures/grounded-fragment.txt` — the **grounded** expand fixture (a
  real observability gap). The thin fragment is its negative-control sibling.
- `docs/active/work/T-002-04/fixtures/{tiny.md,underspecified.md}` — precedent for thin/underspecified
  fixtures (`E-901 "improvements" / "make the project better"` is the canonical vacuous input).
- Fixtures live per-ticket under `docs/active/work/{id}/fixtures/`.
- `CHARTER_PATH = "docs/knowledge/charter.md"` (`project-context.ts:18`); survey reads
  `<root>/docs/knowledge/charter.md` + lists ids in `<root>/docs/active/{stories,tickets}`.

## Constraints & assumptions

- **Live casts.** AC#1 requires *running* the probe — real BAML/Claude casts (minutes each). N kept
  small (directional, the E-014 discipline), exactly as T-019-02. `bun run check` (baml:gen +
  typecheck + `bun test`) is the deterministic gate and must stay green regardless.
- **Model behavior is not guaranteed** — honest-empty is the *expected* outcome of a deliberately
  demand-free input, not a hard guarantee. The fixture must make abstention as unambiguous as
  possible (frozen/complete project; vacuous fragment).
- **Two invariants preserved**: no ledger pollution, no collision — the new target reuses the same
  seed/clear machinery.
- `src/probe/run-probe.ts` must stay byte-for-byte unchanged (T-019 AC#3, inherited).
- This file is a sweep instrument, **not** unit-tested (house rule) — its judgment is the tested pure
  core. The negative control adds **fixtures + one target**, not new pure logic.
