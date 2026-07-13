# T-076-01-01 — Review

## Outcome

PASS. All ticket acceptance criteria are met. The source change is committed through the required
Lisa transaction, the exact ticket-owned paths are clean, and the full repository gate is green.

Default complement resolution now models Vend's actual fresh-install capability: one Claude author
seat and no reviewer. The shipped OpenAI-compatible adapter remains available for explicit
selection, but catalog membership no longer authorizes an implicit second settlement call.

## Commit reviewed

```text
2067d90f74ad19eb48d5c571be131eb2769e10d0
fix(cross-review): keep default reviewer registry inert (T-076-01-01)
```

Commit contents:

```text
src/cross-review/resolve-complement.test.ts |  9 +++++++--
src/cross-review/resolve-complement.ts      | 21 ++++++++++++++++++---
2 files changed, 25 insertions(+), 5 deletions(-)
```

The commit was created only with `lisa commit-ticket` and the two exact repository-relative
`--include` paths. No board, shared work artifact, generated file, or unrelated path entered it.

## Files modified

### `src/cross-review/resolve-complement.ts`

Added a private one-seat default registry:

```ts
const defaultCrossReviewRegistry: ExecutorRegistry = {
  [DEFAULT_EXECUTOR_ID]: () =>
    executorFor({ executor: DEFAULT_EXECUTOR_ID }, {}, builtinExecutors),
};
```

Changed `resolveComplementExecutor`'s omitted-registry default from `builtinExecutors` to that
registry.

The effect is intentionally narrow:

- default Claude author is configured;
- no default complement exists;
- default Codex author is not represented and is also inert;
- no default path can select the OpenAI-compatible factory;
- explicit registries retain the original resolver algorithm;
- ordinary executor selection retains the full built-in adapter catalog.

Comments now name the key semantic distinction: a shipped adapter is not proof that an operator
provisioned it as a reviewer.

### `src/cross-review/resolve-complement.test.ts`

Added the omitted-registry regression matrix:

```ts
expect(resolveComplementExecutor("claude")).toBeNull();
expect(resolveComplementExecutor("codex")).toBeNull();
```

The Claude assertion exactly reproduces the rc.4 author/default-registry shape. The test initially
failed by receiving an `OpenAICompatExecutor`, then passed after the default capability fix.

Renamed the two positive cases to state that their two-seat registry is explicitly provisioned.
Their identity assertions and behavior are unchanged.

## Acceptance assessment

### Default config returns null for every author seat

PASS.

- `resolveComplementExecutor("claude")` returns `null`.
- `resolveComplementExecutor("codex")` returns `null`.
- The test omits the registry argument, exercising the production default expression.
- The Claude assertion is the exact rc.4 failure shape named by the ticket.
- Both known seats are covered directly.

### Explicitly provisioned reviewer still resolves

PASS.

The existing provisioning mechanism is an injected `ExecutorRegistry`, threaded in production
through `CastOptions.crossReviewRegistry`.

The explicit two-seat fixture proves both directions:

- Claude author resolves `{ seat: "codex", executor: openaiCompatStub }`.
- Codex author resolves `{ seat: "claude", executor: claudeStub }`.

This follows the established executor configuration convention:

- capability is declared as name-to-lazy-factory registry entries;
- selected construction goes through `executorFor`;
- no concrete transport is imported by routing policy;
- no new environment variable, config schema, CLI option, or UI was invented.

The provisioning mechanism and rationale are documented in this attempt's `research.md`,
`design.md`, `structure.md`, and this review.

### No implicit dialable OpenAI-compatible executor

PASS for the ticket/story scope.

Default complement resolution sees only the private Claude entry. Its algorithm returns `null`
before invoking any factory, so it cannot construct an OpenAI-compatible reviewer backed by
`DEFAULT_OPENAI_BASE_URL`.

The original broad catalog remains unchanged. That is intentional: a caller may still explicitly
select OpenAI-compatible author execution with `VEND_EXECUTOR=openai-compat`, and its established
local-first URL fallback remains part of that explicit path. This ticket removes unprovisioned
cross-review construction; it does not remove explicitly selected executor behavior.

Selector regression tests confirm:

