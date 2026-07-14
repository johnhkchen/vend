# Design — T-003-01 pure-menu-model

Options, tradeoffs, decisions — grounded in the research. Each decision cites the
codebase reality it rests on.

## D1 — Where the module lives: `src/shelf/menu.ts`

**Options:** (a) new `src/shelf/` area; (b) put it under `src/play/`; (c) put it
beside the CLI in `src/`.

**Decision: (a) `src/shelf/menu.ts`.** The epic's own vocabulary is "the shelf";
the decomposition (epic §Decomposition) already names the four E-003 files under
`src/shelf/` — `menu.ts` (this), `gather.ts` (T-003-02), `select.ts` (T-003-03).
R5 (disjoint files) keeps T-003-01 ∥ T-003-03 only because the menu model and the
parser share no files; a dedicated area makes that boundary physical. `src/play/`
is the playbook-execution area (decompose-epic, materialize, gates) — the menu is
not a playbook, it *lists* them. Rejected (b)/(c) as miscategorization.

## D2 — The `Action` shape

The shelf row must carry, per demand.md + epic, "value tier + warranted budget +
state," keyed by a board id the press gesture dispatches on.

**Decision:**

```ts
export type ValueTier = "keystone" | "high" | "standard" | "leaf";
export type Readiness  = "ready" | "blocked";

export interface Action {
  readonly id: string;          // board id the press gesture dispatches on, e.g. "E-002"
  readonly title: string;       // kebab title, e.g. "ci-backstop"
  readonly tier: ValueTier;     // leverage tier (demand.md value ranking)
  readonly readiness: Readiness;// ready | blocked (from lisa status)
  readonly budget: Budget;      // warranted envelope; default for `vend <sel>`
}
```

- **`tier` as a 4-value union, not a number.** demand.md ranks by *named* tiers,
  never a frozen score ("Compute on pull; don't freeze a number"). A union is
  exhaustively checkable by `tsc` and reads back as the demand vocabulary. The
  ordinal needed for sorting is a private precedence map (D4), not a field.
- **`readiness` collapsed to `ready | blocked`.** The epic only ever distinguishes
  shown-vs-hidden; a richer status enum would be unused surface. "Leaf" is a
  *tier*, not a readiness — the default-hidden set is `blocked ∨ leaf-tier` (D5).
- **`budget` reuses `src/budget/budget.ts`'s `Budget`** (type-only import). Rejected
  a local budget shape: the `--budget` override (`cli.ts parseBudgetArg`) and the
  runner already speak `{timeMs, tokens}`; a second shape forks the denomination.
  `budget.ts` is pure, so the import keeps menu.ts pure and seam-agnostic (same
  discipline as budget.ts declaring `Usage` locally to avoid welding to the seam —
  here the reuse runs the *other* way, toward a shared pure type).
- **`readonly` throughout**, matching `Budget`, `Action`-like records across the
  tree. All inputs are treated as immutable (purity).

## D3 — The `MenuCache` shape (the `.vend/menu.json` seam)

The persisted shape must support (research §seam) index stability and a freshness
marker, while the pure model only *defines* it (impure population is T-003-02).

**Decision:**

```ts
export const MENU_CACHE_VERSION = 1 as const;

export interface MenuCache {
  readonly version: typeof MENU_CACHE_VERSION; // schema version for forward migration
  readonly generatedAt: string;  // ISO-8601 timestamp — freshness marker (impurely stamped)
  readonly stateHash: string;    // hash of board state — staleness detection (impurely computed)
  readonly all: boolean;         // whether hidden rows were included when shown
  readonly actions: readonly Action[]; // DISPLAY ORDER; menu number i ⇒ actions[i-1]
}
```

