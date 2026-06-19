# T-012-01 — Design

_Decide how to widen the gate scope to `.lisa/hooks/`. Grounded in research.md._

## The decision in one line

Append `".lisa/hooks/"` to the `SOURCE_PREFIXES` tuple in `src/ci/committed-core.ts`, and update the
two test fixtures that pin the contract — nothing else. This is the "one-line edit" the constant's own
doc comment anticipated.

## Forces

1. **R12 single-source contract.** Scope must change in exactly one place. Any consumer that re-lists
   scope would be a contract violation the AC explicitly bans ("no consumer re-lists scope").
2. **Narrow, not broad.** Scope must catch dirty hooks but NOT other `.lisa/` paths (signals, layout,
   future state). The existing `.vend/menu.json`-stays-clean test documents that `.`-dir runtime is
   intentionally out of scope; the new cut must preserve that spirit.
3. **The canary test must stay honest.** `SOURCE_PREFIXES (R12 shared contract)` asserts the exact
   array. It is designed to fail on any change, forcing deliberate updates. We update it; we do not
   weaken it to a `.includes()` check.
4. **Pure logic untouched.** `classifyPorcelain` already drives entirely off the constant via
   `startsWith`. Adding a prefix needs zero logic change — the smallest, safest possible edit.

## Options considered

### Option A — Add `".lisa/hooks/"` to `SOURCE_PREFIXES` (CHOSEN)

```ts
export const SOURCE_PREFIXES = ["src/", "baml_src/", "ci/", ".lisa/hooks/"] as const;
```

- **Pro:** Exactly the documented widening path. One constant edit + lockstep test updates. No
  consumer touched. `check-committed.ts` inherits the scope through `classifyPorcelain` for free.
- **Pro:** Trailing-slash prefix is precise — matches `.lisa/hooks/on-stop.sh`, never `.lisa/signals/`,
  `.lisa-layout.kdl`, or a sibling like `.lisa/hooksZZZ`.
- **Pro:** Keeps the offender-list semantics identical (sorted, deduped, KEEP-not-deny).
- **Con:** None material. The only "cost" is remembering to update the contract canary test, which is
  the test's whole purpose.

### Option B — Broaden to `".lisa/"` (REJECTED)

```ts
export const SOURCE_PREFIXES = [..., ".lisa/"]
```

- **Why rejected:** Over-broad. `.lisa/` may legitimately hold uncommitted runtime/state. `.lisa/.gitignore`
  already ignores `signals/`, but a `.lisa/` prefix would police any future un-ignored state dir and
  could ANDON-block on transient files that are correctly uncommitted. The ticket scope is explicitly
  "`.lisa/hooks/` only — NOT all of `.lisa/`" (S3100 investigation note). Violates Force 2.

### Option C — A separate `HOOK_PREFIXES` constant + extra consumer wiring (REJECTED)

- **Why rejected:** Introduces a second scope source the classifier would have to union in. Directly
  violates Force 1 (R12 single contract) and the AC ("no consumer re-lists scope"). More code, more
  surface, zero benefit over folding the prefix into the one existing tuple.

### Option D — Weaken the contract canary to a membership check (REJECTED)

- Change the R12 test from exact-array equality to `expect(SOURCE_PREFIXES).toContain(...)` so it stops
  breaking on additions.
- **Why rejected:** The exact-array assertion is a deliberate tripwire — it makes every scope change a
  conscious, reviewed act. Loosening it to membership removes the very safety the contract test
  provides. We keep it exact and update it.

## Chosen approach — details

1. **Constant:** append `".lisa/hooks/"` as the last element. Ordering is cosmetic (`classifyPorcelain`
   sorts offenders independently), but appending keeps the diff minimal and the existing three entries
   untouched.

2. **Doc comment:** the constant's JSDoc already explains `baml_client/` exclusion and the one-line
   widening promise. Add a short clause noting `.lisa/hooks/` is in scope because the hooks fire the
   gate and must not self-exempt — making the self-referential rationale legible to the next reader.

3. **Contract canary test** (`SOURCE_PREFIXES (R12 shared contract)`): update the expected array to
   `["src/", "baml_src/", "ci/", ".lisa/hooks/"]`.

4. **New positive fixture** (the AC's "dirty-hook `classifyPorcelain` case"): an untracked/dirty path
   under `.lisa/hooks/` is flagged. Use a realistic porcelain line, e.g.
   `"?? .lisa/hooks/on-stop.sh\n"` → `[".lisa/hooks/on-stop.sh"]`.

5. **New negative fixture** (the AC's "while not flagging non-hook `.lisa/` paths"): a dirty `.lisa/`
   path OUTSIDE `hooks/` stays clean, e.g. `" M .lisa/signals/x.json\n M .lisa-layout.kdl\n"` → `[]`.
   This locks Force 2 into the suite so a future broadening to `.lisa/` would break a test.

## Verification strategy (grounded, not assumed)

- **Pure:** the two new fixtures prove flag-hooks / spare-non-hooks at the classifier level — no git
  needed. The full `bun test` proves no regression in the other 12 classify cases.
- **Live ANDON:** create a throwaway file under `.lisa/hooks/`, run `bun run check:committed`, expect
  exit 1 with the path listed; remove it, expect exit 0. This proves the impure entry inherits the
  widened scope through `classifyPorcelain` with no edit to `check-committed.ts`.

## Out of scope

- No change to `parsePorcelainLine`, `check-committed.ts`, package.json, or any hook script.
- No change to `.lisa/.gitignore` or root `.gitignore`.
- No broadening beyond `.lisa/hooks/`.
