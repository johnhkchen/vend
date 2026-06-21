# T-044-01 — Progress

Tracking the Implement phase against `plan.md`. All steps executed; no deviations.

## Status: implementation complete, all checks green

| Step | What | Result |
|------|------|--------|
| 1 | Add CONCRETE-DEMAND bullet to `baml_src/steer.baml` `## The board` rules | ✅ inserted as first bullet before `ONE signal per real demand` |
| 2 | Add byte-identical bullet to `baml_src/survey.baml` `## Otherwise, author the board` rules | ✅ verbatim wording, same site |
| 3 | `bun run baml:gen` | ✅ exit 0; **no `baml_client/` churn** (prompt-text only, generated client byte-identical) |
| 4 | Contract assertion in `src/baml/steer.test.ts` render `describe` | ✅ new T-044-01 test |
| 5 | Contract assertion in `src/baml/survey.test.ts` render `describe` | ✅ new T-044-01 test |
| 6 | `bun run check` (baml:gen + typecheck + test) | ✅ **1087 pass, 0 fail** (1085 prior + 2 new); tsc clean |

## What was implemented

The semantic recalibration the ticket specified — a prompt fix, not a gate (the E-020 shape):

- **Both rankers carry a new lead board-authoring rule** (`CONCRETE DEMAND ONLY`): a board signal must
  be **concrete product demand** — a buildable feature/change to Vend that **decomposes into an
  epic** — and **self-referential / operational meta-tasks** (run Vend on itself, "run the sweep",
  settle/close a prior run, dogfood the loop) are **NOT** demand signals: demote beneath all concrete
  demand or exclude. Phrased as steering (an imperative bullet, the RANK/GROUND voice), **not** a new
  output field. Wording is byte-identical across `steer.baml` and `survey.baml` (consistency).
- **Deterministic contract assertion** (no live model): each ranker's render test now asserts the
  rendered prompt `toContain("concrete product demand")` and `toContain("self-referential")`. Rides
  the existing render bridge op (index 3 in `RESULTS`) — no new harness, no fixture/`runBridge`
  change. The asserted phrases are lowercase literals present verbatim in the bullet.

## Deviations from plan

None. The bullet wording was authored so the two contract phrases appear as exact lowercase
substrings (case-sensitive `toContain`); `"run the sweep"` reuses the prompt's existing quoting style,
so `baml:gen` parsed the `#" … "#` block without escaping issues.

## Verified unchanged (AC guards)

- `git status` shows **only** `baml_src/steer.baml`, `baml_src/survey.baml`, `src/baml/steer.test.ts`,
  `src/baml/survey.test.ts` modified (plus the work artifacts). No `baml_client/` churn.
- `ClaudeStub`, `class Fork`/`Steer`/`Board`/`Signal`, `function SteerProject`/`Survey`, and all
  template slots unchanged — the edits are prompt **text** inside the `prompt` blocks only.
- `src/play/steer-core.ts` (the three structural gates) **untouched** — no keyword/pattern gate added
  (AC#4).
- The SAP-degrade / parse pins in both `*.test.ts` files are unchanged and still green.

## Not done here (by design)

- **Live confirmation is deferred** — named in `review.md`, not run. The real proof is the next
  `vend steer`/sweep staging a board whose #1 is concrete demand, not "run the sweep" (E-038→E-039
  shape). No live model was cast.
- **No commit made** — artifacts written; phase transition and commit left to Lisa per the harness
  contract (do not edit ticket frontmatter).
