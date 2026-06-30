# T-064-01 — Structure

> File-level blueprint for Option C (standalone-template gate bypass + an empty
> `minimal` placeholder). Not code — the shape of the code and the ordering.

## Change inventory

| File | Change | Why |
|------|--------|-----|
| `src/init/init-core.ts` | **modify** | Add `minimal: []` to `TEMPLATE_REGISTRY`; add `STANDALONE_TEMPLATES` set + `isStandaloneTemplate()`; extend the ONE-WAY/header note. |
| `src/init/init-effect.ts` | **modify** | Reorder `runInit` to resolve the template before the gate; bypass the gate for a standalone template. Import `isStandaloneTemplate`. |
| `src/init/init-core.test.ts` | **modify** | Update `availableTemplates()` expectation; add pure tests for `minimal`/`isStandaloneTemplate`/`STANDALONE_TEMPLATES`. |
| `src/init/init-effect.test.ts` | **modify** | Update `unknown-template.available`; add the T-064-01 standalone describe block (empty-dir scaffold, no-clobber converge, no-Doppler/no-repo guard, gate-still-holds). |
| `src/cli.ts` | **none** | Dispatch arm already maps all three outcomes + parses `--template`. |

No files created or deleted. No new runtime imports (the set/predicate are pure TS).

## `src/init/init-core.ts` — module shape

### 1. `TEMPLATE_REGISTRY` (modify)
```ts
export const TEMPLATE_REGISTRY: Readonly<Record<string, readonly ScaffoldEntry[]>> = {
  hackathon: [ /* unchanged */ ],
  // The minimal/placeholder template (E-061, T-064-01): an EMPTY overlay — it adds no
  // files. The base SCAFFOLD_MANIFEST already lays a complete, honest-empty, usable
  // workspace; `minimal` exists to mark the STANDALONE path (the lisa gate is bypassed
  // for it), so a brew-installed binary can `vend init --template minimal` into an empty
  // dir with no checkout. Standalone-ness lives in STANDALONE_TEMPLATES, not here.
  minimal: [],
};
```
- Position: append after `hackathon`. `availableTemplates()` (sorts keys) → `["hackathon",
  "minimal"]` for free.

### 2. Standalone policy (new — placed right after the registry, before `availableTemplates`)
```ts
/** The templates that make a STANDALONE workspace (E-061): named with `vend init
 *  --template <name>`, they bypass the lisa-project gate so a brew-installed binary can
 *  lay a fresh workspace into an empty dir with no checkout. A non-standalone overlay
 *  (e.g. `hackathon`) still requires an existing lisa project (one-way overlay). Kept as
 *  a small policy SET beside the registry — gate policy, not overlay content — so the
 *  registry's value shape (and the invariant tests iterating it) stay untouched. */
export const STANDALONE_TEMPLATES: ReadonlySet<string> = new Set(["minimal"]);

/** Does this template make a standalone workspace (gate-bypassing)? PURE. Membership in
 *  {@link STANDALONE_TEMPLATES}. Unknown names are not standalone (false). */
export function isStandaloneTemplate(name: string): boolean {
  return STANDALONE_TEMPLATES.has(name);
}
```
- Public boundary: both exported (the effect imports `isStandaloneTemplate`; tests assert
  on both). Invariant: every standalone name MUST be a registry key (a pure test pins it).

### 3. Header note (modify)
Extend the "ONE-WAY TO LISA" paragraph: the base manifest still writes only vend-owned
paths; the standalone bypass is a **gate** relaxation (E-061), it writes no lisa-owned
file — one-way-to-lisa is preserved.

## `src/init/init-effect.ts` — `runInit` shape

### Import (modify)
Add `isStandaloneTemplate` to the existing `./init-core.ts` import list (already pulls
`availableTemplates, isLisaProject, mergeManifests, planInit, resolveTemplate,
SCAFFOLD_MANIFEST, ScaffoldEntry`).

