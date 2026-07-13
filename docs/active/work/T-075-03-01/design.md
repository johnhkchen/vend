# T-075-03-01 Design — cold-start confidence count

## Decision to make

The shelf needs to preserve a successful-run count on a cold-start prior without changing
what “default” means. It also needs a type-level guarantee that zero cannot be described as
measured. The design therefore covers three related choices:

1. where the sub-threshold count comes from;
2. how the confidence union represents zero, thin, and measured histories;
3. how the renderer obtains the cold-start threshold shown in its label.

The envelope calculation itself is not a design choice in this ticket. `recalibrate` remains
the only owner of that policy.

## Option A — infer history again inside the shelf

The shelf could filter the run records and count successful outcomes itself.

Advantages:

- The count would be immediately available beside the row mapping.
- No type or API changes in `recalibrate` would be required.

Costs:

- It would duplicate `recalibrate`'s play filtering and recency-window semantics.
- A future ledger-window change could make the displayed count disagree with the count that
  actually selected the prior.
- It would violate the story's explicit statement that recalibration already carries the count.
- It would weaken the “ledger owns math” boundary in `shelf-row.ts`.

Decision: reject. The surface must display the exact evidence already reported by the ledger,
not recompute a lookalike.

## Option B — add a second recalibration API just for cold-start metadata

The ledger could expose a new helper returning the threshold and sub-threshold sample count.

Advantages:

- The shelf would receive a purpose-named structure.
- The return type could encode prior-specific metadata explicitly.

Costs:

- `RecalibrateResult.confidence.successes` already contains the exact count.
- A second helper would either repeat work or split one result across two calls.
- It expands ledger scope despite the story's “no ledger math changes” boundary.
- It creates synchronization work with no new information.

Decision: reject. No new ledger API is warranted.

## Option C — preserve `result.confidence.successes` in the shelf mapping

On the `source: "prior"` branch, map a nonzero count onto the default confidence variant.
On zero, retain the existing count-free default representation.

Advantages:

- It uses the exact count that caused the recalibration decision.
- It is a one-way composition at the existing ledger-to-shelf boundary.
- The envelope and source remain untouched.
- It keeps all work pure and deterministic.

Costs:

- The `ShelfConfidence` union must gain a thin-default state.
- The renderer needs a second default label.

Decision: choose this data flow.

## Confidence representation alternatives

### Representation 1 — one default arm with `runs?: number`

```ts
| { kind: "default"; runs?: number }
```

This is compact and would keep `{ kind: "default" }` source-compatible.

It is rejected because `runs: 0` and, under the current compiler settings, potentially
`runs: undefined` are constructable. The renderer would need conventions rather than types to
distinguish absence from invalid evidence. The ticket specifically asks the union to keep the
lie unconstructable.

### Representation 2 — count all default histories, including zero

```ts
| { kind: "default"; runs: number }
```

The renderer could branch on `runs === 0`.

It is rejected because it forces every zero-default fixture and consumer to add a count and
allows negative, fractional, or out-of-window values. More importantly, it makes “no evidence”
a numeric convention rather than a structural state.

### Representation 3 — separate zero-default and thin-default arms

```ts
| { kind: "default" }
| { kind: "default"; runs: ColdStartRunCount }
```

The shared `kind` continues to mean provenance: the envelope is still the authored default.
Presence of `runs` refines only the amount of real evidence beneath that default.

Advantages:

- Existing `{ kind: "default" }` consumers remain valid.
- A property-presence check cleanly distinguishes zero from thin history.
- Zero cannot be carried on the runs-bearing default arm.
- No extra discriminator leaks into visible vocabulary.

Decision: choose this representation for prior-sourced confidence.

## Making measured zero genuinely unconstructable

The current measured arm uses `runs: number`. A plain `number` includes zero, despite the
module comment saying measured runs are positive. Leaving that field unchanged would not meet
the acceptance criterion as written.

### Alternative 1 — nominal branded positive number

A `PositiveRunCount` brand plus a validating constructor can exclude zero for arbitrary counts.

This is rejected for this surface because direct literal fixtures in `home.test.ts` and other
consumers would no longer typecheck. Updating that concurrently owned file would violate the
story's disjoint-ticket rationale. Exporting a constructor solely for fixture compatibility
would make a small display type heavier than necessary.

### Alternative 2 — keep `number` and rely on a comment or runtime branch

