# T-062-01-02 — Structure

The shape of the change. One new directory, `examples/templates/kitchen-seed/`, holding a
build-green Astro 6 storefront stub + committed-but-inert Cloudflare config. No `src/` engine
code, no `init` wiring, no `package.json` edits at the repo root. Mirrors `hackathon-seed`
file-for-file where the idiom transfers.

## Files to CREATE

All paths under `examples/templates/kitchen-seed/`.

### `package.json` — the seed manifest (THIS ticket owns)
```jsonc
{
  "name": "kitchen-storefront",
  "type": "module",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "astro": "astro"
  },
  "dependencies": {
    "astro": "^6.4.8",
    "@astrojs/cloudflare": "^13.7.0"
  }
}
```
- Public contract: the `build` script (the AC's `astro build`) + the pinned astro/adapter
  pair (the cold-start fix). **Seam:** T-062-01-01 appends the EmDash dependency here.

### `astro.config.mjs` — the Cloudflare ADAPTER config (the AC's centerpiece)
```js
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
// SSR on Cloudflare Workers: the menu-render slice (vend work) reads EmDash's REST API at
// request time. The stub renders no dynamic data yet — the adapter shape is honest from day one.
// SEAM (T-062-01-01): the EmDash integration is added to `integrations: [...]` here.
export default defineConfig({
  output: "server",
  adapter: cloudflare(),
});
```

### `src/pages/index.astro` — the deliberately-stubbed storefront `/`
- Frontmatter empty (no data fetch). A literal comment marks it the slice `vend work` clears.
- Mobile-first: `<meta name="viewport" …>`, inline styles, a centered "Menu coming soon"
  card with one line explaining the cook adds dishes in the EmDash admin and autopilot builds
  the menu. NO dish data, NO `<DishCard>`, NO EmDash import.

### `src/env.d.ts`
```ts
/// <reference types="astro/client" />
```

### `tsconfig.json`
```jsonc
{ "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"] }
```

### `wrangler.toml` — Cloudflare config-present, HONEST BOUNDARY
- Header comment (verbatim-in-spirit with hackathon): config present + build-green, NOT a live
  deploy; no Cloudflare creds in this repo; the cook deploys on their own push.
- Body: `name = "kitchen-storefront"`, `compatibility_date = "2026-04-15"`, and *commented*
  `[[d1_databases]]` / `[[r2_buckets]]` stubs (the EmDash content store + media library the
  cook wires). Merged by the adapter at build (probe-verified).

### `.github/workflows/deploy.yml` — INERT deploy-on-push
- HONEST BOUNDARY header: inert without `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`.
- `on: push: branches:[main]`; job: checkout → setup-node → `npm ci` → `npm run build` →
  `cloudflare/wrangler-action@v3` with `command: deploy` (Worker output from the adapter).

### `.gitignore`
```
node_modules/
dist/
.astro/
.vend/
```

### `public/favicon.svg`
- A tiny, dependency-free SVG (a plate/fork kitchen glyph). Referenced by `index.astro`'s
  `<link rel="icon">`. Mirrors hackathon's favicon presence.

### `README-STACK.md`
- Short stack note: Astro 6 + `@astrojs/cloudflare@13` (the pinned pair and WHY), `output:
  server`, the stub-is-on-purpose statement, and the config-present-not-live boundary. The
  human-readable companion to the honest-boundary comments.

### `bun.lock` (generated, committed)
- Produced by the real `bun install` in the seed dir; committed for reproducible builds, matching
  the project's Bun toolchain.

## Files NOT touched (ownership boundaries)

- **`src/init/init-core.ts` / `TEMPLATE_REGISTRY`** — T-062-02-01 wires `init --template
  kitchen` to lay this seed. Not this ticket.
- **The EmDash `Dish` content type, the example dish, and their test** — T-062-01-01.
- **`SEED.md` / `docs/knowledge/charter.md` / `shelf-note.md` / `EXPECTED-OUTCOME.md`** — the
  vend-owned overlay + gold-master are the `init` overlay (02-01) and the drive-capture
  (T-062-03-*) tickets' scope; not authored here.
- **Repo-root `package.json` / `tsconfig.json` / CI** — untouched; `examples/` is outside the
  root gate (`include:["src"]`).
- **`examples/templates/hackathon-seed/**`** — left exactly as-is; only referenced as precedent.

## Module boundaries & interfaces

- The seed is a self-contained Astro project: its only "interface" outward is its directory
  layout (what 02-01's `init` copies) and its green `astro build`.
- `astro.config.mjs` is the documented extension point for the EmDash integration (seam).
- `wrangler.toml` is the documented deploy contract; bindings are commented stubs for the cook.

## Ordering of changes (creation-safe)

1. `package.json` (deps the build needs).
2. `astro.config.mjs`, `tsconfig.json`, `src/env.d.ts`.
3. `src/pages/index.astro`, `public/favicon.svg`.
4. `wrangler.toml`, `.github/workflows/deploy.yml`, `.gitignore`, `README-STACK.md`.
5. `bun install` in the seed dir → produces `bun.lock`; `bun run build` → prove green.

## Risks in the structure

- **Adapter/astro drift:** a future `bun update` could pull adapter 14 and re-introduce the SSR
  build break. Mitigation: pin `^13` and document the pairing in `README-STACK.md`.
- **Seam with 01-01 on `package.json`/`astro.config.mjs`:** if both tickets run concurrently the
  lock serializes writes but does not merge content. Mitigation: this ticket lands a green
  standalone build; the EmDash additions are additive and the seam is flagged in review.md.
- **`bun.lock` churn:** committing a lockfile for an example adds noise on dep bumps; accepted
  for build reproducibility (hackathon committed `package-lock.json` for the same reason).
