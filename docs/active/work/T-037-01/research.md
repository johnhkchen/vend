# T-037-01 — Research

**Pre-flight for the live macro-wallet sweep.** Map the four seams the go/no-go rests on:
(1) how the wallet prices the chain from the live ledger, (2) how affordability is decided,
(3) how `--no-intervened` threads the forward-E1 bit, (4) how the freshness gate decides staleness.
Pure/deterministic inspection — no live model. Coordinates verified against the running code, not
just the ticket's authoring notes.

## 1. The price path — `recalibrate` over the live ledger

`castWork` (`src/play/work.ts:147`) prices the chain ONCE before funding (it casts the same two
plays for every signal, so price is signal-independent):

```
work.ts:177  const { records } = await loadRunLog();              // the live .vend/runs.jsonl
work.ts:178  const prior = budgetForTier(PRICE_TIER);             // "standard" hand prior
work.ts:183  proposeEnvelope   = recalibrate("propose-epic",   records, "standard", prior).envelope
work.ts:184  decomposeEnvelope = recalibrate("decompose-epic", records, "standard", prior).envelope
work.ts:185  price = sumBudgets(proposeEnvelope, decomposeEnvelope)   // per-denomination sum
```

- `recalibrate` (`src/ledger/recalibrate.ts:124`): filters the ledger to the play, windows to the
  last 100 (`DEFAULT_WINDOW`), bounds tokens and wall-clock **independently** at the tier percentile
  over the **successful** runs. `standard` ⇒ `TIER_PERCENTILE = 0.9` (p90). Censored runs
  (`budget-exhausted` / `timed-out`) are counted but never averaged in (IA-13).
- Cold-start floor: `< COLD_START_MIN_SUCCESSES (3)` successes ⇒ return the `prior` verbatim
  (`source: "prior"`). Both plays clear this (5 and 6 successes), so both are `measured`.
- `prior = budgetForTier("standard")` (`src/shelf/gather.ts:135`) `= { timeMs: 3_600_000,
  tokens: 25_000 }` — only used if cold-start fires (it does not here).
- `totalTokens` (`run-log.ts:509`) = input + output + cache_read + cache_creation (all four).
  `wallClockMs` (`run-log.ts:497`) = `endedAt − startedAt`.
- `percentile` nearest-rank (`recalibrate.ts:109`): `idx = clamp(ceil(p·n) − 1, 0, n−1)`. For p90
  at small n this lands on the **max** observed (n=5 → idx 4; n=6 → idx 5) — deliberately
  conservative on a fat tail.

This is the SAME computation the `vend envelope` / `vend shelf` arms surface (`cli.ts:677`).

## 2. The affordability path — `canAfford` / `fitNext`

The autonomous loop's pure decision core (`src/engine/spend-core.ts`):

- `fitNext(wallet, candidates, priceOf)` (`spend-core.ts:93`): walks the pre-ranked board IN ORDER,
  returns the first candidate whose price `canAfford`s the wallet, else `null`. Returning a
  candidate IS the P7 authorization — only an affordable cast is ever offered.
- `canAfford(wallet, predicted)` (`wallet.ts:113`): `predicted.tokens <= remaining.tokens &&
  predicted.timeMs <= remaining.timeMs` — honest per denomination (must fit on BOTH); `<=` so
  spending exactly what remains is affordable.
- `shouldContinue` (`spend-core.ts:116`): three clean stops in precedence order — `andon` (last
  cast non-success) › `board-cleared` (`remaining === 0`) › `wallet-exhausted` (`!fits`).
- The wallet (`src/budget/wallet.ts`) is the depleting envelope: `allocate` funds once; `debit`
  subtracts the cast's **actuals** (floors at 0, surfaces token overshoot, IA-8). Authorization
  gates on the **predicted** price; the wallet debits the **actual** burn.

In `castWork`, `priceOf: () => price` (work.ts:190) — the constant predicted price for every signal.

## 3. The forward-E1 thread — `intervened: false` end-to-end

The `--no-intervened` self-report (clean walk-away) must reach each cleared record so `auditWalkAway`
reads it as **forward (live)**. Traced through the running code:

```
cli.ts:412   parseWorkArgs: "--no-intervened" ⇒ intervened = false
cli.ts:435   ParsedCommand.work carries `...(intervened !== undefined ? { intervened } : {})`
cli.ts:642   dispatch: castWork({ ..., ...(parsed.intervened !== undefined ? { intervened } : {}) })
work.ts:61   WorkOptions.intervened
work.ts:200  spread into castProposeDecomposeChain({ ..., intervened })  (only when defined)
chain-propose-decompose.ts:98  Step 1 (propose) opts: { ..., intervened: opts.intervened }
chain-propose-decompose.ts:120 Step 2 (decompose) opts: { ..., intervened: opts.intervened }
→ each play appends ONE run-log record carrying `intervened: false`  (two records per chain)
```

