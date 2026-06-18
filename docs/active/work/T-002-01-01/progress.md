# T-002-01-01 — Progress: ci-module-bootstrap

## Status: complete

The `/ci` Dagger module bootstrap shell is authored, verified, and committed to `main`.

## Steps executed (against plan.md)

| Step | Plan item | Result |
|------|-----------|--------|
| 1 | Create the six `/ci` shell files | ✅ Done — exactly six files, hand-authored |
| 2 | Prove app build unaffected | ✅ `check:typecheck` exit 0; `check:test` 229 pass / 0 fail |
| 3 | Confirm boundary by inspection | ✅ no `/ci`→app import; root tsconfig/pkg untouched |
| 4 | Confirm andon held | ✅ `dagger develop` not run on `/ci`; `ci/sdk/` absent; engine `v0.21.4` |
| 5 | Commit the shell atomically | ✅ commit `f6c9568` on `main` |
| 6 | Write progress + review | ✅ this file + `review.md` |

## What was built

```
/ci
├── dagger.json        name: ci · engineVersion: "v0.21.4" (PINNED) · sdk.source: typescript
├── package.json       { "type": "module", "dependencies": { "typescript": "5.9.3" } }
├── tsconfig.json      experimentalDecorators · @dagger.io/dagger -> ./sdk (paths)
├── .gitignore         /sdk, node_modules, .pnpm-store, .env
├── .gitattributes     /sdk/** linguist-generated
└── src/index.ts       @object() export class Ci {}  — empty thin router, no @func()
```

## Verification evidence (run on the machine)

- `find ci -type f` → exactly the six files above. `ls ci/sdk` → *No such file* (codegen
  deliberately deferred; `sdk/` is gitignored anyway).
- `bun run check:typecheck` → exit 0 (app `tsc` still `include: ["src"]`; never reaches `/ci`).
- `bun run check:test` → **229 pass / 0 fail** — identical to the pre-change baseline.
- `grep -RnE "from '\.\.|src/" ci/src` → empty: `/ci` imports nothing from the app.
- root `package.json` has **no** `workspaces`; root `tsconfig.json` still `"include": ["src"]`.

## Deviations from plan

**None of substance.** One clarification worth recording:

- **Hand-authored, no codegen (Decision 1 / andon).** The files were written by hand,
  modelled byte-for-shape on ground truth captured from a throwaway
  `dagger init --sdk=typescript` run **in `/tmp`** (since deleted — it never touched `/ci`).
  This honors "`dagger develop` was **not** run as a casual step" while still producing
  exactly what the tool emits for v0.21.4. Consequence: `ci/sdk/`, `ci/yarn.lock`, and
  `ci/node_modules/` do not exist yet — they are codegen artifacts, generated when the
  module is first developed (a reviewed step, downstream of this ticket). The
  `@dagger.io/dagger` import in `index.ts` therefore does not resolve under the `/ci`
  toolchain *yet*; this is expected for the shell and is invisible to the app (nothing in
  the app imports `/ci`). T-002-01-02 ("Compiles within the `/ci` module's own toolchain")
  owns first populating `sdk/`.

## Commit

- `f6c9568` — `T-002-01-01: /ci Dagger module bootstrap shell — Node runtime, engine
  pinned v0.21.4` (six files under `ci/**`, app side untouched).

## Handoff to T-002-01-02

- Add `src/test.ts` (`Test` sub-class spinning a Bun container → `bun run check:test`).
- Add exactly one `@func() test()` to `Ci` in `index.ts` delegating to it — nothing else.
- First populate `sdk/` via codegen at the **pinned** `v0.21.4` (no bump) so the module
  compiles in its own toolchain. Do **not** add `@dagger.io/dagger` to `package.json`
  deps — it resolves via the generated `sdk/` path-mapping.
