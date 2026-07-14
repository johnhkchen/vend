# Structure — T-074-02-02 wire counter-time underfunding warning

## File map

### Create `src/shelf/funding-counter.ts`

Purpose: shared funding-counter composition, independent of concrete play assembly and the BAML
addon.

Dependencies:

- value import `join` from `node:path`;
- type import `Budget`;
- type import `AnyPlay`;
- type import `RunRecord`;
- value imports `DEFAULT_RUN_LOG_PATH` and `loadRunLog`;
- value import `shelfRows`;
- value import `underfundingWarning`.

Exports:

```ts
export function fundingWarningFor(
  play: AnyPlay,
  funded: Budget,
  records: readonly RunRecord[],
): string | null;
```

Responsibilities:

- construct exactly one shelf row for the supplied play;
- suppress default/cold-start confidence;
- pass the measured row envelope to the settled warning core;
- perform no I/O.

Exports:

```ts
export interface FundingCounterOptions {
  readonly projectRoot?: string;
  readonly records?: readonly RunRecord[];
  readonly write?: (text: string) => void;
}

export async function withFundingCounter<T>(
  play: AnyPlay,
  funded: Budget,
  cast: () => Promise<T>,
  opts?: FundingCounterOptions,
): Promise<T>;
```

Responsibilities:

- load the project-local ledger unless records were supplied;
- compute the optional warning;
- write exactly one newline-terminated warning when non-null;
- invoke the cast callback after the write;
- return the callback's result unchanged.

Non-responsibilities:

- choosing a budget;
- mutating a budget;
- setting thresholds or formatting warning quantities;
- assembling concrete play inputs;
- looking up registry entries;
- interpreting cast outcomes;
- catching executor failures.

### Create `src/shelf/funding-counter.test.ts`

Purpose: addon-free behavioral proof for provenance, output, ordering, and proceed semantics.

Fixtures:

- a valid `Play<unknown, unknown>` stub;
- a `recordOf` helper using `buildRunRecord`;
- measured records with at least three successes;
- event arrays capturing writer and callback calls.

Test groups:

1. pure measured-floor decision;
2. cold-start silence;
3. adequate-funding silence;
4. field-report exact output;
5. warning-before-callback ordering;
6. callback result passthrough;
7. per-play record isolation;
8. funded input immutability/reference preservation where observable.

The test must not import `dispatch.ts`, `steer.ts`, or any BAML client.

### Modify `src/play/dispatch.ts`

Add a value import of `withFundingCounter`.

Change only the registry-hit arm of `runPlay`:

```text
registry lookup
  ├─ miss → existing no-play result
  └─ hit → withFundingCounter
               └─ assembleAndCast callback
```

The callback closes over the same `lookup.play` and `opts` used today. `opts.budget` is the
funded allocation and `opts.projectRoot` locates the ledger.

No changes to:

- `DispatchResult`;
- registry miss shape;
- `RunOptions`;
- `assembleAndCast`;
- summary wrapping.

### Modify `src/cli.ts`

Touch only the `parsed.cmd === "steer"` branch.

Extend its lazy import set with the addon-free counter module, or perform a second lazy import in
that branch. Retain the existing `steer.ts` lazy import.

Preserve this order:

```text
resolve funded budget
optional existing funding echo
shared funding counter
  optional warning
  castSteer callback
summary line
exit
```

No changes to argument parsing, help text, other commands, funding echo formatting, or exit codes.

### No change to `src/shelf/press.ts`

The press already calls `runPlay` once per planned run. The dispatch modification is therefore
the press wiring. Leaving `press.ts` unchanged prevents duplicate ledger reads/warnings.

### No change to `src/shelf/press-core.ts`

Selection planning is unrelated to warning policy. The new module composes shelf calibration and
the warning core without adding funding concerns to menu staleness/selection decisions.

### No change to `src/shelf/underfunding-core.ts`

Threshold and message shape were settled and tested by the predecessor ticket.

### No change to `src/shelf/shelf-row.ts`

It remains the canonical calibration-to-shelf adapter. The counter consumes it as-is.

### No change to `src/ledger/recalibrate.ts`

Percentiles, cold-start threshold, and provenance remain centralized there.

## Dependency direction

```text
underfunding-core     recalibrate
        \                /
         \              /
          shelf-row composition
                  |
          funding-counter
             /         \
        dispatch      CLI steer
           |             |
      press / run      castSteer
```

- The shelf counter depends on engine types, not concrete play modules.
- Concrete play modules do not depend on the shelf counter.
- `dispatch.ts` and `cli.ts` are already impure outer shells and may depend on it.
- No cycle is introduced.

## Public interface rationale

`fundingWarningFor` accepts `AnyPlay`, not a name/tier/prior tuple. This ensures the existing play
contract is the single source for name, rarity, and authored prior.

`withFundingCounter` accepts a callback rather than play-specific inputs. This preserves existing
assembly ownership and makes the counter usable across distinct gestures.

The generic result `T` ensures the wrapper cannot narrow or reinterpret a cast summary.

Optional injected records and writer exist only at the effect boundary. Production policy remains
fixed; tests do not gain a threshold override.

## Ordering invariants

Inside `withFundingCounter`:

1. record acquisition completes;
2. decision completes;
3. warning write completes synchronously when needed;
4. callback is invoked;
5. callback result is returned.

There is no conditional around step 4.

Inside `runPlay`, registry lookup precedes the counter so unknown play behavior remains unchanged.

Inside steer CLI, the existing funding echo precedes the counter so the canonical acknowledgement
stays in its current position.

## Commit units

Meaningful source unit 1:

- `src/shelf/funding-counter.ts`;
- `src/shelf/funding-counter.test.ts`.

Meaningful wiring unit 2:

- `src/play/dispatch.ts`;
- `src/cli.ts`.

Each commit will use `lisa commit-ticket --ticket T-074-02-02` and exact `--include` paths. Work
artifacts are attempt-private and are not source commit includes.

## Verification boundaries

Focused unit gate:

```bash
bun test src/shelf/funding-counter.test.ts src/shelf/underfunding-core.test.ts
```

Relevant regression gates:

```bash
bun test src/shelf/press-core.test.ts src/cli.test.ts
bun run build
```

Repository gate before each commit, per house rule:

```bash
bun run check
```

Final hygiene:

- `git diff --check` for ticket files;
- `git status --short` confirms no ticket-owned uncommitted files;
- inspect ticket commits for exact path ownership.
