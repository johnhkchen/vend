# Design — T-068-02-03: runner-materialize-and-surface

## Decision summary

Make the warned-clear classifier branch reachable in the generic runner and forward its result unchanged.

The selected design has four linked changes:

1. parse and gate every non-timeout terminal executor result, even when token checking reports exhaustion;
2. continue to let `classify` alone decide whether that result may materialize;
3. spread `verdict.overEnvelope` into the run-log input and returned `RunSummary`;
4. emit a live settlement warning containing the measured spend, ceiling, and overage.

Prove the behavior with a BAML-free fixture cast whose effect writes one story file and one ticket file.

## Required invariants

The design must preserve all of these behaviors:

- a wall-clock timeout has no result to parse and never materializes;
- a gate stop never materializes, even when the token budget is exhausted;
- an exhausted result with skipped or absent gates remains budget-exhausted;
- an ordinary in-budget clear remains an unmarked success;
- only an explicit gate clear authorizes an exhausted result to materialize;
- the warning fact comes from the pure classifier;
- the record outcome for a cleared overshoot is `success`;
- one completed cast appends exactly one record;
- unmarked records omit the warning key;
- the runner remains independent of concrete plays and BAML.

## Option A — stop before parsing exhausted results

This is the current runner behavior.

Advantages:

- avoids parsing output already known to exceed its token envelope;
- preserves historical behavior exactly;
- performs the least post-executor work.

Disadvantages:

- makes T-068-02-02’s warned-clear branch unreachable;
- cannot distinguish a valuable gates-cleared plan from a bad plan after overshoot;
- always discards the already-paid-for output;
- contradicts the story acceptance criterion;
- cannot produce story/ticket files or the warning-bearing cleared record.

Rejected because it directly fails the ticket.

## Option B — materialize every exhausted returned result

The runner could parse an exhausted response and invoke the effect without running gates.

Advantages:

- recovers output after detect-after overshoot;
- is operationally simple;
- mirrors the existing ungated in-budget control path.

Disadvantages:

- violates P3 and the story’s explicit boundary;
- permits malformed or low-value output to settle merely because tokens were spent;
- collapses budget disposition and quality disposition;
- would make gate-failed overshoots materialize;
- bypasses the classifier contract already implemented in the dependency.

Rejected because gates, not sunk cost, authorize output.

## Option C — parse and gate exhausted results, classify centrally

The runner always meters a returned result, then parses and gates it unless gates were explicitly skipped.

It passes both the budget outcome and gate verdict to `classify`.

Advantages:

- makes every pure classifier branch live-reachable;
- preserves one authoritative disposition decision;
- permits only explicit clears to recover overshot output;
- leaves timeout behavior unchanged because timeout returns no result;
- keeps generic runner and concrete play boundaries intact;
- matches the story and dependency designs.

Disadvantages:

- parsing or gating an exhausted result performs additional local work;
- a malformed returned payload may now surface a parse failure instead of a clean budget-exhausted record;
- every play’s gates may run after the envelope has already been exceeded.

Chosen because post-result validation is the only way to honor both gates and detect-after reality.

The additional work is local validation, not further agent token spend.

## Option D — move warning/materialization policy into decompose’s effect

The concrete effect could receive budget data and choose whether to write.

Advantages:

- keeps overshoot handling near story/ticket materialization;
- can customize warning text for decompose.

Disadvantages:

- changes the `Play.effect` contract for a generic orchestration concern;
- duplicates classification outside the pure core;
- makes behavior play-specific even though the generic runner owns budget and outcome;
- risks disagreement between the record and the effect;
- violates dependency direction by coupling more policy into the concrete play.

Rejected because this is runner disposition, not materializer judgment.

## Warning source of truth

The runner will consume `verdict.overEnvelope` directly.

It will not compute a second boolean from `budgetOutcome.status`, gate status, or numeric comparison.

This preserves the state matrix implemented and unit-tested in T-068-02-02.

The `BudgetOutcome` remains available only to render the warning’s factual detail:

- spent tokens;
- token ceiling;
- overage.

The presence of the warning is classifier-owned; its explanatory numbers are meter-owned.

## Durable warning design

The append object will conditionally spread:

```ts
...(verdict.overEnvelope ? { overEnvelope: true } : {})
```

This matches the run-log’s one-way marker contract and existing `reducedGrounding` forwarding.

It avoids writing `overEnvelope: false` on ordinary records.

The marker remains attached even if the effect returns an outcome relabel.
That is honest: the returned plan did clear after exceeding the envelope, even if a later filesystem guard refused it.

The ticket fixture covers the successful materialization path.

## Returned settlement design

Extend `RunSummary` with:

```ts
readonly overEnvelope?: true;
```

Return it only when the verdict carries it.

This gives CLI and higher-level orchestration a typed settlement fact without requiring an immediate ledger reread.

It also keeps hand-built test summaries source-compatible because the field is optional.

False remains unrepresentable on the returned summary, matching `Verdict` and normalized `RunRecord`.

## Live warning design

When `verdict.overEnvelope` is present, `castPlay` will write one live stdout line after effect handling:

```text
· settle warning: over-envelope — spent N/C tokens (over by O); gates cleared, output retained
```

This line states:

- the contract breach;
- the measured magnitude;
- why output was retained;
- that the disposition is a warning rather than an andon.

It is emitted from the runner because the runner owns both verdict and budget outcome.

No concrete effect or CLI command needs to reconstruct the message.

## Parsing and gate ordering

The new post-executor sequence is:

1. call `check` on returned usage;
2. parse the returned result text;
3. run gates unless `skipGates` is true;
4. classify with timeout, budget outcome, and gate verdict;
5. invoke effect only when the verdict authorizes it;
6. surface warning if marked;
7. append the record with the same marker;
8. return the summary with the same marker.

This preserves “meter before parse” while removing “in-budget before parse.”

## Fixture design

Add one integration test to `src/engine/cast.test.ts`.

The fixture uses:

- a token budget below the stub’s reported ten tokens;
- a play whose parser turns returned JSON into a small plan value;
- a gate that explicitly clears;
- an effect that creates the standard story/ticket directories and writes one markdown file in each;
- the existing injected stub executor seam;
- a temporary run-log path.

Assertions cover:

- summary outcome is `success`;
- summary is materialized;
- summary carries `overEnvelope: true`;
- both expected files exist with fixture content;
- exactly one record was appended;
- record outcome is `success`;
- record is not `budget-exhausted`;
- record carries `overEnvelope: true`;
- revived record retains the marker;
- gate rows show the clear;
- usage proves the ceiling was actually exceeded.

The fixture tests the generic runner without loading `decompose-epic.ts` or BAML.
Naming its output paths as stories and tickets directly proves the ticket’s materialization claim.

## Compatibility

No schema version changes.

No new outcome values.

No changes to budget arithmetic.

No changes to either pure classifier.

No changes to decompose gates or materialization rules.

No ticket frontmatter changes.

The optional summary marker is additive for TypeScript consumers.

Ordinary run-log records remain byte-compatible with respect to the warning field.

## Verification

Run the focused integration suite first:

```bash
bun test src/engine/cast.test.ts
```

Then run the repository gate:

```bash
bun run check
```

The full gate is required because the `RunSummary` interface is consumed across CLI, chain, spend, and tests.

## Final decision

Choose Option C with direct verdict forwarding.

It is the smallest design that makes the dependency’s pure decision real end to end while holding the story’s quality boundary.