This preserves compatibility but does not make measured zero unconstructable. A
`@ts-expect-error` acceptance assertion would fail because the invalid value is accepted.

Decision: reject.

### Alternative 3 — bounded literal counts derived from the ledger window

The shelf calls `recalibrate` with default options. The ledger windows at most
`DEFAULT_WINDOW` records, currently 100. A measured shelf count is therefore an integer from
`COLD_START_MIN_SUCCESSES` through `DEFAULT_WINDOW`, inclusive. A thin-default count is an
integer from 1 up to but excluding `COLD_START_MIN_SUCCESSES`.

Type-level enumeration can derive both finite literal unions from the exported ledger constants:

- `ColdStartRunCount`: `1 | 2` under today's threshold;
- `MeasuredRunCount`: `3 | 4 | ... | 100` under today's threshold/window.

Advantages:

- Literal fixtures such as `runs: 1` and `runs: 5` remain source-compatible.
- `runs: 0` fails at compile time.
- Thin counts cannot accidentally cross into the measured range.
- The type follows ledger-owned constants rather than duplicating `3` or `100`.
- The finite upper bound is grounded in the actual default recalibration window.

Costs:

- A small recursive type helper is less familiar than `number`.
- The runtime `successes` field is typed as `number`, so the mapping needs a guard to narrow it.
- A future extremely large default window could approach TypeScript recursion limits.

Decision: choose bounded literal counts. The present window is small and contractually bounds
the value, so the type expresses real codebase behavior rather than an artificial cap.

## Runtime mapping guard

`RecalibrateResult` does not correlate `source` with a narrowed numeric range. Therefore
TypeScript cannot infer that a measured result has 3–100 successes or a prior result has 0–2.

Two type predicates will narrow the count:

- `isColdStartRunCount(runs)` checks positive and below the threshold;
- `isMeasuredRunCount(runs)` checks at least the threshold and at most the window.

The mapping will use the predicates after checking `result.source`.

An out-of-contract combination from `recalibrate` should fail loudly rather than render a lie.
A private helper can throw an invariant error if a source/count pair falls outside the ledger's
default contract. Under the current pure `recalibrate` implementation this branch is unreachable.
The guard does not inspect records or redefine percentile math; it validates an imported result.

## Threshold display alternatives

### Hard-code `3` in the label

This would satisfy today's fixture but duplicate ledger policy and drift if the constant changes.

Decision: reject.

### Carry `measuredAt` on every thin confidence value

This makes the label self-contained but duplicates the same threshold across every row. It also
permits callers to construct a confidence whose threshold differs from the ledger's actual one.

Decision: reject.

### Read the exported ledger constant in `confidenceLabel`

`shelf-row.ts` already has a value dependency on the recalibration module. Importing
`COLD_START_MIN_SUCCESSES` beside `recalibrate` preserves the existing module boundary and makes
the displayed threshold follow its source of truth.

Decision: choose this approach.

## Label grammar

- Zero default: `(default — no runs yet)` unchanged.
- One thin success: `(default — 1 run, measured at 3)`.
- Two thin successes: `(default — 2 runs, measured at 3)`.
- Measured one-run rendering remains tested as a renderer fixture, although such a confidence
  will become invalid under the real threshold and that fixture must move to a valid measured
  count.
- Measured production rows remain `(measured · N runs)`.

The singular/plural rule follows the existing renderer's grammar. The acceptance's `N runs`
placeholder is interpreted as grammatical substitution, not a mandate to print “1 runs.”

## Verification decision

The focused test suite will pin:

- zero records map to count-free default and render “no runs yet”;
- one success maps to a runs-bearing default and renders the singular thin label;
- two successes map to a runs-bearing default and renders the plural thin label;
- three or more successes still map to measured;
- a measured-zero literal is rejected with `@ts-expect-error`;
- a default runs-bearing zero is also rejected, strengthening the same honesty boundary;
- prior envelopes remain the authored budget;
- existing layout and formatting tests remain green.

Then `bun run check` will run BAML generation, full typecheck, and the complete test suite.

## Chosen design summary

Preserve `recalibrate().confidence.successes` at the existing shelf boundary. Represent prior
confidence as either a count-free zero state or a bounded thin-count state. Represent measured
confidence with a bounded count derived from the ledger threshold and default window. Render the
threshold from `COLD_START_MIN_SUCCESSES`. Keep all ledger calculations and all other surfaces
unchanged.
