# T-020-03 — Design: recalibrate-survey-honest-empty

> Options, tradeoffs, decision with rationale — grounded in `research.md`. The problem: survey's
> model abstains on a **demand-rich, grounded** board (67%, T-019-02) instead of staging signals. The
> lever is the **prompt** (`baml_src/survey.baml`), not the gate. Goal: raise the abstention bar so a
> board with real vision-distance stages signals, while a complete/frozen board still abstains.

## The decision in one line

**Rewrite the prompt's `## Honest-empty (IA-4)` section to reframe abstention as a RARE exception
gated on a concrete "can you read even ONE real demand off the project?" test, add a calibrated
example pair at BOARD scale (complete/frozen project = abstain / project-with-open-gaps = stage), and
tighten the `Board.signals` `@description` to match.** No code changes; `survey-core.ts` and the
harness are untouched. This is the deliberate twin of T-020-02's Option C, adapted for survey's scale
and inverted polarity.

## What is in scope to change

The over-firing is a **model decision** produced by prompt language (research §"two layers"). The
only honest levers are textual, inside `Survey`'s prompt and the `Board.signals` `@description`.
Everything else (gate logic in `survey-core.ts`, the staging effect, probe targets, budgets) is
correct. Note survey inherits T-020-02's already-tightened `Signal.what`/`.why` descriptions for free
(research §"REUSES expand's Signal"), so this ticket needs *less* type-level work than its twin —
only the `Board` wrapper's description.

## Options considered

### Option A — Tune the GATE threshold (`survey-core.ts`)  ❌ rejected

Make `honestEmptyGate` require *more* than an empty `signals[]` to clear honestly (e.g. cross-check
the project for ungrounded demand).

- **Why tempting:** deterministic, unit-testable, no live-cast dependence.
- **Why rejected:** wrong layer. The over-firing produces a genuinely EMPTY board (`{ signals: [] }`)
  — the model declined to stage. The gate *correctly* clears empty as the honest abstention (the
  inverted polarity: empty IS the success case for survey). A pure gate **cannot** read demand off
  the project the model already declined to read — it has no signals to inspect. Tightening it could
  only make honest-empty *throw* on legitimately-empty boards (breaking the negative control and
  IA-4). The model abstains too eagerly; that judgement lives in the prompt. Mirrors T-020-02 Option A.

### Option B — Delete the honest-empty section from the prompt  ❌ rejected

Remove the abstention instruction so the model always stages a board.

- **Why rejected:** directly **disables** the abstention — the thin board would stop abstaining,
  failing the AC's negative control (`survey-thin` must still stage the "no demand staged" marker). It
  violates IA-4 (honest-empty is a first-class contract — a board-stocker that fabricates demand is
  worse than none) and invites manufactured busywork on a complete project (overproduction, the worst
  waste). The ticket says *tighten*, not *remove*.

### Option C — Reframe abstention as a rare, source-gated exception + calibrated board-scale examples  ✅ chosen

Keep the honest-empty branch but **raise its bar** with three moves, the survey-scale analogue of the
T-020-02 recalibration:

1. **Reframe the default.** Lead with "abstention is the EXCEPTION, not a co-equal branch." A project
   with any open work, TODO, or gap between vision and what exists is NOT empty; survey exists to read
   the latent demand gradient, so a *large* or *partly-captured* board is never a reason to abstain.
