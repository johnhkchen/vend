# Review — T-081-01-01

## Outcome

Pass. The spike reconciles both real-transcript anomalies, supplies sanitized machine-replayable
fixtures, and leaves production behavior unchanged for the dependent implementation tickets.

The key correction is that the observed 45 is not terminal `num_turns`. It is the current
sidechain-blind `progress.turns` fold over 45 distinct assistant IDs. The evidence partitions it
exactly into 12 parent/main IDs plus 33 sidechain IDs. The final parent terminal `num_turns` is 2.

The live token figure replays at 104,807 (rendered 105k) and terminal ledger truth at 214,621. The
109,815 weighted-unit gap is entirely output and is fully itemized.

## Files created

### Required RDSPI artifacts

- `research.md`;
- `design.md`;
- `structure.md`;
- `plan.md`;
- `progress.md`;
- `review.md`;
- `review-disposition.json`.

### Acceptance evidence

- `root-cause.md`;
- `fixtures/README.md`;
- `fixtures/turn-sidechain-excerpt.jsonl`;
- `fixtures/token-spend-excerpt.jsonl`.

All were authored under `.lisa/attempts/T-081-01-01/1/work/`. No artifact was written directly to
the shared `docs/active/work/T-081-01-01/` path. Lisa's watcher began publishing admitted phase
artifacts during the attempt; those shared files were not edited or staged manually.

## Files modified

No ticket-owned production source or test file was modified.

`docs/active/tickets/T-081-01-01.md` changed from `phase: research` to `phase: implement` while the
attempt ran. That is Lisa-owned phase state, was not edited by this worker, and was not included in
a ticket commit.

## Turn root cause

Evidence run:

- `run-2026-07-13T14-39-35-941Z`;
- transcript lines 1–522;
- real ledger `.vend/runs.jsonl` line 32.

Raw type census:

| Type | Count |
|---|---:|
| assistant | 156 |
| user | 81 |
| system | 278 |
| result | 5 |
| rate_limit_event | 2 |

The current fold deduplicates the 156 assistant rows to 45 nested message IDs without examining
`parent_tool_use_id`.

Exact ID census:

| Stream | Unique IDs |
|---|---:|
| parent/main | 12 |
| sidechain 1 | 4 |
| sidechain 2 | 9 |
| sidechain 3 | 11 |
| sidechain 4 | 9 |
| all | 45 |

The sanitized fixture retains every unique ID's first source line. The complete counted line lists
are in `root-cause.md`, not merely totals.

Production replay results:

- unfiltered fixture → `progress.turns = 45`;
- null-parent-only fixture → `progress.turns = 12`;
- sidechain contribution → 33;
- main-only count versus configured cap → 12 ≤ 15.

The five result records at source lines 518–522 report `num_turns` 10, 1, 1, 1, and 2. The final
result is 2, which matches the ledger's current `turnsUsed: 2`. These results do not carry the
parent marker needed to assign them safely to individual sidechains.

This meets the acceptance intent more honestly than forcing 45 into the `num_turns` label: the raw
evidence proves that label would be false. The note reconciles every observed counter and names its
unit/source.

## Sidechain verdict

Yes, sidechain assistant IDs inflate `progress.turns` in the real run.

- 33 counted IDs have non-null parent markers.
- They are 73.3% of the displayed 45.
- Their inclusion changes the parent observable from 12 to 45.
- They are the entire cause of the apparent over-cap assistant-ID numerator.

The spike does not prescribe whether downstream code filters, separately reports, or namespaces
sidechains. It supplies the evidence required for that decision.

## Token root cause

Evidence run:

- `run-2026-07-13T17-07-45-166Z`;
- transcript lines 1–212;
- real ledger `.vend/runs.jsonl` line 33.

The 35 assistant rows collapse to nine IDs. Their first accepted usage buckets sum to:

| Bucket | Live usage | Weighted contribution |
|---|---:|---:|
| input | 2,994 | 2,994.00 |
| output | 63 | 315.00 |
| cache read | 416,183 | 41,618.30 |
| cache creation | 47,903 | 59,878.75 |
| unrounded | | 104,806.05 |

Production per-ID rounding yields 104,807, which the formatter renders as 105k.

The terminal result at transcript line 212 and the ledger row both carry:

| Bucket | Terminal usage | Weighted contribution |
|---|---:|---:|
| input | 2,994 | 2,994.00 |
| output | 22,026 | 110,130.00 |
| cache read | 416,183 | 41,618.30 |
| cache creation | 47,903 | 59,878.75 |
| unrounded | | 214,621.05 |

Canonical `countTokens` returns 214,621.

## Miss inventory

### First-event versus final-event usage per ID

Measured miss: zero on this run.

The fixture retains first and last endpoints for each repeated ID. All four bucket values are
identical at both endpoints for every ID. First-ID and last-ID folds both produce 104,807.

