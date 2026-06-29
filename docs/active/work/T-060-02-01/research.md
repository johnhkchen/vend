# T-060-02-01 — Research

**Ticket:** derive-cold-start-budget-envelope-from-runlog-tails
**Story:** S-060-02 (cold-start-budget-calibration) · **Epic:** E-060 (fresh-seed-full-slice-clear)
**Goal of this phase:** map what already exists for envelope derivation, the run-log, the seed
drive's budget, and the wallet contract — descriptively. No solution here.

## What the ticket asks

> Compute the seed's cold-start budget envelope from measured run-log fat tails via the existing
> recalibrate core (IA-12/IA-13), **not** a hand-picked constant.

AC: a test asserts the cold-start envelope is **produced by recalibrate over the run-log
successful-run tails** (value-tier percentile, censored-aware) and is **distinguishable from the
hand prior when enough successes exist**; the value is **read from the ledger, not literal-coded**.

This card *derives* the envelope. The sibling T-060-02-02 (depends_on this) *wires* the derived
value as the hackathon-seed drive `--budget` default. So scope here = a calibration function + test;
NOT the seed wiring, NOT a display label.

## The recalibrate core — `src/ledger/recalibrate.ts`

The existing, well-tested home of measured-envelope derivation (E-013, IA-12/IA-13). PURE: every
export takes plain values, returns fresh ones; no fs/clock/process. Type-only on `Budget`
(`src/budget/budget.ts`) and `ValueTier` (`src/shelf/menu.ts`); value-imports only run-log's pure
record helpers (`forPlay`, `totalTokens`, `wallClockMs`). The zero-coupling rule holds: the Ledger is
the consumer where run-log ⊥ budget meet, and nothing imports the Ledger back.

Key surface for this ticket:

- `recalibrate(play, records, tier, prior, opts?) → RecalibrateResult` — filters `records` to
  `play`, windows to the most recent `window` (default 100), bounds **tokens and wall-clock
  independently** at the tier percentile (`TIER_PERCENTILE`) over the **successful** runs.
  Right-censors `budget-exhausted`/`timed-out` runs OUT of the percentile but COUNTS them
  (`CENSORED_OUTCOMES`). Below `COLD_START_MIN_SUCCESSES` (3) successes it returns the `prior`
  verbatim with `source: "prior"` (the recalibrate-internal cold start), else `source: "measured"`.
- `RecalibrateResult = { envelope: Budget; confidence: { successes; censored; percentile }; source:
  "measured" | "prior" }`.
