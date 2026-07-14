# Structure — T-028-01 split-audit-by-provenance

The blueprint: exact files, the shape of each change, and the order. Not code — the shape
of the code.

## Files touched

| File | Change | Why |
|------|--------|-----|
| `src/log/run-log.ts` | modify | add `intervenedAttested?` to `RunRecordInput` + `RunRecord`; set it in `buildRunRecord` and `reviveRecord` |
| `src/log/run-log.test.ts` | modify | unit-test marker→flag in `reviveRecord` (and round-trip via input) |
| `src/ledger/walk-away.ts` | modify | split `InterventionStat` into `attested`+`forward` sub-stats; render the split |
| `src/ledger/walk-away.test.ts` | modify | unit-test the partition on a mixed fixture |
| `src/cli.ts` | none | the audit arm already composes the three functions; the new sub-line rides through `formatWalkAwayFindings` |

No files created or deleted. `attest-intervention.ts` is unchanged (it already writes the
marker; we only newly *read* it).

## Layer 1 — `src/log/run-log.ts`

### `RunRecordInput` (~L121, beside `intervened`)
Add:
```
readonly intervenedAttested?: boolean;
```
JSDoc: the write-side provenance flag — `true` ⇒ this self-report came from a post-hoc
attestation, absent ⇒ forward/live. Mirrors `intervened`'s absence-is-meaningful contract.

### `RunRecord` (~L154, beside `intervened`)
Add the same `readonly intervenedAttested?: boolean;` with the "present only when true"
JSDoc.

### New normalizer (beside `normalizeIntervened`, ~L222)
```
function normalizeIntervenedAttested(v: boolean | undefined): boolean | undefined
```
Returns `true` only when `v === true`; anything else ⇒ `undefined` (omitted). It is a
one-way flag: only `true` is meaningful; `false`/absent both read as "not attested", so we
never write `false` (keeps records byte-identical to forward records).

### `buildRunRecord` (~L262–278)
- Compute `const intervenedAttested = normalizeIntervenedAttested(input.intervenedAttested);`
- Spread `...(intervenedAttested ? { intervenedAttested } : {})` beside the `intervened`
  spread.

### `reviveRecord` (~L366, the critical path)
Detect provenance from EITHER source on the parsed line:
```
const attestedByMarker =
  typeof r.intervenedAttestation === "object" && r.intervenedAttestation !== null;
const attestedByFlag = r.intervenedAttested === true;
const intervenedAttested = attestedByMarker || attestedByFlag ? true : undefined;
```
Spread `...(intervenedAttested ? { intervenedAttested } : {})` into the returned frozen
record beside the `intervened` spread. Truthy-object check (not just truthy) matches the
attestor's `{ by, at, basis }` shape and won't trip on a stray `intervenedAttestation:
false`/empty-string.

Public interface delta: one new optional field on two interfaces; one new private helper;
two spread additions. No signature changes, no breaking changes — purely additive.

## Layer 2 — `src/ledger/walk-away.ts`

### New sub-shape (beside `InterventionStat`, ~L66)
```
export interface InterventionSubStat {
  readonly reported: number;
  readonly intervened: number;
  readonly rate: number | null;
}
```

### `InterventionStat` (~L66–76)
Add two fields after `trend`:
```
readonly forward: InterventionSubStat;   // live self-reports (not attested) — the verdict cites this
readonly attested: InterventionSubStat;  // post-hoc back-fill, marked
```
Combined `reported`/`intervened`/`rate`/`trend` unchanged.

### `auditWalkAway` (~L164–173)
After building `reportedBits`, also partition the reported *records* (not just bits) by
provenance. Add a small pure helper:
```
function subStat(records: readonly RunRecord[]): InterventionSubStat
```
that computes reported/intervened/rate over a record list using the existing `rateOrNull`.
Then:
```
const reportedRecs = scope.filter((r) => r.intervened !== undefined);
const forward  = subStat(reportedRecs.filter((r) => r.intervenedAttested !== true));
const attested = subStat(reportedRecs.filter((r) => r.intervenedAttested === true));
```
Attach `forward`, `attested` to the returned `intervention` object. The combined block is
computed exactly as today from `reportedBits`.

### `formatWalkAwayFindings` (~L202–211)
Inside the `else` branch (when `iv.reported > 0`), after the combined walk-away line, push a
provenance sub-line built from `iv.forward` and `iv.attested`. Render each sub-stat's
walk-away as `1 − rate` via a small inline formatter that prints "none yet" when
`reported === 0`:
```
  └ forward (live): <walkAway%> (<reported−intervened>/<reported> untouched) · attested back-fill: <…>
```
Use the existing `pct` helper. No change to the `cost_has`/andon/outcome lines.

## Order of changes (each independently green)

1. **Layer 1 record + reviver** + its tests. `check:test` green: marker→flag proven.
   (This alone fixes the structural blindness.)
2. **Layer 2 stat split** + its tests. Combined unchanged; forward/attested partition
   proven on a mixed fixture.
3. **Layer 2 render** (same module) — sub-line in `formatWalkAwayFindings`; assert on the
   rendered string in the existing format test.
4. **Live proof:** `bun run src/cli.ts audit` over the real ledger → forward 2 (1
   intervention), attested 13/13, combined 14/15. `bun run check:typecheck` + `check:test`.

Steps 1–3 each compile and pass tests on their own; step 4 is verification, not new code
(cli.ts needs no edit — the new sub-line flows through the already-wired `formatWalkAway-
Findings`).

## Interfaces / boundaries preserved

- run-log keeps zero coupling to budget/executor; the new field is a plain boolean.
- walk-away stays pure, type-only + run-log helpers; nothing imports it back.
- "Absence is meaningful" and the spread-when-present idiom are reused verbatim — no new
  idiom introduced.
