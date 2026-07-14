# Design — T-069-01-01

## Decision summary

Create a dedicated addon-free `src/play/agent-seat.ts` contract module exporting:

- `KNOWN_SEATS = ["claude", "codex"] as const`;
- `AgentSeat`, derived from that tuple;
- `findUnknownSeat(seat: string): string | null`.

Add `agent?: string` to both `ContextSources` and `DecomposeInputs`, and conditionally copy it in
`assembleInputs` only when it is defined. Prove the contract and pass-through in a new addon-free
`src/play/agent-seat.test.ts` using a temporary project fixture.

## Design goals

1. Establish exactly one runtime source of truth for known Lisa routing seats.
2. Give downstream write/effect tickets a pure validation oracle.
3. Give downstream callers a settled field name and source-to-input route.
4. Preserve the bare `assembleInputs` object shape exactly.
5. Keep the module importable without BAML or any native addon.
6. Avoid implementing downstream write, error, logging, chain, or CLI behavior early.

## D1 — Dedicated seat-contract module

### Choice

Place the vocabulary and membership oracle in `src/play/agent-seat.ts`.

### Rationale

- Routing seats are play/board allocation metadata, so `src/play` is the relevant domain.
- They are not executor adapter ids; `src/executor/select.ts` has a different vocabulary.
- A standalone module prevents `materialize.ts`, chain code, and CLI code from defining parallel lists.
- The module can stay pure and dependency-free.
- The location mirrors other small pure contracts such as `id-guard.ts`.
- Downstream tickets can import it without importing project-context's filesystem shell.

### Rejected: put the constant in `project-context.ts`

This would be mechanically possible, but it would make materialization depend on an impure reader
module merely to access a two-value contract. `project-context.ts` is addon-free, but its purpose is
filesystem context assembly, not routing-seat ownership. The contract deserves its own boundary.

### Rejected: put the constant in `executor/select.ts`

The executor registry contains `claude | openai-compat`; Lisa routing seats are `claude | codex`.
Merging them would falsely claim that a seat is a Vend executor adapter and would work against P6/N4.

### Rejected: define the list in `materialize.ts`

That makes the first downstream consumer the source of truth and forces other consumers to depend on
the writer. It also weakens the pure-core/impure-shell split.

## D2 — Tuple constant plus derived union type

### Choice

Declare the runtime value as:

```ts
export const KNOWN_SEATS = ["claude", "codex"] as const;
export type AgentSeat = (typeof KNOWN_SEATS)[number];
```

### Rationale

- `as const` preserves the exact ordered vocabulary at runtime and compile time.
- The type is derived rather than manually repeated.
- Downstream code that has already validated a value can use `AgentSeat`.
- Tests can assert the exact tuple and prove there is only one exported source.
- Ordering is deterministic for future error messages.

### Rejected: `Set<string>` as the exported source

A set supports membership but loses the tuple-derived literal union and is less convenient for exact
test assertions or known-values messages. A function can scan the two-element tuple cheaply.

### Rejected: enum

An enum adds generated runtime structure without benefit and would still need a separate ordered list
for messages/tests. The repository generally favors plain values and structural types.

## D3 — Pure `findUnknownSeat` oracle

### Choice

Accept an arbitrary `string`. Return `null` when it equals any member of `KNOWN_SEATS`; otherwise
return the original input unchanged.

### Contract

```ts
findUnknownSeat("claude") === null
findUnknownSeat("codex") === null
findUnknownSeat("gpt") === "gpt"
```

### Rationale

- This is exactly the ticket acceptance language.
- Returning the offending input lets downstream error construction name it without a second value.
- `null` is an unambiguous clear result and matches the `findExistingByTitle` local oracle style.
- The function is total for its declared input type.
- It performs no normalization: the vocabulary is canonical and exact.
- It performs no throwing: error policy belongs to the write/effect boundary in later tickets.

### Rejected: boolean type guard

`isKnownSeat(value): value is AgentSeat` would help narrowing, but it does not satisfy the required
`findUnknownSeat` API or return the offending value. It could be added later if genuinely needed;
adding two membership APIs now would dilute the single contract.

### Rejected: throw `UnknownSeatError` here

