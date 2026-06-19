# Skill evaluations — `driving-lisa-vend-projects` (written first)

Per Anthropic's *Skill authoring best practices*: **build evaluations before fleshing the
skill.** They are the source of truth for whether the skill solves *real* problems, not
imagined ones. Each scenario targets a concrete **gap** a fresh Claude Code exhibits in a
`lisa init` + `vend init` project *without* the skill — established by running the **baseline
(no skill)** first and recording where it deviates.

> No built-in runner exists yet — run manually: **baseline** (no skill) vs **with-skill**, in
> the described setup state, scored against the rubric. The skill passes when it flips the
> baseline failures. The three cover the skill's core value: the clearing loop, the cold-start
> survey, and the verify-don't-trust discipline.

---

## Eval 1 — Clear a signal end to end (the core loop)

**Gap (baseline failure):** without the skill, Claude hand-authors tickets from scratch
(ignoring the plays), skips `lisa validate`, trusts `lisa status` for "done", and verifies
with the test suite instead of running the new capability live.

```json
{
  "skill": "driving-lisa-vend-projects",
  "query": "Ship the demand signal 'add a --json flag to the run-log reader so other tools can consume it' on this project.",
  "setup": "A project with `lisa init` + `vend init` done; `docs/active/demand.md` lists the signal; the vend plays and the `lisa` CLI are present.",
  "expected_behavior": [
    "Clears the signal via a vend play (`vend chain \"...\"`, or expand -> propose -> decompose) into an epic + lisa-valid stories/tickets — does NOT hand-write tickets from scratch.",
    "Runs `lisa validate` and confirms the DAG is valid before building.",
    "Builds the tickets via `lisa loop` rather than implementing them by hand in-session.",
    "Verifies against git truth — `git status` / `git log` + `bun run check:committed` + `check:head` — not `lisa status` alone.",
    "Runs the new capability live (invokes the `--json` flag) as the headline verification, not just the test suite.",
    "Sweeps: marks the epic done, records the outcome in `demand.md`, and commits with source committed and HEAD building."
  ]
}
```

## Eval 2 — Cold start from a vague ask (survey -> leverage pull)

**Gap:** asked "what's next?", Claude guesses or hand-lists tasks; it doesn't read the project
into a ranked board, doesn't rank by leverage, and may manufacture busywork on a saturated
project.

```json
{
  "skill": "driving-lisa-vend-projects",
  "query": "I'm not sure what to work on next here — find the highest-leverage move and get it going.",
  "setup": "A lisa+vend project with code + docs but a thin or empty `docs/active/demand.md`.",
  "expected_behavior": [
    "Runs `vend survey` (or `vend steer`) to read the project into a ranked, staged board — does NOT guess or hand-author a task list.",
    "Ranks candidates by leverage (what unblocks most / advances the core feature), not by estimated effort.",
    "Surfaces the top pull (and, with `vend steer`, the genuine forks) for the human rather than silently committing to a low-value task.",
    "Honors honest-empty: if the project has no real demand gradient, says so rather than inventing work.",
    "On assent, proceeds into the clearing loop (Eval 1) on the chosen signal."
  ]
}
```

## Eval 3 — Catch a dishonest "done" (verify discipline + andon)

**Gap:** the loop marks tickets done but leaves source uncommitted or HEAD non-building.
Without the skill, Claude trusts `lisa status`, reports false success, and may edit a running
loop's in-flight source.

```json
{
  "skill": "driving-lisa-vend-projects",
  "query": "The lisa loop finished — confirm the work shipped and give me a status update.",
  "setup": "A project where `lisa status` shows the tickets 'done', but `git status` has uncommitted source under `src/` (or `bun run check:head` fails — HEAD does not build).",
  "expected_behavior": [
    "Checks git truth (`git status` / `git log`) and runs `bun run check:committed` + `check:head` — does NOT report success from `lisa status` alone.",
    "Detects the uncommitted source / non-building HEAD and names the offending path specifically.",
    "Treats the gate-stop / andon as the system working (an honest stop) — reports it accurately and resolves it (commits the residual / fixes the build), neither as a crash nor by faking green.",
    "If a loop is still running, does not touch its in-flight `src/`; commits only its own files.",
    "Reports the true state plainly: what is committed, what builds, what is outstanding."
  ]
}
```

---

## Running them (until a runner exists)

For each scenario: **(1) baseline** — a fresh Claude Code in the setup state, *no* skill;
record every deviation from the rubric (these are the gaps the skill must close). **(2)
with-skill** — same state, skill loaded; score against the rubric. The skill passes a scenario
when it flips the baseline's failures to rubric-passing behavior. Then keep running it on
*real* tasks and bring observed gaps back into the skill (the Claude-A / Claude-B loop).

Coverage note (no silent gaps): these three exercise the loop's spine (clear → build → verify
→ sweep), the cold-start entry, and the verification discipline — but **not yet** the budget /
recalibration model, the gate-tuning measurement loop, or multi-epic dogfood via `vend chain`.
Add a fourth/fifth eval for those as the skill grows.
