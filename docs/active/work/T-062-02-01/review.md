# Review — T-062-02-01 init-template-kitchen-lays-emdash-astro-seed

_Phase: Review. The handoff — what changed, how it was verified, open concerns. Read this
instead of the diff._

## What changed

Wires the authored kitchen seed (T-062-01-01's Dish content type + T-062-01-02's stubbed Astro
storefront + Cloudflare config) into the shipped `vend init` seam, so `vend init --template
kitchen` lays the whole seed into an empty dir — no new command, idempotent, no-clobber.

| File | Op | Role |
|------|----|------|
| `src/kitchen/kitchen-overlay.ts` | new | Text-embeds the 13 authored seed files → `KITCHEN_OVERLAY: ScaffoldEntry[]`. |
| `src/kitchen/seed-text-modules.d.ts` | new | Ambient `string` shim so `tsc` resolves the seed's non-native text extensions. |
| `src/kitchen/init-kitchen.test.ts` | new | The AC: cast into an empty dir, full-seed + no-clobber + standalone. |
| `src/init/init-core.ts` | modify | Register `kitchen`; mark standalone; one `KITCHEN_OVERLAY` import. |
| `src/init/init-core.test.ts` | modify | Updated available-list; refined the `.gitignore` invariant. |
| `src/init/init-effect.test.ts` | modify | Updated the unknown-template `available` list. |

**No control-flow change.** `runInit` / `applyInitScaffold` / `cli.ts` are untouched — the
standalone + overlay path was already generic; this ticket adds data + one policy bit.

## How the AC is met — verified, not asserted

> A test casts `vend init --template kitchen` into an empty dir, asserts the full seed (Dish
> type, stub storefront, example dish, Cloudflare config) is written, and a second run converges
> no-clobber.

- ✅ **Cast into an empty dir.** `init-kitchen.test.ts` runs `runInit(mkdtemp(), "kitchen")` after
  asserting the dir is `!isLisaProject` — proving the standalone gate-bypass (the empty-dir
  reality).
- ✅ **Dish type + example dish.** The scaffolded `.emdash/seed.json` is graded by **reusing**
  `parseKitchenSeed` + `validateDishSeed` (the T-062-01-01 contract): `violations === []`,
  `dishRecords().length === 1`.
- ✅ **Stub storefront.** `src/pages/index.astro` contains "coming soon" and **no** `fetch(`.
- ✅ **Cloudflare config.** `astro.config.mjs` carries `adapter` + `cloudflare`; `wrangler.toml`
  has `kitchen-storefront`; `package.json` has `@astrojs/cloudflare`.
- ✅ **No-clobber converge.** Second run → `created: []`, `skipped.length === merged manifest`; a
  user edit to `index.astro` survives byte-identical.
- ✅ **Bytes are authored** (beyond the AC). Scaffolded `seed.json` and `env.d.ts` byte-equal the
  example source — the structural substitute for a drift test.
- ✅ **End-to-end in the real binary.** `bun build --compile` then run from an empty dir with
  `examples/` absent → `30 created`; re-run → `30 skipped`. The brew-install reality holds.

## Test coverage

- `bun test src/kitchen` → 14 pass (4 new + 10 existing dish-seed). `bun test src/init` → 65 pass.
- Full suite: **1458 pass / 1 skip / 0 fail**; `tsc --noEmit` clean (no lint script in this repo).
- Existing pure invariants auto-cover the new template: honest-empty (zero demand rows per overlay
  file), no-lisa-marker, and `STANDALONE_TEMPLATES ⊆ TEMPLATE_REGISTRY` all iterate the registry,
  so registering `kitchen` is checked without new assertions.
- **Gaps (intentional):** no live EmDash/D1/REST round-trip (out of scope — the seed is the
  contract); no automated CI `astro build` of the seed (see concern 3); the compile smoke is
  manual (no CI compile gate in scope).

## Key decisions (rationale in design.md)

