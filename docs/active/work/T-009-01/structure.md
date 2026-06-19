# T-009-01 — Structure: file-level blueprint

The shape of the code (not the code). Three source files, one regenerated build product,
three work artifacts beyond this one.

## Files

### CREATE — `baml_src/propose.baml`
The ProposeEpic authoring module. Mirrors `note.baml`'s header + framing density.

Order within the file:
1. **Header comment** — what this is (the play *above* decompose, authoring-only),
   the `b.request` render / `claude -p` dispense / `b.parse` SAP-parse split, ClaudeStub
   render-only, and the SAP note: EpicCard has required scalars so a garbage reply is
   *rejected* (like Note), a present-but-empty one degrades.
2. **Enums** (the closed-set poka-yoke), each member uppercase-first + `@alias`:
   - `enum CardColor { White@alias("white") Blue@alias("blue") Black@alias("black")
     Red@alias("red") Green@alias("green") }`
   - `enum CardType { Sorcery@alias("sorcery") Permanent@alias("permanent") }`
   - `enum CardRarity { Common@alias("common") Uncommon@alias("uncommon")
     Rare@alias("rare") Mythic@alias("mythic") }`
3. **`class EpicCard`** — fields, each with a `@description` (the field guidance the model
   sees via `{{ ctx.output_format }}`), grouped by frontmatter / stat-block / body:
   - frontmatter: `id string`, `title string`, `kind CardType`, `advances string[]`,
     `serves string`
   - stat-block: `manaCost string`, `color CardColor[]`, `type CardType`,
     `rarity CardRarity`
   - body: `intent string`, `value string`, `doneLooksLike string`, `context string`
4. **`function ProposeEpic(signal: string, charter: string, project: string) ->
   EpicCard`** — `client ClaudeStub`; `prompt` block with the PE-1…PE-7 authored framing,
   the three `{{ signal }}`/`{{ charter }}`/`{{ project }}` inputs each under a heading,
   and `{{ ctx.output_format }}` last.

### CREATE — `src/baml/propose-bridge.ts`
Standalone child-process render/parse bridge. Near-verbatim sibling of `note-bridge.ts`.

Public surface:
- `export type ProposeBridgeOp = { mode:"render"; signal:string; charter:string;
  project:string } | { mode:"parse"; text:string }`
- `export type ProposeBridgeResult = { ok:true; mode:"render"; prompt:string } |
  { ok:true; mode:"parse"; card: EpicCard } | { ok:false; error:string }`
- `export function runOp(op: ProposeBridgeOp): ProposeBridgeResult`

Imports: `import { b } from "../../baml_client/sync_client.ts"`;
`import type { EpicCard } from "../../baml_client/index.ts"`;
`import { extractPromptText } from "./decompose-bridge.ts"` (reuse, do not re-implement).
`runOp`: `parse` → `b.parse.ProposeEpic(text)`; `render` → `b.request.ProposeEpic(signal,
charter, project)` reached-into via `extractPromptText`; `try/catch` → `{ok:false,error}`.
`if (import.meta.main)` block: `process.env.ANTHROPIC_API_KEY ??= "baml-render-only"`,
read `{ops}` from stdin, map `runOp`, write `{results}` to stdout.

### CREATE — `src/baml/propose.test.ts`
Offline authoring pins. Sibling of `note.test.ts`.

- **Type-only** imports: `import type { EpicCard } from "../../baml_client/index.ts"`;
  `import type { ProposeBridgeOp, ProposeBridgeResult } from "./propose-bridge.ts"`.
- `const BRIDGE = fileURLToPath(new URL("./propose-bridge.ts", import.meta.url))`.
- `async function runBridge(ops): Promise<ProposeBridgeResult[]>` — spawn `bun run BRIDGE`,
  write `{ops}`, read `{results}`, throw on non-zero exit.
- `const CANNED` — a JSON card reply using lisa-token aliases (`kind:"permanent"`,
  `color:["blue"]`, `type:"permanent"`, `rarity:"rare"`, `advances:["P1"]`, all body
  fields filled), modeling a plausible E-0XX proposal.
- Sentinels: `SIGNAL`, `CHARTER`, `PROJECT`.
- Module-level `RESULTS = runBridge([ {parse,CANNED}, {parse,"not a card"},
  {render,SIGNAL,CHARTER,PROJECT} ])` — one spawn.
- `describe("ProposeEpic — parse")`:
  - "a canned reply parses into a typed EpicCard" → assert frontmatter, stat-block enum
    **member** names, body fields.
  - "a garbage reply is REJECTED by SAP (EpicCard has required scalars)" → `ok===false`,
    error contains "required field".
- `describe("ProposeEpic — render")`: "renders signal/charter/project into the prompt" →
  prompt contains the three sentinels + a framing token.

### REGENERATE (not committed) — `baml_client/`
`bun run baml:gen` adds `EpicCard`, `CardColor`, `CardType`, `CardRarity` to
`baml_client/types.ts` and re-exports via `index.ts`. Gitignored build product.

### CREATE — work artifacts
`docs/active/work/T-009-01/{research,design,structure,plan,progress,review}.md`.

### UNTOUCHED
`docs/active/tickets/T-009-01.md` frontmatter (Lisa owns phase/status). No edits to
`decompose.baml`, `note.baml`, `clients.baml`, `generators.baml`, or any existing source.

## Module boundaries / interfaces
- **BAML owns SHAPE** (the typed EpicCard + enums); **PE gates own MEANING** (T-009-02).
  This ticket emits no gate, no renderer, no registration — only the typed function and
  its render/parse pins.
- `extractPromptText` stays the single play-agnostic prompt-extraction helper; the new
  bridge consumes it, mirroring note-bridge.
- The bridge↔test contract is the `{ops}`→`{results}` JSON protocol; types shared via the
  exported `ProposeBridgeOp`/`ProposeBridgeResult`.

## Ordering of changes (why this order)
1. `propose.baml` first — nothing typechecks against `EpicCard` until it exists.
2. `bun run baml:gen` — materialize `EpicCard`/enums into `baml_client/` so imports
   resolve.
3. `propose-bridge.ts` — depends on the generated `EpicCard` + the existing
   `extractPromptText`.
4. `propose.test.ts` — depends on the bridge's exported types and the running bridge.
5. `baml:gen` + `typecheck` + `test` green → commit.

## Risks the structure pre-empts
- **Native-addon flake** — bridge + type-only imports preserved exactly; no value import
  of `baml_client` into the test process.
- **Version-pin refusal** — `baml:gen` is run as-is; pinned `0.222.0` already matches the
  installed CLI (decompose/note generate fine today).
- **Accidental commit of `baml_client/`** — it is gitignored; staging is explicit per
  file, never `git add -A` of the build product.
