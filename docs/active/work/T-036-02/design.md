# T-036-02 — Design: open-model path coherence + parse agnosticism + boundary

One decision per section, each grounded in `research.md`. Three deliverables map to D1–D2
(coherence), D3 (agnosticism proof), D4 (boundary). D5 covers what is deliberately NOT done.

## D1 — How render follows the executor (the selection reuse)

**Decision.** Add a pure resolver that maps the *resolved executor id* → the BAML render-client
name, reusing E-035's id resolution. Extract the id-resolution one-liner out of `executorFor` so
both the executor and the render client are selected by the **same** function — no parallel switch.

```ts
// src/executor/select.ts — extracted, exported; executorFor now calls it
export function resolveExecutorId(opts: ExecutorSelection = {}, env = process.env): string {
  return opts.executor ?? env[EXECUTOR_ENV] ?? DEFAULT_EXECUTOR_ID;
}

// src/baml/render-client.ts — new
export const OPEN_MODEL_CLIENT = "OpenModelStub";
export const RENDER_CLIENT_BY_EXECUTOR: Record<string, string> = {
  [OPENAI_EXECUTOR_ID]: OPEN_MODEL_CLIENT,   // "openai-compat" → "OpenModelStub"
};
export function renderClientFor(opts: ExecutorSelection = {}, env = process.env): string | undefined {
  return RENDER_CLIENT_BY_EXECUTOR[resolveExecutorId(opts, env)];
}
```

**Why this shape.**

