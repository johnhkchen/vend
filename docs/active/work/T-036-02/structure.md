# T-036-02 — Structure: file-level blueprint

The shape of the change, not the code. Five files: 2 source created/modified for coherence, 1 test
file for both the resolver units and the agnosticism proof, 1 source modified to expose the reused
resolver, 1 doc. Ordered so each step typechecks on its own.

## Files

### 1. `src/executor/select.ts` — MODIFY (extract the reused resolver)

Extract the inline id-resolution into an exported pure function; `executorFor` calls it. No
behavior change — purely a refactor that makes "reuse E-035's selection" literal.

```ts
/** Resolve the executor id by E-035 precedence: explicit opt → VEND_EXECUTOR → default ("claude").
 *  The single definition of "which executor is selected" — reused by render-client selection
 *  (T-036-02) so render follows the executor with no parallel switch. */
export function resolveExecutorId(
  opts: ExecutorSelection = {},
  env: Record<string, string | undefined> = process.env,
): string {
  return opts.executor ?? env[EXECUTOR_ENV] ?? DEFAULT_EXECUTOR_ID;
}
```

`executorFor` body changes one line: `const id = resolveExecutorId(opts, env);`. Everything else
(registry lookup, unknown-id throw) unchanged. Public exports gain `resolveExecutorId`.

- **Boundary:** still the selection authority; now exposes the id step it already performed.
- **Risk:** none — `select.test.ts`'s existing precedence cases re-prove `executorFor` unchanged.

### 2. `src/baml/render-client.ts` — CREATE (the coherence mapping)

The pure projection from executor id → BAML render-client name. New, small, no addon load.

```ts
import { resolveExecutorId, type ExecutorSelection } from "../executor/select.ts";
import { OPENAI_EXECUTOR_ID } from "../executor/openai-compat.ts";

/** The open-model render client declared in baml_src/clients.baml (T-036-01). */
export const OPEN_MODEL_CLIENT = "OpenModelStub";

/** executor id → BAML render-client name. Only the open-model executor maps to a non-default
 *  client; every other id (claude + unknowns) is absent ⇒ undefined ⇒ default (ClaudeStub). */
export const RENDER_CLIENT_BY_EXECUTOR: Readonly<Record<string, string>> = {
  [OPENAI_EXECUTOR_ID]: OPEN_MODEL_CLIENT,
};

/** The BAML client the render should target so it FOLLOWS the executor selection (E-035).
 *  undefined ⇒ omit the {client} option ⇒ byte-identical default render. */
export function renderClientFor(
  opts: ExecutorSelection = {},
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  return RENDER_CLIENT_BY_EXECUTOR[resolveExecutorId(opts, env)];
}
```

- **Why `src/baml/` not `src/executor/`:** the value (`"OpenModelStub"`) is a BAML authoring name;
  the executor module should not know BAML client names. It imports the executor *id* (a selection
  fact) and owns the *projection* to the authoring name. Dependency direction: baml → executor
  (acyclic; executor never imports baml).
- **Boundary:** pure, env-injectable ⇒ fully unit-testable with no subprocess.

### 3. `src/play/decompose-epic.ts` — MODIFY (wire production render)

The `render` member of `decomposeEpicPlay` (currently `decompose-epic.ts:168`) becomes:

```ts
render: (i) => {
  const client = renderClientFor();
  // openai-generic needs base_url at render time (no built-in endpoint); default to E-035's local
  // default so render and dispatch agree. ??= respects a real endpoint. Render-only — never sent.
  if (client) process.env[OPENAI_BASE_URL_ENV] ??= DEFAULT_OPENAI_BASE_URL;
  return extractPromptText(
    b.request.DecomposeEpic(i.epic, i.charter, i.project, ...(client ? [{ client }] : [])) as unknown as {
      body: { json: () => { messages?: unknown[] } };
    },
  );
},
```

New imports: `renderClientFor` from `../baml/render-client.ts`;
`OPENAI_BASE_URL_ENV`, `DEFAULT_OPENAI_BASE_URL` from `../executor/openai-compat.ts`.

