# T-058-01 Structure — vend-init-template-overlay-seam

The blueprint: exact files, exact insertions, public surface, ordering. Not code — its shape.

## Files touched

| File | Change | Why |
|---|---|---|
| `src/init/init-core.ts` | **modify** — add `mergeManifests`, `planTemplate`, the `TEMPLATE_REGISTRY` + `HACKATHON_OVERLAY` + `resolveTemplate` + `availableTemplates` | the pure overlay planner + trivial registry |
| `src/init/init-effect.ts` | **modify** — extend `InitOutcome` + `runInit` for the template path | thread the overlay through the one writer |
| `src/cli.ts` | **modify** — `init` parsed-variant `template?`, `parseInitArgs`, USAGE, dispatch arm | the `--template` surface + refusal |
| `src/init/init-core.test.ts` | **modify** — merge/planTemplate/registry unit tests | pure coverage |
| `src/init/init-effect.test.ts` | **modify** — `runInit` template + unknown-template guarded-live | effect coverage |
| `src/cli.test.ts` | **modify** — `--template` parse cases | parse coverage |

No new files. No deletions. No new module (registry is pure data in the core — the `SCAFFOLD_MANIFEST` home).

## `src/init/init-core.ts` — additions

### A. The trivial hackathon overlay seed (beside the other seed consts, ~`:123`)

```ts
/** The hackathon template's SEED — the ONE thing the user edits (brief piece B). A STUB this ticket:
 *  T-058-01 is the seam + a trivial registry; the rich example seed/charter/shelf-note are T-058-02/03.
 *  Structure/knowledge, ZERO demand (honest-empty IA-3/IA-4) — never a `vend chain "…"` line. */
const HACKATHON_SEED_STUB = `# Seed — your one-line idea

_Replace this line with the one thing you're building (e.g. "A web app that helps solo hackathon-goers
find a team by skill + idea overlap"). The seed is the only input you author; \`vend steer\` reads it._
`;
```

### B. The registry + lookups (after `SCAFFOLD_MANIFEST`, ~`:152`)

```ts
/** A named template's OVERLAY manifest — vend-owned paths layered over the base scaffold by
 *  `vend init --template <name>`. The hackathon overlay is trivial here (a SEED stub); its rich
 *  content is T-058-02/03. Adding a template = one registry entry. The single source of valid names. */
export const TEMPLATE_REGISTRY: Readonly<Record<string, readonly ScaffoldEntry[]>> = {
  hackathon: [{ kind: "file", path: "SEED.md", contents: HACKATHON_SEED_STUB }],
};

/** The available template names, sorted — the deterministic list a clean refusal names (mirrors the
 *  `LISA_MARKERS` membership discipline; sorted so the message is stable). PURE. */
export function availableTemplates(): readonly string[] {
  return Object.keys(TEMPLATE_REGISTRY).sort();
}

/** Resolve a template name → its overlay manifest, or `undefined` for an unknown name (the effect
 *  maps that to a typed `unknown-template` andon). PURE — a plain registry lookup. */
export function resolveTemplate(name: string): readonly ScaffoldEntry[] | undefined {
  return TEMPLATE_REGISTRY[name];
}
```

### C. The pure overlay planner (after `planInit`, ~`:201`)

```ts
/** Merge an OVERLAY manifest over a BASE: an overlay entry OVERRIDES a base entry at the same
 *  (normalized) path — base keeps its position so parent-before-child ordering stays valid, but
 *  takes the overlay's kind+contents — and overlay-only entries are appended in overlay order. PURE,
 *  deterministic. The merge is what lets a template's tuned file win over the base stub BEFORE the
 *  disk is consulted; no-clobber is then enforced against the disk by {@link planInit}, unchanged. */
export function mergeManifests(
  base: readonly ScaffoldEntry[],
  overlay: readonly ScaffoldEntry[],
): ScaffoldEntry[] {
  const overlayByPath = new Map<string, ScaffoldEntry>();
  for (const e of overlay) overlayByPath.set(normalizePath(e.path), e);
  const seen = new Set<string>();
  const merged: ScaffoldEntry[] = [];
  for (const e of base) {
    const p = normalizePath(e.path);
    merged.push(overlayByPath.get(p) ?? e); // overlay overrides in the base slot
    seen.add(p);
  }
  for (const e of overlay) {
    const p = normalizePath(e.path);
    if (!seen.has(p)) { merged.push(e); seen.add(p); } // overlay-only, appended in order
  }
  return merged;
}

/** The template converge planner: merge base+overlay, then converge against `existing` — so the
 *  overlay's content lands (override) while no-clobber/idempotency hold (it is {@link planInit} over
 *  the effective manifest). PURE. `vend init --template` reaches the IDENTICAL plan via
 *  `applyInitScaffold(root, mergeManifests(base, overlay))` — one writer, this the named pure unit. */
export function planTemplate(
  existing: Iterable<string>,
  base: readonly ScaffoldEntry[],
  overlay: readonly ScaffoldEntry[],
): InitPlan {
  return planInit(existing, mergeManifests(base, overlay));
}
```

