# Plan — T-072-02-01

## Goal

Land a pure, immutable accumulator and formatter that converts the existing
executor stream into a humane elapsed/spend/turn line, with price-true spend and
turn-level deduplication proven by fixture.

## Acceptance mapping

| Acceptance clause | Implementation | Verification |
|---|---|---|
| feed fixture `StreamMessage` sequence | reducer over open transport records | main fixture test |
| extract per-turn usage | nested assistant `message.usage` extraction | mixed-bucket usage fixture |
| weight via `countTokens` | direct import and call | weighted total differs from parity |
| render target shape | pure formatter | exact full-line equality |
| usage-less messages do not crash | structural guards/no-op | malformed/no-usage cases |
| unknown types do not count | exact assistant discriminator | lookalike unknown event |
| repeated turn does not double-count | nested message-ID seen set | duplicate block fixture |

## Step 1 — Add progress core

Modify `src/engine/cast-core.ts`.

Tasks:

1. Convert the budget import to a mixed runtime/type import.
2. Add `CastProgress` and frozen `EMPTY_CAST_PROGRESS`.
3. Add a private record guard for open JSON traversal.
4. Add private assistant-turn extraction.
5. Add `accumulateCastProgress` as an immutable reducer.
6. Add `CastProgressFormat`.
7. Add private elapsed and token humane formatters.
8. Add `formatCastProgress`.
9. Keep all existing stream functions unchanged.

Local correctness criteria:

- no effect imports;
- no use of `Date`, `process`, filesystem, or network;
- no mutation of message or prior state;
- duplicate IDs return the prior state;
- only assistant nested usage reaches `countTokens`.

## Step 2 — Add acceptance fixture

Modify `src/engine/cast-core.test.ts`.

Tasks:

1. Import the new state, reducer, and formatter.
2. Define a fixture with seven unique assistant IDs.
3. Repeat at least one ID across multiple assistant blocks.
4. Include system/user/unknown/result events.
5. Choose usage buckets totaling exactly 210,000 weighted units.
6. Reduce the entire fixture.
7. Assert seven turns and 210,000 weighted tokens.
8. Assert exact target line for 252 seconds, 500,000 funding, cap 15.

Fixture arithmetic should deliberately exercise weights. A convenient per-turn
mix can total 30,000 weighted units, repeated across seven unique IDs:

```text
input 10,000 × 1.0 = 10,000
output 4,000 × 5.0 = 20,000
per turn             = 30,000
seven turns          = 210,000
```

The repeated stream block for a turn carries the same ID and usage, so an
incorrect event-level accumulator would exceed 210,000 and fail.

## Step 3 — Add defensive and formatting cases

In the same test file, add focused assertions for:

- duplicate accepted message returns unchanged progress;
- system/user/result usage is ignored;
- unknown type with assistant-shaped nested data is ignored;
- missing, null, or array nested records are ignored without throwing;
- missing ID or missing usage is ignored;
- no maximum turn cap renders `turn N`;
- second/minute/hour elapsed formatting is stable;
- small token values render without `k`.

Avoid testing private helpers directly; assert public line output.

## Step 4 — Focused verification

Run:

```bash
bun test src/engine/cast-core.test.ts
```

Pass criteria:

- process exit zero;
- all pre-existing cast-core tests remain green;
- new acceptance and defensive cases pass;
- no native addon or live executor is loaded.

If focused tests fail, correct only ticket-owned files and rerun before moving
to repository verification.

## Step 5 — Repository gate

Run:

```bash
bun run check
```

Pass criteria:

- BAML generation succeeds;
- TypeScript check succeeds under strict/no-unchecked-index rules;
- full test suite succeeds;
- no live cast or metered model call is performed.

Record counts and any warnings in `progress.md`.

## Step 6 — Commit ticket-owned source

Inspect status and diff first. Preserve Lisa's ticket frontmatter changes and all
unrelated worktree changes.

Commit using only:

```bash
lisa commit-ticket T-072-02-01 \
  --include src/engine/cast-core.ts \
  --include src/engine/cast-core.test.ts \
  --message "feat(engine): add cast progress accumulator core"
```

Use the actual CLI option spelling shown by `lisa commit-ticket --help` if it
differs. Do not use `git add` or ordinary `git commit`.

Verify afterward that neither source path is staged, modified, nor untracked.

## Step 7 — Review artifact

Write attempt-private `review.md` covering:

- exact source files changed;
- public API added;
- deduplication and accounting rationale;
- test coverage and full-gate result;
- explicit non-changes to cast wiring and transcript behavior;
- any open concerns for `T-072-02-02`.

Then stop on this ticket. Lisa owns publication and completion transition.

## Atomicity

The production core and its acceptance fixture form one meaningful source unit:
the new API has no caller until the dependent ticket, while the tests are its
current executable contract. Commit both exact paths together after the gate.

## Risk controls

| Risk | Control |
|---|---|
| double-count content blocks | dedupe by nested `message.id` |
| double-count final result | accept only `assistant` type |
| malformed external JSON throws | guarded record descent |
| live spend diverges from P7 settlement | call canonical `countTokens` |
| formatter reads real time | require injected `elapsedMs` |
| uncapped play displays false denominator | omit denominator when absent |
| scope leaks into wiring | do not modify `cast.ts` or `cast.test.ts` |
| transcript behavior changes | leave `makeStreamSink` untouched |
| unrelated work enters commit | exact Lisa include paths only |

## Expected final state

- `src/engine/cast-core.ts` exports the settled pure progress API.
- `src/engine/cast-core.test.ts` proves the exact requested line.
- Focused and full gates are green.
- Ticket-owned source is committed through Lisa.
- All six attempt artifacts exist in the private attempt directory.
- No live model tokens are spent.
