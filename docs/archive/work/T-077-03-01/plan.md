# Plan — T-077-03-01

## Goal

Make the live token fraction honestly identify a detected-after overshoot, prove
both sides of the boundary in the pure formatter tests, pass the repository gate,
and commit only ticket-owned source paths through Lisa.

## Step 1 — Establish a red regression test

Modify `src/engine/cast-core.test.ts` inside the existing cast-progress describe
block.

Actions:

1. Add a test named for the over-envelope detect-after behavior.
2. Construct an over-envelope progress state with 392,000 weighted tokens and a
   200,000-token envelope.
3. Assert the exact complete line contains
   `392k/200k tokens (detect-after)` between the elapsed and turn segments.
4. Construct an under-envelope progress state against the same envelope.
5. Assert its exact line includes the token denomination but no marker.
6. Add an explicit negative assertion for `(detect-after)` on the under-envelope
   output so the acceptance condition is easy to review.
7. Update existing exact formatter expectations to the intended `tokens` label.

Verification:

- Run the focused test file before changing production code.
- Expect failures showing the current formatter neither labels tokens nor emits
  the detect-after marker.
- Record the red result in `progress.md`.

## Step 2 — Implement the pure formatter rule

Modify only `formatCastProgress` in `src/engine/cast-core.ts`.

Actions:

1. Preserve the existing turn calculation.
2. Compose the humane spent/envelope fraction into a local token string.
3. Append the literal ` tokens` denomination.
4. Append ` (detect-after)` only when raw weighted spend strictly exceeds the raw
   envelope.
5. Substitute the local token string into the existing line template.
6. Keep the signature and all adjacent progress accounting unchanged.

Verification:

- Run `bun test src/engine/cast-core.test.ts`.
- Confirm all existing progress behavior still passes after deliberate expected
  string updates.
- Confirm over-envelope presence and under-envelope absence are both green.

## Step 3 — Inspect the source diff

Actions:

1. Use `git diff -- src/engine/cast-core.ts src/engine/cast-core.test.ts`.
2. Confirm no accounting, shell, summary, or turn logic changed.
3. Confirm exact marker placement is before the separator introducing turns.
4. Check `git status --short` and distinguish ticket-owned files from concurrent
   Lisa/other-ticket changes.

Verification:

- The source diff contains only the formatter composition and regression
  expectations/test.
- No ticket-owned path is staged.

## Step 4 — Run the repository gate

Run:

`bun run check`

The gate covers:

- BAML generation and generated-code consistency;
- TypeScript typechecking;
- the complete Bun test suite.

If the gate changes generated files, inspect them before proceeding. Do not
include unrelated or generated churn unless it is a necessary consequence of
this ticket; none is expected.

Verification:

- Command exits zero.
- Record test counts and any relevant output in `progress.md`.

## Step 5 — Commit the meaningful source unit

Use Lisa's isolated commit mechanism after the full gate is green:

```text
lisa commit-ticket \
  --ticket-id T-077-03-01 \
  --message "fix(engine): label live token overshoot detect-after" \
  --include src/engine/cast-core.ts \
  --include src/engine/cast-core.test.ts
```

Actions:

1. Do not use `git add`, `git add -A`, or ordinary `git commit`.
2. Allow Lisa to serialize and isolate the exact-path commit.
3. Capture the resulting commit hash.
4. Re-check status to ensure ticket-owned paths are clean.
5. Confirm unrelated worktree changes remain present and untouched.

Verification:

- Git history contains the ticket source commit.
- `git status --short -- src/engine/cast-core.ts src/engine/cast-core.test.ts`
  is empty.
- No ticket-owned file is staged, modified, or untracked.

## Step 6 — Write implementation progress

Create/update attempt-private `progress.md` with:

- completed plan steps;
- initial red test evidence;
- focused green test evidence;
- full gate evidence;
- committed paths and commit hash;
- deviations from plan, if any;
- confirmation that unrelated concurrent state was preserved.

The artifact is private to the attempt and is not included in the source commit.

## Step 7 — Review

Inspect the committed diff and acceptance criterion one final time.

Review questions:

- Does raw `weightedTokens > tokenEnvelope` control the marker?
- Does the exact over-envelope line match the story example's wording and
  placement?
- Does a below-envelope line omit the marker?
- Are equality/accounting/turn semantics unchanged?
- Are tests deterministic and token-free?
- Is the full repository gate green?
- Are exact ticket-owned paths clean after the Lisa commit?
- Were all out-of-slice areas left untouched?

Create attempt-private `review.md` summarizing the change, coverage, boundary,
and open concerns.

Create `review-disposition.json` with exactly:

```json
{"disposition":"pass","reason":null}
```

only when the acceptance criterion, tests, gate, and commit requirements are all
satisfied. Otherwise write a blocking disposition with a non-empty actionable
reason.

## Atomicity rationale

The formatter change and its pinned tests are one meaningful source unit. A test-
only commit would leave the repository intentionally red, while a production-only
commit would temporarily change a user-visible contract without its regression
proof. They are therefore committed together after the red/green implementation
cycle is recorded in `progress.md`.

## Stop condition

After both review artifacts exist, remain on `T-077-03-01` and stop. Do not edit
ticket phase/status, publish artifacts to shared work, complete another ticket,
or release the seat; Lisa handles those transitions.
