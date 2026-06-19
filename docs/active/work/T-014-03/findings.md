# Findings — Trust & Consistency Evidence Gate (E-014)

> One-page synthesis (PRD KR4). Reads the E1 (trust) and E2 (consistency) instruments and
> returns the go / reroute decision the epic exists for. Evidence, not a roadmap.

## TL;DR — the decision

**HOLD. Do not green-light the macro-wallet yet.** The evidence gate is **not satisfied** —
not because the signal is bad, but because **neither number has been collected**. Both
instruments are built, tested, and committed (T-014-01, T-014-02); the ledger carries **zero
intervention self-reports** and **no variance sweep has been run**. *Unmeasured is not
weak.* The next pull is the **measurement sprint**, not a build and not a reroute.

> **Update 2026-06-19 — E2 measured.** The variance sweep ran, after fixing the probe's
> temp-project seeding (`lisa init` + epic dir) and raising the per-cast token budget to **180k**
> to clear decompose's ~95k fat tail (the 50k default censored 8/10 runs). **Gate-driven
> variance reduction: 21%** — ungated line-set-Jaccard dispersion **0.62 → gated 0.49**, N=5 per
> arm, clean (no censoring caveat). Reading: gates **do** reduce output variance, so the
> **E2-weak reroute branch is off the table**. But it is *modest, not dramatic* — gated output
> still disperses **0.49** (runs share only ~half their lines), and gates plausibly enforce
> *structural* validity more than wording, which a line-diff understates. One play × one epic ×
> N=5 = **directional, not proof**. **Verdict stays HOLD** — solely because **E1 (walk-away)
> is still uncollected** (needs forward self-reported runs). E2 now leans the eventual decision
> *toward* go. *(Side finding, loud: decompose-epic blows its 50k token envelope ~80% of the
> time on a meaty epic — the budget fat-tail / `--max-turns` signal, quantified.)*

## The two numbers

### E1 — walk-away trust → **unrecorded**

```
E1 — walk-away trust · all plays · 10 runs [standard]
  walk-away rate: no self-reports yet (10 runs, intervention bit unrecorded)
  andon rate: 40% vs 10% budget — ⚠ over (gates working, not defects)
  outcome mix: 6 success · 3 censored (budget/timeout) · 1 gate-failed · 0 id-collision
  cost vs envelope: no envelope data
```
The `intervened` instrument is live (`vend run --intervened/--no-intervened` → `vend
audit`), but it is **forward-looking**: none of the 10 existing records predate it, so the
walk-away rate reads "no self-reports yet." KR1 (≥10 reports) is **unmet**. The one
observable figure — andon **40%** (50% for decompose-epic alone) vs the 10% standard budget
— looks "over," but the ledger is **contaminated by deliberate failure-test epics**
(E-900 budget-exhausted/timed-out, E-901 gate-failed). That over-budget rate is a test
artifact, **not** a trust signal, and must not be read as A2 evidence. The genuine A2
number — does the author stop stepping in — does not exist yet.

### E2 — gate-driven variance reduction → **not yet measured**

No sweep has been run. The instrument (`bun run src/probe/run-probe.ts <epic.md>`) casts
one play 5× gated and 5× ungated on a fixed epic, then reports a single line-set-Jaccard
**variance-reduction** number plus each arm's dispersion. **Standing caveat (read the
number *with* it):** gates buy consistency by *censoring* — a gate-failed run materializes
nothing — so if gates censor most of the gated arm, the 1–2 survivors are trivially
consistent and the reduction inflates toward 100%. `formatVarianceReport` flags this
("gated arm too small to disperse — reduction not meaningful"); a bare percentage without
its censoring caveat is not a real read. Until the sweep runs, A5 (gates → consistency)
remains asserted, not quantified.

## The decision

**Verdict now: HOLD / not-go.** The macro-wallet is *already* gated in `demand.md` behind an
E-014 **go** verdict; HOLD keeps it gated — the safe default — and names the exact unblock.
This is the evidence-based call when the evidence says "not yet collected": building the
macro-wallet now would be exactly the build-on-assumption the PRD exists to prevent.

**The rule, once both numbers land** (PRD §8 / discovery-foundation Step 6):

| Signal state | Verdict | Concrete next pull |
|---|---|---|
| **E1 + E2 green** | **go** | Un-gate the macro-wallet in `demand.md` — build it as *trust capitalized*. |
| **E1 weak** (author keeps intervening) | **reroute** | Promote the **andon-UX / design-language** signal above the wallet — trust must precede walk-away. |
| **E2 weak** (gates don't reduce variance) | **reroute** | Promote the **core consistency-promise** fix above *all* autonomy scaling. |

**The next pull now (both unmeasured):** the **measurement sprint** — a human sweep, not a
build:
1. Cast ≥10 real runs with `vend run <play> --intervened` / `--no-intervened`, then read
   `vend audit` for the walk-away rate + trend (satisfies KR1/KR2).
2. Run `bun run src/probe/run-probe.ts docs/active/epic/E-0XX.md` once for the E2 reduction
   number (KR3).
3. Re-apply the table above to the populated numbers. That read is two lines, not another
   synthesis cycle — the rule is pre-wired here.

## Honest about the sample

Even once collected, this is a **directional signal, not a proof**: exactly **one
self-reporting user** (the author, on this repo), **≤5 casts per arm**, **one epic** as the
fixed E2 input, and a currently **contaminated andon sample**. The walk-away bit is
self-reported with no audit of the bit itself. A directional steer from one honest user
beats a confident guess from none (PRD §5) — but it is a steer, and the go-verdict it gates
should be read as "the assumptions did not break," not "the assumptions are proven."

## How to produce the numbers (the human step, AC4)

```
# E1 — populate the trust signal (≥10 runs), then read it
vend run <play> --intervened        # author stepped in
vend run <play> --no-intervened     # author let it clear
vend audit                          # walk-away rate + trend + andon-vs-budget

# E2 — the single variance-reduction number (one live 5×2 sweep)
bun run src/probe/run-probe.ts docs/active/epic/E-0XX.md
```

## Citations
- **T-014-01** — E1 trust instrument (`src/ledger/walk-away.ts`, `vend audit`); numbers.
- **T-014-02** — E2 consistency instrument (`src/probe/variance.ts`, `run-probe.ts`); number.
- **PRD §8** — what V1 gates (the go / reroute rule).
- **discovery-foundation.md** Step 6 — the decision framework; A2 (rank 1) / A5 (rank 4).
- **demand.md** — the macro-wallet signal this decision gates (the bridge below).