1. **Text imports (`with { type: "text" }`), not inlined constants or runtime fs.** The only
   option that is binary-safe (embeds in `bun build --compile` — verified), drift-free (the file
   IS the source, so no per-file drift tests), and escaping-free (the seed's backticks and
   `${{ secrets }}` never enter a JS literal). A runtime read of `examples/` was disqualified — the
   brew binary doesn't ship it.
2. **kitchen is STANDALONE + base-plus-overlay.** "Into an empty dir" ⇒ bypass the lisa gate (like
   `minimal`); the cook drives with `vend steer`/`work` ⇒ also lay the base board. Both fall out of
   the existing `runInit` for free.
3. **Refined the one-way-to-lisa `.gitignore` invariant** rather than deleting it: the root-
   `.gitignore` prohibition now scopes to NON-standalone overlays (a standalone template mints a
   fresh workspace where no lisa project exists to clobber); the `LISA_MARKERS` prohibition stays
   absolute. This is a principled tightening of "what one-way-to-lisa means," not a loosening.

## Open concerns / flags for a human reviewer

1. **⚠️ The EmDash↔Astro wiring is still unbuilt (inherited seam).** Both dependency reviews
   (01-01 #1, 01-02 #1) flagged that `package.json` lacks the EmDash dep and `astro.config.mjs`
   lacks the EmDash `integrations:[…]` entry, and the three were never built together. This ticket
   scaffolds the seed **exactly as authored** — it does not invent the missing wiring. The menu
   render (which needs that wiring) is the slice `vend work` clears. **Action:** whoever closes the
   EmDash integration must re-confirm `astro build` stays green with adapter 13 + astro 6 + EmDash.
2. **New mechanism: text imports + an ambient `.d.ts` shim.** First `with { type: "text" }` imports
   in the codebase. `seed-text-modules.d.ts` declares 8 wildcard `*.ext` modules as `string`. Two
   things a reviewer should know: (a) the wildcards are safe **today** (no other `.mjs`/`.astro`/
   etc. value imports in `src`) but a future real `.mjs`/`.svg` value import elsewhere would be
   mistyped as `string` — if that lands, scope these to exact paths; (b) `tsc`'s behavior was
   surprising — once any `declare module` exists, every non-native extension needs one (hence the
   8 entries, not the 4 the failing list first showed). `env.d.ts` is the one file inlined as a
   constant because tsc forbids value-importing a `.d.ts`.
3. **No CI build of the seed.** 01-02's review recommended wiring the seed's green `astro build`
   into CI so adapter/astro drift fails CI, not a cook's machine. Deferred to `vend doctor`
   (T-062-02-02), which is the natural home for a workspace probe.
4. **`bun.lock` (95 KB) is embedded in the binary.** Accepted for reproducible cook installs and
   to hold the adapter-13/astro-6 pin (mirrors the hackathon committed lockfile). It is the single
   largest embed; if binary size becomes a concern, dropping it (cook runs `bun install` from
   `package.json`) is the lever — at the cost of the version-pin guarantee.
5. **The seed's `.gitignore` ignores all of `.vend/`.** The base scaffold writes `.vend/.gitignore`
   intending to keep `decisions.jsonl` tracked; the seed's root `.gitignore` (authored in 01-02)
   ignores the whole `.vend/` dir, which would shadow that. Faithful to the authored seed and
   harmless for the dress rehearsal; flagged in case the decision-log-tracking intent matters to the
   cook's repo later.

## Risk assessment

Low. Additive: one new overlay module + one shim + one test, a registry entry, a standalone-set
member, and three assertion edits. No existing behavior changed (control flow byte-identical; bare
`vend init` and `hackathon`/`minimal` wholly unaffected). The verification went past the unit gate
to a real compiled binary scaffolding from an empty dir. The one thing a human must not miss is
**concern 1** — the seed is laid faithfully, but the EmDash↔Astro integration it implies is the
unbuilt slice the drive clears, not something this ticket delivered.
