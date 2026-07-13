# Review — T-082-02-01 learned-window-capacity

## Disposition

Pass. The ticket acceptance criteria are met, the ticket-owned source is committed, the full gate
is green, and no critical issue remains for this slice.

## What changed

Created two files:

- `src/play/lane-capacity.ts`
- `src/play/lane-capacity.test.ts`

No existing source file was changed by this ticket. In particular:

- `src/play/lane-heat.ts` is untouched; quota-based routing belongs to `T-082-02-02`.
- `src/log/run-log.ts` is untouched; this ticket consumes the settled cap marker contract.
- budget and wallet modules are untouched; quota-denominated wallet algebra remains deferred.
- executor/cast code is untouched; cap classification belongs to sibling story `S-082-01`.

## Public API delivered

`learnLaneCapacities(records)` returns exactly one immutable `LaneCapacity` per `KNOWN_SEATS` entry,
in canonical registry order.

A learned result carries:

- the canonical `seat`;
- `status: "learned"`;
- mean observed cap-to-cap `windowMs`;
- mean observed cost-weighted `windowCapacity`;
- current same-duration rolling `currentBurn`;
- unclamped `quotaFraction`;
- count of admitted observed interval `samples`.

An unlearned result carries:

- the canonical `seat`;
- `status: "unlearned"`;
- a named reason.

The unlearned union member has no optional or defaulted capacity, current burn, window duration, or
quota-fraction field. Consumers must narrow the discriminant before numeric use, so the type surface
enforces the ticket's “never a number” requirement.

## Learning semantics reviewed

The implementation constructs a derived time-ordered view of valid record `endedAt` values. It
does not mutate the append-ordered input.

For each known lane:

1. Exact `seatOfExecution` equality selects lane records.
2. Marker presence selects cap observations; marker text is not reclassified.
3. Adjacent cap observations must have strictly increasing timestamps.
4. The interval must contain positive finite cost-weighted burn.
5. Burn ownership is `(previousCap, currentCap]`.
6. The later cap row therefore belongs to the window it exhausted.
7. Empty repeated cap failures are rejected as samples because they prove no reset.
8. Admitted durations and burns are averaged independently.

`totalTokens(record)` remains the only burn definition. The learner does not repeat cost weights or
fall back to raw token parity.

## Current quota semantics reviewed

“Current” is explicitly current as of the supplied ledger's latest valid event, not current as of a
machine clock.

- The latest valid `endedAt` across the full ledger is one shared as-of point.
- A learned lane's current interval is `(ledgerAsOf - windowMs, ledgerAsOf]`.
- `currentBurn` uses the same boundary rule and cost-weighted unit as learned samples.
- `quotaFraction` divides that current burn by positive learned capacity.
- The fraction is not clamped; an observed overage remains visible above 1.

Using a shared ledger-as-of point means later activity on another or unknown lane can honestly age
an inactive known lane's old burn. If no new ledger row exists, the module makes no wall-clock claim.

## Purity review

The production module imports only:

- `totalTokens` and the `RunRecord` type from run-log;
- `KNOWN_SEATS` and the `AgentSeat` type from agent-seat.

It has:

- no filesystem import or call;
- no ledger loading;
- no `Date.now()` or injected current-clock dependency;
- no provider API, network, executor, budget, process, or BAML dependency;
- no mutation of caller records or the caller array.

`Date.parse` reads stored timestamp evidence and is deterministic for equal input values. Both the
returned array and each returned result object are frozen.

## Acceptance fixture review

The primary fabricated ledger gives both canonical lanes two cap markers and independently
hand-computable facts.

First lane:

- cap cadence: 10 minutes;
- observed window burn: 400 input + 120 output × 5 = 1,000;
- current rolling burn: 250 input + 50 output × 5 = 500;
- quota fraction: 500 / 1,000 = 0.5.

Second lane:

- cap cadence: 20 minutes;
- observed window burn: 200 output × 5 + 1,000 input = 2,000;
- current rolling burn: 1,000 + 500 input = 1,500;
- quota fraction: 1,500 / 2,000 = 0.75.

The input is deliberately out of chronological order, proving event-time ordering while preserving
caller order.

## Additional test coverage

Seven focused tests cover:

