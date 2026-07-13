# Design — T-080-02-02

## Design objective

Make settle's compact verdict distinguish two kinds of state that the current implementation
conflates:

1. epic history versus epic cards still awaiting closeout;
2. a measured change versus the initial capture of a future comparison baseline.

The design must retain the complete done-ticket frontier for subsequent settles while narrowing
only the operator-facing claims. It must preserve the existing pure-core / impure-shell boundary,
marker schema, atomic persistence, and all unrelated verdict fields.

## Decision criteria

- Truthfulness: every rendered claim must follow from observed current and prior state.
- Contract fidelity: status-done epics disappear; open all-done epics remain sweep-ready.
- Continuation correctness: the first successful settle seeds the full done frontier.
- Locality: changes stay inside settle and directly affected settle acceptance assertions.
- Type stability: avoid adding fields that exist only to be immediately filtered away.
- Determinism: preserve id-sorted graph and frontier ordering.
- Regression resistance: tests must cross the graph-to-core-to-render boundary.
- House architecture: pure policy remains testable without filesystem effects.

## Epic filtering options

### Option A — carry epic status into `EpicClearance` and filter in the renderer

This option adds `status` to every `EpicClearance`. `deriveEpicClearance` and
`computeSettleVerdict` would continue returning every epic. `renderSettleResult` would skip entries
whose status equals `done`.

Advantages:

- The renderer directly implements the phrase “renders only non-done epics.”
- A caller can inspect clearance for historical epics if it wants to.
- Filtering behavior can be changed without changing the derivation function.

Costs:

- The typed verdict continues to carry the same 75-card historical flood even though the sole
  consumer must discard it.
- `EpicClearance` gains board lifecycle data unrelated to clearance arithmetic.
- Any future non-terminal renderer must remember to repeat the filter.
- `allDoneEpicIds` would remain ambiguous unless separately filtered.
- The terminal renderer would be making lifecycle policy despite its contract to render already
  decided core facts.

### Option B — filter `SettleVerdict.epics` inside `computeSettleVerdict`

This option leaves `deriveEpicClearance` as a complete-board report, then filters its entries in
`computeSettleVerdict` by looking up the corresponding graph epic status.

Advantages:

- The public verdict carries only operator-relevant epic lines.
- The standalone clearance derivation retains its old complete-board meaning.
- The renderer remains a direct projection of core policy.

Costs:

- Filtering requires a second association between a clearance entry and its source epic.
- `allDoneEpicIds` needs a matching second filter to remain internally consistent.
- The core briefly computes and stores all historical epic clearance just to discard most of it.
- Two representations of “settle epic clearance” acquire different scopes.

### Option C — define settle epic clearance as non-done epic clearance

This option filters `graph.epics` by exact epic-card status before mapping containment into
`EpicClearance`. The global `doneTicketIds` frontier continues to derive independently from
`graph.tickets`.

Advantages:

- It encodes the lifecycle rule at the earliest settle-specific pure boundary.
- `epics` and `allDoneEpicIds` remain scoped together and internally consistent.
- `SettleVerdict` contains exactly the epics the renderer is allowed to claim.
- The renderer remains policy-free iteration over typed verdict facts.
- No interface or marker schema changes are needed.
- The separate flat-ticket derivation naturally preserves historical ticket ids.

Costs:

- `deriveEpicClearance` changes from complete-board epic arithmetic to active-closeout arithmetic.
- Any hypothetical external caller expecting historical epic entries would see a narrowed result.
- The helper's documentation and test title must state the new scope clearly.

### Epic filtering decision

Choose Option C.

`deriveEpicClearance` is exported, but repository search finds only settle core and its tests using
it. Its actual product is already named `EpicClearanceResult`, and in settle a status-done epic is
no longer a clearance candidate. The global frontier is intentionally calculated through a
separate path, so narrowing epic entries does not lose durable history.

The filter is an exact `epic.status !== "done"` predicate. The graph model deliberately mirrors
status strings without normalization or enum coercion. Inventing case folding or treating other
states as done would exceed the board contract.

An open epic with all contained tickets at phase `done` survives the status filter. Existing
non-vacuous `allDone` logic then marks it sweep-ready. A status-done epic disappears regardless of
its ticket phases, because its card lifecycle is authoritative for display inclusion.

## First-baseline options

### Option D — renderer-only wording change

The renderer could print `delta: first settle — no baseline` whenever `firstSettle` is true while
leaving `newlyDoneTicketIds` populated with all current done tickets.

Advantages:

- Minimal source edit.
- Human output meets the literal string contract.
- The existing full next marker remains unchanged.

Costs:

- The typed core would continue claiming historical ids as “newly done.”
- Non-terminal consumers could repeat the false delta claim.
- `SettleDelta` would be internally contradictory: first settle and measured new ids together.
- Core tests could not prove the absence of a historical ticket-id flood at the policy boundary.

