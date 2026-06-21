# Hackathon seed — frontend stack notes

> Stack notes for the Astro + React + Cloudflare frontend (T-058-02). The **drive
> script** (copy → init → steer → work) lives in the `README.md` added by T-058-03.

## What this is

A minimal, runnable **Astro + React** app wired to **auto-deploy to Cloudflare Pages**. It is a
hackathon *seed*, not a product — one page, one interactive React island, and a green build.

## Run it

```bash
npm install
npm run dev      # dev server with a live preview of the React island
npm run build    # emits ./dist (static site)
npm run preview  # serve the built ./dist locally
npm run board    # render the vend work-graph to .vend/work-graph.svg (runs `vend svg`)
```

The **`/board`** route displays that rendered work-graph beside the app — a read-only static
snapshot (re-run `npm run board` and refresh to update it). It only *displays* the board; the
graph is never mutated. The board is empty until you drive the seed (see [`README.md`](./README.md)).

`src/components/HackathonApp.tsx` is a live React island (`client:load` in `src/pages/index.astro`) —
proof the `@astrojs/react` integration hydrates. Replace it with your real UI.

## Deploy (Cloudflare Pages)

The static `dist/` is served directly by Cloudflare Pages.

- **`wrangler.toml`** — declarative Pages config: `pages_build_output_dir = "dist"`. `wrangler pages
  deploy dist` reads it.
- **`.github/workflows/deploy.yml`** — the literal *deploy-on-push* path: build + `wrangler pages
  deploy` on every push to `main`.

### Honest boundary

This repo ships **config present + a green build, NOT a live deploy**. There are no Cloudflare
credentials here. To go live, you (the designer) set the repo secrets `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` in your own fork — then each push auto-deploys to your Cloudflare account.

## Boundary with the vend repo

This seed lives under `examples/` and is **not** part of vend's own build: the root `tsconfig.json`
includes only `src/`, and the seed contains no test files, so `bun run check` (vend's gate) is
unaffected.
