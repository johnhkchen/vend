# Structure — T-062-02-01 init-template-kitchen-lays-emdash-astro-seed

_Phase: Structure. The file-level blueprint — what is created/modified, the interfaces, the
ordering. Not code; the shape of the code._

## Change set at a glance

| File | Op | Why |
|------|----|-----|
| `src/kitchen/kitchen-overlay.ts` | **create** | Text-import the 12 seed files → export `KITCHEN_OVERLAY: readonly ScaffoldEntry[]`. |
| `src/init/init-core.ts` | **modify** | Register `kitchen: KITCHEN_OVERLAY`; add `"kitchen"` to `STANDALONE_TEMPLATES`; refine the `.gitignore` comment. |
| `src/kitchen/init-kitchen.test.ts` | **create** | The AC: cast `vend init --template kitchen` into an empty dir; full-seed + no-clobber + standalone. |
| `src/init/init-core.test.ts` | **modify** | Update `availableTemplates()` expectation; scope the `.gitignore` invariant to non-standalone overlays. |
| `src/init/init-effect.test.ts` | **modify** | Update the unknown-template `available` list to include `kitchen`. |

No change to `init-effect.ts` or `cli.ts` — the standalone+overlay control flow is generic and
already routes a new template name end-to-end.

## New module — `src/kitchen/kitchen-overlay.ts`

**Purpose.** Own the kitchen template's overlay manifest, sourcing each authored seed file via a
`with { type: "text" }` import so the bytes embed in the compiled binary (and stay structurally
drift-free). Pure: exports a plain `ScaffoldEntry[]` of compile-time string constants.

**Imports (text — relative to `src/kitchen/`, into `../../examples/templates/kitchen-seed/`):**

```
seedJson      ← .emdash/seed.json
emdashReadme  ← .emdash/README.md
pkgJson       ← package.json
astroConfig   ← astro.config.mjs
wranglerToml  ← wrangler.toml
indexAstro    ← src/pages/index.astro
envDts        ← src/env.d.ts
faviconSvg    ← public/favicon.svg
tsconfig      ← tsconfig.json
gitignore     ← .gitignore
readmeStack   ← README-STACK.md
bunLock       ← bun.lock
```

Each import: `import seedJson from "../../examples/templates/kitchen-seed/.emdash/seed.json" with { type: "text" };`
Plus `import type { ScaffoldEntry } from "../init/init-core.ts";` (type-only — no value cycle).

**Export.**

```
export const KITCHEN_OVERLAY: readonly ScaffoldEntry[] = [
  { kind: "file", path: ".emdash/seed.json",            contents: seedJson },
  { kind: "file", path: ".emdash/README.md",            contents: emdashReadme },
  { kind: "file", path: "package.json",                 contents: pkgJson },
  { kind: "file", path: "astro.config.mjs",             contents: astroConfig },
  { kind: "file", path: "wrangler.toml",                contents: wranglerToml },
  { kind: "file", path: "src/pages/index.astro",        contents: indexAstro },
  { kind: "file", path: "src/env.d.ts",                 contents: envDts },
  { kind: "file", path: "public/favicon.svg",           contents: faviconSvg },
  { kind: "file", path: "tsconfig.json",                contents: tsconfig },
  { kind: "file", path: ".gitignore",                   contents: gitignore },
  { kind: "file", path: "README-STACK.md",              contents: readmeStack },
  { kind: "file", path: "bun.lock",                     contents: bunLock },
];
```

