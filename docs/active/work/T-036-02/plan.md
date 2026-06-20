# T-036-02 — Plan: ordered, verifiable steps

Two atomic commits. Each step verifiable in isolation; `bun run check` (which runs `baml:gen` then
typecheck + lint + test) is the gate. Testing strategy stated per step.

## Testing strategy (overview)

- **`renderClientFor`** — PURE ⇒ unit tests with injected `opts`/`env`, no subprocess, no addon
  (`render-client.test.ts`). The fast, exhaustive coverage for part 1's selection logic.
- **Production render wiring** — `decompose-epic.ts`'s `render` is an impure-ish leaf (loads the
  addon); per the house rule it is NOT unit-tested directly. Its *selection* logic is covered by the
  `renderClientFor` units; its *render-shape* behavior is already covered by the bridge render tests
  (which exercise the same `{ client }` surface on a real request).
- **Parse agnosticism** — one new op in the existing batched `runBridge` spawn
  (`decompose.test.ts`), asserting deep equality with the Claude-reply parse. Honors the
  one-native-call-per-process limit (single spawn, batched).
- **Back-compat** — the existing default-render test (anthropic shape) re-proves the no-env path is
  byte-identical after the wiring.

## Commit 1 — coherence (render follows the executor)

### Step 1.1 — extract `resolveExecutorId` in `select.ts`

- Add exported `resolveExecutorId(opts, env)` = the current inline one-liner.
- Change `executorFor` to `const id = resolveExecutorId(opts, env);`.
- **Verify:** `bun test src/executor/select.test.ts` — all existing precedence/default/unknown
  cases pass unchanged (proves the refactor is behavior-preserving). `bun run check` typechecks.

### Step 1.2 — create `src/baml/render-client.ts`

- `OPEN_MODEL_CLIENT`, `RENDER_CLIENT_BY_EXECUTOR` (keyed by `OPENAI_EXECUTOR_ID`), `renderClientFor`.
- Imports: `resolveExecutorId` + `ExecutorSelection` from `../executor/select.ts`;
  `OPENAI_EXECUTOR_ID` from `../executor/openai-compat.ts`.
- **Verify:** typechecks (no consumer yet — fine).

### Step 1.3 — create `src/baml/render-client.test.ts`

- The 7 cases from `structure.md` §4 (defaults ⇒ undefined; openai-compat ⇒ OpenModelStub via env
  and via opt; opt-beats-env; unknown ⇒ undefined; map keyed by real id).
- **Verify:** `bun test src/baml/render-client.test.ts` green. Pure, milliseconds.

### Step 1.4 — wire `decompose-epic.ts` render

- Replace the `render` member with the `renderClientFor()` + base_url-guard + `{ client }`-spread
  form (`structure.md` §3). Add the two imports. Add the one-line "follows VEND_EXECUTOR" note.
- **Verify:** `bun test src/baml/decompose.test.ts` — the existing default-render test still asserts
  anthropic shape (byte-identical default path). `bun run check` green.

### Commit 1

```
feat(baml): render-client follows VEND_EXECUTOR — openai-compat ⇒ OpenModelStub — T-036-02
```
Files: `src/executor/select.ts`, `src/baml/render-client.ts`, `src/baml/render-client.test.ts`,
`src/play/decompose-epic.ts`.

## Commit 2 — agnosticism proof + boundary

### Step 2.1 — parse-agnosticism op in `decompose.test.ts`

- Add `OPEN_MODEL_CANNED` (preamble + ```json fence around the SAME object as `CANNED` + trailing
  remark). Append `{ mode: "parse", text: OPEN_MODEL_CANNED }` as op `[4]` in the `runBridge` batch.
- Add describe "DecomposeEpic — parse is provider-agnostic": assert `results[4]` parses to a
  `WorkPlan` deep-equal to `results[0]` (story id/type/status; ticket ids in order; value triplet +
  depends_on edge). Test name states: parse keys on text, not provider.
- **Verify:** `bun test src/baml/decompose.test.ts` green (single spawn, 5 ops).

### Step 2.2 — boundary in `stack.md`

- Add the "Open-model support — where it stands (E-035 + E-036)" subsection: config-level at both
  layers (authoring E-036 + execution E-035, tied via `VEND_EXECUTOR`); deferred remainder = the
  live agentic open-model runtime (not built, not parity).
- **Verify:** reads cleanly; no over-claim; `bun run lint` (if it lints md) / `bun run check` green.

### Commit 2

```
test(baml): parse proven provider-agnostic; stack.md records open-model boundary — T-036-02
```
Files: `src/baml/decompose.test.ts`, `docs/knowledge/stack.md`.

## Final verification (acceptance mapping)

- AC-1 (render follows executor; default byte-identical) ⇐ steps 1.1–1.4 + `renderClientFor` units +
  the unchanged default-render shape test.
- AC-2 (parse provider-agnostic via bridge, no live model) ⇐ step 2.1.
- AC-3 (stack.md boundary, no over-claim) ⇐ step 2.2.
- AC-4 (`bun run check:*` green) ⇐ run `bun run check` after each commit; full green before done.

## Rollback / risk

- The only production behavior change is the render `{ client }` selection, gated on a non-default
  `VEND_EXECUTOR`. With no env set, `renderClientFor()` ⇒ `undefined` ⇒ the exact request today.
  Reverting Commit 1's `decompose-epic.ts` hunk restores the prior render verbatim.
- `resolveExecutorId` extraction is behavior-preserving; `select.test.ts` is the guard.
- No `.baml` source changes ⇒ no `baml:gen` surprise; the generated client is unchanged.