### Option E — core-only delta correction

The core could return an empty `newlyDoneTicketIds` on first settle. The renderer's existing empty
branch would then print `no completed tickets`.

Advantages:

- Typed delta semantics become honest.
- The next marker remains independently full.
- Immediate repeated settle behavior stays correct.

Costs:

- The required exact explanation, `no baseline`, would not be rendered.
- “No completed tickets” is a different factual claim and is false when the board has history.

### Option F — correct both typed delta and first-settle rendering

The core returns no newly-done ids when `marker.firstSettle` is true, while always populating
`nextMarker.doneTicketIds` from the full current board frontier. The renderer prints the exact
no-baseline line for every first-settle verdict and uses ids only for repeated-settle deltas.

Advantages:

- Both typed policy and human wording tell the same truth.
- The baseline capture remains complete.
- Renderer behavior is robust even against a manually constructed contradictory fixture.
- Existing repeated-settle behavior is untouched.

Costs:

- Two coordinated source edits are required.
- Existing fixtures that intentionally combine `firstSettle: true` with ids must change.

### First-baseline decision

Choose Option F.

The computation becomes:

- if no marker exists, `firstSettle` is true and `newlyDoneTicketIds` is empty;
- if a marker exists, compare the current done frontier with the marker as before;
- in both cases, `nextMarker.doneTicketIds` is the complete current done frontier.

The renderer's first-settle branch does not inspect or join `newlyDoneTicketIds`. It emits exactly
`delta: first settle — no baseline`. The repeated branch retains the existing id list or
`none since last settle` behavior.

## Test design

### Pure core fixture

Extend the canonical graph fixture with a status-done epic containing a phase-done ticket. The
fixture will then contain:

- a hidden status-done epic;
- an open, all-tickets-done epic;
- an open partial epic;
- an open empty epic.

Assertions establish two independent scopes:

- epic clearance excludes the status-done epic and keeps the open all-done epic;
- `doneTicketIds` includes the hidden epic's done ticket.

The first-settle test asserts:

- `delta` is `{ firstSettle: true, newlyDoneTicketIds: [] }`;
- `nextMarker.doneTicketIds` contains the complete sorted done frontier, including hidden history;
- no exceptions are invented.

Prior-marker coverage includes the hidden ticket in the prior marker so the expected measured
delta remains focused on the newly completed open-epic ticket.

### Renderer unit fixture

Update the canonical manually built first-settle verdict to use an empty delta. Assert the exact
no-baseline line and retain the existing sweep-ready line for its all-done epic.

The renderer test continues to cover gate, presweep, review, exception, color, and newline output.
The immediate-repeat test remains unchanged and protects the other delta branch.

### Graph-to-render shell fixture

Extend `createSettleFixtureRoot` with:

- one status-done epic, story, and phase-done ticket;
- the existing status-open, all-done epic.

On the first `runSettle`, render the result and assert:

- the exact no-baseline delta line is present;
- the status-done epic line is absent;
- the status-open epic line is present with `sweep ready`;
- `nextMarker` carries both done ticket ids;
- persisted marker bytes carry both ids.

This fixture proves the requested behavior through real markdown loading and typed rendering while
remaining local and deterministic.

### CLI acceptance

Update the existing first-invocation expectation from a ticket-id delta to the exact no-baseline
line. Keep its persisted marker assertion and second-invocation empty-delta assertion. No CLI
fixture expansion is needed because the settle shell fixture provides the mixed epic-status proof.

## Compatibility and non-changes

- Marker version remains 1.
- Marker JSON shape remains unchanged.
- `SettleDelta` and `SettleVerdict` interfaces remain unchanged.
- `EpicClearance` remains unchanged.
- No graph model or loader changes are required.
- No filesystem or subprocess behavior changes.
- No loop marker claim/restore behavior changes.
- No gate, presweep, review, exception, or ANSI behavior changes.
- No sweep or seam source files change.
- No live board cards are edited by ticket implementation.

## Risk assessment

- Main semantic risk: accidentally filtering ticket history together with epic display. Separate
  assertions on `doneTicketIds` and `nextMarker` prevent this.
- Main display risk: inferring epic completion from tickets instead of using card status. The mixed
  fixture pins both states.
- Main regression risk: old CLI acceptance wording. Updating that direct conflict keeps the full
  suite aligned.
- Status-string risk is low because the implementation follows the graph's exact faithful-mirror
  convention.
- The work is additive in tests and subtractive in displayed claims; no migration or recovery path
  is required.

## Chosen design summary

Filter status-done epics in the pure settle clearance derivation, retain the full flat done-ticket
frontier, suppress first-settle newly-done ids, and render first settle as `no baseline`
unconditionally. Prove the separation with both pure fixture assertions and a markdown-backed
run-settle rendering test, then update the existing CLI contract assertion.
