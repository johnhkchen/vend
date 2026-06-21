# T-039-02 — Review (handoff)

Self-assessment of the settle. What a reviewer needs to trust the result without re-deriving the
ledger read. **Headline: the macro-wallet is now watched CLEARING — E-039 cleared 2 grounded pulls,
E-038 is proven live, the first 4 cleared forward-E1 records are in the ledger; the go hardens but
stays provisional + forward-leaning, NOT forward-confirmed.** No source code changed — this ticket is
an evidence operation; its output is a verdict + a crystallized board + one board-hygiene deletion.

## What changed

**Work artifacts** (`docs/active/work/T-039-02/`): `research.md`, `design.md`, `structure.md`,
`plan.md`, `progress.md`, **`verdict.md`** (the deliverable), `review.md`.

**Modified:** `docs/active/demand.md` — Frontier 1 crystallized (in-flight row + narrative): E-039
settled, **cleared 2**, forward **4/10 (all censored) → 8/10 (4 cleared)**, go = watched clearing /
provisional, cadence to ≥10 restated.

**Deleted:** `docs/active/epic/E-041.md` — the childless duplicate orphan from the `vend doctor`
double-mint (verified no inbound story/ticket references; not in the ledger). `lisa validate` green
after removal.

**No `src/` files modified.** The instrument under read (`auditWalkAway`, `src/ledger/walk-away.ts`)
was exercised via `vend audit`, not edited.

## Did it meet the acceptance criteria? Yes — all five.

1. **`vend audit` re-run; cleared-vs-censored forward read, first cleared record distinguished,
   forward-only numbers.** ✅ Forward **88% (7/8 untouched)**; the **first cleared record is #30**
   (propose-epic `vend init`, `success`, `intervened:false`); records **30–33 = 4 cleared** (vs the
   censored #28). Combined 95% (20/21) cited **once, to exclude** (T-026-04 trap). Not a 0-clear, so
   the fallback wasn't needed.
2. **Clear-quality read + propose FINISHED (E-038 live) + P7 held + auth==exec held (E-025).** ✅
   E-040/E-042 **sound & grounded** (decomposed, DAG valid, validate green) — not self-referential.
   propose finished **93 s/83 s past 72,785 ms**; clean P7 wallet-exhausted stop; auth==exec held.
3. **`verdict.md`: watched clearing, forward cleared count, provisional + named cadence to ≥10, no
   over-claim.** ✅ Written; two-denomination cadence (sample 8/10; cleared 0→4 toward ≥10); explicit
   "NOT forward-confirmed."
4. **`demand.md` Frontier 1 updated honestly.** ✅ In-flight row + narrative, numbers matching the
   verdict exactly.
5. **`bun run check:*` green.** ✅ typecheck clean; **1024 pass / 0 fail**; `lisa validate` green.

## Test coverage / verification

No code added ⇒ no unit tests. Verification is the correct evidence-operation standard: the central
claim ("4 cleared forward records") is cross-checked against **three independent persisted sources**
that mutually agree —
- **the receipt** (`work/T-039-01/sweep-log.md`: `Cast 2, cleared 2`, `wallet exhausted`),
- **the ledger** (`.vend/runs.jsonl` 30–33 all `intervened:false`+`success`, no attestation, propose
  elapsed 93 s/83 s),
- **the validator** (`lisa validate` green: E-040/E-042 fully decomposed; E-041 removed cleanly).

The forward/attested split itself carries `walk-away.test.ts` from E-028; this settle is a *read* of
that instrument, re-run live and reconciled (8 forward + 13 attested = 21 carriers ⇒ 95%/21).

## Open concerns / flags for human attention

1. **Forward-E1 cadence is begun, not complete (the load-bearing honesty).** 4 cleared forward
   records / 2 cleared pulls is the **first** cleared installment, not the ≥10 bar. The verdict makes
   **no** "forward-confirmed" claim. To fully ungate: ≈+2 reports to the sample bar / ≈+3 more cleared
   `--no-intervened` pulls to ≥10 genuinely cleared. Don't let a future board read 8/10 as "almost
   confirmed" — 4 of the 8 are cleared; the other 4 are censored/intervened priors.
2. **Idempotent-mint guard for `propose-epic` (follow-up, not built).** The `vend doctor` clear
   double-minted (E-041 orphan, now deleted). Low severity (board hygiene), but it touches the trust
   contract — the board should reflect exactly what cleared. Worth a Frontier-1/steer-quality ticket.
3. **Steer ranker surfaces a self-referential #1 (recurring).** Both E-037 and E-039 had `vend steer`
   recommend "run the sweep" as the top pull. Re-pointed both times, but it's friction every sweep and
   a foot-gun for an unattended operator. The ranker should demote self-referential targets.

## Honest scope notes

- **E-040/E-042 internals unreviewed.** This settle confirms they're *grounded and decomposed* and
  cleared the play's gates + `lisa validate` — it did **not** review whether `vend init`/`vend doctor`
  are optimally specified. Epic quality is downstream of whoever pulls those tickets.
- **Comparability preserved.** E-039's budget was byte-identical to E-037; the only changed variable
  was E-038's headroom, so the 0-clear → 2-clear delta is attributable to the fix.
- **The deletion is the only state mutation beyond docs.** It is reversible (untracked file) and
  reference-free; `lisa validate` green is the receipt.

## Recommendation

**Accept.** The honest settlement landed: the loop graduated from *watched refusing* to *watched
clearing*, E-038 is proven live, the first cleared forward-E1 records are in the ledger, the board is
clean and crystallized, and the trust claim is unembellished — provisional + forward-leaning, not
forward-confirmed. The three open concerns are follow-ups (cadence accrual, idempotent-mint guard,
ranker demotion), none blocking.
