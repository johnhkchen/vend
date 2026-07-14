# Research — T-062-01-01 author-dish-content-type-and-example-dish

_Phase: Research. Descriptive map of what exists and how it connects. No solutions here._

## The ticket in one line

Author the EmDash `Dish` content type (photo, name, description) plus **exactly one**
example dish as honest-empty format documentation, with a test asserting the schema +
single-row seed. This is one slice of **E-062 (kitchen-emdash-dress-rehearsal)** — the
minimal EmDash+Astro clone-and-drive seed the cook fills, then drives.

## Where this sits in the codebase

### The seed template pattern (the thing I extend)

Seed trees live under `examples/templates/<name>/`. One exists today:
`examples/templates/hackathon-seed/` — a runnable Astro+React app (package.json, astro
config, wrangler.toml, a stub `index.astro`, a `/board` route, SEED.md, charter.md,
shelf-note.md, EXPECTED-OUTCOME.md, README.md). It is the shape the kitchen seed mirrors.

Critical boundary, stated in `hackathon-seed/README-STACK.md`:
> "This seed lives under `examples/` and is **not** part of vend's own build: the root
> `tsconfig.json` includes only `src/`, and the seed contains no test files, so
> `bun run check` (vend's gate) is unaffected."

So the example tree is **authored content**, not compiled by vend. Any test that must run
in the gate lives in `src/` and reads the example files at runtime.

### How templates reach a cook's repo (`vend init --template`)

`src/init/init-core.ts` is the pure heart of `vend init`:
- `SCAFFOLD_MANIFEST` — the base dirs/files every `vend init` lays down (board, PM desk,
  knowledge stubs, `.vend/`). Seeds **structure + knowledge, never demand** (IA-3/IA-4).
- `TEMPLATE_REGISTRY: Record<string, ScaffoldEntry[]>` — named overlays merged over the
  base. Today: `hackathon` (a SEED stub + a tuned `charter.md` override) and `minimal`
  (empty overlay, standalone). **There is no `kitchen` key yet.**
- `mergeManifests(base, overlay)` / `planTemplate(...)` — pure merge+converge; overlay
  overrides a base path in its slot, overlay-only entries append.
- `STANDALONE_TEMPLATES` (gate-bypass set), `availableTemplates()`, `resolveTemplate()`.

The **canonical-const + byte-equal mirror + drift-guard** pattern is established here:
`HACKATHON_CHARTER` is an inlined const in `init-core.ts`; its byte-equal authored source
is `examples/templates/hackathon-seed/charter.md`; `init-effect.test.ts` (the
"drift guard — the inlined HACKATHON_CHARTER is byte-equal to its authored source" test,
~line 399) reads the example file via `readFile("examples/templates/.../charter.md")` and
asserts equality. **Precedent: a `src/` test reading an `examples/` file is already how the
gate validates authored seed content.**

### The write effect & test discipline

`src/init/init-effect.ts` applies a plan to disk (mkdir / write-if-absent / no-clobber).
`init-effect.test.ts` is a guarded-live temp-dir test (real `mkdtemp`/`writeFile`/`readFile`,
torn down in `finally`). Pure-core tests (`init-core.test.ts`) import only `bun:test` +
the module. Both styles use `import { describe, expect, test } from "bun:test"`.

## What EmDash actually is (verified against its docs)

EmDash (https://github.com/emdash-cms/emdash, docs at docs.emdashcms.com) is a full-stack
TypeScript CMS on Astro (admin/auth/media/REST, D1/SQLite-portable). Two facts shape this
ticket:

1. **Content types are defined in the database, not in code.** Non-devs create/modify
   collections through the admin UI. Developers do not write a `Dish.ts` schema class.
2. **A seed file bootstraps a fresh site.** A JSON document at `.emdash/seed.json` (or
   `package.json#emdash.seed`, or `seed/seed.json`) is inlined into the build and **applied
   on first request when the database is empty**. It declares `collections` (content types
   with typed fields), plus optional `content` (sample records). This is the canonical
   clone-and-drive mechanism: ship a seed → the cook's first boot materializes the schema
   in the admin and the records in REST.

### The verified seed-file shape

Root keys: `$schema`, `version`, `meta`, `settings`, `collections[]`, `taxonomies[]`,
`bylines[]`, `menus[]`, `redirects[]`, `widgetAreas[]`, `sections[]`, `content{}`.

A collection: `{ slug, label, labelSingular, description?, icon?, supports?, fields[] }`.
A field: `{ slug, label, type, required? }`. Field types include: `string`, `text`,
`number`, `integer`, `boolean`, `date`, `datetime`, `email`, `url`, `slug`, `portableText`,
`image`, `file`, `json`, `reference`.

Sample content is keyed by collection slug under `content`:
`content.<slug> = [{ id, slug, status, data: { <fieldSlug>: value, ... }, taxonomies? }]`.

Astro integration (not built here — the render slice is what `vend work` clears):
`emdash({ database: d1() })` injects admin + REST routes and a content loader
(`getEmDashCollection("dishes")`). `npx emdash types` generates types from a live instance.

### Mapping `Dish` onto the seed format

The ticket's three fields map cleanly: **name → `string` (required)**, **photo →
`image`**, **description → `text`**. The collection slug is naturally `dishes`
(plural, EmDash convention); `labelSingular: "Dish"`.

## Constraints & assumptions surfaced

- **Honest-empty (IA-4):** exactly ONE example dish, as format documentation — never
  fabricated demand. The cook adds real dishes via the admin and deletes/edits the example.
- **No live EmDash in the gate.** EmDash is a beta external dep; `bun run check` must not
  require standing up an admin/D1 server. The honest analogue of the repo's existing
  "config present + build-green, NOT a live deploy" posture (wrangler.toml comment): the
  test validates the **seed contract EmDash applies on first boot** (schema + single row),
  which is exactly what the admin exposes and REST returns — not a live HTTP probe.
- **Concurrency with the sibling ticket.** T-062-01-02 (stub storefront + Cloudflare
  config) owns `astro.config.mjs`, `wrangler.toml`, `src/pages/index.astro`, `package.json`,
  `.github/workflows/` in the same `kitchen-seed/` dir. Per the RDSPI concurrency rule,
  two tickets touching the **same file** is a missing dep edge. Both have `depends_on: []`.
  So this ticket must stay in **disjoint files**: the `.emdash/seed.json` content type +
  seed, and a `src/` test. Sharing the `kitchen-seed/` directory is fine (mkdir is
  idempotent; the commit lock serializes); only same-file edits would conflict.
- **The render slice stays UNBUILT.** Reading `Dish` → rendering the menu at `/` is the
  payoff `vend work` clears (decision b). This ticket authors the *content type + content*,
  not the loader or the render. Building a storefront loader here would both overreach the
  AC and collide with the cleared-slice premise.
- **The `kitchen` template overlay (init-core registration) is not in this ticket's AC.**
  Wiring `--template kitchen` into `TEMPLATE_REGISTRY` would modify `init-core.ts`, a file
  the sibling ticket could also need. Whether registration is a third (shared) ticket or a
  follow-up is a Design question; the AC here is satisfied by the content type + seed + test.

## Open questions for Design

1. Where is the canonical source of truth — an inlined const in `src/` (HACKATHON_CHARTER
   style) or the `.emdash/seed.json` file itself, read by the test?
2. How strong should the test be — pure structural assertion on the parsed seed, or also a
   small pure model of EmDash's REST list response to make "returns exactly one dish"
   explicit?
3. The example dish's `photo`: ship a placeholder asset, or a documented placeholder
   reference string (no binary), to stay text-only and clear of the storefront's `public/`?
