# T-058-01 Progress — vend-init-template-overlay-seam

## Status: implementation complete, gate green

All eight plan steps executed. One small in-flight fix (a test type-narrowing), no design deviation.

## Completed

- **Step 1 — core** (`src/init/init-core.ts`): `HACKATHON_SEED_STUB` (private, honest-empty SEED),
  `TEMPLATE_REGISTRY` (`{ hackathon: [SEED.md] }`), `availableTemplates()`, `resolveTemplate()`,
  `mergeManifests(base, overlay)` (override-in-base-slot + append overlay-only), `planTemplate(existing,
  base, overlay)` = `planInit ∘ mergeManifests`. `planInit`/`applyInitScaffold`/`SCAFFOLD_MANIFEST`
  untouched.
- **Step 2 — core tests** (`init-core.test.ts`): `mergeManifests` (override wins, position kept,
  overlay-only appended, empty-overlay identity), `planTemplate` (bare→creates with overlay content,
  fully-applied→idempotent, equivalence to `planInit(merged)`), registry (resolve/available, honest-empty
  via `countDemandRows`, one-way-to-lisa path check).
- **Step 3 — effect** (`src/init/init-effect.ts`): import extended; `InitOutcome` gains
  `unknown-template { name, available }`; `runInit(projectRoot, template?)` — lisa gate → template
  resolve (unknown ⇒ refusal, writes nothing) → `applyInitScaffold(root, mergeManifests(SCAFFOLD_MANIFEST,
  overlay))`; bare path unchanged.
- **Step 4 — effect tests** (`init-effect.test.ts`): known-template apply (base+SEED, board honest-empty),
  idempotent re-run, user-edit no-clobber, unknown-template inert refusal, lisa-gate-precedes-template,
  bare-runInit-unchanged.
- **Step 5 — CLI** (`src/cli.ts`): `init` variant `template?`; USAGE `vend init [--template <name>]`;
  `parseInitArgs` learns `--template <name>` (missing value ⇒ usage); dispatch arm passes
  `parsed.template`, handles `unknown-template` (stderr + exit 1), tally notes the template.
- **Step 6 — CLI tests** (`cli.test.ts`): `--template hackathon` parse, missing-value usage, USAGE
  advertises the flag; bare `["init"]` still deep-equals `{ cmd: "init" }`.
- **Step 7 — gate**: `bun run check:typecheck` clean; `bun run check:test` → **1313 pass / 0 fail**.
  Targeted trio (init-core + init-effect + cli) = 145 pass.

## Deviation from plan

- **One, mechanical:** a first `tsc` run flagged `init-core.test.ts:183` — a `.find(...)?.contents`
  on `ScaffoldEntry` (the `dir` variant has no `contents`). Fixed by narrowing on `kind` first
  (`b && b.kind === "file" ? b.contents : null`), the same idiom the sibling assertion already used.
  Runtime behavior never changed; the suite was green throughout (bun doesn't typecheck) — `tsc` is the
  gate that caught it. No design impact.

## Remaining

- Commit (plan Step 8) — one atomic commit.
- Review phase (`review.md`).

## Notes for T-058-02 / T-058-03

- The overlay seam is live: add a template = one `TEMPLATE_REGISTRY` entry; `--template <name>`
  resolves and overlays through the existing no-clobber writer.
- `mergeManifests` override is tested and ready: T-058-03's **tuned `charter.md`** can override the base
  `CHARTER_STUB` by adding a `docs/knowledge/charter.md` entry to the hackathon overlay — it wins on the
  shared path, written only if the user hasn't authored their own.
- The hackathon overlay is intentionally a single SEED stub here; T-058-02/03 flesh out the real
  example seed, shelf-note, EXPECTED-OUTCOME, and the tuned charter.
