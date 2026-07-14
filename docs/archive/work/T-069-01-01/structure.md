# Structure — T-069-01-01

## Change inventory

### Create

- `src/play/agent-seat.ts`
- `src/play/agent-seat.test.ts`
- `docs/active/work/T-069-01-01/research.md`
- `docs/active/work/T-069-01-01/design.md`
- `docs/active/work/T-069-01-01/structure.md`
- `docs/active/work/T-069-01-01/plan.md`
- `docs/active/work/T-069-01-01/progress.md`
- `docs/active/work/T-069-01-01/review.md`

### Modify

- `src/play/project-context.ts`

### Delete

- Nothing.

### Explicitly untouched

- `src/play/materialize.ts`
- `src/play/decompose-epic.ts`
- `src/play/chain-propose-decompose.ts`
- `src/log/run-log.ts`
- `src/cli.ts`
- `src/executor/**`
- BAML source/generated files
- Lisa dispatch/configuration
- Ticket phase/status frontmatter

## Module boundary: `src/play/agent-seat.ts`

### Responsibility

Own the canonical Lisa executor-seat vocabulary used by board-writing play flows and expose the pure
membership oracle downstream tickets will compose at their effect boundaries.

### Dependencies

- No imports.
- No filesystem.
- No process/environment access.
- No BAML.
- No native addon.
- No clock/network.

### Public values

```ts
export const KNOWN_SEATS = ["claude", "codex"] as const;
```

Properties:

- Runtime iterable list.
- Exact order is stable.
- Literal element types are preserved.
- This is the only seat list introduced by the ticket.

### Public types

```ts
export type AgentSeat = (typeof KNOWN_SEATS)[number];
```

Properties:

- Resolves to `"claude" | "codex"`.
- Derived from the runtime constant.
- Available to later consumers after validation.
- Not used to falsely type untrusted transport fields.

### Public functions

```ts
export function findUnknownSeat(seat: string): string | null;
```

Behavior:

- Iterate/read `KNOWN_SEATS` only.
- Exact string equality.
- Return `null` for a known seat.
- Return the original string for an unknown seat.
- Never mutate inputs or module state.
- Never throw for a string input.

### Internal organization

1. File-level contract/purity comment.
2. `KNOWN_SEATS` declaration.
3. `AgentSeat` derived type.
4. Function documentation.
5. `findUnknownSeat` implementation.

No helper is needed for a two-element scan.

## Module changes: `src/play/project-context.ts`

### Header contract

Adjust the purity/testing comment so it no longer claims `assembleInputs` has no direct test.
Keep the pure-core/impure-shell distinction intact.

### `ContextSources`

Append this field after `after`:

```ts
readonly agent?: string;
```

Documentation must state:

- It is the Lisa executor-routing seat for tickets minted by the gesture.
- It is passed through to `DecomposeInputs`.
- Validation and application belong to the effect.
- Absence leaves the assembled input unchanged.

### `DecomposeInputs`

Append this field after `after`:

```ts
readonly agent?: string;
```

Documentation must state:

- It is effect-only routing metadata.
- It is not consumed by render/gates.
- It is absent when no flag/value was supplied.

### `assembleInputs`

Preserve all existing reads and snapshot assembly.

Extend only the returned object:

```ts
return {
  epic,
  charter,
  project,
  ...(src.after && src.after.length ? { after: src.after } : {}),
  ...(src.agent !== undefined ? { agent: src.agent } : {}),
};
```

Ordering implications:

- Existing three required keys remain first and unchanged.
- Existing `after` behavior remains unchanged.
- New `agent` key is last when present.
- No new key exists when absent.

No import from `agent-seat.ts` is needed in this module because assembly transports arbitrary text and
does not validate it.

## Test boundary: `src/play/agent-seat.test.ts`

### Imports

- `describe`, `expect`, `test` from `bun:test`.
- Temp filesystem helpers from `node:fs/promises`.
- `tmpdir` from `node:os`.
- `join` from `node:path`.
- `KNOWN_SEATS`, `findUnknownSeat` from `./agent-seat.ts`.
- `CHARTER_PATH`, `assembleInputs` from `./project-context.ts`.

### Test group 1: seat contract

Test name communicates single vocabulary + unknown oracle.

Assertions:

- `KNOWN_SEATS` deeply equals `[
  "claude",
  "codex",
]` (formatted normally in code).
- `findUnknownSeat("gpt")` is `"gpt"`.
- `findUnknownSeat("claude")` is null.
- `findUnknownSeat("codex")` is null.

### Test fixture helper

Create a small helper that:

- makes a unique temp root;
- creates the charter parent directory;
- writes an epic file at the root or a temp board path;
- writes a minimal charter at `join(root, CHARTER_PATH)`;
- returns `{ root, epicPath }`;
- lets each async test remove the root in `finally`.

Missing `src` and board directories intentionally exercise existing honest-empty behavior.

### Test group 2: assembly presence

Call:

```ts
assembleInputs({ epicPath, projectRoot: root, agent: "codex" })
```

Assert:

- `.agent === "codex"`.
- The returned object owns the `agent` property.
- Required strings equal the fixture/snapshot outputs as appropriate.

### Test group 3: assembly absence

Call:

```ts
assembleInputs({ epicPath, projectRoot: root })
```

Assert:

- `.agent === undefined`.
- `Object.hasOwn(result, "agent") === false`.
- The object exactly equals `{ epic, charter, project }`.
- The expected snapshot comes from `buildProjectSnapshot` or a fixed deterministic value.

The exact-object assertion is the byte-identical shape proof.

## Artifact boundary

- `research.md`: descriptive map and constraints.
- `design.md`: alternatives and chosen behavior.
- `structure.md`: this file-level blueprint.
- `plan.md`: ordered implementation/verification steps.
- `progress.md`: live execution record and deviations.
- `review.md`: final handoff, coverage, and concerns.

All artifacts belong only to this ticket directory. They do not alter board state.

## Dependency graph after the change

```text
agent-seat.test.ts ──> agent-seat.ts
        │
        └────────────> project-context.ts ──> node:fs/promises, node:path

future materialize.ts ──> agent-seat.ts
future chain/CLI consumers ──> project-context.ts input fields
```

There is no reverse import and no cycle.

## Change ordering

1. Add contract test and implementation together as one pure unit.
2. Add assembly test expectations and input pass-through together.
3. Run focused test.
4. Run typecheck.
5. Record progress.
6. Run full repository gate.
7. Write review.
8. Commit code, tests, and all ticket artifacts without staging Lisa-owned board inputs.

## Structural acceptance mapping

- `KNOWN_SEATS`: one exported tuple in `agent-seat.ts`.
- `findUnknownSeat`: same module, direct tuple consumption.
- Optional source field: `ContextSources.agent`.
- Optional assembled field: `DecomposeInputs.agent`.
- Presence transport: conditional spread in `assembleInputs`.
- Absence shape: no spread when `undefined`.
- Addon-free test: new colocated test imports no BAML-bearing module.
- Downstream stability: no changes to the later ticket-owned consumers.
