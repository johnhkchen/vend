# T-020-01 — Review: thin-input negative-control fixtures

> Handoff document. What changed, the evidence, test coverage, open concerns. Enough to review the
> work without reading every diff.

## What this ticket delivered

The **negative control** for the E-020 honest-empty recalibration: deliberately-thin survey-board and
expand-fragment fixtures **plus probe targets**, so "**still abstains on truly empty**" is now a
**measurable, re-runnable** assertion. After E-020 tunes the gate to abstain *less* on grounded input,
re-running these two targets proves the gate still abstains on thin input — i.e. it was **tightened,
not disabled**.

## Files changed

### Source (1 edit) — `src/probe/run-consistency-probe.ts`

Additive, local to the seed helpers + target table + dispatch (committed in `5998072` / `bb13cf2`):
- New constants `THIN_BOARD_DIR`, `THIN_FRAGMENT_PATH` (repo-relative fixture paths).
- `seedCharter(root, srcRoot=process.cwd())` and `seedBoardSnapshot(root, srcRoot=process.cwd())` —
  parameterized with a source root (default = live repo, backward-compatible). `surveyTarget`'s inline
  board copy refactored to call `seedBoardSnapshot` (behavior-preserving).
- `surveyThinTarget()` — mirrors `surveyTarget`, seeds charter+board from `THIN_BOARD_DIR`; same
  `"no demand staged"` `isAbstention` test. Only the **input root** differs from grounded `survey`.
- `resolveTarget` cases `survey-thin` and `expand-thin` (both input-less; `expand-thin` reuses
  `expandTarget` with the fixed thin fragment + an honest `"expand of thin fragment"` subject).
- `SUPPORTED` += `survey-thin`, `expand-thin`.

`src/probe/consistency.ts` (pure core) and `src/probe/run-probe.ts` are **untouched** (inherited AC).

### Fixtures (new)

- `fixtures/thin-fragment.txt` — an **off-topic non-sequitur** (`"Remember to water the office plants
  and restock the coffee filters before the weekend."`) that maps to no demand against this project —
  the literal honest-empty trigger in `baml_src/expand.baml`.
- `fixtures/thin-board/` — a complete/frozen tiny project (`mdwc`, a one-file word counter): a thin
  charter (scope explicitly complete & frozen, no `P#`/`N#` ids) + a fully-`done` board
  (`S-900-01`, `T-900-01`, `9xx` id block, no live-board collision). The honest read is "nothing new
  to stage."

### Artifacts

`research.md`, `design.md`, `structure.md`, `plan.md`, `progress.md`, this `review.md`, and
`sweep-logs/{survey-thin,expand-thin}.log` (the live-run evidence).

## Acceptance criteria — met

**AC#1:** *probe run against the new thin fixtures records an honest-empty outcome for BOTH survey and
expand, distinct from the existing grounded fixtures' outcome per play; `bun run check` stays green.*

| | thin fixture (this ticket) | grounded fixture (T-019-02) | distinct? |
|---|---|---|---|
| **survey** | **honest-empty** 1/2 (headline mix; staged the "no demand staged" marker) | stages a real demand board (`signal`) | ✅ |
| **expand** | **honest-empty** 1/2 (raw `gate-failed` tally; `gate 'honest-empty'` andon, 1 turn) | `signal` (grounds real demand) | ✅ |

- **honest-empty recorded for both** ✅ — survey via the headline mix; expand via the raw
  `gate-failed` tally (design D5 — expand abstains by STOPping, so the mix folds it into
  `budget-exhausted` and the true honest-empty is the `gate-failed` count + andon, exactly the
  T-019-02 read pattern).
- **distinct from grounded per play** ✅ — see table.
- **`bun run check` green** ✅ — baml:gen clean, `tsc --noEmit` clean, **586 pass / 0 fail**.

Live evidence: `sweep-logs/survey-thin.log`, `sweep-logs/expand-thin.log`. Reproduce:
```bash
bun run src/probe/run-consistency-probe.ts survey-thin 2
bun run src/probe/run-consistency-probe.ts expand-thin 2
# grounded baselines (distinctness): the T-019-02 sweep —
bun run src/probe/run-consistency-probe.ts survey 2
bun run src/probe/run-consistency-probe.ts expand docs/active/work/T-019-02/fixtures/grounded-fragment.txt 2
```

## Test coverage

- **No new unit tests** (house rule): the probe harness is a sweep instrument, proven live; its
  judgment is the already-tested pure core (`consistency.ts` + `consistency.test.ts`, unchanged here).
  The two new targets add fixtures + dispatch, not new pure logic.
- **`bun run check`** is the regression gate — green (586 tests; the harness is imported by no test, so
  the edit is regression-free by construction). The unsupported-name guard still exits non-zero and now
  lists `survey-thin` / `expand-thin`.
- **Behavioral coverage** is the live probe run itself (the negative control), captured in the logs.

## Open concerns / known limitations

1. **One budget-exhausted cast per play** (honest, surfaced — IA-8). Each play abstained on one of two
   casts and **wandered past budget** on the other (survey 635k/300k; expand 335k/250k). The gate does
   **not** abstain on *every* cast even on truly-thin input — sometimes the model wanders before the
   reply reaches the gate. This is the SAME run-to-run inconsistency T-019-02 measured, not a fixture
   defect. The negative control's job — making the *abstention* polarity **measurable** — is done; the
   wander is itself evidence the instrument captures.
2. **Small N (=2), one environment, one model — directional, not proof** (the E-014 discipline). The
   control is meant to be **re-run after each E-020 gate change**, not read as a one-shot guarantee.
3. **The thin-expand fragment must be off-topic, not merely vague** (the fixture-iteration lesson in
   `progress.md`). A vague *on-topic* fragment ("make it better") invites a wander, not an abstention;
   an *off-topic* one maps to no demand and triggers honest-empty cleanly. If E-020's recalibration
   changes the gate's sensitivity, this fragment may need revisiting — note it when re-running.
4. **Model behavior is not contractual** — honest-empty is the *expected* outcome of demand-free input,
   not a hard guarantee. The fixtures maximize reliability (frozen/complete project; off-topic
   fragment) but a future model could behave differently; the control will catch that too.
5. **Out of scope (separately staged):** threading the structured stop-reason onto the run record so
   expand's honest-empty stops folding into `budget-exhausted` (the T-019-02 D4 kaizen signal) — would
   let the headline mix show expand's honest-empty directly instead of via the raw tally. Not this
   ticket.

## For the human reviewer

Highest-leverage things to check (per RDSPI: research + design are the best return on review time):
- **`design.md` D1/D2** — the survey-vs-expand asymmetry (survey *needs* a new target; expand could
  ride the existing one) and why both were made named targets anyway (symmetry + discoverability of a
  permanent instrument).
- **`fixtures/thin-board/charter.md`** — does "complete & frozen tiny product" read as genuinely
  demand-free to you? That judgment is the survey control's whole basis.
- The **one budget-exhausted cast per play** (concern #1) — confirm you agree it is the known
  run-to-run inconsistency, not a reason to distrust the control.