### `runInit` (rewrite the body; signature unchanged)
Ordering — resolve template, then gate (per Design):
```ts
export async function runInit(projectRoot, template?): Promise<InitOutcome> {
  const entries = await readdir(projectRoot);
  let overlay: readonly ScaffoldEntry[] | undefined;
  if (template !== undefined) {
    overlay = resolveTemplate(template);
    if (!overlay) return { kind: "unknown-template", name: template, available: availableTemplates() };
  }
  // Gate: bare init and non-standalone overlays require an existing lisa project. A
  // STANDALONE template (E-061) declares "make a workspace here, no checkout" → bypass.
  const standalone = template !== undefined && isStandaloneTemplate(template);
  if (!standalone && !isLisaProject(entries)) return { kind: "not-lisa", root: projectRoot };
  const manifest = overlay ? mergeManifests(SCAFFOLD_MANIFEST, overlay) : SCAFFOLD_MANIFEST;
  return { kind: "scaffolded", result: await applyInitScaffold(projectRoot, manifest) };
}
```
- Behavior deltas vs. today: (1) template resolved before gate; (2) standalone bypass.
  Both documented in the function doc-comment. `not-lisa`/`unknown-template`/`scaffolded`
  shapes unchanged. `mergeManifests(base, [])` returns base unchanged, so the standalone
  empty-overlay path is byte-identical to a base apply.
- Header doc-comment (modify): add the E-061 standalone clause and the reordering note
  (an unknown template now refuses before the gate).

## Test shape

### `src/init/init-core.test.ts` (modify)
- `:227` change `["hackathon"]` → `["hackathon", "minimal"]`.
- New `describe("STANDALONE_TEMPLATES / minimal (T-064-01)")`:
  - `resolveTemplate("minimal")` is defined and `toEqual([])` (empty overlay).
  - `isStandaloneTemplate("minimal")` true; `isStandaloneTemplate("hackathon")` false;
    `isStandaloneTemplate("nope")` false.
  - **invariant**: every name in `STANDALONE_TEMPLATES` is a key of `TEMPLATE_REGISTRY`.
  - `planTemplate([], SCAFFOLD_MANIFEST, [])` deep-equals `planInit([], SCAFFOLD_MANIFEST)`
    (the empty overlay converges to the base — all creates).
- Existing `:230`/`:241` invariant loops still pass unchanged (empty overlay adds no entry).

### `src/init/init-effect.test.ts` (modify)
- `:282` change `available: ["hackathon"]` → `["hackathon", "minimal"]`.
- New `describe("runInit — standalone template, no clone / no Doppler (T-064-01)")`:
  1. **empty dir scaffolds** — `mkdtemp` (no marker, no `.git`); assert it is NOT a lisa
     project going in; `runInit(dir, "minimal")` → `scaffolded`; every `SCAFFOLD_MANIFEST`
     path exists; board honest-empty; created tally == manifest length, skipped == [].
  2. **no-clobber converge** — second `runInit(dir, "minimal")` → `created: []`, skipped ==
     manifest length; a user-edited manifest file (e.g. `docs/knowledge/vision.md`) survives
     byte-identical across the re-run.
  3. **no Doppler dependency** — snapshot+delete all `DOPPLER_*` from `process.env`, run
     `runInit(dir, "minimal")`, assert `scaffolded`; restore env in `finally`.
  4. **no repo dependency** — assert no `.git` exists under the dir after the run (init
     never created one) and the dir was bare to begin with.
  5. **gate still holds for non-standalone paths** — in the same empty-dir shape: bare
     `runInit(dir)` → `not-lisa`; `runInit(dir, "hackathon")` → `not-lisa` (regression pin
     for `:138`/`:293`, restated against the standalone fixture).

## Ordering of edits (so each step type-checks/tests independently)
1. `init-core.ts`: registry entry + standalone set/predicate + header note.
2. `init-core.test.ts`: update `:227`, add pure tests. (Run — green.)
3. `init-effect.ts`: import + `runInit` rewrite + doc-comments.
4. `init-effect.test.ts`: update `:282`, add standalone block. (Run — green.)
5. Full `bun run check`.

## Risk surface
- Single behavioral reorder (template-before-gate) — covered by restating `:138`/`:293`
  against the standalone fixture and leaving the originals intact.
- Two expectation updates are mechanical and lockstep with the new registry key.
- No new deps, no addon, no env reads → the no-Doppler/no-repo property is structural.
