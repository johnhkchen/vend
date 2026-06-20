# T-026-02 — Plan: ordered, verifiable steps

Each step is committable and independently checkable. Testing strategy: pure parser unit tests for the new flag; `tsc` proves the pass-through threads end-to-end; live capture is deferred to real sweeps (the `castPlay`-logs-the-bit fact is already proven by T-026-01).

## Step 1 — Carry the bit into the chain
**File:** `src/play/chain-propose-decompose.ts`
- Add `intervened?: boolean` to `ChainProposeDecomposeOptions` (doc'd as session-level pass-through).
- Add `intervened: opts.intervened` to the propose step's `opts` and the decompose step's `opts`.
**Verify:** `bun run check:typecheck` clean (the field is optional; `CastOptions.intervened` already accepts it).

## Step 2 — Forward from `vend work`
**File:** `src/play/work.ts`
- Add `intervened?: boolean` to `WorkOptions`.
- In the `castProposeDecomposeChain({...})` call inside `spendDown.castOne`, conditionally spread `...(opts.intervened !== undefined ? { intervened: opts.intervened } : {})`.
**Verify:** typecheck clean; the spread mirrors the adjacent `opts.model` spread.

## Step 3 — Parse + dispatch the flag
**File:** `src/cli.ts`
- Extend the `work` `ParsedCommand` variant with `intervened?: boolean`.
- In `parseWorkArgs`: declare `let intervened: boolean | undefined;`, add `--intervened`/`--no-intervened` arms inside the flag loop (before the unknown-flag `else`), extend the return with the conditional spread.
- In the work dispatch arm, forward `...(parsed.intervened !== undefined ? { intervened: parsed.intervened } : {})` into `castWork`.
**Verify:** typecheck clean; `vend work --intervened` no longer errors as an unexpected argument.

## Step 4 — Parser unit tests
**File:** `src/cli.test.ts`
- In the `work` describe block, add tests mirroring the `run --intervened` block:
  - `--intervened` → `{ cmd:"work", intervened:true }`
  - `--no-intervened` → `{ cmd:"work", intervened:false }`
  - neither → no `intervened` key
  - composes with `--budget` / `--board` / `--stale-ok`
**Verify:** `bun test src/cli.test.ts` green.

## Step 5 — Full gate
- `bun run check` (baml:gen + typecheck + full `bun test`) green. Confirms no regression across the 830+ suite.
**Commit (atomic):** `feat(work): thread E1 intervened self-report through vend work (T-026-02)` — Steps 1–4.

## Step 6 — Evidence artifacts + accumulation flag
**Files:** `docs/active/work/T-026-02/{progress.md, sweep-protocol.md}`
- `sweep-protocol.md`: the bounded multi-sitting background sweep protocol — how the user reaches ≥10 genuine carriers by running real `vend work --no-intervened` (and occasional `--intervened`) sweeps, each cleared signal contributing 2 bit-carrying records, read back with `vend audit`. Flag (per the AC) that the count accrues from real product use rather than being padded with degenerate andons.
- Record the genuine seed already in the ledger (T-026-01's 2 forward records) and the path from 2 → ≥10.
**Commit:** `docs(T-026-02): forward-E1 sweep protocol + genuine-seed accounting`.

## Step 7 — Review
**File:** `docs/active/work/T-026-02/review.md`
- Summarise changes, coverage, and the critical open concern: the ledger does **not yet** hold ≥10 genuine **success** carriers; the instrument is now wired so they accrue from real `vend work` use. State plainly (no padding) — this is the honest handoff for E-014's verdict.

## Testing strategy summary

| Surface | Test | Why |
|---|---|---|
| `parseWorkArgs` flag parsing | unit (cli.test.ts) | the only new pure logic |
| `WorkOptions → chain → castPlay` threading | `tsc` + inspection | pure pass-through, identical to proven `model`/`project`/`run-intervened` paths |
| bit lands in ledger regardless of outcome | already proven (T-026-01, `castPlay`) | the chain reuses the same `castPlay` |
| ≥10 genuine carriers | accrues from real sweeps; flagged | latency/cost ⇒ multi-sitting; AC: flag don't pad |

## What this plan deliberately does NOT do

- It does **not** cast 8+ board-safe 1-token andons to hit a count (padding — forbidden by the AC and T-026-01 #2).
- It does **not** mint+curate 10 throwaway epics (expensive theatre; not genuine behaviour).
- It does **not** run a forced live `vend work` sweep in this sitting (board-mutating + ~$5–7 + stale-board friction → needs human assent per IA-5). The wiring + protocol make the genuine accrual possible; the human runs the sweeps.

## Risks & mitigations

- **R1 — "AC count unmet in this sitting."** True and intended: flagged, not faked. The instrument now captures genuine evidence; the count is a function of real use, which the AC explicitly allows to be a flagged multi-sitting sweep. Mitigation: explicit accounting in review.md so the human/Lisa sees the honest state.
- **R2 — double-counting per chain (2 carriers/signal).** Documented in design; both records are genuine observations, so it does not distort the rate, only the carrier count's relationship to invocations. Mitigation: note it in sweep-protocol.md.
- **R3 — scope creep (wiring code in an evidence ticket).** Justified: the genuine evidence the AC describes is unreachable without it; it is the minimal unblock and corrects the gap T-026-01 missed.
