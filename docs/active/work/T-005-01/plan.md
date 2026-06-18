# T-005-01 — Plan: ordered, atomically-committable steps

Five implementation steps, each independently verifiable, plus the testing
strategy and the AC-verification matrix. Commit after each green sub-unit.

## Step 1 — Seam: capture the model id (`src/executor/claude.ts`)

1. Widen `ResultMessage` with `model?: string` (+ doc-comment).
2. Add the pure `extractModelId(msg)` beside `parseStreamJsonLine`:
   check `message.model` (object-guarded), then top-level `model`; empty/odd →
   `undefined`; total, never throws.
3. In `makeStreamConsumer`: widen `state` to `{ result; model? }`, and after the
   `onMessage?.(msg)` call do `const id = extractModelId(msg); if (id)
   state.model = id;`. Update the function's return type annotation.
4. In `dispense`: after the null-result throw guard, attach when missing —
   `if (state.result.model === undefined && state.model !== undefined)
   state.result = { ...state.result, model: state.model };`.

**Verify:** `bun run check:typecheck` green. No behaviour change for existing
callers (additive field; runner still compiles).

## Step 2 — Seam tests (`src/executor/claude.test.ts`)

Add a `// ── extractModelId / model capture` block:
- `extractModelId`:
  - `{"type":"assistant","message":{"model":"claude-opus-4-8[1m]"}}` → that id.
  - `{"type":"system","subtype":"init","model":"claude-opus-4-8[1m]"}` → that id.
  - `{"type":"assistant","message":{"role":"assistant"}}` → `undefined`.
  - `{"type":"system","model":""}` → `undefined` (empty ignored).
  - `{"type":"user"}` → `undefined` (totality on odd type).
- `makeStreamConsumer` model capture, fed-lines style:
  - system(init,no model) → assistant(message.model=X) → result(no model):
    `state.model === X`, `state.result` still captured.
  - two model-bearing messages (system top-level=A, assistant message.model=B in
    order) → `state.model === B` (last-non-empty-wins).
  - `SAMPLE_LINES` (no model anywhere) → `state.model === undefined`.

**Verify:** `bun run check:test` green; new cases pass; existing
`makeStreamConsumer`/`SAMPLE_LINES` assertions untouched.

**Commit 1:** "T-005-01: seam surfaces real model id off the dispense stream"
(steps 1–2 together — the seam change plus its pure tests).

## Step 3 — Core: own the sentinel + add the resolver (`decompose-epic-core.ts`)

1. Add `export const DEFAULT_MODEL = "claude-cli-default";` (with doc-comment).
2. Add `export function resolveLoggedModel(real, opt): string { return real ??
   opt ?? DEFAULT_MODEL; }` near the other pure helpers.

**Verify:** `tsc --noEmit` — at this point `decompose-epic.ts` still declares its
own `DEFAULT_MODEL`, a **duplicate-export collision** through `export *`. Expect
a typecheck error until Step 4 removes the local decl. (Do steps 3+4 as one
edit-unit; don't typecheck between them.)

## Step 4 — Runner: resolve downstream of dispense (`decompose-epic.ts`)

1. Delete the local `export const DEFAULT_MODEL = …;` (L43).
2. Delete `const model = opts.model ?? DEFAULT_MODEL;` (L108).
3. Add `resolveLoggedModel` to the named import from `./decompose-epic-core.ts`.
4. After the seam try/catch (where `result`/`timedOut` are settled), add
   `const loggedModel = resolveLoggedModel(result?.model, opts.model);`.
5. In `appendRunLog({ … })`, change `model,` → `model: loggedModel,`.

**Verify:** `bun run check:typecheck` green (duplicate-export resolved); grep
confirms no other `model` reference in the runner broke.

## Step 5 — Core test (`decompose-epic.test.ts`)

Add `DEFAULT_MODEL`, `resolveLoggedModel` to the import from
`./decompose-epic-core.ts`, and a `describe("resolveLoggedModel")`:
- real present (`+ opt present`) → returns real.
- real absent, opt present → returns opt.
- both absent → returns `DEFAULT_MODEL` (AC #3's named fallback).

**Verify:** `bun run check:test` — full suite green.

**Commit 2:** "T-005-01: stamp real model id in run log (fallback to sentinel)"
(steps 3–5 — the runner now logs the stream's id, with the pure fallback test).

## Testing strategy

- **Unit, pure, no spawn** (the whole of it): the capture (`extractModelId`,
  consumer) is tested in `claude.test.ts` by feeding sample lines; the fallback
  (`resolveLoggedModel`) in `decompose-epic.test.ts` as a pure-function table.
  This satisfies AC #3 directly and keeps `dispense` the lone untested verb.
- **No new live `claude` spawn.** AC #4's "logged model equals the real id" is
  already evidenced live by `T-002-04/results/summary.json`
  (`claude-opus-4-8[1m]` recovered off every transcript). This ticket converts
  that hand-recovery into an automatic stamp; the seam→consumer→result→log path
  is exercised end-to-end by the unit tests at each seam.
- **Regression guard:** the existing `makeStreamConsumer` and `SAMPLE_LINES`
  assertions must remain unchanged and green — proof the capture addition is
  non-disruptive.

## AC-verification matrix

| AC | Satisfied by | Verified by |
|---|---|---|
| #1 seam surfaces `message.model` on result (type `model?`) | Step 1 (extractModelId + dispense attach + type) | Step 2 consumer/extract tests; typecheck |
| #2 runner stamps real id, else `opts.model`, else sentinel | Step 4 `loggedModel` + Step 3 `resolveLoggedModel` | Step 5 fallback table |
| #3 unit test covers fallback; pure, no live spawn | Step 3 resolver in pure core | Step 5 `resolveLoggedModel` test (no spawn) |
| #4 logged `model` == real stream id; checks green | Steps 1+4 wired path | `summary.json` live evidence; `bun run check` green |

## Rollback / risk

- The only cross-module move is `DEFAULT_MODEL`; if the `export *` re-export ever
  surprised a consumer, the fix is a one-line re-add — but grep (Research §run-log)
  found only in-file references, so risk is minimal.
- Spread-on-attach allocates one extra object per dispense — negligible, once
  per run.
