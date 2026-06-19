# T-014-03 — Research

The synthesis ticket (PRD KR4): consume the E1 (trust) and E2 (consistency) instruments
built by T-014-01 / T-014-02 and produce a one-page **findings note** that returns the
epic's go / reroute decision. This phase maps what exists — the instruments, the ledger,
the decision framework, and the bridge — without proposing the note's content yet.

## What this ticket is (and is not)

- **Is:** a synthesis + decision artifact. The deliverable is prose
  (`docs/active/work/T-014-03/findings.md`), not code. It reads two numbers off the
  T-014-01/02 instruments and applies the PRD §8 / discovery-foundation decision rule.
- **Is not:** a feature. Per the PRD, "the product is two numbers and a decision." No new
  module, no schema change. `depends_on: [T-014-01, T-014-02]` — both are committed
  (`2ab4e2b`, T-014-02 review at `1e1767f`).

## The two instruments (the inputs)

### E1 — trust (T-014-01) — `src/ledger/walk-away.ts` + `vend audit`
- `auditWalkAway(records, opts)` — PURE; returns a `WalkAwayReport`: `andonRate` vs
  `andonBudget` (IA-12 tier setpoint), `outcomeMix` (success / censored / gate-failed /
  id-collision), `cost` (median actual/allocated vs envelope), and `intervention`
  (`reported`, `intervened`, `rate`, `trend.earlier→recent`).
- `formatWalkAwayFindings(report)` — the E1 fragment the note quotes verbatim.
- The `intervened?: boolean` bit is written via `vend run --intervened` / `--no-intervened`
  (threaded run-log → cast → decompose-epic). **Forward-looking:** only runs cast *after*
  T-014-01 can carry it.
- Surface: `vend audit [<play>] [--tier <t>] [--window <n>]` (cli.ts:411), read-only.

### E2 — consistency (T-014-02) — `src/probe/variance.ts` + `run-probe.ts`
- `varianceReduction(gated, ungated)` — PURE; returns `VarianceReport`: `reduction`
  = (ungated − gated)/ungated dispersion, plus `gated`/`ungated` `SetDispersion` and
  `censoredGated`/`censoredUngated` counts. Metric is line-set Jaccard distance.
- `formatVarianceReport(r)` — one honest line; caveats a censoring-inflated reduction or a
  too-small gated arm.
- `run-probe.ts` — IMPURE 5×2 sweep harness (`bun run src/probe/run-probe.ts <epic.md>`);
  casts decompose-epic 5× gated + 5× ungated on a fixed epic into a disposable temp root
  (no ledger/board pollution), diffs the materialized output, prints the single number.
  Spawns `claude` live — **not** run in CI; the human sweep step.
- `--no-gates` run mode guards the lone gate call in `castPlay` (`cast.ts`).

## The actual data state (go-and-see — ran the instruments)

`vend audit` (all plays, 2026-06-19):
```
E1 — walk-away trust · all plays · 10 runs [standard]
  walk-away rate: no self-reports yet (10 runs, intervention bit unrecorded)
  andon rate: 40% vs 10% budget — ⚠ over (gates working, not defects)
  outcome mix: 6 success · 3 censored (budget/timeout) · 1 gate-failed · 0 id-collision
  cost vs envelope: no envelope data
```
`vend audit decompose-epic`: 6 runs, andon 50% vs 10%, 3 success / 2 censored / 1 gate-failed.

**The decisive fact for this ticket:** `.vend/runs.jsonl` has **10 records, none carrying
`intervened`**, and the E2 sweep has **not been run**. So *both* numbers are currently
**unpopulated**:
- E1 walk-away rate → "no self-reports yet" (KR1's ≥10 reports not met).
- E2 variance reduction → does not exist yet (no `run-probe.ts` sweep has occurred).
- The one observable E1 figure — andon 40–50% vs 10% — is **contaminated**: the ledger
  includes deliberate failure-test epics (E-900, E-901 — budget-exhausted / timed-out /
  gate-failed stress fixtures), so the over-budget rate is not a clean trust signal.

This is exactly what AC4 anticipates: "Producing the two numbers requires running
T-014-01/02's instruments — the live measurement is the human step at sweep."

## The decision framework (the rule the note applies)

From PRD §8 and `discovery-foundation.md` Step 6, identical wording:
- **E1 + E2 green** → **go**: build the macro-wallet as *trust capitalized*.
- **E1 weak** (author keeps intervening) → **reroute** to andon UX / design-language —
  trust must precede walk-away.
- **E2 weak** (gates don't reduce variance) → **reroute** to the core consistency promise
  before scaling autonomy at all.

A2 (trust → intervention trending to 0 while andon stays in budget) and A5 (gates reduce
variance) are the discovery leap-of-faith assumptions this gate de-risks (ranks 1 and 4).

## The bridge (where the decision lands)

`demand.md` already encodes the gate: the **macro-wallet** signal ("Not yet pulled") is
marked **"⚠ Gated by E-014 — pull only on E-014's go verdict (else reroute to
andon-UX / consistency first)."** So the note's output re-ranks the next pull: it either
un-gates the macro-wallet or promotes the andon-UX / consistency-promise signal above it.

## Constraints & assumptions

- Honesty (IA-8): the meter must not lie. "No data yet" must read as exactly that — never a
  fabricated green. Both formatters already enforce this; the note must inherit it.
- Sample limits are explicit in the PRD §5: one self-reporting user, ≤5 casts/arm — a
  directional steer, not a statistic. AC3 requires the note to say so.
- No code change is expected. AC4's `check:*` green is a regression guard (the deps already
  landed green at 467 tests), not new work.
