# T-021-01 — Structure: read-only-graph-model-loader

_The blueprint — files, boundaries, public interfaces, ordering. Not code._

## Files

| File | Status | Role |
|---|---|---|
| `src/graph/model.ts` | **create** | PURE core: types, `parseFrontmatter`, coercers, `epicIdForStory`, `buildGraph`, `deepFreeze`, error classes |
| `src/graph/load.ts` | **create** | IMPURE verb: `loadWorkGraph(opts?)` — readdir/readFile the three dirs, skip TEMPLATE, call `buildGraph` |
| `src/graph/model.test.ts` | **create** | PURE tests over string/record fixtures: parsing, coercion errors, convention, integrity throws, **frozen/read-only** |
| `src/graph/load.test.ts` | **create** | IMPURE tests: temp-dir fixture round-trip; live-board smoke (loads clean, edges resolve) |

No existing files are modified or deleted. `src/play/project-context.ts`'s `listIdsIn` is the
listing precedent but is NOT imported (it returns ids, not file contents; we need bodies) — the
no-shared-util idiom: the verb does its own thin `readdir` rather than coupling to it.

## `src/graph/model.ts` — public surface

**Types (all `readonly`):** `RawNode` (parsed-but-unlinked: `{ data: Record<string,unknown>;
body: string; file: string }`), `TicketNode`, `StoryNode`, `EpicNode`, `AnyNode =
EpicNode | StoryNode | TicketNode`, `WorkGraph`. Shapes exactly as `design.md` D2.

**Error classes** (named, `extends Error`, mirroring `IdCollisionError`):
- `GraphParseError(file, reason)` — malformed/missing frontmatter field on one file.
- `GraphIntegrityError(violations: readonly string[])` — one or more unresolved edges /
  duplicate ids; message lists all, `.violations` carries them for the caller.

**Pure functions:**

```ts
export function parseFrontmatter(text: string, file: string): RawNode
// split leading ---fence---; Bun.YAML.parse the YAML; body = remainder.
// throws GraphParseError(file, …) if no fence or YAML is not a mapping.

export function epicIdForStory(storyId: string): string
// "S-021-01" -> "E-021"; "S-001" -> "E-001". throws GraphParseError if id is not S-shaped.

export function buildGraph(
  epics: readonly RawNode[],
  stories: readonly RawNode[],
  tickets: readonly RawNode[],
): WorkGraph
// the heart: coerce -> dup-id check -> link (objects) -> derive blocks -> integrity check
//            -> deepFreeze -> return. throws GraphParseError / GraphIntegrityError.

export function deepFreeze<T>(value: T): T   // recursive Object.freeze; exported for the test
```

**Private helpers (module-internal):** `str(data, key, file)` /`optStr`/`strArray` coercers
(throw `GraphParseError` on type mismatch); `coerceTicket/Story/Epic(raw)`; `computeBlocks`.

### `buildGraph` internal ordering (matters)

1. **Coerce** each raw list to typed *partial* records (fields only, children empty) — fail
   fast on malformed frontmatter with the filename.
2. **Duplicate-id guard:** build `byId`; a repeated id → collect into integrity violations.
3. **Index** stories by id, tickets by id.
4. **Derive `blocks`:** invert all `dependsOn` edges → `Map<ticketId, string[]>` (sorted).
5. **Link & validate (collect ALL violations, throw once):**
   - tickets: resolve `storyId` (exists?) — finalize ticket node with derived `blocks`,
     validate each `dependsOn` id exists.
   - stories: resolve each `tickets[]` id → ticket object (exists?), preserve order; resolve
     `epicIdForStory` (epic exists?) → `epicId`.
   - epics: attach stories whose `epicId === epic.id`, in story-id sort order.
6. If `violations.length` → `throw new GraphIntegrityError(violations)`.
7. Assemble `WorkGraph { epics, stories, tickets, byId }`, `deepFreeze`, return.

Because children are object refs assembled bottom-up (ticket → story → epic), and built once
then frozen, there is no cycle and no post-freeze mutation.

## `src/graph/load.ts` — public surface

```ts
export interface LoadOptions {
  readonly root?: string;        // defaults to process.cwd()
  readonly epicDir?: string;     // default <root>/docs/active/epic
  readonly storyDir?: string;    // default <root>/docs/active/stories
  readonly ticketDir?: string;   // default <root>/docs/active/tickets
}
export async function loadWorkGraph(opts?: LoadOptions): Promise<WorkGraph>
```

Behavior:
- For each dir: `readdir`, keep `*.md`, **drop `TEMPLATE.md`**, `readFile` each, `parseFrontmatter`.
- **Drop any record whose frontmatter has no `id`** (defensive — placeholder/non-node files).
- Hand the three `RawNode[]` to `buildGraph`. Return its result.
- Tolerate a missing directory → treat as empty (the `project-context.ts` ENOENT→`[]`
  precedent), so a partially-scaffolded board still loads.
- No write/mkdir anywhere — read-only by construction (AC: "exposes no write path").

## Module boundaries / invariants

- `model.ts` imports nothing from the project except via `import type` where needed; uses the
  `Bun.YAML` global. No `node:fs`. No native addon.
- `load.ts` imports `node:fs/promises` (`readdir`, `readFile`) + `node:path` (`join`) and the
  pure core. It is the *only* file touching the filesystem.
- One-way authority (E-021 invariant): neither file exports a function that writes the
  canonical docs. Enforced structurally — there is simply no `writeFile`/`mkdir` import.

## Test blueprint

`model.test.ts` (pure, `Bun.YAML` available in-process):
- `parseFrontmatter`: valid → fields + body; inline-comment strip; missing fence → throws.
- `epicIdForStory`: `S-021-01`→`E-021`, `S-001`→`E-001`; malformed → throws.
- `buildGraph` happy path on a small 1-epic/1-story/2-ticket fixture → correct linkage,
  derived `blocks`, story order preserved.
- integrity: dangling `ticket.story`, dangling `story.tickets`, dangling `depends_on`,
  missing epic, duplicate id → each throws `GraphIntegrityError` with the offender listed.
- coercion: frontmatter missing `id` / wrong-typed `tickets` → `GraphParseError` naming file.
- **frozen/read-only (the AC):** assigning to a node field, `push` on `tickets`/`epics`,
  assigning into `byId` all **throw**; `deepFreeze` proves nested freeze.

`load.test.ts` (impure):
- temp-dir fixture (write 3 dirs incl. a `TEMPLATE.md`) → `loadWorkGraph({root})` returns a
  graph that excludes the template and resolves edges.
- live-board smoke: `loadWorkGraph()` against the repo root loads without throwing; assert
  `epics/stories/tickets` non-empty and a spot-checked edge resolves (e.g. `T-021-01`'s story
  is `S-021-01`, whose epic is `E-021`).

## Ordering of work (feeds `plan.md`)

types → `parseFrontmatter`+`epicIdForStory` → coercers → `buildGraph` → `deepFreeze` →
`load.ts` → tests → `bun run check`.
