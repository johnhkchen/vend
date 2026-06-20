# T-037-03 — Progress

All steps complete. Free + deterministic (read the ledger the sweep wrote; no live cast, no source
change). The deterministic gate is green.

## Steps

- [x] **Step 0 — Inputs confirmed.** `sweep-log.md` (honest 0-clear), `walk-away.ts:160`
      (`auditWalkAway` + E-028 split, confirmed via codebase-memory `search_code`),
      `T-026-04/verdict.md` (the over-count standard), `demand.md` Frontier 1.
- [x] **Step 1 — `vend audit` re-run.** forward (live) **3/4 (75%)** — was 1/2; sample **2/10 →
      4/10**; **+2** forward records (#27, #28), both **censored** (`timed-out`), **0 cleared**.
- [x] **Step 2 — Ledger classification verified.** `tail -6 .vend/runs.jsonl`: #27/#28 =
      `propose-epic timed-out intervened=false attested=undefined` ⇒ forward, untouched, censored.
- [x] **Step 3 — `verdict.md` written.** Five-part honest verdict. Citation grep clean: every
      `16/17`/`94%`/`14/15`/`forward-confirmed` hit is a **negation or the quarantined exclusion**,
      never a forward claim.
- [x] **Step 4 — `demand.md` Frontier 1 updated.** In-flight row + signal bullet: keystone
      **watched** (P4/P7 live), forward **1/2 → 3/4 (2/10 → 4/10)** on censored evidence, remaining =
      clear the `propose-epic` time-censor then accrue to ≥10. `lisa validate` green (94 tickets,
      DAG valid).
- [x] **Step 5 — Deterministic gate green.** `bun run check` → **998 pass, 0 fail**, `tsc --noEmit`
      clean, `baml:gen` clean.

## Deviation from authoring (documented, absorbed in Structure)

The ticket was authored **expecting a clearance** (it asks for "genuine forward records the sweep
added (each chain that cleared = one)" and a quality read of "the autonomously-minted epic+tickets").
**The sweep was an honest 0-clear** (twin `andon: timed-out`, nothing minted). The artifacts settle
that reality:

- The forward count **moved** (1/2 → 3/4) — but on **censored** records, so the verdict states the
  delta *and* refuses to read it as cleared-pull evidence.
- **No minted card exists to assess** — the quality read honestly reframes to the integrity of the
  *watched machinery* (P7 + auth==exec held), with clear-quality marked **undemonstrated**.
- This makes the "no over-claim" non-goal **more** load-bearing, not less — handled by the citation
  grep gate and the T-026-04 standard quoted in `verdict.md`.

No deviation in deliverables: all four acceptance criteria are satisfiable against the honest
0-clear, and are.

## Acceptance criteria

- [x] `vend audit` re-run; new forward (live) rate recorded with delta, **forward-only** (never the
      combined 16/17).
- [x] Honest quality read (no card to assess → undemonstrated) + **P7 held** + **auth==exec held**.
- [x] `verdict.md`: gesture **watched**, forward-E1 **1/2 → 3/4 (4/10)**, go **provisional + named
      cadence to ≥10**, **no "forward-confirmed" over-claim**.
- [x] `demand.md` Frontier 1 updated honestly (watched + evidence moved + what remains).
- [x] `bun run check` green (998 pass).
