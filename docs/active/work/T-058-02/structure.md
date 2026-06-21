# T-058-02 — Structure

**Phase:** Structure — the file-level blueprint. Shape of the code, not the code.

All changes are **additive, under `examples/templates/hackathon-seed/`**. No edits to `src/`,
`package.json`, `tsconfig.json`, or any root config. This is the property that makes gate-safety
trivial (Design Decision 3).

## File tree (created by this ticket)

```
examples/templates/hackathon-seed/
  package.json            # astro + @astrojs/react + react/react-dom; dev/build/preview scripts
  astro.config.mjs        # output: 'static'; integrations: [react()]
  tsconfig.json           # extends astro/tsconfigs/strict (seed-scoped; does NOT affect root)
  wrangler.toml           # Cloudflare Pages config: pages_build_output_dir = "dist"
  .gitignore              # seed-local: node_modules/, dist/, .astro/
  README-STACK.md         # frontend-stack notes + the honest deploy boundary (NOT the drive README)
  .github/
    workflows/
      deploy.yml          # literal on-push Pages deploy via wrangler-action; inert without secrets
  src/
    pages/
      index.astro         # the page; mounts the React component with client:load
    components/
      HackathonApp.tsx    # one interactive React component (proves hydration)
    env.d.ts              # Astro client types reference
  public/
    favicon.svg           # static asset so the build has a public/ (Astro convention)
```

**Naming note:** the stack-notes file is `README-STACK.md`, **not** `README.md`. T-058-03 owns the
drive `README.md` (the "copy → init → steer → work" script). Using a distinct name now prevents a
collision/clobber when T-058-03 layers its `README.md` into the same dir, and keeps this ticket's
boundary clean (frontend stack only). T-058-03 may later fold these notes into its README.

## Per-file responsibility

### `package.json` (seed)
- `"name": "hackathon-seed"`, `"type": "module"`, `"private": true`.
- `scripts`: `dev` (`astro dev`), `build` (`astro build`), `preview` (`astro preview`),
  `astro` (`astro`).
- `dependencies`: `astro`, `@astrojs/react`, `react`, `react-dom`.
- `devDependencies`: `@types/react`, `@types/react-dom`.
- Pinned to recent stable majors; exact versions resolved at Implement (see Plan).

### `astro.config.mjs`
- `import { defineConfig } from 'astro/config'` + `import react from '@astrojs/react'`.
- `export default defineConfig({ output: 'static', integrations: [react()] })`.
- The single wiring point that makes `.tsx` components first-class. Static output = Pages serves
  `dist/`.

### `tsconfig.json` (seed)
- `{ "extends": "astro/tsconfigs/strict", "include": [".astro", "**/*"], "exclude": ["dist"] }`.
- Seed-scoped. The root `tsconfig` uses `include: ["src"]`, an allow-list — this file is invisible to
  `tsc --noEmit` at the repo root. Documented here so a reviewer doesn't fear a tsconfig conflict.

### `wrangler.toml`
- `name = "hackathon-seed"`.
- `pages_build_output_dir = "dist"` — the declarative Cloudflare Pages output dir.
- `compatibility_date = "<recent>"`.
- A header comment: this is the deploy config; live deploy happens on the designer's push with their
  own Cloudflare account — **not deployed from this repo** (no creds here).

### `.github/workflows/deploy.yml`
- Trigger: `on: push` (branches: main).
- Job: checkout → setup-node → `npm ci` → `npm run build` → `cloudflare/wrangler-action` running
  `pages deploy dist --project-name=hackathon-seed`.
- Secrets referenced: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- Header comment states it is the literal on-push path and **inert without those secrets** (the honest
  boundary). It is config-present, not exercised here.

### `src/pages/index.astro`
- Frontmatter imports `HackathonApp`.
- Minimal HTML doc (`<html><head><title>…</title></head><body>`).
- Renders `<HackathonApp client:load />` — `client:load` forces hydration, proving React works.
- A heading + a one-line "this is a vend hackathon seed" note; an obvious slot/comment where T-058-04
  will place the SVG board beside the app.

### `src/components/HackathonApp.tsx`
- A function component using `useState` (a small counter or a "teammates found" stub) — the simplest
  honest proof of an interactive, hydrated React island.
- Hackathon-flavored copy (not lorem), per Design Decision 4.

### `src/env.d.ts`
- `/// <reference types="astro/client" />` — standard Astro ambient types.

### `public/favicon.svg`
- A tiny inline SVG so `public/` exists (Astro convention; referenced by `index.astro`).

### `.gitignore` (seed)
- `node_modules/`, `dist/`, `.astro/` — belt-and-suspenders with root ignores; `.astro/` is **not**
  covered by the root `.gitignore`, so this entry matters.

## Ordering of changes (where it matters)

1. Scaffold the seed files (config first, then `src/`, then deploy config) — so a build attempt has
   everything it needs in one shot.
2. Resolve dependency versions / generate a lockfile during the build attempt (Plan step).
3. Verify the seed build (or fall back to shape-assertion).
4. Verify vend's gate (`bun run check`) is unaffected — this is the gate invariant and must be the
   last green light before commit.

## Module boundaries / interfaces

- **No public interface** is exported to vend. The only "interface" is the filesystem location
  (`examples/templates/hackathon-seed/`) that `vend init --template hackathon` (T-058-01) will overlay
  from, and that T-058-03 will add drive files into. This ticket must therefore keep the directory name
  and path **exactly** as the epic/brief specify.
- **Invariant preserved:** no `*.test.*`/`*.spec.*` files anywhere in the seed (gate-safety).
