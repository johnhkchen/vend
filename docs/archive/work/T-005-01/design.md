# T-005-01 — Design: capture the stream's model id, stamp it in the log

Decisions, grounded in Research. One choice per question, with the rejected
alternatives and why.

## D1 — Where is the model id captured? → In the seam, during the stream walk

The id rides on `system`/`assistant` messages and is **gone** by the terminal
`result` (Research §4). So capture must happen while every message is still in
hand. `makeStreamConsumer` is already the one place every message passes through
in order — it is the natural capture point.

- **Chosen:** extend `makeStreamConsumer`'s `state` from `{ result }` to
  `{ result, model }`, populating `model` via a pure `extractModelId(msg)` as
  each message routes. `dispense` then attaches `state.model` onto the
  `ResultMessage` it returns, surfacing it on the seam's public result (AC #1).
- **Rejected — make the runner parse the transcript** (what `live-proof.ts`
  did): re-reads a file the runner already streamed, couples the runner to the
  transcript format, and can't run on a timed-out run with no transcript. The
  seam already holds the bytes; harvest there.
- **Rejected — read it off `opts.model`:** that's the *requested* id, not the
  *real* one. When `opts.model` is undefined (the common case ⇒ CLI default) it
  tells us nothing; the whole point is to learn what the CLI actually chose.

## D2 — How is the id extracted from a message? → A pure, total `extractModelId`

A single pure helper, tolerant of both observed shapes and of noise:

```ts
export function extractModelId(msg: StreamMessage): string | undefined {
  // assistant: nested message.model (the id that generated the reply) — preferred
  const inner = (msg as { message?: unknown }).message;
  if (inner && typeof inner === "object") {
    const m = (inner as { model?: unknown }).model;
    if (typeof m === "string" && m) return m;
  }
  // system/init: top-level model
  const top = (msg as { model?: unknown }).model;
  if (typeof top === "string" && top) return top;
  return undefined;
}
```

- Checks `message.model` first (the assistant message — the id that actually
  produced the work, AC #1's named source), then top-level `model` (system
  init). Both observed carrying `claude-opus-4-8[1m]` (Research §4).
- **Total:** never throws on an unknown/odd `type`; returns `undefined` when no
  id is present — mirrors `formatMessage`/`parseStreamJsonLine`'s "tolerate the
  external stream" discipline.
- Ignores empty strings (`&& m`) so a `"model":""` never masks a later real id.

### Capture precedence in the consumer → last non-empty wins

In `makeStreamConsumer`, `const id = extractModelId(msg); if (id) state.model =
id;`. Last-write-wins over the stream. Rationale: system init appears first, the
assistant message(s) after; letting a later assistant id overwrite an earlier
system id lands on the message that did the work, and an absent later id never
clobbers an earlier capture. Matches `live-proof.ts:96`'s last-wins behaviour.

## D3 — How does `dispense` surface it? → Attach to the returned result; widen the type

`ResultMessage` is an open record, so widening is additive:

```ts
export type ResultMessage = StreamMessage & { …; model?: string };
```

In `dispense`, after `buffer.flush()` and the null check, attach the captured id
**only when the result doesn't already carry one and we observed one**:

```ts
if (state.result.model === undefined && state.model !== undefined) {
  state.result = { ...state.result, model: state.model };
}
return state.result;
```

- **Why a spread, not a mutation:** `onMessage` consumers received the original
  `result` object by reference (the seam's contract says it must not be mutated
  for them). A fresh object for the return value keeps that promise.
- **Why "only when result lacks one":** if a future CLI ever stamps `model`
  directly on the terminal `result`, that authoritative value wins untouched.
- **Rejected — a separate `{ result, model }` return tuple:** breaks every
  existing caller of `dispense` (the runner destructures a `ResultMessage`) for
  no gain; the open record already has room.

## D4 — How does the runner choose what to log? → `result?.model ?? opts.model ?? DEFAULT_MODEL`

The AC names the exact precedence: real id, then the pinned request, then the
sentinel. Replace the eager L108 `const model = opts.model ?? DEFAULT_MODEL`
(computed before dispense, blind to the stream) with a resolution taken **after**
dispense, where `result` exists:

```ts
const loggedModel = resolveLoggedModel(result?.model, opts.model);
```

- On a clean run: `result.model` = `claude-opus-4-8[1m]` → logged. ✓ (AC #4)
- On `opts.model` pinned but the stream silent: falls to `opts.model`.
- On timeout (`result === null`) with no pin: falls to `DEFAULT_MODEL`. ✓ (AC #3)

`appendRunLog` requires a non-empty model (Research, run-log §); the
`?? DEFAULT_MODEL` tail guarantees it.

## D5 — Where does the fallback resolver live? → In the pure core, so it's testable

AC #3 wants the shaping "pure and tested without a live spawn", and the no-BAML
test file (`decompose-epic.test.ts`) imports only `decompose-epic-core.ts`. So:

- **Move `DEFAULT_MODEL`** from `decompose-epic.ts` into `decompose-epic-core.ts`.
  The runner already does `export * from "./decompose-epic-core.ts"`, so
  `import { DEFAULT_MODEL } from "./decompose-epic.ts"` keeps resolving — no
  external breakage. (Only in-file references exist today; Research §run-log.)
- **Add `resolveLoggedModel(real?, opt?)`** to the core:
  `return real ?? opt ?? DEFAULT_MODEL;`. Trivial, but putting it in the pure
  core makes AC #3's fallback test a plain pure-function assertion.
- **Rejected — inline the `??` chain in the runner:** untestable without
  spawning/loading BAML; AC #3 explicitly asks for a pure test.
- **Rejected — leave `DEFAULT_MODEL` in the impure module and duplicate the
  sentinel in core:** two sources of truth for one string; a drift hazard.

## D6 — Test strategy → two pure suites, no live spawn

1. **`claude.test.ts`** (already no-BAML, fed-lines style):
   - `extractModelId`: assistant `message.model` → returns it; system top-level
     `model` → returns it; neither → `undefined`; empty string → `undefined`;
     unknown `type` → `undefined` (totality).
   - `makeStreamConsumer`: a stream with a system+assistant carrying the id and a
     terminal result without one → `state.model` captured; last-non-empty-wins
     ordering; a stream naming no model → `state.model` undefined.
2. **`decompose-epic.test.ts`** (no-BAML core):
   - `resolveLoggedModel`: real present → real; only opt → opt; neither →
     `DEFAULT_MODEL` (AC #3's named fallback case).

The live end-to-end confirmation (AC #4, "a run's logged model equals the real
id") is already evidenced by `T-002-04/results/summary.json` recovering
`claude-opus-4-8[1m]`; this ticket makes the runner log automatically what the
proof harvested by hand. No new live spawn is added (P: the seam's `dispense`
stays the one untested verb).

## What is deliberately NOT done

- No change to `run-log.ts` — `model` is already a first-class, validated field.
- No `--model` flag behaviour change — `dispense` still passes `opts.model`
  (undefined ⇒ CLI default); we only *observe* what the CLI reports.
- No transcript re-reading, no new I/O. Pure capture on bytes already in hand.
