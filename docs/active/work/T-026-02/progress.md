# T-026-02 — Progress

## Completed

### Steps 1–4 — `intervened` wired through `vend work` (commit `4bd90d3`)
- **`src/play/chain-propose-decompose.ts`** — `ChainProposeDecomposeOptions.intervened?: boolean`; threaded into BOTH chain steps' `castPlay` opts (propose + decompose).
- **`src/play/work.ts`** — `WorkOptions.intervened?: boolean`; conditionally spread into the `castProposeDecomposeChain` call inside `spendDown.castOne`.
- **`src/cli.ts`** — `work` `ParsedCommand` variant gains `intervened?`; `parseWorkArgs` parses `--intervened`/`--no-intervened` (presence-flag pair, order-independent); work dispatch arm forwards `parsed.intervened` into `castWork`.
- **`src/cli.test.ts`** — 4 new parser tests (true / false / absent / composes with budget+board+stale-ok), mirroring the `run --intervened` block.

### Step 5 — Full gate (Step 5)
`bun run check` → **843 pass, 0 fail**, `tsc --noEmit` clean, baml:gen clean. No regression across the suite (+4 tests vs the prior 839 baseline implied by the new cases).

## Verified threading

`vend work --no-intervened` → `parseWorkArgs` `{cmd:"work",intervened:false}` → work arm → `castWork({intervened:false})` → `castProposeDecomposeChain({intervened:false})` → both `PlayStep.opts` `{intervened:false}` → `castPlay` → `appendRunLog` writes `intervened:false` on each record. Shape-identical to the live-proven `vend run --no-intervened` path (T-026-01); `castPlay` logs the bit independent of outcome, already proven empirically.

## Genuine-seed ledger state

`.vend/runs.jsonl` (25 lines) holds **2 genuine live forward carriers** so far — T-026-01's probes (`verify-e1-instrument-readiness`, `intervened:true`/`false`, `budget-exhausted`, no attestation marker). The remaining 13 carriers are the post-hoc attestation back-fill (excluded from the forward set by their `intervenedAttestation` marker). The recent genuine `vend work` successes (E-026) carry no bit — they predate this wiring.

**Path to ≥10:** with the wiring landed, each future cleared `vend work` signal contributes 2 genuine bit-carrying records. See `sweep-protocol.md`.

## Deviations from plan

- **Live sweep deferred (Step 6 risk R1, as planned).** No forced `vend work` sweep was run in this autonomous sitting: it is board-mutating (mints a real epic+decomposition), costs ~$0.5–0.7/cleared signal, and the staged board is currently stale (E-027 gate would refuse without `--stale-ok`). Per IA-5 a board-mutating spend wants human assent, and per the AC the genuine accrual is a **flagged bounded multi-sitting background sweep — not a padded sample**. The wiring + protocol make the genuine accrual possible; the human runs the sweeps.
- No live `vend run` andon padding (Option 1) and no throwaway-epic curation (Option 2) — both rejected in Design.

## Remaining

- Step 6 docs commit (this file + `sweep-protocol.md`).
- Step 7 `review.md` (honest handoff: count not yet ≥10; instrument now captures it).
