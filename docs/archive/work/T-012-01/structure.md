# T-012-01 — Structure

_File-level blueprint. The shape of the code, not the code._

## Change inventory

| File | Action | Why |
|------|--------|-----|
| `src/ci/committed-core.ts` | **Modify** | Append `".lisa/hooks/"` to `SOURCE_PREFIXES`; extend the JSDoc with the self-exempt rationale. |
| `src/ci/committed-core.test.ts` | **Modify** | Update the R12 contract canary to the widened array; add one dirty-hook positive fixture and one non-hook-`.lisa/` negative fixture. |

No files created. No files deleted. No consumer file touched (`check-committed.ts`, `package.json`,
hook scripts, `.gitignore` files all unchanged) — this is the whole point of the R12 single-source
contract.

## `src/ci/committed-core.ts`

### The constant (line 28)

Before:
```ts
export const SOURCE_PREFIXES = ["src/", "baml_src/", "ci/"] as const;
```

After:
```ts
export const SOURCE_PREFIXES = ["src/", "baml_src/", "ci/", ".lisa/hooks/"] as const;
```

- Append-only; the three existing entries keep their position and the `as const` typing is preserved.
- The new tuple type becomes `readonly ["src/", "baml_src/", "ci/", ".lisa/hooks/"]` — the contract
  test consumes this exact literal.

### The doc comment (lines 21–27)

Add one sentence to the existing JSDoc, in the same voice, explaining the new member: the hooks fire
the gate, so they must not self-exempt; scope is `.lisa/hooks/` only (not `.lisa/`) because other
`.lisa/` paths (`signals/`, layout) are legitimately uncommitted runtime and are already gitignored.

### What does NOT change

- `parsePorcelainLine` — untouched (path extraction is prefix-agnostic).
- `classifyPorcelain` — untouched; its `SOURCE_PREFIXES.some(prefix => path.startsWith(prefix))` loop
  picks up the new prefix automatically. This is the structural payoff of code-as-contract.

## `src/ci/committed-core.test.ts`

### 1. Contract canary update (lines 72–76)

The `describe("SOURCE_PREFIXES (R12 shared contract)")` block's single test asserts the exact array.
Update its expectation to include the new member:

```ts
expect(SOURCE_PREFIXES).toEqual(["src/", "baml_src/", "ci/", ".lisa/hooks/"]);
```

Keep it an exact-array `toEqual` (do NOT relax to `toContain`) — the tripwire stays armed.

### 2. New positive fixture — dirty hook is flagged

Add inside `describe("classifyPorcelain")`, in the "scope edges" group (near the `ci/ source is in
scope` test, line 47–49), a test asserting a dirty/untracked `.lisa/hooks/` path is an offender:

```ts
test(".lisa/hooks/ source is in scope (the gate's own trigger is policed)", () => {
  expect(classifyPorcelain("?? .lisa/hooks/on-stop.sh\n")).toEqual([".lisa/hooks/on-stop.sh"]);
});
```

This is the AC's required "passing dirty-hook `classifyPorcelain` case." Using `?? ` (untracked)
mirrors the real ANDON scenario; a ` M ` variant would be equivalent.

### 3. New negative fixture — non-hook `.lisa/` stays clean

Adjacent to the positive fixture, lock the narrowness:

```ts
test("non-hook .lisa/ paths stay out of scope (signals/layout are legit runtime)", () => {
  expect(classifyPorcelain(" M .lisa/signals/x.json\n M .lisa-layout.kdl\n")).toEqual([]);
});
```

This is the AC's "while not flagging non-hook `.lisa/` paths." It would fail if scope were ever
broadened to `.lisa/`, defending Force 2 from design.md permanently.

## Ordering of changes

1. Edit the constant + doc comment in `committed-core.ts`.
2. Update the contract canary test (else `bun test` red on the now-stale exact array).
3. Add the two new fixtures.
4. Run `bun test` (all green), then `bun run lint`.
5. Live smoke: dirty-file ANDON check under `.lisa/hooks/`, then clean.
6. Commit.

Steps 1–2 must land together — the canary is intentionally coupled to the constant. Steps 2 and 3 are
independent additions and could be one edit. The implementation commits the whole set atomically since
it is a single cohesive contract change.

## Interfaces & boundaries

- **Public surface unchanged in shape:** the three exports keep their signatures. Only the *value* of
  `SOURCE_PREFIXES` widens. No new export, no new module, no new consumer wiring.
- **Boundary preserved:** pure core stays pure; impure entry stays impure and untouched. The widening
  is invisible to every layer above `classifyPorcelain`.