On read-back (`run-log.ts:351 reviveRecord`):
- `intervened = typeof r.intervened === "boolean" ? r.intervened : undefined` — `false` is **kept**
  (it is a real value, not absence).
- `intervenedAttested` is derived `true` ONLY from a truthy `intervenedAttestation` object marker OR
  an explicit `intervenedAttested === true` (run-log.ts:401-403). A live `--no-intervened` cast has
  **neither** ⇒ `intervenedAttested = undefined` ⇒ classified **forward**.

`auditWalkAway` (`src/ledger/walk-away.ts:160`):
- `forward = subStat(reported.filter(r => r.intervenedAttested !== true))` (walk-away.ts:206) —
  records carrying the bit but NOT attested. A `--no-intervened` cleared chain lands here.
- `attested = subStat(reported.filter(r => r.intervenedAttested === true))` (walk-away.ts:207).
- The combined `intervention.rate` is unchanged (back-compat); the split is additive (T-028-01).

**Key shape detail:** each cleared CHAIN appends **two** records (propose + decompose), both carrying
`intervened: false`. So a cleared chain contributes **two** forward "untouched" data points to the
walk-away rate, not one. (The epic frames it as "one record per chain" conceptually; the ledger
mechanics produce two.) This matters for T-037-03's count.

## 4. The freshness gate — `isBoardStale`

`castWork` runs the gate BEFORE funding (work.ts:162-168):
- `boardMtimeMs = stat(board.path).mtimeMs`; `liveMtimeMs = newestActiveMtimeMs(root)` — the newest
  `*.md` mtime across `docs/active/{epic,stories,tickets}` (work.ts:73, `ACTIVE_DIRS`).
- `isBoardStale(boardMtimeMs, liveMtimeMs)` (`work-core.ts:105`) `= boardMtimeMs < liveMtimeMs`.
  Equal/newer ⇒ **fresh** (fresh-on-tie). No live state (`newest = 0`) ⇒ fresh.
- Stale ⇒ `{ kind: "stale-board" }` ⇒ CLI renders amber andon + exits 1 (cli.ts:655). `--stale-ok`
  bypasses the gather entirely (work.ts:162).

A board staged at run time (T-037-02) is written AFTER every `docs/active/**` edit, so
`boardMtime ≥ liveMtime` ⇒ not stale ⇒ the gate passes.

## 5. The live ledger state (read 2026-06-20)

`.vend/runs.jsonl`: 25 records, 0 skipped. `propose-epic`: 5 successes + 2 censored. `decompose-epic`:
6 successes + 4 censored (some censored are synthetic test epics — A2/A4/E-900/E-901 — and pre-E-025
150k-default casts, e.g. run-2026-06-20T05-04-29 budget-exhausted at envelope 150k). Forward (live)
intervention sample: 2 records (one `intervened:true`, one `false`) ⇒ 50% walk-away. Attested
back-fill: 13 records (all `intervened:false`), carrying the `intervenedAttestation` marker.

## 6. Constraints / assumptions

- mtime is a heuristic (a `git checkout` can reset it) — hence `--stale-ok`, not a hard lock.
- The price predicts; the wallet debits actuals. Affordability is authorized on the prediction.
- `DEFAULT_BOARDS` (`work.ts:40`) still exist in source but the two staged board files were removed
  (2026-06-20) — so a bare `vend work` hits the no-board andon until a board is staged.
- Censored ≠ price-mismatch: a cast can still `budget-exhausted` at its (correct) envelope — that is
  an honest P7 andon, distinct from the E-024 no-op this ticket rules out.

## 7. Test coverage already in place (the deterministic proof surface)

`spend-core.test.ts` (fitNext / shouldContinue), `wallet.test.ts` (allocate/canAfford/debit),
`work-core.test.ts` (isBoardStale incl. tie/zero, renderStaleBoard), `walk-away.test.ts` (forward vs
attested split — line 162-168 mirrors the exact real-ledger 1/2-forward shape),
`chain-propose-decompose-core.test.ts` (resolveStepBudgets rung order, E-025), plus the offline
thread test `chain-propose-decompose.test.ts`. `castWork` itself is impure / proven LIVE by design.
