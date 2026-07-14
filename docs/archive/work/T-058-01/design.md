# T-058-01 Design — vend-init-template-overlay-seam

Decisions, grounded in research. Chosen approach + rejected alternatives.

## The shape of the work

Four moving parts: (1) how base + overlay combine into a plan; (2) the template registry + lookup;
(3) the effect threading the overlay; (4) the CLI parse + dispatch. Each grounded in an existing seam.

---

## Decision 1 — overlay semantics: MERGE-then-converge (not apply-twice)

The central question (research §constraints): within one `vend init --template hackathon`, base and
overlay may name the same path (e.g. a *tuned* `charter.md` vs the base stub). No-clobber is against
the **disk**, not base-vs-overlay. Two candidate mechanics:

| Option | Mechanic | Verdict |
|---|---|---|
| **A. Merge then converge** (chosen) | Build an *effective manifest* = base with overlay entries OVERRIDING same-path base entries and overlay-only entries appended; then `planInit(disk, effective)`. | Overlay content wins for shared paths; written once if absent on disk; no-clobber + idempotency preserved by the unchanged converge. |
| B. Apply base, then apply overlay sequentially | `applyInitScaffold(base)` then `applyInitScaffold(overlay)`. | **Rejected:** base seeds the stub `charter.md` first; the overlay's tuned charter then hits an existing path and is SKIPPED — the tuning is silently lost. Two scans, two write passes, wrong result. |

So the pure decision is a **merge** + the existing converge. Concretely:

- **`mergeManifests(base, overlay): ScaffoldEntry[]`** — PURE. Overlay entries override base entries
  at the same normalized path (base keeps its *position* so parent-before-child ordering stays valid,
  but takes the overlay's contents/kind); overlay-only entries are appended in overlay order. The
  overlay author keeps internal parent-before-child order for any new subtree.
- **`planTemplate(existing, base, overlay): InitPlan`** — PURE = `planInit(existing,
  mergeManifests(base, overlay))`. The AC's named pure planner; unit-tested directly.

Why no-clobber still holds: the merge happens **before** the disk is consulted; `planInit` then marks
any path already on disk `skip`. A user-edited `charter.md` (present on disk) is skipped regardless of
whether base or overlay defined it — the edit is never touched. Idempotency: a fully-applied template
project → every effective path present → zero creates.

---

## Decision 2 — the template registry (trivial, in init-core.ts)

```ts
export const TEMPLATE_REGISTRY: Readonly<Record<string, readonly ScaffoldEntry[]>> = { hackathon: HACKATHON_OVERLAY };
export function availableTemplates(): readonly string[]   // sorted Object.keys — for the refusal list
export function resolveTemplate(name: string): readonly ScaffoldEntry[] | undefined
```

- Lives in the PURE core beside `SCAFFOLD_MANIFEST` — a registry of names→overlay manifests is plain
  data, no fs. `resolveTemplate` is the lookup the effect gates on; `availableTemplates` feeds the
  refusal message (sorted, deterministic).
- **`HACKATHON_OVERLAY` is minimal this ticket** — a single root `SEED.md` stub (structure/knowledge,
  honest-empty). Rationale: the ticket scopes T-058-01 as "the seam + a trivial registry so
  `--template hackathon` resolves"; the rich content (tuned charter override, shelf-note,
  EXPECTED-OUTCOME, the real one-line SEED) is T-058-02/03. Registering a stub keeps the seam
  observable (the overlay demonstrably adds a file beyond base) without pre-empting the content tickets.
- **Merge-override is a capability, not yet used by hackathon.** `mergeManifests`'s override path is
  exercised by a focused FIXTURE overlay in tests (a fixture that re-defines a base file), so the
  capability T-058-03's tuned charter will rely on is proven now, without baking a charter override
  into the trivial registry prematurely.

**Rejected:** putting the registry in the effect or a new module. It is pure data + pure lookup; the
core is its home (the `SCAFFOLD_MANIFEST` precedent). A new module would be ceremony for ~10 lines.

---

## Decision 3 — the effect: one writer, extended composition

- **`InitOutcome`** gains a third kind:
  `{ readonly kind: "unknown-template"; readonly name: string; readonly available: readonly string[] }`
  — a typed andon (DATA), mirroring `not-lisa`. The CLI maps it to a fix-it hint + non-zero exit.