- exact learned facts for both lanes;
- multiple cap-to-cap samples;
- arithmetic mean cadence and capacity;
- output-token and cache-creation cost weighting;
- global ledger-as-of current windows;
- no-cap explicit unlearned results;
- absence of numeric keys on unlearned values;
- a single cap remaining unlearned because no cadence exists;
- repeated empty cap markers not becoming reset-window samples;
- equal cap timestamps not creating samples;
- invalid timestamps being ignored as time evidence;
- unknown raw seats not becoming output lanes;
- canonical output ordering;
- caller-input order preservation;
- frozen output array and members.

Focused result:

- 7 passing;
- 0 failing;
- 18 assertions.

## Repository verification

Baseline before source changes:

- `bun run check` passed;
- 1,956 passing, 1 skipped, 0 failed.

Final gate after the evidence-quality adjustment and immediately before its commit:

- BAML generation passed;
- TypeScript passed;
- full test suite passed;
- 1,972 passing, 1 skipped, 0 failed;
- 6,478 assertions.

The higher final count includes this ticket's seven tests and concurrent sibling-ticket tests that
landed on the shared branch during the assignment.

## Commit review

Primary commit:

- `432722053871a5f19dc0180e77ef9d6ce56cd27a`
- message: `feat(play): learn lane window capacity`
- exact paths: the production module and its colocated test only.

Focused evidence-quality commit:

- `ae9a7b34de11d4278ff14dfe71b04a0b9fab1551`
- message: `fix(play): ignore empty cap intervals`
- exact paths: the same production module and test only.

Both commits were made with `lisa commit-ticket`, ticket ID `T-082-02-01`, and two exact repeated
`--include` paths. Commit path inspection found no unrelated file. The ordinary Git index is empty
and both ticket-owned source paths are clean.

## Concurrent-work review

Sibling `T-082-01-02` changed and committed cast-settlement files while this ticket was active. The
shared branch shows its commits between this ticket's two commits. No sibling path was included in
either capacity commit. Its completion is compatible with this module because both consume the
already-settled `capWindowExhausted` record shape from dependency `T-082-01-01`.

Lisa-managed ticket/provenance and shared work paths remain outside this ticket's source ownership.
They were not staged or committed by either ticket transaction.

## Honest boundaries and limitations

- A lane needs at least two valid cap observations with positive intervening burn before it learns.
- A fresh or marker-poor real ledger therefore remains intentionally dormant and explicitly
  unlearned.
- Adjacent positive-burn cap intervals are treated as observed reset-window samples. There is no
  provider-published reset schedule or quota constant.
- Empty repeated 429 markers are ignored because they do not prove that a reset occurred.
- Capacity and cadence use arithmetic means; no confidence weighting, decay, or outlier model is
  claimed by this slice.
- Current fraction is ledger-as-of, not continuously wall-clock refreshed.
- Invalid timestamp evidence is omitted rather than coerced into a window.
- The dependent heat ticket still needs to consume this union, rank learned fractions, render quota
  provenance, and retain byte-compatible relative fallback for unlearned lanes.
- Wallet-side quota pricing and runtime rerouting remain explicitly out of slice.

These are declared product boundaries, not hidden acceptance gaps.

## Open concerns

No blocking concern for this ticket.

The following ticket should preserve the union narrowing and avoid treating an unlearned lane as
zero utilization. It should also use `quotaFraction` without silently clamping away observed overage.

## Acceptance checklist

- Learned capacity per reset window for each evidenced lane: pass.
- Current quota fraction for each evidenced lane: pass.
- Hand-computed fabricated-ledger assertions: pass.
- Lane with no cap evidence returns explicit unlearned: pass.
- Unlearned branch never carries a numeric quota: pass.
- Pure module with no fs/current clock/provider access: pass.
- Focused unit tests: pass.
- Full `bun run check`: pass.
- Ticket-owned source committed with exact Lisa includes: pass.
- Ticket-owned paths clean after commit: pass.

## Final assessment

The new leaf module converts complete local cap markers, lane attribution, canonical weighted burn,
and recorded settlement time into a typed learned-or-unlearned per-lane fact. It satisfies P7
without inventing quota and stays local-first under P5. The ticket is ready for Lisa completion and
for `T-082-02-02` to integrate the learned fraction into lane heat.
