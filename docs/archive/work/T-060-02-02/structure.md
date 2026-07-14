# T-060-02-02 — Structure

The file-level blueprint. Four code files + two seed docs. No new files; no deletions.

## 1. `src/play/work-core.ts` (PURE) — MODIFY (+~45 lines)

New imports:
- `import { coldStartEnvelope } from "../ledger/recalibrate.ts";` (value — pure, no addon)
- `import type { ValueTier } from "../shelf/menu.ts";` (type-only, erased)
- `import type { RunRecord } from "../log/run-log.ts";` (type-only, erased)

New exports (placed after the cost formatters, before `parseBoardSignals`, near the other budget
helpers):

```ts
export interface WorkBudgetPlan {
  /** The funded macro budget: the user's --budget override, else the calibrated default (== quote). */
  readonly funded: Budget;
  /** The displayed p90 PRICE quote (IA-8). Never the E-050 funding-headroom number. */
  readonly quote: Budget;
  /** "measured" once the ledger has ≥ COLD_START_MIN_SUCCESSES per leg; "prior" on cold start. */
  readonly source: "measured" | "prior";
  /** True iff --budget was omitted (the calibrated default is in force) — gates the quote display. */
  readonly usedDefault: boolean;
}

// Pure resolution logic, shared by castWork and planWorkBudget. No recompute.
export function makeWorkBudgetPlan(quote: Budget, source: "measured"|"prior", override?: Budget): WorkBudgetPlan

// Composed: coldStartEnvelope(...) then makeWorkBudgetPlan(envelope, source, override). The AC unit.
export function planWorkBudget(
  records: readonly RunRecord[],
  drivePlays: readonly string[],
  tier: ValueTier,
  prior: Budget,
  override?: Budget,
): WorkBudgetPlan

// One-line honest quote for the CLI (color-gated like renderReceipt). Reuses local fmtCost.
export function renderBudgetQuote(plan: WorkBudgetPlan, opts?: { color?: boolean }): string
```

`renderBudgetQuote` reuses the existing private `fmtCost(b: Budget)` (two-denomination, IA-8) and adds
a provenance tag: `measured` vs `estimate (cold start — no data yet)`. Amber is NOT used (a quote is
not an andon); plain text so it stays assertable, color optional for emphasis only.

## 2. `src/play/work.ts` (IMPURE shell) — MODIFY (net ~ even)

- **Imports:** `import { fundingEnvelope, coldStartEnvelope } from "../ledger/recalibrate.ts";`
  (drop `recalibrate`). Add `makeWorkBudgetPlan, type WorkBudgetPlan` to the `./work-core.ts` import.
- **Delete** `export const DEFAULT_MACRO_BUDGET` (38) and the private `sumBudgets` (97–101).
- **`WorkOptions`:** update the `budget?` doc (no longer "⇒ DEFAULT_MACRO_BUDGET"); add
  `onPlan?: (plan: WorkBudgetPlan) => void` (emitted once, after the budget is resolved, before the
  loop — the Confirm half of IA-6 for the macro wallet).
- **`castWork` body reorder (the only logic change):**
  1. Move `const { records } = await loadRunLog();` + `const prior = budgetForTier(PRICE_TIER);` to
     BEFORE the wallet allocation (after the freshness gate).
  2. `const drivePlays = [proposeEpicPlay.name, decomposeEpicPlay.name] as const;`
  3. `const cold = coldStartEnvelope(drivePlays, records, PRICE_TIER, prior);`
  4. `const price = cold.envelope;` (P7 price == quote)
  5. `const plan = makeWorkBudgetPlan(cold.envelope, cold.source, opts.budget);`
  6. `const funded = plan.funded; const wallet = allocate(funded);`
  7. `opts.onPlan?.(plan);`
  8. Funding legs: `fundingEnvelope(drivePlays[0], records, cold.perPlay[0]!.result).envelope` and
     `...[1]...` (was two `recalibrate` + `fundingEnvelope` pairs; now read `cold.perPlay`).
  9. `spendDown` unchanged (`priceOf: () => price`, etc.).
