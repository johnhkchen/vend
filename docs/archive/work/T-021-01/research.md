# T-021-01 — Research: read-only-graph-model-loader

_Descriptive map of what exists. No solutions here — those land in `design.md`._

## The ticket in one line

Load the canonical epic→story→ticket DAG (`docs/active/{epic,stories,tickets}/*.md` +
YAML frontmatter) into **one typed, deeply-immutable in-memory graph** that the
presentation projection (E-021) reads from. The loader exposes **no write path**: a test
must assert the returned structure is frozen/read-only and that every edge resolves to an
existing node.

_Advances: P5 (local-first one-way authority), data-presentation-split._

## Where this sits

- **Epic E-021 `linear-presentation-surface`** — stand up the MCP-independent presentation
  layer as a clean data/presentation split. The canonical graph stays the fixed source of
  truth; the human reads a *projection* governed by a tunable spec. **One-way authority is
  the hard boundary: the projection reads the graph and never writes back.**
- **Story S-021-01 `read-only-graph-model`** — single ticket (this one). It is the
  *foundation brick*: every downstream surface ticket (renderer, presentation spec,
  calibration) consumes the graph this loader returns.
- **Consumer contract** lives in `docs/active/pm/linear-surface-prep.md` — the field-mapping
  table (1a) names exactly which fields the projection reads off each node type:
  - ticket: `title`, `type`/`phase`/`status` (→ one state chip), the **Context** paragraph
    (→ "Why this matters"), the **Acceptance Criteria** body (→ "What done means"),
    `depends_on` (→ arrows between cards), file cites (→ Details).
  - epic/story: same shape "extended to every node type" (prep doc deliverable #2).
  - Implication for this loader: nodes must retain not just frontmatter fields but the
    **raw markdown body** (Context / Acceptance Criteria live in the body, not frontmatter).

## The canonical data — exact shapes (verified by reading live files)

Three node kinds, one markdown file each, leading `---` YAML frontmatter then a body.

**Epic** (`docs/active/epic/E-NNN.md`), e.g. `E-001`, `E-021`:
```yaml
id: E-001
title: dispense-slice
status: active            # may carry a trailing "# open | clearing | active | done" comment
advances: [P1, P3, P7]    # charter principle codes
serves: >                 # folded multi-line blurb
  Prove the clearing house can dispense real work autonomously …
kind: permanent           # present on some epics (E-021), absent on others (E-001)
```

**Story** (`docs/active/stories/S-NNN[-MM].md`), e.g. `S-021-01`, `S-001`:
```yaml
id: S-021-01
title: read-only-graph-model
type: story
status: open
priority: high
tickets: [T-021-01]       # ordered child ticket ids (execution order)
```

**Ticket** (`docs/active/tickets/T-NNN-MM.md`), e.g. `T-021-01`:
```yaml
id: T-021-01
story: S-021-01           # parent story id (back-reference)
title: read-only-graph-model-loader
type: task                # observed: task | feature | spike | chore (broader than the docs' task|bug|spike)
status: open
priority: high
phase: research           # observed live: ready | research | done
depends_on: []            # ticket ids that must finish first
blocks: [...]             # OPTIONAL, Lisa-computed inverse of depends_on; NOT present on any live file
```

## The edges (how nodes connect) — the crucial finding

| Edge | Direction | How it is encoded | Authored or derived |
|---|---|---|---|
| ticket → story | child→parent | ticket `story:` field | **authored** |
| story → tickets | parent→child | story `tickets:` list (ordered) | **authored** |
| ticket → ticket | dependency | ticket `depends_on:` list | **authored** |
| ticket ← ticket | reverse dep (`blocks`) | inverse of `depends_on` | **derived** (Lisa computes; absent in files) |
| **epic → story** | parent→child | **ID CONVENTION ONLY** — story `S-NNN-*` belongs to epic `E-NNN`. There is NO `epic:` field in any story and NO story list in any epic. | **derived** |

The epic↔story link is the one non-obvious edge: it exists **purely by id convention**
(`grep "^epic:" docs/active/stories/*.md` → zero matches). `S-001`→`E-001`,
`S-021-01`→`E-021` (take the first numeric group after `S-`).

## Live board state (go-and-see, verified 2026-06-19)

- 21 epics, 26 stories, 61 tickets.
- **Fully referentially consistent:** zero stories with a missing epic, zero tickets with a
  missing story, zero dangling `depends_on`, zero dangling `story.tickets`. So a strict
  "every edge resolves" loader will load the live board clean today.
- Stories without an `-MM` suffix exist (`S-001`, `S-002`, `S-006`, `S-012`) — the
  `S-NNN`→`E-NNN` rule covers them.
- `docs/active/epic/` contains a **`TEMPLATE.md`** (parses to placeholder `id: E-000`). A
  naive `*.md` glob would ingest it. `stories/` and `tickets/` have no TEMPLATE file.
- Observed enum-ish values exceed the documented sets (`type: chore|feature`,
  `status: active` on epics with inline comments). The loader is a faithful **mirror**, so
  it must not enum-reject these.

## Existing codebase patterns to reuse (house idioms)

- **Pure-core + impure-verb split** (`src/play/materialize.ts`, `project-context.ts`,
  `survey-core.ts`/`survey-effect.ts`): all judgment/formatting is PURE (no fs/clock/addon),
  the single IMPURE verb does `readdir`/`readFile`. Tests exercise the pure half as ordinary
  pure-function tests; the verb is covered by a real-fs/temp-dir fixture test.
- **Directory listing tolerant of absence**: `project-context.ts` `listIdsIn`/`listFilesRel`
  use `readdir` and swallow ENOENT → `[]` (a fresh board never throws).
- **No YAML dependency in the repo** — but **`Bun.YAML.parse` is available** (Bun 1.3.9) and
  **correctly strips inline `#` comments** (verified: `status: active   # …` → `"active"`).
  Frontmatter today is only *rendered* (`materialize.ts`), never parsed; this is the first
  parser.
- **Typed errors over silent failure**: `materialize.ts` throws a named `IdCollisionError`
  (an EXPECTED refusal, distinguished by type from a generic fs failure) BEFORE any side
  effect. `survey-core.ts` throws `RangeError` on enum/map drift (a programmer error).
- **Deep-immutability precedent**: `id-guard.test.ts` uses `Object.freeze` on inputs and
  proves a non-throwing call only reads them. Bun tests run ESM strict mode → assigning to a
  frozen property / `push` on a frozen array **throws TypeError**.
- **`Readonly<Record<…>>` maps** (`materialize.ts` alias tables) are the house shape for
  lookups; `readonly`/`ReadonlyArray` everywhere under `strict` + `noUncheckedIndexedAccess`.

## Constraints & assumptions

- `tsconfig`: `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax` (type-only imports
  must be `import type`), `allowImportingTsExtensions` (imports carry `.ts`).
- No new runtime dependency is justified — `Bun.YAML` covers parsing.
- The loader must be **read-only by construction**: no exported function may mutate or write
  the canonical files. "Deeply immutable" must hold at runtime (frozen) and at the type level
  (`readonly`).
- Body retention: the projection needs Context + Acceptance Criteria, which live in the
  markdown body — so nodes must carry the raw body string, not only frontmatter.
- Open question for Design: epic→story is *derived by convention* — do unresolved derived
  links throw like authored ones, or are they soft? (Live board makes both behave identically
  today; the choice matters for robustness.)