- **`runInit(projectRoot, template?: string)`** — extended:
  1. `readdir` → `isLisaProject` false ⇒ `not-lisa` (unchanged; writes nothing).
  2. If `template` given: `resolveTemplate(template)` → undefined ⇒ `unknown-template` (writes nothing).
  3. Apply: with a template, `applyInitScaffold(projectRoot, mergeManifests(SCAFFOLD_MANIFEST,
     overlay))`; without, `applyInitScaffold(projectRoot)` — the exact E-040 path.
- **`applyInitScaffold` is UNCHANGED** — it already takes a `manifest` and scans+converges+writes it.
  Passing the merged manifest routes the overlay through the identical no-clobber/`wx`/EEXIST writer.
  This keeps ONE write path (no duplicated scan/write loop).

On `planTemplate` vs the effect: `applyInitScaffold(root, mergeManifests(b, o))` reaches a plan
*identical to* `planTemplate(disk, b, o)` by construction (both are `planInit(disk,
mergeManifests(b,o))`). `planTemplate` is the canonical PURE planner the AC names — exported and
unit-tested, including an equivalence assertion to `planInit(existing, mergeManifests(...))` that
documents the tie. This mirrors `countDemandRows` (a tested pure helper exposed ahead of full wiring),
so `planTemplate` is meaningful API, not dead code.

**Rejected:** a separate `applyTemplateScaffold` duplicating the scan+write loop, or refactoring
`applyInitScaffold` to take an `overlay?` param. Both add surface for no behavioral gain over passing
the merged manifest to the existing, reviewed writer.

---

## Decision 4 — CLI parse + dispatch

- **`ParsedCommand` init variant:** `{ readonly cmd: "init"; readonly template?: string }`. Spread
  `template` only when present so bare `vend init` stays deep-equal to `{ cmd: "init" }` (the existing
  `cli.test.ts` assertion + byte-identical AC).
- **`parseInitArgs`** — replace the "any arg is an error" body with a loop recognizing `--template
  <name>` (the `parseSvgArgs` `--out` idiom: read next word; missing or `--`-prefixed ⇒
  `missing --template <name>` usage). Any other token ⇒ the existing `unexpected init argument: <a>`
  usage (so `["init","junk"]` and `["init","--force"]` keep their current outcomes). **Validation of
  the name is deferred to dispatch** (against the registry), exactly as a play name is validated at
  dispatch, keeping the parser free of the core import.
- **`USAGE`** — `vend init` → `vend init [--template <name>]`.
- **Dispatch arm** — `runInit(process.cwd(), parsed.template)`; add an `unknown-template` branch
  (stderr `unknown template "<name>" — available: <list>` + exit 1) beside `not-lisa`; the tally line
  notes the template when present. (The `import.meta.main` shell stays untested, per house pattern.)

---

## Test strategy (Decision 5)

- **Pure (`init-core.test.ts`):** `mergeManifests` (override wins; overlay-only appended; order
  preserved), `planTemplate` (overlay path created; idempotent re-run → zero creates; equivalence to
  `planInit∘mergeManifests`), `TEMPLATE_REGISTRY`/`resolveTemplate`/`availableTemplates` (hackathon
  resolves; unknown → undefined; overlay is honest-empty via `countDemandRows`).
- **Guarded-live (`init-effect.test.ts`):** `runInit(root, "hackathon")` applies base+overlay, the
  SEED stub exists, board still honest-empty, idempotent second run (zero created); `runInit(root,
  "bogus")` → `unknown-template` writing NOTHING; bare `runInit(root)` unchanged.
- **Parse (`cli.test.ts`):** `["init","--template","hackathon"]` → `{ cmd:"init", template:"hackathon" }`;
  `["init"]` still deep-equals `{ cmd:"init" }`; `["init","--template"]` (missing value) → usage; USAGE
  contains `--template`.
- No live model. `bun run check:*` (typecheck + full `bun test`) is the gate.

## Out of scope (guardrails)

- The hackathon template CONTENT (Astro seed, tuned charter, shelf-note, EXPECTED-OUTCOME) — T-058-02/03.
- `vend doctor` integration, the SVG-beside-app serve, the live drive — later E-058 tickets.