- The "spent" `WorkResult` already carries `funded` — unchanged.

## 3. `src/cli.ts` work arm (783–831) — MODIFY (~8 lines)

- Lazy import: `const { castWork } = await import("./play/work.ts");` (drop `DEFAULT_MACRO_BUDGET`).
  Add `renderBudgetQuote` to the `./play/work-core.ts` destructure.
- Replace `const funded = parsed.budget ?? DEFAULT_MACRO_BUDGET;` with a mutable
  `let funded: Budget | undefined = parsed.budget;`.
- `castWork({...})`: pass `...(parsed.budget ? { budget: parsed.budget } : {})`; add
  `onPlan: (plan) => { funded = plan.funded; if (plan.usedDefault) process.stdout.write(\`${renderBudgetQuote(plan, { color: true })}\n\`); }`;
  keep `onStep: (s) => ...formatStepSignal(s, funded!)...` (onPlan fires before any onStep).
- Final receipt wallet: `const wallet = { funded: result.funded, remaining: result.session.remaining };`
  (use the authoritative `result.funded`).

## 4. `examples/templates/hackathon-seed/README.md` — MODIFY (1 note block, ~line 76)

Replace "Omit `--budget` … defaults to … **2 hours / 2M tokens**" with: omitting `--budget` funds the
**calibrated cold-start clear** at the p90 quote `vend` prints (measured from the run-log once the
ledger has history; a generous cold-start estimate until then).

## 5. `examples/templates/hackathon-seed/shelf-note.md` — MODIFY (1 bullet, ~lines 26–27)

Same correction; drop the stale `DEFAULT_MACRO_BUDGET` / "2 hours / 2M tokens" reference.

## Tests

### `src/play/work-core.test.ts` — MODIFY (+~70 lines)
New `describe("planWorkBudget / quote (T-060-02-02)")`:
- Reuses a local `recordOf` factory (mirrors recalibrate.test.ts) over `buildRunRecord`, and a small
  stub `castOne` returning a success `ChainResult` with chosen `actuals`.
- Imports `planWorkBudget, makeWorkBudgetPlan, renderBudgetQuote` from `./work-core.ts`,
  `spendDown` from `../engine/spend.ts`, `allocate` from `../budget/wallet.ts`.

Cases:
1. **AC (measured): drives the spend loop with the default → ≥1 slice clears, no instant
   budget-exhausted.** Fabricate ≥3 successes per drive play (measured envelope). `plan =
   planWorkBudget(records, plays, "standard", prior)`; allocate `plan.funded`; `spendDown` with
   `priceOf: () => plan.quote`, two candidates, a stub cast burning actuals ≤ envelope. Assert
   `session.cleared >= 1`, first step `outcome === "success"`, and the first pull was affordable.
2. **AC (quote = p90, headroom NOT folded in).** Fabricate measured successes PLUS a large censored
   run so `fundingEnvelope > price`. Assert `plan.quote` deep-equals `coldStartEnvelope(...).envelope`
   and is strictly below the funding envelope on the inflated dimension.
3. **measured ⇒ distinguishable from the prior;** `usedDefault` true on omit, false on override
   (`makeWorkBudgetPlan(quote, source, override).funded === override`).
4. **cold-start (no successes) ⇒ source "prior", default = summed prior, still affordable** (the
   first pull authorizes at equality — the budget-shape fix).
5. **`renderBudgetQuote`**: contains the two IA-8 denominations and the right provenance tag
   (`measured` vs `cold start`); plain-text assertable.

### `src/cli.test.ts` — unchanged
The bare-`work` parse test (`{ cmd: "work" }`) is unaffected (budget stays undefined; the default
moved into `castWork`). No CLI parse surface changed.

## Ordering & risk

1. work-core.ts (pure, compiles standalone) → 2. work-core.test.ts (red→green) → 3. work.ts (wire) →
4. cli.ts (wire) → 5. seed docs. Each step independently typechecks. `DEFAULT_MACRO_BUDGET` removal
blast radius is exactly cli.ts + work.ts (grep-confirmed; no test references it).
