# Plan — T-072-04-01

## Step 1 — Pin the diagnosis at the pure summary boundary

Modify `src/engine/cast-core.test.ts` to import the new formatter and add tests that express the actual units.

Verification:

- Evidence-shaped values show `9 / 15` only for agent turns.
- External `num_turns = 18` is labeled as executor conversation events.
- Output never contains `18 / 15 cap`.
- A defensive case where observed agent turns exceed the cap does not render a fraction.

Commit unit: formatter core + tests can be one meaningful source unit because neither is useful independently.

## Step 2 — Implement the pure formatter

Modify `src/engine/cast-core.ts`:

- Add the input type.
- Add `formatTurnSummary`.
- Use same-unit fraction formatting only for a non-anomalous capped observation.
- Use separate labels for an anomalous over-cap observation.
- Append the executor event count under its own label.
- Keep the function total over optional inputs.

Focused verification:

`bun test src/engine/cast-core.test.ts`

## Step 3 — Wire settlement output

Modify `src/engine/cast.ts`:

- Import the formatter.
- Retain `resolveTurnsUsed(result?.num_turns)` as the raw validated external value.
- Format using the final accumulated `progress.turns`, the effective cap, and `turnsUsed`.
- Write the returned line with one newline when present.
- Leave the run-log spread of `turnsUsed` unchanged.

Focused verification:

- Existing cast tests remain green.
- Add an impure-shell assertion only if the pure formatter test does not adequately pin call-site behavior; otherwise avoid duplicating string policy in shell tests.

## Step 4 — Validate the ticket-owned source unit

Run:

- `bun test src/engine/cast-core.test.ts src/engine/cast.test.ts`
- `bun run build`
- `bun run check`

The full gate is authoritative. If concurrent unrelated files break it, distinguish ticket failures from pre-existing/concurrent failures honestly in progress/review.

## Step 5 — Commit with Lisa

Use `lisa commit-ticket` only, with exact repository-relative include paths:

- `src/engine/cast-core.ts`
- `src/engine/cast-core.test.ts`
- `src/engine/cast.ts`

Do not stage or commit concurrent ticket files. Confirm the exact command syntax with `lisa commit-ticket --help` before invoking it.

After commit, verify `git status --short` shows no ticket-owned modified/untracked source files.

## Step 6 — Close artifacts

Write `progress.md` with:

- completed steps;
- tests and gate results;
- commit identifier;
- deviations, if any;
- remaining work (none if green).

Write `review.md` with:

- root cause and evidence runs;
- source-file summary;
- test coverage;
- honest limitations and open concerns;
- acceptance-criteria assessment.

Remain on this ticket and stop after `review.md`; Lisa owns publication and completion transition.

