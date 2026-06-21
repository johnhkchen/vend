# T-043-01 — Review: title-keyed idempotency for `proposeEpicEffect`

Handoff for a human reviewer. What changed, how it's covered, what to watch.

## Summary

`proposeEpicEffect` is now **idempotent on title**: before re-minting an epic id, it adopts an
existing same-title epic on the board (returns `ok: true` pointing at that card, minting nothing).
This closes the E-039 double-mint (E-041 childless orphan + E-042, same title `vend-doctor-preflight`)
without touching the id-REUSE guard (`detectCollisions` / E-004) or the new-title mint path.

The change mirrors the E-004 shape: a **pure** oracle (`findExistingByTitle` in `id-guard.ts`,
beside `detectCollisions`) consulted by the **impure** effect, fed by a new **addon-free** titled
board read (`listEpicIdTitlesIn` in `project-context.ts`).

## Files changed (3 src, 3 test; 0 deleted)

| File | Change |
|---|---|
| `src/play/id-guard.ts` | **+`findExistingByTitle`** (exported, pure/total) + private `normalizeTitle`; header note. `detectCollisions` untouched. |
| `src/play/project-context.ts` | **+`EpicIdTitle`**, **+`listEpicIdTitlesIn`** (titled sibling of `listIdsIn`). `listIdsIn` untouched. |
| `src/play/propose-effect.ts` | Adopt-before-mint branch; import swap (`listIdsIn`→`listEpicIdTitlesIn`, +`findExistingByTitle`); header IDEMPOTENCY paragraph. Mint path unchanged for a new title. |
| `src/play/id-guard.test.ts` | +7 cases for `findExistingByTitle`. |
| `src/play/project-context.test.ts` | +4 temp-dir cases for `listEpicIdTitlesIn`. |
| `src/play/propose-effect.test.ts` | +3 AC#3 end-to-end idempotency cases. |

## How it works

1. The effect reads the board once: `listEpicIdTitlesIn(dir)` → `{id (basename), title}[]`.
2. `findExistingByTitle(card.title, liveEpics)` — first epic whose normalized (`trim().toLowerCase()`)
   title equals the card's, else `null`.
3. **Hit** → return `{ ok: true, detail: "idempotent — '<title>' already minted as <id>", artifacts:
   [<path>], produced: <path> }`, minting nothing. The chain decomposes the existing epic.
4. **Miss** → `live = liveEpics.map(e => e.id)` (byte-identical to the old `listIdsIn` set) feeds
   `nextEpicId` / `detectCollisions` / `renderCard` / write — **unchanged**.

## Test coverage

- **`findExistingByTitle` (pure, no addon):** exact match incl. the E-041/E-042 fixture; no-match →
  `null`; case + whitespace normalization; blank target → `null`; empty board → `null`; first-match
  determinism; frozen-input purity. Every branch.
- **`listEpicIdTitlesIn` (impure, temp-dir, no addon):** `{id,title}` pairs + non-md exclusion;
  no-`title:` line → `""`; missing dir → `[]`; empty dir → `[]`.
- **AC#3 proof (impure, temp-dir, no live model):** same card twice → one `E-*.md`, second adopts
  (`produced` equal, `detail` contains `idempotent`/`E-001`); two distinct titles → two epics
  (back-compat); adopt on a populated board → mints nothing.
- **Regression:** the 6 pre-existing `propose-effect.test.ts` cases (mint / round-trip / disjoint /
  clear→classify) still pass — the new-title path is provably unchanged.
- **Gate:** `bun run check` (baml:gen + `tsc --noEmit` + full suite) → **1085 pass, 0 fail** (+14).

## AC verification

- ✅ Pure, total `findExistingByTitle` in `id-guard.ts`, no fs, beside `detectCollisions`.
- ✅ Effect adopts an existing same-title epic before minting (`ok`, `produced` = its path,
  "idempotent — already minted as E-0XX"); new-title path mints `nextEpicId` unchanged.
- ✅ Deterministic no-model proof: twice → one mint; two distinct titles → two; mapped to the E-041
  incident in the test comment.
- ✅ `detectCollisions` / E-004 + the decompose-side guard unchanged; adopt-vs-refuse recorded
  (`design.md` D1, `progress.md`).
- ✅ `bun run check` green.

## Open concerns / limitations (for the reviewer)

1. **Honest boundary — the EFFECT is idempotent, the chain retry is not.** This fix stops a retry
   from minting a *second* card; it does not change *why* the chain re-ran (the cast/chain retry
   after a write-but-no-log timeout). That root cause is a separate, lower-priority observation —
   worth a follow-up ticket if retries recur.
2. **Adopting an already-decomposed epic (the E-042 case).** A retry that adopts an epic which was
   already decomposed will re-run decompose against it. The decompose-side `IdCollisionError` /
   E-004 guard catches any story/ticket id-reuse and raises its own andon, so no silent double-mint
   downstream — but the reviewer should know the adopt path can re-enter decompose. By design (the
   ticket's honest boundary); not papered over.
3. **Single-token title match (`\S+`).** `listEpicIdTitlesIn` captures the title as one token, which
   is correct for every board card and all `renderCard` output (titles are kebab slugs). A
   hand-authored card with a quoted/multi-word `title:` would have only its first token compared —
   worst case a *miss* (mint a new id), i.e. today's behavior, never a wrong adopt. Acceptable; flagged
   so a future multi-word-title change knows to revisit both `renderCard` and this regex together.
4. **First-match on duplicate titles.** If two same-title epics already coexist (only possible from a
   pre-existing double-mint like E-041/E-042 before this fix shipped), adoption picks the first in
   `readdir` order. Deterministic and still mints nothing; cleaning up a pre-existing duplicate pair
   is a manual board op, out of scope here.

## Risk assessment

Low. The new-title mint path is byte-identical (same id set into `nextEpicId`); all additions are new
exports + new tests; the adopt branch is a guarded early return on a pure predicate. No production
caller signature changed. `listIdsIn`, `detectCollisions`, `nextEpicId`, `renderCard`, and the
decompose guard are all untouched.
