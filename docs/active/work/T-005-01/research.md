# T-005-01 — Research: thread the real model id through the runner

Descriptive map of where the model id is produced, lost, and logged today. No
solutions here — that is Design's job.

## The problem, precisely

`runs.jsonl` stamps `model: "claude-cli-default"` on every record, while the
**real** model that did the work — `claude-opus-4-8[1m]` — rode past on the
dispense stream and was discarded. The consistency layer (the reason the run log
exists at all — `steering-data-model.md`, charter's "you got what you paid for")
reads a sentinel, not truth. The proof confirmed this live: `work/T-002-04/proof.md`
kaizen #3, and `results/summary.json` recovered `claude-opus-4-8[1m]` off every
transcript by hand.

## The three sites involved

### 1. The seam — `src/executor/claude.ts`

`dispense()` (the single impure verb) spawns `claude -p --output-format
stream-json --verbose`, streams every message through `makeStreamConsumer`, and
returns the terminal `result` message (`ResultMessage`). The pure spine:

- `parseStreamJsonLine` — JSON-parse one line, tolerate noise (returns `null`).
- `createLineBuffer` — chunk-boundary-tolerant newline splitter.
- `makeStreamConsumer(onMessage)` — the canonical parse/route/capture path:
  routes each message to `onMessage` in order and captures the terminal
  `result` into `state.result`. **This is the single place every message is
  already seen in order.** It returns `{ buffer, state: { result } }`.
- `ResultMessage = StreamMessage & { type:"result"; subtype; result?; usage?;
  total_cost_usd? }` — an OPEN record (extends `StreamMessage = {type} &
  Record<string,unknown>`), so adding a field to the type is non-breaking.

Crucially: `dispense` returns the terminal `result` message **only**. The model
id does **not** ride on the terminal `result` — it rides on earlier messages
(see §4). So today nothing the runner receives carries the real id.

Purity discipline (house pattern, memory 20402): everything except `dispense`
is pure and unit-tested in `claude.test.ts` with `SAMPLE_LINES` fed straight
into `makeStreamConsumer` — **no live spawn**. `dispense` is the one untested
verb. AC #3 ("capture/shaping pure, tested without a live spawn") fits this mold
exactly: the capture belongs in a pure helper exercised through the consumer.

### 2. The runner — `src/play/decompose-epic.ts`

`runDecomposeEpic` is the impure orchestrator. Relevant lines:

- L108: `const model = opts.model ?? DEFAULT_MODEL;` — resolved **before**
  dispense, so it can never see what the stream reported.
- L43: `export const DEFAULT_MODEL = "claude-cli-default";` — the sentinel.
- L134–139: `result = await dispense({ prompt, model: opts.model, … })`. Note it
  passes `opts.model` (undefined ⇒ no `--model` flag ⇒ CLI default), NOT the
  resolved `model`.
- L190–201: `appendRunLog({ … model, … })` — the only consumer of `model`. So
  `model` (L108) is used at exactly one site, downstream of dispense.

`result` is `ResultMessage | null` (null on timeout). Whatever new field the seam
surfaces is reachable here as `result?.<field>`.

### 3. The pure core — `src/play/decompose-epic-core.ts`

The baml-free module holding the runner's judgment (`classify`, `gateRowsFor`,
`formatMessage`, `makeStreamSink`). `decompose-epic.ts` does `export * from
"./decompose-epic-core.ts"`, so anything defined here is re-exported from the
runner module — a path to making a constant/helper testable WITHOUT loading the
BAML addon (the reason this split exists: memory 20275, 20402). `DEFAULT_MODEL`
is **not** here today; it sits in the impure module, so a pure fallback test
cannot reach it from `decompose-epic.test.ts`.

### 4. Where the real id actually lives on the stream

Two independent observations, both naming `claude-opus-4-8[1m]`:

- **Proof kaizen #3** (`proof.md:90–93`): "the consistency layer … must read it
  off the terminal `result` (this driver does)." But the driver's own code
  (`live-proof.ts:96`) reads `if (typeof msg.model === "string") model =
  msg.model;` over **every** message with the comment `// system init carries
  it`, last-write-wins. So the driver in fact harvests a **top-level `model`**
  string off whichever messages carry one (the `system`/`init` message does).
- **Ticket AC #1** points at the **assistant** message's nested
  `message.model` (`{"type":"assistant","message":{…,"model":"…"}}`).

So the id appears in (at least) two shapes on the stream:
  - `system`/init: top-level `msg.model` (string).
  - `assistant`: nested `msg.message.model` (string).

`claude.test.ts:110` already has an assistant fixture
(`{"type":"assistant","message":{"role":"assistant","usage":{…}}}`) — no `model`
key yet, but the nesting shape is established. A robust capture must tolerate
both shapes and the absence of either.

## The run-log sink — `src/log/run-log.ts`

`appendRunLog` → `buildRunRecord` (pure) requires a **non-empty** `model` string
(`assertNonEmpty(input.model, "model")`, L164) and freezes it onto the record
(L173). So whatever the runner resolves must never be empty — the
`… ?? DEFAULT_MODEL` tail is load-bearing, not cosmetic. The log is structurally
decoupled (imports nothing from executor/budget); it just records the string the
runner hands it. No change needed here — `model` is already a first-class field.

## Constraints & assumptions

- **Open record types.** `ResultMessage`/`StreamMessage` are open, so extending
  the result type with `model?: string` is additive and non-breaking.
- **Stream order.** `makeStreamConsumer` sees system → assistant(s) → result in
  order; the model id arrives **before** the terminal result. Capture must
  happen during the walk, not from the returned `result` alone.
- **Purity / no-spawn test rule.** The capture+fallback shaping must be pure and
  tested via fed sample lines, never a live `claude`. `dispense` stays the lone
  untested verb.
- **BAML-addon test isolation.** A pure fallback test must live in
  `decompose-epic.test.ts`, which imports only `decompose-epic-core.ts`. Any
  constant/helper it needs (`DEFAULT_MODEL`, a resolver) must be reachable
  without value-importing `decompose-epic.ts`.
- **Dependency on T-004-02 (now merged, `639efd0`).** Both edit
  `decompose-epic.ts` near the `appendRunLog` stamping site; serialized by the
  file-overlap rule, not logic coupling. T-004-02 added the `id-collision`
  outcome relabel just above `appendRunLog` — the diff lands adjacent to it.
- **Tooling.** `bun run check:typecheck` (`tsc --noEmit`) and `bun run
  check:test` (`bun test`) are the green-bar gates.

## What success reads like

A run's `runs.jsonl` record shows `"model":"claude-opus-4-8[1m]"` (the stream's
real id) instead of `"claude-cli-default"`, with the sentinel surviving only as
the genuine last-resort fallback (timeout, or a stream that named no model).