- **Boundary:** the play still owns only play-specific judgment; the *which-client* decision is
  delegated to `renderClientFor`. `render` stays `(inputs) => string` — contract unchanged.
- **Note in code:** one line that render follows `VEND_EXECUTOR` (env), the live selection; the
  cast's explicit `executorId`/instance opts are test-injection seams (accepted boundary, D5).
- **Risk:** default path adds a function call that returns `undefined` and spreads `[]` ⇒ identical
  request. Covered by the existing render tests (which assert anthropic shape on the default).

### 4. `src/baml/render-client.test.ts` — CREATE (pure resolver units)

No addon (type-only/no BAML import). Cases:

- no opts/env ⇒ `undefined` (default ⇒ ClaudeStub, byte-identical).
- `{ VEND_EXECUTOR: "claude" }` ⇒ `undefined`.
- `{ VEND_EXECUTOR: "openai-compat" }` ⇒ `"OpenModelStub"`.
- explicit `{ executor: "openai-compat" }` opt ⇒ `"OpenModelStub"` (opt precedence).
- explicit opt beats env (`{ executor: "openai-compat" }`, env `claude`) ⇒ `"OpenModelStub"`.
- unknown id (`{ VEND_EXECUTOR: "nope" }`) ⇒ `undefined` (renders default; fails loudly later at
  the executor seam — documented, not this function's job).
- `RENDER_CLIENT_BY_EXECUTOR` keyed by the real `OPENAI_EXECUTOR_ID` (guards against id drift).

### 5. `src/baml/decompose.test.ts` — MODIFY (the agnosticism proof)

Add one canned open-model-style reply constant and one parse op to the existing batch, plus a
describe block. The batch grows from 4 ops to 5 (still one spawn — the op order matters):

```
[0] parse CANNED                  (existing)
[1] parse malformed               (existing)
[2] render default                (existing)
[3] render OpenModelStub          (existing)
[4] parse OPEN_MODEL_CANNED       (NEW)
```

`OPEN_MODEL_CANNED` = chatty preamble + ```json fence wrapping the SAME object as `CANNED` +
trailing remark. New describe "parse is provider-agnostic": assert `results[4]` plan deep-equals
`results[0]` plan (same story, same ticket ids/order, same value triplet + depends_on). Name makes
the claim explicit: SAP parses text, not a provider.

- **Boundary:** test-only; no production change for part 2. Honors the per-process addon limit
  (one spawn, batched). Existing op indices unchanged ⇒ no churn to current assertions.

### 6. `docs/knowledge/stack.md` — MODIFY (the boundary)

Add a subsection after the Decisions table (near the Executor row): "Open-model support — where it
stands (E-035 + E-036)". Two bullets: config-level at both layers (authoring + execution, tied via
`VEND_EXECUTOR`); deferred remainder = the live agentic open-model runtime, not built, not parity.

## Change ordering (each step compiles)

1. `select.ts` extract `resolveExecutorId` (refactor; green on its own).
2. `render-client.ts` + `render-client.test.ts` (depends on 1; pure, fast).
3. `decompose-epic.ts` render wiring (depends on 2; imports the resolver + env consts).
4. `decompose.test.ts` agnosticism op (independent of 1–3; bridge already parses text).
5. `stack.md` boundary (docs; independent).

## Commit plan (preview of plan.md)

- **C1 (coherence):** select.ts + render-client.ts + render-client.test.ts + decompose-epic.ts.
- **C2 (proof + boundary):** decompose.test.ts + stack.md.

## Public surface delta

- `select.ts`: `+ resolveExecutorId`.
- `render-client.ts` (new): `+ OPEN_MODEL_CLIENT`, `+ RENDER_CLIENT_BY_EXECUTOR`, `+ renderClientFor`.
- No change to `Play`, `CastContext`, `executorFor` signature, `b.parse`, or any `.baml` source.