`mergeManifests` reuses the module-private `normalizePath` (same file — no export needed).

## `src/init/init-effect.ts` — modifications

1. **Import** (`:31`): add `mergeManifests`, `resolveTemplate`, `availableTemplates` from `./init-core.ts`.
2. **`InitOutcome`** (`:112`): add a third member —
   `| { readonly kind: "unknown-template"; readonly name: string; readonly available: readonly string[] }`.
   Doc: a clean refusal (DATA, nothing written), the CLI maps it to the fix-it hint + non-zero exit.
3. **`runInit`** (`:130`): signature → `runInit(projectRoot: string, template?: string)`. Body:
   - `readdir` → `!isLisaProject` ⇒ `{ kind: "not-lisa", root }` (unchanged).
   - `if (template !== undefined)`: `const overlay = resolveTemplate(template);`
     `if (!overlay) return { kind: "unknown-template", name: template, available: availableTemplates() };`
     `const result = await applyInitScaffold(projectRoot, mergeManifests(SCAFFOLD_MANIFEST, overlay));`
     `return { kind: "scaffolded", result };`
   - else: `applyInitScaffold(projectRoot)` → `{ kind: "scaffolded", result }` (the E-040 path).
   - Update the doc-comment: the template overlay rides the same writer; an `unknown-template` refusal
     writes NOTHING (checked before any apply); one-way-to-lisa held (overlay = vend-owned paths).
   `SCAFFOLD_MANIFEST` is already imported (`:31`).

## `src/cli.ts` — modifications

1. **`ParsedCommand`** (`:91`): `{ readonly cmd: "init" }` → `{ readonly cmd: "init"; readonly template?: string }`.
2. **`USAGE`** (`:27`): `"       vend init\n"` → `"       vend init [--template <name>]\n"`.
3. **`parseInitArgs`** (`:219`): replace the `argv.length > 1` reject with a loop:
   ```ts
   let template: string | undefined;
   for (let i = 1; i < argv.length; i++) {
     const a = argv[i] as string;
     if (a === "--template") {
       const word = argv[++i];
       if (!word || word.startsWith("--")) return { cmd: "usage", error: "missing --template <name>" };
       template = word;
     } else {
       return { cmd: "usage", error: `unexpected init argument: ${a}` };
     }
   }
   return template ? { cmd: "init", template } : { cmd: "init" };
   ```
   Preserves: `["init"]` → `{ cmd: "init" }`; `["init","junk"]` / `["init","--force"]` → unexpected-arg usage.
   Update the doc-comment: init now takes ONE optional flag, `--template <name>`, validated at dispatch.
4. **Dispatch arm** (`:844`): `const outcome = await runInit(process.cwd(), parsed.template);` and add,
   after the `not-lisa` branch:
   ```ts
   if (outcome.kind === "unknown-template") {
     process.stderr.write(`unknown template "${outcome.name}" — available: ${outcome.available.join(", ")}\n`);
     process.exit(1);
   }
   ```
   Tally line notes the template: `scaffolded${parsed.template ? ` --template ${parsed.template}` : ""}`.

## Public surface added

- `init-core.ts`: `TEMPLATE_REGISTRY`, `availableTemplates()`, `resolveTemplate()`, `mergeManifests()`,
  `planTemplate()`. (`HACKATHON_SEED_STUB` stays private.)
- `init-effect.ts`: the `unknown-template` `InitOutcome` member; `runInit`'s optional `template` param.
- `cli.ts`: the `init` variant's `template?` field.

## Ordering & boundaries

- Core first (types/functions the effect imports), then effect, then CLI, then tests — each layer
  compiles against the one below.
- `applyInitScaffold`, `planInit`, `SCAFFOLD_MANIFEST`, the seed consts, `isLisaProject`,
  `countDemandRows`, `normalizePath` — all UNCHANGED. The overlay rides existing seams.
- No write path beyond the manifest; `demand.md`/`demand-cleared.md` untouched by the overlay
  (honest-empty); the registry names only vend-owned paths (one-way-to-lisa).
