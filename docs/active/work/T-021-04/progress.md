# T-021-04 — Progress

_What's done, what remains, deviations from the plan._

## Status: implementation complete, committed

| Plan step | State | Notes |
|---|---|---|
| 1 — policy core (classifier + scrubber + code table) | ✅ done | `JARGON_CLASSES`, `jargonTokens`, `scrubFace`, `CODE_PLAIN`, `translateCode`. |
| 2 — body extractors | ✅ done | `extractCharterCodes/FileCites/BamlInternals`, `rawAcceptanceCriteria`. |
| 3 — face/state helpers | ✅ done | `humanizeTitle`, `stateChip` (+ `stateKey`), `structuralBreakdown`. |
| 4 — Card types + `projectNode` + verdict seam | ✅ done | `projectNode`, `faceText`, `faceJargon`; result deep-frozen. |
| 5 — AC integration test | ✅ done | `describe("T-018-01 — the AC contract")`, three clauses. |
| 6 — green + commit | ✅ done | `bun run check` green (672 pass, 0 fail); committed as one unit. |

## What landed

- `src/present/translate.ts` (pure; type-only graph+spec imports).
- `src/present/translate.test.ts` (20 tests, 67 expect() calls, all pure).

## Verification

`bun run check` → baml:gen + `tsc --noEmit` + `bun test` all green: **672 pass / 0 fail** across
44 files (was 610 before this module; +20 new tests, no regressions). The AC contract block asserts
all three clauses: (1) face == §1c, (2) `faceJargon` empty + each denylist token absent from the
face, (3) the tokens reachable in `card.details`.

## Deviations from the plan

1. **`stateChip` gained phase-awareness (`stateKey`).** The plan's §1a chip mapped `status` →
   label. But the real `T-018-01` is `status: open, phase: done`, while §1c shows "✅ Done" — that
   is the *phase*. So `stateKey` collapses status **and** (for tickets) phase into one label key,
   so a done-phase ticket reads "Done". Still never emits `phase:done` raw. Faithful to §1c;
   in-spirit with §1a's "type/phase/status → one chip".
2. **`P5` added to the fixture body.** The AC names `P5` as a denylist representative, but the real
   ticket body uses `PE-1`/`R1`. The fixture body includes a `P5 consistency` mention so the test
   asserts the named representative directly (planned risk-watch item; the `charterCode` regex
   already covered `P\d+`).
3. **Typecheck nit** — `CODE_PLAIN["PE-1"]` indexes to `string | undefined`; the `translateCode`
   assertion uses `?? null` to satisfy `toBe(string | null)`. Cosmetic.

No scope deviations. `mixed`/`technical` vocabulary graduation remains deferred (design D-rejected
for v1) — carried to `review.md` as a known limitation, not a deviation.
