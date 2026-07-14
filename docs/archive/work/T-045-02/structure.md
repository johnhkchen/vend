# T-045-02 — Structure: settle the cadence and judge the ≥10 bar

This is a **settle/read ticket** (E-014/E-026 shape, mirrors T-026-04 / T-039-02), not a code
ticket. The deliverable is a **verdict + a `demand.md` board update**, grounded in the ledger the
T-045-01 sweep wrote. No source changes. The "structure" here is the shape of the *finding* and the
one doc edit it crystallizes.

The four reads the ticket asks for are already resolved empirically (the audit + the revived-ledger
split below); this artifact pins the numbers and the file-level change so Plan/Implement are
mechanical. Source-of-truth numbers come from `auditWalkAway` (`src/ledger/walk-away.ts:160`) via
`bun run src/cli.ts audit`, plus the forward outcome-composition obtained through the **real revive
path** (`readRuns` → `reviveRecord`, `src/log/run-log.ts:351`) — NOT raw `grep` over
`.vend/runs.jsonl`, because the attestation marker (`intervenedAttestation`) is a raw field that
`reviveRecord` maps to `intervenedAttested`; raw grep miscounts forward as 23 instead of 10.

## The empirical reads (ground truth, captured 2026-06-20 19:40 PDT)

`vend audit` (window=`DEFAULT_WINDOW`=100, so all 36 records in scope):

```
E1 — walk-away trust · all plays · 36 runs [standard]
  walk-away rate: 96% (22/23 ran untouched) · trend 100% → 92%
    └ forward (live): 90% (9/10 untouched) · attested back-fill: 100% (13/13 untouched)
  andon rate: 36% vs 10% budget — ⚠ over (gates working, not defects)
  outcome mix: 23 success · 10 censored · 3 gate-failed · 0 id-collision
  cost vs envelope: tokens ×0.64 · time ×0.12 (median over 17 successful runs)
```

**Read 1 — Forward-E1 count + composition (forward-only; never the combined pool — the T-026-04
trap).** Forward (live) self-reports carrying the `intervened` bit and **not** attested =
**10** (was 8). Outcome composition of those 10, via the revive path:

| forward outcome | count |
|---|---|
| `success` (cleared) | **5** |
| `budget-exhausted` (censored) | 3 |
| `timed-out` (censored) | 2 |
| `gate-failed` | 0 |
| **genuinely `--intervened`** | **1** (one `budget-exhausted` record carries `intervened:true`) |

So forward-10 = **5 cleared / 5 censored / 1 genuine intervention**. (Combined pool is 23 reports
@ 96% walk-away — cited here only to show it is *not* what the verdict reads.)

**Read 2 — the ≥10-bar verdict (load-bearing).** Forward records = **10 ≥ 10** ⇒ the pre-wired
E-014/E-026 rule is **MET**. State it plainly (no under-claim). Composition caveat (no over-claim):
9/10 forward runs ran untouched and only **1** was a genuine intervention — this is **"didn't-break"
evidence, not "stress-tested."** The genuine `--intervened` count (1) is the real stress signal and
it is thin. ⇒ the go upgrades **provisional → bar-met**, NOT "bulletproof" (the E-026/T-026-04 trap).

**Read 3 — E-043/E-044 confirmed live.**
- **E-044 (concrete #1) — LIVE.** The T-045-01 re-stage produced a fresh board whose #1 was *"Build
  the typed multi-node DAG"* — concrete product demand; the self-referential *"run the sweep"* signal
  was **absent from the entire fresh board**. Stronger still: that #1 was *cleared into a real epic*
  (**E-046 `typed-dag-fan-out-join-substrate`**). The ranker demoted the meta-task with no manual
  re-point. Confirmed.
- **E-043 (no orphan) — LIVE.** The sweep minted exactly **one** new card (E-046; epic files 45→46).
  No duplicate-title epic exists (`grep '^title:' … | uniq -d` empty). The adopt-before-mint guard
  held. **Honest caveat:** E-046's `decompose-epic` hit **`budget-exhausted`** (clean P7 stop), so
  E-046 is minted but **un-decomposed** (no `S-046*`/`T-046*` yet) — a *partially-cleared chain*, not
  an orphan. Orphan (E-043's target) = a *duplicate* mint; this is a single clean card stopped
  mid-chain by the budget. `lisa validate` green (109 tickets, DAG valid).

**Read 4 — clear quality + P7/auth==exec.**
- **Clear quality: sound, not thin.** E-046 is a keystone-grade Frontier-3 epic — the typed DAG the
  v1 vision is named after (`advances: [P1, P6]`, well-formed `serves`/Intent). High quality.
- **P7 held.** The metered tranche stopped at **`budget-exhausted`** against the funded 1M/1h
  envelope — a clean stop with a truthful receipt (the censor is recorded honestly, not masked).
- **auth==exec (E-025).** Funded envelope (`--budget 3600000,1000000`) == executed envelope; no
  drift between what was authorized and what ran.

## File-level change (the only mutation)

| File | Change | Why |
|---|---|---|
| `docs/active/demand.md` | **Modify** — crystallize E-045 on Frontier 1: forward count 8→**10**, composition (5 cleared / 5 censored / 1 intervened), **≥10-bar MET** verdict with the didn't-break caveat, E-043/E-044 live confirmations, E-046 partial-chain note. Move the `In flight` E-045 row to a settled state. | AC#4 — the board is the durable record of the verdict. |
| `docs/active/work/T-045-02/{structure,plan,progress,review}.md` | **Create** — RDSPI artifacts. | Workflow. |

No `src/**` changes. No new tests (the seams under audit — `auditWalkAway`, E-043, E-044 — are
already shipped + green; this ticket *reads* them). `bun run check` must stay green (doc-only edit).

## Invariants this settle must hold

1. **Forward-only citation.** Every load-bearing number is the forward (live) sub-stat, never the
   23-report combined pool (T-026-04 trap).
2. **No under-claim.** The project pre-wired ≥10; 10 is met; say "met" without hedging it to nothing.
3. **No over-claim.** "bar-met," not "bulletproof"/"forward-confirmed-robust" — 1 genuine
   intervention is thin; the evidence is didn't-break.
4. **Honest regressions.** E-046's un-decomposed state is recorded as a partial chain, not hidden and
   not mislabeled an E-043 regression.
5. **auth==exec / P7.** The receipt is reported as the clean censor it was.
