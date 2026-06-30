# Research — T-062-02-01 init-template-kitchen-lays-emdash-astro-seed

_Phase: Research. Descriptive map of the territory — what exists, where, how it connects.
No solutions here; those are Design's._

## The ticket

Extend the shipped E-058 `vend init --template <name>` seam so `--template kitchen` scaffolds
the authored EmDash+Astro seed into a dir — **no new command, idempotent, no-clobber**. The AC:

> A test casts `vend init --template kitchen` into an empty dir, asserts the full seed (Dish
> type, stub storefront, example dish, Cloudflare config) is written, and a second run
> converges no-clobber.

Depends on T-062-01-01 (the Dish content type + example dish) and T-062-01-02 (the stubbed
storefront + Cloudflare config). Both are `phase: done`; their output is on disk.

## The init/template machinery (already shipped)

The whole template seam exists and is exercised — this ticket adds **data + one policy bit**,
not new control flow.

- `src/init/init-core.ts` — the PURE core. Header rule: *every export takes plain values and
  returns plain values — no fs/clock/network/process*. Relevant exports:
  - `ScaffoldEntry` = `{kind:"dir",path}` | `{kind:"file",path,contents}` (POSIX, root-relative).
  - `SCAFFOLD_MANIFEST` — the base vend tree (board/PM/archive/knowledge/`.vend`).
  - `TEMPLATE_REGISTRY: Record<string, ScaffoldEntry[]>` — named overlays. Today: `hackathon`
    (SEED.md + a tuned `docs/knowledge/charter.md` override) and `minimal` (empty overlay).
  - `STANDALONE_TEMPLATES: ReadonlySet<string>` (= `{minimal}`) + `isStandaloneTemplate(name)`
    — the templates that **bypass the lisa-project gate** so a brew binary scaffolds an empty,
    no-checkout dir. INVARIANT (pure test): every standalone name is a registry key.
  - `availableTemplates()` (sorted keys), `resolveTemplate(name)`.
  - `mergeManifests(base, overlay)` — overlay overrides a same-path base entry in place; overlay-
    only entries append. `planTemplate(existing, base, overlay)` = `planInit` over the merge.
- `src/init/init-effect.ts` — the IMPURE shell. `applyInitScaffold(root, manifest)` writes the
  `creates` (dirs via `mkdir{recursive}`, files via the exclusive `wx` flag — TOCTOU-safe
  no-clobber; an EEXIST reclassifies create→skip). **`mkdir(dirname(abs),{recursive:true})`
  runs before every file write**, so nested files need no explicit dir entries.
  `runInit(root, template?)` composes: resolve template first (unknown → `unknown-template`
  refusal, writes nothing), then the lisa gate (bypassed iff the template is standalone), then
  apply `mergeManifests(SCAFFOLD_MANIFEST, overlay)`. Returns a typed `InitOutcome`.
- `src/cli.ts` — `parseInitArgs` accepts `--template <name>` verbatim (registry-free parser);
  the `init` dispatch arm calls `runInit(process.cwd(), parsed.template)` and prints
  `scaffolded --template <name> — N created, M skipped`. **Nothing here needs changing** — a new
  template name flows through unchanged.

The precedent for shipping authored file content into the binary is `HACKATHON_CHARTER`: a
string constant inlined in `init-core.ts`, kept byte-equal to
`examples/templates/hackathon-seed/charter.md` by a **drift test** in `init-effect.test.ts`.

## The authored kitchen seed (the dependencies' output)

Lives at `examples/templates/kitchen-seed/`. Tracked text files (the seed proper):

