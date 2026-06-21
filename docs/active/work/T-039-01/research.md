# T-039-01 — Research (the live re-sweep, pre-run codebase map)

Descriptive map of the spend path this ticket exercises live, the E-038 fix it must confirm in
flight, and the freshness/ledger seams the sweep-log reads. No solutions here — that is Design.

## What this ticket is

Not a code change. A **live, metered operation**: re-run E-037's bounded macro-wallet sweep now
that E-038 gave the per-cast kill-switch 2× headroom, and watch whether a pull actually **clears**
(mints a real epic+tickets) instead of being guillotined on time at ~72.8 s. The deliverable is
`sweep-log.md` (verbatim output + honest verdict), not a diff. The only files this ticket *writes*
are the six RDSPI work artifacts; the live run mutates `.vend/runs.jsonl` (ledger appends) and, on a
clear, `docs/active/{epic,stories,tickets}/*` (minted board cards).

## The spend path (what `vend work` actually does)

`src/cli.ts` `work` arm → `castWork` (`src/play/work.ts:147`) → `spendDown` (`src/engine/spend.ts:61`)
→ `castProposeDecomposeChain` (per signal) → ledger append. Concretely:

1. **`readBoard`** (`work.ts:98`) — read the first readable of `DEFAULT_BOARDS`
   (`docs/active/pm/staged/steer.md`, then `…/survey-board.md`). ENOENT ⇒ try next. Missing ⇒
   `WorkResult{kind:"no-board"}`.
2. **`parseBoardSignals`** (`work-core.ts:65`) — scan for `vend chain "<signal>"` lines (the
   `## Pull these` block), already ranked highest-leverage-first (IA-1; the loop never re-sorts).
   Empty ⇒ `{kind:"empty-board"}`.
3. **Freshness gate** (`work.ts:162`) — unless `--stale-ok`, stat the board and compare to
   `newestActiveMtimeMs` across `docs/active/{epic,stories,tickets}`. `isBoardStale`
   (`work-core.ts:105`) is `boardMtime < liveMtime` (fresh-on-tie). Stale ⇒ `{kind:"stale-board"}`,
   a clean amber refusal — **NOT** a thrown fault.
4. **Fund + price** (`work.ts:170-185`) — `allocate(funded)` builds the wallet; the chain's price is
   predicted **once** (it casts the same two plays for every signal): `recalibrate(proposeEpicPlay…)`
   + `recalibrate(decomposeEpicPlay…)` at the `standard` tier over the ledger, cold-starting to the
   hand prior (`budgetForTier`). `price = sum` gates P7 `canAfford`; the two **per-step envelopes are
   threaded separately** into each cast (E-025: authorize==execute, no 227k→150k mismatch).
5. **`spendDown`** (`spend.ts:61`) — the walk-away loop: `fitNext` selects the highest-leverage
   affordable signal; `shouldContinue` checks the three clean stops; `castOne` casts the chain;
   `debit` subtracts the **actuals** (`sumActuals`, `spend.ts:126` — per-step `actuals.usage` via
   `countTokens`, ledger fallback by `runId`); drop the candidate; repeat. An andon'd cast is still
   debited, then ends the session next iteration (IA-9, a successful refusal).
6. **Settle** — `renderReceipt` (`work-core.ts:151`): one line per cast (`✓ cleared` /amber `⚠ andon`),
   the final wallet via `formatWallet` (IA-8 two-denomination), and the stop reason.

## The E-038 fix to confirm LIVE (the whole point)

`src/budget/budget.ts`:
- `TIMEOUT_HEADROOM = 2` (line 95) — the kill-switch runs at **price × 2**.
- `timeoutMsFor(budget)` (line 106) — `Math.ceil(budget.timeMs * TIMEOUT_HEADROOM)`. The **price**
  (`budget.timeMs`, the recalibrated p90) is untouched (IA-8 — the meter must not lie); only the
  per-cast runaway-guard gets headroom.

**The censoring ratchet this breaks** (budget.ts:82-94): the price is the p90 over *successful* runs;
a `timed-out` run is right-censored (`CENSORED_OUTCOMES`, `recalibrate.ts`) — counted but excluded
from the percentile sample. So a cast killed *at* the envelope can never enter the sample that would
*raise* it. E-037's successes sit at 66.9–72.8 s, its kills at ~72–73 s; p90-as-timeout caps itself.
Headroom lets a heavy cast FINISH and land a SUCCESS that enters the sample honestly.

**Deterministic pre-check result (run live, free):** `timeoutMsFor({timeMs:72785}) = 145570` ✓ — the
propose-epic envelope that killed E-037 at 72,785 ms now has a ~145 s wall, so the ~73 s casualties
would finish. Affordability still gates on the bare price (E-038 is isolated to the kill-switch).

## The forward-E1 ledger seam (what the sweep-log must read)

`.vend/runs.jsonl`, append-only. Each record: `play`, `epic`, `outcome`
(`success|budget-exhausted|timed-out`), `usage`, `envelope`, `intervened`, timestamps. The
`--no-intervened` flag threads `intervened:false` into every chain cast (`work.ts:200`), and a record
with `intervened:false` + **no** `intervenedAttestation` is classified **forward (live)** by
`auditWalkAway` (`src/ledger/walk-away.ts:160`, T-039-02's coordinate). The headline target: the
**first CLEARED forward-E1 record** — `intervened:false` **and** `outcome:success`.

**Current ledger tail (the E-037 casualties, last 2 records):** two `propose-epic` records,
`model:claude-cli-default`, `envelope.timeMs:72785`, `outcome:timed-out`, `intervened:false`,
`usage` all-zero (killed before first token). These are forward-but-censored — they enlarge the
reported forward sample without adding a cleared data point. Forward-E1 baseline entering E-039:
**4/10, all censored** (no cleared pulls yet).

## The staged board reality (why a fresh cast is needed)

`docs/active/pm/staged/steer.md` is dated **16:02:44**; newest `docs/active/{epic,stories,tickets}`
md is **17:01:23** (T-039-01.md itself, plus the E-038 commit 16:38 and E-039 pull). So
`isBoardStale` = **true** → the gate refuses the staged board. A fresh `vend steer`/`survey` cast is
genuinely required (not a contrived staleness). The stale board's #1 (from T-037-02) was the
**self-referential** "Run and settle the E-037 live macro sweep" — a degenerate recursive target; the
ticket warns to inspect the fresh #1 for the same pathology and, if found, point the sweep at the top
**concrete** signal instead (a meta-target is not a valid clear-test).

## Constraints / assumptions

- **Live spend is real**: `claude` CLI 2.1.185 and `bun` 1.3.9 are present. The run spawns real
  `claude -p` subprocesses, debits real tokens, and on a clear mints real artifacts. P7 (the bounded
  wallet) is the safety contract — it stops clean, nothing partial.
- **Comparability**: budget `3600000,1000000` (~1h/~1M), identical to E-037, so the cleared-vs-censored
  delta is attributable to the E-038 fix, not a budget change.
- **Honesty standard (E-037)**: a 0-clear with a named, moved bottleneck (e.g. "propose finished ✓ but
  decompose censored") is an honest result, not a failure to hide. The sweep-log must not over-claim
  and must capture verbatim output.
- **auth==exec (E-025)** must hold: the cast runs under exactly the envelope it was authorized at.
- T-039-02 (the settle pass, `auditWalkAway`) is downstream and out of scope here.
