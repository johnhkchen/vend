# T-020-03 — Research: recalibrate-survey-honest-empty

> Descriptive map of the codebase territory the ticket touches. What exists, where, how it
> connects. No solutions proposed here. The ticket: tighten survey's honest-empty criteria
> (`baml_src/survey.baml`) so a demand-rich board STAGES signals instead of abstaining (honest-empty
> rate ~0, was 67%), while a truly-thin board still abstains (the T-020-01 negative control).

## The one-paragraph orientation

This is the **survey-side twin** of T-020-02 (recalibrate-expand-honest-empty), which already landed
(commit `2a66121`). Same demand signal (E-019 finding (1): honest-empty over-fires on grounded input
— survey 67%, expand 33%), same lever (the BAML prompt, not the gate), same verification shape (a
deterministic `bun run check` bar + a directional live-probe AC). The differences are entirely about
survey's **scale** (whole project, not one fragment) and its **inverted honest-empty polarity**.

## The two layers (where the over-firing lives)

Survey, like every articulation play, is split into:

1. **`baml_src/survey.baml`** — the authored prompt + the `Board` output type. This is where the
   model's *decision to abstain* is shaped, by prompt prose and field `@description`s. **This is the
   lever.** The over-firing is a model judgement produced by the current "co-equal branch" framing of
   the `## Honest-empty (IA-4)` section (lines 53–57).
2. **`src/play/survey-core.ts`** — the PURE gates (`honest-empty → read-never-invent →
   leverage-rank`) + `renderBoard`. The `honestEmptyGate` (lines 92–102) is **correct and must not
   change**: it refuses a board padded with a *blank/filler* signal (`what` AND `why` both blank). It
   does NOT cause over-firing — the model returns a genuinely empty board (`{ signals: [] }`) when it
   over-abstains, which the gate correctly CLEARS as an honest abstention. Tightening the gate cannot
   conjure signals the model declined to emit. Wrong layer (mirrors T-020-02's rejected Option A).

## The honest-empty polarity inversion (the central divergence from expand)

`survey-core.ts`'s module header (lines 26–29) is explicit: **the empty-board polarity INVERTS from
expand.**
- **Expand:** the single blank `Signal` IS the whole output, so blank → **STOP** (`gate-failed`, a
  non-`success` outcome; nothing materializes).
- **Survey:** the `Board` IS the output, so an EMPTY board is the **SUCCESS abstention** — honest-empty
  CLEARS it, and the T-017-02 staging effect writes a **"# Survey — no demand staged"** marker note.
  A blank *entry among real ones* is the dishonesty the gate refuses.

Consequence for measurement (research-critical): survey's honest-empty is a `success` outcome, so the
probe reads its rate **directly off the headline mix** (`honest-empty rate 67%`), NOT off the raw
`gate-failed` tally the way expand's D4 asymmetry forced. This makes the AC cleaner to read than
T-020-02's.

## `baml_src/survey.baml` — the surface to change (anatomy)

- **`class Board`** (lines 32–34): one field, `signals Signal[]`, with a `@description` (line 33) that
  already carries the honest-empty instruction ("EMPTY when the project grounds no real demand
  gradient: abstain honestly, NEVER manufacture a list…"). This is **edit lever #2** (the type-level
  instruction the model sees via `{{ ctx.output_format }}`).
- **`function Survey(project, charter) -> Board`** (lines 36–81): the prompt. Relevant sections:
  - `## Read, never invent` (lines 46–51) — the citation requirement; **unchanged**, it is the
    evidence test the recalibration will bind abstention to.
  - `## Honest-empty (IA-4) — abstain rather than manufacture` (lines 53–57) — **edit lever #1.**
    Currently a co-equal "If the project grounds NO real demand gradient … ABSTAIN" branch with no
    concrete decision test and no calibrated example. This is the easy off-ramp producing the 67%.
  - `## Otherwise, author the board by these rules` (lines 59–72) — unchanged.
  - The `{{ charter }}` / `{{ project }}` / `{{ ctx.output_format }}` interpolations (lines 73–79) —
    unchanged boundaries.

### Survey REUSES expand's `Signal` type

The header (lines 11–13) and `survey-core.ts` (line 31) confirm `Board` wraps the **same `Signal` /
`SignalTier`** defined in `baml_src/expand.baml` — never redefined. T-020-02 already tightened
`Signal.what` / `Signal.why`'s blank-clause `@description`s. **Survey inherits that recalibration for
free** — so the per-signal blank instruction is already at the new bar; T-020-03 only needs the
board-scale prompt section + the `Board.signals @description`.

## The probe harness (already wired — no edit needed)

`src/probe/run-consistency-probe.ts` already carries both targets the AC needs:
- **`survey`** (lines 183–196, `surveyTarget`): seeds the **live** charter + board snapshot
  (`seedBoardSnapshot` from `process.cwd()`) — the grounded, demand-rich gradient. `isAbstention`
  keys on the `"no demand staged"` marker. This is the arm whose 67% must drop to ~0.
- **`survey-thin`** (lines 205–217, `surveyThinTarget`): IDENTICAL except charter + board are seeded
  from `THIN_BOARD_DIR` (`docs/active/work/T-020-01/fixtures/thin-board` — a complete/frozen tiny
  project with a `done` story/ticket). The negative control: must STILL abstain (stage the marker).
- `classifyRun` (lines 303–306): a `success` whose output trips `isAbstention` → `honest-empty`, else
  → `signal`. So both arms report honest-empty cleanly in the mix.

Run shape (no input file; survey reads the whole seeded project):
```bash
bun run src/probe/run-consistency-probe.ts survey 2        # grounded — expect HE ~0
bun run src/probe/run-consistency-probe.ts survey-thin 2    # thin — expect HE stays (≥1 marker)
```

## The baseline (what 67% means, and its caveats)

E-019 / T-019-02 `findings.md` measured survey at **honest-empty 67% (2 of 3)** on the live board,
with the outcome *flipping* run-to-run (HE / signal / HE) on the identical input — the inconsistency
itself. Two honest caveats from that note carry forward as constraints:
- The signal arm was **n=1** — survey's content dispersion is **unmeasured**, not proven clean.
- Survey's groundedness is **fuzzier than expand's**: a ~49-ticket board *could* legitimately read as
  "saturated → nothing new to stage." So part of the 67% is over-eagerness and part is a defensible
  "well-captured board" read. The **run-to-run flip** is unambiguous inconsistency regardless.

## Constraints & assumptions

- **Prompt-only change.** The only honest levers are textual: the `## Honest-empty` prose + the
  `Board.signals @description`. No field names, no types, no enum — so the generated `Board` shape
  stays byte-stable and `survey-core.test.ts` passes unchanged.
- **`baml_client/` is gitignored** (`.gitignore:2`) — regenerated by `baml:gen` inside `check`; the
  commit is `baml_src/survey.baml` only.
- **Verification is two-tier:** `bun run check` (deterministic, blocking — proves no shape drift) +
  the live probe (directional, the AC; non-deterministic, slow, small-N per E-014).
- **Honest-empty must be TIGHTENED, not DISABLED** — the `survey-thin` negative control is the guard
  (mirrors T-020-02's central risk). The IA-4 contract (fabricating demand is worse than none) holds.
- The live `survey` probe reads the **current** repo board; its demand gradient is whatever exists at
  cast time. That is the intended grounded input (it is genuinely demand-rich today).
