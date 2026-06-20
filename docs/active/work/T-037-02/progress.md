# T-037-02 — Progress

## Status: complete (honest 0-clear)

Operation ticket — no source change. The live, metered sweep was **operator-authorized and run
twice**; it reached a **clean P7 stop** both times with **cleared 0** (a reproducible
`andon: timed-out` at the `propose-epic` per-step time envelope). The deliverable `sweep-log.md`
captures the verbatim evidence. Below: each plan step's outcome and the deviations.

## Steps

- [x] **Step 0 — Planning artifacts.** `research.md`, `design.md`, `structure.md`, `plan.md` written
  (free, unconditional).

- [x] **Step 1 — Operator authorization.** Surfaced the bounded-spend go/no-go at the Implement
  boundary (the counter gesture, P2/P7); operator chose **"Cast the live sweep now"** with the
  recommended `--budget 3600000,1000000`.

- [x] **Step 2 — Stage a fresh board (live cast).** `bun run src/cli.ts steer` → staged
  `docs/active/pm/staged/steer.md` (`materialized: true`), **9** ranked `vend chain "…"` signals,
  mtime 16:02:44 > newest live 15:51:24 ⇒ **clears the E-027 gate**. Ledger 25 → 26 (`steer success`).

- [x] **Step 3 — Run the metered sweep (×2).** `bun run src/cli.ts work --no-intervened --budget
  3600000,1000000`. **Run #1:** Cast 1, cleared 0, `andon 'timed-out'`, wallet `3527208 ms left`
  (~72.8 s, **0 tokens debited**). **Run #2 (retry):** identical — `andon 'timed-out'`,
  `3527195 ms left`. Both verbatim in `sweep-log.md`. Clean P7 stop; **nothing partial**.

- [x] **Step 4 — Verify + auth==exec.** `lisa validate` → "All checks passed. 94 tickets, 1 ready,
  DAG valid." (repo/board green; **0 ids minted** ⇒ no minted-id validation applies). auth==exec
  confirmed: ~72.8 s spent = the `propose-epic` 72,785 ms envelope — the cast ran under exactly its
  authorized time budget and censored on it (**not** the E-024 150k-price no-op). `tsc --noEmit` clean.

- [x] **Step 5 — Ledger delta.** `.vend/runs.jsonl` 25 → **28** (+3): record 26 `steer success`;
  records 27 & 28 `propose-epic timed-out`, **`intervened:false`, unattested** ⇒ forward (live) but
  **censored**. AC "forward-E1 records appended `intervened:false`" satisfied (2); no over-claim
  (censored, not cleared; nowhere near the ≥10 bar — T-037-03).

- [x] **Step 6 — Wrote `sweep-log.md`** — the deliverable, verbatim, honest on the 0-clear + its
  exact reason (per-step time censoring) + the AC scorecard.

- [x] **Step 7 — Clean up + close out.** Removed transient captures (`_sweep-raw.txt`,
  `_sweep-raw-2.txt`, `_steer-raw.txt`); work dir carries only the artifacts. `git status` shows no
  partial mint (only Lisa's frontmatter advances on T-037-01/02). This `progress.md` + `review.md`.

## Deviations from plan

- **Headline AC not met (cleared 0).** The plan anticipated ~2 chains cleared (T-037-01 GO); the live
  reality was a **per-step time-andon** on the first cast. This is an *anticipated honest outcome*
  (Design's outcome matrix; T-037-01 R3/caveat #2), recorded truthfully — not a hidden failure. The
  GO was about **price** (E-025 auth==exec), which held; it never promised no time-censoring.
- **One retry (Step 3 run #2), not in the original single-run plan.** Justified: run #1 debited ~0
  tokens (cheap), and a staging `rate_limit_event` raised a transient-slowdown hypothesis. The retry
  **reproduced** the andon identically, converting a one-off into a robust finding. Stopped at 2 —
  further retries cannot change a structural per-step-budget limit.
- **No new automated test** (operation ticket; a live-executor test would spend real money per CI
  run). Flagged in `review.md`.

## Artifacts produced

`research.md`, `design.md`, `structure.md`, `plan.md`, **`sweep-log.md` (the deliverable)**,
`progress.md`, `review.md`. No `src/` change; no ticket frontmatter edited (Lisa owns transitions).

## Side effects of the authorized run (real, intended)

- Staged board `docs/active/pm/staged/steer.md` (fresh, 9 signals).
- `.vend/runs.jsonl` +3 records (1 steer success, 2 forward-censored propose-epic).
- **No epics/tickets minted** (the andon fired before materialization) — board content unchanged.
- Real token spend: the **steer** cast (materialized) + un-debited pre-timeout API usage of the 2
  propose attempts. The wallet itself barely moved (~0 tokens, ~73 s ×2) — well under the 1 M bound.

## Handoff to T-037-03

The live proof of a **cleared** pull is **still pending** — blocked not on price but on `propose-epic`
**per-step time censoring** (72,785 ms p90 too tight for the current cast / the self-referential top
signal). Forward sample moved +2 (censored). T-037-03 should settle the verdict honestly on this
result and likely **depends on a recalibration/per-step-time fix** before the cleared-pull proof can
land. See `review.md` for the concrete follow-up.
