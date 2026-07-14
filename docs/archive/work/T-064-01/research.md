# T-064-01 — Research

> init-template-standalone-no-clone-no-doppler. Extend the existing E-058
> `vend init --template <name>` seam so a brew-installed binary lays a workspace
> into an empty dir with no repo clone and no Doppler, against a minimal/placeholder
> template. Descriptive map — no solutions here.

## The ticket in one line

A brew-installed `vend` binary, run in an **empty directory** with **no checkout**
and **no Doppler env**, must lay a workspace via `vend init --template <name>`. The
AC wants a test for the **no-clobber converge** and for the **absence of any
repo/Doppler dependency**. Epic E-061 explicitly says this slice "ships the seam and
the install path and can validate against a **minimal/placeholder template**, it does
not author the kitchen workspace content" (that content is E-062).

## The init seam as it stands

Three files own the seam; the pure/impure split is strict (mirrors
`ci/committed-core.ts` ↔ effect, `play/*-core.ts` ↔ `*-effect.ts`).

### `src/init/init-core.ts` — the PURE core (addon-free, fs-free)

- `ScaffoldEntry` = `{kind:"dir",path}` | `{kind:"file",path,contents}`. Paths are
  project-root-relative POSIX, no leading `./`.
- `SCAFFOLD_MANIFEST` — the canonical base tree: `docs/active/{epic,stories,tickets,
  work}`, `docs/active/demand.md` (honest-empty board), the PM desk
  (`docs/active/pm/{README,process-gate}.md`, `pm/staged/`), `docs/archive/
  demand-cleared.md`, knowledge stubs (`docs/knowledge/{charter,vision}.md`), and
  `.vend/.gitignore`. **Every base path is vend-owned** — it never names `CLAUDE.md`
  or the root `.gitignore` (the "ONE-WAY TO LISA" header rule).
- `LISA_MARKERS = ["CLAUDE.md", ".lisa.toml"] as const` — the lisa-project predicate's
  membership list. `isLisaProject(existing)` → true iff a listing contains ANY marker.
- `TEMPLATE_REGISTRY: Record<string, readonly ScaffoldEntry[]>` — named overlays. Today
  ONE entry: `hackathon` = `[SEED.md, docs/knowledge/charter.md]` (the tuned charter
  overrides the base stub via `mergeManifests`).
- `availableTemplates()` → sorted keys (today `["hackathon"]`). `resolveTemplate(name)`
  → overlay or `undefined`.
- `mergeManifests(base, overlay)` — overlay overrides a base entry **in its slot**
  (keeps parent-before-child order), appends overlay-only entries. PURE.
- `planInit(existing, manifest=SCAFFOLD_MANIFEST)` — converge planner: per entry,
  present⇒skip / absent⇒create, plus `creates`/`skips` projections. Idempotency falls
  out directly.
- `planTemplate(existing, base, overlay)` = `planInit(existing, mergeManifests(...))`.
- `countDemandRows(contents)` — honest-empty measure (seeds must return 0).

### `src/init/init-effect.ts` — the impure WRITE shell

- Imports only `node:fs/promises`, `node:path`, and the pure core. **No BAML, no
  engine, no network, no Doppler, no git.**
- `applyInitScaffold(root, manifest=SCAFFOLD_MANIFEST)` — scans which manifest paths
  exist (`pathExists` via `stat`/ENOENT), asks `planInit`, writes only `creates`: dirs
  via `mkdir({recursive})`, files via the **exclusive `wx` flag** (O_CREAT|O_EXCL). An
  EEXIST reclassifies create→skip. **No-clobber is absolute**; never read-modify-write.
- `InitOutcome` = `not-lisa{root}` | `unknown-template{name,available}` |
  `scaffolded{result}`.
- `runInit(projectRoot, template?)` — the refuse-or-apply composition:
  1. `readdir(projectRoot)`.
  2. **if `!isLisaProject(entries)` → `not-lisa`** (the gate; writes nothing).
  3. if `template` given: `resolveTemplate` → unknown ⇒ `unknown-template`; else
     `applyInitScaffold(root, mergeManifests(SCAFFOLD_MANIFEST, overlay))`.
  4. else `applyInitScaffold(root)`.

