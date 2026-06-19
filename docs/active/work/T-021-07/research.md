# T-021-07 — Research: one-way-authority-guarantee

_Descriptive map. What exists, where, how it connects. No solutions here._

## The ticket in one line

Prove and enforce E-021's hard invariant: the projection/render path **reads** the canonical
graph and **never writes** it. Two teeth in the AC:

1. **Runtime (E2E):** snapshot `docs/active/**` byte-hashes, run `load → project → render`, assert
   every source file is byte-unchanged.
2. **Static:** the build fails if any presentation module imports a writer / does an fs-write
   **against `docs/active`**.

Depends on T-021-01 (the loader/model — landed) and T-021-05 (the projection — landed). This ticket
adds no new read/render capability; it adds a **guarantee** around what already exists.

## The read path as it exists today

The pipeline the AC names is, end-to-end:

```
docs/active/{epic,stories,tickets}/*.md
        │  (fs read — the ONE impure verb)
   loadWorkGraph()                         src/graph/load.ts
        │  → buildGraph() (pure, freezes)  src/graph/model.ts
   WorkGraph  (deeply frozen)
        │
   projectGraph(graph, spec, overlays?)    src/present/project.ts   (pure)
        │  → projectNode() per ticket      src/present/translate.ts (pure)
   Projection  (deeply frozen)
        │
   render  ← DOES NOT EXIST YET (deferred TUI epic; see T-021-05 review)
```

There is **no renderer module** in `src/` (confirmed by file sweep). T-021-05's review states the
renderer is "a later epic." So "render" in the AC has no concrete module to call; the full read
path that exists today terminates at `Projection`. A trivial serialization of the projection
(e.g. `JSON.stringify`) is the only available "render" leg.

## Key modules and their fs posture

| Module | fs imports | Writes? | Target |
|---|---|---|---|
| `src/graph/model.ts` | none | no | — (pure; parses/links/freezes) |
| `src/graph/load.ts` | `readFile`, `readdir` only | **read-only** | reads `docs/active/**` |
| `src/present/project.ts` | none (type-only graph/spec imports) | no | — (pure) |
| `src/present/translate.ts` | none | no | — (pure) |
| `src/present/spec.ts` | none | no | — (pure) |
| `src/present/presets.ts` | **`mkdir`, `readFile`, `writeFile`** | **yes** | **`.vend/presets/`** (NOT docs/active) |

The critical nuance: **`presets.ts` writes to the filesystem** (`saveSeatSpec` →
`mkdir`/`writeFile`) — but its target is `DEFAULT_PRESETS_DIR = ".vend/presets"` (the spec store,
the calibration loop's persistence), never `docs/active`. This is the legitimate "edit the spec,
never the data" write. So the static check **cannot** be a blanket "no presentation module imports
a writer" — that would false-flag `presets.ts`. The offense is specifically a write **whose target
is `docs/active`**.

## A subtle trap: `docs/active` appears in comments everywhere

`project.ts`, `translate.ts`, `spec.ts`, and `presets.ts` all reference `docs/active/pm/...` paths
**in header comments** (provenance pointers to PM docs). A naive substring scan for `docs/active`
would match all of them — and `presets.ts` *also* imports writers — so a naive
`(imports-writer) AND (mentions "docs/active")` check would **false-positive `presets.ts`**.

Therefore any static check must operate on **comment-stripped code**, and must detect a writer by
its **import/call shape**, not by the mere appearance of the word "writeFile" as data (the guard
module itself will name the forbidden primitives as string constants).

## Existing static-check / gate precedent (the house pattern to mirror)

`src/ci/` holds two gates built to one template (ci-strategy.md, R12 shared-contract idiom):

- **`committed-core.ts`** — a PURE classifier: `classifyPorcelain(text) → offending paths`, scoped
  by an exported `SOURCE_PREFIXES` const. Pragmatic string matching ("over-flagging a weird path
  beats missing it"). Paired with a thin impure entry `check-committed.ts` (`import.meta.main`,
  runs git, exits a 0/1/2 code) wired as `bun run check:committed` in `package.json`.
- **`head-build-core.ts` / `check-head.ts`** — same pure-core + thin-verb split, exit vocabulary
  0=ok / 1=andon / 2=env-error.

The lesson from **E-012** is load-bearing here: a gate that **exempts its own enforcement source**
has a blind spot. The committed gate had to add `.lisa/hooks/` to `SOURCE_PREFIXES` so it could not
self-exempt. A static-import guard whose own core names the forbidden primitives must avoid the
mirror of that trap: it must not need to exclude itself from its own scan.

## How "fails the build" is wired

`package.json`: `check = baml:gen && check:typecheck (tsc --noEmit) && check:test (bun test)`. The
`check:committed` / `check:head` scripts are **not** part of `check` — they are lisa hooks invoked
on stop/clear, because they inspect host git state a container/test can't. A **source-text scan**,
by contrast, *can* run as an ordinary `bun test` (read files from disk, pure classify) — so wiring
it into the test suite makes it "fail the build" via `check:test` with zero new package.json
plumbing. This is the same surface the live-board smoke test (`load.test.ts`) already uses.

## Test conventions observed

- `bun:test` (`describe`/`test`/`expect`). Pure cores tested with fabricated fixtures; impure verbs
  with `mkdtemp` temp-dir fixtures; one live-board smoke per loader (`load.test.ts` calls
  `loadWorkGraph()` against `process.cwd()`).
- `project.test.ts` already builds a **real frozen graph** via `buildGraph` and asserts
  `Object.isFrozen(graph)` and `graph.tickets === ref` after projecting — the reference-unchanged
  half of one-way authority is *unit*-tested there. What's missing is the **byte-on-disk** proof and
  the **static import** proof — this ticket's job.
- `WorkGraph` is deeply frozen (`deepFreeze`), so a write attempt throws at runtime in ESM strict
  mode — the compile-time `readonly` types + runtime freeze are the existing in-memory guarantees.
  This ticket adds the **on-disk** guarantee (bytes) and the **source-level** guarantee (imports).

## Constraints & assumptions

- **No renderer exists** → "render" must be interpreted as the read path that exists (load→project)
  plus a trivial serialization; the test must document this and remain valid when a real renderer
  lands (the byte-hash assertion brackets the whole pipeline regardless of what "render" becomes).
- The static check must be **pure and total** (house rule): take source text, return offender data,
  never throw on a "dirty" finding.
- Scope of "presentation module" = files under `src/present/` (excluding `*.test.ts`). The loader
  (`src/graph/load.ts`) is read-only by construction and out of the present layer, but is the one
  module that *does* touch `docs/active` — worth a confirming assertion that it imports no writer.
- Byte-hashing must walk `docs/active/**` recursively (epic/stories/tickets + pm/, work/ subtrees);
  `Bun.hash` or `node:crypto` SHA-256 are both available.