- `TIER_PERCENTILE = { keystone: .95, high: .92, standard: .9, leaf: .75 }`.
- `percentile(sortedAsc, p)` — exact nearest-rank (ceil); conservative on small n.
- `fundingEnvelope(play, records, result, opts?)` — the GUARD a cast runs under (≥ price);
  separate from the PRICE. Already applied per-cast inside `vend work`. NOT this ticket's concern
  (T-060-02-02's AC keeps the quote = p90 price, headroom not folded in).
- `formatEnvelopeLabel(result)` — honest one-line label ("measured · N casts · pXX" | "estimate
  (…)"). Reusable if a label is wanted.

**Naming note:** "cold start" is overloaded. (a) recalibrate's *internal* cold start = the
`< minSuccesses` → prior fallback. (b) the *seed's* cold-start budget = the budget that funds a
fresh-seed first drive. This ticket computes (b) by composing recalibrate; (b) is "measured" exactly
when its constituent recalibrate calls clear (a)'s threshold.

## The run log — `src/log/run-log.ts`

Append-only JSONL ledger at `.vend/runs.jsonl` (`DEFAULT_RUN_LOG_PATH`). One `RunRecord` per run.
Relevant reads (all PURE): `loadRunLog()` (impure fs read → `{ records, skipped }`, ENOENT ⇒
empty), `forPlay`, `totalTokens` (sum of 4 usage sub-counts), `wallClockMs` (`endedAt − startedAt`,
or null). `RunOutcome` includes `success`, `budget-exhausted`, `timed-out`, `missing-capability`,
etc. Records optionally carry `envelope` (the allocation they ran under) and `project`.

Current live ledger (`.vend/runs.jsonl`, 3 lines, all `success`):
- `steer` — 138k tok, ~181 s
- `propose-epic` — 88k tok, ~45 s
- `decompose-epic` — 158k tok, ~82 s

So today there is **1 success per play** — below `minSuccesses` (3). Against the real ledger,
recalibrate cold-starts to the prior. The AC's "distinguishable when enough successes exist" must
therefore be proven on a **fabricated** ledger fixture (≥3 successes per play), exactly as
`recalibrate.test.ts` already does.

## The seed drive's budget today — the hand-picked constants we are replacing

- `src/play/work.ts`: `DEFAULT_MACRO_BUDGET = { timeMs: 7_200_000, tokens: 2_000_000 }` (2h/2M) —
  the "fund it, walk away" default when `--budget` is omitted. `castWork` reads the board, funds the
  wallet, and computes `price = sumBudgets(recalibrate(propose-epic), recalibrate(decompose-epic))`
  at `PRICE_TIER = "standard"` with `prior = budgetForTier("standard")`. **This `price` line is
  exactly the seed cold-start envelope we want** — the per-clear cost of the propose→decompose chain,
  measured from tails. The chain casts BOTH plays per signal, kept denomination-separate (IA-8).
- `src/shelf/gather.ts`: `TIER_BUDGET` (the `budgetForTier` hand priors) — keystone 2h/80k … leaf
  15m/8k. Header literally says *"Calibration-pending — set from the run log's measured fat tails
  once enough runs exist."* This ticket is that calibration, for the seed cold-start case.
- `examples/templates/hackathon-seed/{EXPECTED-OUTCOME,README,shelf-note}.md`: hand-picked
  `--budget` values (`7300000,500000`, `1800000,1000000`, etc.). EXPECTED-OUTCOME finding #2 (the
  "budget-shape finding"): the cold-start propose→decompose chain *priced at ~120 min on the time
  axis* (because at T-058 there were no successes → recalibrate fell back to the inflated hand prior,
  e.g. decompose's 4h logged envelope), and the denomination-separate wallet refuses a pull whose
  price exceeds **either** axis — so a tight `--budget …,<small-ms>` funds nothing.

## The wallet / authorization contract — `src/budget/{budget,wallet}.ts`, `src/engine/spend.ts`

- `Budget = { timeMs, tokens }`. Both dimensions positive ints (`assertPositiveInt`).
- `vend work` authorizes a cast iff its `price ≤ remaining` on BOTH axes (denomination-separate,
  IA-8), runs it under the per-cast `fundingEnvelope` (headroomed), and DEBITS the actuals.
- Implication for the seed: if the macro budget = price-of-one-clear, the first cast authorizes
  (price ≤ macro on both axes), runs, and clears ≥1 slice. The realistic measured time (seconds,
  not the 120-min prior) is what makes the two-gesture budget fundable — the calibration directly
  dissolves finding #2.

## Existing patterns to imitate

- `recalibrate.test.ts` — `recordOf({ tokens, durationMs, outcome, play })` fabricates frozen
  `RunRecord`s via the real `buildRunRecord`; `PRIOR` fixture; per-tier percentile assertions.
- `work.ts` `sumBudgets(a, b)` — per-denomination budget sum (private; the merge we need).
- The house "pure core + thin impure shell" split (run-log, recalibrate, gather) — a pure derivation
  that takes `records`, plus the existing impure `loadRunLog` to feed it; the CLI/seed composes.

## Constraints & assumptions surfaced

1. recalibrate.ts must stay decoupled from `src/play/` — so the set of drive plays is **passed in**,
   never imported (mirrors "prior is passed in, not imported").
2. Output must be derivable from the ledger; no literal budget may be the answer. The hand prior is
   only the labelled cold-start fallback (recalibrate already owns that).
3. Tokens AND wall-clock bounded independently and censored-aware — inherited free by delegating to
   `recalibrate`.
4. PURE/TOTAL like the rest of the module; the empty-plays degenerate must not throw a `NaN` budget.
5. Right-sizing (epic): if calibration needed *new* recalibrate tooling it would spin out — it does
   not. We only compose existing `recalibrate` over existing tails. Scope holds.
