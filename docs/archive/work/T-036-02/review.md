# T-036-02 — Review: open-model path coherence + parse agnosticism + boundary

Handoff for a human reviewer. What changed, how it's covered, and what to keep an eye on. Two
commits on `main` (`758a0db`, `52f437d`), building on T-036-01.

## What changed

### Commit 1 — `758a0db` — coherence (render follows the executor)

- **`src/executor/select.ts`** (MODIFY) — extracted exported `resolveExecutorId(opts, env)` (the
  precedence one-liner `opts.executor ?? env[VEND_EXECUTOR] ?? "claude"`). `executorFor` now calls
  it. Behavior-preserving refactor — the single definition of "which executor is selected", now
  reusable by the render layer.
- **`src/baml/render-client.ts`** (CREATE, 45 lines) — the pure projection executor id →
  render-client name: `OPEN_MODEL_CLIENT = "OpenModelStub"`, `RENDER_CLIENT_BY_EXECUTOR` (keyed by
  `OPENAI_EXECUTOR_ID`), `renderClientFor(opts, env)`. `undefined` for the default/unknown ⇒ omit
  the `{ client }` option ⇒ byte-identical default render.
- **`src/play/decompose-epic.ts`** (MODIFY) — `decomposeEpicPlay.render` now resolves the client via
  `renderClientFor()` (reads `VEND_EXECUTOR`), defaults `VEND_OPENAI_BASE_URL` to E-035's local
  default when the open-model client is selected (render-only, `??=`), and spreads `{ client }` into
  `b.request.DecomposeEpic`. Default (Claude) path omits the option entirely.
- **`src/baml/render-client.test.ts`** (CREATE) — 8 pure unit tests for `renderClientFor`.

### Commit 2 — `52f437d` — proof + boundary

- **`src/baml/decompose.test.ts`** (MODIFY) — added `OPEN_MODEL_CANNED` (open-model-styled wrapping
  of the exact `CANNED` data), appended as parse op `[4]` in the existing single `runBridge` batch,
  and a "parse is provider-agnostic" describe (2 tests): the open-model reply parses deep-equal to
  the Claude reply, plus a non-vacuity guard (the parse is a populated plan, not the empty-degrade).
- **`docs/knowledge/stack.md`** (MODIFY) — new "Open-model support — where it stands (E-035 + E-036)"
  subsection: config-level at both layers tied via `VEND_EXECUTOR`; the live agentic runtime named
  as the deferred remainder, no over-claim.

No `.baml` source changed; the generated `baml_client/` is byte-unchanged. No change to `Play`,
`CastContext`, `executorFor`'s signature, or `b.parse`.

## Acceptance criteria

- **AC-1 — render follows `executorFor`/`VEND_EXECUTOR`; default byte-identical.** ✅
  `renderClientFor` resolves through the same `resolveExecutorId` `executorFor` uses (no parallel
  switch); `openai-compat ⇒ OpenModelStub`, default ⇒ omit option ⇒ `ClaudeStub`. Covered by the 8
  `render-client.test.ts` units; the unchanged default-render shape test (`decompose.test.ts:169`)
  re-proves the no-env path renders the anthropic format unchanged.
- **AC-2 — `b.parse.*` provider-agnostic via the bridge, no live model.** ✅ Op `[4]` parses an
  open-model-style reply deep-equal to the Claude parse; non-vacuity guard included. Subprocess
  bridge, canned text, no model.
- **AC-3 — `stack.md` records the boundary, no over-claim.** ✅ New subsection states config-level
  at both layers and names the live agentic runtime as the deferred remainder.
- **AC-4 — `bun run check:*` green.** ✅ Full `bun run check` (baml:gen + tsc + bun test) =
  **998 pass / 0 fail**. Both commits passed the precommit hook (tests green).

## Test coverage & gaps

**Covered:**
- Selection logic exhaustively (8 pure cases: env + opt + precedence + unknown + map-keying).
- Default render byte-identity (the existing anthropic-shape test, unchanged).
- Open-model render shape (the T-036-01 tests, still green) — the *other* end of the path.
- Parse agnosticism (deep equality + non-vacuity).

**Gaps / not covered (by design):**
- **The production render closure itself is not unit-tested.** Per the house rule, `render` is an
  addon-loading impure-ish leaf and is not unit-tested directly; its *selection* is covered by the
  `renderClientFor` units and its *render-shape* by the bridge tests. The wiring that joins them
  (the closure) is exercised only indirectly. Low risk — it is a 3-line delegation — but a reviewer
  wanting belt-and-suspenders could add a render-via-`VEND_EXECUTOR` op to the bridge that sets the
  env rather than passing `client` explicitly, to prove the *env→client* path end to end in BAML.
- **No live open-model dispatch** — out of scope (named non-goal); the deferred remainder.

## Open concerns / for human attention

1. **`process.env` mutation in the render closure.** The base_url `??=` default runs only on the
   non-default (open-model) path, is render-only, and mirrors the established bridge pattern — but it
   *is* a global side effect inside a play member. It exists to fix a real asymmetry (the executor
   defaults base_url to localhost; the BAML client has no default, so openai-generic render would
   otherwise throw). If a reviewer prefers no env mutation here, the alternative is to require
   `VEND_OPENAI_BASE_URL` be set whenever `VEND_EXECUTOR=openai-compat` and let render throw loudly
   if it isn't — trades coherence-with-dispatch for purity. Flagged as the one judgment call.
2. **Render coherence is env-based, not opt-based.** `render` has no `CastContext`, so it follows
   `VEND_EXECUTOR` (the live selection), not `cast.ts`'s explicit `executorId`/instance opts. Those
   opts are test-injection seams that never render real BAML, so this is an accepted boundary
   (documented in code and design.md D5) — but if a future caster threads a *real* per-cast executor
   override that also renders, render would not follow it without threading the client through ctx.
3. **`renderClientFor` is decompose-agnostic but only `decompose-epic.ts` is wired.** The other
   plays (propose, expand, steer, survey, note) still render against the default client. Wiring them
   is a mechanical follow-up if/when the open-model path needs to cover more than decompose; out of
   scope here (the ticket names the decompose path).

## Net

The one open-model authoring path is now coherent with E-035 through a single switch, the
provider-neutrality of parse is pinned by an explicit test, and the boundary is recorded honestly in
the canonical stack doc. Full gate green. The only thing a reviewer must actively decide on is
concern #1 (the render-closure env default).
