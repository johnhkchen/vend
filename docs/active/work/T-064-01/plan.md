# T-064-01 — Plan

> Ordered, independently verifiable steps to ship Option C. Commit boundaries marked.
> Gate: `bun run check` (= `baml:gen && tsc --noEmit && bun test`).

## Testing strategy

- **Pure core** (`init-core.test.ts`) — ordinary pure-function tests: the `minimal`
  overlay resolves empty, `isStandaloneTemplate` membership, the standalone⊆registry
  invariant, and `planTemplate([],base,[]) == planInit([],base)`.
- **Effect** (`init-effect.test.ts`) — guarded-live over real `mkdtemp` temp dirs (the
  existing discipline): empty-dir standalone scaffold, no-clobber converge, no-Doppler
  guard (env scrub), no-repo guard (no `.git`), and gate-still-holds regressions.
- **Verification criteria** map 1:1 to the AC clauses:
  - "writes the workspace files" → Step 4 test (1).
  - "no-clobber converge" → Step 4 test (2).
  - "absence of any repo/Doppler dependency" → Step 4 tests (3)+(4).
- No integration/binary test here — the compiled-binary end-to-end is T-062-02 /
  T-065-01; this ticket proves the *seam* at the `runInit` boundary.

## Step 1 — Core: registry entry + standalone policy

**File:** `src/init/init-core.ts`
- Add `minimal: []` to `TEMPLATE_REGISTRY` with the placeholder comment.
- Add `STANDALONE_TEMPLATES: ReadonlySet<string> = new Set(["minimal"])` and
  `isStandaloneTemplate(name): boolean` right after the registry, before
  `availableTemplates`.
- Extend the "ONE-WAY TO LISA" header note: standalone is a gate relaxation, writes no
  lisa-owned file.

**Verify:** `tsc --noEmit` clean. `availableTemplates()` now `["hackathon","minimal"]`
(checked in Step 2).

## Step 2 — Core tests

**File:** `src/init/init-core.test.ts`
- Update `:227` → `expect(availableTemplates()).toEqual(["hackathon", "minimal"])`.
- Add `describe("STANDALONE_TEMPLATES / minimal (T-064-01)")`:
  - `resolveTemplate("minimal")` defined and `toEqual([])`.
  - `isStandaloneTemplate`: `"minimal"`→true, `"hackathon"`→false, `"nope"`→false.
  - invariant: `for (const n of STANDALONE_TEMPLATES) expect(n in TEMPLATE_REGISTRY)`.
  - `expect(planTemplate([], SCAFFOLD_MANIFEST, [])).toEqual(planInit([],
    SCAFFOLD_MANIFEST))`.
- Import additions: `STANDALONE_TEMPLATES`, `isStandaloneTemplate`, `planInit`,
  `planTemplate`, `SCAFFOLD_MANIFEST` (confirm which are already imported).

**Verify:** `bun test src/init/init-core.test.ts` green. Existing `:230`/`:241`
invariant loops still pass (empty overlay contributes nothing).

**Commit A:** `feat(T-064-01): minimal standalone template + isStandaloneTemplate (pure)`

## Step 3 — Effect: `runInit` gate bypass

**File:** `src/init/init-effect.ts`
- Add `isStandaloneTemplate` to the `./init-core.ts` import.
- Rewrite `runInit` per Structure: resolve `overlay` first (unknown ⇒ refuse), compute
  `standalone`, gate only when `!standalone && !isLisaProject`, then apply
  `mergeManifests(base, overlay ?? [])`-equivalent (overlay present ⇒ merge, else base).
- Update the `runInit` doc-comment + the header comment: the E-061 standalone clause and
  the reorder note (an unknown template refuses before the gate now).

**Verify:** `tsc --noEmit` clean; existing effect tests still green
(`bun test src/init/init-effect.test.ts` — except the `:282` expectation, fixed next).

## Step 4 — Effect tests: the AC block

**File:** `src/init/init-effect.test.ts`
- Update `:282` → `available: ["hackathon", "minimal"]`.
- Add `describe("runInit — standalone template, no clone / no Doppler (T-064-01)")` with
  a bare-dir helper `mkdtemp(join(tmpdir(), "vend-init-standalone-"))`:
  1. scaffold: assert `!isLisaProject(await readdir(dir))` first; `runInit(dir,
     "minimal")` → `scaffolded`; all `SCAFFOLD_MANIFEST` paths exist; created length ==
     manifest length, skipped == []; board+archive honest-empty (`countDemandRows` 0).
  2. no-clobber converge: re-run → `created: []`, skipped length == manifest length; a
     pre-edited `docs/knowledge/vision.md` survives byte-identical.
  3. no Doppler: capture `process.env` Doppler keys, delete them, `runInit(dir,
     "minimal")` → `scaffolded`, restore in `finally`.
  4. no repo: after the run assert `!exists(join(dir, ".git"))`.
  5. gate holds: bare `runInit(dir)` → `not-lisa`; `runInit(dir, "hackathon")` →
     `not-lisa`.
- Reuse the file's existing `exists` helper and imports; add `isLisaProject`,
  `countDemandRows` to the `./init-core.ts` import if absent.

**Verify:** `bun test src/init/init-effect.test.ts` green.

**Commit B:** `feat(T-064-01): runInit standalone-template gate bypass + no-clone/no-Doppler tests`

## Step 5 — Full gate

- `bun run check` — `baml:gen`, `tsc --noEmit`, full `bun test` all green.
- Sanity: nothing else in the repo asserts `availableTemplates()`/`available:
  ["hackathon"]` beyond the two updated sites (confirmed in Research grep).

**Commit C (if needed):** fold into Commit B if Steps 3–4 land together.

## Rollback / blast-radius notes

- All changes are additive except the two mechanical expectation updates and the
  `runInit` reorder. If the reorder surprises a downstream consumer, the fallback is to
  keep gate-first and instead special-case `standalone` before it — same outcome, but the
  reorder is cleaner and the untested non-lisa+unknown combo improvement is intentional.
- No migration, no data shape change, no CLI/UX change.
