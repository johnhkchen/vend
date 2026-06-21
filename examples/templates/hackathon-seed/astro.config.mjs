import { defineConfig } from "astro/config";
import react from "@astrojs/react";

// Static output: `astro build` emits `dist/`, which Cloudflare Pages serves
// directly (build command `npm run build`, output dir `dist`). The React
// integration makes `.tsx` components first-class; islands hydrate client-side.
export default defineConfig({
  output: "static",
  integrations: [react()],
});
