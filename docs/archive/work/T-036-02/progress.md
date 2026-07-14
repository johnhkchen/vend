# T-036-02 — Progress

## Commit 1 — coherence (render follows the executor) ✅

- **1.1** `select.ts`: extracted exported `resolveExecutorId(opts, env)`; `executorFor` now calls
  it. Behavior-preserving — `select.test.ts` passes unchanged.
- **1.2** `src/baml/render-client.ts` created: `OPEN_MODEL_CLIENT`, `RENDER_CLIENT_BY_EXECUTOR`
  (keyed by `OPENAI_EXECUTOR_ID`), pure `renderClientFor(opts, env)`.
- **1.3** `src/baml/render-client.test.ts` created: 8 pure cases (defaults ⇒ undefined; openai-compat
  via env + via opt ⇒ OpenModelStub; opt-beats-env; unknown ⇒ undefined; map keyed by real id).
- **1.4** `decompose-epic.ts` render rewired: resolves the client via `renderClientFor()`, defaults
  `VEND_OPENAI_BASE_URL` when open-model, spreads `{ client }`. Default path omits the option ⇒
  byte-identical. Added the "follows VEND_EXECUTOR / accepted boundary" code note.

**Verify:** `bun run baml:gen` OK; `tsc --noEmit` clean; `bun test` on render-client + select +
decompose = 29 pass / 0 fail. Committed.

## Commit 2 — agnosticism proof + boundary ✅

- **2.1** `decompose.test.ts`: added `OPEN_MODEL_CANNED` (preamble + ```json fence around the SAME
  object as `CANNED` + trailing remark); appended it as parse op `[4]` in the single `runBridge`
  batch; new describe "parse is provider-agnostic" asserts `[4]` parses deep-equal to `[0]` (story,
  ticket ids/order, value triplet + depends_on). Existing op indices `[0]–[3]` unchanged.
- **2.2** `stack.md`: added "Open-model support — where it stands (E-035 + E-036)" subsection —
  config-level at both layers (authoring + execution, tied via `VEND_EXECUTOR`); the live agentic
  open-model runtime named as the deferred remainder, not over-claimed as parity.

**Verify:** full `bun run check` green (see review.md). Committed.

## Deviations from plan

- None of substance. The `render-client.test.ts` grew from the planned 7 cases to 8 (split the
  map-keying assertion to also assert `claude` is absent) — additive, same intent.
- The base_url default guard in the production render closure was anticipated in design/structure
  (the executor-vs-client base_url asymmetry); implemented exactly as specified. Worth a reviewer's
  eye since it mutates `process.env` — but only on the non-default (open-model) path, render-only,
  and `??=`-guarded (mirrors the established bridge pattern).
