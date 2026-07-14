# T-058-01 Plan — vend-init-template-overlay-seam

Ordered, independently-verifiable steps. Layer-by-layer so each compiles against the one below.

## Testing strategy

- **Pure unit (`init-core.test.ts`)** — the bulk of the proof, no fs: `mergeManifests`, `planTemplate`,
  the registry. Imports only `./init-core.ts` (the existing discipline).
- **Guarded-live (`init-effect.test.ts`)** — `runInit` template path against a real `mkdtemp` root,
  torn down in `finally`: overlay applied, honest-empty held, idempotent, unknown-template writes nothing.
- **Pure parse (`cli.test.ts`)** — `parseInitArgs` `--template` cases + the preserved bare path.
- **Gate:** `bun run check:typecheck` + `bun run check:test` (= `check:*`) green; ticket AC#4.
- No live model; deterministic; FREE.

## AC → coverage mapping

| AC | Covered by |
|---|---|
| `--template hackathon` applies base THEN overlay, idempotent, DATA | effect: `runInit(root,"hackathon")` creates SEED.md + base tree; second run zero-created. core: `planTemplate` idempotent re-run |
| Unknown template → clean refusal naming available, DATA + non-zero exit | effect: `runInit(root,"bogus")` → `{kind:"unknown-template",name,available:["hackathon"]}`, nothing written. (exit code is the untested dispatch shell — asserted by the typed outcome) |
| bare `vend init` byte-identical; non-lisa still refuses | effect: bare `runInit(root)` == E-040 result; `runInit(nonLisa,"hackathon")` → `not-lisa`. parse: `["init"]` deep-equals `{cmd:"init"}` |
| honest-empty held; `planTemplate` unit-tested; effect temp-dir tested | core: `countDemandRows` over the overlay/board = 0; `planTemplate` direct tests. effect: board honest-empty after overlay |
| `bun run check:*` green | full typecheck + suite |

## Steps

### Step 1 — core: merge + planTemplate + registry
`src/init/init-core.ts` per structure.md §A–C. Add `HACKATHON_SEED_STUB`, `TEMPLATE_REGISTRY`,
`availableTemplates`, `resolveTemplate`, `mergeManifests`, `planTemplate`.
- **Verify:** `bun run check:typecheck` clean.

### Step 2 — core tests
`src/init/init-core.test.ts`: add a `describe` per new unit —
- `mergeManifests`: overlay overrides a same-path base file (contents swap, position kept); overlay-only
  appended; base-only untouched; equal-length/▵ assertions.
- `planTemplate`: over an empty listing, the overlay path is in `creates`; over a fully-merged listing,
  zero creates (idempotent); `planTemplate(existing,b,o)` `toEqual` `planInit(existing, mergeManifests(b,o))`.
- registry: `resolveTemplate("hackathon")` defined, `resolveTemplate("nope")` undefined;
  `availableTemplates()` deep-equals `["hackathon"]`; the overlay is honest-empty
  (`countDemandRows` over every overlay file's contents === 0).
- **Verify:** `bun test src/init/init-core.test.ts` green.

### Step 3 — effect: runInit template path + unknown-template
`src/init/init-effect.ts` per structure.md. Extend the import, `InitOutcome`, `runInit(root, template?)`.
- **Verify:** `bun run check:typecheck` clean.

### Step 4 — effect tests
`src/init/init-effect.test.ts`: add a `describe("runInit — template overlay")` —
- `runInit(seedBareLisa(), "hackathon")` → `scaffolded`; base tree exists; `SEED.md` exists with the
  stub contents; `demand.md` still `countDemandRows === 0`; `created` includes `SEED.md`.
- second `runInit(root, "hackathon")` → `scaffolded`, `created` empty (idempotent over base+overlay).
- pre-edit `SEED.md` then `runInit(root,"hackathon")` → byte-identical (no clobber), `skipped` contains it.
- `runInit(root, "bogus")` → `{ kind:"unknown-template", name:"bogus", available:["hackathon"] }`;
  NO manifest path and no `SEED.md` materialized (refusal is inert).
- `runInit(nonLisaRoot, "hackathon")` → `not-lisa` (gate precedes template resolution).
- bare `runInit(root)` unchanged (a sanity re-assert that the E-040 path is intact).
- **Verify:** `bun test src/init/init-effect.test.ts` green.

### Step 5 — CLI parse + USAGE + dispatch
`src/cli.ts` per structure.md §1–4.
- **Verify:** `bun run check:typecheck` clean.

### Step 6 — CLI tests
`src/cli.test.ts` in the existing init `describe` (`:498`):
- `["init","--template","hackathon"]` → `{ cmd:"init", template:"hackathon" }`.
- `["init"]` still `toEqual({ cmd:"init" })` (no `template` key — byte-identical).
- `["init","--template"]` (missing value) → `{ cmd:"usage", error:"missing --template <name>" }`.
- `["init","junk"]` still → `unexpected init argument: junk` (preserved).
- `USAGE` contains `--template`.
- **Verify:** `bun test src/cli.test.ts` green.

### Step 7 — full gate
- **Verify:** `bun run check:typecheck` && `bun run check:test` green end-to-end (prior suite total +
  the new cases, all passing).

### Step 8 — commit
One atomic commit (a cohesive seam across core/effect/cli + tests):
```
feat(init): vend init --template overlay seam + trivial registry (T-058-01)
```
Body: the pure `mergeManifests`/`planTemplate` overlay planner, the `hackathon` trivial registry, the
`runInit` template path + `unknown-template` refusal, the `--template` CLI parse; base `vend init`
byte-identical; honest-empty + one-way-to-lisa held; content is T-058-02/03.

## Risk & rollback

- **Low risk:** additive — `applyInitScaffold`/`planInit`/`SCAFFOLD_MANIFEST` untouched; the overlay
  rides existing seams. Rollback = revert the single commit.
- **Watch:** the `["init"]`-stays-`{cmd:"init"}` invariant (spread `template` only when present) — an
  existing cli.test assertion guards it. The merge-before-converge ordering (Decision 1) is the one
  subtlety; the `planTemplate` idempotent + override tests pin it.
- **Honest-empty teeth:** the registry-overlay `countDemandRows === 0` test fails loudly if a future
  overlay edit ever introduces a demand row.

## Out of scope (guardrails)

- Hackathon template CONTENT (Astro seed, tuned charter override, shelf-note, EXPECTED-OUTCOME) — T-058-02/03.
- `vend doctor` / SVG-serve / live drive — later E-058 tickets.
- No change to the base scaffold, the converge writer, or bare-`init` behavior.
