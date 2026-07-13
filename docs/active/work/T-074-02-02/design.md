# Design — T-074-02-02 wire counter-time underfunding warning

## Decision summary

Add one addon-free funding-counter module that:

1. derives the play's shelf row from the current run records;
2. returns no warning unless the row is measured;
3. delegates the severe mismatch decision to `underfundingWarning`;
4. loads the project-local run log in its impure wrapper;
5. writes a non-null warning before invoking a supplied cast callback;
6. invokes that callback unconditionally and returns its result unchanged.

Wire `dispatch.runPlay` and the direct `vend steer` branch through this wrapper. The press
inherits the behavior because it already calls `runPlay`.

## Option 1 — duplicate warning logic at each CLI gesture

Each of the selection, named run, and steer branches could load the ledger, recalibrate,
print, and continue.

Advantages:

- no new abstraction;
- call-site ordering is visually obvious.

Costs:

- three copies of provenance gating and output behavior;
- selection would duplicate logic already reachable through `runPlay`;
- future play gestures could omit the policy;
- tests would need subprocess or global stdout interception;
- byte-identical silence would be harder to keep consistent.

Rejected because the story names one shared funding-counter seam and the code already has a
partial convergence point.

## Option 2 — put everything directly in `dispatch.runPlay`

`runPlay` could load records, call `shelfRows`, print, and then call `assembleAndCast`.

Advantages:

- minimal production edit for named run and selection;
- warning naturally follows successful registry lookup;
- dispatch ordering is obvious.

Costs:

- Steer still bypasses `runPlay` today;
- importing `dispatch.ts` in a test loads the BAML addon;
- proving “warn before dispatch and still proceed” would remain indirect;
- generalizing `runPlay` to accept every play's distinct inputs is larger than this ticket.

Rejected as the sole design. `runPlay` should consume the counter primitive, not own all of
its policy and I/O.

## Option 3 — route Steer through generalized named dispatch

Expand `runPlay` into a generic dispatcher capable of assembling Decompose, Steer, and future
play-specific inputs.

Advantages:

- one named dispatch entry for all plays;
- story prose becomes literally true.

Costs:

- the current `RunOptions` requires an epic path and is decompose-specific;
- assembly is intentionally owned by each concrete play module;
- a generic input union or registry-level assembler is architectural work beyond warning wiring;
- it risks touching multiple play contracts and registration loading;
- it expands test risk around the native addon.

Rejected as scope expansion. The shared funding counter does not require redesigning play input
assembly.

## Option 4 — shared addon-free callback wrapper

Create `src/shelf/funding-counter.ts` with a pure decision function and an impure orchestration
function. The orchestration function accepts a cast callback.

Advantages:

- both existing dispatch shapes can use it without API redesign;
- the wrapper can be tested without BAML or an executor;
- callback event capture proves exact warning/dispatch order;
- unconditional callback invocation proves warn-don't-block;
- it centralizes project-local ledger loading and stdout behavior;
- silent cases naturally perform no writes;
- press gains behavior through its existing `runPlay` call.

Costs:

- one new module and test file;
- the generic callback must remain narrow to avoid becoming a second dispatcher;
- the direct steer CLI still has a play-specific branch, though its counter behavior is shared.

Chosen. It is the smallest change that makes the acceptance behavior both shared and directly
verifiable.

## Pure decision

The module will expose a function conceptually shaped as:

```ts
fundingWarningFor(play, funded, records): string | null
```

It will call `shelfRows([play], records)` and inspect the sole row:

- `confidence.kind === "default"` returns `null`;
- `confidence.kind === "measured"` calls
  `underfundingWarning(funded, row.envelope)`.

This keeps provenance outside the predecessor core while reusing the canonical shelf-derived
floor. It does not call `recalibrate` directly and does not reproduce rarity mapping.

## Impure counter wrapper

The wrapper will be conceptually shaped as:

```ts
withFundingCounter(play, funded, cast, options?): Promise<T>
```

Default behavior:

1. resolve `projectRoot ?? process.cwd()`;
2. load `join(root, DEFAULT_RUN_LOG_PATH)`;
3. compute `fundingWarningFor`;
4. if non-null, write `${warning}\n` to stdout;
5. await and return `cast()`.

The wrapper does not catch cast failures or transform cast results. It is advisory only.

## Test seam

Options will allow already-read records and a writer callback to be supplied for tests. This is
dependency injection for the two effects, not policy configuration:

- `records` bypasses filesystem loading;
- `write` captures the emitted warning.

Production callers omit both and receive canonical behavior. The warning threshold, formatter,
and measured floor remain non-configurable at this boundary.

The writer may be synchronous because `process.stdout.write` is the current CLI convention. The
write is called before `cast()` in program order.

## Dispatch wiring

`runPlay` keeps registry miss behavior byte-identical:

1. look up the play;
2. return `no-play` immediately on miss;
3. on hit, call `withFundingCounter`;
4. inside its callback call `assembleAndCast`;
5. wrap the returned summary as `{ kind: "ran" }`.

This prevents an unknown play from reading the ledger or printing any warning.

The project root passed to the counter is `opts.projectRoot`, matching cast assembly.

## Steer wiring

The CLI's existing steer branch keeps:

- its lazy import;
- its explicit/default budget choice;
- its existing explicit-budget funding echo;
- its `castSteer` implementation;
- its summary and exit behavior.

Only the cast expression changes to:

```ts
withFundingCounter(steerProjectPlay, budget, () => castSteer({ budget }))
```

The existing funding echo therefore remains first. A warning, when any, follows and precedes
the executor-backed cast.

## Press behavior

No separate counter read or print is added to `press.ts`. Each planned run already calls
`runPlay`, so each selected cast independently compares its funded budget against the selected
play's current measured floor immediately before that dispatch.

This also avoids one warning being incorrectly shared across multiple selected runs.

## Byte identity

Cold start:

- `shelfRows` yields default confidence;
- decision returns `null`;
- writer is not called;
- callback receives the exact same budget and executes as before.

Adequate funding:

- measured row is allowed through to `underfundingWarning`;
- it returns `null`;
- writer is not called;
- callback executes unchanged.

Unknown named play:

- registry miss returns before the counter;
- existing output and exit behavior remain unchanged.

## Failure semantics

- A non-ENOENT ledger read error remains a real filesystem failure and propagates.
- A missing ledger is canonical cold start and is silent.
- A warning write uses the same stdout mechanism as the rest of the CLI.
- A cast failure/rejection propagates exactly as before.
- No warning result can block or skip the callback.

## Acceptance proof

Focused tests will pin:

- field-report measured history plus 12.5k funding emits the exact warning;
- event order is `warning`, then `dispatch`;
- callback result is returned unchanged;
- cold start emits no bytes and dispatches;
- below-measurement-threshold history emits no bytes and dispatches;
- adequately funded measured history emits no bytes and dispatches;
- records for another play cannot cause a warning;
- funded budget supplied to the callback remains caller-owned and unchanged.

The full repository gate remains the final regression proof.
