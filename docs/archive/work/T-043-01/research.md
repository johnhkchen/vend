# T-043-01 — Research: title-keyed idempotency for `proposeEpicEffect`

Descriptive map of the mint path, the pure-guard home, and the live-board read. No solutions here.

## The incident this fixes (`work/T-039-02/verdict.md`)

E-039's live sweep minted the doctor epic **twice**: `E-042` (logged, decomposed) and `E-041`
(childless duplicate, **same title** `vend-doctor-preflight`, never logged). The chain re-ran for the
*same* proposal (a cast/chain retry after a write-but-no-log timeout); each run minted a **fresh**
`max+1` id, so neither reused an id. The stable identity across the retry is the **title** — the
model re-mints `card.id` blind each run, so it is not stable.

## The mint sequence (`src/play/propose-effect.ts`)

`proposeEpicEffect(card, ctx)` (`:65`) is the play's one impure verb — addon-free but fs-touching:

1. `dir = join(ctx.projectRoot, EPIC_DIR)` where `EPIC_DIR = "docs/active/epic"` (`:36`).
2. `live = await listIdsIn(dir)` — basenames of every `*.md` on the board (`:70`).
3. `minted = nextEpicId(live)` — `max(E-NNN)+1`, the authoritative re-mint (design **D2**, `:17-24`).
4. `detectCollisions([minted], live)` — empty by construction; a hit relabels `id-collision`.
5. `renderCard({ ...card, id: minted })` → write `dir/<minted>.md` (`mkdir -p` + `writeFile`).
6. Returns `{ ok, detail, artifacts: [path], produced: path }`. `produced` is the chain handle
   (T-011-01) threaded into DecomposeEpic's `epicPath`.

**Key fact:** the re-mint is TOCTOU-safe against *clobbering* (it never reuses a live id), but it is
NOT idempotent across a retry of the *same proposal* — a second run grabs the *next* free slot and
writes a second card with the same title. That is exactly the E-041/E-042 split.

## The pure-guard home (`src/play/id-guard.ts`)

The purest module in the tree: `detectCollisions(generated, existing): string[]` (`:26`). **PURE,
TOTAL, no fs / addon** — plain string arrays in, deduped/ordered intersection out. Header (`:1-17`)
documents the discipline: never even a type-only BAML import. This is where a sibling title-dedup
belongs (the ticket's instruction: "beside `detectCollisions`").

It is reused verbatim by `propose-core.ts`'s `structuralGate` (`:210`) — id-REUSE detection at the
gate. That guard and E-004 are explicitly **out of scope** here (id-reuse ≠ duplicate-proposal).

## The new-title mint (`src/play/propose-core.ts`)

`nextEpicId(existing: readonly string[]): string` (`:259`) — **PURE, TOTAL**: scans `existing` for
`E-<digits>`, numeric max `+1`, zero-pads to three (`E-001` on an empty board). Tolerates ragged
widths and non-`E-` basenames (e.g. `TEMPLATE`). This is the new-title path that must stay
unchanged for back-compat. The structural gate's `EPIC_ID_RE = /^E-\d{3}$/` and `detectCollisions`
disjointness check (`:204-213`) are the model-output pre-flight, separate from the authoritative mint.

`renderCard(card)` (`:285`) writes frontmatter `title: ${card.title}` **verbatim** (`:292`), no
transform. So the on-disk `title:` value is byte-for-byte the model's `card.title` (a kebab slug like
`vend-doctor-preflight`). This pins how to normalize: trim + lowercase suffices; the disk form already
equals the card form.

## The live-board read (`src/play/project-context.ts`)

`listIdsIn(dir): Promise<string[]>` (`:92`) — reads `readdir(dir)`, filters `*.md`, returns
basenames-without-`.md`. Tolerates a missing dir → `[]`, never throws. **EXPORTED** and reused by the
materialize collision guard (T-004-02), so its signature must not change. It returns ids only — no
titles. To adopt-on-title the effect needs each epic's **title** too.

Title-from-frontmatter precedent: `decompose-epic.ts` `epicIdOf` (`:108`) pulls `id:` via
`/^\s*id:\s*(\S+)/m`, else basename. The same single-token regex against `title:` reads an epic's
slug. (`decompose-epic.ts` is NOT addon-free in spirit — keep new reads in `project-context.ts`,
which imports only `node:fs`.) The repo has **no YAML parser** (obs 21573) — frontmatter is
string-matched, never parsed.

## Board reality

`docs/active/epic/` holds `E-001…E-043` (no `E-041`) + `TEMPLATE.md`. Frontmatter is inline
`title: <slug>` on line 2 (e.g. `E-042` → `vend-doctor-preflight`, `E-043` → `idempotent-mint-guard`).
Basename always equals frontmatter `id`. `nextEpicId` works on basenames; adoption can return the
basename as the adopted id (consistent with the mint path).

## Test patterns

- `id-guard.test.ts`: pure-function tests, **no BAML import at all**, `toEqual` exact assertions,
  `Object.freeze` to prove non-mutation.
- `propose-effect.test.ts`: real temp-dir `projectRoot` via `mkdtemp`; BAML imports **type-only**;
  enum members as string-literal casts (no addon loads). `seedRoot(epicIds)` seeds
  `docs/active/epic/<id>.md` stubs (`---\nid: stub\n---\n`). Existing tests assert minted path,
  `produced === artifacts[0]`, round-tripped fields. The AC#3 double-run proof slots in here.

## Constraints / assumptions

- **Purity discipline:** the new dedup must be pure/total/fs-free, beside `detectCollisions`.
- **Back-compat:** a genuinely new title must still mint `max+1`, write, and return as today.
- **Addon-free effect:** the new title read must live in `project-context.ts` (node:fs only).
- **Single read:** the effect should read the board once and derive both ids (for `nextEpicId`) and
  titles (for adoption) from it, to keep `nextEpicId`'s input identical to today's `listIdsIn` set.
- **Honest boundary:** idempotency is on the EFFECT only; *why* it re-ran (chain retry) is untouched,
  and E-004 / decompose-side `IdCollisionError` stay unchanged.
- **Check gate:** `bun run check` = `baml:gen && check:typecheck && check:test`.
