# Progress — T-062-02-01 init-template-kitchen-lays-emdash-astro-seed

_Phase: Implement. What got done, in plan order, with verification results and deviations._

## Status: COMPLETE — all steps done, full gate green, compile smoke passed.

## Step 1 — `src/kitchen/kitchen-overlay.ts` (new) ✅

Created the overlay module. `with { type: "text" }` imports of the authored seed files →
exported `KITCHEN_OVERLAY: readonly ScaffoldEntry[]` (13 entries, files-only). Header documents
the text-import mechanism (binary-safe / drift-free / escaping-free) and the brew-binary
constraint that ruled out a runtime fs read.

**Deviations from plan (two, both surfaced during verify):**

1. **Missed `.github/workflows/deploy.yml`** in the Structure file list (12 → **13** files).
   Caught at the first overlay load; added — it is part of the Cloudflare config-present.
2. **`tsc` rejects some extensions** that Bun loads fine. Empirically:
   - `.json`/`.md`/`.svg`/`.toml`/`.lock` text-import clean on their own; but once ANY ambient
     `declare module` exists, tsc requires a declaration for every non-native extension.
   - `.mjs`/`.astro`/`.yml`/`.gitignore`/`.md`/`.svg`/`.toml`/`.lock` are fixed by an ambient
     shim → added **`src/kitchen/seed-text-modules.d.ts`** (8 `declare module "*.ext"` → `string`).
     Verified no other `.mjs`/`.astro`/`.yml`/`.gitignore` value imports exist in `src`, so the
     wildcards collide with nothing.
   - `src/env.d.ts` is **unfixable** — tsc refuses to value-import a `.d.ts` (TS2846). It is the
     ONE file inlined as a constant (`ENV_DTS = '/// <reference types="astro/client" />\n'`, 39 B,
     escaping-free). A drift assertion in the AC test pins it to source.

**Verify:** `tsc --noEmit` clean; module loads → 13 entries, all contents non-empty (incl.
`bun.lock` 95 KB, `favicon.svg` 533 B).

## Step 2+3 — register + update existing assertions ✅

- `init-core.ts`: added the `KITCHEN_OVERLAY` value import (with a note that it is compile-time
  string constants, so the pure-core rule holds; the only type import flows back the other way and
  is erased under `verbatimModuleSyntax` → no runtime cycle); registered `kitchen: KITCHEN_OVERLAY`
  in `TEMPLATE_REGISTRY`; added `"kitchen"` to `STANDALONE_TEMPLATES`; documented why a standalone
  template legitimately owns the root `.gitignore`.
- `init-core.test.ts`: `availableTemplates()` → `["hackathon","kitchen","minimal"]`; **refined**
  the one-way-to-lisa invariant — the `.gitignore` prohibition now applies only to NON-standalone
  overlays (`isStandaloneTemplate(name)` guard); the `LISA_MARKERS` prohibition stays absolute.
- `init-effect.test.ts`: unknown-template `available` → `["hackathon","kitchen","minimal"]`.

**Verify:** `bun test src/init` → **65 pass / 0 fail**; `tsc` clean.

## Step 4 — `src/kitchen/init-kitchen.test.ts` (the AC) ✅

Guarded-live temp-dir test. Casts `runInit(emptyDir,"kitchen")` and asserts: standalone
lay-down into a non-lisa empty dir; full seed (Dish type + 1 example dish via the reused
`validateDishSeed` contract; stub storefront with no `fetch(`; Cloudflare adapter + wrangler +
package.json; base board honest-empty; one-way-to-lisa); the scaffolded `seed.json` **and**
`env.d.ts` byte-equal the authored source; a truthful all-created tally; second-run no-clobber
converge with a user edit surviving. Plus pure registry/standalone pins.

**Verify:** `bun test src/kitchen` → **14 pass / 0 fail** (4 new + 10 dish-seed).

## Step 5 — compile smoke (the brew-install reality) ✅

`bun build --compile src/cli.ts` → binary; run from a fresh empty temp dir **with `examples/`
not beside it**:

```
vend init: scaffolded --template kitchen — 30 created, 0 skipped
# tree: base vend board + .emdash/{seed.json,README.md} + astro app + .github/.../deploy.yml + …
vend init: scaffolded --template kitchen — 0 created, 30 skipped   # second run converges
```

Proves the text-embedded bytes survive into the single binary — the disqualifier for a runtime
`examples/` read. (Manual; no CI compile in scope — see Review.)

## Full gate

`bun test` (whole suite) → **1458 pass / 1 skip / 0 fail**. `tsc --noEmit` clean. No lint script
in this repo. No existing behavior changed (control flow untouched: `runInit` /
`applyInitScaffold` / `cli.ts` are byte-identical).

## Files

- **new:** `src/kitchen/kitchen-overlay.ts`, `src/kitchen/seed-text-modules.d.ts`,
  `src/kitchen/init-kitchen.test.ts`
- **modified:** `src/init/init-core.ts`, `src/init/init-core.test.ts`,
  `src/init/init-effect.test.ts`
