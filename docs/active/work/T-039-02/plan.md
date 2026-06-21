# T-039-02 — Plan (ordered steps + verification)

Each step is independently verifiable. No source code, so "testing strategy" = cross-checking the
evidence read against three persisted sources (receipt / ledger / validator) — the correct standard
for an evidence operation (per T-039-01's review). Gates already green this session.

## Step 1 — Confirm the forward read (the audit) ✅ done

- **Do:** `bun run src/cli.ts audit`; read directly from `.vend/runs.jsonl` (records 28–33).
- **Captured:** forward (live) **88% (7/8 untouched)**; records **30–33 = `intervened:false`+
  `success` = 4 cleared** (first ever); record 28 = censored prior (`timed-out`); combined 95% (20/21)
  pools 13 attested.
- **Verify:** numbers tie out — 8 forward + 13 attested = 21 carriers; 20 untouched ⇒ 95%/21. ✓
- **Falsification:** if any of 30–33 carried `intervenedAttested` or a non-`success` outcome, the
  "4 cleared forward" claim would be wrong. Checked: all four are `intervened:false`, no attestation,
  `outcome:success`. ✓

## Step 2 — Adjudicate the E-041 orphan (delete + revalidate)

- **Pre-check:** `grep -rl E-041 docs/active/stories docs/active/tickets` → **NONE** (confirmed in
  Research). Childless, dup of E-042 title, not in ledger.
- **Do:** delete `docs/active/epic/E-041.md`.
- **Verify:** `lisa validate` → must stay **green** (childless epic removal can't break the DAG; the
  green is the receipt that the board reflects exactly what cleared).
- **Record:** note in `progress.md` + Read 2 of `verdict.md`. Flag the idempotent-mint guard as a
  follow-up (not built here).
- **Safety:** if `lisa validate` were to go red (unexpected), restore the file and report instead.

## Step 3 — Write `verdict.md` (the deliverable, AC #3)

- **Do:** the five-section blueprint from `structure.md`. Title states the call. Lead with two
  separated claims (clearing earned / not confirmed held).
- **Verify against AC #1–#3:**
  - cleared-vs-censored stated, first cleared record distinguished, **forward-only** numbers. ✓
  - clear-quality (sound/grounded) + **propose FINISHED** + **P7 held** + **auth==exec held**. ✓
  - watched **clearing**, forward cleared count, **provisional + named cadence to ≥10**, no over-claim. ✓
- **Self-falsification pass:** grep the draft for any place the combined 95%/21 (or "20/21") is used
  as the forward number → must appear **only** in the exclusion sentence. Confirm no
  "forward-confirmed" claim exists.

## Step 4 — Crystallize `demand.md` Frontier 1 (AC #4)

- **Do:** update two regions:
  - **In flight** row (line ~88): E-039 re-sweep → **settled** (cleared 2; first cleared forward
    records; moved off "may still 0-clear").
  - **Frontier 1** narrative (lines ~94–115): re-sweep **done**; watched **CLEARING**; forward
    **4/10 (all censored) → 8/10 (4 cleared)**; E-038 proven live (propose finished past the wall);
    the *old* named blocker (propose time-censor) **cleared**; cadence to ≥10 restated; cites add
    `work/T-039-01/sweep-log.md` + `work/T-039-02/verdict.md`.
- **Verify:** the board's forward numbers **match** `verdict.md` exactly (single source of truth); no
  combined-pool figure presented as forward. The keystone framing stays *provisional*, not graduated.

## Step 5 — Gates green (AC #5)

- **Do:** `bun run check:typecheck` and `bun test` (or `bun run check`). No `src/` touched ⇒ expected
  green (baseline this session: typecheck clean, 1020 pass / 0 fail).
- **Verify:** 0 failures. If anything red, it is unrelated to this doc-only ticket — investigate and
  report; do not paper over.

## Step 6 — Review (`review.md`)

- **Do:** the handoff. What changed (3 docs + 1 deletion), the verification done, open concerns
  (idempotent-mint guard; ranker self-referential #1; cadence not complete), scope honesty.
- **Verify against AC:** every AC box has a cited evidence line.

## Testing strategy summary

| Claim | Verified by |
|---|---|
| 4 cleared forward records | ledger records 30–33 read directly (`intervened:false`+`success`+no attest) |
| forward 88% (7/8), combined 95% (21) excluded | `vend audit` output, reconciled 8+13=21 |
| E-040/E-042 sound, validate green | `lisa validate` (T-039-01) + epic frontmatter inspected |
| propose FINISHED (E-038 live) | ledger elapsed 93 s/83 s > 72,785 ms env; receipt no `timed-out` |
| E-041 deletion safe | grep no inbound refs; `lisa validate` green post-delete |
| gates green | `bun run check:typecheck` + `bun test` |
