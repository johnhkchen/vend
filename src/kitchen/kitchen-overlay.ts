// The `vend init --template kitchen` OVERLAY manifest (T-062-02-01, story S-062-02, epic
// E-062: kitchen-emdash-dress-rehearsal) — the vend-owned files the kitchen template layers
// over the base scaffold to lay the authored EmDash+Astro seed into a fresh dir.
//
// WHAT THIS IS: the kitchen seed (the Dish content type from T-062-01-01 + the stubbed Astro
// storefront / Cloudflare config from T-062-01-02 + the seed-intent `SEED.md` and the kitchen-tuned
// `charter.md` from T-062-03-01) is authored as a real, build-tested
// directory at `examples/templates/kitchen-seed/`. This module turns that authored tree into
// the `ScaffoldEntry[]` the shipped init seam writes — so `vend init --template kitchen`
// reaches it through the IDENTICAL write-if-absent / no-clobber path the hackathon/minimal
// templates use (init-effect.ts `runInit`), with NO new command and NO new effect.
//
// HOW THE CONTENT GETS IN — text imports (`with { type: "text" }`): each authored file is
// imported as a compile-time string constant. This is the ONE mechanism that is simultaneously:
//   • binary-safe — `bun build --compile` INLINES the bytes into the single `vend` binary, so a
//     brew-installed `vend` (which does NOT ship `examples/` beside it) still scaffolds the seed.
//     A runtime `readFile` of `examples/...` would work in-repo and break for every real install.
//   • drift-free — the file IS the source. No hand-copied mirror to keep in sync, so unlike the
//     inlined `HACKATHON_CHARTER` there is no drift test to write (the embedded bytes are the
//     authored bytes by construction).
//   • escaping-free — the seed's backticks (the READMEs) and `${…}` (deploy.yml's
//     `${{ secrets.* }}`) pass through untouched; they are never inside a JS literal.
// Verified across all three toolchain axes for this repo: `bun build --compile` embeds them,
// `tsc --noEmit` (moduleResolution "bundler") resolves them, and `bun test` runs them natively.
// `tsc` needs a module declaration for the seed's non-`.json`/`.md`/`.svg` extensions — that is
// `seed-text-modules.d.ts` (a `string` shim for `.mjs`/`.astro`/`.yml`/`.gitignore`). The ONE
// exception is `src/env.d.ts`: `tsc` refuses to value-import a `.d.ts` (TS2846), so that single
// trivial file (`/// <reference types="astro/client" />`) is inlined below as `ENV_DTS` — the only
// hand-mirrored byte in the overlay (a drift assertion in init-kitchen.test.ts pins it to source).
//
// PURE (mirrors init-core.ts): the imported values are compile-time `string` constants —
// semantically identical to a `const` literal — so this module touches no fs/clock/network at
// runtime. It exports a plain `ScaffoldEntry[]` of plain values; the purity doctrine holds.
//
// THE `path` IS THE SCAFFOLD TARGET, not the source: each entry's `path` is project-root-relative
// (where the file lands in the cook's dir); the `../../examples/...` specifier is only where the
// bytes are read FROM at build time. Files-only — `applyInitScaffold` does `mkdir(dirname)` before
// every write, so the nested parents (`src/`, `public/`, `.github/workflows/`, `.emdash/`) need no
// explicit `dir` entries (the hackathon overlay's files-only style). Order is cosmetic: the effect
// creates each file's parent on demand.
//
// ONE-WAY-TO-LISA / HONEST-EMPTY: the overlay writes NO lisa-owned marker (`CLAUDE.md` /
// `.lisa.toml`) and adds NO demand row (no `vend chain "…"` / cleared-epic line). It DOES write a
// project-root `.gitignore` — legitimate for a STANDALONE template (E-062 lays a fresh app
// workspace into an EMPTY dir; there is no lisa project whose `.gitignore` could be clobbered, and
// no-clobber protects any pre-existing one). `kitchen`'s standalone bit lives in
// init-core.ts's STANDALONE_TEMPLATES.

import type { ScaffoldEntry } from "../init/init-core.ts";

