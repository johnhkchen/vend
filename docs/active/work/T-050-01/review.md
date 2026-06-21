# T-050-01 — Review: pure funding-headroom core

Handoff for a human reviewer. What changed, how it's covered, what to watch.

## What changed

| File | Δ | Summary |
| --- | --- | --- |
| `src/ledger/recalibrate.ts` | +~95 lines, additive | `MEASUREMENT_HEADROOM`, `CENSORED_WIDEN_RATE`, `FundingOptions`, `FundingResult`, `fundDimension` (private), `fundingEnvelope` (public) + section banner |
| `src/ledger/recalibrate.test.ts` | +~95 lines | 3 imports added; one `describe` block, 9 cases |
| `docs/active/work/T-050-01/*` | new | research / design / structure / plan / progress / review |

No file deleted. No existing symbol renamed, re-typed, or removed → no caller can break. `budget.ts`,
`run-log.ts`, the CLI, and `recalibrate` itself are untouched.

## The change in one paragraph

`fundingEnvelope(play, records, result, opts?)` is a pure post-processor of `recalibrate`'s output.
It decides — from `result.source` and `result.confidence` (the censored RATE `recalibrate` already
computes but never acted on) — whether a play is **under-calibrated**: cold-start (`source: "prior"`)
or censored rate ≥ `CENSORED_WIDEN_RATE` (1/3). If so, it funds each dimension independently at
`max(priced, maxCensoredActual × MEASUREMENT_HEADROOM)` (2), reading the windowed censored runs'
logged `totalTokens` / `wallClockMs` as lower bounds; with no censored history it falls back to
`priced × headroom`. Otherwise it returns the price verbatim. `widened` flags whether headroom
actually lifted any dimension above its price. This is the token analogue of `budget.ts`'s
wall-clock `timeoutMsFor`/`TIMEOUT_HEADROOM`, generalized over both dimensions — the IA-14 auto-widen
that `recalibrate.ts:14-16` explicitly defers.

## AC verification

- **AC #1** (`max(priced, maxCensoredActual × headroom)` under-calibrated; `priced` verbatim when
  trusted; positive-int dims; `widened`) — ✅ covered by the E-049, cold-start, trusted, per-dim, and
  totality cases.
- **AC #2** (no mutation of `envelope` / percentile / `formatEnvelopeLabel`; headroom finite) — ✅
  the does-not-mutate case snapshots `result.envelope` and the label before/after; `fundingEnvelope`
  never writes to `priced` (trusted path copies via `{ ...priced }`, widened path builds a fresh
  object). `MEASUREMENT_HEADROOM` finiteness asserted.
- **AC #3** (the five enumerated scenarios) — ✅ each is a named test; values verified exact
  (264,866×2; PRIOR×2; measured==price; 500,000×2; tokens-widen-time-not).
- **AC #4** (`bun run check:*` green) — ✅ typecheck clean; full suite 1170 pass / 0 fail; precommit
  gate passed at commit `05c3460`.

## Test coverage assessment

- **Branches covered:** under-calibrated via `source: "prior"`; under-calibrated via rate ≥ threshold
  on a `measured` source; not-under-calibrated (trusted); censored-history present vs absent (the
  `fundDimension` fallback); per-dimension divergence; `wallClockMs` null filtering (unparseable
  stamps in the degenerate case); `positiveInt` flooring (zero-token censored run).
- **Gaps / not covered (intentional):**
  - The exact rate-gate boundary `rate === widenRate` (rate exactly 1/3) is not pinned by a dedicated
    case — fixtures land at 0.4 and 0.5. Low risk (the `>=` is explicit and simple), but a reviewer
    wanting belt-and-suspenders could add a 1-of-3 fixture asserting it widens.
  - `opts.window` / `widenRate` / `headroom` override paths use defaults only in tests; the override
    plumbing is trivial (`opts.x ?? CONST`) and shared with the well-tested `recalibrate` idiom.
  - No integration test — there is no caller yet (wiring is T-050-02), so unit coverage is complete
    for this ticket's surface.

## Open concerns / notes for the reviewer

1. **Window-consistency contract is a convention, not enforced.** `fundingEnvelope`'s `window` default
   matches `recalibrate`'s, and the doc comment states the caller must pass the same `window` that
   produced `result` so the censored RATE (from `confidence`) and the censored MAGNITUDES (re-windowed
   here) agree. T-050-02 must honor this when it wires the two together. A future refactor could thread
   the windowed censored set through `RecalibrateResult` to make this structural — deliberately NOT
   done here to avoid bloating a widely-consumed type (see design Decision 1).
2. **`widened` is honest, not aspirational.** If a play is under-calibrated but the price already
   exceeds every observed wall × headroom (the per-dim case is exactly this for the time dimension),
   `widened` is `false` for that dimension and the returned bool reflects "headroom was actually
   applied," not "we entered the under-calibrated branch." Confirm this matches what T-050-02's funding
   label wants to say.
3. **`MEASUREMENT_HEADROOM = 2` is a judgment, mirroring `TIMEOUT_HEADROOM = 2`.** One warranted factor
   for the class, not data-fit. If E-050 measurement data later shows 2× still re-censors a heavier
   class, this is the single constant to revisit (per-tier headroom would be the next rung).

## Critical issues
None. The change is additive, pure, fully gated, and behaviorally isolated from the price path.
