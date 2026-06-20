# Research — T-028-01 split-audit-by-provenance

Descriptive map of the code the ticket touches. No solutions here — only what exists,
where, and how it connects.

## The question this ticket exists to answer

`vend audit` reports one walk-away rate over the `intervened` bit. But that bit reaches
the ledger by two different roads, and the audit cannot tell them apart:

- **Forward (live):** the real instrument. `vend work --intervened/--no-intervened`
  stamps the bit at run time (T-026-02). This is the measurement E-014's verdict is
  supposed to cite.
- **Attested back-fill:** a human, after the fact, attests that a named past run was (or
  wasn't) intervened in. Written by `attest-intervention.ts`, which adds **two** fields:
  `intervened` and `intervenedAttestation` ({ by, at, basis }).

E-026 merged 13 attested + 2 forward into one pool and reported "15 forward, 93%,
forward-confirmed". That over-claim is the harm; the marker that would have prevented it
exists in the raw JSONL but is invisible to the audit.

## Layer 1 — `src/log/run-log.ts` (the reader)

The module is the "countable run log": one JSONL line per run, append-only. It has a
strict purity split (write face: `buildRunRecord`/`serializeRunRecord`; read face:
`reviveRecord`/`readRuns`; one impure verb each: `appendRunLog`/`loadRunLog`).

Key shapes:
- `RunRecordInput` (L97–130) — what the runner hands in. Carries optional `intervened?`
  (L121), `turnsUsed?`, `envelope?`, `project?`.
- `RunRecord` (L133–161) — the normalized, **frozen** record. Same optional fields.
- `reviveRecord` (L326–390) — structurally revives one parsed line into a `RunRecord`,
  or `null`. TOTAL (never throws). This is the **critical path**: it decides which fields
  survive a read.

The "absence is meaningful" idiom is everywhere: optional fields are spread in *only when
present* (`...(intervened !== undefined ? { intervened } : {})`, L385) so a record without
the field is byte-for-byte identical to a pre-feature record.

**The bug, confirmed:** `reviveRecord` reads `intervened` (L366) but **never reads
`intervenedAttestation`**. The raw line carries the marker; the revived `RunRecord` drops
it. So every consumer downstream of `reviveRecord`/`readRuns` is structurally blind to
provenance. A live runtime test (prior session) confirmed: a revived back-fill record has
no `intervenedAttestation` key.

Normalization helpers form a consistent pattern: `normalizeIntervened` (L222),
`normalizeTurnsUsed` (L230) — "a real value is taken verbatim; anything else ⇒ undefined
⇒ field omitted". A new provenance flag will mirror these.

## Layer 2 — `src/ledger/walk-away.ts` (the pure stat)

`auditWalkAway` (L131–176) reads a record slice and returns a `WalkAwayReport` with four
blocks: andon rate, outcome mix, cost-vs-envelope, and **intervention**.

`InterventionStat` (L66–76): `{ reported, intervened, rate, trend }`.
- `reported` = records carrying the bit (`r.intervened !== undefined`, L166).
- `intervened` = of those, how many were `true`.
- `rate` = intervened/reported, or null.
- `trend` = rate over earlier vs recent half.

The walk-away rate the renderer shows is `1 − rate`. Helpers `medianOrNull`, `rateOrNull`
(L110–121) are pure and reusable. Module is strictly pure, type-only imports plus run-log
record helpers — nothing imports it back (leaf consumer).

## Layer 3 — `src/cli.ts` + `formatWalkAwayFindings`

`vend audit` arm (cli.ts L682–698): lazy-imports `loadRunLog` + `auditWalkAway` +
`formatWalkAwayFindings`, runs the audit, prints the fragment, exits 0. Read-only, always
exits 0.

`formatWalkAwayFindings` (walk-away.ts L194–224) renders the E1 fragment. The walk-away
line (L202–211) currently shows the combined rate + trend only. `pct`/`ratio` helpers
(L179–186) render rates honestly (em-dash for null). This is where the split string is
added.

## The marker writer — `src/ledger/attest-intervention.ts`

CLI script (not a library). Rewrites named raw lines, adding `intervened` +
`intervenedAttestation: { by, at, basis }` (L78), preserving every other field
byte-for-byte (HONESTY INVARIANT 3 — no normalizer round-trip). Confirms the marker shape
the reader must detect: presence of a truthy `intervenedAttestation` ⇒ attested.

## Ground truth — the real ledger (`.vend/runs.jsonl`, 25 lines)

Verified with `jq`:
- 15 records carry `intervened`; 13 also carry `intervenedAttestation` (attested), 2 do
  not (forward).
- Attested: 13/13 `intervened=false` → all walk-away.
- Forward: 2 records, 1 `intervened=true`, 1 `false` → forward walk-away 1/2.
- Combined: 15 reported, 1 intervened → walk-away 14/15 ≈ 93%.

This is exactly the live-proof target in the AC (forward 2 / 1-intervention, attested
13/13, combined 14/15).

## Test landscape

- `src/log/run-log.test.ts` (515 lines) — fixture `baseInput(over)` builds via
  `buildRunRecord`; existing `intervention bit` block (L359+) round-trips true/false/absent/
  malformed through build→serialize→revive. The new attested tests slot beside it. Note:
  `reviveRecord` takes a parsed object, so attestation fixtures can be hand-authored
  objects (the marker is never produced by `buildRunRecord`).
- `src/ledger/walk-away.test.ts` (159 lines) — fixture `rec(over)`; intervention block at
  L89+. A mixed attested/forward fixture goes here. `rec()` builds via `buildRunRecord`,
  which won't emit `intervenedAttestation` — so attested fixtures need either the new
  input field or a hand-built record. (See Design.)

## Constraints / assumptions

- **No ledger rewrite** — existing records reclassify on read via their existing marker.
- **`intervened === false` stays the walk-away definition.** The split is *additive*.
- **Combined stat unchanged** (back-compat) — `reported`/`intervened`/`rate`/`trend` keep
  their current values and meaning.
- Purity discipline holds across all three layers; "absence is meaningful" idiom is the
  house style to mirror for the new flag.
- `check:*` = typecheck + bun test; both must stay green.
