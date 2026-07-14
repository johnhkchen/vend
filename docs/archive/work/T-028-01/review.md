# Review — T-028-01 split-audit-by-provenance

Handoff document. What changed, how it's covered, and what a reviewer should weigh.

## What this fixes

`vend audit` conflated two kinds of E1 evidence — **forward (live)** self-reports (the real
instrument) and **attested back-fill** (post-hoc human attestation). E-026's verdict counted
13 attested + 2 forward as "15 forward, 93%, forward-confirmed" — an over-claim. Root cause:
`reviveRecord` read the `intervened` bit but **dropped its provenance**, so every consumer
was structurally blind to which road the bit came from. This change makes provenance survive
the read and disaggregates the audit by it.

## Files changed

| File | Change |
|------|--------|
| `src/log/run-log.ts` | +`intervenedAttested?` on `RunRecordInput`/`RunRecord`; +`normalizeIntervenedAttested`; set in `buildRunRecord` and `reviveRecord` (the fix) |
| `src/log/run-log.test.ts` | +6 provenance tests (marker→flag, forward omitted, write-symmetry, non-object guard, no-bit record, build round-trip) |
| `src/ledger/walk-away.ts` | +`InterventionSubStat`; +`forward`/`attested` on `InterventionStat`; +`subStat`/`subWalk` helpers; partition in `auditWalkAway`; sub-line in `formatWalkAwayFindings` |
| `src/ledger/walk-away.test.ts` | +4 split tests (partition + combined-invariance, forward-only, render, "none yet") |

No files created or deleted. `cli.ts` and `attest-intervention.ts` unchanged — the marker
was already written; we only newly read it, and the new sub-line rides through the
already-wired `formatWalkAwayFindings`. Two commits (reader; stat+render).

## Acceptance criteria — all met

- ✅ **`reviveRecord` surfaces `intervenedAttested`** for marker-carrying records and explicit
  flags, omitted otherwise. No ledger rewrite; existing records reclassify on read.
  Unit-tested (back-fill line → attested; plain forward → not).
- ✅ **`auditWalkAway` returns `forward` + `attested` sub-stats**, combined unchanged.
  Unit-tested on a mixed fixture (3 attested walk-away + 2 forward 1-intervened → forward
  rate 0.5 distinct from combined 0.2).
- ✅ **`vend audit` renders the split** beside the combined rate.
- ✅ **Live proof:** real ledger → forward (live) 1/2 (2 reported, 1 intervention), attested
  back-fill 13/13, combined 14/15 (93%). `check:typecheck` clean; `bun test` 853 pass / 0 fail.

## Test coverage

- **Layer 1 (marker→flag):** drives `reviveRecord` with hand-authored parsed objects carrying
  the real `{ by, at, basis }` marker — the exact bug path. Covers truthy-object guard and the
  one-way `false`-never-written invariant.
- **Layer 2 (flag→partition):** mixed fixture asserts both sub-stats AND combined invariance —
  the back-compat guarantee is tested, not assumed.
- **Render:** asserts both provenance labels with exact counts, plus the empty-partition
  "none yet" honest-fallback path.
- **End-to-end:** the live audit exercises loadRunLog → revive → audit → format over real data.

No coverage gaps for the changed surface. `appendRunLog`/`loadRunLog` stay untested by design
(thin impure fs verbs; their logic is the tested pure core).

## Design notes for the reviewer

- **`intervenedAttested` is a one-way boolean, not the full marker.** The audit needs only the
  bit; by/at/basis stays in the raw JSONL for any future audit-trail consumer. If such a
  consumer appears, lifting the object onto the record is additive and non-breaking.
- **Truthy-OBJECT check** on `intervenedAttestation` (not bare truthy) — a stray
  `intervenedAttestation: "x"` won't mis-flag. Tested.
- **`false` is never written** for the flag — a forward record stays byte-identical to a
  pre-T-028-01 one, preserving the ledger's "absence is meaningful" invariant. Tested.
- **Sub-stats carry no trend** — trend is a single combined-series read; per-split halving
  would invite mis-citation. Deliberate (see design.md Decision 2).

## Open concerns / limitations

- **None blocking.** The change is additive and back-compatible.
- **Verdict follow-up (out of scope here):** this ticket exposes provenance; it does not
  rewrite E-026's verdict text. The corrected verdict already lives in `work/T-026-04/`
  (provisional, +2 forward). With the split now visible, a future read should cite **forward
  1/2** as the live evidence and **attested 13/13** as supporting back-fill — they are
  different kinds and should be reported as such. Flagging for whoever next touches the E-014
  verdict.
- **Forward sample is still thin (n=2).** That is a data-collection matter (more `vend work`
  runs), not a code matter — the instrument now reports it honestly instead of inflating it.
- The andon rate (40% vs 10%) shows ⚠ over in the live output — pre-existing, unrelated to
  this ticket (it reads, never red-flags; that's by design).

## Verification commands

```
bun run src/cli.ts audit          # live proof — forward 1/2, attested 13/13, combined 14/15
bun run check:typecheck           # clean
bun test                          # 853 pass / 0 fail
```