**Header comment** must record: the text-import mechanism + why (embeds in `bun build --compile`,
no drift, no escaping); the brew-binary constraint that ruled out a runtime fs read; that the
`path`s are project-root-relative scaffold targets (the `examples/...` source path is *not* the
scaffold path); files-only (the effect's `mkdir(dirname)` makes parents); purity note. Ordering is
cosmetic only — `applyInitScaffold` creates parents per-file — but keep config-before-source for
readability.

## Modified — `src/init/init-core.ts`

1. **Import** the overlay near the other registry data:
   `import { KITCHEN_OVERLAY } from "../kitchen/kitchen-overlay.ts";`
2. **Register** in `TEMPLATE_REGISTRY` (one line + a short comment):
   `kitchen: KITCHEN_OVERLAY,` — note it is the E-062 standalone EmDash+Astro seed; the cook gets
   base board + storefront seed; it writes a root `.gitignore` legitimately (standalone, no lisa
   project to clobber — see `STANDALONE_TEMPLATES`).
3. **Mark standalone:** `STANDALONE_TEMPLATES = new Set(["minimal", "kitchen"])`. Comment that
   kitchen scaffolds a fresh app workspace into an empty dir, like the clean-room phase of E-062.
4. **Refine the `VEND_GITIGNORE`/one-way comment** lightly to note that a *standalone* template may
   own the project root `.gitignore` (no lisa project present), whereas the base + non-standalone
   overlays never touch a lisa-owned file. (Doc-only; behavior already correct.)

The pure invariant `STANDALONE_TEMPLATES ⊆ keys(TEMPLATE_REGISTRY)` (init-core.test.ts) stays
true because both adds land together.

## New test — `src/kitchen/init-kitchen.test.ts`

Guarded-live temp-dir, the `init-effect.test.ts` discipline (`mkdtemp` → assert → `rm` in
`finally`). Local `exists()` helper (the no-shared-util idiom). Imports `runInit` from
`../init/init-effect.ts`, `availableTemplates`/`isStandaloneTemplate`/`SCAFFOLD_MANIFEST` from
`../init/init-core.ts`, and `parseKitchenSeed`/`validateDishSeed` from `./dish-seed.ts`.

Describe blocks / tests:

- **`runInit(emptyDir,"kitchen")` — standalone full-seed lay-down.**
  - precondition `isLisaProject(readdir) === false` (a genuinely empty dir).
  - outcome `kind === "scaffolded"`.
  - base tree present (every `SCAFFOLD_MANIFEST` path exists) + board honest-empty
    (`countDemandRows === 0`).
  - **Dish type + example dish:** read `.emdash/seed.json`, `validateDishSeed(parseKitchenSeed(…))`
    `.ok === true`; `dishRecords(...).length === 1`.
  - **stub storefront:** `src/pages/index.astro` exists, contains "coming soon", excludes `fetch(`.
  - **Cloudflare config:** `astro.config.mjs` contains `adapter` and `cloudflare`; `wrangler.toml`
    exists and contains `kitchen-storefront`.
  - **package.json:** exists, contains `@astrojs/cloudflare`.
  - **bytes-are-authored:** scaffolded `.emdash/seed.json` `===` the example file
    (`readFile("examples/templates/kitchen-seed/.emdash/seed.json")`).
  - one-way-to-lisa: no `CLAUDE.md` / `.lisa.toml` written.
- **no-clobber converge (second run).** zero `created`, `skipped.length` === merged manifest
  length; a pre-edited seed file (e.g. `src/pages/index.astro`) survives byte-identical.
- **registry pins.** `availableTemplates()` contains `"kitchen"`; `isStandaloneTemplate("kitchen")`.

## Modified tests

- `init-core.test.ts`
  - `availableTemplates()` → `["hackathon","kitchen","minimal"]`.
  - one-way invariant (the `.gitignore` clause): iterate `Object.entries(TEMPLATE_REGISTRY)` and
    only assert `entry.path !== ".gitignore"` when `!isStandaloneTemplate(name)`; keep the
    `LISA_MARKERS` assertion for **all** overlays. (Honest-empty + LISA_MARKER clauses unchanged —
    kitchen already satisfies them.)
- `init-effect.test.ts`
  - unknown-template refusal `available` → `["hackathon","kitchen","minimal"]`.

## Ordering of changes (commit-sized steps)

1. `kitchen-overlay.ts` (new module) — compiles standalone (only needs the seed files, present).
2. `init-core.ts` register + standalone + comment.
3. Update the two existing test files' assertions (so the suite is green after step 2).
4. `init-kitchen.test.ts` (the AC).

Each step leaves `tsc` clean; the suite goes green at step 3 and gains the AC at step 4.

## Risks pinned by structure

- **Cross-module import** `src/init → src/kitchen`: a value import of `KITCHEN_OVERLAY`; kitchen
  imports only a *type* from init → no runtime cycle.
- **Text-import resolution** under `bun test` + `tsc` + `bun build --compile`: all three verified
  in Research. If a future extension trips tsc, a one-line `declare module "*.ext"` is the fix.
- **`bun.lock` (95 KB)** embeds into the binary — accepted for reproducible installs (mirrors the
  hackathon committed lockfile); flagged in Review.
