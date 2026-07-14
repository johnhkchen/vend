# T-040-01 — Design: decisions for the pure scaffold core

One module, `src/init/init-core.ts`. Every decision below is grounded in the
research map and the house pure-core idiom. Rejected options are recorded.

## D1 — Module placement & split

**Decision:** `src/init/init-core.ts` (pure) + `src/init/init-core.test.ts`. The
impure write effect lands later as `src/init/init-effect.ts` (T-040-02) and the CLI
`init` arm in `cli.ts`; neither is in scope here.

**Why:** mirrors `src/ci/committed-core.ts` ↔ `check-committed.ts` and
`src/play/work-core.ts` ↔ `work.ts` exactly — the precedent the whole repo follows.
A new `src/init/` package is the natural home (one concern per dir, cf. `src/ci/`).

**Rejected:** putting the planner in `src/play/` (it is not a play — it casts nothing,
spends no mana); inlining into a future `cli.ts` arm (un-unit-testable, violates the
pure-core rule the AC's "unit tests show planInit…" demands).

## D2 — The manifest as one tagged list

**Decision:** a single `readonly ScaffoldEntry[]`, each entry a discriminated union:

```ts
type ScaffoldEntry =
  | { readonly kind: "dir";  readonly path: string }
  | { readonly kind: "file"; readonly path: string; readonly contents: string };
export const SCAFFOLD_MANIFEST: readonly ScaffoldEntry[] = [ … ];
```

Paths are **project-root-relative, POSIX, no leading `./`** (e.g.
`docs/active/demand.md`). This is the single source of truth both `planInit` and the
T-040-02 write effect derive from — nobody re-lists the scaffold (the `SOURCE_PREFIXES`
shared-contract discipline from `committed-core.ts`).

**Why one list, not two (dirs[] + files[]):** self-documenting top-to-bottom, a single
thing to test for "zero demand rows", and the planner stays a single map over one array.
Ordering in the array is *creation-safe* (parents before children) so a naive sequential
write effect needs no topological sort — a courtesy to T-040-02, not relied on by the
pure planner.

**Rejected:** a nested tree object (`{ "docs": { "active": {…} } }`) — prettier but
forces a flattening walk in every consumer and makes "is path X present" awkward; the
flat list is what `readdir`-style existence checks compare against directly.

## D3 — `planInit` signature & semantics

**Decision:**

```ts
type InitAction =
  | { readonly op: "create"; readonly entry: ScaffoldEntry }
  | { readonly op: "skip";   readonly path: string; readonly kind: "dir" | "file" };
type InitPlan = {
  readonly actions: readonly InitAction[];   // one per manifest entry, manifest order
  readonly creates: readonly ScaffoldEntry[]; // the create subset (what T-040-02 writes)
  readonly skips:   readonly string[];        // paths already present
};
function planInit(
  existing: Iterable<string>,
  manifest: readonly ScaffoldEntry[] = SCAFFOLD_MANIFEST,
): InitPlan;
```

Logic: normalize `existing` into a `Set<string>` (after `normalizePath` — strip a
leading `./` and any trailing `/`, so a `readdir` that yields `docs/active/` matches a
manifest `docs/active`). For each manifest entry: present ⇒ `skip`, absent ⇒ `create`.
`creates`/`skips` are convenience projections of `actions` so callers and tests don't
re-filter.

**Why a defaulted `manifest` param:** the AC's tests drive `planInit` over crafted
listings against a manifest; defaulting to `SCAFFOLD_MANIFEST` keeps the real call
ergonomic (`planInit(existing)`) while letting tests pass a tiny fixture manifest for
focused create-vs-skip assertions. Pure, deterministic, total.

**The three AC cases fall out directly:**
- empty listing → every entry `create` (`creates.length === manifest.length`),
- full listing (all paths present) → zero `create`, all `skip` (idempotent re-run),
- partial listing → only the absent entries `create` ("only the gap").

**Rejected:** returning just a `string[]` of paths to create — loses the `dir`/`file`
kind + the seed `contents` the write effect needs, forcing T-040-02 to re-join against
the manifest. Returning the full `InitPlan` keeps the seam clean.

## D4 — `isLisaProject` as a separate predicate

**Decision:**

```ts
export const LISA_MARKERS = ["CLAUDE.md", ".lisa.toml"] as const;
export function isLisaProject(existing: Iterable<string>): boolean;
```

True iff the normalized listing contains **any** marker. Kept fully separate from
`planInit` (the AC lists it as its own guarantee). The T-040-02 shell composes them:
*refuse if `!isLisaProject` (not a lisa project — nothing to layer onto), else apply
`planInit`*.

**Why `as const` + `.some`:** mirrors `SOURCE_PREFIXES` — one widenable contract,
membership-checked, no re-listing. Detecting *either* marker (not both) matches the
epic ("detects `CLAUDE.md`/`.lisa.toml`") and is robust to a lisa project that ships
only one.

**Rejected:** requiring `.lisa.toml` specifically (too strict — a hand-rolled lisa
project may have only `CLAUDE.md`); folding the check into `planInit` (couples two
guarantees the AC keeps apart, and a future `vend doctor` wants the predicate alone).

## D5 — Expressing "zero demand rows" as a checkable guarantee

**Decision:** a pure helper

```ts
export function countDemandRows(contents: string): number;
```

that counts the two real demand-row shapes from research: live-board pull lines
(`/^vend chain "/m`) **plus** cleared-archive epic rows (`/^- \*\*E-\d/m`). The seed
`demand.md` and `demand-cleared.md` contents are written as *header + empty-state
marker only*, so `countDemandRows` returns `0` for both — the AC's third clause becomes
a one-line assertion per file.

**Why a counter, not a boolean:** a count is the honest measure (a regression that
sneaks one row in is visible as `1`, not just `true→false`), and it doubles as a tiny
guard the write effect / a later `vend doctor` can reuse on a *live* board.

**Rejected:** asserting exact seed strings in the test (brittle — every wording tweak
breaks it); a generic "any `- ` bullet" counter (the empty-state prose itself uses
bullets to explain the board — would false-positive). Anchoring on the two *structural*
shapes is precise.

## D6 — Seed content: structure + knowledge, never demand

**Decision:** seed files carry just enough to be *legible and valid*, never any demand:

- `demand.md` — the board header (what a signal is, value/budget framing) + an explicit
  **`_No open demand yet — cast `vend steer` or `vend survey` off a seed to populate
  the board (IA-3/IA-4)._`** empty-state line. Zero `vend chain` rows.
- `demand-cleared.md` — the archive header + **`_Nothing cleared yet._`**. Zero `- **E-`
  rows.
- `pm/README.md`, `pm/process-gate.md` (`ready: false`) — minimal desk stubs so the PM
  desk is structurally present and the gate defaults *down*.
- `charter.md`, `vision.md` — one-line **placeholder stubs** that say "author this"
  (rich content is the explicitly-deferred follow-up epic, PE-7).
- `.vend/.gitignore` — `*\n!.gitignore\n!decisions.jsonl` — ignore runtime telemetry,
  keep the durable decision log. **Vend-owned**, so we never touch the lisa project's
  root `.gitignore` (D-one-way).

**Why `.vend/.gitignore` instead of editing root `.gitignore`:** preserves the one-way
vend → lisa rule (never mutate a lisa-owned file) *and* keeps the no-clobber story
trivial — we only ever *create* vend-owned paths. The live repo expresses the same
intent at the root; we localize it.

## D7 — Path normalization

**Decision:** a tiny internal `normalizePath(p)` — drop a leading `./`, strip a single
trailing `/`. Applied to both manifest paths (defensive) and the incoming `existing`
listing so directory entries match regardless of trailing-slash convention from a real
`readdir`. Keeps `planInit`/`isLisaProject` robust to the impure caller's quirks without
the caller having to pre-clean.

## What this design explicitly does NOT do

- No fs, no `mkdir`, no write — that is T-040-02.
- No CLI parsing / `init` dispatch arm in `cli.ts` — a later slice of E-040.
- No `vend doctor` checks — sibling epic, out of scope per E-040.
- No rich knowledge content — deferred follow-up (PE-7).
