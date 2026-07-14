# T-005-01 — Structure: file-level blueprint

The shape of the change. Three source files modified, two test files extended.
No files created or deleted. Ordering matters where a symbol moves between
modules (D5).

## Files touched

| File | Kind | Change |
|---|---|---|
| `src/executor/claude.ts` | modify | add `extractModelId`; widen `ResultMessage` with `model?`; capture model in `makeStreamConsumer`; attach in `dispense` |
| `src/play/decompose-epic-core.ts` | modify | own `DEFAULT_MODEL` (moved here); add `resolveLoggedModel` |
| `src/play/decompose-epic.ts` | modify | drop local `DEFAULT_MODEL` decl; resolve logged model after dispense |
| `src/executor/claude.test.ts` | modify | tests for `extractModelId` + consumer model capture |
| `src/play/decompose-epic.test.ts` | modify | test for `resolveLoggedModel` fallback |

## `src/executor/claude.ts`

### Type change — `ResultMessage`
Add one optional field (additive, open record):
```ts
export type ResultMessage = StreamMessage & {
  type: "result";
  subtype: string;
  result?: string;
  usage?: Record<string, unknown>;
  total_cost_usd?: number;
  /** Real model id observed on the dispense stream (system/assistant), attached
   *  by `dispense`; absent when the stream named none (e.g. an early failure). */
  model?: string;
};
```

### New pure function — `extractModelId`
Placed beside `parseStreamJsonLine` (the other "pull a value out of one external
message" pure helper). Signature:
```ts
export function extractModelId(msg: StreamMessage): string | undefined
```
Checks `message.model` (assistant) then top-level `model` (system init); returns
`undefined` for neither / empty / odd shape. Total, never throws. (Design D2.)

### `makeStreamConsumer` — capture model alongside result
State widens; capture is last-non-empty-wins:
```ts
const state: { result: ResultMessage | null; model?: string } = { result: null };
const buffer = createLineBuffer((line) => {
  const msg = parseStreamJsonLine(line);
  if (!msg) return;
  onMessage?.(msg);
  const id = extractModelId(msg);
  if (id) state.model = id;
  if (msg.type === "result") state.result = msg as ResultMessage;
});
```
Return type of the function updates to `state: { result: ResultMessage | null;
model?: string }`. The existing JSDoc gains a sentence about the model capture.

### `dispense` — attach captured id to the returned result
After the `state.result === null` throw guard, before `return`:
```ts
if (state.result.model === undefined && state.model !== undefined) {
  state.result = { ...state.result, model: state.model };
}
return state.result;
```
A fresh object (spread) so `onMessage` consumers' by-reference message is never
mutated (Design D3). The module-header note "returns the terminal `result`
message" stays accurate — it's the same message, now carrying the observed id.

## `src/play/decompose-epic-core.ts`

### Constant moved in — `DEFAULT_MODEL`
```ts
/** Logged when no real id was observed and the caller pinned none; the seam
 *  omits `--model` in that case. */
export const DEFAULT_MODEL = "claude-cli-default";
```
Lives here (the pure core) so the no-BAML test reaches it. Re-exported from
`decompose-epic.ts` via its existing `export *` — callers importing it from the
runner module are unaffected.

### New pure function — `resolveLoggedModel`
```ts
/** Pick the model id to stamp on the run log: the real id observed on the
 *  stream, else the caller's pinned id, else the sentinel. PURE. */
export function resolveLoggedModel(real: string | undefined, opt: string | undefined): string {
  return real ?? opt ?? DEFAULT_MODEL;
}
```
Placed near the top with the other exported helpers (after `gateRowsFor` or
before `classify` — grouped with the pure decision functions).

## `src/play/decompose-epic.ts`

- **Remove** L43 `export const DEFAULT_MODEL = "claude-cli-default";` (now
  re-exported from core via `export *`). The `{@link DEFAULT_MODEL}` JSDoc refs
  (L51) still resolve to the re-exported symbol.
- **Remove** L108 `const model = opts.model ?? DEFAULT_MODEL;` (eager, pre-stream).
- **Import** `resolveLoggedModel` — it arrives through the existing
  `export * from "./decompose-epic-core.ts"`, but the runner needs a direct
  named import to call it. Add `resolveLoggedModel` to the existing
  `import { classify, makeStreamSink } from "./decompose-epic-core.ts";` (L33).
- **Add**, after the seam try/catch block resolves `result` (after L143, where
  both `result` and `timedOut` are known), before `appendRunLog`:
  ```ts
  const loggedModel = resolveLoggedModel(result?.model, opts.model);
  ```
- **Change** the `appendRunLog` call (L196) `model,` → `model: loggedModel,`.

Net: `model` is now resolved *downstream* of dispense, so the stream's id is in
scope. No other line in the runner references the old `model` const (Research §2
confirmed single-use), so the move is safe.

## Test files

### `src/executor/claude.test.ts`
A new block after the `makeStreamConsumer` tests:
- `extractModelId` unit cases (assistant nested, system top-level, none, empty,
  unknown type).
- `makeStreamConsumer` model-capture cases reusing the `SAMPLE_LINES` idiom: a
  stream whose assistant carries `message.model` → `state.model` captured;
  last-non-empty-wins when two messages name a model; a model-less stream →
  `state.model` undefined.
- Extend the existing `SAMPLE_LINES` or add a local `MODEL_LINES` fixture
  (prefer a local fixture so the existing assertions stay untouched).

### `src/play/decompose-epic.test.ts`
Add `resolveLoggedModel` to the import from `./decompose-epic-core.ts`, and a
small `describe` block: real wins; opt-only; neither → `DEFAULT_MODEL` (import
`DEFAULT_MODEL` too, from the core module).

## Ordering of changes

1. `claude.ts` (type + `extractModelId` + consumer + dispense) — self-contained.
2. `claude.test.ts` — green before touching the runner.
3. `decompose-epic-core.ts` (move `DEFAULT_MODEL`, add resolver).
4. `decompose-epic.ts` (drop local const, import + call resolver) — depends on 3.
5. `decompose-epic.test.ts`.
6. `bun run check:typecheck && bun run check:test` — full green bar.

## Public-surface delta

- `claude.ts`: `+extractModelId`, `ResultMessage.model?` (both additive).
- `decompose-epic-core.ts`: `+resolveLoggedModel`, `+DEFAULT_MODEL` (moved in).
- `decompose-epic.ts`: `DEFAULT_MODEL` now re-exported, not declared (no
  import-site change for any consumer).
No removals from any module's *effective* exported surface.
