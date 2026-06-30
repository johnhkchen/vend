import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

// The kitchen storefront's Cloudflare ADAPTER config (T-062-01-02).
//
// `output: "server"` + the Cloudflare adapter render the site on Cloudflare Workers
// on-demand: the menu-render slice that `vend work` clears later reads the couple's dishes
// from EmDash's REST API *at request time*, so the SSR shape is honest from day one — even
// though today's `/` is a deliberate stub that fetches nothing.
//
// VERSION PIN (the cold-start fix): `@astrojs/cloudflare@^13` is the adapter line that peers
// with `astro@^6` (^6.3.0). The newer adapter 14 peer-requires astro 7 and, against astro 6,
// fails the SSR build outright. Keep these two pinned together — see README-STACK.md.
//
// SEAM (T-062-01-01): the EmDash integration is registered here, in `integrations: [...]`,
// when the Dish content type lands. This ticket owns only the Cloudflare adapter line.
export default defineConfig({
  output: "server",
  adapter: cloudflare(),
});
