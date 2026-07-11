# Progress — T-069-01-05

## Status

Implementation is complete. Focused parser verification and the full repository gate are green.
The implementation commit remains before Review.

## Completed work

### Step 1 — parsed command contract

Completed in `src/cli.ts`.

- Added `agent?: string` to the run command variant.
- Added `agent?: string` to the chain command variant.
- Documented the value as raw Lisa executor-routing metadata.
- Kept the field distinct from present-layer `--seat` and its `Seat` type.

### Step 2 — usage surface

Completed in `src/cli.ts`.

- Added `[--agent <seat>]` to the `vend run` usage line.
- Added `[--agent <seat>]` to the `vend chain` usage line.
- Changed no other usage lines.

### Step 3 — chain parsing

Completed in `src/cli.ts`.

- Added a local optional agent accumulator.
- Recognized `--agent` before positional signal fallback.
- Consumed the following raw token as the seat.
- Returned the exact `missing --agent <seat>` usage error when missing or flag-shaped.
- Conditionally included the property so omission keeps the existing object shape.
- Left budget, after, and multi-word signal behavior unchanged.

### Step 4 — run parsing

Completed in `src/cli.ts`.

- Extended the existing optional-value scan to recognize `--agent` beside `--after`.
- Preserved repeatable/comma-separated after behavior.
- Applied the same missing/flag-shaped value guard.
- Conditionally included the raw agent property.
- Left required budget, gate, intervention, and generic play-name behavior unchanged.

### Step 5 — chain dispatch

Completed in `src/cli.ts`.

- Passed `parsed.agent` to `castProposeDecomposeChain`.
- Kept lazy loading, result rendering, halt reporting, and exit behavior unchanged.

### Step 6 — run dispatch

Completed in `src/cli.ts`.

- Passed `parsed.agent` to generic `runPlay` dispatch.
- Kept all existing run options and registry behavior unchanged.

### Step 7 — focused tests

Completed in `src/cli.test.ts`.

Added coverage for:

- `chain sig --agent codex` parsed transport;
- `run decompose-epic e.md --budget 1,2 --agent codex` parsed transport;
- dangling chain agent;
- chain agent followed by another flag;
- dangling run agent;
- agent help text on the run line;
- agent help text on the chain line.

Existing exact-equality tests continue proving no agent property is added when the flag is omitted.

## Focused verification

Command:

```bash
bun test src/cli.test.ts
```

Result:

```text
104 pass
0 fail
145 expect() calls
Ran 104 tests across 1 file.
```

The focused suite remained addon-free and completed successfully.

## Diff inspection

`git diff --check` is clean.

The implementation diff currently contains:

```text
src/cli.test.ts | 32 insertions
src/cli.ts      | 45 lines changed
```

The source diff was inspected for:

- unrelated formatting;
- accidental changes to `--seat`;
- CLI-level seat validation;
- unconditional parsed fields;
- missing run or chain dispatch;
- exact error and help text.

No such issue was found.

## Deviations from Plan

No behavioral or structural deviation.

The run parser's optional-value loop was changed from an after-only `continue` pattern to explicit
`--after` and `--agent` branches, as anticipated by Design and Structure. All other tokens retain
the existing ignored-by-this-loop behavior.

No new module or shared parser helper was introduced.

## Files modified

- `src/cli.ts`;
- `src/cli.test.ts`.

## Work artifacts completed

- `research.md`;
- `design.md`;
- `structure.md`;
- `plan.md`;
- this `progress.md`.

## Full repository gate

Command:

```bash
bun run check
```

Result:

```text
BAML generation: passed
TypeScript typecheck: passed
1615 pass
1 skip (documented dist/ integration test; no dist artifacts)
0 fail
4863 expect() calls
Ran 1616 tests across 110 files.
```

The gate confirms both new dispatch properties typecheck against the dependency-provided option
interfaces and the complete repository suite remains green.

## Remaining

1. Stage only ticket-owned paths.
2. Commit the implementation unit without bypassing hooks.
3. Write `review.md` with acceptance, coverage, and open-concern assessment.
4. Commit the review handoff if repository convention permits.

## Shared-worktree protection

The following unrelated Lisa/board state remains outside this ticket and will not be staged:

- `.lisa/provenance.jsonl`;
- `docs/active/tickets/T-069-01-01.md` through `T-069-01-05.md` frontmatter changes;
- untracked `docs/active/epic/E-069.md`;
- untracked `docs/active/stories/S-069-01.md`.

The ticket's phase and status fields have not been manually changed.
