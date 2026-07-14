# T-002-01 — Research: BAML `DecomposeEpic` function + `WorkPlan` types

Descriptive map of what exists and what this ticket plugs into. No solutions here.

## What the ticket asks for

Author the `DecomposeEpic` play **as BAML, authoring-only**: BAML renders the
prompt (`b.request`) and SAP-parses the reply (`b.parse`); it is **not** the
transport. The output type (`WorkPlan`) mirrors lisa's story/ticket frontmatter so
"shapeless work is impossible by construction" (poka-yoke). Four ACs:

1. `baml_src/clients.baml` — a **render-only** `ClaudeStub` client (never called).
2. `baml_src/decompose.baml` — `function DecomposeEpic(epic, charter, project) -> WorkPlan`,
   `WorkPlan` holding ordered `StoryDraft`/`TicketDraft` with lisa frontmatter fields
   **plus** per-ticket `purpose`, `advances`, `doneSignal`.
3. `baml_src/generators.baml` — emits the TS client; `bun run baml:gen` regenerates `baml_client/`.
4. A unit test: canned reply through `b.parse.DecomposeEpic` → typed `WorkPlan`; a second
   asserts `b.request.DecomposeEpic(...)` renders the inputs into the prompt.

## The transport boundary (the load-bearing constraint)

This is the single most important pattern to get right, and it is **proven**, not
novel. From `stack.md` / E-001 / `playbook-decompose-epic.md`:

