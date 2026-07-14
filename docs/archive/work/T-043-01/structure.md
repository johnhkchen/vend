# T-043-01 — Structure: file-level blueprint

Not code — the shape of the code. Four files touched (two src, two test), zero deleted.

## File 1 — `src/play/id-guard.ts` (MODIFY: add pure title-dedup)

Add **beside** `detectCollisions` (no change to `detectCollisions` itself):

- A private `normalizeTitle(s: string): string` → `s.trim().toLowerCase()`. One definition of
  "same title", shared by target and candidates.
- **`export function findExistingByTitle(title, existing): string | null`**
  - `existing: ReadonlyArray<{ readonly id: string; readonly title: string }>` — structural type, no
    BAML import (keeps the module's "purest in the tree" invariant).
  - Body: `const target = normalizeTitle(title); if (target === "") return null;` then a single loop
    returning `epic.id` on the first `normalizeTitle(epic.title) === target`, else `null`.
  - Header doc-comment in the module voice: PURE, TOTAL, no fs/addon; the title-keyed sibling of the
    id-reuse guard; returns the existing id to **adopt** or `null` to mint fresh; first-match
    deterministic; blank target never adopts.

Public surface added: `findExistingByTitle`. `detectCollisions` signature/behavior unchanged.

## File 2 — `src/play/project-context.ts` (MODIFY: add titled board read)

Add a sibling to `listIdsIn` (which stays unchanged — the materialize guard depends on it):

- **`export interface EpicIdTitle { readonly id: string; readonly title: string }`**
- **`export async function listEpicIdTitlesIn(dir: string): Promise<EpicIdTitle[]>`**
  - `readdir(dir)` in a `try/catch` → `[]` on a missing dir (the `listIdsIn` discipline).
  - Filter `name.endsWith(".md")` (same filter as `listIdsIn`, so derived ids match exactly).
  - For each: `id = name.slice(0, -3)`; read the file (`readFile(join(dir,name),"utf8")`, skip on a
    per-file read error); `title = body.match(/^\s*title:\s*(\S+)/m)?.[1] ?? ""`.
  - Return the `{id, title}[]` in `readdir` order.
  - Doc-comment: the titled sibling of `listIdsIn`; reads each `E-*.md` frontmatter `title:` (the
    `epicIdOf` regex aimed at `title:`); ids are basenames so `pairs.map(p=>p.id)` equals `listIdsIn`;
    tolerant of a missing dir; `node:fs` only (addon-free).

No new imports needed — `readFile`, `readdir`, `join` are already imported.

## File 3 — `src/play/propose-effect.ts` (MODIFY: adopt before mint)

- Imports: drop `listIdsIn`, add `listEpicIdTitlesIn` from `./project-context.ts`; add
  `findExistingByTitle` to the existing `./id-guard.ts` import (`detectCollisions` stays).
- `proposeEpicEffect` body, replacing the `const live = await listIdsIn(dir)` line:
  1. `const liveEpics = await listEpicIdTitlesIn(dir);`
  2. `const adopted = findExistingByTitle(card.title, liveEpics);`
  3. **adopt branch:** `if (adopted !== null) { const path = join(dir, ` + "`${adopted}.md`" + `);
     return { ok: true, detail: ` + "`idempotent — '${card.title}' already minted as ${adopted}`" +
     `, artifacts: [path], produced: path }; }`
  4. `const live = liveEpics.map((e) => e.id);` — then `nextEpicId(live)` /
     `detectCollisions([minted], live)` / render / write **unchanged**.
- Update the module header (`:17-24` ID POLICY block): add a short paragraph that the effect now
  **adopts** an existing same-title epic before re-minting (title-keyed idempotency, T-043-01),
  mirroring how the structural gate's `detectCollisions` keeps id-reuse out — the mint policy is
  unchanged for a genuinely new title.

## File 4 — `src/play/id-guard.test.ts` (MODIFY: cover `findExistingByTitle`)

New `describe("findExistingByTitle — title-keyed adoption oracle")`, same pure-test style (no BAML
import, `toEqual`/`toBe`, `Object.freeze` for purity):

- exact match → returns that id; the E-041/E-042 fixture (`vend-doctor-preflight` already on a board
  with `E-042` → returns `E-042`).
- no match → `null`.
- normalization: differing case / surrounding whitespace still match.
- blank target (`""` / `"   "`) → `null` even if a blank-title entry exists.
- empty `existing` → `null`.
- first-match determinism: two same-title entries → returns the first.
- purity: `Object.freeze`d inputs survive unchanged.

## File 5 — `src/play/propose-effect.test.ts` (MODIFY: AC#3 deterministic proof)

New `describe("proposeEpicEffect — title-keyed idempotency (AC#3)")`, reusing `FULL_CARD`,
`ctxFor`, `seedRoot`, `EPIC_DIR`, and a small `countEpicFiles(dir)` helper (readdir + filter `E-*.md`):

- **double-run, same card → mints once:** run on an empty board (mints `E-001`), run the *same* card
  again → second result `ok`, `produced` === first `produced` (`…/E-001.md`), `detail` contains
  `idempotent`; the epic dir holds exactly **one** `E-*.md`. Mapped in a comment to the E-041 incident.
- **two distinct-title cards → two epics:** run `FULL_CARD` then a clone with a different `title` →
  two distinct minted paths (`E-001.md`, `E-002.md`), dir holds two files (back-compat / new-title
  path intact).
- (optional) **adopt on a populated board:** seed `E-001…E-003` where one carries `FULL_CARD.title`
  → adopts that id, mints nothing. Uses a richer `seedRoot` stub that writes a real `title:` line.

> Note: existing `seedRoot` writes `---\nid: stub\n---\n` (no title). The idempotency tests drive the
> effect end-to-end (first run writes a real card via `renderCard`, so its on-disk `title:` is real) —
> so the double-run test needs no seeding change. The populated-board test needs a stub *with* a
> `title:` line; add a tiny local helper rather than changing the shared `seedRoot`.

## Ordering of changes (so each step typechecks)

1. `id-guard.ts` — add `findExistingByTitle` (self-contained, pure).
2. `project-context.ts` — add `EpicIdTitle` + `listEpicIdTitlesIn` (self-contained).
3. `propose-effect.ts` — wire both in (depends on 1 & 2).
4. Tests (3 & 4) — depend on the new exports.

## Public-surface summary

| Symbol | File | Change |
|---|---|---|
| `findExistingByTitle` | `id-guard.ts` | **new export** |
| `EpicIdTitle` | `project-context.ts` | **new export** |
| `listEpicIdTitlesIn` | `project-context.ts` | **new export** |
| `detectCollisions`, `nextEpicId`, `renderCard`, `listIdsIn` | — | unchanged |
