# Findings — The measurement sprint (E-014's evidence gate, run 2026-06-19)

> The human-step sprint the E-014 HOLD named: collect E1 (walk-away trust) + E2 (gate-driven
> variance), then re-apply the pre-wired go/reroute rule. Re-applying the rule is *two lines, not a
> synthesis cycle* — the rule was fixed in `work/T-014-03/findings.md` before the numbers existed.

## TL;DR — go (un-gate the macro-wallet), with one honest caveat

Both numbers are now collected and **neither triggers a reroute**, so the pre-wired rule reads
**go**. The caveat is about *evidence quality*, not direction: E1 is uniform and post-hoc.

| Signal | Result | Reroute branch? |
|---|---|---|
| **E1 — walk-away** | **100% (13/13 ran untouched)**, KR1 ≥10 **met** | "author keeps intervening" → **off the table** |
| **E2 — gate variance** | clean **21%** (epic 1) + censored-but-corroborating (E-023) | "gates don't reduce variance" → **off the table** |

→ **go: un-gate the macro-wallet.** The un-gate gesture itself is the human's (IA-5); the evidence
and the recommendation are ours.

## E1 — walk-away trust (now 13 reports)

`vend audit` after attesting the session's 13 genuine clearing casts:

```
walk-away rate: 100% (13/13 ran untouched) · trend 100% → 100%
andon rate: 35% vs 10% budget — ⚠ over (gates working, not defects; whole-ledger, still test-contaminated)
outcome mix: 13 success · 4 censored · 3 gate-failed · 0 id-collision
```

**How it was collected — honestly.** The `intervened` bit is forward-looking *by design* (recorded
live at run time), and the session's real walk-away behavior flowed through casts that recorded no
bit. So a **back-fill with attestation** path was built — `src/ledger/attest-intervention.ts` — that
records, per named run, the bit **plus `{by, at, basis}`**, marking it as a post-hoc *attestation*
distinguishable from a live capture in any later audit. It refuses to run without a `--basis` and
takes **only named runIds** (no wildcard — you attest runs you stand behind).

**What was attested, and what was excluded** (the honest denominator):
- **Attested (13):** the session's `run-2026-06-19T*` clearing casts (dogfood chain E-020/E-021;
  the articulation-play casts; the sprint casts). Human present, **did not intervene mid-run** on
  any — on the andon runs (budget-exhausted / gate-failed), the *gate* stopped the line, not the
  human (which is itself walk-away evidence: the author let the gate fire).
- **Excluded (7):** `A1–A4` (the deliberate E-900/E-901 failure-test epics — the contamination the
  T-014-03 findings flagged), `shelf-E-004` (seed), `verify-*` (play-verification probes). Stamping
  these would fabricate the signal.

**The caveat (load-bearing — read the 100% with it).** The signal is **uniform** (13 falses, zero
`--intervened`), **post-hoc** (attested, not live), and **single-attestor** (one user, one repo).
100%-with-no-variance can't yet distinguish *high trust* from *no discriminating case arose* — there
is no run where intervention was tempting to calibrate against. It is honest evidence that **nothing
forced a stop this session**; it is not a stress test. A forward E1 with some genuine `--intervened`
records would be far stronger, and is the natural next collection.

## E2 — gate-driven variance (21% stands; a second read, censored, corroborates the mechanism)

- **Epic 1 (clean, the number):** **21%** reduction — ungated dispersion 0.62 → gated 0.49, N=5/arm,
  no censoring caveat. Gates **do** reduce output variance — the E2-weak reroute is off the table.
- **E-023 (this sprint, censored):** `run-probe.ts docs/active/epic/E-023.md 180000` → reduction
  **34%** but **⚠ 3/5 gated runs censored** (`value` gate: "plan has no tickets — advances nothing").
  E-023 is a *sorcery* epic already decomposed (its tickets are stated in its body), so re-decomposing
  yields a near-empty plan — a **poor probe input**, and the 34% is inflated by censoring (not a clean
  magnitude). **But the qualitative read is loud:** the `value` gate **refused 3/5 empty/no-op
  decompositions**, while the ungated arm let the same empties through (`materialized: false`). That
  is A5 (gates → consistency, via censoring) demonstrated directly — the gate earning its keep.
  Lesson for next time: pick a *capability* epic with real, unrealized decomposition surface.

## The decision — re-applying the pre-wired rule

From `work/T-014-03/findings.md`: **E1 + E2 green → go → un-gate the macro-wallet in `demand.md`,
build it as *trust capitalized*.** Neither reroute branch fires. So:

- **Verdict: go.** The macro-wallet's E-014 gate is satisfied.
- **Recommendation: un-gate, but build with the hard-stops intact.** Because E1 is *didn't-break*,
  not *stress-tested*, the wallet should depend on the andon/budget hard-stops (P7) that already
  exist — autonomy capitalized on trust evidence, not on faith. The wallet's own first runs become
  the forward, variance-bearing E1 the back-fill couldn't be.
- **The un-gate is the human's gesture** (IA-5 / the founding allocation is the user's).

## Honest about the sample

One self-reporting user · one repo · ≤5 casts/arm (E2) · 13 post-hoc-attested reports (E1) · a
still-test-contaminated andon rate. A directional steer from one honest user beats a confident guess
from none (PRD §5) — but it is a steer. The go-verdict it gates reads as "**the assumptions did not
break**," not "the assumptions are proven."

## Citations
- E1 instrument + back-fill: `src/ledger/walk-away.ts`, `src/cli.ts audit`, `src/ledger/attest-intervention.ts` (this sprint).
- E2 instrument: `src/probe/run-probe.ts`, `src/probe/variance.ts`; logs `e2-E-023.log`.
- The pre-wired rule + the prior HOLD: `work/T-014-03/findings.md`.
- The gated signal: `demand.md` (the macro-wallet, un-gated by this verdict).
