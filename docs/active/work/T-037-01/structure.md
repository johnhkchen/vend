# T-037-01 — Structure

## Shape of the work

This is an **analysis ticket**: the only durable artifact is `preflight.md`. There are **no source
changes** — the four claims are proven against code that already exists and is already tested. The
"structure" here is therefore (a) the artifact's structure and (b) the exact set of code symbols the
verification touches (read-only), so a reviewer can re-derive every number.

## Files

### Created
- `docs/active/work/T-037-01/preflight.md` — the deliverable: predicted price, bounded budget +
  chains-afforded, forward-E1 thread confirmation, freshness check, go/no-go. (Plus the standard
  RDSPI artifacts: research/design/structure/plan/progress/review.)

### Modified
- **None.** No `src/` change. No ticket frontmatter change (Lisa advances phases from artifacts).

### Deleted
- **None.**

### Transient (not committed)
- A throwaway verification harness (`_preflight_price.ts` at repo root) that imports only the PURE
  modules to print the price/affordability/audit numbers. Created, run, and **removed** in the same
  step — it must not linger (it would trip `check:committed` / pollute the tree). Its output is
  pasted into `preflight.md` verbatim.

## Code symbols the verification reads (read-only, addon-free)

| Symbol | File | Role in the proof |
|--------|------|-------------------|
| `loadRunLog` | `src/log/run-log.ts:537` | reads the live `.vend/runs.jsonl` |
| `totalTokens` / `wallClockMs` | `src/log/run-log.ts:509 / 497` | per-record token & duration |
| `recalibrate` | `src/ledger/recalibrate.ts:124` | per-play p90 envelope from history |
| `TIER_PERCENTILE` / `COLD_START_MIN_SUCCESSES` / `DEFAULT_WINDOW` | `recalibrate.ts:39/48/53` | the bounding constants |
| `budgetForTier` | `src/shelf/gather.ts:135` | the `standard` hand prior |
| `sumBudgets` (logic) | `src/play/work.ts:91` | per-denomination chain price |
| `allocate` / `canAfford` | `src/budget/wallet.ts:100 / 113` | wallet funding + affordability |
| `fitNext` / `shouldContinue` | `src/engine/spend-core.ts:93 / 116` | the P7 authorization + stops |
| `auditWalkAway` | `src/ledger/walk-away.ts:160` | forward vs attested split |
| `isBoardStale` | `src/play/work-core.ts:105` | the freshness decision |

## The forward-E1 thread (the structural chain to assert, no code change)

```
cli.ts:412 (--no-intervened ⇒ false)
  → cli.ts:435 (ParsedCommand.work.intervened)
  → cli.ts:642 (castWork spread)
  → work.ts:61 / work.ts:200 (WorkOptions → chain spread)
  → chain-propose-decompose.ts:98 & :120 (both steps' opts.intervened)
  → run-log record `intervened: false` (×2 per chain)
  → run-log.ts:391/401-403 (reviveRecord keeps false; no attestation ⇒ forward)
  → walk-away.ts:206 (forward sub-stat)
```

Every edge already exists and is exercised by `walk-away.test.ts` (the forward/attested split) and
`chain-propose-decompose-core.test.ts` (the per-step budget rung that makes auth==exec true). The
preflight asserts the chain holds; it adds nothing.

## `preflight.md` internal structure (~target sections)

1. **Header / scope** — free + deterministic, no live model; ledger snapshot date.
2. **Claim 1 — predicted price** — the two envelopes (value + source + confidence), the sum, the
   human-scale readout; the raw harness output pasted.
3. **Claim 2 — bounded budget affordability** — the recommended `--budget 3600000,1000000`, chains
   afforded (token-bound vs time-bound), the spend-down framing.
4. **Claim 3 — forward-E1 thread** — the end-to-end edge list, the read-back classification, the
   live forward 1/2 reading, the two-records-per-chain note.
5. **Claim 4 — freshness gate** — `isBoardStale` semantics, run-time mtime ordering, the unit-test
   pointers.
6. **auth==exec** — why the E-024 no-op cannot recur (E-025 per-step threading).
7. **GO / NO-GO** — verdict + the ≥2-signal staging precondition + honest caveats.
8. **Verification log** — exact harness + `check:*` results.

## Ordering

1. Run the pure harness over the live ledger → capture numbers (done in Research/Implement).
2. Write `preflight.md` from those numbers.
3. Run `bun run check:typecheck` + `bun test` (the deterministic gate) → record green.
4. Remove the transient harness; confirm the tree carries only the artifacts.

## Boundaries respected

- **No executor seam touched** — only pure modules imported by the harness (purity discipline).
- **No frontmatter edits** — Lisa owns phase/status transitions.
- **No board staged, no spend** — those are T-037-02.
- **No new test** — the seams are pre-covered; adding one would be scope creep for an analysis
  ticket (noted as a non-gap in Review).
