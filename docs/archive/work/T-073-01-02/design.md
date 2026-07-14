# T-073-01-02 — Design

## Decision

Add a small `src/cross-review/resolve-complement.ts` module exporting a single resolver and result
type. The resolver accepts a run's optional/string `seatOfExecution` and an injectable executor
registry. It derives recognized configured seats through `resolveSeatOfExecution`, requires the
run seat itself to be present, chooses the sole different seat, then constructs that executor with
`executorFor`. Otherwise it returns `null`.

The public result is:

```ts
interface ComplementExecutor {
  readonly seat: AgentSeat;
  readonly executor: Executor;
}
```

The public operation is conceptually:

```ts
resolveComplementExecutor(seatOfExecution, registry = builtinExecutors)
  -> ComplementExecutor | null
```

## Algorithm

1. Enumerate registry executor ids.
2. Project each id through the existing `resolveSeatOfExecution` map.
3. Ignore ids without an honest known-seat projection.
4. Retain one executor id per projected seat.
5. If `seatOfExecution` is not among configured recognized seats, return `null`.
6. Select configured entries whose seat differs from `seatOfExecution`.
7. Require exactly one complement; otherwise return `null`.
8. Call `executorFor({ executor: complementId }, {}, registry)`.
9. Return the projected seat and constructed executor together.

The exact-one condition makes ambiguity inert if a future registry expands beyond two seats. The
current contract has two seats, so a valid two-seat registry always has one complement.

## Why this design

- It reuses the two named seams required by the story.
- It does not encode a second `claude ↔ codex` switch.
- The registry remains the configured capability source.
- It returns both routing metadata and an invokable executor, so T-073-01-03 need not repeat
  selection.
- It is deterministic without depending on registry insertion order.
- It degrades to `null` for incomplete, unknown, or ambiguous configuration.
- It leaves all transport work behind `Executor.dispense`.
- It stays free under unit test because construction does not invoke transport.

## Options considered

### A. Hard-code a seat-to-executor-id complement switch

Example: Claude directly selects `openai-compat`; Codex directly selects `claude`.

Advantages:

- Minimal code.
- Directly represents today's two cases.

Rejected because it duplicates `resolveSeatOfExecution`, the exact map the story says to reuse.
Future executor id or lane changes could make cast provenance and cross-review routing disagree.

### B. Add reverse lookup to `cast-core.ts`

Advantages:

- Keeps both directions near the existing map.
- Could expose a pure seat-to-id operation.

Rejected because cross-review routing, configuration completeness, and executor construction do not
belong in the generic cast decision core. It would also touch the parallel ticket's declared engine
area and expand a foundational module for story-specific policy.

### C. Put complement selection into `executor/select.ts`

Advantages:

- Registry and factory access are local.
- Selection tests already live there.

Rejected because `select.ts` knows executor ids but intentionally does not own Lisa/run-seat policy.
The story explicitly assigns routing to a new cross-review module. Pulling engine seat mapping into
the selector would blur the executor abstraction with review workflow semantics.

### D. Derive the complement only from `KNOWN_SEATS`

Advantages:

- Simple set subtraction.
- Naturally identifies Claude versus Codex.

Rejected as incomplete: it can name the other seat but cannot prove that an executor for it is
configured. A second parallel map is still required to construct the executor.

### E. Read environment variables to infer two-seat configuration

Advantages:

- No registry argument on the public API.

Rejected because `VEND_EXECUTOR` selects one default executor; it does not declare a set of
available seats. API keys/base URLs also do not reliably define capability and would entangle a
pure routing decision with secrets/environment state.

### F. Return a factory or executor id instead of an Executor

Advantages:

- Defers construction.
- Smaller result value.

Rejected because acceptance explicitly asks for an invokable Executor. Returning the interface now
keeps T-073-01-03 provider-neutral and ensures all construction goes through `executorFor` once.

## Edge behavior

- `undefined` seat: `null`.
- Unknown seat string: `null`.
- Empty registry: `null`.
- Registry containing only the run seat: `null`.
- Registry containing only the opposite seat: `null`; there is not a configured second seat.
- Registry containing both recognized seats: return the other.
- Registry entries with unknown executor ids: ignore them.
- Multiple ids mapping to the same seat: retain one seat entry; duplicates do not create a false
  complement.
- More than one distinct complement in a future expanded seat map: `null` rather than arbitrary
  registry-order selection.

## Testing design

Use injected stub executors and factories:

- Registry keys stay the real mapped ids: `claude` and `openai-compat`.
- Stub ids also match those stable ids.
- Claude input returns `{ seat: "codex", executor: openaiStub }`.
- Codex input returns `{ seat: "claude", executor: claudeStub }`.
- A Claude-only registry returns `null` for Claude input.
- Add compact defensive cases for absent/unknown seat and incomplete opposite-only configuration.
- Never call `dispense`; identity proves the selected invokable object.

## P6 and story fit

The workflow chooses a seat by stable metadata and obtains execution only through the existing
executor interface/selector. Cross-review does not import concrete executor classes or transports.
This advances executor-agnostic orchestration while respecting the story's deliberately narrow
single-turn review boundary.
