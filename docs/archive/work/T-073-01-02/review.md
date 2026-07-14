# T-073-01-02 — Review

## Outcome

PASS. The ticket acceptance criterion is met, the implementation is committed, and the full
project gate is green.

The new resolver turns a run's `seatOfExecution` into the sole other configured known seat plus an
invokable provider-neutral `Executor`. When a genuine two-seat configuration is unavailable, it
returns `null`, keeping cross-review inert.

## Commit reviewed

```text
ccca11d3d3a0796bfb9cbad45f4d0f3830c1da4e
feat(cross-review): resolve complement executor seat (T-073-01-02)
```

The commit contains exactly two ticket-owned paths and no orchestration/frontmatter files.

## Files created

### `src/cross-review/resolve-complement.ts`

Adds the S-073-01 routing boundary.

Public API:

```ts
export interface ComplementExecutor {
  readonly seat: AgentSeat;
  readonly executor: Executor;
}

export function resolveComplementExecutor(
  seatOfExecution: string | undefined,
  registry?: ExecutorRegistry,
): ComplementExecutor | null
```

Behavior:

- defaults configuration to `builtinExecutors`;
- enumerates configured executor ids;
- reuses `resolveSeatOfExecution` to assign only honest known seats;
- collapses multiple executor ids for the same seat at the seat level;
- verifies the run's authoring seat belongs to the recognized configured set;
- finds the distinct configured seat;
- refuses zero or multiple complements with `null`;
- constructs the selected executor through `executorFor`;
- bypasses process-env selection by making the complement id explicit;
- performs no dispense, network, filesystem, clock, or secret access.

### `src/cross-review/resolve-complement.test.ts`

Adds five free unit cases with inert stub executors and an injected registry. No real executor is
invoked and no tokens are spent.

## Acceptance assessment

### Claude seat resolves Codex/openai-compat

PASS.

The two-seat fixture calls `resolveComplementExecutor("claude", bothSeats)` and asserts the result
contains:

- `seat: "codex"`;
- the exact `openai-compat` stub object;
- executor stable id `openai-compat`.

### Codex seat resolves Claude

PASS.

The fixture calls `resolveComplementExecutor("codex", bothSeats)` and asserts the result contains:

- `seat: "claude"`;
- the exact Claude stub object;
- executor stable id `claude`.

### Only one configured seat returns null

PASS.

A registry containing only the Claude factory returns `null` for a Claude-authored run. The test
names this as cross-review inert.

## Additional boundary coverage

- `undefined` authoring seat returns `null`.
- Unknown string authoring seat returns `null`.
- A registry containing only the opposite seat returns `null`; availability of a different entry
  alone does not falsely imply a configured second seat.
- `noUncheckedIndexedAccess` is handled explicitly at the complement tuple read.

## Verification evidence

Focused test:

```text
bun test src/cross-review/resolve-complement.test.ts
5 pass
0 fail
8 expect() calls
```

Typecheck:

```text
bun run check:typecheck
exit 0
```

Full repository gate:

```text
bun run check
1670 pass
1 skip
0 fail
5120 expect() calls
112 files
```

The one skip is the pre-existing dist-absent release acceptance test. It is unrelated to this
change and is explicitly reported by the suite.

Commit whitespace/error check:

```text
git show --check ccca11d3d3a0796bfb9cbad45f4d0f3830c1da4e
exit 0
```

Ticket-owned source status is clean after the Lisa commit transaction.

## Architecture assessment

### Pure core, impure shell

The resolver is deterministic over plain input values and an injected registry. Constructing a
registered executor does not invoke its transport. The later `Executor.dispense` call remains in
the dependent workflow ticket's impure orchestration path.

### Executor agnosticism

The new module imports only the `Executor` interface as a type. It does not import
`ClaudeExecutor`, `OpenAICompatExecutor`, fetch, or the Claude CLI seam. Stable registry ids are
projected through the existing engine function and instantiated through the existing selector.
This directly advances P6.

### Source-of-truth reuse

No reverse mapping was added. The resolver discovers the complement from:

- `resolveSeatOfExecution` for executor-id-to-seat truth;
- `ExecutorRegistry` for configured capability;
- `executorFor` for construction.

This avoids drift between run provenance and review routing.

### Dependency direction

The new cross-review module depends on established engine/executor contracts. Neither foundational
layer depends back on cross-review. The dependent story tickets can build above this boundary.

## Risks and limitations

### Current complement cardinality

The product currently has exactly two known seats. The implementation deliberately requires one
and only one different configured seat. If the seat model expands to three or more, cross-review
will return `null` for an ambiguous multi-complement configuration until an authoring-time reviewer
selection policy is defined. This is safer than using registry insertion order.

### Registry is the capability declaration

There is no separate review-seat configuration today, so the executor registry is treated as the
configured capability set. If future configuration distinguishes “installed executor” from
“authorized reviewer,” this resolver's registry input is the seam where that filtered registry can
be supplied.

### Known projection requirement

Custom/injected executor ids are ignored unless `resolveSeatOfExecution` recognizes them. This is
intentional: an executor without an accounting seat cannot honestly be routed as a cross-vendor
complement. A future executor must extend the authoritative projection before participating.

### Factory exceptions

Once a valid complement id is found, `executorFor` retains its existing loud behavior if the
configured factory itself throws. The ticket requires `null` for no second seat, not suppression of
broken configured factories. Hiding such a wiring failure would be dishonest.

## Scope held

The change does not:

- capture or read a working-tree diff (T-073-01-01);
- construct the adversarial prompt;
- call `Executor.dispense`;
- parse a review verdict (all T-073-01-03);
- alter `RunRecord` or append a verdict to the ledger (T-073-01-04);
- enforce the verdict as a blocking gate (S-073-02);
- add a new executor or agentic open-model runner;
- spend tokens or perform a live endpoint drive;
- modify ticket phase/status frontmatter.

## Workspace handoff

The only remaining non-clean repository entries are Lisa-owned orchestration state:

- ticket phase changes for T-073-01-01 and T-073-01-02;
- Lisa-published work artifacts under `docs/active/work/T-073-01-02/`.

Ticket-owned source is committed and clean. Lisa owns final artifact publication, completion
confirmation, and seat release.

## Final assessment

No critical issue, TODO, or unmet acceptance item remains for T-073-01-02. The resolver is ready
for T-073-01-03 to consume.
