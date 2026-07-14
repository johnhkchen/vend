# Progress — T-069-01-03

## Current state

- Research complete.
- Design complete.
- Structure complete.
- Plan complete.
- Implementation complete.
- Focused verification complete and green.
- Full repository gate complete and green.
- Review is the only remaining phase artifact.

## Phase artifacts written

- `research.md` maps the story boundary, chain shell, input contract, addon boundary, and tests.
- `design.md` evaluates direct threading, helper extraction, full-chain invocation, early validation,
  and cast-option transport.
- `structure.md` fixes the file inventory, public interface, adapter boundary, test shape, and ordering.
- `plan.md` sequences implementation, focused verification, full gate, review, and safe commits.
- This `progress.md` records execution against that plan.

## Implementation unit 1 — public option

Modified `src/play/chain-propose-decompose.ts`.

Added to `ChainProposeDecomposeOptions`:

```ts
readonly agent?: string;
```

The accompanying documentation establishes:

- the field is a Lisa executor-routing seat;
- it applies to every ticket minted by the gesture;
- it travels through the decompose step;
- downstream effect logic validates and applies it;
- the proposal step does not consume ticket-routing metadata.

The property is optional, so existing callers remain source-compatible.

## Implementation unit 2 — decompose adapter

Modified only the second `PlayStep` adapter.

The `assembleInputs` source object now contains:

```ts
agent: opts.agent
```

alongside the existing epic path, project root, and `after` values.

Unchanged behavior:

- the chain still contains two steps;
- proposal input assembly is unchanged;
- budget defaults and overrides are unchanged;
- the upstream thread remains the minted epic path;
- the decompose run-log subject remains derived from that path;
- model, intervention, and transcript options are unchanged;
- no validation was added at this transport seam.

## Implementation unit 3 — addon-free thread test

Modified `src/play/chain-propose-decompose.test.ts`.

Added a type-only import of `ChainProposeDecomposeOptions`.

- It is erased at runtime.
- The test still does not value-import the native-addon-bearing chain module.
- The existing BAML imports remain type-only.

Updated the file's offline-proof header to name the new link:

- optional chain agent reaches assembled decompose inputs;
- omission remains absent.

Added test:

```text
the chain agent option threads only into the assembled decompose inputs
```

The test:

1. creates a temporary project root;
2. seeds the real charter path through the existing helper;
3. writes a small epic fixture;
4. constructs typed chain options with `agent: "codex"`;
5. mirrors the production step-two adapter;
6. observes `DecomposeInputs.agent === "codex"`;
7. observes an owned `agent` property;
8. constructs typed chain options without `agent`;
9. mirrors the same adapter;
10. observes `undefined` access;
11. observes no own `agent` property;
12. compares the bare object to the legacy `epic`, `charter`, `project` shape;
13. cleans the temporary root in `finally`.

## Focused verification

Executed:

```bash
bun test src/play/chain-propose-decompose.test.ts src/play/agent-seat.test.ts
```

Result:

- 7 tests passed.
- 0 tests failed.
- 34 expectations ran.
- The new chain thread test passed.
- The dependency's known-seat test passed.
- The dependency's direct supplied assembly test passed.
- The dependency's exact omission-shape test passed.
- Existing produced-path, materialization, and subject proofs passed.

## Acceptance tracking

### `agent: "codex"` reaches assembly

- Implemented in the production adapter.
- Proven in the addon-free chain thread test.
- Value assertion green.
- Own-property assertion green.

### omitted agent stays absent

- Production passes `undefined` to the dependency-provided source seam.
- `assembleInputs` normalizes omission with its conditional spread.
- Test observes no own property.
- Test observes the exact legacy key set and values.

### chain shape unchanged

- No step was added or removed.
- No step order changed.
- No engine code changed.
- No play selection changed.
- No budget code changed.
- Existing offline chain tests remain green.

## Plan deviations

No functional deviation.

The plan allowed either a local structural type or a type-only production interface import for the
test. The implementation chose the type-only import so the fixture is checked directly against the
public option contract while preserving the addon-free runtime boundary.

The supplied and omitted cases were placed in one test because they share the same temporary fixture
and together express the compatibility pair required by acceptance.

## Scope discipline

Not modified:

- CLI parsing or dispatch;
- direct `vend run decompose-epic` options;
- materializer output;
- unknown-seat validation;
- run-log outcomes;
- Lisa dispatch;
- ticket frontmatter.

Those remain assigned to later story tickets.

## Dirty-worktree boundary

The repository had concurrent/Lisa-managed changes before this work:

- `.lisa/provenance.jsonl` modified;
- active ticket files modified;
- `docs/active/epic/E-069.md` untracked;
- `docs/active/stories/S-069-01.md` untracked.

They are not part of this ticket's implementation and will not be staged by this worker.

Ticket-owned paths are limited to:

- `src/play/chain-propose-decompose.ts`;
- `src/play/chain-propose-decompose.test.ts`;
- `docs/active/work/T-069-01-03/`.

## Full repository gate

Executed:

```bash
bun run check
```

Result:

- BAML generation succeeded.
- TypeScript checking succeeded.
- 1,604 tests passed.
- 1 test was skipped by its documented dist-artifact precondition.
- 0 tests failed.
- 4,822 expectations ran.
- 109 test files completed.

`git diff --check` also completed cleanly for all ticket-owned paths before the gate.

## Remaining execution

1. Commit implementation and pre-review artifacts.
2. Write `review.md` with final test and acceptance evidence.
3. Commit the review handoff.

## Interim outcome

The requested transport behavior is implemented, focused tests are green, and the full repository
gate is green. Final completion is contingent only on the Review artifact and committed handoff.
