# Kitchen storefront — stack notes

The diner-facing storefront for the kitchen QuickStart seed. **Astro 6 + Cloudflare**, built to
be picked up, filled with real dishes, and driven by vend.

## The stack

| Piece | Choice | Why |
|-------|--------|-----|
| Framework | **Astro `^6.4.8`** | EmDash's Astro 6 line; the seed's content backbone is EmDash. |
| Deploy adapter | **`@astrojs/cloudflare@^13.7.0`** | SSR on Cloudflare Workers. |
| Output mode | **`output: "server"`** | The menu reads EmDash's REST API at request time. |
| Toolchain | **Bun** | The project (and brew-installed vend) standard; `bun install && bun run build`. |

### ⚠️ Keep the Astro / adapter versions paired

`@astrojs/cloudflare@^13` peers with `astro@^6`. The newer **adapter 14 requires astro 7** and,
installed against astro 6, **breaks the SSR build** (`rollupOptions.input should not be an html
file when building for SSR`). If you bump one, bump both — don't let `bun update` drift the
adapter to 14 while astro stays on 6.

## What's here vs. what vend builds

- **`src/pages/index.astro` is a deliberate stub.** It renders a "menu coming soon" placeholder
  and fetches nothing. The menu is the slice **`vend work` clears**: read your `Dish` content
  from EmDash and render a mobile-first menu (one card per dish: photo, name, description).
- **`astro.config.mjs`** carries the Cloudflare adapter (the deploy config). The EmDash
  integration is added here when the Dish content type lands.
- **`wrangler.toml`** is the deploy contract — **config present, not a live deploy.** No
  Cloudflare credentials live in this repo. You deploy on your own push; the
  `[[d1_databases]]` / `[[r2_buckets]]` bindings (EmDash store + media) are commented stubs you
  fill with your own ids.

## The drive

```bash
bun install            # deps (astro + the cloudflare adapter)
bun run build          # green build → dist/server (deployable Worker output)
bun run dev            # local preview while you add dishes in the EmDash admin
# then: vend steer → vend work  (autopilot builds the menu)
```

Honest-empty (IA-4): this seed ships structure and one example dish as format documentation —
you add the rest.
