# Design — T-080-01-01 marker tolerates untracked duration

## Decision summary

Keep the v1 marker closed while admitting exactly two shapes:

1. tracked duration: the existing five fields including a valid numeric `durationSecs`;
2. untracked duration: the same marker with the `durationSecs` property absent.

The classifier will distinguish missing input from malformed present input before numeric parsing.
The builder will omit an absent duration property, revival will accept only the four- or five-key
closed shapes, and serialization will preserve the selected shape. Settle will render the shared
project/ticket facts in both cases and add `in Ns` only when the numeric fact exists.

The existing fixture will become the canonical untracked-duration marker. Tests will also retain an
explicit tracked-duration marker, proving both v1 shapes round-trip. The durable seam contract will
be corrected to describe the optional measurement and both closed shapes.

## Design goals

- Preserve loop completion when Lisa did not track duration.
- Keep malformed present values refusable and visible to later trace work.
- Represent absence as absence, not a sentinel or invented number.
- Retain compatibility with existing five-field pending markers.
- Keep the marker schema closed against unknown keys.
- Keep validation and shape policy in the pure seam core.
- Keep filesystem behavior unchanged.
- Keep settle consumption behavior unchanged.
- Preserve tracked-duration terminal wording byte-for-byte.
- Make untracked terminal wording state only known facts.
- Prove both shapes at construction, external revival/parsing, serialization, effect, and rendering
  boundaries in proportion to the ticket contract.

## Option 1 — Use a numeric sentinel

Examples include `durationSecs: 0`, `durationSecs: -1`, or a maximum value.

### Advantages

- The existing five-field interface would not change.
- Existing rendering could continue interpolating a number.
- Exact-key validation would remain mechanically unchanged.

### Disadvantages

- Zero is already a valid, honest duration.
- Negative and unsafe values are deliberately rejected by the current contract.
- Every sentinel would conflate “not tracked” with a measured quantity.
- Rendering a sentinel as seconds would fabricate provenance.
- Teaching every consumer to reinterpret one number would weaken the type.
- It would violate the ticket's explicit requirement that duration be honestly absent.

### Decision

Rejected. A sentinel turns missing evidence into a false measurement.

## Option 2 — Add `durationTracked: boolean`

The marker could always carry `durationSecs` plus a new flag, or carry a flag and conditionally carry
the duration.

### Advantages

- Tracking state would be explicit.
- Consumers could branch on a required boolean.

### Disadvantages

- It adds a new field that Lisa does not emit.
- It creates more valid/invalid combinations, including contradictory flag/value pairs.
- It requires a schema-version decision beyond the ticket's two named marker shapes.
- It changes all persisted markers rather than relaxing one measurement.
- Honest property absence already carries the same information without duplication.

### Decision

Rejected. The flag adds state without adding truth.

## Option 3 — Store `durationSecs: null`

The marker interface could use `number | null` and always keep five keys.

### Advantages

- JSON preserves `null` explicitly.
- Exact five-key validation remains simple.
- Consumers must acknowledge a union.

### Disadvantages

- The acceptance language says duration is absent, not null.
- The ticket explicitly asks for both marker shapes, which implies structural optionality.
- Existing schema documentation defines the field as a quantity, not a nullable tagged value.
- `null` would be a new serialized value rather than omission of an unavailable measurement.

### Decision

Rejected. Nullable is viable in isolation but does not match the requested shape semantics.

## Option 4 — Make `durationSecs` an optional property

The marker input and marker interface use `readonly durationSecs?: number`.

### Advantages

- The JSON directly represents absence by omitting the property.
- Existing tracked markers remain byte-compatible.
- TypeScript requires consumers to handle `number | undefined` on access.
- The core can preserve the closed schema by explicitly allowing four or five keys only.
- No new marker field or invented fact is introduced.
- Serialization naturally omits the absent property when the builder constructs conditionally.

### Disadvantages

- Exact-key validation needs a deliberate optional-key rule.
- Builders must avoid materializing an own property with value `undefined`.
- Every marker consumer must compile against the wider type.
- Documentation describing exactly five fields becomes stale unless updated.

### Decision

Selected. It matches both the acceptance wording and JSON's native representation.

## Closed-schema policy

The schema remains closed; it is not weakened to “check known fields and ignore the rest.”

Define required keys as:

- `v`;
- `kind`;
- `project`;
- `ticketsDone`.

Define `durationSecs` as the sole optional key. Admission requires:

- exactly four keys and all required keys present; or
- exactly five keys, all required keys present, and `durationSecs` present;
- no key outside that five-key universe;
- a present duration must be a non-negative safe integer.

This means an external object with `durationSecs: undefined` is not a valid five-key marker. That is
not a JSON shape and should not become a third in-memory schema variant. A marker with an extra field
remains malformed in both duration modes.

## Builder policy

`buildLisaLoopSettledMarker` remains the strict construction boundary for Vend-authored marker
facts.

- Validate project and ticket count exactly as today.
- If `durationSecs` is absent/undefined, do not validate it as a quantity.
- If it is present as a value, require a non-negative safe integer.
- Build the four common fields first.
- Conditionally spread `durationSecs` only when it is not `undefined`.
- Freeze the final marker in either shape.

Conditional construction is important: returning `{ durationSecs: undefined }` would be observably
different under `Object.keys` even though `JSON.stringify` later omits it.

## Classifier policy

The classifier already receives `string | undefined`; it must branch before `parseEventQuantity`.

