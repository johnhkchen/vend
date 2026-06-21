# T-039-01 — Review (handoff)

Self-assessment of the live, metered re-sweep. What a reviewer needs to trust the result without
re-running an hour of casts. **Headline: the macro-wallet cleared 2 real pulls on a bounded
walk-away; E-038's timeout headroom is confirmed live; the first cleared forward-E1 records are in
the ledger.** No source code changed — this ticket is an operation, and its output is evidence.

## What changed (created / mutated, no source edits)

**Work artifacts** (`docs/active/work/T-039-01/`): `research.md`, `design.md`, `structure.md`,
`plan.md`, `progress.md`, **`sweep-log.md`** (the deliverable), `review.md`, plus raw captures
`_sweep-raw.txt` (the cleared run) and `_sweep-raw-aborted-mispoint.txt` (the killed mis-pointed
launch, kept for honesty).

**New board:** `docs/active/pm/staged/concrete-board.md` (the re-pointed board — concrete demand,
self-referential #1 dropped). **Refreshed:** `docs/active/pm/staged/steer.md` (the fresh steer cast).

**Runtime state (the live spend, expected):**
- `.vend/runs.jsonl` 28 → 33 (+5): 1 steer + 2 propose-epic + 2 decompose-epic, all `success`.
- Minted board cards (untracked): **E-040** (`vend-init-scaffold`) + S-040-01/02 + T-040-01..04;
  **E-042** (`vend-doctor-preflight`) + S-042-01/02 + T-042-01..04; plus the duplicate orphan
  **E-041** (see Concern 1).

**No source files were modified.** The seams under test (`timeoutMsFor`, `castWork`, `spendDown`,
`renderReceipt`) were exercised live, not edited.

## Did it meet the acceptance criteria? Yes — all five.

1. **Pre-check go** — `timeoutMsFor({timeMs:72785})=145570` (E-038 live) + staged board stale. ✅
2. **Fresh concrete board, #1 recorded** — steer @ 17:07; #1 was self-referential → recorded as a
   finding and re-pointed at the top concrete signal (`vend init`). ✅
3. **Bounded walk-away to a clean P7 stop, propose finishing** — `--no-intervened --budget
   3600000,1000000`; propose ran 93 s & 83 s (no timeout); stopped `wallet exhausted`. ✅
4. **≥1 real pull cleared + first cleared forward-E1 record** — **2 cleared** (E-040, E-042),
   `lisa validate` green, auth==exec held; ledger records 30–33 all `intervened:false`+`success`. ✅
5. **sweep-log.md captures verbatim steps + receipt + ids + ledger delta, honest** — done, incl. the
   two findings. ✅

The AC's "**or** an honest record of where it stopped" fallback was not needed — the run cleared.

## Test coverage / verification

This ticket adds no code, so no unit tests. Verification was observational and cross-checked against
persisted truth, which is the correct standard for a live operation:

- **Pre-spend:** deterministic `bun -e` falsification of the E-038 fix (cheapest possible check, run
  before any token spent).
- **In-flight:** the IA-8 two-denomination meter renders the actual burn; the receipt is
  self-verifying.
- **Post-spend (three independent sources agree):** (a) the **receipt** (`Cast 2, cleared 2`,
  `wallet exhausted`); (b) the **ledger** (4 `success` forward records, propose elapsed 93 s/83 s);
  (c) **`lisa validate`** green + `git status` showing valid minted cards. Receipt, ledger, and
  validator are mutually consistent — the meter did not lie.

The seams themselves carry their own unit tests from prior epics (`budget.test.ts` for
`timeoutMsFor`/`TIMEOUT_HEADROOM` under E-038; `spend-core.test.ts`/`wallet.test.ts` for the loop;
`work-core.test.ts` for parse/render). This run is their **live** proof.

## Open concerns / flags for human attention

1. **Duplicate orphan epic E-041 (overproduction — needs a decision).** The `vend doctor` clear minted
   the epic twice: E-041 (childless, not in the ledger, not in the sweep's effect log) and E-042 (the
   decomposed, logged one). `lisa validate` stays green (a childless epic isn't a DAG violation), but
   two epic cards for one signal is overproduction. **Action for T-039-02 / follow-up:** (a) delete
   the E-041 orphan during the settle, and (b) consider an idempotent-mint guard in the propose-epic
   play so an id double-allocation can't leave a stray card. Severity: low (cosmetic/board-hygiene),
   but it touches the trust contract (the board should reflect exactly what cleared).

2. **The board ranker still surfaces a self-referential #1.** Two sweeps running (E-037, E-039) have
   now both had `vend steer` recommend "run the sweep" as the top pull. The re-point handled it, but
   the *ranker* over-weighting the meta keystone is a recurring steer-quality issue — it will keep
   surfacing until the steer/survey ranker demotes self-referential targets. Worth a Frontier-1 or
   steer-quality ticket. Severity: low-medium (it didn't block this run, but it's friction every
   sweep and a foot-gun for an unattended operator who doesn't catch it).

3. **One process-discipline miss (already corrected, no residue).** The first `vend work` launch
   omitted `--board` and began casting the degenerate #1; caught within seconds, killed before any
   ledger append (ledger unchanged at 29), aborted capture preserved. No fabrication, no partial
   state — but a reminder that the re-point must be encoded in the command, not just intended.

## Honest scope notes

- **The minted epics are unreviewed for quality.** E-040/E-042 cleared the play's own gates
  (`value`/`bounds`/`structural`/`allocation`) and `lisa validate`, but this ticket did **not**
  assess whether `vend init`/`vend doctor` are *well-specified* epics — only that real pulls cleared.
  Epic quality is downstream (whoever pulls those tickets, and T-039-02's settle read).
- **Forward-E1 cadence is begun, not complete.** +4 cleared forward records move the project off
  "4/10, all censored," but the ≥10-cleared bar is a cadence T-039-02 (and future sweeps) own — this
  run is the first cleared installment, not the finish line. No over-claim that autonomy is fully
  ungated.
- **Comparability preserved.** Budget identical to E-037; the only changed variable was E-038's
  headroom, so the 0-clear → 2-clear delta is attributable to the fix.

## Recommendation

**Accept.** The headline E-039 proof landed: the macro-wallet cleared real product work on a bounded
walk-away, E-038 is confirmed live (propose finished past the old wall), and the ledger now holds the
first cleared forward-E1 records. Hand to **T-039-02** to (1) run the `auditWalkAway` forward-rate
read on the new records, (2) adjudicate the E-041 duplicate orphan, and (3) record the honest forward
delta. The two findings are board-hygiene/steer-quality follow-ups, not blockers.
