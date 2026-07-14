# T-026-01 — Progress (Implement)

Spike: verify the live E1 instrument. No source changed. Two live `vend run` smokes cast; write + read + no-pollution checks all passed. Raw evidence in `smoke-output.txt`.

## Steps executed

| Step | Action | Result |
|------|--------|--------|
| 0 | Preconditions | `.vend/*` gitignored (ledger append is local state; `smoke-output.txt` is the committed evidence). Board dirs clean of *new* files. |
| 1 | Wrote `verify-epic.md` (`id: verify-e1-instrument-readiness`) | created in work dir; not a board epic |
| 2 | Audit baseline | 23 runs · reported=13 · true=0 · walk-away 100% |
| 3 | Cast #1 `--intervened` `--budget 600000,1` | `budget-exhausted`, spent **86455/1**, 3 turns, `materialized: false` |
| 4 | Cast #2 `--no-intervened` `--budget 600000,1` | `budget-exhausted`, spent **85143/1**, 2 turns, `materialized: false` |
| 5 | Write check (`tail -2 … jq`) | PASS (see below) |
| 6 | Read check (`vend audit` delta) | PASS (+2 reported, +1 intervened) |
| 7 | No-pollution check (`git status` board dirs) | PASS (no new story/ticket/epic files) |

## Step 5 — write check (verbatim)

```
{"runId":"run-2026-06-20T05-36-56-358Z","epic":"verify-e1-instrument-readiness","outcome":"budget-exhausted","intervened":true,"attested":false}
{"runId":"run-2026-06-20T05-37-34-956Z","epic":"verify-e1-instrument-readiness","outcome":"budget-exhausted","intervened":false,"attested":false}
```

- `intervened:true` (cast #1) and `intervened:false` (cast #2) — both written; the **`false` is recorded as a value, not omitted** → the writer distinguishes clean walk-away from unknown. ✅
- `attested:false` on both → these are **live forward captures**, not the post-hoc `attest-intervention` back-fill. This is the exact gap the spike had to close (research §"Current ledger state": the live path had not been exercised with the flag). ✅
- `epic` stamped as the `verify-*` probe id → excludable from real E1 data by the established convention. ✅

## Step 6 — read check (verbatim)

Baseline → after:
- carriers (`"intervened"` key): **13 → 15** (+2) ✅
- `intervened:true`: **0 → 1** (+1) ✅
- `vend audit` after: `25 runs · walk-away rate 93% (14/15 ran untouched) · trend 100% → 88%` — both new records are in scope and the `true`/`false` split is counted correctly (the one `true` dropped the rate from 100% to 93%). ✅

## Step 7 — no-pollution check

`git status --porcelain docs/active/{stories,tickets,epic}` showed only `M docs/active/tickets/T-026-01.md` and `M docs/active/tickets/T-027-01.md` — both **pre-existing modifications of tracked files**, not cast output. The materialize effect writes **new** story/ticket files; `budget-exhausted` skipped it, so zero new files appeared. ✅ (Eliminates design risk R3.)

## Deviations from plan

- **None material.** The `budget-exhausted` outcome was deterministic exactly as designed (Option A): real generations of 86455 and 85143 tokens against a 1-token ceiling. The LLM call completed normally each time (`result (success)` in the stream) before the budget check classified it — confirming the *full* real-session path ran, not a truncated one.
- `vend audit` filters by **play**, not epic (as anticipated in design D3), so the read check used the full-ledger +2/+1 delta rather than an epic-scoped audit. The standalone `auditWalkAway` numbers in the `vend audit` output corroborate it.

## Cost

Two `decompose-epic` generations (~86k + ~85k tokens). Intrinsic to a real smoke (A4); bounded and one-time. No board churn, no committed-state churn (ledger gitignored).
