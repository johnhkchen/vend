# T-010-01 — Progress

Plan executed in order; no deviations.

## Completed

- **Step 1 — pure core.** `src/ci/head-build-core.ts`: `BuildStep`,
  `BuildOutcome`, `HeadVerdict`; `classifyBuildOutcome` (0/1/2 mapping copied from
  E-008), `buildStepFailed`. fs/git/process-free.
- **Step 2 — pure tests.** `head-build-core.test.ts` block 1: 4 classify cases +
  `buildStepFailed`. Green.
- **Step 3 — impure verb.** `src/ci/check-head.ts`: `buildCommittedHead`
  (preflight → `git worktree add --detach <tmp> HEAD` → optional install → check →
  raw `BuildOutcome`), worktree + temp-parent removed in `finally` (every path).
  `import.meta.main` entry classifies + exits. Spawns via `Bun.spawnSync` (the
  `check-committed.ts` idiom).
- **Step 4 — integration test.** `head-build-core.test.ts` block 2: synthetic
  repo (`check: "bun run app.ts"`, `app.ts` imports `./dep.ts`). Broken HEAD
  (app.ts committed without dep.ts) → `failedStep:"build"`, exit 1; clean HEAD →
  `null`, exit 0; two no-leak assertions; a non-repo preflight → exit 2. Runs
  offline (`install: null`), sub-second.
- **Step 5 — script.** `package.json`: `"check:head": "bun run src/ci/check-head.ts"`.
- **Step 6 — verification.**
  - `bun run check:typecheck` — clean.
  - `bun test` — **319 pass, 0 fail** (+10 new), 472ms.
  - `bun run check:committed` — correctly flags the new (pre-commit) source.
  - **Real-gate smoke (AC#1 end-to-end):** `bun run check:head` against the live
    HEAD → `check:head: ok — committed HEAD builds`, **exit 0**; `git worktree
    list` shows only the main tree → **no leak**. (This run does a real
    `bun install` + `baml:gen` + `tsc` + `bun test` in the isolated worktree —
    slow, by design; kept OUT of the `bun test` suite.)

## Deviations

None. `git worktree add --detach <tmp> HEAD` + `worktree remove --force` behaved
exactly as the design assumed; synthetic-repo commit identity needed
`git config user.email/user.name` (handled in `makeRepo`).

## Notes for Review / next ticket

- T-010-02 wires this to the lisa **on-clear** hook (not on-stop). The exit
  vocabulary is ready for it: fail-open on `2`, block/warn on `1`.
- The real gate is intentionally heavy (full install+check in a worktree). T-010-02
  must trigger it at a coarse boundary, never per-turn.
