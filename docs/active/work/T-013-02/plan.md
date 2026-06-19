# T-013-02 — Plan

*Ordered, independently-verifiable steps. Testing strategy and AC trace.*

---

## Step sequence

### Step 1 — `src/ledger/recalibrate.ts`: constants, types, `percentile`
Create the file. Add `TIER_PERCENTILE` (keystone .95 / high .92 / standard .90 /
leaf .75), `COLD_START_MIN_SUCCESSES = 3`, `DEFAULT_WINDOW = 100`, `CENSORED_OUTCOMES`,
the three interfaces (`Confidence`, `RecalibrateResult`, `RecalibrateOptions`), and the
`percentile(sortedAsc, p)` nearest-rank-ceil function with `positiveInt` helper.
**Verify:** `tsc --noEmit` clean (no consumers yet — pure addition).

### Step 2 — `recalibrate(...)`
Implement the orchestration per structure §Algorithm: `forPlay` → window slice → split
successes/censored → cold-start guard → two independent sorted samples → percentile →
`positiveInt` → result. Then `formatEnvelopeLabel`.
**Verify:** `tsc --noEmit` clean.

### Step 3 — `src/ledger/recalibrate.test.ts`
Lock every AC branch (see §Testing). **Verify:** `bun test` green; new file covers the
math to the branch.

### Step 4 — `src/cli.ts`: `envelope` command
Add the `ParsedCommand` arm, `parseEnvelopeArgs`, the `parseArgs` route, the `VALUE_TIERS`
const + `ValueTier` type import, the USAGE line, and the lazy dispatch arm.
**Verify:** `tsc --noEmit` clean.

### Step 5 — `src/cli.test.ts`: parse coverage
Cover `parseArgs` for the envelope shapes. **Verify:** `bun test` green.

### Step 6 — gates + smoke
`bun run check:typecheck && bun run check:test`. Then live smoke:
`bun run src/cli.ts envelope decompose-epic` and `… --tier keystone` against the real
`.vend/runs.jsonl` (10 records) — confirm it prints an envelope + an honest label and
exits 0. Commit.

Each step is independently committable; the natural commit boundary is the whole feature
(core + tests + surface) since the surface is inert without the core.

---

## Testing strategy

### `recalibrate.test.ts` (the AC #3 gate)

Fixture factory mirroring `run-log.test.ts`'s `baseInput`:
```ts
const recordOf = (over: Partial<RunRecordInput> = {}): RunRecord =>
  buildRunRecord({ runId: "r", play: "p", epic: "E-001", model: "m",
    outcome: "success", startedAt: "...T00:00:00.000Z", endedAt: "...T00:01:00.000Z",
    usage: { input_tokens: 1000 }, ...over });
```
Use `buildRunRecord` (exported, pure) so records are realistic and frozen. Control
`usage` to set `totalTokens`, and `startedAt`/`endedAt` to set `wallClockMs`.

**`percentile` (isolated):**
- `percentile([10], 0.95) === 10` (n=1, any p).
- ascending `[1..10]`: p=0.95 → ceil(9.5)−1=9 → `10` (max); p=0.90 → ceil(9)−1=8 → `9`;
  p=0.75 → ceil(7.5)−1=7 → `8`; p=0 → index 0 → `1`; p=1 → `10`.
- nearest-rank conservatism documented in an assertion comment.

