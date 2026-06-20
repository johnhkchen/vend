# T-033-01 — Review: precommit-policy-core

*Handoff document. What changed, test coverage, open concerns. What a reviewer needs to
understand the work without reading every diff.*

## Summary

Delivered the **pure policy core** of E-033's per-commit green gate: `src/ci/precommit-core.ts`. Two
pure functions decide, in data, what a test-run outcome and a configured `core.hooksPath` MEAN —
leaving all I/O (spawning tests, reading git config, blocking the commit) to T-033-02's invoker. Built
to mirror the established `src/ci/` pure-core / thin-invoker split (`committed-core.ts`,
`head-build-core.ts`). Shipped in one atomic, green commit.

## Files changed

| File | Action | Notes |
|---|---|---|
| `src/ci/precommit-core.ts` | **created** (~150 lines) | `classifyPrecommit`, `hookInstallState`, `HOOKS_DIR`, types, private `verdictMessage`/`tail`/`assertNever` |
| `src/ci/precommit-core.test.ts` | **created** (~115 lines) | 13 cases across 3 `describe` blocks |
| `docs/active/work/T-033-01/*.md` | **created** | research, design, structure, plan, progress, review |

Commit: `c71ae0c — feat(ci): precommit-core — the pure per-commit green-gate policy (T-033-01)`.
No files modified or deleted; no `package.json`, hook, or git-config changes (all T-033-02).

## Public surface delivered

- `classifyPrecommit(run: PrecommitRun): PrecommitVerdict` — `{ ran, exitCode, stderr? }` →
  `{ block, reason, message }`:
  - `ran && exitCode === 0` → `{ block:false, reason:"green" }`
  - `ran && exitCode !== 0` → `{ block:true, reason:"tests-failed", message }` — **fail-closed**, names
    the failure (exit code + stderr tail).
  - `!ran` → `{ block:false, reason:"could-not-run", message }` — **fail-open**, visible note.
- `hookInstallState(hooksPath: string | null | undefined): HookState` — active iff the value (one
  trailing slash normalized) equals `HOOKS_DIR`; else a `hooks:install` nudge.
- `HOOKS_DIR = ".githooks" as const` — the R12 shared contract T-033-02 derives from.

## Acceptance criteria — all met

- ✅ **AC1** — pure `classifyPrecommit` with the three cases (green allow / tests-failed block+named /
  could-not-run allow). No I/O: the module has zero imports; no spawn/fs/git/process tokens.
- ✅ **AC2** — pure `hookInstallState` → `{ active, message }`, active iff `core.hooksPath` points at the
  committed dir, else a "run `bun run hooks:install`" message.
- ✅ **AC3** — unit-tested per the `committed-core.test.ts` precedent: all three `classifyPrecommit`
  cases + both `hookInstallState` cases; `reason` union exhaustively switched (no `default`; `tsc`
  proves it via `assertNever`). `bun run check:*` green.

## Test coverage

- **`bun run check:typecheck`** — clean. Doubly load-bearing: proves purity (no impure import compiles
  in) AND exhaustiveness (the no-`default` `switch (reason)` + `assertNever` only compiles because all
  three reasons are handled).
- **`bun test`** — new file **13 pass / 0 fail**; full suite **925 pass / 0 fail** across 60 files. No
  regression (suite grew by exactly the 13 new cases).
- **Branch coverage:** every branch of both functions exercised —
  - classify: green, tests-failed (with + without stderr), could-not-run (with + without stderr), the
    non-1 non-zero edge, the `!ran`-with-stray-exitCode neutralizer, and two `not.toContain("undefined")`
    guards.
  - hookInstallState: active, unset (null/undefined/""), trailing-slash, unexpected-path.
  - `HOOKS_DIR` contract assertion.

## Open concerns / limitations

1. **No live execution yet — by design.** This ticket is pure policy; nothing actually runs tests or
   blocks a commit. The gate is inert until T-033-02 wires `.githooks/pre-commit`, `hooks:install`, and
   `check:hooks`. Until then, the per-commit green discipline is **specified but not enforced** — the
   E-033 gap is not closed by this ticket alone. This is the intended T-033-01 → T-033-02 split, not a
   defect, but a reviewer should not mistake "core merged" for "gate live."
2. **`hookInstallState` string-match is deliberately shallow.** It does an exact compare (after one
   trailing-slash strip) against `.githooks`. It does NOT resolve absolute paths, `./`-prefixes, or
   symlinks — purity forbids the fs access that would require. Consequence: an exotic-but-valid
   `core.hooksPath` (e.g. an absolute path to the same dir) reads as *not active* and nudges install.
   This **fails safe** (never falsely claims active) but could mildly annoy a non-standard setup. If
   T-033-02's installer always uses the canonical `git config core.hooksPath .githooks`, this never
   surfaces. Flagged for the T-033-02 author to keep the install canonical.
3. **`stderr` tail is whitespace-collapsed, not parsed.** The message surfaces a single-spaced tail of
   captured output, not a structured failing-test summary. This satisfies the AC ("message names the
   failure") and mirrors head-build-core's `detail` field, but the richness of the andon depends on
   what T-033-02 captures and passes in. No test-name extraction is attempted here (out of scope, and it
   would couple the pure core to a test-runner's output format).
4. **`assertNever` introduces the module's one `throw`.** Reachable only on a TS-impossible value (a
   `reason` added without a switch arm), so it never fires on valid runtime data and does not violate
   the "returned data, never thrown" house rule. Noted explicitly because the sibling cores
   (`committed-core`, `head-build-core`) have *no* throw at all — this is a deliberate, documented
   departure to get the stronger exhaustiveness guarantee the ticket asked for.

## Nothing requires human intervention

No critical issues. The work is self-contained, green, and committed. The natural next step is
T-033-02 (the impure invoker), which `depends_on` this ticket and now has its `HOOKS_DIR` contract and
both classifiers available.