| Path | From | Role |
|------|------|------|
| `.emdash/seed.json` | 01-01 | The `Dish` content type (name/photo/description) + **one** example dish. |
| `.emdash/README.md` | 01-01 | Cook-facing note on the seed + honest boundary. |
| `package.json` | 01-02 | `astro@^6.4.8` + `@astrojs/cloudflare@^13.7.0`; dev/build/preview scripts. |
| `astro.config.mjs` | 01-02 | **Cloudflare adapter** config — `output:"server"`, `adapter: cloudflare()`. |
| `wrangler.toml` | 01-02 | Cloudflare deploy config-present (commented D1/R2 stubs). |
| `src/pages/index.astro` | 01-02 | The **deliberate stub** `/` — mobile-first "menu coming soon", no fetch. |
| `src/env.d.ts` | 01-02 | `astro/client` types reference. |
| `public/favicon.svg` | 01-02 | Stub favicon (533 B). |
| `tsconfig.json` | 01-02 | Extends `astro/tsconfigs/strict`. |
| `.gitignore` | 01-02 | Ignores `node_modules/ dist/ .astro/ .wrangler/ .vend/`. |
| `README-STACK.md` | 01-02 | Stack notes + the adapter/astro version-pin warning. |
| `bun.lock` | 01-02 | Committed lockfile (95 KB) — reproducible install, pins the adapter. |

`src/kitchen/dish-seed.ts` is the **pure contract** the seed satisfies: `parseKitchenSeed(json)`
and `validateDishSeed(seed)` (schema + exactly-one-record honest-empty), reusable by this
ticket's test to grade the *scaffolded* seed.json. `dish-seed.test.ts` already reads the example
file and validates it (the drift-guard precedent).

## Build / packaging facts that constrain the solution

- The shipped artifact is **one self-contained binary** via `bun build --compile src/cli.ts`
  (`src/release/compile.ts`, `CLI_ENTRY="src/cli.ts"`). `examples/` is **not** shipped beside
  the binary → **reading the seed from disk at runtime is impossible for a brew install.**
- `tsconfig.json`: `moduleResolution:"bundler"`, `types:["bun"]`, `include:["src"]`,
  `verbatimModuleSyntax`, `noUncheckedIndexedAccess`. `examples/` is outside `include` (so the
  seed's own `.astro`/configs are not type-checked by the repo gate), but a file *imported from*
  `src` is resolved by tsc.
- Verified empirically this session (probe, then cleaned up):
  - `bun build --compile` **embeds** `import s from "./f.ext" with { type: "text" }` — the
    binary printed the asset after the source file was moved away.
  - `tsc --noEmit` under this repo's config is **clean** on a text import of an arbitrary
    extension (`.toml`) — no ambient `*.ext` declaration needed (`bundler` resolution + import
    attribute suffices). `s` is assignable to `string`.
  - `bun test` runs source directly and Bun natively supports text imports.

## Existing tests this ticket touches (will break without updates)

- `init-core.test.ts:229` — `expect(availableTemplates()).toEqual(["hackathon","minimal"])`.
- `init-effect.test.ts:288` — unknown-template refusal asserts `available:["hackathon","minimal"]`.
- `init-core.test.ts:243-250` — **one-way-to-lisa invariant**: *every* overlay entry must not be
  a `LISA_MARKER` and must not be `.gitignore`. The kitchen overlay writes a root `.gitignore`
  (correct for a standalone fresh-app workspace) → this invariant as written would fail.
- `init-core.test.ts:232-241` — honest-empty: every overlay file has `countDemandRows===0`.
  Verified: **no** kitchen seed file starts a line with `vend chain "` or `- **E-<d>` → passes.

## Constraints & assumptions surfaced

- **Standalone.** "into an empty dir" ⇒ kitchen must bypass the lisa gate (like `minimal`); the
  clean-room phase of E-062 is a hands-off fresh-repo drive (an empty dir).
- **Base + overlay.** The cook drives with `vend steer`/`vend work` (the READMEs say so) → kitchen
  must also lay the base vend board tree; `mergeManifests(SCAFFOLD_MANIFEST, overlay)` already does.
- **Open seam flagged by the deps' reviews (01-01 #1, 01-02 #1):** the two seeds co-own
  `package.json`/`astro.config.mjs` and the EmDash↔Astro integration was *not* built together;
  this ticket scaffolds the seed **as authored** and must not invent the unbuilt EmDash wiring.
- One-way-to-lisa still holds: the overlay writes **no** `CLAUDE.md`/`.lisa.toml`; for a
  standalone empty dir there is no lisa project whose `.gitignore` could be clobbered.