- **`actions` in display order**, so `vend <sel>` resolution is a direct index —
  the two-gesture index contract (research §seam #1). `version` future-proofs the
  on-disk format (the seam is also the LLM-precompute hook; a v2 may add a
  salience field). `generatedAt` + `stateHash` are the freshness marker (research
  §seam #2); the pure model declares them as plain strings and does **not** fill
  them — clock and hashing are impure (T-003-02/04). `all` records the mode so the
  press gesture knows which list it is indexing.
- **Rejected** storing the full ranked list plus a separate "visible indices" map:
  more surface, and it splits the index contract across two fields. Storing exactly
  the displayed list is the smallest shape that makes `actions[i-1]` correct.

## D4 — `rankActions`: stable sort by tier, then readiness

Ticket AC: "leverage tier, then readiness; stable order."

**Decision:** a private precedence map + a comparator that returns 0 on full ties,
relying on Bun/V8's **stable** `Array.prototype.sort` to preserve input order for
equal entries (research §determinism). Sort a *copy* (`[...actions]`) — never
mutate the input (purity, matching `buildProjectSnapshot`'s `[...xs].sort()`).

```ts
const TIER_RANK:      Record<ValueTier, number> = { keystone: 0, high: 1, standard: 2, leaf: 3 };
const READINESS_RANK: Record<Readiness, number> = { ready: 0, blocked: 1 };
```

Comparator: `TIER_RANK[a.tier] - TIER_RANK[b.tier]` then
`READINESS_RANK[a.readiness] - READINESS_RANK[b.readiness]`, else `0`.

- **Tier dominates readiness** — a blocked Keystone outranks a ready Standard. This
  matches demand.md ("value + readiness", value first) and is the right ordering
  for the `--all` view; under the default filter the blocked Keystone is simply
  hidden, so the visible default list is still "ready, high-leverage first."
- **Rejected** manual index-tagging (decorate-sort-undecorate) — unnecessary given
  a stable sort, and it adds surface the test would have to trust anyway. Stability
  is instead **pinned by a fixture** (equal-tier-equal-readiness entries keep input
  order).
- **Rejected** sorting by `id` as a tiebreaker — demand.md is explicit that pull
  order is "**not** ID order"; imposing id order would contradict the value model.
  Input order is the caller's (gather's) signal order and is the correct stable
  key.

## D5 — `renderMenu`: numbered visible rows + a hidden-count footer

AC: "numbered, each row = value tier + budget + state; `opts.all` reveals
blocked/leaf, else hidden."

**Decisions:**

- **Filtering is one pure helper, `visibleActions(actions, all)`**, used by *both*
  `renderMenu` and (later) T-003-02's persistence, so render-numbering and the
  persisted `MenuCache.actions` are produced from the *same* filter and can never
  disagree (research §seam #1). Exporting it is the single extra export beyond the
  AC list, justified by the index contract. Default-hidden predicate:
  `readiness === "blocked" || tier === "leaf"`.
- **1-indexed numbering over the visible list** (epic examples: `vend 1`,
  `vend 1,2,4-6`). The press gesture is 1-indexed and dedupes ranges; the menu must
  match.
- **Row format** (deterministic, test-pinned), value tier + budget + state present:
  ``` `${n}. ${id} ${title}  [${Tier}] · ${formatBudget(budget)} · ${readiness}` ```
  e.g. `1. E-002 ci-backstop  [High] · 2h/50k · ready`. Tier is title-cased for
  display; the `·` separators echo demand.md's own row punctuation.
- **`formatBudget(budget)`** — a small pure formatter: `timeMs` → the largest whole
  human unit (`h`/`m`/`s`) and `tokens` → `k` when ≥1000 (e.g. `2h/50k`,
  `30m/8k`, `45s/500`). Mirrors demand.md's human-scale envelopes and the
  `--budget 2h,50k` surface. Pure and deterministic. Exported for reuse + direct
  test.
- **Hidden-count footer:** when `!all` and ≥1 action was hidden, append
  `(+K hidden — vend --all)`. Deterministic (K is a count), and it satisfies the
  AC's "hidden-row behavior" with a visible, testable signal rather than a silent
  drop.
- **Empty visible list:** return a single line `(no salient actions — vend --all)`
  (or `(no actions)` when the input itself is empty). Total — never throws.
- **Rejected** column alignment / padding: it makes the golden-string tests brittle
  against trivial spacing changes and buys little in a 1–N row CLI list. A single
  space/`·` layout is deterministic and diff-stable.

## D6 — Purity & totality discipline

Following id-guard.ts / buildProjectSnapshot: **no fs, network, clock, process,
LLM, or native addon**; inputs never mutated (sort a copy); functions **total**
(never throw — render an empty/footer string rather than erroring). The doc header
states the PURITY contract explicitly; each export carries a PURE/TOTAL JSDoc. The
test includes a frozen-input case (the id-guard precedent) proving `rankActions`
reads but does not mutate. This is what lets the module stay `depends_on: []` and
run parallel to T-003-03.
