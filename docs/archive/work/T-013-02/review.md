# T-013-02 — Review

*Handoff: what changed, test coverage, open concerns. Enough to review without reading
every diff.*

## What this delivers

`recalibrate(play, records, tier, prior)` — a **pure** core that proposes a play's
envelope from its **own measured past**: tokens and wall-clock bounded **independently**
at the value-tier percentile (Keystone p95 → Leaf p75) over **successful** runs only,
with **confidence** (successes + censored counts) and a **cold-start fallback** to the
hand prior. A read-only `vend envelope <play> [--tier <t>]` command surfaces it, honestly
labelled. This is rung R3 of E-013 — the Confirm default (IA-6) becomes *earned* rather
than guessed.

## Files changed

| File | Δ | Summary |
|------|---|---------|
| `src/ledger/recalibrate.ts` | **new** (~150 ln) | Pure core: `TIER_PERCENTILE`, `percentile` (nearest-rank ceil), `recalibrate`, `formatEnvelopeLabel`, types/constants. |
| `src/ledger/recalibrate.test.ts` | **new** | 21 fixtured unit tests. |
| `src/cli.ts` | +~35 ln | `envelope` command: parse arm, `parseEnvelopeArgs`, `VALUE_TIERS`, USAGE line, lazy read-only dispatch. |
| `src/cli.test.ts` | +~25 ln | 4 envelope parse tests. |

No existing module's behaviour changed — the read face (`forPlay`/`totalTokens`/
`wallClockMs`/`loadRunLog`, T-013-01) and the prior accessor (`budgetForTier`) already
existed; this slice only **consumes** them. `src/ledger/` is a new directory (the IA's
"Ledger" noun) — the home T-013-03 (bias-correction, IA-16) extends.

## Acceptance criteria

- ✅ **Pure `recalibrate` → tier percentile over successes → `Budget`; returns
  `{ envelope, confidence: { successes, censored } }`; cold-start fallback.** Done.
  `confidence` is additively extended with `percentile`, and a top-level `source`
  discriminant ("measured" | "prior") was added for the label — both additive.
- ✅ **Surface shows the measured envelope labelled with confidence** ("measured · N
  casts · pXX" vs "estimate (no data)"). `formatEnvelopeLabel` + the `vend envelope`
  command; verified by live smoke.
- ✅ **Unit-tested with a fixture log:** correct percentile per tier; censored excluded
  from the percentile but counted; cold-start → prior; tokens & wall-clock independent.
- ✅ **`bun run check:*` green.** typecheck clean; 383 tests pass.

## Test coverage

**Strong on the pure core.** `recalibrate.test.ts` covers: `percentile` in isolation
(n=1, the three tier ranks, p=0/1 boundaries); per-tier percentile (keystone/high/
standard/leaf); censored excluded-but-counted with `gate-failed` in neither bucket;
cold-start at 0 and at sub-threshold successes; tokens/wall-clock decorrelated; null
timestamps dropping from the time sample only (with token measurement preserved); the
recency window; play filtering; positive-integer budget output; and every label branch.

**Live-proven on the surface.** The cli dispatch shell and `loadRunLog` are untested by
design (house pattern — the fs verb's logic is the tested pure pair) and proven by the
Step-6 smoke against the real 10-record ledger, hand-verified.

**Gaps (acceptable for this rung):**
- No test asserts the exact `formatBudget`-style human rendering of the envelope numbers
  — the command prints raw `tokens / ms`. A prettier readout is cosmetic and can follow
  with the TUI.
- The `percentile` precondition (sorted, non-empty) is caller-guaranteed, not defended
  inside the function. `recalibrate` is the only caller and always sorts + guards via the
  cold-start branch, so an unsorted/empty input cannot reach it through the public path.

## Open concerns / things a reviewer should weigh

1. **`high` tier = p92 is a judgement call.** The ticket names three tiers; the board has
   four. p92 interpolates IA-12's andon-budget ladder between keystone (p95) and standard
   (p90). Defensible but not specified — worth a glance. Not load-bearing (`--tier`
   defaults to `standard`).
2. **Read-only by design — no actuation.** `vend envelope` *displays*; it does **not**
   feed measured envelopes into the press/dispatch default. That is deliberate: actuation
   needs IA-14's deadband + asymmetric hysteresis (auto-widen fast, slow-tighten) to avoid
   flapping, and the ticket scopes this slice to *reading* the andon rate, not acting on
   it. The natural home for actuation is the Confirm screen (which knows the action's
   tier) + IA-14. **Flag:** until then, `TIER_BUDGET` priors still drive real casts — the
   measured envelope is informational only.
3. **`--tier` default of `standard`.** The CLI readout has no board context, so it cannot
   know a play's per-action tier; `standard` (p90) is the neutral middle. The eventual
   Confirm surface will carry the real tier.
4. **Informative-censoring bias is acknowledged, not corrected.** Per IA-13 the andon
   budget caps how much tail we ever observe, so even the success percentile is biased low
   on a play that andons often. The `censored` count surfaces this (the label shows
   "· K andon'd"), but de-biasing (uncensored probe casts; the hierarchical bias-correction
   of IA-16) is later work — T-013-03 and beyond.

## Verification commands

```
bun run check:typecheck          # clean
bun test                         # 383 pass / 0 fail
bun run src/cli.ts envelope decompose-epic            # measured · 3 casts · p90 · 2 andon'd
bun run src/cli.ts envelope decompose-epic --tier keystone
bun run src/cli.ts envelope no-such-play              # estimate (no data) → prior
```

## Handoff state

Source is left **uncommitted** for the loop's `on-clear` step to land atomically once the
RDSPI cycle completes — no mid-cycle commit that could race it. Ticket frontmatter
(`phase`/`status`) left untouched — Lisa advances it from these artifacts.
