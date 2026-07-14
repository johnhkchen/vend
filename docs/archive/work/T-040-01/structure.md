# T-040-01 — Structure: the blueprint

File-level shape of the change. Not code — the contract the code fills.

## Files

| File | Op | Role |
|---|---|---|
| `src/init/init-core.ts` | **create** | the pure manifest + planner + predicate |
| `src/init/init-core.test.ts` | **create** | pure-function unit tests (the AC) |

No other files change. Nothing impure. `cli.ts`, `package.json`, gitignores —
untouched (the write effect + dispatch arm are T-040-02 and a later E-040 slice).

## `src/init/init-core.ts` — public surface (in file order)

A header comment stating the rule (mirrors `committed-core.ts`): *the converge
**logic** lives here, addon-free; the fs write effect (T-040-02) is a thin shell that
applies a plan this module produces. PURE: every export takes plain values, returns
plain values — no fs, clock, process, or addon.*

### Types

```ts
export type ScaffoldEntry =
  | { readonly kind: "dir";  readonly path: string }
  | { readonly kind: "file"; readonly path: string; readonly contents: string };

export type InitAction =
  | { readonly op: "create"; readonly entry: ScaffoldEntry }
  | { readonly op: "skip";   readonly path: string; readonly kind: "dir" | "file" };

export type InitPlan = {
  readonly actions: readonly InitAction[];
  readonly creates: readonly ScaffoldEntry[];
  readonly skips:   readonly string[];
};
```

### Constants (the shared contracts)

- `LISA_MARKERS = ["CLAUDE.md", ".lisa.toml"] as const` — the lisa-detection contract.
- `SCAFFOLD_MANIFEST: readonly ScaffoldEntry[]` — the canonical scaffold (D2/D6). Order
  is parent-before-child, creation-safe. The seed-content strings live in module-local
  `const`s above the manifest (`EMPTY_BOARD`, `EMPTY_ARCHIVE`, `PM_README`,
  `PROCESS_GATE`, `CHARTER_STUB`, `VISION_STUB`, `VEND_GITIGNORE`) so the manifest array
  reads as a clean table of `{kind, path, contents}`.

### Functions

```ts
function normalizePath(p: string): string            // internal: drop ./  + trailing /
export function isLisaProject(existing: Iterable<string>): boolean
export function planInit(
  existing: Iterable<string>,
  manifest?: readonly ScaffoldEntry[],
): InitPlan
export function countDemandRows(contents: string): number
```

- `normalizePath` — internal, not exported. Single place trailing-slash/`./` quirks die.
- `isLisaProject` — normalize listing → `Set`; `LISA_MARKERS.some(m => set.has(m))`.
- `planInit` — normalize `existing` → `Set`; map manifest → `InitAction[]`; derive
  `creates` (entries whose op is create) and `skips` (paths whose op is skip). Manifest
  defaults to `SCAFFOLD_MANIFEST`. Pure, total, deterministic.
- `countDemandRows` — `(contents.match(/^vend chain "/gm)?.length ?? 0) +
  (contents.match(/^- \*\*E-\d/gm)?.length ?? 0)`. The "zero demand rows" measure (D5).

## The manifest contents (17 entries, exact)

**Dirs (10):** `docs/active`, `docs/active/epic`, `docs/active/stories`,
`docs/active/tickets`, `docs/active/work`, `docs/active/pm`, `docs/active/pm/staged`,
`docs/archive`, `docs/knowledge`, `.vend`.

**Files (7):**
- `docs/active/demand.md` → `EMPTY_BOARD`
- `docs/archive/demand-cleared.md` → `EMPTY_ARCHIVE`
- `docs/active/pm/README.md` → `PM_README`
- `docs/active/pm/process-gate.md` → `PROCESS_GATE`
- `docs/knowledge/charter.md` → `CHARTER_STUB`
- `docs/knowledge/vision.md` → `VISION_STUB`
- `.vend/.gitignore` → `VEND_GITIGNORE`

Invariant the code must hold: `countDemandRows(EMPTY_BOARD) === 0` and
`countDemandRows(EMPTY_ARCHIVE) === 0`.

## Seed-content shape (the strings)

- `EMPTY_BOARD` — `# Vend — Demand (the pull board)` + a 2–3 line gloss (signals are
  thin requests-for-clearing; pulled just-in-time) + the empty-state line
  `_No open demand yet — cast `vend steer`/`vend survey` off a seed (IA-3/IA-4)._`.
  **No `vend chain` line.**
- `EMPTY_ARCHIVE` — `# Vend — Cleared demand (compacted ledger)` + one gloss line +
  `_Nothing cleared yet._`. **No `- **E-` line.**
- `PM_README` — `# PM workspace — the PM agent's desk` + the discovery/processing gate
  rule in two lines + a pointer that the PM writes only here, never the active board.
- `PROCESS_GATE` — frontmatter `ready: false` + one line explaining the flag.
- `CHARTER_STUB` / `VISION_STUB` — `# Vend — Charter` / `# Vend — Vision` + a single
  `_Stub — author your project's value function / vision here._` line.
- `VEND_GITIGNORE` — `*\n!.gitignore\n!decisions.jsonl\n`.

## `src/init/init-core.test.ts` — coverage map (mirrors the AC)

Imports **only** `./init-core.ts` (ordinary pure test — the `committed-core.test.ts`
discipline). `describe` blocks:

1. **`planInit` — create-vs-skip set** (AC clause 1):
   - *empty → full scaffold*: `planInit([])` ⇒ `creates.length === manifest.length`,
     `skips` empty, every action `op:"create"`.
   - *full → zero creates*: feed every manifest path as `existing` ⇒ `creates` empty,
     `skips.length === manifest.length`, idempotent (a second `planInit` of the same
     listing is byte-identical).
   - *partial → only the gap*: seed a bare-lisa listing (`CLAUDE.md`, `.lisa.toml`,
     `docs/`, maybe `docs/active`) ⇒ `creates` is exactly the absent entries; assert a
     specific present dir is skipped and a specific absent file is created.
   - *trailing-slash / `./` robustness*: `existing` with `docs/active/` and
     `./.vend` still matches the manifest (normalization).
   - *focused fixture manifest*: a 2-entry manifest proves the create/skip partition
     without depending on the full 17.
2. **`isLisaProject`** (AC clause 2):
   - `CLAUDE.md` present → true; `.lisa.toml` present → true; both → true;
     neither (a non-lisa dir listing) → false; empty listing → false.
3. **zero demand rows** (AC clause 3):
   - `countDemandRows(EMPTY_BOARD) === 0`, `countDemandRows(EMPTY_ARCHIVE) === 0`;
   - the manifest's `demand.md` and `demand-cleared.md` entries (looked up by path)
     have `countDemandRows(entry.contents) === 0`;
   - a positive control: `countDemandRows('vend chain "x"\n- **E-001 — y**')` ===2
     (the counter actually fires, so the zero is meaningful).
4. **manifest sanity**: unique paths; every `file` entry has `contents`; dirs precede
   their children (parent-before-child creation-safety).

## Ordering of work (for Plan)

Types → constants/seed strings → `normalizePath` → `isLisaProject` → `planInit` →
`countDemandRows` → tests. Single commit (one cohesive pure module + its test);
green `bun run check` (baml:gen + typecheck + test) is the gate.

## Boundaries restated

- Pure only. The first import of `node:fs` belongs to T-040-02, never here.
- One-way to lisa: manifest creates only vend-owned paths; root `.gitignore` untouched.
- No CLI wiring this ticket.
