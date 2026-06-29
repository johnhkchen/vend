# T-060-02-01 — Plan

Ordered, independently-verifiable steps. One atomic commit at the end (additive core + its test).

## Step 1 — Add `coldStartEnvelope` to `src/ledger/recalibrate.ts`

Insert after the `fundingEnvelope` block (line ~328), before the `── Reference-class bias
correction ──` section.

1a. Add the `ColdStartEnvelopeResult` interface (fields per structure.md).

1b. Add a private `sumEnvelopes(a: Budget, b: Budget): Budget` returning
`{ timeMs: a.timeMs + b.timeMs, tokens: a.tokens + b.tokens }` with an IA-8 "never cross-add axes"
note. (Inline two-liner; not imported from work.ts — the no-shared-util idiom.)

1c. Add `coldStartEnvelope(plays, records, tier, prior, opts = {})`:
- `if (plays.length === 0) return { envelope: prior, source: "prior", perPlay: [] };`
- `const perPlay = plays.map((play) => ({ play, result: recalibrate(play, records, tier, prior, opts) }));`
- `const envelope = perPlay.reduce((acc, p) => sumEnvelopes(acc, p.result.envelope), { timeMs: 0, tokens: 0 });`
- `const source = perPlay.every((p) => p.result.source === "measured") ? "measured" : "prior";`
- `return { envelope, source, perPlay };`
- Full doc comment: PURE/TOTAL; delegates percentile/censoring/cold-start to `recalibrate`;
  plays+prior passed in (decoupling); aggregate source = all-measured; empty ⇒ prior floor; the
  returned envelope is the PRICE (no funding headroom — IA-8).

**Verify:** `bun run build` (typecheck) passes; no new imports needed.

## Step 2 — Add the test block to `src/ledger/recalibrate.test.ts`

Append `describe("coldStartEnvelope — Σ recalibrate over the drive's plays (T-060-02-01)")`.
Reuse `recordOf` and a local prior. Fixtures use two plays — `"propose-epic"` and `"decompose-epic"`
(the cold-start chain) — with controlled per-play success costs so the percentile is hand-computable.

Cases:

1. **measured & distinguishable from the hand prior (the AC).**
   Build, for each play, 5 successes with ascending tokens (e.g. propose: 10k·k, decompose: 20k·k,
   k=1..5) and a fixed prior far from those values. Standard tier (p90).
   - `source === "measured"`.
   - `envelope.tokens === p90(propose tokens) + p90(decompose tokens)` (a value computed FROM the
     fixtures — "read from the ledger, not literal-coded").
   - `envelope` ≠ the summed hand prior (`{ timeMs: prior.timeMs*2, tokens: prior.tokens*2 }`).
   - `perPlay` has 2 entries, both `source: "measured"`.

2. **value-tier percentile honored.** Same fixtures, assert keystone (p95) yields a different,
   higher sum than leaf (p75) — the tier drives the bound through to the macro.

3. **censored-aware.** Add `budget-exhausted` + `timed-out` records with enormous tokens/durations to
   each play's set (still ≥3 successes). Assert the measured `envelope` is UNCHANGED from case-1's
   value (censored runs excluded from the percentile), and that per-play `confidence.censored > 0`
   (counted, not swallowed).

4. **cold-start fallback (too few successes).** 2 successes per play (< `COLD_START_MIN_SUCCESSES`).
   - `source === "prior"`.
   - `envelope === summed prior` (`{ timeMs: prior.timeMs*2, tokens: prior.tokens*2 }`).
   - Each `perPlay[i].result.source === "prior"`.

5. **mixed provenance ⇒ aggregate prior.** propose-epic gets ≥3 successes (measured), decompose-epic
   gets <3 (prior). Assert `source === "prior"` (only as earned as the weakest leg), while
   `perPlay` shows one measured + one prior.

6. **degenerate `plays = []`.** Assert `{ envelope: prior, source: "prior", perPlay: [] }`, and that
   no dimension is `NaN`/0-invalid.

7. **single-play list.** `["propose-epic"]` returns exactly that play's recalibrate envelope (Σ over
   one) — proving the function generalizes / Option-D is a subset.

**Verify:** `bun test src/ledger/recalibrate.test.ts` all green.

## Step 3 — Full gate

Run `bun run check` (the project's real gate — typecheck + lint + full `bun test`). Confirm no
regressions in the existing recalibrate / run-log / work suites (the change is purely additive, so
none expected). Per CLAUDE.md the canonical commands are `bun run build` / `bun test` / `bun run
lint`; `bun run check` if defined runs them together — fall back to the trio if not.

## Step 4 — Commit

One commit: `feat(ledger): derive cold-start budget envelope from run-log tails (T-060-02-01)`.
Body: composes recalibrate over the seed cold-start chain's plays into a per-denomination macro
budget; measured-from-tails, censored-aware, honest aggregate provenance; sibling T-060-02-02 wires
it as the seed default. Co-author trailer per repo convention.

## Testing strategy summary

- **Unit (the whole ticket):** pure function on fabricated `RunRecord` ledgers — the proven house
  pattern for recalibrate (no fs/clock/spawn). Cases above cover: measured-and-distinguishable (AC),
  tier sensitivity, censoring inheritance, cold-start fallback, mixed provenance, degenerate, and
  single-play.
- **No integration/live test here.** Wiring into `vend work` / the seed and the LIVE re-drive are
  T-060-02-02 and the E-060 closing drive respectively — this card's contract is the derivation, and
  a pure unit test is the correct and sufficient proof of it.
- **Verification criteria (done):** the AC test (case 1) passes — the envelope is recalibrate-derived
  over successful tails, value-tier + censored-aware, distinguishable from the hand prior, and read
  from the (fabricated) ledger — and `bun run check` is green.