### `src/cli.ts` — the dispatch arm (untested shell)

- `parseInitArgs` parses `init [--template <name>]` PURELY (registry-free; an unknown
  name is the dispatch arm's refusal, not a parse error).
- The `init` dispatch arm calls `runInit(process.cwd(), parsed.template)` and maps
  `not-lisa` / `unknown-template` → stderr fix-it hint + exit 1; `scaffolded` → a
  `created N, skipped M` tally + exit 0. USAGE already advertises
  `vend init [--template <name>]`. **No CLI change is forced by this ticket.**

## The blocking constraint

The lisa-project gate (`init-effect.ts` step 2) **refuses an empty directory** — an
empty dir has neither `CLAUDE.md` nor `.lisa.toml`, so `isLisaProject` is false and
`runInit` returns `not-lisa` **before** any template is applied. This is exactly the
state a brew-installed binary lands in (no checkout). The gate is the thing the ticket
must get past for the standalone path — without weakening it for the bare-`vend init`
overlay-onto-a-real-lisa-checkout contract (E-040).

## Tests that pin current behavior (the blast radius)

- `init-effect.test.ts:293` — **"the lisa gate precedes template resolution — a
  non-lisa root refuses as not-lisa"**: `runInit(nonLisaRoot, "hackathon")` →
  `not-lisa`. Any change must keep `hackathon` (a non-standalone overlay) gated.
- `init-effect.test.ts:138` — bare `runInit(nonLisaRoot)` → `not-lisa`. Unchanged.
- `init-effect.test.ts:282` — `runInit(bareLisa, "bogus")` → `unknown-template` with
  `available: ["hackathon"]`. **Adding a template changes this expected set.**
- `init-core.test.ts:227` — `availableTemplates()` toEqual `["hackathon"]`. **Same.**
- `init-core.test.ts:230` (honest-empty) and `:241` (**"overlays name only vend-owned
  paths — never a lisa-owned root marker (one-way-to-lisa)"**) iterate
  `Object.values(TEMPLATE_REGISTRY)` and assert **no overlay entry is a LISA_MARKER or
  `.gitignore`**. Any new overlay MUST honor these, or the invariant test must move.
- `cli.test.ts:512-524` — `--template` parsing + USAGE. Registry-free; unaffected.

## Doppler / repo dependency — the current truth

- `grep -rl -i doppler src/init` → **none**. `grep "DOPPLER\|process.env" src/init
  src/cli.ts` → **none**. The init path reads **no env at all**.
- The only `git`/`.gitignore` mentions in `init/` are the vend-owned `.vend/.gitignore`
  seed content and test prose — no `git` process spawn, no clone, no checkout read.
- So **the standalone path already has zero Doppler/repo dependency at the code
  level.** The AC's "test covers the absence of any repo/Doppler dependency" is
  therefore a **guard/characterization** test that pins this property against
  regression, not a dependency to remove.

## Build / gate

- `bun run check` = `baml:gen && tsc --noEmit && bun test` (the real gate, per memory
  [[vend-gate-and-dev-setup]]). Tests are ordinary `bun test` over real temp dirs
  (`mkdtemp`), the guarded-live discipline already used throughout `init-effect.test`.

## Constraints & assumptions carried into Design

1. The gate must stay intact for **bare `vend init`** and for **non-standalone
   overlays** (`hackathon`) — pinned by `:293` and `:138`.
2. The one-way-to-lisa invariant (`:241`) and honest-empty (`:230`) are reviewed
   E-058 contracts; prefer a design that leaves them untouched.
3. A "minimal/placeholder template" is explicitly anticipated by the epic — the kitchen
   content is out of scope (E-062). The placeholder need not author rich content.
4. `availableTemplates()` and the `unknown-template.available` list will grow by one;
   their two pinned expectations must be updated in lockstep (legitimate, not a break).
5. No new runtime deps; stay addon-free and env-free so the property the AC pins
   (no Doppler/repo) is structurally true, not merely asserted.
