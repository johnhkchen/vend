# T-043-01 — Design: title-keyed idempotency

Decisions, grounded in Research. The shape mirrors the E-004 guard: a **pure** dedup oracle in
`id-guard.ts` + an **impure** adopt-before-mint in the effect.

## D1 — Adopt vs refuse (the recorded call): **ADOPT**

Two ways to make the retry safe:

- **Adopt** — when the title already exists, return `{ ok: true }` pointing `produced`/`artifacts` at
  the *existing* card, minting nothing. The retried chain proceeds on the existing epic and **clears**
  (decompose runs against the real card).
- **Refuse** — raise a `duplicate-title` andon (`ok: false`, an `outcome`), minting nothing. The card
  is left undecomposed; the run clears **0**.

**Chosen: adopt.** Idempotency means "a retry yields the same observable outcome as the first run" —
adopt delivers that: the chain continues, the epic gets decomposed exactly once, no orphan. Refuse
turns a benign retry into a dead run that a human must rescue — strictly worse for the failure mode we
saw (E-041 was a silent childless orphan; we want the *opposite* of leaving work stranded). Refuse
also can't distinguish "my own retry" from "a genuine name clash with someone else's epic", but in
this codebase the propose play is the sole minter of epic cards and the title IS the proposal's
identity, so a same-title hit is definitionally the same proposal. Recorded per AC#4.

## D2 — Where the title-dedup lives: **`id-guard.ts`, beside `detectCollisions`**

The ticket and the E-004 precedent both point here. `findExistingByTitle` is the same *kind* of
thing as `detectCollisions`: a pure, total, fs-free oracle over plain data that the impure effect
consults before writing. Keeping it beside `detectCollisions` keeps the purest module the single home
of "what already exists on the board" logic. Rejected: putting it in `propose-core.ts` (that module is
the gates+renderer+mint; a board-membership oracle is not card judgment) or inline in the effect (un-
unit-testable without a temp dir, and it would not be reused/pinned as a pure function).

## D3 — Signature: `findExistingByTitle(title, existing): string | null`

```ts
findExistingByTitle(
  title: string,
  existing: ReadonlyArray<{ readonly id: string; readonly title: string }>,
): string | null
```

- Returns the **id** of the first existing epic whose normalized title equals the normalized `title`,
  else `null`. `string | null` (not `string[]`) because adoption needs exactly one target — the first
  match — and `null` is the unambiguous "new title, mint as usual" signal.
- `existing` is `{id, title}[]` (not parallel arrays): the effect reads both together, and the oracle
  returns the matched id. Structural typing keeps it decoupled from `EpicCard` (no BAML import) — it
  only ever sees `{id, title}`, mirroring how `detectCollisions` only ever sees strings.

**Normalization:** `s.trim().toLowerCase()`. Justified by Research — `renderCard` writes
`title: ${card.title}` verbatim, so disk-title === card-title already; trim+lowercase is a cheap,
total guard against incidental whitespace/case drift without over-engineering a slugifier the data
doesn't need. A **blank** normalized target returns `null` (never adopts on emptiness — the
structural gate already requires a non-empty title, this is defense in depth). Pure, total, no throw.

**First-match semantics:** at most one same-title epic exists in the real failure mode (the retry
makes the *second*; this guard prevents it). If two ever existed, returning the first (readdir order)
is deterministic-enough and still mints nothing — the conservative choice.

## D4 — The live read: a **sibling** `listEpicIdTitlesIn`, not a change to `listIdsIn`

`listIdsIn` is exported and reused by the materialize guard (Research) — changing its return type
ripples. Instead add a sibling in `project-context.ts`:

```ts
export interface EpicIdTitle { readonly id: string; readonly title: string }
export async function listEpicIdTitlesIn(dir: string): Promise<EpicIdTitle[]>
```

It reads `readdir(dir)`, filters `*.md`, and for each reads the file and greps
`/^\s*title:\s*(\S+)/m` (the `epicIdOf` regex aimed at `title:`; missing → `""`). `id` is the
**basename** (matching `listIdsIn` and the mint path, not the frontmatter id — they're equal in this
repo but the basename is what `nextEpicId`/`detectCollisions` operate on). Tolerates a missing dir →
`[]`, never throws (the `listIdsIn` discipline). Lives in `project-context.ts` because that module
imports only `node:fs` — the effect stays addon-free.

**One read, derive both.** The effect replaces `listIdsIn(dir)` with `listEpicIdTitlesIn(dir)` and
derives `liveIds = pairs.map(p => p.id)` for `nextEpicId`/`detectCollisions`. Because
`listEpicIdTitlesIn` uses the **same** `*.md` filter and basename rule as `listIdsIn`, `liveIds` is
byte-identical to today's `live` — so the new-title mint path is provably unchanged (back-compat).
Rejected: two separate reads (`listIdsIn` + a titles read) — redundant fs and a chance for the two
id-sets to drift.

## D5 — The effect's adopt branch

Before `nextEpicId`:

```ts
const liveEpics = await listEpicIdTitlesIn(dir);
const adopted = findExistingByTitle(card.title, liveEpics);
if (adopted !== null) {
  const path = join(dir, `${adopted}.md`);
  return { ok: true, detail: `idempotent — '${card.title}' already minted as ${adopted}`,
           artifacts: [path], produced: path };
}
const liveIds = liveEpics.map((e) => e.id);
const minted = nextEpicId(liveIds);
// …detectCollisions / render / write unchanged…
```

`produced` points at the existing card so the chain decomposes the real epic (idempotent outcome).
No `outcome` field on the adopt result — it is a **success** (`ok: true`), not a relabeled failure.

## D6 — What stays unchanged (honest boundary)

- `detectCollisions` and the post-mint `id-collision` guard — untouched (id-reuse is a different
  failure; the empty-by-construction guard still runs on the mint path).
- `propose-core.ts` `structuralGate` / `nextEpicId` / `renderCard` — untouched.
- The decompose-side `IdCollisionError` / E-004 — untouched.
- *Why* the effect re-ran (the chain retry) — out of scope, noted in Review as a follow-up.

## Risks

- **Adopting an already-decomposed epic (E-042 case):** re-running decompose on it could attempt to
  re-mint stories — but the decompose-side E-004 guard catches story id-reuse and raises its own
  andon. Acceptable and documented (AC#4 honest boundary).
- **Title drift** (someone hand-edits a card's title): adoption would miss and mint a new id — the
  same behavior as today, no regression. Acceptable.
