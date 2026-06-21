# T-058-01 Review — vend-init-template-overlay-seam

Handoff document. What changed, how it's covered, what a reviewer should know.

## What the ticket asked

Add `vend init --template <name>` — overlay a named template onto the base E-040 scaffold through the
SAME converge planner (write-if-absent, never clobber, DATA). Unknown name → a clean refusal listing
available templates. Honest-empty held (overlay adds structure/charter/SEED, never demand); bare `vend
init` byte-identical. This ticket is the **seam + a trivial registry** so `--template hackathon`
resolves; the template *content* is T-058-02/03.

## What changed

One commit: `b9110d7`. Six source files, five work artifacts.

### `src/init/init-core.ts` (PURE core, +~55 lines)
- **`mergeManifests(base, overlay)`** — overlay entry OVERRIDES a same-path base entry in the base's
  slot (position kept → parent-before-child stays creation-safe); overlay-only entries appended in
  order. The merge-before-converge that lets a template's tuned file win over the base stub.
- **`planTemplate(existing, base, overlay)`** = `planInit(existing, mergeManifests(...))` — the AC's
  named pure planner.
- **`TEMPLATE_REGISTRY`** (`{ hackathon: [SEED.md stub] }`), **`resolveTemplate`**, **`availableTemplates`**
  (sorted). `HACKATHON_SEED_STUB` private, honest-empty.

### `src/init/init-effect.ts` (effect, ~+20 lines)
- **`InitOutcome`** gains `unknown-template { name, available }` — a typed andon (DATA, nothing written).
- **`runInit(projectRoot, template?)`** — lisa gate → (if template) resolve, unknown ⇒ refuse →
  `applyInitScaffold(root, mergeManifests(SCAFFOLD_MANIFEST, overlay))`. Bare path unchanged.
  `applyInitScaffold`/`planInit`/`SCAFFOLD_MANIFEST` **untouched** — the overlay rides the one writer.

### `src/cli.ts` (parse + dispatch)
- `init` parsed variant gains `template?`; `parseInitArgs` learns `--template <name>` (missing value ⇒
  usage); USAGE → `vend init [--template <name>]`; dispatch passes `parsed.template`, maps
  `unknown-template` → stderr + exit 1, tally notes the template. (Validation deferred to dispatch — the
  parser stays registry-free, like a play name.)

### Tests (3 files) + `docs/active/work/T-058-01/` (RDSPI artifacts)

## Test coverage

| AC clause | Test(s) |
|---|---|
| `--template hackathon` applies base THEN overlay, idempotent, DATA | effect: known-template apply (base tree + `SEED.md` created); idempotent second run (zero created, SEED among skips). core: `planTemplate` bare→creates / fully-applied→idempotent |
| unknown template → clean refusal naming available, DATA + non-zero exit | effect: `runInit(root,"bogus")` → `{kind:"unknown-template",name,available:["hackathon"]}`, nothing written. core: `availableTemplates` sorted. (exit-1 is the untested dispatch shell — pinned by the typed outcome) |
| bare `vend init` byte-identical; non-lisa still refuses | effect: bare `runInit` (no SEED.md); lisa-gate-precedes-template. parse: `["init"]` deep-equals `{cmd:"init"}` |
| honest-empty held; `planTemplate` unit-tested; effect temp-dir tested | core: registry overlay `countDemandRows === 0`, one-way-to-lisa path check; `planTemplate` direct + equivalence. effect: board honest-empty after overlay |
| no-clobber (never overwrites an edited file) | effect: user-edits `SEED.md` → second run leaves it byte-identical. core: `mergeManifests` is pre-disk; `planInit` skips present paths |
| `bun run check:*` green | typecheck clean; `check:test` → **1313 pass / 0 fail** |

- Targeted trio (init-core + init-effect + cli): **145 pass**.
- Full gate: `tsc --noEmit` clean; full suite **1313 / 0**.

## Design decisions a reviewer should sanity-check

1. **Merge-before-converge, not apply-twice.** The subtlety: no-clobber is against the DISK, not
   base-vs-overlay. A naive "apply base then apply overlay" would let the base stub win and skip a
   template's override. `mergeManifests` resolves the override BEFORE `planInit` consults the disk, so
   the overlay's content lands while user edits are still never clobbered. The `planTemplate` override
   + idempotency tests pin this.
2. **One writer.** The effect reuses `applyInitScaffold(root, merged)` rather than a second write loop.
   `planTemplate` is the canonical pure planner (exported + unit-tested, with an equivalence assertion
   to `planInit(merged)`); the effect reaches the identical plan through the existing reviewed writer.
   This mirrors `countDemandRows` (a tested pure helper exposed ahead of full wiring) — not dead code.
3. **Trivial registry on purpose.** `hackathon` maps to a single honest-empty `SEED.md` stub. The rich
   content (tuned charter override, shelf-note, EXPECTED-OUTCOME) is T-058-02/03. `mergeManifests`'s
   override capability is proven now via a FIXTURE overlay, so T-058-03's tuned-charter override is ready.

## Open concerns / limitations

- **None blocking.** Additive seam; base scaffold and converge writer untouched.
- **`SEED.md` lands at project root.** Chosen per the brief's drive (`$EDITOR SEED.md` after `cd`).
  It is vend-owned (not a lisa marker / root `.gitignore`); the one-way-to-lisa test asserts overlays
  never name a lisa-owned path. If a future template wants a nested SEED, it just lists the nested path.
- **Exit code (1) for `unknown-template`** lives in the untested `import.meta.main` dispatch shell (house
  pattern). The typed `InitOutcome` is fully tested; the shell mapping is a one-line mirror of `not-lisa`.
- **`mergeManifests` "override keeps base position"** assumes the overlay does not need to re-order a
  base entry. For an override that also changes kind dir→file (or vice-versa) at a path with existing
  children, the author must keep the subtree coherent — not a concern for file-content overrides (the
  charter case), noted for completeness.

## Handoff to T-058-02 / T-058-03

The seam is live. Add a template = one `TEMPLATE_REGISTRY` entry. T-058-03's tuned `charter.md` overrides
the base `CHARTER_STUB` by adding a `docs/knowledge/charter.md` entry to the hackathon overlay (it wins
on the shared path, written only if the user hasn't authored their own). Honest-empty + one-way-to-lisa
are enforced by the registry tests — a future overlay that introduces a demand row or a lisa-owned path
fails the suite loudly.
