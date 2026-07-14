# T-076-01-01 — Implementation Progress

## Status

Implementation is complete and fully verified. The exact ticket-owned source unit is ready for the
required `lisa commit-ticket` transaction.

## Completed phases

- Research complete: mapped resolver, selector/catalog, OpenAI-compatible endpoint defaults,
  cast registry threading, tests, story boundaries, and workflow constraints.
- Design complete: chose a one-seat Claude cross-review default while preserving the installed
  adapter catalog and explicit registry provisioning.
- Structure complete: limited the source change to the resolver and its adjacent unit test.
- Plan complete: recorded red-first characterization, focused/full checks, exact commit paths, and
  review criteria.

## Implemented source unit

### `src/cross-review/resolve-complement.test.ts`

- Added a default-registry test that omits the registry argument.
- The test directly asserts `resolveComplementExecutor("claude")` returns `null`.
- That assertion is the exact rc.4 field-failure shape named by acceptance.
- The same test asserts `resolveComplementExecutor("codex")` returns `null`.
- Renamed both positive two-seat cases to state that their registry is explicitly provisioned.
- Retained all defensive registry cases.
- No test calls `dispense`, starts a process, or reaches a network endpoint.

### `src/cross-review/resolve-complement.ts`

- Imported `DEFAULT_EXECUTOR_ID` from the existing selector source of truth.
- Added a private `defaultCrossReviewRegistry` containing only that default Claude id.
- Its factory remains lazy and constructs through `executorFor` with explicit id and empty env.
- Changed only the resolver's default parameter from `builtinExecutors` to the one-seat registry.
- Kept `builtinExecutors` unchanged as the shipped adapter catalog.
- Kept the complement-selection algorithm unchanged.
- Documented that catalog membership is not reviewer provisioning.
- Documented that callers opt into review by passing an explicit two-seat registry.

## Red characterization evidence

Command:

```bash
bun test src/cross-review/resolve-complement.test.ts
```

Result before the source fix:

```text
5 pass
1 fail
9 expect() calls
```

The failure was the new first assertion:

```text
expect(resolveComplementExecutor("claude")).toBeNull()
Received: {
  seat: "codex",
  executor: OpenAICompatExecutor { id: "openai-compat", ... }
}
```

This reproduced the ticket's defect without dispensing: the omitted/default registry constructed
an OpenAI-compatible complement for a Claude author.

## Focused green evidence

Command:

```bash
bun test src/cross-review/resolve-complement.test.ts src/executor/select.test.ts
```

Result:

```text
21 pass
0 fail
38 expect() calls
2 files
```

The focused matrix proves both halves of the design:

- omitted cross-review registry is inert for Claude and Codex author seats;
- an explicit two-seat registry resolves in both directions;
- an explicit one-seat registry remains inert;
- incomplete/unknown author configurations remain inert;
- `builtinExecutors` still exposes OpenAI-compatible execution;
- `VEND_EXECUTOR=openai-compat` still selects it explicitly;
- ordinary execution with no selector remains Claude.

## Diff verification

Commands:

```bash
git diff --check -- src/cross-review/resolve-complement.ts \
  src/cross-review/resolve-complement.test.ts
git diff -- src/cross-review/resolve-complement.ts \
  src/cross-review/resolve-complement.test.ts
```

Result:

- whitespace check exited zero;
- only the intended import/default/docs/test edits appear;
- no concrete executor transport import was added;
- no selector, OpenAI adapter, cast, log, doctor, CLI, or board source was edited by this ticket.

## Full gate evidence

Command:

```bash
bun run check
```

Result: green, exit 0.

Stages:

```text
baml-cli generate --from baml_src        PASS
tsc --noEmit                             PASS
bun test                                 PASS
```

Suite totals:

```text
1724 pass
1 skip
0 fail
5337 expect() calls
1725 tests across 116 files
```

The single skip is the established real-dist acceptance test when `dist/` artifacts are absent:

```text
integration — bun run acceptance on the real dist/
skipped — no dist/ artifacts (run `just release-local` to exercise)
```

It is unrelated to this ticket and is not a failure.

## Plan conformance

Implemented exactly the planned code shape and test matrix.

No source-scope deviation occurred:

- no empty default registry substituted for the designed one-seat registry;
- no environment-based reviewer inference added;
- no global OpenAI endpoint default changed;
- no explicit OpenAI executor selection disabled;
- no dependent skipped-marker work pulled forward.

One workflow observation occurred as expected under Lisa orchestration:

- Lisa changed `docs/active/tickets/T-076-01-01.md` and began publishing
  `docs/active/work/T-076-01-01/` after detecting private artifacts.
- Those paths are orchestration-owned, not ticket-owned implementation files.
- They will not be staged, reverted, or included in the source commit.

## Commit preparation

The single meaningful implementation unit consists exactly of:

```text
src/cross-review/resolve-complement.ts
src/cross-review/resolve-complement.test.ts
```

Required transaction:

```bash
lisa commit-ticket \
  --ticket-id T-076-01-01 \
  --message "fix(cross-review): keep default reviewer registry inert (T-076-01-01)" \
  --include src/cross-review/resolve-complement.ts \
  --include src/cross-review/resolve-complement.test.ts
```

No ordinary index command will be used.

## Remaining work

1. Execute the exact Lisa commit transaction.
2. Capture and inspect the resulting commit.
3. Verify both source paths are clean.
4. Write `review.md` with per-criterion assessment and honest limitations.
5. Remain on T-076-01-01 and stop for Lisa completion handling.
