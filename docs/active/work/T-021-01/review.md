# T-021-01 — Review: read-only-graph-model-loader

_Handoff document. What changed, how it's tested, what to watch. The reviewer should not need
to read every diff._

## What this delivers

A read-only loader that turns Vend's canonical board (`docs/active/{epic,stories,tickets}/*.md`
+ YAML frontmatter) into **one typed, deeply-frozen in-memory graph** the E-021 presentation
projection reads from. It is the data side of the epic's data/presentation split, and it honors
the epic's hard invariant — **one-way authority**: the loader exposes no write path.

## Acceptance criterion — met

> _A loader builds the typed graph from the live docs/active/** files; a test asserts the
> returned structure is frozen/read-only (mutation attempts throw or are type-rejected) and that
> edges resolve to existing nodes — exposes no write path._

- **Builds from the live files:** `loadWorkGraph()` (`src/graph/load.ts`); the live-board smoke
  test loads the real 21/26/61 board and resolves the `T-021-01 → S-021-01 → E-021` chain.
- **Frozen/read-only — both arms:** `deepFreeze` freezes every node, array, and the `byId`
  index → runtime mutation **throws** (tests: assigning a node field, `push` on a child/top
  array, writing into `byId` all throw); every field is `readonly`/`ReadonlyArray` → illegal
  writes are **type-rejected**.
- **Edges resolve to existing nodes:** `buildGraph` validates all four edge classes (ticket→
  story, story→tickets, ticket→depends_on, story→epic-by-convention) plus duplicate ids, and
  throws `GraphIntegrityError` listing every violation; six integrity tests cover each, and the
  live smoke asserts no dangling references.
- **No write path:** `model.ts` imports no `node:fs` at all; `load.ts` imports only `readdir`/
  `readFile` (never `writeFile`/`mkdir`). Read-only by construction.

## Files

| File | LOC (approx) | Role |
|---|---|---|
| `src/graph/model.ts` | ~330 | PURE core: node types, `parseFrontmatter`, coercers, `epicIdForStory`, `buildGraph`, `deepFreeze`, `GraphParseError`/`GraphIntegrityError` |
| `src/graph/load.ts` | ~70 | IMPURE verb: `loadWorkGraph(opts?)` — the only fs-touching file |
| `src/graph/model.test.ts` | ~150 | Pure tests: parsing, convention, linkage, derived `blocks`, integrity (×6), coercion (×2), frozen/read-only |
| `src/graph/load.test.ts` | ~70 | Impure: temp-dir round-trip (TEMPLATE/id-less skip, missing-dir tolerance) + live-board smoke |

No existing files modified or deleted. Follows the house **pure-core + impure-verb** split
(materialize.ts / survey-*.ts), the typed-error discipline (IdCollisionError), and the
ENOENT-tolerant readdir precedent (project-context.ts).

## Test coverage

- `bun run check` green: **610 pass / 0 fail**, tsc clean, baml:gen clean. +24 tests over the
  prior ~586; zero regressions.
- Pure logic is covered to every branch with string fixtures (no fs); the impure walk is
  covered by a temp-dir fixture; the real board is covered by a smoke test that is the canary
  for any future board corruption or convention drift.

## Design decisions a reviewer should know

1. **Faithful mirror, not a vocabulary validator.** `type`/`status`/`priority`/`phase` are kept
   as plain `string`, not narrowed unions — the live board carries values beyond the documented
   sets (`type: chore`, `feature`; epic `status: active`). Enum/label validation belongs to the
   projection, not the loader. The loader validates **structure** (required fields present,
   correct kinds) and **referential integrity** (edges resolve), nothing more.
2. **The epic→story edge is derived by id convention** (`S-NNN-* → E-NNN`), isolated in
   `epicIdForStory`, because there is no `epic:` field anywhere and no story-list in any epic
   (verified). This is the one non-authored edge; it is validated as strictly as the authored
   ones (a story with no matching epic throws). `StoryNode.epicId` is typed `string | null` to
   represent the pre-throw "missing" case, but is never null on a successfully-loaded board.
3. **`byId` is a frozen plain `Record`, not a `Map`** — a frozen `Map`'s `.set()` would silently
   succeed at runtime; a frozen object throws, giving the stronger "mutation throws" guarantee
   the AC wants.
4. **`blocks` is derived** as the inverse of all `depends_on` edges (matching Lisa's documented
   auto-computation), so the projection gets the "what does this unblock" arrows without a file
   field — no live ticket authors `blocks`.
5. **Containment edges are object references, cross/back edges are ids** → the object graph is a
   tree, so `deepFreeze` is a simple cycle-free recursion.

## Open concerns / limitations

- **A stray `.md` with no `---` fence in a board dir throws `GraphParseError`.** The id-less
  skip only applies to files that *have* a fence but no `id` (e.g. a notes file). This is
  intentional (canonical files always have frontmatter) but is a sharp edge if someone drops a
  plain markdown file into `docs/active/tickets/`. Easy to soften later (skip no-fence files)
  if it bites; left strict so genuinely malformed node files fail loud.
- **Strict integrity means the live board must stay consistent.** If a future edit introduces a
  dangling edge, `loadWorkGraph()` will throw — and the live-board smoke test will go red,
  which is the intended canary, not a regression in this code.
- **`serves`/`body` are stored verbatim (trimmed for `serves`).** No markdown sub-parsing of the
  body into Context/Acceptance-Criteria sections — the projection (downstream E-021 tickets)
  owns that extraction; this loader hands over the raw body, which is the right seam.
- **Performance:** loads the whole board into memory eagerly (61 tickets today). Fine at this
  scale; no incremental/lazy loading, which the projection does not need.

## Nothing requiring human escalation

The change is additive (new `src/graph/` package), fully tested, green on `bun run check`, and
introduces no new runtime dependency (`Bun.YAML` is built in). Left uncommitted for Lisa per the
task instruction.
