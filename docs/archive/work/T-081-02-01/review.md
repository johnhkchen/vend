# Review — T-081-02-01

## Outcome

Pass.

The live progress fold now measures explicit main-stream weighted spend during execution, settles
to the exact cumulative usage the budget meter and ledger use, excludes captured sidechain records
from both fold counters, and labels the number as “weighted tokens.”

The captured steer-jank transcript replays from 104,807 assistant-only weighted tokens to 181,902
after explicit thinking deltas and finally 214,621 after terminal reconciliation. The matching
ledger total is 214,621. The named tolerance is zero and the observed difference is zero.

The captured sidechain transcript now folds to 12 parent assistant turns rather than 45 mixed
parent-plus-sidechain IDs. A non-zero synthetic companion proves the same sidechain boundary
prevents spend inflation as well as turn inflation.

## Commit reviewed

```text
e0c2bcd962cd38a137b0375fb3ec0d7a6c2a5700
fix(cast): reconcile live weighted spend
```

Commit content:

```text
6 files changed, 248 insertions(+), 20 deletions(-)
```

`git show --check` passes.

All ticket-owned production, test, and fixture paths are clean after the Lisa-isolated commit.

## Files changed

### `src/engine/cast-core.ts`

Changed the pure `accumulateCastProgress` policy:

- rejects non-null-parent sidechain records before accounting;
- adds valid main-stream thinking deltas at canonical output weight;
- replaces the live estimate with cumulative terminal result usage;
- preserves the existing first-assistant-event dedup policy;
- preserves turns and seen IDs across thinking/result records;
- remains immutable and total over the open stream shape.

Added `CAST_PROGRESS_LEDGER_TOLERANCE = 0` as the named terminal agreement contract.

Changed `formatCastProgress` from the ambiguous `tokens` label to `weighted tokens`.

### `src/engine/cast-core.test.ts`

Added fixture loading and two acceptance tests:

- captured token-spend replay;
- captured sidechain census plus both-counter admission proof.

Updated existing exact formatter expectations and malformed/no-op coverage for the new recognized
record kinds.

### `src/engine/cast.test.ts`

Updated the stdout integration expectation to the new label and the now-correct terminal value.
The fake stream renders:

```text
0 weighted tokens
7 weighted tokens after the assistant event
22 weighted tokens after cumulative terminal usage
```

This proves the unchanged `cast.ts` `onMessage` path exposes core reconciliation live.

### `src/engine/fixtures/T-081-02-01/`

Added:

- provenance/sanitization README;
- 19-row token-spend excerpt;
- 50-row turn-sidechain excerpt.

The JSONL files are byte-identical to the sanitized forensic outputs from `T-081-01-01`.

## Pure-core assessment

The implementation follows the repository's pure-core/impure-shell rule.

All new decisions operate on plain `CastProgress` and `StreamMessage` values. No filesystem,
clock, network, process, or stdout dependency entered `cast-core.ts`.

The shell remains responsible only for supplying ordered messages, elapsed time, and rendering
effects. No `cast.ts` production change was necessary.

Changed progress states are frozen. No-op paths retain object identity:

- marked sidechains;
- malformed/unknown records;
- invalid/zero thinking deltas;
- a terminal result whose weighted truth already matches state;
- duplicate assistant IDs.

## Meter correctness

No price vector is copied into the fold.

Assistant usage, thinking deltas, and terminal usage all pass through the existing canonical
`countTokens` function:

- assistant snapshots use their four usage buckets;
- thinking deltas are represented as `output_tokens`;
- terminal usage uses its authoritative four cumulative buckets.

Terminal usage replaces rather than adds. This is the critical distinction between cumulative
truth and incremental observations; adding would double-charge the run.

The budget check still uses the same unmodified `countTokens` path. Progress and settlement now
share both input and arithmetic at terminal time.

## Captured token acceptance proof

Fixture run: `run-2026-07-13T17-07-45-166Z`.

Observed stages:

| Stage | Weighted tokens | Turns |
|---|---:|---:|
| nine deduped assistant IDs | 104,807 | 9 |
| plus 15,419 thinking-token delta | 181,902 | 9 |
| terminal cumulative usage | 214,621 | 9 |
| matching ledger | 214,621 | — |

Agreement assertion:

```text
abs(214,621 - 214,621) = 0
CAST_PROGRESS_LEDGER_TOLERANCE = 0
0 <= 0
```

The original terminal ratio was 214,621 / 104,807 ≈ 2.048. Exact terminal replacement closes
that gap rather than merely widening a display tolerance.

The explicit thinking records make the mid-cast line materially closer before settlement:
181,902 versus the old 104,807.

## Captured sidechain acceptance proof

Fixture run: `run-2026-07-13T14-39-35-941Z`.

Evidence population:

| Class | Distinct assistant IDs |
|---|---:|
| main/null parent | 12 |
| sidechain 1 | 4 |
| sidechain 2 | 9 |
| sidechain 3 | 11 |
| sidechain 4 | 9 |
| all sidechains | 33 |
| unfiltered total | 45 |

New fold result:

