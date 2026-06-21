# T-050-02 — Structure: file-level blueprint

The shape of the code, not the code. Two source files modified, two test files extended. No new files,
no deletions. Additive; `resolveStepBudgets` and all T-050-01 exports unchanged.

## Files

| File | Change | What |
| --- | --- | --- |
| `src/play/chain-propose-decompose-core.ts` | **modify** (append a pure helper + 1 const + imports) | `fundedStepDefault`, `CHAIN_DEFAULT_TIER` |
| `src/play/chain-propose-decompose.ts` | **modify** (impure shell: load ledger, compute funded defaults) | `stepDefaults` helper, wire into `resolveStepBudgets` |
| `src/play/work.ts` | **modify** (price path L192–216) | keep full `RecalibrateResult`, fund per-step, thread funding into the cast |
| `src/play/chain-propose-decompose-core.test.ts` | **modify** (append a `describe` block + imports) | `fundedStepDefault` unit tests (the E-049 deterministic proof, AC#4) |

`work.ts` / `chain-propose-decompose.ts` are impure shells (value-import the BAML addon) — NOT
unit-tested; their correctness is the composition of the tested pure core (house pattern). The
deterministic proof lives in the addon-free core test.

## `src/play/chain-propose-decompose-core.ts` — additions

New imports (all addon-free — none pull the BAML addon, so the core test still runs under `bun test`):
```ts
import { recalibrate, fundingEnvelope, type FundingOptions, type RecalibrateOptions } from "../ledger/recalibrate.ts";
import type { RunRecord } from "../log/run-log.ts";
import type { ValueTier } from "../shelf/menu.ts";
```

Const (the neutral middle tier for a bare-chain default, mirrors work.ts `PRICE_TIER`):
```ts
export const CHAIN_DEFAULT_TIER: ValueTier = "standard";
```

Pure helper — the funded default rung for one step:
```ts
export function fundedStepDefault(
  records: readonly RunRecord[],
  play: string,
  prior: Budget,
  tier: ValueTier = CHAIN_DEFAULT_TIER,
  opts: { readonly recalibrate?: RecalibrateOptions; readonly funding?: FundingOptions } = {},
): Budget {
  const result = recalibrate(play, records, tier, prior, opts.recalibrate);
  return fundingEnvelope(play, records, result, opts.funding).envelope;
}
```
- PURE/TOTAL: plain values in, a fresh `Budget` out (recalibrate + fundingEnvelope are both pure).
- `prior` is the play's static `.budget` — the recalibrate cold-start prior AND the `priced` base
  `fundingEnvelope` widens from. So: cold-start ⇒ `prior × headroom`; under-calibrated ⇒
  `max(prior-or-p90, maxCensoredActual × headroom)`; well-calibrated ⇒ the measured p90 verbatim
  (funding == price — back-compat).
- Doc comment: the guard-≠-price thesis, the ratchet it breaks on the bare-chain default rung, the
  "explicit override still wins (resolveStepBudgets)" note, and that it never touches the price.

`resolveStepBudgets` is UNCHANGED (the funded defaults flow in as its `proposeDefault`/`decomposeDefault`).

## `src/play/chain-propose-decompose.ts` — shell changes

New imports:
```ts
import { join } from "node:path";
import { loadRunLog, DEFAULT_RUN_LOG_PATH } from "../log/run-log.ts";
import { resolveStepBudgets, fundedStepDefault } from "./chain-propose-decompose-core.ts";  // add fundedStepDefault
```

New private impure helper — the funded default rung, ledger read ONCE and skipped when unused:
```ts
/** The per-step DEFAULT rung, measurement-funded over the ledger (T-050-02, IA-14). When an override
 *  already covers BOTH steps (a uniform `--budget`, or both per-step set — the `vend work` path) the
 *  default is never consulted, so the ledger is NOT read and the static play budgets are returned
 *  (byte-for-byte unchanged). Otherwise loadRunLog ONCE (ENOENT ⇒ empty ⇒ cold-start funding) and
 *  fund each step's default at fundingEnvelope(recalibrate(...)). Impure (fs read); its logic is the
 *  tested pure `fundedStepDefault`. */
async function stepDefaults(root: string, opts: ChainProposeDecomposeOptions): Promise<[Budget, Budget]> {
  const defaultUnused =
    opts.budget !== undefined ||
    (opts.proposeBudget !== undefined && opts.decomposeBudget !== undefined);
  if (defaultUnused) return [proposeEpicPlay.budget, decomposeEpicPlay.budget];

  const { records } = await loadRunLog({ path: join(root, DEFAULT_RUN_LOG_PATH) });
  return [
    fundedStepDefault(records, proposeEpicPlay.name, proposeEpicPlay.budget),
    fundedStepDefault(records, decomposeEpicPlay.name, decomposeEpicPlay.budget),
  ];
}
```

`castProposeDecomposeChain` body — replace the static-default call:
```ts
const root = opts.projectRoot ?? process.cwd();
const [proposeDefault, decomposeDefault] = await stepDefaults(root, opts);
const { proposeBudget, decomposeBudget } = resolveStepBudgets(opts, proposeDefault, decomposeDefault);
```
Everything below (the two `PlayStep`s, `castChain(steps)`) is unchanged. Update the inline comment at
the `resolveStepBudgets` call to name the funded default rung.

## `src/play/work.ts` — price/funding split

Add `fundingEnvelope` to the existing `recalibrate` import:
```ts
import { recalibrate, fundingEnvelope } from "../ledger/recalibrate.ts";
```

Replace L198–200 (keep the full results; price stays the envelope sum; add funding):
```ts
const proposeResult   = recalibrate(proposeEpicPlay.name,   records, PRICE_TIER, prior);
const decomposeResult = recalibrate(decomposeEpicPlay.name, records, PRICE_TIER, prior);
// PRICE (honest p90) gates P7 authorization — the per-denomination sum of the two priced envelopes.
const price = sumBudgets(proposeResult.envelope, decomposeResult.envelope);
// FUNDING (the guard each cast RUNS under, T-050-02/IA-14): max(price, maxCensoredActual × headroom)
// per step, so a cold-start/under-calibrated cast clears its observed wall, FINISHES, and RECORDS.
// Distinct from the price: the wallet AUTHORIZES on `price` and DEBITS actuals; only the run-guard widens.
const proposeFunding   = fundingEnvelope(proposeEpicPlay.name,   records, proposeResult).envelope;
const decomposeFunding = fundingEnvelope(decomposeEpicPlay.name, records, decomposeResult).envelope;
```

In the `spendDown` call, thread funding into the cast (price still gates):
```ts
priceOf: () => price,                              // UNCHANGED — honest quote gates the wallet
castOne: (signal) =>
  castProposeDecomposeChain({
    signal,
    projectRoot: root,
    proposeBudget: proposeFunding,                 // was proposeEnvelope
    decomposeBudget: decomposeFunding,             // was decomposeEnvelope
    ...(opts.model ? { model: opts.model } : {}),
    ...(opts.intervened !== undefined ? { intervened: opts.intervened } : {}),
  }),
```
The local `proposeEnvelope`/`decomposeEnvelope` names fold into `proposeResult.envelope` etc. Update
the explanatory comment block (L194–197) to name the price/funding split (still cites E-025).

## `chain-propose-decompose-core.test.ts` — additions

Extend imports: add `fundedStepDefault`, `CHAIN_DEFAULT_TIER`, and the `recordOf`-style fixture (copy
the minimal `recordOf` from recalibrate.test.ts, or a local equivalent building a `RunRecord` via
`buildRunRecord`). Add `import type { RunRecord } from "../log/run-log.ts"` and `buildRunRecord`.

New `describe("fundedStepDefault — measurement-funded default rung (T-050-02)")`:
1. **E-049 deterministic proof (AC#4):** decompose-epic, `prior = decomposeEpicPlay-shaped 120k`,
   records = 2 small successes + 1 `budget-exhausted` logging 264_866 ⇒ `fundedStepDefault` tokens
   `=== 264_866 × MEASUREMENT_HEADROOM` (≥ 265k). Assert the OLD path (`recalibrate(...).envelope.tokens`)
   `=== 120_000` — the contrast that proves the ratchet broke. Assert price untouched.
2. **cold-start, no history** ⇒ `fundedStepDefault === prior × headroom` (room to record).
3. **well-calibrated (measured, 0 censored)** ⇒ `fundedStepDefault` equals the measured `recalibrate`
   envelope (funding == price, back-compat — no headroom).
4. **override still wins:** `resolveStepBudgets({ decomposeBudget: X }, propDefault, fundedDecompose)`
   ⇒ decompose takes `X`, not the funded default (the rung precedence holds through the funded default).
5. **price stays honest:** after `fundedStepDefault`, the sibling `recalibrate(...).envelope` is
   unchanged (guard ≠ price).
6. **totality:** empty records ⇒ valid positive-int `Budget`, no throw; `CHAIN_DEFAULT_TIER === "standard"`.

## Ordering (matters)

1. core: imports → `CHAIN_DEFAULT_TIER` → `fundedStepDefault`. 2. core test (proves 1). 3. chain
shell: `stepDefaults` + wire. 4. work.ts: import → price/funding split → thread. 5. full `bun run check`.
Steps 1–2 are independently green; 3–4 are impure-shell wiring proven by the green core + full suite.

## Verification gates

`bun run check` = `check:typecheck` (no `any`, exhaustive) + `check:test` (new core block + full
suite green — proves the additive change broke nothing) + lint/format. Manual confirmation that
`price`/`sumBudgets`/`priceOf`/`formatEnvelopeLabel` are untouched (IA-8) is by diff inspection.
