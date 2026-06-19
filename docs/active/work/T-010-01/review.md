# T-010-01 — Review: check-head-isolated-build

*Handoff document. What changed, test coverage, open concerns — enough to review
without reading every diff.*

## What changed

Committed as one atomic change (source + RDSPI artifacts; `baml_client/` and the
ticket file deliberately excluded per D-005 staging discipline).

| file | action | what |
|------|--------|------|
| `src/ci/head-build-core.ts` | **create** | PURE classifier. `BuildOutcome → HeadVerdict`; `classifyBuildOutcome` (0/1/2 exit mapping), `buildStepFailed`. No fs/git/process. |
| `src/ci/check-head.ts` | **create** | IMPURE verb `buildCommittedHead` + `import.meta.main` entry. git-worktree lifecycle, optional install, build, classify, exit. |
| `src/ci/head-build-core.test.ts` | **create** | 10 tests: pure mapping + synthetic-HEAD integration. |
| `package.json` | **modify** | +1 line: `"check:head": "bun run src/ci/check-head.ts"`. |

The design mirrors E-008 (`check-committed.ts` / `committed-core.ts`) exactly:
pure core holds the judgment behind a `check:*` script; thin impure verb does the
side effects; the trigger (T-010-02, on-clear) is a separate ticket. The Central
Rule (logic in the app repo, not the trigger) is honored.

## How it works

`buildCommittedHead`: `git rev-parse --show-toplevel` (preflight) → `mkdtemp`
parent → `git worktree add --detach <parent>/head HEAD` → in that isolated tree,
optional `bun install` then `bun run check` (baml:gen → typecheck → test) →
capture exit → return a raw `BuildOutcome`. A `finally` runs `git worktree remove
--force` + `rm -rf` the parent on **every** path. `classifyBuildOutcome` maps the
outcome to exit `0` (builds) / `1` (broken HEAD — the E-007 andon) / `2`
(environment error). Because the worktree has no working-tree files, an
uncommitted dependency can no longer mask a partial commit — the gap E-010 exists
to close.

## Acceptance criteria — status

- **AC#1** (isolated build; exit non-zero iff clean-HEAD build fails; worktree
  removed every path) — **met.** Real-gate smoke on the live HEAD: exit 0, `git
  worktree list` shows only the main tree. Two integration tests assert no
  `vend-head-*` worktree survives after both a passing and a failing run.
- **AC#2** (no Docker; offline) — **met.** Only `git worktree` + `Bun.spawnSync`;
  no container runtime. Integration tests run with `install: null`, no network.
- **AC#3** (pure classifier unit-tested; synthetic broken HEAD fails, clean HEAD
  passes, reproducing E-007) — **met.** The synthetic repo commits `app.ts`
  (importing `./dep.ts`) WITHOUT `dep.ts` — the literal E-007 move — and the
  isolated build fails (exit 1), while the fully-committed HEAD passes (exit 0).
- **AC#4** (in-place `check:*` stay green; `check:committed` untouched) — **met.**
  Full suite 319 pass / 0 fail; `check-committed.ts` / `committed-core.ts`
  unchanged; only a new line added to `package.json`.

## Test coverage

- **Pure (`classifyBuildOutcome`, `buildStepFailed`):** all four outcome branches
  + both message-class assertions + exit-code mapping. Fast, no spawning.
- **Integration (`buildCommittedHead`):** broken HEAD → exit 1; clean HEAD → exit
  0; no-leak after pass; no-leak after fail; non-repo preflight → exit 2. Offline,
  sub-second (267ms for the file).
- **Manual smoke (not in suite):** real `check:head` on live HEAD → exit 0, no
  leak. Recorded in `progress.md`. Kept out of `bun test` because a real run does
  `bun install` + `baml:gen` + `tsc` + `bun test` in the worktree (slow, heavy).

Gap (intentional): the *real, heavy* path is not asserted by automated tests —
only smoked by hand. The synthetic fixture exercises the same worktree
add/run/remove machinery, so the only untested-in-CI surface is the real
install/check commands themselves (which `check:test`/`check:typecheck` already
cover in-place).

## Open concerns / notes for the next ticket

1. **T-010-02 (trigger) is the latency-sensitive half.** A real `check:head` is
   intentionally slow (full install+check in a worktree). It MUST be wired to the
   coarse **on-clear** boundary, never on-stop — the failure mode DecomposeEpic
   caught. The exit vocabulary is ready: fail-open on `2`, block/warn on `1`.
2. **`bun install` in the worktree hits the network/cache.** The real entry
   defaults to `["bun","install"]`. On a fully-offline machine with a cold cache
   this could fail at install (→ classified as a `build` failure, exit 1, a false
   andon). If that proves a problem, T-010-02 could prefer a `--frozen-lockfile`
   or offline install, or surface install-vs-check failures distinctly. Out of
   scope here.
3. **Concurrent worktrees share temp-parent namespace safely** via `mkdtemp`
   (unique per call), so parallel lisa threads won't collide. Not load-tested.
4. **No auto-repair** — by design (E-010 scope: it detects, does not fix).

## Verdict

Self-assessed complete and green. AC's all met, pure/impure doctrine and the
Central Rule honored, no worktree leak, E-007's defect class reproduced and
caught. Ready for human review and for T-010-02 to wire the trigger.
