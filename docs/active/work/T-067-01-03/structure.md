# T-067-01-03 — bare-code-write-guard — Structure

File-level blueprint. Two production modules touched, one outcome minted, one new test
file, three test files updated. No new production module; gates.ts, decompose.baml,
charter-snapshot.ts, project-context.ts untouched (story fence).

## Files

| File | Change |
| --- | --- |
| `src/log/run-log.ts` | modify — mint the `bare-code` outcome |
| `src/play/materialize.ts` | modify — pure detector + typed error + verb reorder |
| `src/play/decompose-epic.ts` | modify — relabel arm in `decomposeEffect` |
| `src/play/materialize.test.ts` | modify — detector unit tests + real-fs guard tests |
| `src/play/bare-code-cast.test.ts` | **new** — the cast-level fixture proof (AC clause 2) |
| `src/play/story-gate-cast.test.ts` | modify — `CHARTER` fixture → bold-shaped |
| `src/play/chain-propose-decompose.test.ts` | modify — `CHARTER` fixture → bold-shaped |

## src/log/run-log.ts

One tuple member + provenance doc line:

```ts
export const RUN_OUTCOMES = [..., "graph-invalid", "bare-code", "errored"] as const;
```

Placed before `errored` (refusals grouped, `errored` stays terminal). Doc comment gains:
`` `bare-code` ← materialize's write guard: a rendered body would carry a policed code
the charter cannot resolve, refused BEFORE any write (T-067-01-03) ``. Everything else
derives (`RunOutcome`, `assertOutcome`, `readRunLog` validation, walk-away's
`OutcomeMix`, `test.each(RUN_OUTCOMES)`).

## src/play/materialize.ts — the ticket's core

New exports, beside the existing prose helpers (module header comment gains a
T-067-01-03 paragraph):

```ts
/** One file's unresolved bare codes, in body order, deduped. */
export interface BareCodeHit {
  readonly file: string;           // RenderedFile.name, e.g. "T-067-99-01.md"
  readonly codes: readonly string[];
}

/** PURE, TOTAL. Scan rendered bodies for bare (unglossed) codes in the policed
 *  prefix families; [] means clear — safe to write. */
export function findBareCodes(
  files: readonly RenderedFile[],
  snapshot: CharterSnapshot,
): BareCodeHit[];

/** IdCollisionError's sibling: thrown by materialize BEFORE any mkdir/write. */
export class BareCodeError extends Error {
  readonly hits: readonly BareCodeHit[];
  // name = "BareCodeError"; message names each file with its codes, e.g.
  // "materialize: refusing to write — bare unresolved code(s): T-900-01.md: P9; S-900.md: N7"
}
```

Internal shape of `findBareCodes` (D2):

- `BARE_CODE = /\b([A-Z]{1,3})\d+\b(?! —)/g` — the generic resolver shape with
  `PROSE_CODE`'s exact gloss-skip lookahead, declared NEXT TO `PROSE_CODE` with a
  keep-in-lockstep comment (the two share the definition of "glossed").
- Policed prefixes: `{"P", "N"}` floor ∪ the leading-letter prefix of every snapshot
  key. The snapshot is used ONLY to derive prefixes — a bare policed-prefix code is a
  hit whether or not the snapshot could have resolved it (post-render, resolvable codes
  are already glossed; a bare one is a defect by definition).
- Per file: match all, filter by prefix membership, dedupe preserving first-occurrence
  order; emit a `BareCodeHit` only for files with ≥1 code. Whole rendered file is
  scanned (frontmatter/DAG/footer carry no `[PN]\d+`-shaped tokens by construction —
  ids are `T-`/`S-`/`E-`-prefixed with hyphens).

`materialize` reorder (D4) — new order, same signature:

```
listIdsIn ×2 → detectCollisions → throw IdCollisionError
cutDate + snapshotCharterCodes(charter)
render ALL stories → rendered[]      (pure, in-memory; keeps plan order)
render ALL tickets → rendered[]
findBareCodes(all rendered, snapshot) → throw BareCodeError on hits
mkdir ×2
write stories, write tickets          (from the rendered arrays, same paths/order)
```

The story-tickets filter (`plan.tickets.filter(...)`) moves with the render loop;
`storyFiles`/`ticketFiles` result arrays are built in the write loop exactly as today.
Doc comment on the verb: the T-067-01-02 "slots between" sentence is replaced by the
realized contract (two guards, both pre-mkdir, collision first — identity before
content).

## src/play/decompose-epic.ts

`decomposeEffect`'s catch gains one arm before the rethrow (import `BareCodeError`
alongside `IdCollisionError`):

```ts
if (e instanceof BareCodeError) {
  return { ok: false, outcome: "bare-code",
           detail: `bare-code — charter cannot resolve cited code(s): <per-file summary from e.hits>` };
}
```

The effect's doc comment bullet list gains the third relabel. Nothing else moves.

## src/play/bare-code-cast.test.ts (new)

story-gate-cast.test.ts's skeleton, retargeted (same tmp/afterEach hygiene, same
`stubExecutor`, same decompose-shaped fixture play wiring REAL `clear` + REAL
`materialize` — small local copies, per that file's precedent of self-containment):

- **Fixture data**: a BOLD-shaped `CHARTER` (P1/P3/P4/N1 defined); `REFUSED_PLAN` — one
  fully-valid ticket whose `purpose` cites `P9` in prose (advances `["P1"]`, resolvable,
  so the REAL bounds gate passes and the refusal is provably the write guard's);
  `CLEAN_PLAN` — one story with all five contract sections + two tickets, prose and
  advances citing only defined codes.
- **Test 1 (refusal)**: cast `REFUSED_PLAN` → `summary.outcome === "bare-code"`,
  `materialized === false`, both target dirs ENOENT, run-log record's outcome +
  detail name `P9` and the offending file.
- **Test 2 (grep-clean)**: cast `CLEAN_PLAN` → `success`; `readdir` both dirs, read
  every written body, assert `/\b[PN]\d+\b(?! —)/` matches nothing in any of them, and
  spot-assert one glossed rendering (`P1 — …`) so the grep isn't vacuous.

## src/play/materialize.test.ts

- New `describe("findBareCodes …")` — pure unit tests (see plan.md for the case list:
  clear/hit/dedupe/gloss-skip/foreign-prefix/snapshot-derived-prefix/empty-snapshot).
- Real-fs guard section gains two tests beside the collision pair:
  refusal (charter missing a cited code → `BareCodeError`, hits payload, dirs ENOENT,
  nothing on disk) and pass (bold charter, plan writes normally — largely covered by
  the existing "fresh/disjoint board" test once fixtures resolve).

## Fixture updates (D7)

- `story-gate-cast.test.ts:40` — `CHARTER` becomes bold-shaped, same three codes
  (`**P1 — Author once, run forever.** …` etc.). Contrast-cast `toContain` assertions
  unaffected (substring, frontmatter/DAG untouched by glossing).
- `chain-propose-decompose.test.ts:52` — `CHARTER` becomes bold-shaped, same four
  codes. Both uses (inputs literal + `seedRoot` write / `toBe` pass-through assert)
  reference the one const, so the change is one line.

## Ordering of changes

1. run-log.ts outcome mint (leaf, everything derives).
2. materialize.ts detector + error + reorder, with its unit tests.
3. Fixture charters (story-gate-cast, chain-propose-decompose) — keeps the suite green
   the moment the guard lands.
4. decompose-epic.ts relabel arm.
5. bare-code-cast.test.ts.

Steps 2–3 land together (one commit) or the suite is transiently red; 1 can precede
independently; 4–5 close the AC.
