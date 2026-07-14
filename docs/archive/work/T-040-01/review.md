# T-040-01 — Review: the handoff

Self-assessment of the completed work. What a reviewer needs without reading every diff.

## What this ticket delivered

The **pure, addon-free heart of `vend init`** (E-040 / S-040-01): the canonical scaffold
manifest, a converge planner, and the lisa-project predicate — the testable logic of
idempotent scaffolding, **no filesystem touched**. The fs write effect is the sibling
ticket T-040-02 (`depends_on: [T-040-01]`).

## Files changed

| File | Op | Lines | What |
|---|---|---|---|
| `src/init/init-core.ts` | **created** | ~185 | manifest + seed content + `planInit` / `isLisaProject` / `countDemandRows` |
| `src/init/init-core.test.ts` | **created** | ~165 | 20 pure unit tests across the three AC clauses |
| `docs/active/work/T-040-01/*.md` | created | — | RDSPI artifacts (research → review) |

New `src/init/` package, mirroring `src/ci/`'s pure-core convention. No existing file
was modified — the change is purely additive and impure-free (zero `node:fs`/process/
addon imports), so nothing else in the tree could regress (confirmed: full suite green).

## Public surface (for T-040-02 + later E-040 slices)

- `SCAFFOLD_MANIFEST: readonly ScaffoldEntry[]` — 17 entries (10 dirs + 7 seed files),
  parent-before-child order. The single source of truth for the scaffold.
- `planInit(existing, manifest?) → InitPlan` — `{ actions, creates, skips }`. The
  converge primitive: present⇒skip, absent⇒create.
- `isLisaProject(existing) → boolean` — true iff `CLAUDE.md` or `.lisa.toml` present.
- `countDemandRows(contents) → number` — the "honestly empty" measure.
- `LISA_MARKERS`, `ScaffoldEntry`, `InitAction`, `InitPlan` — the contracts/types.

## Acceptance criteria — met

The AC has three clauses; each maps to a passing test block.

1. **"planInit over bare / partial / fully-scaffolded fs listings emits the correct
   create-vs-skip set (empty→full, full→zero, partial→only the gap)."** ✅
   - empty → `creates.length === 17`, all actions `create`;
   - full → `creates` empty, all `skip`, and a second plan is `toEqual` the first
     (idempotency / A5);
   - partial → only the absent entries create; `creates + skips` partition the manifest
     with no overlap or loss. Plus normalization robustness (`docs/active/`, `./.vend`)
     and a focused 2-entry fixture manifest.
2. **"isLisaProject is true only when CLAUDE.md or .lisa.toml is present."** ✅
   each marker alone → true, both → true, neither → false, empty → false, `./CLAUDE.md`
   → true.
3. **"the manifest's board and cleared-archive entries carry zero demand rows."** ✅
   `countDemandRows` is 0 on both seed entries (looked up by path); a positive control
   (`vend chain "…"` + `- **E-001 …`) returns 2 so the zero is meaningful; ordinary
   prose bullets count 0 (no false-positive).

## Test coverage

- **20 tests, 73 assertions**, importing only `./init-core.ts` — an ordinary
  pure-function test (the `committed-core.test.ts` discipline). 100% of the module's
  branches are reachable purely (it is pure by construction).
- **Full gate:** `bun run check` (baml:gen + `tsc --noEmit` strict + `bun test`) →
  **1020 pass / 0 fail across 67 files**. No regressions.
- **Gaps (intentional, not this ticket):** no test exercises real `readdir` output, real
  mkdir/write, or the no-clobber byte-identical guarantee — all of that is **T-040-02**'s
  guarded-live temp-dir test. `normalizePath` is covered indirectly via the trailing-slash
  and `./` cases; it is not exported (internal).

## Design decisions a reviewer should sanity-check

- **`.vend/.gitignore` instead of editing root `.gitignore`.** Deliberate: preserves the
  one-way vend→lisa rule (never mutate a lisa-owned file) and keeps the no-clobber story
  trivial — init only ever *creates* vend-owned paths. The live root `.gitignore`
  expresses the same telemetry-ignore/keep-decisions intent; we localize it. **Confirm
  this is the intended boundary** before T-040-02 wires the write.
- **Knowledge stubs are minimal placeholders** (`charter.md`/`vision.md` one-liners), per
  E-040's PE-7 right-sizing ("rich knowledge-stub content is a follow-up epic"). If a
  reviewer wants richer seeds, that is a separate card, not a fix here.
- **Either marker detects lisa** (not both required) — matches the epic wording and is
  robust to a project shipping only one. A stricter rule would be a one-line change.

## Open concerns / TODO (downstream, not blockers)

- **T-040-02** must compose `isLisaProject` (refuse if false) before applying
  `planInit(existing).creates`, and feed a *real* root listing through the same
  `normalizePath` path (already handled inside the core).
- **Empty-dir persistence:** the manifest lists dirs (e.g. `docs/active/work`) that git
  cannot track while empty. If the scaffold must survive a commit with those dirs
  present, T-040-02 (or a later slice) decides whether to drop a `.gitkeep` — a
  write-effect detail deliberately left out of the pure manifest.
- **CLI `init` arm** in `cli.ts` and a `vend doctor` precondition are later E-040 slices,
  per the epic's explicit scope.

## Critical issues needing human attention

None. The change is additive, pure, fully gated green, and scoped exactly to the AC. The
one judgment call worth a glance is the `.vend/.gitignore`-vs-root boundary (above) —
flagged, not blocking.
