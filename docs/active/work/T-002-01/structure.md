# T-002-01 — Structure: the file-level blueprint

The shape of the code, not the code. Files created/modified, their boundaries, public
surface, and the order they must be created in.

---

## File manifest

| Action | Path | Role |
|---|---|---|
| **create** | `baml_src/clients.baml` | render-only `ClaudeStub` (never called) |
| **create** | `baml_src/decompose.baml` | enums + `WorkPlan`/`StoryDraft`/`TicketDraft` + `DecomposeEpic` fn + prompt |
| **create** | `baml_src/generators.baml` | TS generator → `baml_client/` at repo root |
| **create** | `src/baml/decompose.test.ts` | offline parse-pin + render-pin + empty-degradation pin |
| **modify** | `package.json` | add `baml:gen`; wire it into `check` |
| **generated** | `baml_client/**` | `bun run baml:gen` output; gitignored, never committed |

No deletions. No edits to `src/executor`, `src/budget`, `src/gate`, `src/log`,
`src/play` — disjoint from S-001 and the other S-002 tickets.

---

## Module boundaries

```
baml_src/                 ← authoring authority: schema + prompt + client (BAML)
  clients.baml            ← transport stub (render-only)
  generators.baml         ← codegen config
  decompose.baml          ← THE contract: WorkPlan type + DecomposeEpic prompt
        │  bun run baml:gen
        ▼
baml_client/              ← generated TS: `b.request.*` (async) + `b.parse.*` (sync)  [gitignored]
        │  import { b }
        ▼
src/baml/decompose.test.ts ← exercises render + parse offline (the ticket's only TS)
```

The **seam** for downstream tickets is the *generated* `WorkPlan` type and the `b`
object. T-002-02 (gates) imports the `WorkPlan` **type** from `baml_client`. T-002-03
(runner) imports `b` to render+parse around the `claude -p` dispense. T-002-01 owns the
authoring artifacts and proves they generate + round-trip; it wires nothing live.

---

## `baml_src/decompose.baml` — internal organization (declaration order)

BAML requires referents before referrers within a file is not strictly ordered, but for
readability declare top-down:

1. **Header comment** — states the transport boundary (authoring-only; ride the
   `claude -p` shim; `ClaudeStub` render-only) and pins the SAP empty-degradation hazard
   for T-002-02/03 (all-array class never rejects → empty on malformed).
2. **Enums** — `DraftType`, `DraftStatus` (with `@alias("in-progress")` on `in_progress`),
   `DraftPriority`, `DraftPhase`. Each member is a bare identifier.
3. **`TicketDraft`** — fields with `@description` annotations that double as model
   guidance: lisa frontmatter (`id`, `story`, `title`, `type`, `status`, `priority`,
   `phase`, `depends_on`) **plus** the value triplet (`purpose`, `advances`, `doneSignal`).
4. **`StoryDraft`** — `id`, `title`, `type`, `status`, `priority`, `tickets[]`.
5. **`WorkPlan`** — `stories StoryDraft[]`, `tickets TicketDraft[]`.
6. **`function DecomposeEpic(epic: string, charter: string, project: string) -> WorkPlan`**
   — `client ClaudeStub`, then the `prompt #"…"#` block: role framing → the five charter
   criteria → the four clearing gates as authoring guidance → `{{ epic }}`,
   `{{ charter }}`, `{{ project }}` sections → `{{ ctx.output_format }}`.

**Public surface (post-gen):** `b.request.DecomposeEpic(epic, charter, project)` (async,
returns a request exposing `.body.json().messages`), `b.parse.DecomposeEpic(text)` (sync,
returns typed `WorkPlan`), and the exported types `WorkPlan`/`StoryDraft`/`TicketDraft` +
the four enums.

---

## `baml_src/clients.baml`

Single `client<llm> ClaudeStub { provider anthropic; options { model "claude-opus-4-8";
api_key env.ANTHROPIC_API_KEY; max_tokens 32000 } }` with a "never called" header. No
other clients, no retry policy, no fallback (D1).

---

## `baml_src/generators.baml`

```
generator typescript { output_type "typescript"  output_dir "../"  version "0.222.0" }
```