- `turns = 12`;
- 12 seen IDs, all `main-*`;
- no sidechain ID admitted.

Because the forensic turn fixture intentionally carries empty usage, the test also folds marked
sidechain records with non-zero usage:

- assistant usage worth 30,000 weighted tokens;
- thinking delta of 10,000 raw output tokens;
- result usage of 99,999 raw output tokens.

Starting from one 30,000-weighted-token main turn, all marked sidechain records preserve the exact
same state by identity. Both `weightedTokens` and `turns` therefore follow the counted evidence's
main-stream boundary.

## Formatter acceptance proof

The captured settled state renders exactly:

```text
elapsed 4m12s · 215k/250k weighted tokens · turn 9/15
```

The test pins the label literal. All other exact formatter cases and the shell integration test
were updated, so no operator path retains the old ambiguous live-line label.

Human `k` rounding remains display-only: the state and tolerance assertion use exact 214,621.

Detect-after still activates only when exact weighted spend exceeds the exact weighted envelope.

## Test coverage

Focused core coverage includes:

- captured token fixture replay;
- captured sidechain fixture replay;
- explicit thinking weighting;
- exact terminal replacement;
- zero tolerance and absolute-difference assertion;
- label text;
- turn preservation on result;
- sidechain assistant/thinking/result no-ops;
- malformed result usage;
- missing, negative, non-finite, and zero thinking deltas;
- duplicate assistant IDs;
- immutable no-op identity;
- existing elapsed/detect-after/turn formatting.

Focused results:

```text
cast-core.test.ts + cast.test.ts
96 pass
0 fail
451 expectations
```

Post-commit isolated core result:

```text
71 pass
0 fail
182 expectations
```

Full gate:

```text
bun run check
BAML generation: green (14 files)
TypeScript: green
Tests: 1,949 pass, 1 declared skip, 0 fail
Expectations: 6,419
Files: 126
```

The full gate ran after the concurrent `T-081-01-02` turn-ledger commits and with this ticket's
implementation in the worktree, covering their combined branch state.

## Acceptance assessment

- Captured jank-run fixture replayed through `accumulateCastProgress`: met.
- Final weighted tokens agree with the real ledger `totalTokens`: met, exactly 214,621.
- Named tolerance stated and pinned: met, `CAST_PROGRESS_LEDGER_TOLERANCE = 0`.
- ~2× assistant-only undercount closed: met.
- Mid-cast explicit thinking spend tracked: met, line rises to 181,902 before result.
- Formatter names the figure: met, `weighted tokens` pinned in pure and shell tests.
- Sidechain handling matches counted evidence in turn counter: met, 12 rather than 45.
- Sidechain handling matches counted evidence in spend counter: met, marked non-zero records are
  identity no-ops.
- Sanitized fixture excerpts committed: met, with provenance README.
- `bun run check` green: met.
- Ticket work committed with exact Lisa includes: met.

## Plan deviation review

The only deviation corrected a mistaken expected value in the integration test.

The Plan predicted that adding the label would leave its numeric sequence unchanged. The fake
terminal result carries cumulative usage worth 22 weighted tokens, while the preceding assistant
snapshot is worth 7. The implementation correctly changes the terminal refresh from 7 to 22.

Updating that assertion strengthens rather than weakens the acceptance proof. No scope, module
boundary, or policy changed.

## Open concerns and honest limits

### Nested result ownership

The sidechain forensic transcript's five result records all have null parent markers. The stream
does not expose enough information to assign four nested results and one parent result safely.

The fold therefore accepts null-parent cumulative results in order. A nested result may
temporarily reconcile the displayed spend before the final parent result arrives. In the captured
ordering the final parent result is last and restores exact ledger truth.

Inventing correlation or ignoring all result usage would be less honest. If an executor later
supplies an explicit non-null parent marker, the new common guard already excludes it.

### Residual before terminal result

The explicit thinking delta closes 77,095 of the 109,815 weighted-unit gap. A 32,720 weighted-unit
residual is available only in terminal cumulative usage among the captured fields. The line cannot
show that unknown value before it exists on the stream.

This residual is not silently absorbed: the fold displays all observed incremental facts, then
reconciles exactly when terminal truth arrives. Final tolerance remains zero.

### Executor variability

Executors that do not emit `system/thinking_tokens` retain assistant-based live estimates and exact
terminal reconciliation if they provide result usage. This is a graceful absence path, not a
claim that every executor has identical mid-stream telemetry.

### Deferred live proof

No model call was funded. The story explicitly defines this slice as fixture-proven and defers a
fresh installed-binary cast to epic closure.

None of these limits blocks the ticket acceptance contract.

## Worktree and commit discipline

No ordinary index or commit command was used.

The Lisa commit includes exactly the six owned files. Remaining worktree changes are Lisa-managed
frontmatter/provenance/publication state and another ticket's attempt artifacts. They were not
staged, modified, or committed by this ticket.

## Final disposition rationale

The implementation satisfies every ticket criterion, is fixture-proven against both captured
anomalies, preserves the pure core boundary, passes the full gate, and is committed cleanly.

Disposition: pass.
