# T-060-02-02 — Review

**Ticket:** wire-calibrated-envelope-as-hackathon-seed-default-budget (S-060-02 · E-060)
**Commit:** `856f3c0` — feat(work): default vend work budget to the calibrated cold-start envelope

## What changed

### `src/play/work-core.ts` (PURE, +~50 lines, additive)
- **`WorkBudgetPlan`** — `{ funded; quote; source: "measured"|"prior"; usedDefault }`.
- **`makeWorkBudgetPlan(quote, source, override?)`** — PURE/TOTAL resolution rule shared by
  `castWork` and `planWorkBudget`: `funded = override ?? quote`, `usedDefault = override === undefined`.
  Never folds funding headroom into the quote (IA-8).
- **`planWorkBudget(records, drivePlays, tier, prior, override?)`** — composes `coldStartEnvelope`
  (the T-060-02-01 unit) + `makeWorkBudgetPlan`. The named unit the AC pins; mirrors `castWork`.
- **`renderBudgetQuote(plan, {color?})`** — the one-line p90 quote (two IA-8 denominations + a
  `measured`/`cold start` provenance tag). Plain by default (assertable); optional dim emphasis.
- Imports added: `coldStartEnvelope` (value, pure), `ValueTier` / `RunRecord` (type-only).

### `src/play/work.ts` (IMPURE shell, net ≈ even)
- **Deleted** `export const DEFAULT_MACRO_BUDGET` and the private `sumBudgets`; dropped the
  `recalibrate` import (now via `coldStartEnvelope`).
- `castWork` reordered: `loadRunLog` + `prior` moved above the wallet allocation. **One**
  `coldStartEnvelope(drivePlays, records, "standard", prior)` call now sources `price` (its
  `.envelope`), the per-cast funding legs (`.perPlay[i].result` → `fundingEnvelope`), and the default
  (`makeWorkBudgetPlan(price, cold.source, opts.budget)`). New `onPlan?` option emitted once before
  the loop (the IA-6 Confirm half). `WorkResult.funded` unchanged.

### `src/cli.ts` work arm (~8 lines)
- Dropped `DEFAULT_MACRO_BUDGET`; `budget` passed only when present. `onPlan` prints
  `renderBudgetQuote` (when `usedDefault`) and captures `funded` for the IA-7 stream meter; the final
  receipt wallet reads the authoritative `result.funded`.

### Seed docs — `examples/templates/hackathon-seed/{README.md, shelf-note.md}`
"Omit `--budget` ⇒ defaults to **2h/2M**" → "funds the **calibrated cold-start clear** at the p90
quote (measured once the run-log has history; a generous estimate until then)." `EXPECTED-OUTCOME.md`
deliberately untouched — flipping the gold master is T-060-03-01 (`depends_on: [T-060-02-02]`).

## Acceptance criteria — met

> The hackathon-seed default budget equals the calibrated envelope; a test drives vend work on the
> seed with that default and asserts no instant budget-exhausted before a slice clears, and that the
> displayed budget quote remains the p90 price (E-050 funding-headroom not folded into the price).

- **Default = the calibrated envelope.** `castWork`'s omit-`--budget` default is now
  `coldStartEnvelope().envelope` (the p90 per-clear price) — read from the ledger, not literal-coded.
  `planWorkBudget`/`makeWorkBudgetPlan` resolve it; the AC test asserts `funded === quote` on omit.
- **Drives the loop → ≥1 clears, no instant budget-exhausted.** The AC test funds the real
  `spendDown` at `plan.funded` with a stub clearing cast over the seed's drive plays and asserts
  `session.cleared >= 1` and the first step succeeded — `canAfford(price)` is true at equality, so the
  first pull always authorizes (the budget-shape fix). A cold-start (no successes) case asserts the
  same with the summed prior.
- **Quote stays the p90 price.** The test asserts `plan.quote` deep-equals `coldStartEnvelope().envelope`
  and that the summed per-cast funding envelope is strictly **above** the quote on tokens when censored
  tails inflate it — proving the E-050 headroom is never folded into the quote.

## Test coverage

`bun test src/play/work-core.test.ts` → **26 pass / 0 fail** (6 new cases, 14 new `expect`s). Full
gate `bun run check` (baml:gen + `tsc --noEmit` + `bun test`) → **1354 pass / 0 fail**, typecheck clean.

New cases: (1) AC — driven loop clears ≥1 with the default, no instant exhaustion; (2) AC — quote ==
p90, strictly below funding; (3) measured distinguishable from the summed prior; (4) cold-start ⇒
prior, still funds the first pull; (5) `makeWorkBudgetPlan` override/usedDefault; (6) `renderBudgetQuote`
denominations + provenance + color gate.

## Design notes for the reviewer

- **It was a unification, not an addition.** `castWork`'s pre-existing `price` was already
  `Σ recalibrate(propose) + recalibrate(decompose)` — definitionally `coldStartEnvelope().envelope`.
  So routing through `coldStartEnvelope` replaced two `recalibrate` calls + `sumBudgets` with one
  call that also yields the provenance and the funding-leg breakdown. Net-neutral lines, fewer moving
  parts, and the dependency used exactly as handed off.
- **Why fund the wallet at the bare price (not the funding envelope).** The AC wants GUARD ≠ PRICE
  preserved at the default: the wallet AUTHORIZES at the p90 price; each cast RUNS under its
  `fundingEnvelope` (floored to 350k tokens, E-053); the wallet DEBITS actuals. So even a tight
  price-sized wallet clears the first slice under the floored per-cast funding, then settles. Funding
  the wallet at the headroom number instead would have made "quote ≠ funding" a distinction without a
  difference — rejected in design (option C).
- **Honest provenance.** `plan.source` rides to the quote label, so a cold-start estimate is never
  shown as an earned price.

## Open concerns / limitations

- **Global default changed, intentionally.** `vend work`'s omit-default is no longer a 2h/2M
  multi-clear ceiling but the calibrated per-clear price (≥1 slice). A longer walk-away is one
  explicit `--budget` away. This is the E-013 "measured, not guessed" philosophy applied to the work
  default — the whole point of the ticket — but it is a behavior change for every project, not just
  the seed. Flagged for human awareness.
- **Cold-start wallet overshoots, by design.** On a fresh ledger the default is the summed standard
  prior `{2h/50k tokens}`, while a real chain burns ~230k — so the wallet records a large overshoot on
  the first clear. The slice still clears (per-cast funding floor), which is the AC; the wallet
  reconciles to accurate once the ledger has ≥3 successes per leg. This is the acknowledged cold-start
  imperfection inherited from `recalibrate`'s prior (T-060-02-01 review), not new here.
- **`castWork`/CLI not value-unit-tested** (they value-import the BAML chain — house rule). Their
  wiring is covered by the pure units they delegate to (`planWorkBudget`/`makeWorkBudgetPlan`/
  `renderBudgetQuote`) + the addon-free `spendDown` drive + `tsc`. Live exercise lands at the E-060
  closing re-drive.
- **No critical issues.** Disjoint from the concurrent T-060-01-02 working-tree edits
  (`cast.ts`/`run-log.ts`) — those were left unstaged; this commit touches only its own files.

## Handoff to T-060-03-01

The positive-gold-master live re-drive can now omit `--budget` (or pass a tight one): `vend work`
funds the calibrated cold-start clear and prints the p90 quote. The reduced-grounding decompose path
(T-060-01-01/02) plus this fundable default together make the fresh-seed two-gesture round-trip clear
≥1 real slice — the EXPECTED-OUTCOME flip is the remaining downstream step.
