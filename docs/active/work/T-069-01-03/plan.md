# Plan — T-069-01-03

## Objective

Make the propose-to-decompose chain accept an optional Lisa agent seat and carry it into the
decompose step's assembled inputs, while proving addon-free that `codex` is present and omission
creates no `agent` property. Preserve every other part of the chain.

## Scope checklist

- Modify the chain option interface.
- Modify only the decompose adapter.
- Add supplied and omitted thread assertions.
- Keep the test addon-free.
- Run focused and full verification.
- Write `progress.md` and `review.md`.
- Commit the completed ticket.
- Do not edit ticket phase or status.
- Do not implement CLI dispatch.
- Do not implement materialization or validation.

## Step 1 — add the public chain option

### Edit

Open `src/play/chain-propose-decompose.ts` at `ChainProposeDecomposeOptions`.

Add:

```ts
readonly agent?: string;
```

Place it after `after` and document that:

- it is the Lisa executor-routing seat stamped on tickets;
- only the decompose step consumes it;
- downstream effect/write code validates and applies it;
- omission preserves the bare path.

### Verification

- Existing callers should remain valid because the property is optional.
- `bun run build` would typecheck the public shape, but defer to focused/full commands below.
- Inspect that no other interface field changes.

### Atomicity

This property and the adapter use form one meaningful implementation unit and should land together.

## Step 2 — thread the option into decompose assembly

### Edit

Find the second `PlayStep`'s `adapt` callback.

Add:

```ts
agent: opts.agent
```

to the `assembleInputs` source object.

Retain:

- `epicPath: upstream as string`;
- `projectRoot: root`;
- `after: opts.after`.

### Verification

- Confirm only the decompose adapter mentions the new option.
- Confirm the proposal adapter remains unchanged.
- Confirm the steps array still has exactly two entries.
- Confirm no budget, cast option, or run-log subject expression changes.

## Step 3 — add the addon-free thread proof

### Edit

Open `src/play/chain-propose-decompose.test.ts`.

Add a focused test in the existing offline-chain describe block.

The test should:

1. Create a temporary root with `seedRoot([])`.
2. Write a minimal epic file.
3. Define a structural chain option value with `agent: "codex"`.
4. Run the production-shaped decompose assembly call.
5. Assert `inputs.agent === "codex"`.
6. Assert `Object.hasOwn(inputs, "agent") === true`.
7. Define the same structural option with no `agent`.
8. Run the same production-shaped assembly call.
9. Assert `inputs.agent === undefined`.
10. Assert `Object.hasOwn(inputs, "agent") === false`.
11. Assert common assembly content remains the same.
12. Remove the temporary root in `finally`.

### Addon constraints

- Do not value-import `chain-propose-decompose.ts`.
- Do not value-import generated BAML.
- Keep existing BAML imports type-only.
- Do not invoke `castChain`, an executor, or model transport.
- Do not materialize tickets in this new test.

### Verification

Run:

```bash
bun test src/play/chain-propose-decompose.test.ts
```

Expected result:

- all existing offline chain tests pass;
- the new supplied case passes;
- the new omission case passes;
- no native-addon failure occurs.

## Step 4 — run dependency regression coverage

Run:

```bash
bun test src/play/agent-seat.test.ts src/play/chain-propose-decompose.test.ts
```

Expected result:

- the canonical seat list remains green;
- direct `assembleInputs` transport remains green;
- the chain caller seam remains green;
- omission remains an own-property absence in both relevant tests.

## Step 5 — inspect the implementation diff

Run a focused diff over:

```text
src/play/chain-propose-decompose.ts
src/play/chain-propose-decompose.test.ts
```

Check:

- one option property was added;
- one decompose assembly property was added;
- no proposal-step changes occurred;
- test imports remain addon-free;
- cleanup is guaranteed by `finally`;
- assertions cover value and shape;
- formatting matches surrounding code.

If formatting or line length is awkward, adjust only the affected expressions.

## Step 6 — record implementation progress