The parent story needs a named error eventually, but this ticket only asks for the guard and input
field. The next materialize ticket owns refusal before writes. Keeping the oracle non-throwing gives
the effect a pure decision seam and avoids preempting the later error vocabulary.

### Rejected: trim or lowercase

CLI values and frontmatter seats are identifiers, not human titles. Treating `Codex` or ` codex ` as
valid would silently expand the contract beyond `claude | codex`.

## D4 — Input fields remain `string`, not `AgentSeat`

### Choice

Add `readonly agent?: string` to `ContextSources` and `DecomposeInputs`.

### Rationale

- CLI input is untrusted text and must be able to carry an unknown value to the validation boundary.
- Typing the incoming field as `AgentSeat` would encourage unsafe casts in CLI parsing.
- The story requires an unknown runtime value to reach the guard and be refused before writing.
- Both source and assembled input describe transport, not proof of validation.
- A downstream validated local may narrow/cast to `AgentSeat` after `findUnknownSeat` returns null.

### Rejected: `agent?: AgentSeat`

This looks stricter but is dishonest at the CLI boundary: TypeScript cannot validate user input.
It would either force parsing behavior into this ticket or hide unvalidated data behind a cast.

## D5 — Presence-preserving conditional spread

### Choice

Extend the existing return object with:

```ts
...(src.agent !== undefined ? { agent: src.agent } : {})
```

### Rationale

- Omission creates no `agent` own property.
- This preserves deep equality and serialized shape of the bare result.
- A supplied string is carried verbatim for later validation.
- Checking `!== undefined` reflects optional-field presence precisely.
- It mirrors the `after` conditional-spread pattern while respecting scalar semantics.

### Rejected: always return `agent: src.agent`

Property access would still yield `undefined`, but the object would gain an own key and violate the
ticket's byte-identical-shape requirement.

### Rejected: truthiness check

`...(src.agent ? ...)` would erase an explicitly supplied empty string. Unknown values should remain
available to the downstream guard; assembly must not silently normalize or discard them.

## D6 — One new addon-free test file

### Choice

Create `src/play/agent-seat.test.ts` and cover both parts of the acceptance criterion.

### Pure contract cases

- Assert `KNOWN_SEATS` exactly equals `["claude", "codex"]`.
- Assert both known values return `null`.
- Assert `"gpt"` returns exactly `"gpt"`.

### Assembly cases

- Create a temp project root.
- Write a minimal epic file.
- Write a minimal canonical charter file.
- Call `assembleInputs({ epicPath, projectRoot, agent: "codex" })`.
- Assert `agent` is carried as `"codex"`.
- Call assembly without `agent`.
- Assert property access is `undefined`.
- Assert the absent object has no own `agent` property.
- Assert it exactly equals the current three-key expected shape.

### Why a new file

- The ticket explicitly asks for a new addon-free unit test.
- It keeps the new contract's proof discoverable next to its module.
- Importing `project-context.ts` remains addon-free because it imports only Node APIs.
- The temp filesystem exercise is bounded and makes the transport acceptance observable.

## D7 — Documentation adjustment

The top comment in `project-context.ts` currently states `assembleInputs` is not unit-tested.
Once this ticket adds a direct fixture test, that statement becomes false. Update it narrowly to say
the pure formatter remains the main logic seam and assembly's optional metadata transport is covered
with a temp filesystem fixture. No broader documentation changes are needed.

## Scope guard

This design deliberately does not:

- validate inside `assembleInputs`;
- define or throw `UnknownSeatError`;
- write `agent:` frontmatter;
- alter decompose rendering or gates;
- add run-log outcomes;
- add chain options;
- parse CLI flags;
- touch Lisa dispatch;
- alter the existing present-layer `--seat` flag;
- add any seat beyond `claude` and `codex`.

## Acceptance mapping

- Single known-seat constant: `KNOWN_SEATS` tuple in `agent-seat.ts`.
- Unknown seat lookup: `findUnknownSeat` exact-result tests.
- Known seat lookup: both canonical values exact-result tests.
- Agent input presence: temp fixture calls `assembleInputs` with `agent: "codex"`.
- Agent input absence: no own key and exact three-key object equality.
- Addon-free proof: the test import graph contains only the contract module, project context, Bun,
  and Node standard-library APIs.
- Repository proof: focused test, typecheck, and full `bun run check` must pass.
