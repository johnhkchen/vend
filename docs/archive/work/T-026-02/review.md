# T-026-02 — Review: cast-forward-e1-sessions

**Verdict: instrument wired, count accrues — AC partially met, honestly flagged (not padded).** The genuine forward-E1 path (`vend work`) now records the `intervened` self-report, so the user's real walk-away sweeps accumulate genuine evidence. The ledger does **not yet** hold ≥10 genuine *success* carriers; per the AC's own clause it is **flagged as a bounded multi-sitting accrual rather than padded** with degenerate andons. This is the critical item for human attention below.

## The core finding (why this ticket isn't a simple 10-cast loop)

Producing "≥10 REAL casts against the live wallet, genuine behaviour" has no clean path with the pre-existing instrument:
1. **Board-safe `vend run` andons** are degenerate (1-token; the author never had a chance to walk away). Producing 10 to hit the count is **padding** — forbidden by the AC and T-026-01 review #2.
2. **Genuine `vend run` successes** each **materialise to the board** (no success without `decomposeEffect`) and need ~10 undecomposed epics that don't exist.
3. **`vend work`** — the genuine "fund-and-walk-away against the live wallet" gesture, which *does* run real successes — **did not thread the `intervened` bit**, so it produced zero E1 evidence.

T-026-01's readiness gate verified path (1) only and declared the instrument READY; it never checked the production path (3). **That is the real blocking flaw the gate missed**, and this ticket fixes it.

## What changed

### Modified (commit `4bd90d3` — feat)
- **`src/play/chain-propose-decompose.ts`** — `ChainProposeDecomposeOptions.intervened?: boolean`; threaded into both chain steps' `castPlay` opts. So every chain cast (propose + decompose) carries the bit.
- **`src/play/work.ts`** — `WorkOptions.intervened?: boolean`; conditionally forwarded into the `castProposeDecomposeChain` call. Session-level: one self-report stamps every cast in the sweep.
- **`src/cli.ts`** — `work` `ParsedCommand` variant + `parseWorkArgs` parse `--intervened`/`--no-intervened` (presence-flag pair, order-independent, spread only when given); work dispatch arm forwards it into `castWork`.
- **`src/cli.test.ts`** — 4 parser tests (true / false / absent / composes with `--budget`+`--board`+`--stale-ok`).

### Created (commit `ee410b0` — docs, all under `docs/active/work/T-026-02/`)
`research.md`, `design.md`, `structure.md`, `plan.md`, `progress.md`, `sweep-protocol.md`, `review.md` (this).

### Not touched
No engine logic (`src/engine/` untouched — the bit is pure pass-through data). No board files (`docs/active/{epic,stories,tickets}/`). No `.vend/runs.jsonl` writes in this sitting (no live sweep run).

## Test coverage

- **New:** 4 `parseWorkArgs` unit tests — the only new pure logic. Mirror the proven `run --intervened` block.
- **Threading:** `tsc --noEmit` proves the field flows `WorkOptions → ChainProposeDecomposeOptions → PlayStep.opts → CastOptions`. Pure pass-through, identical in shape to the suite-covered `model`/`project` paths and the live-proven `run --intervened` path.
- **Bit-lands-regardless-of-outcome:** already proven empirically by T-026-01 on `castPlay`; the chain reuses the same `castPlay`, so no new live proof was needed for the wire itself.
- **Gate:** `bun run check` → **843 pass / 0 fail**, typecheck + baml:gen clean.
- **Gap (intentional):** no automated test that a *live `vend work` sweep* writes the bit end-to-end — that is an SDK-spawning, board-mutating, paid operation, deferred to real use exactly as `castProposeDecomposeChain`'s other live behaviour is (it is not unit-tested by house pattern; proven by sweep).

## Open concerns / handoff

1. **CRITICAL — the ≥10 count is not yet in the ledger.** Only 2 genuine forward carriers exist (T-026-01's andon probes). The instrument now captures genuine `vend work` evidence; the human must run real `--no-intervened`/`--intervened` sweeps to accrue ≥10 (see `sweep-protocol.md`: ~4 cleared signals ⇒ +8 ⇒ ≥10, reachable in one to a few sittings). **E-014's verdict should not be read until that accrues** — reading it now would be reading the 2 andon probes, which is exactly the thin/synthetic sample the sprint exists to avoid.
2. **Two carriers per cleared signal.** One self-report stamps both the propose and decompose records of a chain. Honest (both are genuine observations) but means "≥10 sessions" = ≥10 carrier records, not 10 invocations. Documented in design + protocol.
3. **Board output from genuine sweeps is real work, not pollution** — a `vend work` success mints a real epic+decomposition (as it minted E-026). Review it as autonomous output (IA-5). This is the deliberate difference from the rejected throwaway-epic approach.
4. **Scope note.** This evidence ticket landed a small code change (the `vend work` wiring) because the genuine evidence the AC describes was otherwise unreachable. It is the minimal unblock; an alternative `vend run --dry` non-materialising success mode (design Option 4) remains a possible follow-up if sweep accrual proves too slow.
5. **Default is unknown, not walk-away.** An unreported `vend work` sweep leaves `intervened` absent — the audit shows "no self-reports yet" rather than a fabricated rate. The self-report is opt-in by design.

## Recommended follow-ups
- A short-lived ticket: run the accrual sweeps and confirm `vend audit` reads ≥10 genuine carriers with a mixed rate + trend (the literal AC, satisfied by real use).
- Optional: `vend run --dry` (non-materialising genuine-success probe mode) if board-mutating sweeps are undesirable for measurement.