Create `docs/active/work/T-069-01-03/progress.md`.

Record:

- the completed RDS phases;
- files changed;
- test commands and results;
- any deviations from this plan;
- remaining work before review;
- the dirty-worktree boundary;
- acceptance status.

Do not claim the full gate is green until it has actually completed.

## Step 7 — run the repository gate

Run:

```bash
bun run check
```

This must cover:

- BAML code generation;
- TypeScript checking;
- complete Bun test suite.

If the gate fails:

1. Determine whether failure belongs to this diff or pre-existing concurrent work.
2. Fix in-scope defects.
3. Do not alter unrelated Lisa-managed files.
4. Re-run the focused test after any source/test adjustment.
5. Re-run `bun run check` until green or honestly report a real blocker.

## Step 8 — review acceptance directly

Inspect the final source and tests against each clause.

### Supplied seat

- Public options accept `agent: "codex"`.
- The second-step adapter passes it to `assembleInputs`.
- The addon-free test observes `DecomposeInputs.agent === "codex"`.
- The assembled object owns the key.

### Omitted seat

- Existing calls may omit `agent`.
- The adapter supplies `undefined` to the source contract.
- `assembleInputs` omits the output key.
- The addon-free test observes no own property.

### Chain shape

- Two steps remain.
- Same plays and order remain.
- Same upstream path threading remains.
- Same budget and log behavior remains.

### Scope

- No CLI edit.
- No materializer edit.
- No effect error relabel edit.
- No ticket phase/status edit.

## Step 9 — write the review handoff

Create `docs/active/work/T-069-01-03/review.md` after verification.

Include:

- concise outcome;
- files created and modified;
- production behavior;
- test coverage and commands;
- acceptance-criterion evaluation;
- open concerns and limitations;
- explicit deferred story work;
- full-gate status;
- commit identity if available after the implementation commit.

Because review is itself part of done, the final artifact may be committed in a dedicated docs commit
after the implementation commit, matching the workflow's incremental-commit requirement.

## Step 10 — commit safely

The repository contains unrelated Lisa-managed changes. Stage only:

```text
src/play/chain-propose-decompose.ts
src/play/chain-propose-decompose.test.ts
docs/active/work/T-069-01-03/*.md
```

Do not stage:

- `.lisa/provenance.jsonl`;
- active ticket files;
- the untracked epic or story unless they become tracked independently by their owner.

Suggested commit structure:

1. Implementation plus Research/Design/Structure/Plan/Progress:
   `feat(play): thread agent through chain gesture (T-069-01-03)`
2. Review handoff:
   `docs(T-069-01-03): complete review handoff`

The pre-commit hook must run normally. Do not bypass it.

## Testing matrix

| Concern | Test surface | Expected observation |
|---|---|---|
| Supplied chain seat | offline chain thread test | `agent === "codex"`, own key |
| Omitted chain seat | offline chain thread test | `undefined`, no own key |
| Direct assembly contract | agent-seat test | dependency behavior remains green |
| Existing epic path thread | chain thread test | exact minted epic still read |
| Existing materialize proof | chain thread test | stories/tickets still materialize |
| Existing subject proof | chain thread test | minted epic id still derived |
| Type compatibility | `bun run check` | TypeScript succeeds |
| Repository regression | `bun run check` | full suite succeeds |

## Stop conditions

- Stop implementation expansion if it requires CLI or materializer changes; those are later tickets.
- Stop and document if the dependency-provided `agent` fields are absent; they are currently present.
- Stop and document if the full gate exposes an unrelated concurrent failure that cannot be resolved
  without touching another ticket's work.
- Otherwise continue through Review without pausing between phases, as requested.

## Definition of done

- Production chain option and adapter are implemented.
- Addon-free supplied/omitted proof passes.
- Full repository gate is green.
- All six RDSPI artifacts exist.
- `review.md` honestly summarizes changes, coverage, and open concerns.
- Ticket-owned work is committed.
- Ticket phase and status remain untouched by this worker.
