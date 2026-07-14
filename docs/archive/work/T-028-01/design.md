# Design — T-028-01 split-audit-by-provenance

The ticket already prescribes the three-layer house split. Design's job is to settle the
real decision points within that frame, grounded in the Research map.

## Decision 1 — How does provenance survive the read?

**Chosen: a normalized boolean `intervenedAttested?` on `RunRecord`, set by `reviveRecord`
from the raw `intervenedAttestation` marker.**

`reviveRecord` sets `intervenedAttested: true` when the parsed line carries a **truthy
`intervenedAttestation`** OR an explicit `intervenedAttested === true`; otherwise the field
is omitted (absence = not-attested = forward/unknown). This mirrors the existing
`intervened`/`turnsUsed` "absence is meaningful, spread-when-present" idiom exactly.

Why a normalized boolean rather than carrying the whole `intervenedAttestation` object
through to `RunRecord`?
- The audit only needs the *bit* (attested vs not), not the audit-trail object. A boolean
  is the minimal shape that answers the partition question.
- Keeps `RunRecord` flat and the pure stat layer trivial (`r.intervenedAttested === true`).
- The full marker still lives in the raw JSONL for any future audit-trail need; we're not
  discarding it, just not lifting it into the typed record.

**Rejected — lift the full `intervenedAttestation` object onto `RunRecord`.** More surface
(by/at/basis typing, normalization, freezing) for data no consumer in scope reads. Violates
"the shape that answers the question, nothing more". Can be added later if a consumer needs
the trail; the boolean doesn't block it.

**Rejected — partition in the stat layer by re-reading the raw line.** The stat layer is
pure over `RunRecord`s and has no access to raw JSON. Pushing raw access down would break
the purity split. The reader is the right home for the marker→flag normalization.

Write symmetry: add `intervenedAttested?: boolean` to `RunRecordInput` and have
`buildRunRecord` spread it when `true` (mirroring `intervened`). This is for symmetry/future
forward-attestation, not used by the live proof — existing records are classified purely by
their *existing* `intervenedAttestation` marker, no rewrite.

## Decision 2 — Shape of the split in `InterventionStat`

**Chosen: add two sub-readings `attested` and `forward`, each `{ reported, intervened,
rate }`; keep the combined `reported`/`intervened`/`rate`/`trend` exactly as-is.**

A small reusable sub-shape `InterventionSubStat = { reported, intervened, rate }` (no
trend — trend is a combined-series concept the verdict reads once; sub-splits don't each
need their own halving, and adding it would invite mis-citation). Partition the reported
records on `r.intervenedAttested === true`:
- `attested` = reported records where the flag is true.
- `forward` = reported records where it is not (the live instrument).

`reported` on each = count in that partition; `intervened` = trues in it; `rate` =
intervened/reported or null.

Why keep combined untouched: back-compat (the ticket mandates it) and the combined number
is still a legitimate roll-up; we're *disaggregating beside it*, not replacing it. The
verdict learns to cite `forward`.

**Rejected — replace the combined rate with the forward rate.** Breaks back-compat and the
explicit ticket constraint; also throws away a real number. The fix is to *expose*
provenance, not to redefine the headline.

**Rejected — partition into N provenance buckets generically.** There are exactly two roads
(forward, attested). A generic map is speculative generality; two named fields read better
at the call site and in the rendered fragment.

## Decision 3 — Render

**Chosen: keep the existing combined walk-away line, append a provenance sub-line.**

Format (honest labels, IA-8 — mirror existing `pct`/em-dash style):
```
  walk-away rate: 93% (14/15 ran untouched) · trend …            ← unchanged
    └ forward (live): 50% (1/2 ran untouched) · attested back-fill: 100% (13/13)
```
The forward count is the one a verdict cites; labeling it "(live)" and naming "attested
back-fill" makes the provenance legible at a glance, which is the whole point — E-026's
over-claim came from the two being indistinguishable.

Edge cases the renderer must handle honestly:
- forward `reported === 0` ⇒ "forward (live): none yet" (don't fabricate a rate).
- attested `reported === 0` ⇒ omit / "attested back-fill: none".
- If `iv.reported === 0` overall, the existing "no self-reports yet" line stands and no
  sub-line is shown (nothing to split).

## Decision 4 — Test strategy for attested fixtures

`buildRunRecord` will not emit `intervenedAttestation` (that's the attestor's job), but it
*will* emit `intervenedAttested` via the new input field. Two fixture roads:
- **run-log tests:** drive `reviveRecord` with hand-authored parsed objects carrying a real
  `intervenedAttestation: { by, at, basis }` — proves the marker→flag path (the actual bug).
- **walk-away tests:** build records via the `rec()` fixture extended with
  `intervenedAttested: true` (through `RunRecordInput`) — a clean way to get attested
  records into the pure stat without hand-authoring the marker object. This tests the
  partition logic independent of the marker-detection logic.

Both paths are needed: layer 1 owns "marker ⇒ flag", layer 2 owns "flag ⇒ partition".

## Non-goals (explicit)

- No ledger rewrite / migration.
- No change to the walk-away definition (`intervened === false`).
- No trend on the sub-splits.
- No lifting of by/at/basis into the typed record.
