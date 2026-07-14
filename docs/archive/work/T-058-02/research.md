# T-058-02 — Research

**Ticket:** astro-react-cloudflare-frontend-scaffold (S-058-02, E-058)
**Phase:** Research — descriptive map of the terrain. No solutions proposed here.

## What the ticket asks for

Build `examples/templates/hackathon-seed/` as a **real, minimal, runnable** Astro + React frontend
with a Cloudflare Pages auto-deploy config present. Three hard boundaries:

1. **Runnable**: `npm install && npm run build` succeeds; a dev server renders a React component.
2. **Cloudflare config present, not deployed**: `wrangler`/Pages config valid in shape; no live
   deploy (no creds in this env). The boundary must be documented.
3. **Must not regress vend's gate**: `examples/` stays outside vend's typecheck + test; `bun run
   check` stays green.

The vend drive wiring (README/SEED/charter/shelf-note/EXPECTED-OUTCOME) is **T-058-03**, layered into
this same dir later. This ticket is the frontend stack only.

## The vend gate — what "must not regress" means concretely

The gate is `package.json`'s `check` script:

```
"check": "bun run baml:gen && bun run check:typecheck && bun run check:test"
"check:typecheck": "tsc --noEmit"
"check:test": "bun test"
```

Two scoping facts decide whether the seed can pollute the gate:

- **Typecheck scope is already safe.** `tsconfig.json` has `"include": ["src"]`. `tsc --noEmit`
  therefore only compiles files reachable from `src/`. Files under `examples/` are *not* in the
  compilation set and are never imported by `src/`, so the seed's `.ts`/`.tsx`/`.astro` files are
  invisible to vend's typecheck. No tsconfig change is strictly required. (The seed will carry its
  *own* `tsconfig.json` for its own tooling; that file does not affect the root because the root
  `include` is an explicit allow-list, not an exclude-list.)
- **Test scope is the real risk.** `bun test` with no config (there is **no `bunfig.toml`** in the
  repo) walks the whole working tree and runs every file matching Bun's default test pattern
  (`*.test.{ts,tsx,js,jsx,mts,...}` and `*_test.*`, `*.spec.*`). If the Astro seed ever contains a
  file matching that pattern, `bun test` would try to execute it inside vend's process — wrong runtime,
  missing deps, broken gate. A minimal Astro starter has **no** such files, but this is the one place
  the boundary is load-bearing and must be guarded deliberately, not by luck.

So the gate-safety question reduces to: **does the seed introduce any `*.test.*`/`*.spec.*` file, and
is there a guard if a future layer adds one?** Today there is no guard beyond "the seed happens to
have no test files."

## The repo's example/template terrain

- **`examples/` does not exist yet.** This ticket creates it. There is no prior art for example layout
  in this repo, so there is no house convention to match for `examples/` beyond "it is content, not
  `src/`."
- `.gitignore` ignores `node_modules/`, `dist/`, `*.tsbuildinfo`, `.lisa-layout.kdl`, and `.vend/*`
  (keeping `.vend/decisions.jsonl`). It does **not** mention `examples/`. The seed's own
  `node_modules/` and `dist/` will be caught by the existing global ignores, but only if they sit at
  those names — `examples/templates/hackathon-seed/node_modules/` matches `node_modules/` (gitignore
  matches at any depth for a bare `dir/` pattern), and likewise `dist/`. Good: the seed's build output
  and deps are already ignored. The seed's `.astro/` cache dir is **not** ignored and would need a
  local `.gitignore` in the seed or a root entry.

## Toolchain available in this environment

- **Bun 1.3.9** (vend's runtime).
- **Node 22.22.0 + npm 10.9.4** are present. This matters: the seed is an Astro app that the *designer*
  runs with `npm`, and the AC accepts "a CI/check step **or a documented command**." Because npm is
  available, an actual `npm install && npm run build` can be attempted in this env to *verify* the seed
  builds, rather than only asserting config shape. (Network availability for the npm registry is the
  open question — verification may have to fall back to documented-command + config assertion.)

## Astro + React + Cloudflare — the shape of a minimal stack (descriptive)

What a minimal runnable Astro+React+Cloudflare seed consists of, as a matter of fact about these tools
(not a design choice yet):

- `package.json` — `astro`, `@astrojs/react`, `react`, `react-dom`, and (for CF) the `@astrojs/cloudflare`
  adapter or a static build. Scripts: `dev`, `build`, `preview`.
- `astro.config.mjs` — registers `@astrojs/react()` in `integrations`. For Cloudflare Pages, either
  `output: 'static'` (Pages serves `dist/` directly) or `adapter: cloudflare()` for SSR.
- `tsconfig.json` — typically `extends: "astro/tsconfigs/strict"`; scoped to the seed.
- `src/pages/index.astro` — a page that mounts a React component (`client:load`).
- `src/components/*.tsx` — at least one interactive React component (proves the React integration).
- Cloudflare deploy config — the decision space (next phase) is `wrangler.toml` vs a Pages
  build-command/output-dir convention vs `.github/workflows/deploy.yml`. The ticket lists all three as
  acceptable shapes.

## Constraints & assumptions surfaced

- **Astro Pages-static is the lightest path**: a pure static Astro build needs no CF adapter and emits
  `dist/` that Cloudflare Pages serves directly with `output dir = dist`, `build command = npm run
  build`. SSR via `@astrojs/cloudflare` is heavier and unneeded for a hackathon seed front page.
- **The seed must be self-contained and not imported by vend.** No `src/` file may reference it; the
  only coupling is filesystem location under `examples/`.
- **Honest-empty / one-way-to-lisa invariants** (from E-058) are a *T-058-03* concern (the vend wiring),
  not this ticket — this ticket adds no `.vend/` demand and no vend-owned paths beyond the example dir.
- **No live deploy.** No Cloudflare credentials exist here; the config is asserted by shape and the
  boundary documented. Confirmed by the ticket and the epic's honest boundaries.
- **Open question for Design:** how strongly to guard `bun test` against future seed test files —
  rely on "no test files exist" (zero-cost, fragile) or add a `bunfig.toml`/tsconfig exclude
  (explicit, durable). Both candidate approaches carry into Design.
