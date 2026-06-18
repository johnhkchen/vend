# Research — T-003-01 pure-menu-model

Descriptive map of the codebase as it bears on the pure, addon-free core of the
shelf: rank salient actions by leverage and render them as a numbered menu, plus
the persisted `MenuCache` shape. What exists, where, how it connects. No solutions
proposed here.

## The ticket in one line

Add `src/shelf/menu.ts` exporting, all **pure** (no fs / network / clock / LLM):
`rankActions(actions) -> Action[]` (leverage tier, then readiness; stable),
`renderMenu(actions, opts?) -> string` (numbered rows; `opts.all` reveals
blocked/leaf), and the `MenuCache` / `Action` types (the persisted `.vend/menu.json`
shape). T-003-02 composes it (gather + persist + bare `vend` entry); T-003-04
resolves selection indices against the persisted list. This ticket delivers only
the pure model + its test.

## Why this exists — the value it renders

E-003 (`docs/active/epic/E-003.md`) is the early CLI-ification of Vend's
two-gesture counter: bare `vend` shows a ranked menu of the **salient,
high-leverage actions available right now**; `vend <sel>` runs them. "Salient" =
high-leverage **and** ready; blocked/leaf items are hidden (behind `--all`). The
epic is explicit about a **precompute fork**: ship the **deterministic** menu
first — no LLM — and let `.vend/menu.json` be the seam a later LLM-salience
precompute hooks into with the same interface. This ticket is the deterministic
core of that fork.

The menu *renders and acts on* the value model in `demand.md`; it does not
redefine it (epic "Context & constraints"). So the model here is a faithful
encoding of demand.md's ranking, not a new policy.

## The value ranking it must encode (`docs/active/demand.md`)

demand.md is canonical for two inputs — **Value** (leverage) and **Budget** (the
envelope):

- **Value tiers (leverage, not effort)** — the ranking the menu renders:
  - **Keystone** — unblocks most of the DAG, or *is* the core feature.
  - **High** — advances the core feature / a charter invariant, or is an enabler
    that de-risks much of what follows.
  - **Standard** — real value, bounded blast radius.
  - **Leaf** — narrow; unblocks nothing.
  - The four-rung order **Keystone > High > Standard > Leaf** is cited verbatim by
    the ticket Context as "the value-ranking the menu renders."
- **Budget envelopes** — wall-clock + token ceiling, "budget ∝ value" (keystone →
  fat, leaf → thin). The shelf shows "value tier + **warranted budget** + state."
  The human-scale unit is the ~2-hour feature block; signals in the demand table
  read as "small (~1h)", "tiny (mins)", "~1 feature block (≈2h)".
- **Readiness** — pull order is "by value + readiness, **not** ID order." The menu
  filters by readiness from `lisa status`: ready shows, blocked is hidden.

So an entry on the shelf carries: an **id** (the epic/signal), a **title**, a
**value tier**, a **readiness state**, and a **warranted budget envelope**.

## The `Budget` type already exists (`src/budget/budget.ts`)

`Budget` is already defined (T-001-03):

```ts
export interface Budget {
  readonly timeMs: number;  // wall-clock allowance (ms); becomes the seam's timeoutMs
  readonly tokens: number;  // token ceiling
}
```

`budget.ts` is itself a PURE module (no network/fs/clock/child-process). The CLI's
`--budget <ms>,<tokens>` (`src/cli.ts` `parseBudgetArg`) already parses into this
shape. The warranted envelope each Action carries should reuse this exact type — a
divergent budget shape would fork the denomination the runner and `--budget`
override already speak. A type-only import keeps menu.ts pure and seam-agnostic.

## The house "pure core + impure verb" pattern (the precedent to match)

Every module in the tree splits a PURE, fixture-tested core from a thin IMPURE
verb that is left untested (obs 20402):

- `src/play/id-guard.ts` — `detectCollisions(generated, existing) -> string[]`:
  PURE and TOTAL, takes plain string arrays, returns a fresh deduped/ordered
  array, never throws, never imports a non-pure type. Its test
  (`id-guard.test.ts`) is "an ordinary pure-function test" with plain fixtures,
  `toEqual` (exact array — membership AND order), and an `Object.freeze` purity
  test proving inputs are not mutated.
- `src/play/project-context.ts` — `buildProjectSnapshot(parts)` is the PURE
  formatter (deterministic, sorted, relative paths, test-pinned); `assembleInputs`
  is the IMPURE verb (reads files, walks `src/`) and is not unit-tested.