This rules out a plausible but incorrect one-line repair: choosing the last duplicate assistant
event does not close the real gap.

### Skipped message kinds

Measured explicit miss: 15,419 output-like tokens.

The transcript contains 150 `system/thinking_tokens` records at counted lines 6–208. Their
`estimated_tokens_delta` sum is 15,419. At the output weight of five, that is 77,095 weighted
units omitted by the assistant-only fold.

Other skipped user/system/rate-limit rows do not carry another canonical four-bucket total in this
run.

### Terminal-skip residual

Measured residual after explicit thinking: 6,544 output tokens.

Arithmetic:

`22,026 terminal output - 63 assistant output - 15,419 thinking delta = 6,544`.

At output weight five, that is 32,720 weighted units visible only in terminal cumulative usage
among the retained accounting fields.

### Exact closure

`104,806.05 + 77,095 + 32,720 = 214,621.05`.

Rounded through the respective production paths, that is the reported 105k versus 214,621 (~214k)
gap. Input and both cache buckets already match exactly; the entire difference is output.

## Fixture coverage

### Turn fixture

Validated facts:

- 50 JSONL records;
- 45 assistant records / 45 unique IDs;
- 12 main / 33 sidechain;
- four sidechain group sizes 4, 9, 11, 9;
- five terminal result values 10, 1, 1, 1, 2;
- production replay 45 versus main-only 12.

### Token fixture

Validated facts:

- 19 JSONL records;
- 17 assistant endpoint records / nine IDs;
- first-versus-last difference zero;
- production fold nine turns / 104,807 weighted tokens;
- terminal `countTokens` 214,621;
- thinking aggregate 15,419;
- terminal output residual 6,544.

### Source fidelity

An independent source-line cross-check verified:

- all 50 turn fixture rows against the raw turn transcript;
- all 19 token fixture rows against the raw token transcript;
- all 150 source thinking rows against the aggregate count and sum.

Sanitization search found no raw message/tool/session/request/UUID identifiers, content payloads,
signatures, or absolute user paths.

## Test and gate coverage

Focused evidence replay used the real pure production functions:

- `accumulateCastProgress`;
- `EMPTY_CAST_PROGRESS`;
- `countTokens`.

Replay receipt:

```json
{"turnsAll":45,"turnsMain":12,"spendTurns":9,"spendWeighted":104807,"terminalWeighted":214621,"endpointDiff":0,"thinkingDelta":15419,"terminalOutputResidual":6544}
```

Full repository gate:

```text
bun run check
BAML generation: green (14 generated files, no dirty result)
TypeScript: green
Tests: 1941 pass, 1 declared skip, 0 fail
Expectations: 6376
Files: 126
```

`git diff --check` also passed.

No production regression test was added because the spike does not own the fix and should not pin
the current defect as desired behavior. The two committed evidence excerpts are shaped so the
dependent tickets can add the correct assertions after choosing their policies.

## Acceptance assessment

- Real 45-turn transcript replayed with per-message-kind census: met.
- Main-loop versus sidechain/parent split reconciles 45 exactly: met (`12 + 33`).
- Terminal `num_turns` values and ledger value separately counted/cited: met; evidence corrects the
  premise that 45 itself was terminal `num_turns`.
- Sidechain inflation of `progress.turns` answered with counted evidence: met.
- Same-run live versus ledger token figure itemized bucket by bucket: met.
- 105k versus ~214k reproduced: met (104,807 versus 214,621).
- First-event/final-event, skipped kinds, terminal residual each named and quantified: met.
- Every conclusion cites run IDs and counted source lines: met.
- Sanitized fixture excerpts ready for publication/commit by Lisa: met.
- `bun run check` green: met.

## Commit and publication

No ordinary staging or commit command was used. There was no production source unit to pass to
`lisa commit-ticket`; all ticket work is leased attempt evidence. Lisa owns the artifact publication
and completion commit after verifying this Review disposition, as required by the assignment.

## Open concerns and honest limits

- The parent-only assistant-ID count is the existing observable proxy for Claude's capped loop, not
  access to a private executor counter.
- The five result rows in the sidechain transcript cannot be assigned to individual sidechains from
  `parent_tool_use_id` because that field is absent on them.
- The thinking fixture uses one explicit aggregate record instead of retaining 150 transport rows;
  the count, line span, and exact sum are preserved and cross-checked.
- A fresh installed-binary cast remains the epic-level metered verification and is explicitly
  deferred by the story. It is not a blocker for this FREE forensic spike.
- Downstream implementation must decide the live terminal-reconciliation behavior and exact
  sidechain policy; this spike intentionally does not choose for those tickets.

No critical issue blocks T-081-01-02 or T-081-02-01 from proceeding after Lisa completes this
ticket.
