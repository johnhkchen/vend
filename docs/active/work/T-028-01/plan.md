# Plan — T-028-01 split-audit-by-provenance

Ordered, independently-verifiable steps. Each step compiles and keeps `check:test` green;
each is a clean atomic commit.

## Step 1 — Reader: surface provenance (`src/log/run-log.ts`)

**Do:**
- Add `readonly intervenedAttested?: boolean;` to `RunRecordInput` (beside `intervened`)
  and `RunRecord` (beside `intervened`), with absence-is-meaningful JSDoc.
- Add `normalizeIntervenedAttested(v)` → `true` only when `v === true`, else `undefined`.
- In `buildRunRecord`: compute + spread `...(intervenedAttested ? { intervenedAttested } : {})`.
- In `reviveRecord`: set the flag from a truthy-object `intervenedAttestation` marker OR an
  explicit `intervenedAttested === true`; spread when present.

**Test (`src/log/run-log.test.ts`):** new describe block "intervention provenance
(T-028-01)":
- back-fill line (hand-authored parsed object with `intervenedAttestation: { by, at, basis }`
  and `intervened: false`) → `reviveRecord` yields `intervenedAttested === true`.
- plain forward line (`intervened: true`, no marker) → `intervenedAttested` absent
  (`"intervenedAttested" in revived === false`).
- explicit `intervenedAttested: true` on the line → surfaced true (write-symmetry path).
- a record with no `intervened` at all → no `intervenedAttested` (and stays valid).
- round-trip: `buildRunRecord({ intervenedAttested: true })` → serialize → revive → true;
  and `intervenedAttested: false` input ⇒ field omitted (never written).

**Verify:** `bun test src/log/run-log.test.ts` green. `tsc --noEmit` clean.
**Commit:** `feat(run-log): surface intervenedAttested provenance flag on read (T-028-01)`

## Step 2 — Stat: split intervention by provenance (`src/ledger/walk-away.ts`)

**Do:**
- Add `InterventionSubStat { reported, intervened, rate }`.
- Add `forward` + `attested: InterventionSubStat` to `InterventionStat` (combined fields
  untouched).
- Add pure `subStat(records)` helper using `rateOrNull`.
- In `auditWalkAway`: partition `reportedRecs` on `r.intervenedAttested === true`; attach
  `forward`/`attested`.

**Test (`src/ledger/walk-away.test.ts`):** new describe "intervention provenance split
(T-028-01)" on a mixed fixture (3 attested all `intervened:false` + 2 forward, 1
`intervened:true`):
- `intervention.attested` = `{ reported:3, intervened:0, rate:0 }`.
- `intervention.forward` = `{ reported:2, intervened:1, rate:0.5 }`.
- combined unchanged: `reported:5, intervened:1, rate:1/5`.
- forward-only fixture ⇒ `attested.reported:0, attested.rate:null`.
- attested fixtures built via `rec({ intervened:false, intervenedAttested:true })`.

**Verify:** `bun test src/ledger/walk-away.test.ts` green.
**Commit:** `feat(walk-away): split intervention stat into forward + attested (T-028-01)`

## Step 3 — Render: show the split (`src/ledger/walk-away.ts`)

**Do:** in `formatWalkAwayFindings`, inside the `iv.reported > 0` branch, append a
provenance sub-line from `iv.forward`/`iv.attested`, walk-away = `1 − rate`, "none yet"
when a partition is empty. Reuse `pct`.

**Test:** extend the existing `formatWalkAwayFindings` describe — assert the rendered string
contains `forward (live):` and `attested back-fill:` with the expected counts on the mixed
fixture; assert the "none yet" path when forward is empty.

**Verify:** `bun test src/ledger/walk-away.test.ts` green.
**Commit:** `feat(walk-away): render forward vs attested split in audit fragment (T-028-01)`

## Step 4 — Live proof + full check

**Do (verification only, no new code):**
- `bun run src/cli.ts audit` over the real `.vend/runs.jsonl`. Expect the combined line
  (93%, 14/15) plus a sub-line: `forward (live): 50% (1/2 …) · attested back-fill: 100%
  (13/13)`.
- `bun run check:typecheck` and `bun run check:test` (or `bun run check`) fully green.
- Capture the audit output into `progress.md`.

**Commit:** none new (proof is captured in artifacts); if cli.ts needed no edit, Step 3's
commit already carries the behavior.

## Testing strategy summary

- **Unit (layer 1):** marker→flag in `reviveRecord` — the actual root-cause fix. Drives the
  reviver with hand-authored parsed objects (the marker is never emitted by
  `buildRunRecord`).
- **Unit (layer 2):** flag→partition in `auditWalkAway`, on a mixed fixture; combined-stat
  invariance asserted explicitly.
- **Unit (render):** the fragment string contains both provenance labels with right counts.
- **Live proof (free, no cast):** the real ledger reproduces the AC's exact numbers —
  end-to-end through loadRunLog → revive → audit → format.
- **Regression:** existing run-log + walk-away suites must stay green (additive change;
  combined stat unchanged), plus the whole `bun test` suite.

## Risks / watch-items

- The truthy-object check on `intervenedAttestation` must not be a bare truthy test (a
  stray non-object truthy could mis-flag) — assert object-and-non-null.
- `false` must never be written for `intervenedAttested` (would break byte-identity with
  forward records) — the one-way normalizer guarantees this; covered by a test.
- Render edge: when `iv.reported > 0` but one partition is empty, print "none yet", never a
  fabricated 0% — covered.
