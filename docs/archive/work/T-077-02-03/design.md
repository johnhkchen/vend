# Design — T-077-02-03 advances-cite-degrades

## Decision summary

Make decompose normalization charter-aware while preserving the bounds gate as a defense-in-depth
refusal for callers that bypass normalization.

The implementation will:

1. let a `Play.parse` callback receive the already-assembled `CastContext<I>` as a second argument;
2. extend `stripNonGoalAdvances` with an optional charter argument;
3. when a charter is supplied, snapshot it once and use `classifyCharterCite` to strip unresolved,
   well-shaped charter codes in addition to N-shaped non-goal entries;
4. wire the production decompose parse hook with `ctx.inputs.charter`;
5. retain the current N-only behavior for callers that omit the charter;
6. keep `boundsGate` behavior unchanged for direct unnormalized plans;
7. prove normalize → clear behavior, including the empty-after-strip value refusal.

## Design goals

- A dangling editorial code must not discard an otherwise valid board.
- Both gates and effect must receive the normalized plan.
- Custom local charters must work; Vend's P1–P7 set cannot be hardcoded.
- Existing one-argument parse functions must remain source-compatible.
- Existing free-text `advances` values must retain their current behavior.
- N-shaped non-goal stripping must remain available to legacy/direct core callers.
- A ticket with no surviving value claim must still refuse.
- Direct callers of `clear` must retain bounds diagnostics.
- The core transformation must remain pure and non-mutating.
- RunRecord surfacing must remain reserved for `T-077-02-04`.

## Option 1 — weaken or remove the dangling branch in `boundsGate`

This would make a plan containing `advances: [P9]` clear without normalization.

Advantages:

- very small source change;
- no parse-context seam required;
- direct gate fixtures would stop failing.

Rejected because:

- the code would materialize unchanged, contrary to the requirement to strip/annotate it;
- direct callers would lose the charter defect backstop;
- a ticket containing only a dangling code would appear to advance something and evade the value
  gate;
- it changes the contract of bounds rather than fixing the production ordering boundary;
- it makes eventual degrade provenance harder because no transformation occurs.

## Option 2 — normalize inside `gates`

The decompose gates callback could call a charter-aware normalizer and pass only that derived plan to
`clear`.

Advantages:

- charter is already available in `CastContext`;
- no generic play-contract change;
- the bounds STOP would disappear on the gated path.

Rejected because:

- the cast loop would retain the original parsed output;
- the effect would then materialize the original dangling code after gates clear;
- mutating the original plan from the gate callback would violate pure-core conventions;
- the gate callback would become both transformer and judge, obscuring the single-output flow.

## Option 3 — close over charter in module state

`render(inputs)` could cache the charter and `parse(text)` could consume it later.

Advantages:

- avoids changing `Play.parse`;
- production normalization would happen before gates and effect.

Rejected because:

- hidden mutable module state violates the pure data-flow model;
- concurrent casts could resolve against the wrong charter;
- retries or direct parse calls could see stale or absent state;
- tests would need ordering/reset discipline;
- local-first does not justify process-global coupling.

## Option 4 — hardcode recognized charter codes in the normalizer

The normalizer could strip P-shaped values outside P1–P7.

Advantages:

- no context seam;
- easy to test against Vend's current charter.

Rejected because:

- charters are authored project state, not a Vend constant;
- kitchen and future templates use prefix-generic codes such as K1;
- charter amendments would silently drift from the hardcoded set;
- it bypasses the predecessor's canonical snapshot/classifier contract.

## Option 5 — pass cast context to `parse` and normalize there

Change the callback contract from `(text) => O` to `(text, ctx) => O`, have the cast pass its
already-built context, and let decompose use the charter from typed inputs.

Advantages:

- preserves parse as the single normalization boundary;
- the same normalized output reaches both gates and effect;
- uses explicit typed data flow rather than hidden state;
- existing parse callbacks can ignore the additional argument;
- supports project-specific charters;
- allows future parse-time normalization to use other immutable run inputs when warranted.

Cost:

- touches the generic play contract and its single cast invocation;
- requires comments to state that parse includes deterministic normalization, not only SAP parsing;
- future callers constructing a `Play` see a context-capable callback signature.

Chosen because it is the smallest honest seam that satisfies production behavior without mutation or
hardcoding. The cast already creates the context; this only makes it available at the phase that
needs it.

