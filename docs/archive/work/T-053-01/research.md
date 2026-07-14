# T-053-01 — Research

**Ticket:** pure-funding-band-floor-ceiling · **Story:** S-053-01 · **Epic:** E-053 (rational-funding-band)

Descriptive map of the code the ticket touches. No solutions proposed here — that is Design.

## The change in one line

Clamp `fundingEnvelope`'s **token** output to a rational band `[350_000, 700_000]` as the outermost
bound, applied AFTER the existing `max(priced, maxCensoredActual × headroom)` computation. Two new
exported constants. Wall-clock, price, percentile math, and authorization gates are all untouched.

## Where the work lives

Single file: `src/ledger/recalibrate.ts`. The funding sub-module (lines ~182–295) is self-contained:

- `MEASUREMENT_HEADROOM = 2` (line 207) — headroom factor above the largest observed censored lower
  bound. `≥ 2`, finite (P7).
- `CENSORED_WIDEN_RATE = 1/3` (line 214) — censored-rate threshold at/above which a `measured`-source
  play is treated as under-calibrated and auto-widened.
- `FundingOptions` (216–225) — per-call knobs (`window`, `widenRate`, `headroom`), all defaulting to
  the module constants. This is the override seam the ticket says to extend (band overridable "via
  the existing `opts`, like the other knobs").
- `FundingResult` (230–233) — `{ envelope: Budget; widened: boolean }`. The per-cast guard.
- `fundDimension(priced, censoredActuals, headroom)` (238–241) — funds ONE dimension:
  `positiveInt(max(priced, (censoredActuals.length ? max(...censoredActuals) : priced) × headroom))`.
  Reused for both tokens and time.
- `fundingEnvelope(play, records, result, opts)` (254–295) — the public entry. Computes
  `underCalibrated` from `result.source`/censored rate; if not under-calibrated returns `{...priced}`
  verbatim (back-compat); otherwise funds each dimension via `fundDimension`, then sets `widened`.

The clamp must sit on the **token** number AFTER both return paths converge, so BOTH the
trusted-measured path (`{ ...priced }`) and the widened path get banded. Today they return at two
different points (line 275 and line 294).

## Supporting primitives (reuse, do not reinvent)

- `positiveInt(n)` (94–96): `Math.max(1, Math.ceil(n))` — the budget-dimension contract (positive
  integer). The ticket explicitly says reuse it. Constants 350_000 / 700_000 are already positive
  ints, but routing a clamped value through `positiveInt` keeps the contract uniform.
- `Budget` (`src/budget/budget.ts`, type-only import here): `{ timeMs: number; tokens: number }`.
- `RunRecord` / `totalTokens` / `wallClockMs` / `forPlay` (`src/log/run-log.ts`): PURE record
  helpers. Not changed; only read by `fundingEnvelope`'s censored re-window.

## Module discipline (constraints to honor)

- **PURE/TOTAL.** Every export takes plain values, returns fresh ones — no fs, clock, network,
  process (header comment lines 20–26). The clamp must stay pure arithmetic.
- **GUARD ≠ PRICE (IA-8, charter P7).** `fundingEnvelope` is a strict POST-processor over
  `result.envelope`; it NEVER mutates `recalibrate`'s returned `envelope`, the percentile math, or
  `formatEnvelopeLabel` (lines 195–196). The band lives on the guard only. The quoted price stays the
  honest p90.
- **Per-dimension independence.** Tokens and wall-clock are funded separately (`fundDimension` called
  twice). The band is **tokens-only** — wall-clock keeps its E-038 headroom, NOT clamped (ticket
  "Strict scope: do NOT touch the WALL-CLOCK dimension").
- **`widened` flag semantics.** Set from comparing funded vs priced per dimension (line 293). The
  ticket says the floor/ceiling are bounds, NOT the headroom signal — `widened` stays whatever the
  existing logic sets. So the clamp must NOT feed back into `widened`'s computation (or if it does,
  must preserve current meaning — a design question).

## How it flows downstream (no new wiring needed)

`fundingEnvelope` is already threaded into both cast paths (E-050 / T-050-02):

- `src/play/work.ts:194–204` — the macro loop. `proposeFunding` / `decomposeFunding` =
  `fundingEnvelope(...).envelope`. The seam comment (194–199): "the wallet AUTHORIZES on `price` and
  DEBITS the actuals, while a cold-start/under-calibrated cast is FUNDED at
  `max(price, maxCensoredActual × headroom)`." The band clamps that funding result; price-gating
  (`canAfford`/`fitNext`) is unaffected.
- `resolveStepBudgets` / `fundedStepDefault` (the chain rung, T-050-02) — same `fundingEnvelope`
  return, same automatic flow-through.

So T-053-01 is a pure-function change; the band flows through both paths with NO new wiring. T-053-02
(separate ticket) confirms that end-to-end.

## The two failures this fixes (from the epic / dogfood)

1. **Too tight (floor fixes):** well-calibrated `propose-epic` funds at its bare p90 ~170k (no
   headroom — correct per E-050), then budget-exhausts at 176,101 — a 3.6% tail draw — halting the
   whole `vend chain`. A 350k floor means it runs under 350k and never starves on a tail.
2. **Too loose (ceiling fixes):** E-051's `decompose` self-funded (censored/under-calibrated) to
   ~733k, unbounded. A 700k ceiling caps it — the hard P7 wall.

## Existing test patterns (to mirror in Plan/Implement)

`src/ledger/recalibrate.test.ts` (`describe("fundingEnvelope …", …)`, lines 412–522). Conventions:
- `recordOf({ tokens, durationMs?, outcome? })` builds a real frozen `RunRecord` via
  `buildRunRecord` (the pure writer) — fixtures match production shape. Censored = `outcome:
  "budget-exhausted"` / `"timed-out"`.
- Tests feed REAL `recalibrate(...)` output into `fundingEnvelope` (never a hand-faked
  `RecalibrateResult`), exercising the price→funding seam as production wires it.
- `PRIOR: Budget = { timeMs: 999, tokens: 888 }`.
- A "constants are the documented bounded values" test (517–521) asserts finiteness — the new
  constants get the same finite/positive-int (P7) assertions.

## Verification gate

`bun run check` = `baml:gen && check:typecheck (tsc --noEmit) && check:test (bun test)`. The ticket's
"`bun run check:*` green" maps to these. No live model — all fixtures are fabricated records.

## Assumptions / open questions (resolved in Design)

- The clamp applies to BOTH return paths (measured-verbatim and widened), since a measured p90 below
  350k (e.g. the ~170k propose) must also be floored. The measured-verbatim early-return at line 275
  therefore cannot stay a bare `{ ...priced }`.
- `widened` meaning under the clamp: does flooring a 170k price to 350k count as "widened"? Today
  `widened` means "headroom lifted a dimension above price." Design must decide whether the band
  participates. Ticket says band is "not the headroom signal" → leave `widened` as-is.