- `builtinExecutors["openai-compat"]` still constructs the adapter;
- explicit environment selection still returns it;
- no-selector ordinary execution still defaults to Claude.

### Full gate

PASS.

`bun run check` exited zero after BAML generation, strict typecheck, and the complete Bun test
suite.

## Test evidence

### Red characterization

Before the resolver edit:

```text
bun test src/cross-review/resolve-complement.test.ts
5 pass
1 fail
```

The new Claude/default assertion received:

```text
{
  seat: "codex",
  executor: OpenAICompatExecutor { id: "openai-compat", ... }
}
```

That is direct evidence the test closed the intended regression gap rather than merely confirming
the implementation after the fact.

### Focused green suite

```text
bun test src/cross-review/resolve-complement.test.ts src/executor/select.test.ts
21 pass
0 fail
38 expect() calls
```

Coverage includes:

- omitted registry for each known author seat;
- explicit two-seat resolution in both directions;
- explicit one-seat inertness;
- absent and unknown author seats;
- incomplete opposite-only registry;
- ordinary selector defaults and precedence;
- explicit OpenAI-compatible adapter selection.

### Full green suite

```text
baml-cli generate --from baml_src        PASS
tsc --noEmit                             PASS
bun test                                 1724 pass, 1 skip, 0 fail
                                         5337 expect() calls
                                         1725 tests / 116 files
```

The sole skip is the pre-existing acceptance test that requires real `dist/` artifacts and directs
the operator to `just release-local`. It is unrelated to this ticket and is not a red gate.

## Architecture review

### Pure core, impure shell

PASS.

The resolver remains policy over plain seat and registry values. The new default is a plain lazy
factory map. Default resolution invokes no factory. Explicit resolution constructs an executor
but performs no probe, dispense, filesystem, clock, or network operation. Transport remains in the
later review shell.

### Executor neutrality

PASS.

Cross-review still imports only the `Executor` interface as a type. The default factory uses the
selector instead of importing `ClaudeExecutor`. Seat projection remains delegated to the existing
engine source of truth.

### Scope discipline

PASS.

No changes were made to:

- `src/engine/cast.ts`;
- `src/log/run-log.ts`;
- OpenAI-compatible transport behavior;
- doctor checks;
- CLI/config UI;
- known seats;
- failure handling for provisioned reviewers.

Those items belong to the dependent ticket or later stories exactly as the S-076-01 contract says.

## Diff and repository hygiene

- `git diff --check` passed before commit.
- `git show --check 2067d90...` passed after commit.
- Commit inspection shows exactly two files.
- Both ticket-owned paths have no remaining diff.
- The ordinary index was not used.
- `docs/active/tickets/T-076-01-01.md` and `docs/active/work/T-076-01-01/` remain visible as Lisa-owned
  phase-transition/publication state and were neither included nor reverted.

## Open concerns and limitations

### Provisioning is programmatic in this slice

The existing `crossReviewRegistry` injection is the provisioning mechanism. There is no end-user
CLI or persisted reviewer configuration yet. This is an explicit story boundary, not hidden
completeness: “any UI for provisioning a reviewer” is out of this slice.

### Skipped review is not yet recorded

Default resolution now safely returns `null`, but this ticket does not write a
`crossReviewSkipped` marker. T-076-01-02 is the serialized dependent ticket that adds the schema,
ledger round-trip, and exact cast-settlement stamping conditions.

### Provisioned-but-unreachable behavior is unchanged

An explicit registry can resolve an executor whose service is unavailable. S-076-02 owns converting
that failure into a recorded andon rather than a crash. This ticket only ensures an unprovisioned
reviewer never resolves by default.

### No live network test is warranted here

All relevant resolution behavior is pure. The red characterization proved the wrong concrete
executor was constructed without calling it; the green result makes that construction unreachable.
The epic's broader no-network metered-cast proof is intentionally handled by downstream work.

## Final judgment

The change satisfies P2 by removing the fresh-install second-service requirement and P3 by making
the review gate bind only to declared capability. It preserves explicit executor agnosticism and
does not weaken the original two-seat review mechanism.

No critical issue remains within T-076-01-01. The ticket is ready for Lisa's completion publication
and seat release. Work stops here; no subsequent ticket is started.
