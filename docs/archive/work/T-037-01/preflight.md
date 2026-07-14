# T-037-01 — Pre-flight for the live macro-wallet sweep

**Verdict: GO** (conditional on T-037-02 staging a board with ≥2 ranked signals).
**Free + deterministic. No live model was cast.** All numbers below were computed by running the
*same pure functions `castWork` uses* over the live `.vend/runs.jsonl` (25 records, 0 skipped), read
2026-06-20. `bun run check:typecheck` clean, `bun test` 998 pass / 0 fail.

The decisive fact: **authorization == execution** (E-025). `castWork` threads the *same*
per-step envelopes it prices on into the cast (work.ts:183-185 priced; work.ts:195-196 cast via
`resolveStepBudgets`). The E-024 failure — authorized at 227k, cast at the 150k static default →
budget-exhausted → **cleared 0** — cannot recur. So the bounded metered run will clear, not no-op.

---

## Claim 1 — The wallet prices the chain from the LIVE ledger ✅

`castWork` predicts the chain price once: `sumBudgets(recalibrate("propose-epic").envelope,
recalibrate("decompose-epic").envelope)` at the `standard` tier (p90) over `loadRunLog()`
(work.ts:177-185). Reproduced exactly by executing those pure functions:

| Play | Envelope (timeMs / tokens) | Source | Confidence |
|------|----------------------------|--------|------------|
| propose-epic   | **72,785 ms / 227,390 tok**  | measured | 5 successes · p90 · 2 censored |
| decompose-epic | **160,745 ms / 227,464 tok** | measured | 6 successes · p90 · 4 censored |
| **CHAIN (sum)** | **233,530 ms / 454,854 tok** | — | **= 454.9k tokens / ~233.5 s (~3.9 min)** |

Both plays are `measured` (≥3 successes ⇒ past the cold-start floor; the `standard` prior
`{3,600,000 ms / 25,000 tok}` is NOT used). p90 nearest-rank on small n lands on the max observed
success — conservative on the fat tail, as designed (recalibrate.ts:109). These are the same numbers
`vend shelf` / `vend envelope` surface; they match the last-read ~455k / ~233s.

Raw harness output (pure modules only, executed during this preflight):

```
records: 25 skipped: 0
prior (standard): {"timeMs":3600000,"tokens":25000}
propose  envelope: {"timeMs":72785,"tokens":227390} src: measured conf: {"successes":5,"censored":2,"percentile":0.9}
decompose envelope: {"timeMs":160745,"tokens":227464} src: measured conf: {"successes":6,"censored":4,"percentile":0.9}
CHAIN PRICE: {"timeMs":233530,"tokens":454854} = 454.9k tok / 233.5s
```

---

## Claim 2 — A bounded budget affords ≥1 chain (~2) ✅

Recommended bounded budget (P7, the contract): **`--budget 3600000,1000000`** (1 h / 1M tokens) —
a real-but-contained spend, NOT the 2M default. Simulating the P7 authorization gate
`canAfford(wallet, price)` (wallet.ts:113) at the predicted price:

- **Chains afforded: 2.** Token-bound: ⌊1,000,000 / 454,854⌋ = **2**. Time-bound: ⌊3,600,000 /
  233,530⌋ = **15**. **Tokens is the binding denomination.**
- 1 chain costs 454.9k ≤ 1M funded ⇒ **≥1 guaranteed**. Two chains predicted = 909,708 ≤ 1M; a 3rd
  (1,364,562) exceeds 1M and is correctly refused → `wallet-exhausted` clean stop.

So the run **spends down across casts** (≈2), demonstrating the headline gesture — not a single
re-sweep cast.

```
bounded budget: {"timeMs":3600000,"tokens":1000000}
chains affordable at predicted price (P7 auth): 2
  token-bound: 2  time-bound: 15
```

**Caveat (honest):** the wallet debits *actuals*, not the prediction. p90 is conservative (recent
real casts ran 77k–227k), so actuals ≈ or below the envelope ⇒ realized authorizations are ≥2 (a 3rd
is possible only if both actuals run well under p90). Floor is firmly ≥1. Two chains require the
staged board to carry **≥2 ranked signals** — a T-037-02 staging precondition.

---

## Claim 3 — `--no-intervened` threads the forward-E1 bit ✅ (pure path, no live cast)