- BAML is the **schema + prompt + parse authority**. Execution rides the `claude -p`
  subscription shim — `b.request.X(...)` builds the HTTP request and we read its
  rendered prompt text; we **never** call `b.X(...)` (a bare call is a LIVE metered
  call through BAML's own client, which we forbid).
- `clients.baml`'s `ClaudeStub` exists only to *shape* `.request`. It carries
  `api_key env.ANTHROPIC_API_KEY`, but the key is **never sent** — it is read only to
  build the request object. mc-design-eval guards this by setting a dummy key for the
  render and deleting it (`baml-render-only`).
- **BAML-on-Bun is VERIFIED** (E-001, 2026-06-18, Bun 1.3.9 / BAML 0.222.0):
  `baml-cli generate`, `b.request` render, and `b.parse` SAP all run clean under Bun;
  native bindings load. Re-check only if the BAML major moves.

## Reference implementation — `mc-design-eval`

The canonical prior art lives at `/Volumes/ext1/swe/repos/mc-design-eval`.

- `baml_src/clients.baml` — the exact `ClaudeStub` to mirror: `client<llm> ClaudeStub`,
  `provider anthropic`, `model "claude-opus-4-8"`, `api_key env.ANTHROPIC_API_KEY`,
  `max_tokens 32000`, with a header comment stating it is never called.
- `baml_src/decompose.baml` — `DecomposeBrushBacklog(style, registry) -> BrushBacklog`.
  The closest structural analog: a decompose function whose output is **classes holding
  arrays of work-item drafts**, each draft self-contained, `@description`-annotated
  fields, prompt ends with `{{ ctx.output_format }}`. Note its pinned hazard (below).
- `baml_src/generators.baml` — `generator typescript { output_type "typescript";
  output_dir "../"; version "0.222.0" }`. `output_dir "../"` is **relative to
  `baml_src/`**, so the client lands at the repo root: `baml_client/`.
- `src/baml/bridge.mts` — shows the modular API in use: `b.request.X(...)` is **async**
  and returns a request whose `.body.json().messages` array carries the rendered
  content (text blocks + image blocks); `b.parse.X(text)` is **sync** and returns the
  typed object. Both come from the same `import { b } from "../../baml_client/index.ts"`.
- `src/baml/fixtures.test.mjs` — the test shape we mirror: render pins assert the
  rendered prompt's bytes/markers; parse pins run `b.parse` over a committed raw reply
  and deep-equal the expected, plus a malformed specimen.
- `package.json` — `"baml:gen": "baml-cli generate --from baml_src"`, run as a
  `pretest` so the generated client always exists before tests/typecheck.

### Render extraction shape (from bridge.mts, lines 101–108)

```
const content = (req.body.json().messages ?? []).flatMap(m =>
  Array.isArray(m.content) ? m.content : [{ type: "text", text: m.content }]);
const prompt = content.filter(c => c.type === "text").map(c => c.text).join("\n").trimEnd();
```

This is exactly how the render test will reach the prompt text to assert the inputs
landed in it.

### SAP parse-leniency hazard (pinned in mc's decompose.baml header)

> "a class of only array fields never rejects — SAP degrades any malformed reply to
> the EMPTY backlog. The consuming runner must classify the empty union as MALFORMED."

`WorkPlan` is exactly such a class (only `stories[]` / `tickets[]`). So `b.parse` will
**not throw** on garbage — it degrades to empty arrays. This is not T-002-01's bug to
fix (parse stays lenient by design), but it is a fact the **value gate** (T-002-02) and
the **runner** (T-002-03) must own: an empty `WorkPlan` is malformed, not valid.

## Where this lands in the vend repo

Current state (relevant files):

- `package.json` — already declares `"@boundaryml/baml": "^0.222.0"` (added at scaffold,
  T-001-01). Scripts: `check:test` (`bun test`), `check:typecheck` (`tsc --noEmit`),
  `check` (typecheck && test), `build`. **No `baml:gen` script yet** — this ticket adds it.
- `tsconfig.json` — strict, `noUncheckedIndexedAccess`, `moduleResolution: bundler`,
  `allowImportingTsExtensions`, `verbatimModuleSyntax`, `include: ["src"]`,
  `skipLibCheck: true`.
- `.gitignore` — **`baml_client/` is ignored** (generated, not committed). Consequence:
  `bun run baml:gen` must run before `tsc`/`bun test`, or the test's import of
  `baml_client` fails to resolve.
- `src/` — existing modules: `executor/claude.ts` (the `claude -p` seam, T-001-02),
  `budget/budget.ts` (T-001-03), `gate/.gitkeep`, `log/.gitkeep`, `play/.gitkeep`,
  `smoke.test.ts`. **No `baml_src/` and no `src/baml/` yet.**
- `node_modules/@boundaryml/baml` present; `baml-cli 0.222.0` runs via `bunx`.

## Lisa frontmatter — the shape `WorkPlan` must mirror

From `rdspi-workflow.md` and the live ticket/story files:

- **Ticket** fields: `id`, `story`, `title` (kebab), `type` ∈ {task,bug,spike},
  `status` ∈ {open,in-progress,review,done,blocked}, `priority` ∈ {critical,high,medium,low},
  `phase` ∈ {ready,research,design,structure,plan,implement,review,done}, `depends_on` (id list).
  `blocks` is lisa-computed — do **not** model it.
- **Story** fields (from `S-001.md`/`S-002.md`): `id`, `title`, `type: story`, `status`,
  `priority`, `tickets` (ordered id list).
- The **vend-semantic** additions the charter demands (work judged by value, not format):
  per ticket `purpose` (one line: what it advances), `advances` (which P-invariants /
  epic outcomes — charter IDs `P1–P7`), `doneSignal` (how we know it landed). These have
  no lisa-frontmatter home; they are vend's value layer, consumed by the gates.

## The charter / playbook the prompt must encode

- `charter.md` — the value function: work is valuable iff **Purposeful, Grounded,
  Allocatable, In-bounds, Verifiable**. Invariants `P1–P7`; non-goals `N1–N4`. Alignment
  is **recomputed** at decompose time, not stored.
- `playbook-decompose-epic.md` — the play's shape and the four value-ordered clearing
  gates: **value → allocation → bounds → structural**. The prompt should steer the model
  to produce gate-passing work (purpose-justified, right-sized, ordered, grounded), even
  though the gates themselves run separately (T-002-02).

## Assumptions & constraints carried into Design

- **Disjointness:** the ticket says T-002-01 runs parallel to S-001 module tickets on
  disjoint files (`baml_src/`). The one unavoidable shared touch is `package.json` (add
  `baml:gen` + wire it into `check`). lisa serializes commits via file-lock; depends_on
  T-001-01 means the scaffold's `package.json` already exists. The S-001 tickets
  (executor/budget/log) do not edit scripts. Low collision risk, but must be named.
- **Test placement:** the test imports `baml_client`. Putting it under `src/baml/` keeps
  it inside `tsconfig`'s `include: ["src"]` (typechecked **and** tested) and disjoint from
  `executor/`, `budget/`, `gate/`, `play/`. `baml_src/` would be outside `include`.
- **Render needs a key present:** `b.request` reads `env.ANTHROPIC_API_KEY` to build the
  request (never sends it). The render test must set a dummy key (render-only guard).
- **`b.parse` is offline:** no key, no spawn — pure local SAP parse of supplied text.