`output_dir "../"` is relative to `baml_src/`, landing `baml_client/` at the repo root —
the path `.gitignore` already ignores and the test imports as `../../baml_client/index.ts`.

---

## `src/baml/decompose.test.ts` — internal organization

```
import { describe, expect, test } from "bun:test";
import { b } from "../../baml_client/index.ts";
import type { WorkPlan } from "../../baml_client/index.ts";   // type-only; verbatimModuleSyntax

// canned reply: one story, two ordered tickets, valid enums, full value triplet
const CANNED = `{ ... JSON matching WorkPlan ... }`;

describe("DecomposeEpic — parse (SAP, offline)", () => {
  test("canned reply parses to a typed WorkPlan", () => {
    const plan = b.parse.DecomposeEpic(CANNED);
    // assert: 1 story, 2 tickets; order preserved; enum tokens; advances/doneSignal present
  });
  test("malformed reply degrades to an EMPTY plan (pins SAP leniency for T-002-02/03)", () => {
    const plan = b.parse.DecomposeEpic("not a work plan at all");
    // assert: stories.length === 0 && tickets.length === 0
  });
});

describe("DecomposeEpic — render (b.request, offline, render-only key)", () => {
  test("renders epic + charter + project into the prompt", async () => {
    const had = "ANTHROPIC_API_KEY" in process.env;
    if (!process.env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = "baml-render-only";
    try {
      const req: any = await b.request.DecomposeEpic(EPIC, CHARTER, PROJECT);
      const text = extractPromptText(req);   // messages → text blocks → join
      expect(text).toContain(EPIC_SENTINEL);
      expect(text).toContain(CHARTER_SENTINEL);
      expect(text).toContain(PROJECT_SENTINEL);
    } finally { if (!had) delete process.env.ANTHROPIC_API_KEY; }
  });
});
```

`extractPromptText` mirrors bridge.mts: `(req.body.json().messages ?? []).flatMap(...)`,
keep `type === "text"`, `.map(c => c.text).join("\n")`. Kept as a local helper in the test
(T-002-01 ships no `src/` runtime module; the reusable render-extraction belongs to the
runner, T-002-03).

**Typing note:** `b.request`/`b.parse` generated signatures are precise; the test uses a
narrow `any` only where it reaches into the request's internal `.body.json()` shape (an
implementation detail BAML doesn't type publicly), exactly as bridge.mts does.

---

## `package.json` — exact diff shape

Add one script and extend `check` (preserve key order and 2-space style):

```jsonc
"scripts": {
  "check:test": "bun test",
  "check:typecheck": "tsc --noEmit",
  "baml:gen": "baml-cli generate --from baml_src",          // + new
  "check": "bun run baml:gen && bun run check:typecheck && bun run check:test", // + baml:gen
  "build": "tsc --noEmit"
}
```

`@boundaryml/baml` is already a dependency (scaffold); no dependency change. `baml-cli`
resolves via the installed package (invoked as `baml-cli` under `bun run`, on PATH from
`node_modules/.bin`).

---

## Creation order (dependencies between steps)

1. `baml_src/generators.baml` + `baml_src/clients.baml` + `baml_src/decompose.baml` — the
   BAML sources must all exist before generate (decompose references `ClaudeStub`).
2. `package.json` — add `baml:gen` so step 3 has a script (or invoke `baml-cli` directly).
3. `bun run baml:gen` — emit `baml_client/`; nothing typechecks against the client until
   this runs.
4. `src/baml/decompose.test.ts` — written against the now-existing generated types.
5. Wire `check` to run `baml:gen` first; run `bun run check` green.

---

## Risks surfaced for Plan

- **tsc reaches into `baml_client`:** `include: ["src"]` plus the test's import pulls the
  generated `.ts` into the typecheck graph. `skipLibCheck: true` covers `node_modules` but
  not first-party generated code; if generated code trips strict mode, Plan must decide
  (expect clean — BAML 0.222.0 client is strict-clean; verified at run).
- **`verbatimModuleSyntax`:** the `WorkPlan` import must be `import type` (value vs type
  split). Already reflected above.
- **Enum alias:** `@alias("in-progress")` must render correctly in `{{ ctx.output_format }}`;
  verify in the render test output (the alias is the model-facing token).