- `undefined` means Lisa did not provide the measurement and is admitted.
- Any present string still passes through the canonical decimal parser.
- Empty, partial, leading-zero, negative, fractional, non-decimal, and unsafe present strings remain
  refused with the existing duration reason.
- Project and ticket validation are unchanged and remain required.
- Non-complete events remain ignored before quantity validation.

No whitespace normalization is added. A present blank/space duration is garbage, not absence.

## Fixture policy

Update the existing canonical fixture to:

```json
{"v":1,"kind":"lisa-loop-settled","project":"vend","ticketsDone":2}
```

This exercises the new risk on every fixture read. Keep a tracked marker constant in tests and prove
it also revives, parses, serializes, and remains frozen. The fixture remains compact,
deterministically ordered, and newline-terminated.

An additional fixture file is unnecessary because the tracked form is already simple and widely
covered in producer/settle tests. The acceptance says fixture updated, singular, while requiring
both shapes to round-trip; one fixture plus one inline tracked case satisfies that boundary clearly.

## Recorder and hook policy

The recorder effect algorithm does not change. Once classification returns complete, its atomic
write path is agnostic to which valid marker shape was built.

Add effect coverage for an undefined duration and assert parsed bytes have no duration own
property. Update the real-hook integration fixture to omit `LISA_DURATION_SECS`, proving the actual
environment-unset path records, triggers settle once, renders honestly, and consumes the marker.

Do not modify `.lisa/hooks/on-notify`; the story explicitly excludes hook edits and the existing hook
already forwards absence.

## Settle-core policy

No production change is needed in `src/settle/settle-core.ts`. It imports and trusts the seam parser,
so widening the seam marker type and parser automatically carries the valid four-field marker into
`SettleVerdict.loop`.

Tests must change because the current “schema mismatch” fixture is exactly the newly valid
four-field form. Replace it with a truly malformed shape, such as an extra field or an invalid
present duration, and add an explicit untracked marker provenance case.

## Renderer policy

Build the loop line from two parts:

1. always-known prefix: `loop: <project> — <count> ticket(s) done`;
2. conditional tracked suffix: ` in <durationSecs>s`.

For an untracked marker, print only the prefix. Do not append `0s`, `?s`, `undefineds`, an inferred
wall clock, or a decorative “duration unknown” phrase. The short line is honest and keeps the
one-screen output focused on provenance that actually exists.

The check must use `durationSecs === undefined`, not truthiness, so a measured zero seconds keeps
rendering as `in 0s`.

## Documentation policy

Although the parent story enumerates runtime seam/settle files, the existing durable contract is a
direct schema authority and explicitly requires coordinated updates for field semantic changes.
Leaving it untouched would state that valid emitted bytes are malformed. Update only the relevant
sentences/table/fixture examples:

- Lisa supplies duration when tracked;
- the canonical fixture demonstrates untracked duration;
- v1 has four required fields and one optional field;
- missing duration is admitted, while malformed present quantities remain refused;
- settle conditionally prints duration.

No broader architecture or lifecycle rewrite is needed.

## Test strategy

### Seam core

- Fixture parses and reserializes byte-for-byte without duration.
- Tracked marker revives/parses/serializes byte-for-byte.
- Both returned marker shapes are frozen.
- Builder admits missing duration and measured zero.
- Builder still rejects invalid present numeric values.
- Closed schema refuses extra keys in both modes.
- Closed schema refuses invalid present duration.
- Classifier admits undefined duration.
- Classifier result has no own duration property.
- Classifier refuses present garbage with the existing reason.

### Seam effect and hook

- Recorder writes a valid untracked marker when duration is undefined.
- Existing tracked replacement behavior remains covered.
- Real complete hook path omits the duration environment key.
- Hook-driven settle output prints the loop line without `in Ns`.
- The marker is consumed and immediate repeat still says none pending.

### Settle

- Pure settle core accepts untracked marker bytes as typed loop provenance.
- Malformed-marker refusal uses an actually invalid shape.
- Renderer prints an exact untracked line.
- Renderer output contains no `undefineds`, `0s`, or synthetic `in` suffix for that marker.
- Existing tracked line remains unchanged.
- A zero measured duration remains eligible for the tracked suffix through the type branch.

## Commit strategy

Use two meaningful units, each full-gate green before commit:

1. Seam schema and contract unit: pure core, seam tests, fixture, settle-core compatibility tests,
   and durable contract documentation.
2. Settle surface unit: renderer plus settle/hook integration tests.

Each transaction uses `lisa commit-ticket --ticket-id T-080-01-01` with repeated exact `--include`
paths. Attempt-private phase artifacts are not passed to the commit command; Lisa publishes those
separately after lease verification.

## Risks and controls

- Risk: optional-field validation accidentally admits arbitrary partial objects.
  Control: exact required/allowed key sets and explicit extra-key tests.
- Risk: absent duration becomes an own `undefined` property.
  Control: conditional builder construction and own-property assertions.
- Risk: tracked zero is mistaken for absence.
  Control: equality-to-undefined branch and zero coverage.
- Risk: current malformed settle test becomes a false negative.
  Control: replace its bytes with an independently malformed shape.
- Risk: documentation contradicts runtime v1.
  Control: update the durable seam agreement in the schema commit.
- Risk: concurrent Lisa ticket changes enter a commit.
  Control: exact includes and before/after status inspection.
- Risk: later story tickets depend on a different marker convention.
  Control: establish the optional property in the exported canonical marker type and fixture now.