2. **A concrete decision test at project scale.** "Can you read even ONE real demand off the project —
   an open ticket/story, a TODO, a run-log fact, a gap between the charter's vision and what exists?
   If YES → stage it (that source is its `grounding`). Abstain — return an EMPTY board — ONLY when the
   honest answer is 'this project grounds no demand: everything it points at is already done.'" This
   binds abstention to the *same* evidence `read-never-invent` already requires (research §"Read,
   never invent"), resolving the tension the two sections create.
3. **A calibrated example pair at BOARD scale.** Show the boundary explicitly: a **complete/frozen
   tiny project** (a thin charter + an all-`done` board, nothing open) → ABSTAIN (empty board — this
   is exactly the `survey-thin` / `THIN_BOARD_DIR` negative control); a **project with open tickets,
   TODOs, or visible vision-distance** → STAGE the ranked board (the demand is there to read). The
   pair teaches the boundary "frozen/complete vs has-open-work," which is the actual axis the 67%
   false-negatives sit on.

Plus reinforce the bar at the **type level**: tighten the `Board.signals` `@description` so the
abstention instruction the model sees in `{{ ctx.output_format }}` matches the prose ("EMPTY ONLY when
the project is complete/frozen and grounds NO demand — a project with any open work or vision-distance
stages a ranked board, never an empty one").

- **Why chosen:** minimal change at the correct layer. It preserves the honest-empty contract (the
  complete/frozen board still abstains → negative control holds) while removing the easy off-ramp that
  produced the 67% false negative. Few-shot examples + a concrete predicate are the standard,
  evidence-backed way to relocate an LLM decision boundary. Fully reversible; all code and tests
  untouched. Consistent with its already-merged twin (T-020-02), which is a virtue — the two
  honest-empty sections should read as siblings.
- **Cost:** verification needs **live casts** (the AC), non-deterministic and slow. Accepted — inherent
  to any prompt change, matches the T-019-02 / T-020-01 / T-020-02 precedent.

## Why board-scale examples (not expand's fragment example)

T-020-02's example pair was fragment-scale ("water the office plants" → abstain). Survey reads a
**whole project**, so its calibration boundary is a different axis: *complete/frozen project* vs
*project-with-open-work*, not *off-topic phrase* vs *real gap*. Using the `THIN_BOARD_DIR` shape (an
all-`done` board) as the abstain example is deliberate alignment: the model is calibrated on exactly
the negative-control input the AC measures, while the "stage" example teaches the general boundary
(any open work / vision-distance → read demand). This is calibration, not cheating — it teaches the
*axis*, which generalizes; it does not encode specific signals.

## Interaction with read-never-invent (the gate that follows)

honest-empty runs FIRST, then read-never-invent (`SURVEY_GATE_NAMES`). The new language makes them
**collaborate** instead of conflict: abstain when there is no demand to read; otherwise stage signals
AND put each one's source in `grounding` (which read-never-invent then checks). A board the model now
stages must still carry grounding per signal — so the recalibration cannot produce *ungrounded*
boards; a model that stages an uncited signal simply trips read-never-invent (a correct, different
STOP), not a false honest-empty. The complete/frozen board grounds no demand, so the model still finds
nothing to read → still abstains. The bar moved up cleanly.

## What "done" looks like (verification design)

- **Deterministic:** `bun run check` green — regenerated `baml_client/` compiles, all tests (incl.
  `survey-core.test.ts`, unchanged) pass. Proves the prompt edit did not alter the `Board` /
  `Signal` / `SignalTier` shape.
- **Directional (the AC):** probe `survey` N≥2 on the live grounded board → `honest-empty rate ~0`
  read **directly off the headline mix** (survey's HE is a `success`, no D4 fold — research
  §"polarity inversion"); probe `survey-thin` N≥2 → at least one `honest-empty` marker persists. Logs
  captured under `docs/active/work/T-020-03/sweep-logs/`.

## Risks & mitigations

- **Over-correction (the central risk).** A too-aggressive rewrite disables abstention → the thin
  board stops abstaining (AC fail / IA-4 violation). *Mitigation:* keep the honest-empty branch with
  an explicit, example-anchored complete/frozen case; verify the `survey-thin` negative control every
  run.
- **Model nondeterminism + fuzzy groundedness.** "~0" is not guaranteed at small N, and survey's
  grounded board is fuzzier than expand's (a saturated board can defensibly read as "nothing new").
  *Mitigation:* frame results as directional (E-014), report the raw tally honestly (IA-8), re-cast if
  a single outlier dominates a tiny N; the unambiguous target is *removing the run-to-run flip* on
  demand-rich input, not a hard 0.
- **Shape drift.** An accidental edit to a field name/type breaks `baml:gen`/tests. *Mitigation:* edit
  only `@description` text and prose — never field names, types, or the enum. `bun run check` catches
  any drift.