**`recalibrate` per-tier percentile (AC #3a):**
- 10 success records, tokens `1000·k` for k=1..10 (and matching wall-clocks), tier
  `keystone` → `envelope.tokens === 10000` (p95 = max); `standard` → `9000` (p90);
  `leaf` → `8000` (p75). `source === "measured"`, `percentile` echoed.

**Censored excluded but counted (AC #3b):**
- successes with tokens `[1000,2000,3000]` + two `budget-exhausted` + one `timed-out`
  records (huge tokens). `standard`/with `minSuccesses:3` → percentile computed from the
  **three successes only** (the huge censored tokens do NOT inflate it);
  `confidence.censored === 3`; `confidence.successes === 3`. A `gate-failed` record in
  the mix is counted in **neither**.

**Cold-start fallback (AC #3c):**
- 2 success records (< default 3) + a literal `prior = { timeMs: 999, tokens: 888 }` →
  `envelope === prior` (deep-equal), `source === "prior"`, `confidence.successes === 2`.
- 0 records → prior, `source: "prior"`, `successes: 0`.

**Tokens & wall-clock bounded independently (AC #3d):**
- successes where token order ≠ wall-clock order (e.g. tokens ascending but durations
  shuffled) → assert `envelope.tokens` from the token sample and `envelope.timeMs` from
  the time sample are each the correct independent percentile (not correlated).
- a success record with **unparseable** stamps (`wallClockMs` → null): dropped from the
  time sample only; tokens still counted; if **all** times null → `timeMs === prior.timeMs`
  while tokens stays measured.

**Windowing:**
- `> window` records where the oldest (out-of-window) carry extreme tokens →
  `window` opt small (e.g. 3) confirms only the last 3 feed the percentile.

**Valid-budget output:**
- a success set whose percentile is fractional/zero → `envelope.tokens` and `timeMs` are
  positive integers (`Number.isInteger`, `> 0`).

**`formatEnvelopeLabel`:**
- measured → matches `/^measured · 10 casts · p95$/`; with censored → `… · 2 andon'd`.
- prior, 0 successes → `estimate (no data)`.
- prior, 2 successes → `estimate (2 casts)`.

### `cli.test.ts` (parse only)
- `parseArgs(["envelope","decompose-epic"])` → `{cmd:"envelope", play:"decompose-epic",
  tier:"standard"}`.
- `… "--tier","keystone"` → tier keystone.
- `["envelope"]` → usage "missing <play>".
- `["envelope","p","--tier","bogus"]` → usage (unknown tier).

### Not unit-tested (house pattern)
The cli dispatch shell and `loadRunLog` (the fs verb) — proven by the Step-6 smoke, like
every other arm.

---

## AC trace

| AC | Covered by |
|----|-----------|
| Pure `recalibrate` → tier percentile over successes → `Budget`; `{ envelope, confidence:{successes,censored} }`; cold-start fallback | Steps 1–2; tests "per-tier", "cold-start" |
| Surface shows measured envelope labelled with confidence ("measured · N casts · pXX" vs "estimate (no data)") | Step 4; `formatEnvelopeLabel` tests + Step-6 smoke |
| Unit-tested fixture log: percentile/tier, censored excluded-but-counted, cold-start→prior, tokens & wall-clock independent | Step 3 |
| `bun run check:*` green; live check = sweep | Step 6 |

---

## Risks & mitigations

- **R1 — importing pure helpers from `run-log.ts` drags fs into the test process.**
  Mitigation: the fs calls live only *inside* `appendRunLog`/`loadRunLog` (called, not
  evaluated at import); `run-log.test.ts` already imports the same module cleanly.
  Confirmed by the existing test passing.
- **R2 — `high` tier percentile is unspecified by the ticket (it names 3 tiers, code has
  4).** Mitigation: place `high` at p92 between keystone (p95) and standard (p90),
  documented in `TIER_PERCENTILE`'s comment as an interpolation of IA-12's andon-budget
  ladder. Not load-bearing — `--tier` defaults to standard.
- **R3 — measured envelope below prior could "starve" a future cast.** Out of scope:
  this slice displays, never actuates (IA-14 hysteresis is the later rung). Documented in
  design §E. No mitigation needed here; the read-only surface cannot starve anything.
- **R4 — `--tier` default choice.** `standard` (p90) is the neutral middle; a reviewer
  could prefer per-action tier. Deferred: the CLI readout has no board context; the
  Confirm screen (which *does* know the action's tier) is the eventual home.
