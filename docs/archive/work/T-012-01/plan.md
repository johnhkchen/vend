# T-012-01 — Plan

_Ordered, independently verifiable steps. Testing strategy + verification criteria._

## Step 1 — Widen the constant and its doc comment

**Edit** `src/ci/committed-core.ts`:
- Append `".lisa/hooks/"` to `SOURCE_PREFIXES`.
- Add one JSDoc sentence explaining the self-exempt rationale (hooks fire the gate → must be policed;
  scope is `.lisa/hooks/` only, not `.lisa/`, because other `.lisa/` paths are gitignored runtime).

**Verify:** `bun run build` typechecks (the `as const` tuple still well-typed). Expect the contract
test to go RED here — that is the canary working, fixed in Step 2.

## Step 2 — Update the R12 contract canary test

**Edit** `src/ci/committed-core.test.ts`, the `SOURCE_PREFIXES (R12 shared contract)` block:
- Change the expected array to `["src/", "baml_src/", "ci/", ".lisa/hooks/"]`.
- Keep `toEqual` (exact) — do not relax to `toContain`.

**Verify:** the contract test passes again.

## Step 3 — Add the dirty-hook positive fixture

**Edit** `src/ci/committed-core.test.ts`, `classifyPorcelain` describe, scope-edges group:
- Add a test asserting `classifyPorcelain("?? .lisa/hooks/on-stop.sh\n")` → `[".lisa/hooks/on-stop.sh"]`.

**Verify:** new test passes (this is the AC's required dirty-hook case).

## Step 4 — Add the non-hook-`.lisa/` negative fixture

**Edit** same describe block:
- Add a test asserting `classifyPorcelain(" M .lisa/signals/x.json\n M .lisa-layout.kdl\n")` → `[]`.

**Verify:** new test passes (the AC's "not flagging non-hook `.lisa/` paths"); confirms scope stays
narrow.

## Step 5 — Full suite + lint

- `bun test` — all tests green, including the 12 pre-existing classify cases (no regression) and the
  2 new ones.
- `bun run lint` — clean.

**Verify:** zero failures, zero lint errors.

## Step 6 — Live ANDON smoke (impure entry inherits scope)

Proves `check-committed.ts` picks up the widened scope with no edit:
1. Create a throwaway file: `echo x > .lisa/hooks/__andon_probe.sh`.
2. `bun run check:committed` → expect **exit 1**, stderr lists `.lisa/hooks/__andon_probe.sh`.
3. `rm .lisa/hooks/__andon_probe.sh`.
4. `bun run check:committed` → expect **exit 0** ("ok — all source committed"), assuming the only
   remaining dirty paths are docs (out of scope).

**Verify:** exit 1 with the probe listed, then exit 0 after removal. (Note: the work-artifact docs and
ticket file are under `docs/`, which is NOT in scope, so they will not interfere with the exit-0 check.)

## Step 7 — Commit

Atomic commit of the two modified source/test files. The work-artifact markdown under
`docs/active/work/T-012-01/` is out of gate scope but should be committed alongside per project
convention (lisa sweeps artifacts). Commit message names the AC closed and E-012.

## Testing strategy summary

| Concern | Covered by | Type |
|---------|-----------|------|
| Dirty hook is flagged | Step 3 fixture | pure unit |
| Non-hook `.lisa/` stays clean | Step 4 fixture | pure unit |
| Contract changed deliberately | Step 2 canary | pure unit |
| No regression on existing scope | Step 5 `bun test` | pure unit (suite) |
| Impure entry inherits scope (exit 1 / exit 0) | Step 6 live smoke | integration smoke |
| Typing intact | Step 1 `bun run build` | typecheck |

No integration test is added to the committed suite — the live ANDON behaviour is smoke-only, matching
how `check-committed.ts` itself is "smoke-only, not unit-tested" (its own header comment). The pure
fixtures are the durable regression guard.

## Acceptance-criteria trace

> With a dirty/untracked file under `.lisa/hooks/`, `bun run check:committed` exits 1 and lists that
> path — **Step 6 (1)**.
> a clean tree with all hooks committed exits 0 — **Step 6 (4)**.
> one-line edit to `SOURCE_PREFIXES` (no consumer re-lists scope) — **Step 1** (only the constant +
> its own test change; no consumer touched).
> `committed-core.test.ts` gains a passing dirty-hook `classifyPorcelain` case — **Step 3**.
> while not flagging non-hook `.lisa/` paths — **Step 4**.

All five clauses mapped.

## Rollback

Single-commit revert restores the prior scope; no migration, no state, no data. Risk is minimal — the
change is additive to a pure constant with full test coverage on both the new positive and negative
edges.