End-to-end thread, confirmed against the running source (every edge present):

```
cli.ts:412  "--no-intervened" ⇒ intervened = false
cli.ts:435  ParsedCommand.work.intervened
cli.ts:642  castWork({ …, intervened })                       (spread only when defined)
work.ts:200 castProposeDecomposeChain({ …, intervened })
chain-propose-decompose.ts:98  Step 1 propose  opts.intervened
chain-propose-decompose.ts:120 Step 2 decompose opts.intervened
→ each cleared step appends ONE run-log record with `intervened: false`  (TWO records per chain)
→ reviveRecord (run-log.ts:391) keeps `false`; no `intervenedAttestation` marker
  ⇒ intervenedAttested = undefined ⇒ classified FORWARD (run-log.ts:401-403)
→ auditWalkAway forward sub-stat (walk-away.ts:206) counts it as a live walk-away record
```

Live-ledger audit confirms the split mechanism works today:

```
combined reported: 15 intervened: 1 rate: 0.067
forward (live): {"reported":2,"intervened":1,"rate":0.5} => walk-away 50%
attested back-fill: {"reported":13,"intervened":0,"rate":0}
```

Forward = **50% (1/2)** — exactly the epic's "off its provisional floor" starting point. The 13
attested records carry the `intervenedAttestation` marker (post-hoc back-fill) and are correctly
kept OUT of the forward pool. Locked by `walk-away.test.ts:162-168` (which mirrors this exact
1/2-forward ledger shape) and `chain-propose-decompose-core.test.ts` (per-step budget rung →
auth==exec).

**Important shape note for T-037-03:** each cleared CHAIN appends **two** forward records (propose +
decompose), both `intervened:false` ("untouched"). So a 2-chain clean sweep adds **4** forward
untouched records (forward sample 2→6, intervened 1, walk-away → 5/6 ≈ 83%). Do not over-claim:
moving the count is not meeting the ≥10 bar.

---

## Claim 4 — The freshness math passes for a run-time board ✅

`isBoardStale(boardMtimeMs, liveMtimeMs) = boardMtimeMs < liveMtimeMs` (work-core.ts:105) — strictly
less-than, so **fresh-on-tie** and fresh when there is no live state. A board staged at run time
(T-037-02 via `vend steer`/`survey`) is written *after* every `docs/active/{epic,stories,tickets}`
edit, so `boardMtime ≥ liveMtime` ⇒ **not stale** ⇒ the gate passes and funding proceeds
(work.ts:162-168). `DEFAULT_BOARDS` files were removed (2026-06-20), so the run must stage fresh —
which is exactly what makes it pass. Override `--stale-ok` exists (mtime is a heuristic) but is not
needed. Locked by `work-core.test.ts:134-145` (older⇒stale, newer⇒fresh, tie⇒fresh, zero⇒fresh).

---

## GO / NO-GO

**GO.** auth==exec holds (E-025): the chain runs under exactly the 227k+227k per-step envelopes it
was priced/authorized at, so the metered run will **clear**, not no-op. The bounded 1h/1M budget
affords ~2 chains at the live price (454.9k each), demonstrating spend-down to a clean P7 stop. The
`--no-intervened` bit threads end-to-end so each cleared record reads as forward (live) E1, moving
the count off 1/2. A run-time-staged board clears the E-027 freshness gate.

**Preconditions / honest caveats for T-037-02 (recorded, not blockers):**
1. Stage a board with **≥2 ranked signals** for the 2-chain spend-down (≥1 still clears with 1).
2. A per-cast `budget-exhausted` at its (correct) p90 envelope is an **honest P7 andon**, NOT the
   E-024 price-mismatch no-op — record it truthfully if it happens.
3. The wallet debits actuals; realized authorizations ≥1, expected ~2.
4. Each cleared chain = 2 forward records; one session moves the count, it does **not** meet the ≥10
   bar — no over-claim (T-037-03).

---

## Verification log

- `bun run check:typecheck` → clean (`tsc --noEmit`, exit 0).
- `bun test` → **998 pass / 0 fail**, 2439 expect() calls, 66 files.
- Numbers computed by a throwaway pure-module harness over `.vend/runs.jsonl` (created, run,
  removed — not committed; output frozen above). No executor seam touched; no live model cast; no
  source modified.
