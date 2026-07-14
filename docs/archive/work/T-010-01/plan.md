# T-010-01 — Plan: implementation sequence

*Ordered, independently-verifiable steps. Each is small enough to commit
atomically. Testing strategy and verification criteria stated per step.*

## Testing strategy

- **Pure core** (`classifyBuildOutcome`, `buildStepFailed`): ordinary `bun:test`
  pure-function assertions — exact `exitCode`, `ok`, and message substrings. Fast,
  no spawning.
- **Impure verb** (`buildCommittedHead`): an **integration** test that constructs
  a synthetic git repo on a temp fs (the `propose-effect.test.ts` precedent) and
  drives the verb offline (`install:null`, `check:["bun","run","app.ts"]`-equiv).
  Asserts the broken/clean HEAD contrast and worktree non-leak.
- **No real-repo run inside `bun test`** — that is verification after the loop
  (manual smoke), kept out of the suite for speed.

## Verification criteria (maps to Acceptance Criteria)

- **AC#1** (isolated build, exit non-zero iff clean-HEAD build fails, worktree
  removed every path) ⇐ Steps 3–4 + the no-leak test (Step 4) + manual smoke
  (Step 6).
- **AC#2** (no Docker, offline) ⇐ Step 3 uses only `git worktree` + `Bun.spawnSync`;
  integration test runs with `install:null`, no network.
- **AC#3** (pure classifier unit-tested; synthetic broken HEAD fails, clean HEAD
  passes, reproducing E-007) ⇐ Steps 2 + 4.
- **AC#4** (in-place `check:*` stay green; `check:committed` untouched) ⇐ Step 5
  adds only a new line; Step 6 runs the full suite + `check:committed`.

---

## Step 1 — Pure core skeleton

Create `src/ci/head-build-core.ts`: `BuildStep`, `BuildOutcome`, `HeadVerdict`
types; `classifyBuildOutcome`; `buildStepFailed`. Doctrine header comment.

**Verify:** `bun run check:typecheck` passes; file imports nothing impure.

## Step 2 — Pure core tests

Create `src/ci/head-build-core.test.ts` with the `classifyBuildOutcome` /
`buildStepFailed` block:
- `null` → exit 0 ok, message includes "ok — committed HEAD builds".
- `"build"` → exit 1, message includes "does not build" and the detail.
- `"preflight"` → exit 2, message includes "preflight"; `"worktree"` → exit 2.
- `buildStepFailed(0)===false`, `buildStepFailed(2)===true`.

**Verify:** `bun test src/ci/head-build-core.test.ts` green.

## Step 3 — The impure verb

Create `src/ci/check-head.ts`: `HeadBuildOptions`, `buildCommittedHead`
(preflight → worktree add → install?/check → classify-less raw `BuildOutcome`),
worktree removal in `finally`, and the `import.meta.main` entry. Spawns via
`Bun.spawnSync`. Header comment mirrors `check-committed.ts`.

**Verify:** `bun run check:typecheck` passes; `bun -e 'import("./src/ci/check-head.ts")'`
loads without side effects (no `import.meta.main` when imported).

## Step 4 — Integration test (synthetic HEAD)

Add the second `describe` to `head-build-core.test.ts` (importing
`buildCommittedHead` from `check-head.ts`):
- `makeRepo()` helper: `git init` + identity + write `package.json`/`app.ts`/`dep.ts`.
- **broken HEAD:** commit `package.json`+`app.ts` only → `buildCommittedHead`
  with `install:null` → `failedStep==="build"`, classified exit 1.
- **clean HEAD:** commit all → `failedStep===null`, classified exit 0.
- **no-leak:** after a run, the temp parent dir is gone and `git worktree list`
  shows only the main tree.
- teardown removes the temp repo.

**Verify:** `bun test src/ci/head-build-core.test.ts` green; sub-second; no
network.

## Step 5 — Wire the script

Add to `package.json` scripts: `"check:head": "bun run src/ci/check-head.ts"`.
Placed next to `check:committed`.

**Verify:** `bun run` lists `check:head`; `bun run check:typecheck` still passes.

## Step 6 — Full-suite + manual smoke, then commit

- `bun run check:typecheck && bun test` — whole suite green (AC#4).
- `bun run check:committed` — still passes, untouched (AC#4).
- Manual smoke of the real gate (NOT in the suite): run `bun run check:head`
  against the real repo HEAD — expect exit 0 on the current (building) HEAD. Note
  it does a real `bun install` + `baml:gen` + `tsc` + `bun test` in the worktree,
  so it is slow; this is the by-hand AC#1 confirmation, recorded in `progress.md`.
- Commit source + artifacts (NOT `baml_client/`, NOT the ticket file) per D-005
  staging discipline.

**Verify:** `bun run check:committed` clean after commit; tree green.

---

## Deviation protocol

If `git worktree add --detach <tmp> HEAD` or the synthetic-repo identity setup
behaves differently than assumed, record the deviation + fix in `progress.md`
before proceeding. If the real-repo manual smoke (Step 6) is too slow to run in
this session, record that it was deferred and why — the synthetic integration
test (Step 4) is the binding automated proof of AC#1/AC#3.