// ── The authored seed files, embedded as compile-time strings ────────────────────────────────
// T-062-03-01 (the seed-intent → steer wire on the materialized seed, story S-062-03): the cook's
// one-line intent (SEED.md) the E-059 assembler reads into the steer snapshot, and the kitchen-tuned
// charter the model grades the board against. Both `.md` (resolved natively by tsc, no shim).
import seedIntent from "../../examples/templates/kitchen-seed/SEED.md" with { type: "text" };
import kitchenCharter from "../../examples/templates/kitchen-seed/charter.md" with { type: "text" };
// T-062-01-01 (the Dish content type + the one example dish):
import seedJson from "../../examples/templates/kitchen-seed/.emdash/seed.json" with { type: "text" };
import emdashReadme from "../../examples/templates/kitchen-seed/.emdash/README.md" with { type: "text" };
// T-062-01-02 (the stubbed Astro storefront + Cloudflare config-present):
import pkgJson from "../../examples/templates/kitchen-seed/package.json" with { type: "text" };
import astroConfig from "../../examples/templates/kitchen-seed/astro.config.mjs" with { type: "text" };
import wranglerToml from "../../examples/templates/kitchen-seed/wrangler.toml" with { type: "text" };
import indexAstro from "../../examples/templates/kitchen-seed/src/pages/index.astro" with { type: "text" };
import faviconSvg from "../../examples/templates/kitchen-seed/public/favicon.svg" with { type: "text" };
import tsconfig from "../../examples/templates/kitchen-seed/tsconfig.json" with { type: "text" };
import gitignore from "../../examples/templates/kitchen-seed/.gitignore" with { type: "text" };
import readmeStack from "../../examples/templates/kitchen-seed/README-STACK.md" with { type: "text" };
import bunLock from "../../examples/templates/kitchen-seed/bun.lock" with { type: "text" };
import deployYml from "../../examples/templates/kitchen-seed/.github/workflows/deploy.yml" with { type: "text" };

/** `src/env.d.ts` — inlined, NOT text-imported: `tsc` refuses to value-import a `.d.ts` (TS2846).
 *  Trivial + escaping-free; init-kitchen.test.ts drift-asserts it equals the authored source. */
const ENV_DTS = '/// <reference types="astro/client" />\n';

/**
 * The kitchen template's OVERLAY — the EmDash+Astro seed laid over the base scaffold by
 * `vend init --template kitchen`. Registered as `TEMPLATE_REGISTRY.kitchen` and marked standalone
 * (see init-core.ts). Files-only (parents are made by the effect's `mkdir(dirname)`); every `path`
 * is a project-root-relative scaffold target. Honest-empty + one-way-to-lisa (see the header).
 */
export const KITCHEN_OVERLAY: readonly ScaffoldEntry[] = [
  // The seed-intent → steer wire (T-062-03-01). SEED.md is the cook's one-line intent — the E-059
  // assembler (`assembleSteerInputs`) reads it TOLERANTLY into the steer snapshot's `## Stated intent`
  // section, so `vend steer` reads the menu-render demand off the materialized seed (not just the spike).
  // The charter entry OVERRIDES the base CHARTER_STUB at `docs/knowledge/charter.md` (the path steer
  // reads) via `mergeManifests`' override-in-slot — so steer grades against the kitchen value function
  // ("a usable menu the couple orders from"), not the generic stub. Both are vend-owned and carry ZERO
  // demand rows, so one-way-to-lisa + honest-empty hold (the same two file kinds the `hackathon` overlay
  // adds). This is the gap the AC names: without these the snapshot is empty and steer has nothing to rank.
  { kind: "file", path: "SEED.md", contents: seedIntent },
  { kind: "file", path: "docs/knowledge/charter.md", contents: kitchenCharter },
  // Content type + example dish (the Dish format documentation EmDash applies on first boot).
  { kind: "file", path: ".emdash/seed.json", contents: seedJson },
  { kind: "file", path: ".emdash/README.md", contents: emdashReadme },
  // The Astro app + Cloudflare config (the deliberately-stubbed storefront).
  { kind: "file", path: "package.json", contents: pkgJson },
  { kind: "file", path: "astro.config.mjs", contents: astroConfig },
  { kind: "file", path: "wrangler.toml", contents: wranglerToml },
  { kind: "file", path: "tsconfig.json", contents: tsconfig },
  { kind: "file", path: ".gitignore", contents: gitignore },
  { kind: "file", path: "README-STACK.md", contents: readmeStack },
  { kind: "file", path: "bun.lock", contents: bunLock },
  // The literal deploy-on-push path (INERT without the cook's Cloudflare secrets).
  { kind: "file", path: ".github/workflows/deploy.yml", contents: deployYml },
  // Source + assets.
  { kind: "file", path: "src/pages/index.astro", contents: indexAstro },
  { kind: "file", path: "src/env.d.ts", contents: ENV_DTS },
  { kind: "file", path: "public/favicon.svg", contents: faviconSvg },
];
