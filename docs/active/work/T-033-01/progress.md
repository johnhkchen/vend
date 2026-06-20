# T-033-01 — Progress: precommit-policy-core

*What was completed, what remains, deviations from plan.*

## Status: complete

Both files authored, all checks green, ready to commit.

## Completed (against plan.md steps)

- **Step 1 — `src/ci/precommit-core.ts`** ✅
  - Pure leaf module: **zero imports**. No `Bun.`, `process.`, `readFile`, `spawn`, or git tokens.
  - `PrecommitReason` / `PrecommitRun` / `PrecommitVerdict` types; `classifyPrecommit` checks `ran`
    first, then `exitCode === 0`, then the failing branch.
  - `verdictMessage` is a `switch (reason)` with one arm per reason and **no `default`**, closed by
    `return assertNever(reason)` — the exhaustiveness proof.
  - `HOOKS_DIR = ".githooks" as const` (R12 shared contract); `hookInstallState` with trailing-slash
    normalization, unset → install-nudge, unexpected-path → named install-nudge.
  - private helpers `tail` (`tail(undefined) === ""`) and `assertNever`.
- **Step 2 — `src/ci/precommit-core.test.ts`** ✅
  - 3 `describe` blocks, AC fixtures flagged `// AC:`, exact-value + `toContain` assertions.
- **Step 3 — `bun run check:typecheck`** ✅ clean. Proves purity + exhaustiveness (the no-`default`
  switch compiles only because all three reasons are handled).
- **Step 4 — `bun run check:test`** ✅ new file: **13 pass / 0 fail**; full suite: **925 pass / 0 fail**
  across 60 files (no regression; suite grew from ~912 → 925 by the 13 new cases).
- **Step 5 — commit** ✅ (see git log; single atomic commit, both files together).
- **Step 6 — working tree clean** ✅ `src/` has no uncommitted source (E-008 on-stop will pass).

## Deviations from plan

**None affecting the AC.** One detail worth recording:

- The plan's risk-watch flagged that `tsc` *might* reject the post-`switch` `return assertNever(reason)`
  as unreachable, with a documented fallback to the head-build-core if/return idiom. **It did not** —
  `tsc` accepted the switch-with-no-default + `assertNever` shape cleanly (D3 option B held), so no
  fallback was needed. The strongest exhaustiveness guarantee is in place: a future fourth `reason`
  fails the build at the switch.
- Minor message-ordering choice: for `could-not-run` the `(fail-open)` tag precedes the stderr tail
  (`… (fail-open): bun: not found`) rather than trailing it — keeps the discipline label adjacent to
  the verdict. Cosmetic; covered by the fixture asserting both substrings are present.

## What remains for this ticket

Nothing. The pure policy is delivered and verified. The Review artifact (`review.md`) follows.

## Hand-off to T-033-02 (out of scope here, noted for the next ticket)

T-033-02 consumes this core via the impure surface:
- `.githooks/pre-commit` runs `bun run check:test`, builds a `PrecommitRun` from the spawn result,
  calls `classifyPrecommit`, and exits non-zero iff `verdict.block`.
- `hooks:install` runs `git config core.hooksPath .githooks` (the `HOOKS_DIR` value).
- `check:hooks` reads `git config core.hooksPath` and feeds it to `hookInstallState`, printing
  `state.message` and exiting on `!state.active`.
All three derive the path from the exported `HOOKS_DIR` — no re-listing.
