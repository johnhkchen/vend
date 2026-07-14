# T-033-01 — Plan: precommit-policy-core

*Ordered, independently-verifiable steps. Testing strategy and verification criteria.
This ticket is a single pure leaf module + its test → one atomic commit.*

## Testing strategy

- **Unit tests only.** Both exports are pure/total functions of plain data → an ordinary `bun:test`
  pure-function test, exactly the `committed-core.test.ts` posture. No integration test, no live
  spawn, no git — there is nothing impure in this ticket to integration-test (that arrives in
  T-033-02's `.githooks/pre-commit` live proof).
- **tsc is a test too.** `check:typecheck` is load-bearing here: it proves (a) purity (no impure
  imports compile in), and (b) exhaustiveness — the `switch (reason)` with no `default` + `assertNever`
  only compiles because all three reasons are handled. A regression that drops a case fails `tsc`.
- **Coverage target:** every branch of both functions.
  - `classifyPrecommit`: green, tests-failed, could-not-run (×2: with/without stderr), plus the two
    neutralizer edges (non-1 non-zero exit; `!ran` with stray exitCode).
  - `hookInstallState`: active, not-installed (null/undefined/""), trailing-slash, unexpected-path.
  - `HOOKS_DIR` contract assertion.

## Verification criteria (the ticket AC, made executable)

1. `src/ci/precommit-core.ts` exports pure `classifyPrecommit(run)` → `{ block, reason, message }`
   with the three cases (green allow / tests-failed block+named / could-not-run allow). No I/O. →
   verified by reading the module (no imports) + the three passing fixtures.
2. Pure `hookInstallState(hooksPath)` → `{ active, message }`, active iff `core.hooksPath` points at the
   committed hooks dir, else a `hooks:install` message. → verified by the active/not-installed fixtures.
3. Unit-tested per `committed-core.test.ts`; all three classify cases + both hook cases; `reason` union
   exhaustively switched (tsc proves it); `bun run check:*` green. → verified by steps 3–4 below.

## Steps

### Step 1 — Author `src/ci/precommit-core.ts`

Write the module per `structure.md`: header comment, the three types, `classifyPrecommit`,
`HOOKS_DIR`, `HookState`, `hookInstallState`, private `verdictMessage` (the no-`default` switch),
private `tail`, private `assertNever`.

*Self-check before moving on:* the file has **zero `import` statements** (pure leaf); no `Bun.`,
`process.`, `readFile`, `spawn`, or git tokens appear; `ran` is checked **before** `exitCode`.

### Step 2 — Author `src/ci/precommit-core.test.ts`

Write the test per `structure.md`: three `describe` blocks, AC fixtures flagged with `// AC:` comments,
exact-value assertions (`toBe`/`toEqual`), `message`-contains assertions via
`expect(...).toContain(...)` for the named-failure and `hooks:install`-nudge requirements.

### Step 3 — `bun run check:typecheck`

Expect clean. This proves purity + exhaustiveness. If `tsc` complains the `assertNever(reason)` is
unreachable or a reason is unhandled, fix the switch — do not add a `default`.

### Step 4 — `bun run check:test`

Run the full suite (not just the new file) to confirm no regression and the new fixtures pass. Expect
the new test's cases green and the prior ~912 tests still green.

### Step 5 — Commit (single atomic commit)

Both files together. Message (Conventional Commits, matching repo history style):

```
feat(ci): precommit-core — the pure per-commit green-gate policy (T-033-01)

classifyPrecommit(run) → {block,reason,message}: green allow / tests-failed
fail-closed (names the failure) / could-not-run fail-open (mirrors on-stop).
hookInstallState(path) → {active,message} guards core.hooksPath == .githooks
(E-012 spirit). Pure leaf; reason union exhaustively switched, tsc proves it.
Mirrors committed-core.ts. T-033-02 supplies the impure invoker.
```

*(The footer `Co-Authored-By` line is appended per the harness git convention.)*

### Step 6 — Confirm working tree clean

`git status --porcelain` over `src/` empty → the E-008 on-stop gate will pass. The work artifacts under
`docs/active/work/T-033-01/` are docs, outside `SOURCE_PREFIXES`, so they don't gate the commit (but
will be committed too for the record per lisa's flow).

## Risk / deviation watch

- **Exhaustiveness idiom friction.** If `tsc`'s control-flow analysis flags the post-switch
  `return assertNever(reason)` as unreachable code under the project's config, fall back to the
  `head-build-core` if/return narrowing idiom (D3 option A) and document the deviation here. The AC says
  "exhaustively switched … tsc proves every case" — option A still satisfies "tsc proves," so this is a
  safe, AC-compliant fallback. **(Resolved at Implement: see progress.md.)**
- **`stderr` undefined handling.** `tail(undefined)` must return `""`, never `"undefined"`. Covered by
  the no-stderr fixtures.
- **Trailing-slash normalization** must strip only ONE trailing slash and not mangle `".githooks"`
  (no slash). The regex `/\/$/` is safe; covered by the trailing-slash fixture.

## Why one commit, not several

The module and its test are a single indivisible unit of behavior — neither is meaningful alone, and
the repo's per-commit-green discipline (the very thing E-033 enforces) means the commit must be green,
which requires both files present. Splitting would create an intermediate red/incomplete commit, which
this epic exists to prevent. One atomic, green commit.
