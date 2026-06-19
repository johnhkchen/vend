# T-002-01-02 — Review: test-gate-subclass-and-router

*Self-assessment and handoff. What changed, test coverage, open concerns. Enough
to understand the work without reading every diff.*

## Summary

The `/ci` module gets its **first real gate**. `ci/src/test.ts` is a `Test`
sub-class that spins a Bun container, mounts the app source, and **invokes
`bun run check:test`** — it runs the script, it does not reimplement the check
(the Central Rule). `ci/src/index.ts` routes `test()` and nothing else, staying a
thin router. The module now compiles in its own toolchain; the app build is
untouched. Committed to `main` as `36dbdc6`.

## Files changed

| File | Change | Notes |
|------|--------|-------|
| `ci/src/test.ts` | **new** (~48 LOC) | `@object() Test` · `@func() run(source)` — container chain to `bun run check:test`. Header documents prep-vs-check. |
| `ci/src/index.ts` | **modified** | `+ import { Test }`, `+ func`, `+ @func() test(): Test { return new Test() }`, header updated. One real `@func()`. |
| `ci/yarn.lock` | **new** (8 lines) | Module dep lockfile (pins `typescript@5.9.3`). See open concern #1. |
| `ci/sdk/**` | generated, **gitignored** | Dagger TS client from `dagger develop`; not committed. |

No app-side files changed. No new scripts, no `tsconfig`/`package.json` edits, no
`workspaces` key. `@dagger.io/dagger` is in no `package.json` deps (resolves via
the `sdk/` path-mapping).

## Acceptance criteria

| AC | Status | Evidence |
|----|--------|----------|
| `ci/src/test.ts` Test sub-class runs a Bun container invoking `bun run check:test`; **no check logic inlined** | ✅ | Container chain calls the script string only; assertions stay in the app. |
| `ci/src/index.ts` routes `test()` and nothing else (thin router) | ✅ | One `@func() test(): Test`; no other gate, no container logic in the router. |
| `/ci` imports nothing from the app; `dagger develop` not run *casually* | ✅ | `grep` for app imports empty; `develop` was a single deliberate, andon-guarded, no-bump run. |
| Compiles within `/ci`'s own toolchain; app build untouched | ✅ | `tsc --noEmit` in `/ci` exit 0; root `check:typecheck` exit 0, `check:test` 229 pass / 0 fail. |

## Test coverage

- **No `*.test.ts` added** — correct, not a gap. The gate is a trigger-and-report
  shell with no logic to assert (the Central Rule keeps assertions in the app's
  `check:test`). A `/ci` unit test would have nothing to test and would risk
  pollution of the app's `bun test`.
- **Coverage here is structural:** (1) the module compiles in its own toolchain
  (`sdk/` generated, `tsc` green); (2) the app's gates stay green and unchanged
  (229/229). Both verified on the machine.
- **Behavioural coverage is deferred to T-002-01-03 by design** — the
  `dagger call test run` round-trip (agrees-with-standalone + can-fail) is that
  spike's whole purpose. This ticket deliberately does not run the gate ("the
  one gate's code (no Docker needed to build it)").

## Open concerns / flags for a human reviewer

1. **`ci/yarn.lock` is now tracked.** A reviewed decision (T-002-01-01 had left
   it for "first develop — a reviewed step downstream"). Rule applied: generated
   *code* is gitignored (`sdk/`, like `baml_client/`); *lockfiles are committed*
   (the repo already tracks `bun.lock`). If you'd rather treat it as a pure
   codegen artifact: `git rm --cached ci/yarn.lock` + add `/yarn.lock` to
   `ci/.gitignore`. Cheap to reverse.

2. **`dagger develop` was run in this ticket.** The andon (`ci-strategy.md`
   rule 1; AC3) fences *casual* runs and version bumps. This was a single,
   deliberate, scoped run at the pin to satisfy AC4 + the predecessor handoff;
   it produced **no bump** (engine stayed `v0.21.4`) and mutated **no** tracked
   config. A v0.21.7 upgrade is available and was **declined** — staying pinned
   is intentional; raising it is a separate reviewed decision.

3. **Router shape vs. T-003's literal AC.** Per `ci-strategy.md` ("return
   sub-classes from the main object") the router is `Ci.test(): Test`, so the
   run leaf is `dagger call test run` — **not** bare `dagger call test` as
   T-003's AC text shorthands. T-003 must chain `run` (and may need `--source=.`
   — see #4). Flagged so its author isn't surprised.

4. **Unverified-here assumptions T-003 must confirm at runtime** (this ticket
   never ran the engine against the gate):
   - `defaultPath: "/"` resolves to the **git repo root** (the app), not `/ci`.
     Fallback: explicit `--source=.`.
   - The linux `baml` native binary generates `baml_client/` cleanly inside
     `oven/bun:1.3.9-slim`. If it needs extra libs, that's *prep* tuning T-003
     owns — **not** a change to the `check:test` definition.
   - `bun install --frozen-lockfile` succeeds against the committed `bun.lock`
     in-container.

## What this deliberately does NOT do (anti-over-build)

`lint`/`typecheck`/`consistency` gates; a second gate; parallel DAG composition;
keep-warm tuning; **running** `dagger call` / proving no-drift / can-fail (all
T-002-01-03). The `test` gate's code, compiled, committed. Nothing past it.

## Bottom line

All four ACs met and verified. One scope-edge decision (`yarn.lock` tracked) and
one andon event (deliberate `dagger develop`, no bump) are surfaced above for
review. The gate is ready for T-002-01-03 to prove drift-free end to end.