- `src/cli.ts` — `parseArgs` / `parseBudgetArg` are PURE and tested; the
  `import.meta.main` dispatch that calls the runner and `process.exit`s is the thin
  untested shell.

T-003-01 sits entirely on the PURE side. The impure verbs (read `demand.md` +
`lisa status`, compute timestamp/hash, `writeFile .vend/menu.json`) belong to
T-003-02, which is exactly why this ticket has `depends_on: []` and is parallel to
T-003-03 (R5 — disjoint files; see decomposition).

## Determinism precedents

The codebase already insists on deterministic pure output for reproducibility:
`buildProjectSnapshot` sorts its lists "so the output is deterministic (a stable
prompt input = reproducible runs)"; `detectCollisions` pins order to "first
appearance in `generated`." `rankActions` must be **stable** (ticket AC: "stable
order") — equal-leverage entries keep their input order. Bun/V8 `Array.prototype.sort`
is a stable sort, so a comparator that returns 0 on ties preserves input order; no
manual index-tagging is needed, but the property must be test-pinned.

## The `.vend/menu.json` seam and the freshness contract

The epic and the decomposition memo (S-003 creation, obs 20473) call
`.vend/menu.json` the **architectural seam** between the *browse* gesture (`vend`)
and the *press* gesture (`vend <sel>`), and the future hook for an LLM-salience
precompute. Two hard properties the menu's persisted shape must support:

1. **Index stability** — `vend <sel>` resolves 1-indexed selections against *the
   same list that was shown*. So the persisted `MenuCache` must store the displayed
   actions **in display order**, so resolution is a direct `actions[i-1]`. The
   render numbering and the persisted list must be produced from one filter so they
   can never disagree.
2. **Freshness marker** — the epic requires that a "materially-stale menu warns
   're-run vend' rather than acting on stale indices." So `MenuCache` needs a
   freshness marker: a **timestamp** and a **state-hash** of the board state the
   menu was computed from (noted as a required safety property in the S-003 memo).
   *Computing* these is impure (clock + hashing board files) and belongs to
   T-003-02/T-003-04; the pure model only **defines the shape**.

`.vend/` does not exist yet (obs 20294) — T-003-02 creates it. Nothing in this
ticket touches the filesystem.

## Conventions to match

- **Module layout:** `src/<area>/<name>.ts` + co-located `<name>.test.ts`
  (`bun:test`, `describe/test/expect`). A new `src/shelf/` directory is introduced
  here (no `src/shelf/` exists yet); the area name matches the epic's "shelf"
  vocabulary.
- **Doc header:** each module opens with a comment stating its job, its ticket id,
  and an explicit **PURITY** note (what it does NOT do). All public functions carry
  a JSDoc block stating PURE/TOTAL and the contract.
- **Imports:** explicit `.ts` extensions (Bun ESM). Type-only imports for pure
  cross-module type reuse (e.g. `import type { Budget }`).
- **Testing:** plain fixtures, `toEqual` for exact arrays/strings, a frozen-input
  purity test, every branch covered. `bun run check:test` / `check:typecheck` must
  be green (AC#4).

## Boundaries / constraints / assumptions

- **In scope:** the `Action` and `MenuCache` types, `rankActions`, `renderMenu`,
  and whatever small pure helpers keep render-numbering and persisted-order in
  lockstep. PURE only.
- **Out of scope (T-003-02+):** reading `demand.md` / `lisa status`, building the
  `Action[]`, computing timestamp/state-hash, writing `.vend/menu.json`, the bare
  `vend` CLI entry, selection parsing (T-003-03), resolve + dispatch (T-003-04),
  any LLM salience (the fork's deferred side, epic "Out of scope").
- **Assumption:** readiness collapses to a two-state `ready | blocked` for v1 (the
  epic only distinguishes shown-vs-hidden). "Leaf" is a *value tier*, not a
  readiness state; the epic pairs "blocked/leaf" as the default-hidden set, so the
  default filter hides `readiness === "blocked"` **or** `tier === "leaf"`.
- **Assumption:** the menu number is over the *displayed* (filtered) list, and the
  `MenuCache` records which mode (`all`) was shown plus the displayed list, so the
  press gesture indexes deterministically. This keeps the two-gesture contract
  honest without the pure core needing to know about persistence.