## Normalization semantics

### Charter omitted

`stripNonGoalAdvances(plan)` preserves the established behavior:

- strip every trimmed `N\d+` entry;
- retain all other entries;
- leave empty arrays empty for the value gate;
- never mutate input.

This compatibility path protects existing direct core callers and tests.

### Charter supplied

`stripNonGoalAdvances(plan, charter)` will:

1. build one snapshot with `snapshotCharterCodes(charter)`;
2. inspect every ticket claim in declaration order;
3. strip N-shaped claims unconditionally because advancing a non-goal is incoherent even when its
   definition resolves in the charter;
4. classify every remaining claim with action `strip` and a nonblank advances location;
5. strip only classifications returned as `degradable`;
6. retain `resolvable` classifications;
7. retain `structural` classifications so existing value/shape semantics remain authoritative.

Calling the shared classifier on prose yields `structural/invalid-code`; retaining that result keeps
free-text `advances` unchanged. A blank entry is likewise retained so the value gate can name the
existing structural/value defect rather than normalization silently deleting evidence.

### Why N-codes are special

An N-code usually resolves in the charter, so generic resolution alone would retain it. The existing
semantic rule is stronger: non-goals can be respected but cannot be advanced. The N-shape strip must
therefore run before the generic snapshot classification.

### Allocation and identity

- The function remains pure.
- It returns a new top-level plan, matching current behavior.
- A ticket is copied only if at least one claim is stripped.
- An untouched ticket preserves object identity.
- Input arrays are never modified.
- Multiple occurrences are evaluated independently.

## Bounds-gate decision

Do not change the executable bounds rules.

- A direct `clear(planWithP9, ctx)` still STOPs at bounds.
- A direct `clear(planWithN1, ctx)` still STOPs at bounds.
- A production-normalized plan no longer contains either editorial cite.
- This demonstrates that refusal is reserved by the boundary, not globally erased.
- Existing free-text handling remains unchanged.

Update comments only as needed to explain that normalization now covers both non-goals and dangling
well-shaped charter codes.

## Empty-after-normalize decision

Do not pad, infer, or replace `advances`.

For a ticket containing only `P9` against a charter without P9:

1. normalization returns `advances: []`;
2. `clear` runs value first;
3. value returns STOP with the existing empty-advances reason;
4. bounds never gets a chance to reinterpret the absence.

This is the required structural/value distinction: the editorial cite degrades, but a unit that
ultimately names no purpose anchor remains unworthy to allocate.

## Degrade-disposition boundary

This ticket will invoke the shared classifier so the editorial/structural distinction is canonical.
It will not add dispositions to `WorkPlan`, `EffectResult`, `RunRecord`, or cast summaries.

Reasons:

- the ticket acceptance asks for normalization and gate outcome, not durable presentation;
- successor `T-077-02-04` explicitly owns record and summary surfacing;
- inventing a metadata carrier in this parallel ticket would overlap the successor's integration
  decision;
- the normalization behavior remains reconstructable and the classifier invocation establishes the
  correct semantic basis.

The strip action is nevertheless explicit at the classifier call, and the location should identify
the ticket's `advances` occurrence so the successor can reuse the same convention if it later
captures the returned classification.

## Test design

Extend the addon-free decompose core suite with:

- known charter codes remain;
- a mixed known/dangling list loses only the dangling code;
- a dangling-only list becomes empty;
- prefix-generic custom charter codes resolve correctly;
- unknown prefix-generic codes strip;
- free-text and blank structural claims remain for existing gates;
- charter-aware normalization remains non-mutating;
- the legacy no-charter N-strip behavior remains pinned.

Extend the pure gate suite with composed fixtures:

- normalize a mixed known/dangling plan, then `clear`, and observe CLEAR;
- normalize a dangling-only plan, then `clear`, and observe VALUE STOP;
- retain the direct unnormalized dangling fixture as a BOUNDS STOP.

The full repository gate will prove all existing one-argument parse callbacks remain compatible and
that no generated BAML or unrelated behavior changed.

## Scope exclusions

- no change to inline prose rendering or `BareCodeError`;
- no change to materialization/effect result shapes;
- no run-log or summary field;
- no graph/story/structural-gate weakening;
- no repair or regeneration loop;
- no charter amendment;
- no change to ticket frontmatter managed by Lisa.
