# Structure — T-077-01-01

## Change inventory

### Modified

`src/engine/cast.test.ts`

- Add two value imports used only by the new characterization:
  - `buildArgs` from `src/executor/claude.ts`.
  - `DECOMPOSE_MAX_TURNS` from `src/play/decompose-epic-core.ts`.
- Add a small decompose-shaped play fixture or construct it locally in the test.
- Add one integration test covering argv, stream accumulation, terminal result, transcript, ledger,
  stdout, and current settlement.

### Created implementation files

None.

### Deleted files

None.

### Production modules modified

None.

## Attempt artifacts

The following private artifacts are created under the assignment-owned attempt directory:

- `research.md`
- `design.md`
- `structure.md`
- `plan.md`
- `progress.md`
- `review.md`
- `review-disposition.json`

They are not included in the ticket source commit. Lisa owns their admission and publication.

## Import boundary

`src/engine/cast.test.ts` already imports:

- the impure `castPlay` shell;
- executor interfaces as types;
- run-log readers/serializers;
- play and budget types;
- filesystem and temporary-directory helpers.

The new imports are deliberately narrow:

```ts
import { buildArgs } from "../executor/claude.ts";
import { DECOMPOSE_MAX_TURNS } from "../play/decompose-epic-core.ts";
```

`decompose-epic-core.ts` is the addon-free policy module. The test must not value-import
`decompose-epic.ts`, because that concrete play imports the BAML runtime and unrelated materializer
behavior.

## Test-local play boundary

The test needs a `Play<{ epic: string }, { text: string }>` carrying the decompose default.

Its structure:

```ts
const play: Play<{ epic: string }, { text: string }> = {
  name: "decompose-epic",
  summary: "...",
  render: ({ epic }) => `decompose fixture: ${epic}`,
  parse: (text) => ({ text }),
  gates: () => ({ status: "clear", cleared: ["fixture-contract"] }),
  effect: async (output) => { ... },
  maxTurns: DECOMPOSE_MAX_TURNS,
  budget: BIG_BUDGET,
  card: { ... },
};
```

The play owns only enough behavior to let the generic shell reach settlement. It has no filesystem
effect and no BAML parsing.

## Test-local executor boundary

The injected `Executor` has:

- `id: "claude"`, so the existing executor-lane mapping remains realistic;
- `probe()` returning `{ ok: true }`;
- `dispense(opts)` storing the received options or derived argv;
- `dispense(opts)` streaming controlled messages through `opts.onMessage` in order;
- `dispense(opts)` returning the same terminal result object that it streamed.

It does not spawn, fetch, read environment variables, or touch process-global executor selection.

## Message fixture boundary

The assistant message factory returns a plain `StreamMessage`:

```ts
{
  type: "assistant",
  message: {
    id: `cap-turn-${n}`,
    role: "assistant",
    model: "stub-model-cap-hit",
    usage: { input_tokens: 1 },
  },
}
```

The terminal result is a `ResultMessage` with:

- `type: "result"`;
- `subtype: "error_max_turns"`;
- parseable `result` text;
- cumulative usage within `BIG_BUDGET`;
- `total_cost_usd`;
- `model`;
- `num_turns: 23`.

The stream should contain:

1. system/init;
2. unique assistant IDs one through fifteen;
3. an explicit duplicate of an existing ID;
4. terminal cap-hit result.

Placing the duplicate between unique messages demonstrates that deduplication is order-independent
within the normal callback sequence.

## Captured outputs

The test reuses existing suite helpers:

- `tmp()` for an isolated project root;
- `captureStdout()` for the impure live and settlement surfaces;
- `readFile()` for transcript and run log.

Stable paths:

- run log: `join(root, "runs.jsonl")`;
- transcript: `join(root, `${runId}.jsonl`)` by passing `transcriptDir: root`;
- no artifact path is expected because the fixture effect writes nothing.

## Assertions by boundary

### Cast to executor options

- The executor receives `opts.maxTurns === DECOMPOSE_MAX_TURNS`.
- Production `buildArgs(opts)` equals the base Claude argv plus `--max-turns`, `15`.

### Raw stream and transcript

- Transcript JSON lines preserve all streamed messages in order.
- Raw assistant event count is sixteen when one of fifteen IDs is repeated.
- Unique nested assistant message-ID count is fifteen.
- The final transcript row has `type: "result"` and `subtype: "error_max_turns"`.

### Accumulator and presentation

- Captured stdout contains the final summary line with agent turns `15 / 15 cap`.
- The same line labels executor conversation events as `23`.
- It does not contain `23 / 15 cap`.

### Terminal result and ledger

- The returned cast summary settles according to current behavior.
- The fixture effect receives the cap-hit result text if gates clear.
- The run record has `play: "decompose-epic"`.
- The run record has `turnsUsed: 23`.
- The run record outcome matches the returned summary.
- No new cap-hit property is asserted or introduced.

## Architectural boundaries preserved

- Pure policy remains in existing core modules.
- The impure shell remains unchanged.
- Executor process behavior remains owned by `src/executor/claude.ts`.
- The test calls the existing pure argv builder rather than duplicating its rules.
- External terminal data remains unmodified.
- The raw transcript remains the record of executor subtype.
- The ledger remains backward-compatible.

## Commit boundary

There is one meaningful ticket-owned source unit:

- `src/engine/cast.test.ts`

It will be committed only after focused and full verification, using:

```sh
lisa commit-ticket \
  --ticket-id T-077-01-01 \
  --message "test(engine): characterize decompose max-turns seam" \
  --include src/engine/cast.test.ts
```

No ordinary `git add` or `git commit` operation will be used.

## Ordering

1. Update imports.
2. Add the test near the existing cast progress integration test, since both exercise the same
   `onMessage`/stdout/transcript shell.
3. Run focused test and typecheck.
4. Run the full gate.
5. Commit the single exact path through Lisa.
6. Confirm the source path is clean while leaving Lisa ticket metadata untouched.
7. Finish private progress and review artifacts.

## Non-changes

- Do not modify `src/engine/cast.ts`.
- Do not modify `src/engine/cast-core.ts`.
- Do not modify `src/executor/claude.ts`.
- Do not modify existing pure tests.
- Do not change `DECOMPOSE_MAX_TURNS`.
- Do not add a CLI flag.
- Do not add cap-hit outcome handling.
- Do not add resume or repair actions.
- Do not edit ticket/story frontmatter or shared work artifacts.
