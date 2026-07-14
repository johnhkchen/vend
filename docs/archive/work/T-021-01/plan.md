# T-021-01 — Plan: read-only-graph-model-loader

_Ordered, independently-verifiable steps + testing strategy. Grounded in `structure.md`._

## Testing strategy (what proves it)

- **Pure unit tests** (`model.test.ts`) carry the weight — string/record fixtures, no fs, the
  `Bun.YAML` global available in-process. They cover parsing, coercion errors, the epic
  convention, integrity throws, and the **frozen/read-only AC** (the literal AC bullet).
- **Impure tests** (`load.test.ts`): one temp-dir round-trip (incl. a `TEMPLATE.md` that must
  be skipped) + a **live-board smoke** that loads `docs/active/**` and asserts it does not
  throw and edges resolve — this is the real proof the loader matches the canonical data.
- **Gate:** `bun run check` (baml:gen → tsc → bun test) green, zero regressions to the
  existing suite (~586 tests).
- **AC mapping:** "frozen/read-only (mutation throws or type-rejected)" → frozen-tests +
  `readonly` types; "edges resolve to existing nodes" → integrity tests + live smoke;
  "exposes no write path" → structural (no fs-write import) + reviewed in `review.md`.

## Steps (each commit-sized, verifiable)

### Step 1 — `model.ts`: types + error classes
Declare `RawNode`, `TicketNode`, `StoryNode`, `EpicNode`, `AnyNode`, `WorkGraph` (all
`readonly`, `string` enums per D2), and `GraphParseError` / `GraphIntegrityError` (named,
`extends Error`, `.violations` on the latter).
**Verify:** `tsc --noEmit` clean.

### Step 2 — `parseFrontmatter` + `epicIdForStory` + coercers
- `parseFrontmatter(text, file)`: fence regex, `Bun.YAML.parse`, body remainder; throw
  `GraphParseError` on no fence / non-mapping.
- `epicIdForStory(storyId)`: `"E-"+split("-")[1]`; throw on non-`S-` shape.
- `str/optStr/strArray` coercers throwing `GraphParseError(file, …)` on type mismatch.
**Verify:** covered next step; `tsc` clean.

### Step 3 — `buildGraph` + `deepFreeze`
Implement the D5 ordering: coerce → dup-id guard → index → derive `blocks` → link+validate
(collect ALL violations) → throw `GraphIntegrityError` if any → assemble `WorkGraph` →
`deepFreeze` → return. `deepFreeze` recursive `Object.freeze`.
**Verify:** `tsc` clean; exercised by Step 5 tests.

### Step 4 — `load.ts`: the impure verb
`loadWorkGraph(opts?)`: per-dir `readdir` (ENOENT→`[]`), keep `*.md`, drop `TEMPLATE.md`,
`readFile`, `parseFrontmatter`, drop id-less records; call `buildGraph`. No write imports.
**Verify:** `tsc` clean.

### Step 5 — `model.test.ts` (pure)
All cases from the structure test blueprint, incl. the frozen/read-only assertions and one
`GraphIntegrityError` case per edge class + duplicate id + one `GraphParseError` case.
**Verify:** `bun test src/graph/model.test.ts` green.

### Step 6 — `load.test.ts` (impure) + full check
Temp-dir fixture (with a `TEMPLATE.md`) round-trip; live-board smoke. Then `bun run check`.
**Verify:** `bun run check` green, no regressions.

## Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| `Bun.YAML` edge case (folded `serves: >`, inline comments) | low | Verified in Research against real `E-001`/`E-019`; live smoke re-verifies on all 21 epics |
| Frozen `Map` wouldn't throw on `.set()` | n/a | Chose frozen plain `Record` for `byId` (D2) — throws on assignment |
| Live board has a latent dangling edge → strict loader throws on real data | low | Research verified zero dangling edges across 21/26/61; smoke is the canary |
| `TEMPLATE.md` (id `E-000`) pollutes the graph | certain if unhandled | Verb skips `TEMPLATE.md` + id-less records (Step 4); temp-dir test asserts exclusion |
| Deep-freeze cycle | none | Object graph is a tree (containment=objects, cross-refs=ids) — no cycle by construction (D5) |
| Coupling to `project-context.listIdsIn` | avoided | Verb does its own readdir (needs bodies, not ids) — no-shared-util idiom |

## Definition of done

- `src/graph/{model,load}.ts` + their tests exist.
- A test asserts the returned graph is frozen/read-only (mutation throws) — the AC bullet.
- A test asserts every edge resolves (integrity throws on a broken fixture; live board loads).
- No write path exported (no `writeFile`/`mkdir` in either module).
- `bun run check` green; `review.md` written.
