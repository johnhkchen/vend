# T-037-02 — Structure

## Shape of the work

An **operation ticket**, not a code change. The durable artifact is `sweep-log.md` (the watched
run's verbatim evidence); the run also *produces side effects by design* — a staged board, minted
epics+tickets, and appended ledger records. The "structure" is therefore (a) the set of files the run
*reads* (read-only, the seam map a reviewer re-derives the result from), (b) the files the run
*writes* (the intended, authorized mutations — not source edits), and (c) the artifact's internal
shape. **No `src/` is created, modified, or deleted.**

## Files

### Created (artifacts — always)
- `docs/active/work/T-037-02/research.md` · `design.md` · `structure.md` · `plan.md` —
  the planning artifacts (free, produced unconditionally).
- `docs/active/work/T-037-02/sweep-log.md` — **the deliverable**: the verbatim production-line steps,
  the receipt, the cleared id(s), and the ledger delta. (On a withheld spend: records the
  prepared-not-cast outcome + the exact staged command.)
- `docs/active/work/T-037-02/progress.md` · `review.md` — RDSPI close-out.

### Created/modified BY THE RUN (authorized side effects, not source edits — only on a go)
- `docs/active/pm/staged/steer.md` — staged fresh by `vend steer` (the live board).
- `docs/active/epics/E-0XX-*.md`, `docs/active/stories/S-0XX-*.md`,
  `docs/active/tickets/T-0XX-*.md` — the **real minted pulls** (the cleared work). Their concrete ids
  are unknown until the cast runs; recorded verbatim in `sweep-log.md`.
- `.vend/runs.jsonl` — **appended** with `2N` forward records (`intervened:false`), `N` = chains
  cleared. Append-only; existing 25 records untouched.
- `docs/active/pm/demand.md` and similar board surfaces may be touched by the minting play if it
  updates the in-flight board (recorded if so).

### Modified / Deleted (source)
- **None.** No `src/` change. No test change. No ticket-frontmatter edit (Lisa owns transitions).

## Code symbols the run drives (read-only seam map)

| Symbol | File | Role in the run |
|--------|------|-----------------|
| `castSteer` / `steerProjectPlay` | `src/play/steer.ts` | stages the fresh board (a live cast) |
| `castWork` | `src/play/work.ts:147` | the gesture spine: gate → fund → price → spend → settle |
| `readBoard` / `parseBoardSignals` | `work.ts` / `work-core.ts:65` | board → ranked candidate signals |
| `newestActiveMtimeMs` / `isBoardStale` | `work.ts` / `work-core.ts:105` | the E-027 freshness gate |
| `loadRunLog` / `recalibrate` / `sumBudgets` | `log/run-log.ts` / `ledger/recalibrate.ts` / `work.ts:91` | live price (auth==exec) |
| `allocate` / `canAfford` / `debit` | `src/budget/wallet.ts` | fund → P7 authorize → debit actuals |
| `spendDown` / `fitNext` / `shouldContinue` | `src/engine/spend.ts` / `spend-core.ts` | the walk-away loop + clean stops |
| `castProposeDecomposeChain` | `src/play/chain-propose-decompose.ts:81` | the real propose→decompose cast (per signal) |
| `formatStepSignal` / `renderReceipt` | `work-core.ts:91 / 151` | the IA-7 production line + the IA-6 receipt |
| `auditWalkAway` | `src/ledger/walk-away.ts:160` | the forward vs attested split the new records feed |

The `--no-intervened` thread (`cli.ts:412 → 435 → 642 → work.ts:200 → chain-propose-decompose.ts:98 &
120 → run-log record intervened:false ×2/chain`) carries each cleared record into the forward pool.

## `sweep-log.md` internal structure (~target sections)

1. **Header / scope** — live + metered; the operator-authorized budget; run timestamp; environment
   (claude CLI version). State plainly that real tokens were spent and real ids minted.
2. **Stage** — the `vend steer` invocation + its result (board path, the ranked `vend chain "…"`
   lines, the count — ≥2 confirmed); freshness confirmation (board newer than live).
3. **Run** — the exact `vend work --no-intervened --budget 3600000,1000000` command, then the
   **verbatim** `onStep` production line (▶ casting / ✓ done with the live wallet meter per step).
4. **Receipt** — the verbatim `renderReceipt` block: `Cast N, cleared M`, per-cast cost, final
   `wallet:` (funded vs remaining, both denominations), the `stopped:` reason.
5. **Cleared pulls** — the real epic id(s) + tickets minted, and the `lisa validate` output proving
   them green.
6. **Ledger delta** — the `2N` new `.vend/runs.jsonl` records (the appended `intervened:false`
   lines), and a before/after record count (25 → 25+2N).
7. **auth==exec attestation** — that each cast ran under the authorized p90 envelope (no E-024 no-op).
8. **Honest outcome** — the clean P7 stop reason; any per-cast andon recorded truthfully; no
   over-claim on the forward bar (T-037-03 owns the ≥10 cadence).

## Ordering (where it matters)

1. Produce R/D/S/P (free) — done before any spend.
2. **Operator go/no-go on the bounded spend** (the authorization gate).
3. On go: stage fresh (`vend steer`) → confirm ≥2 signals + freshness → run the metered sweep with
   full capture → write `sweep-log.md` from the verbatim output → `lisa validate` on minted ids →
   read back `.vend/runs.jsonl` delta.
4. Write `progress.md` (run outcome + deviations) and `review.md` (handoff + open concerns).

## Boundaries respected

- **No source edit, no test edit, no frontmatter edit** — Lisa owns phase/status; the run only
  produces the *authorized* side effects (board, minted ids, ledger append).
- **No fabrication** — every line in `sweep-log.md` is real terminal output or an honest
  not-cast record; the AC's "paste the actual terminal output, not a paraphrase" is binding.
- **The spend is operator-authorized** — the run is not performed without the counter go (P2/P7).
- **No over-claim** — moving the forward count is not meeting the ≥10 bar (deferred to T-037-03).