- **Reuse, not reimplement.** `renderClientFor` resolves the id through the *exact* function
  `executorFor` uses. There is one definition of "which executor is selected"; the render client is
  a pure projection of it. Extracting `resolveExecutorId` is the minimal refactor that makes the
  reuse literal (and leaves `executorFor`'s observable behavior unchanged — same tests pass).
- **Map keyed by `OPENAI_EXECUTOR_ID`, not a string literal.** The key comes from
  `openai-compat.ts`'s exported id, so a future rename of the executor id moves the render mapping
  with it. Same for the value: `OpenModelStub` is the client T-036-01 declared.
- **Default ⇒ `undefined` ⇒ omit the option.** `claude` (and any unmapped/unknown id) returns
  `undefined`. The render call omits `{ client }` ENTIRELY rather than passing
  `{ client: "ClaudeStub" }` — the only way to *prove* byte-identical back-compat (a request built
  with no option is the request shipped today; one built with an explicit primary is "probably the
  same" but not provably). An unknown id renders default and then fails loudly at the executor seam
  (`executorFor` throws) — no need to duplicate the throw in the render layer.

**Rejected: a new `VEND_RENDER_CLIENT` env.** Explicitly forbidden ("don't invent a parallel
switch") and wrong — it would let render and dispatch disagree, which is the exact incoherence this
ticket removes.

**Rejected: thread the resolved client through `CastContext`.** `Play.render` is `(inputs) => string`
with no ctx (`research.md`). Adding ctx to render touches the engine contract and every play — far
beyond scope, for a path (`cast.ts`'s explicit `executorId`/instance opts) that is a test-injection
seam and never renders real BAML. The env path (`VEND_EXECUTOR`) is the live selection and is what
the AC names. See D5.

## D2 — Where the production render selects + readies the open-model client

**Decision.** In `decomposeEpicPlay.render` (`src/play/decompose-epic.ts`), resolve the client via
`renderClientFor()` (reads `process.env`), and when it is the open-model client, ensure
`VEND_OPENAI_BASE_URL` is present (default it to `DEFAULT_OPENAI_BASE_URL`, `??=`) so openai-generic
can build a request — then spread the `{ client }` option:

```ts
render: (i) => {
  const client = renderClientFor();
  // openai-generic has no built-in endpoint; render needs base_url present. Default it to E-035's
  // local default so render and dispatch agree (executor defaults the same). ??= respects a real
  // endpoint; render-only — BAML never dispatches. Mirrors decompose-bridge.ts's entry guard.
  if (client) process.env[OPENAI_BASE_URL_ENV] ??= DEFAULT_OPENAI_BASE_URL;
  return extractPromptText(
    b.request.DecomposeEpic(i.epic, i.charter, i.project, ...(client ? [{ client }] : [])) as unknown as {
      body: { json: () => { messages?: unknown[] } };
    },
  );
},
```

**Why the base_url guard belongs here.** `research.md` flagged the asymmetry: the executor defaults
base_url to localhost, the BAML client does not. Without the guard, a perfectly valid
`VEND_EXECUTOR=openai-compat` run against local Ollama (base_url unset, relying on the executor's
default) would *dispatch* fine but *render* would throw — incoherent. Defaulting at the call site
(not in `clients.baml`) keeps the source layer transport-free and confines the value to the env,
exactly the render-only pattern the bridge already uses. The guard is keyed on `client` so the
default (Claude) path sets nothing — byte-identical.

**Why `render` reads env directly.** It must — the contract gives it no ctx (D1 rejection). Reading
`VEND_EXECUTOR` at render time is coherent because `cast.ts` resolves the executor from the same env
moments later; both observe one `process.env`.

**Rejected: a `selectRenderClient()` that also mutates env, returning the option array.** Folding
the side effect into one helper reads cleaner but hides a `process.env` write behind a name that
sounds pure, and complicates the env-injection used by D1's unit tests. Keeping `renderClientFor`
pure (unit-tested with injected env) and the 1-line base_url guard visible on the impure render
closure (not unit-tested, per the house rule) is the honest split.

## D3 — Proving parse is provider-agnostic

**Decision.** Add ONE op to the existing batched `runBridge` call in `decompose.test.ts`: a
`{ mode: "parse" }` whose text is a **canned open-model-style reply** — the same logical content as
the existing `CANNED`, but wrapped the way open models emit it (a chatty preamble + a ```json fenced
block + a trailing remark). Assert it parses into a `WorkPlan` **deep-equal to the Claude reply's**.

```ts
const OPEN_MODEL_CANNED =
  "Sure! Here's the decomposition you asked for:\n\n```json\n" + <same object as CANNED> + "\n```\n" +
  "Let me know if you'd like me to adjust the budget split.";
```

Assertions: same story id/type/status, same two ticket ids in order, same value triplet + depends_on
edge — i.e. the open-model parse equals the Claude parse field-for-field. The point is explicit in
the test name: *parse keys on text, not on a provider*.

**Why this reply shape.** `research.md`: SAP extracts embedded structure regardless of wrapping;
the malformed-degrades-to-empty test proves leniency. Open models characteristically wrap JSON in
fences and add prose; using exactly that styling makes the proof representative, not contrived. The
data is held identical to `CANNED` on purpose — so any difference in the parsed output would be
attributable to the *wrapping/provider styling*, and there is none.

**Why no production code changes for part 2.** This is the half that needs none — `b.parse` has no
provider parameter. The deliverable is the *test* that pins the property, run through the same
subprocess bridge (one spawn, batched with the existing ops; the addon's one-call limit is honored).

**Rejected: a second bridge / a live open-model call.** No live model (non-goal); the existing
bridge already parses arbitrary text. A new op in the existing batch is the minimal vehicle.

## D4 — Recording the boundary in stack.md

**Decision.** Add a short subsection (under Decisions, near the Executor row) titled "Open-model
support — where it stands (E-035 + E-036)". State plainly:

- **Config-level at both layers, today:** authoring (E-036: the `OpenModelStub` BAML client, render
  targeting it, provider-agnostic parse) and execution (E-035: the `Executor` interface +
  `OpenAICompatExecutor`), tied together so the render client follows `VEND_EXECUTOR`.
- **Deferred remainder (named, not over-claimed):** the **live agentic open-model runtime** — an
  open model autonomously reading the repo, running tools, iterating turns, materializing a ticket
  (a local agent loop behind E-035's `Executor`, or an OSS agent framework) — is **not built**.
  "Support" here is the stack *targeting* open models, **not** proven open-model parity on the
  agentic plays.

**Why a stack.md subsection (vs vision.md).** `vision.md` is durable why; `stack.md` is the
toolchain/decision record and already owns the Executor row — the honest "where it stands" belongs
next to it. Keeps the over-claim from ever creeping into the canonical doc.

## D5 — What this ticket deliberately does NOT do

- **No agentic runtime** (named non-goal). The deferred remainder is *documented*, not built.
- **No SAP-parse change** — part 2 is a test only.
- **No BAML transport** — render-only; dispense stays on E-035's seam.
- **No render coherence for the explicit `executorId`/instance cast opts** — those are
  test-injection seams (`cast.ts:78`) that never render real BAML; render follows `VEND_EXECUTOR`,
  the live selection the AC names. Recorded as an accepted boundary (and a one-line note in code).

## Decision summary

1. Extract `resolveExecutorId` (select.ts); add pure `renderClientFor` (new `render-client.ts`)
   mapping the resolved executor id → render-client name; default ⇒ `undefined` (omit option).
2. `decompose-epic.ts` render resolves the client via `renderClientFor()`, defaults
   `VEND_OPENAI_BASE_URL` when open-model, spreads `{ client }`; Claude path unchanged.
3. New batched parse op in `decompose.test.ts`: open-model-style reply parses deep-equal to the
   Claude reply — the agnosticism proof. Plus pure unit tests for `renderClientFor`.
4. `stack.md` subsection: config-level at both layers; live agentic runtime is the deferred,
   un-over-claimed remainder.
