# Design — T-070-01-03: cast records and warns on seat default

## Decision summary

Treat `EffectResult.seatDefaulted` as the single authoritative disposition fact at the generic cast
boundary. Retain it after the effect call, emit one requested-versus-default stdout note when it is
present, and conditionally forward the same object to `appendRunLog`.

Prove the complete path in `src/engine/cast.test.ts` with two stub-executor casts over an addon-free,
decompose-shaped play that calls the real `decomposeEffect`: one default mint and one `agent: "kodex"`
mint. Compare the complete boards byte for byte, inspect the degraded record through the run-log read
boundary, and capture the degraded cast's stdout line.

## Design forces

The design must preserve these established properties:

- unknown seats degrade only after the production materializer checks `KNOWN_SEATS`;
- the full cleared board lands without an explicit ticket seat;
- the raw requested spelling survives unchanged;
- `claude` is recorded as the actual default;
- the cast does not reimplement seat membership or default policy;
- persistence uses the schema already landed by `T-070-01-01`;
- successful degradation stays a `success`, not an `unknown-seat` outcome;
- ordinary and known-seat casts retain their current record and stdout shape;
- the engine remains play-agnostic and imports no concrete `src/play` module;
- tests remain fixture-only, addon-free, and token-free;
- ticket frontmatter and out-of-slice surfaces remain untouched.

## Option A — retain and forward the effect report

Inside `castPlay`, add a local optional `seatDefaulted` variable beside `materialized`, `produced`,
and `outcome`. When an effect runs, assign `eff.seatDefaulted` to it. After the effect block, emit a
warning when the value is present. At the run-log append, conditionally spread the same object.

Advantages:

- uses the exact fact selected and reported by the materializer/effect;
- adds no new policy or seat dependency to the engine;
- matches existing `produced` and outcome forwarding;
- matches reduced-grounding and over-envelope conditional persistence;
- preserves the optional-field/byte-compatibility contract;
- handles future board-writing effects through the generic `EffectResult` seam;
- requires one focused production-file change.

Costs:

- the local value crosses from the effect block to later stdout/log code;
- stdout formatting remains in the impure shell, as other cosmetic cast lines do.

## Option B — derive fallback from cast inputs

Inspect `ctx.inputs` or `opts` for an `agent` property and compare it with a seat registry inside the
cast loop.

Rejected because:

- `castPlay` is generic over arbitrary input shapes;
- agent routing is not part of `CastOptions`;
- the engine would need a downward dependency on a concrete play policy;
- it could warn or record before knowing whether the effect actually defaulted;
- it would duplicate `KNOWN_SEATS` membership and Lisa default selection;
- it could drift from materializer behavior.

This contradicts the existing effect-report seam and the engine's play-agnostic boundary.

## Option C — infer from terminal outcome

Use `outcome === "unknown-seat"` to decide whether to warn or record.

Rejected because the story intentionally stops producing that outcome. The cast succeeds after a
safe default. Historical ledger tolerance for `unknown-seat` is a read-compatibility concern, not a
new-write signal. An outcome also cannot carry raw requested and applied values.

## Option D — have the effect print and write provenance itself

Let `decomposeEffect` emit stdout and append or patch the ledger.

Rejected because:

- effects do not own the cast's run identity, timestamps, usage, or single append;
- it would create multiple writers for one record;
- stdout policy would become play-specific despite the generic report contract;
- other effects could not reuse the cast handling consistently;
- it would break the current fixed orchestration spine.

## Option E — add a general event/report collection to `EffectResult`

Replace or supplement the marker with a generic list of warnings or provenance events, with the cast
serializing and rendering those dynamically.

Rejected for this ticket. It introduces a new protocol and schema abstraction when one named fact is
already present at both boundaries. No current second effect report demonstrates the need for a
generic event system. It would expand scope and weaken the named, typed contract.

## Option F — inject an output writer into `CastOptions`

Add a `write` or `stdout` test seam to cast options and route all existing output through it.

This would make stdout capture local and avoid process-global interception in the test. It is not
selected because it requires mechanically changing every cast output site and a public interface for
one acceptance assertion. The project currently treats direct `process.stdout.write` as part of the
impure shell. A carefully restored test spy is smaller and does not change production behavior.

## Option G — extract a pure warning formatter

Create a `seatDefaultWarning` helper in `cast-core.ts`, unit-test exact formatting there, and call it
from the shell.

Not selected. The line contains no branching judgment beyond marker presence, and `cast.ts` already
keeps `stopReason` and other cosmetic formatting private. The acceptance criterion requires observing
the warning through the full cast path, so a formatter unit test would not replace the integration
proof. A separate export would enlarge the pure API without meaningful reusable logic.

## Selected production flow

The normal cast path becomes:

```text
effect returns seatDefaulted
        │
        ├── cast retains exact object
        ├── stdout renders requested → applied default note
        └── appendRunLog receives exact object
                    │
                    └── run-log normalization/serialization/revival
```

There is no new classification branch. The run remains governed by the existing verdict and optional
effect outcome. `seatDefaulted` is provenance about how a successful board write was routed, not a
terminal state.

## Marker lifetime and conditions

Declare:

```ts
let seatDefaulted: EffectResult["seatDefaulted"];
```

or use the exported `SeatDefaulted` type in a type-only import. Assign it only in the existing effect
block:

```ts
seatDefaulted = eff.seatDefaulted;
```

The marker remains `undefined` when:

- no effect runs;
- an unrelated effect returns no marker;
- a known or omitted seat reaches the materializer;
- an early missing-capability refusal returns before dispensing.

The cast should not independently require `eff.ok` before retaining the marker. The marker states
that the write-side effect applied the default. In the production decompose effect, materialization
precedes Lisa validation; a later validation failure does not make the requested-versus-applied fact
false. The authoritative criterion is report presence.

## Warning line

Use one concise bullet near the existing effect and degradation output:

```text
· seat defaulted — requested 'kodex'; using 'claude' (unknown-seat; proceeding, recorded)
```

Properties:

- names the degradation, rather than calling it an andon;
- preserves and displays the raw request;
- explicitly names the selected default;
- includes the reason code for countable diagnostic parity;
- says the cast is proceeding and the fact is recorded;
- follows the reduced-grounding note's single-line bullet shape;
- avoids implying a terminal failure.

The warning is emitted after the effect line because only the effect can authoritatively report the
disposition. It precedes the run-log append, but “recorded” describes the path that immediately
follows. An append failure already propagates as a real failure, matching all other cast notes and
recording behavior.

## Persistence

Add one conditional spread to the existing normal append input:

```ts
...(seatDefaulted !== undefined ? { seatDefaulted } : {}),
```

Use the exact object, not reconstructed fields. `RunRecordInput` is structurally compatible with the
engine report. `buildRunRecord` remains the sole normalization boundary. Absent values omit the key,
preserving legacy bytes.

The early missing-capability append remains unchanged because no effect has run and no seat default
could have been applied. There is no second append and no ledger mutation.

## End-to-end test design

Add one acceptance-focused test to `src/engine/cast.test.ts`.

The fixture uses:

- a complete plain-object `WorkPlan` with one story and one ticket;
- type-only generated enum imports, keeping the test addon-free;
- a `Play<DecomposeInputs, WorkPlan>` whose parser is `JSON.parse`;
- a clear gate with a named fixture gate;
- the real `decomposeEffect` as the effect body;
- an injected Lisa validator that returns success without spawning Lisa;
- the existing stub executor, returning the serialized plan;
- two isolated temporary project roots and run-log paths.

The baseline cast uses `DecomposeInputs` with no `agent`. The degraded cast uses the same inputs plus
`agent: "kodex"`. Both use the same serialized plan and fixed stub result. The test reads the story
and ticket files from both roots and compares complete strings.

Assertions cover:

- both casts return `success` and `materialized: true`;
- both roots contain the expected full story/ticket board;
- degraded story bytes equal baseline story bytes;
- degraded ticket bytes equal baseline ticket bytes;
- the degraded ticket has no `agent:` key;
- exactly one degraded JSONL record exists;
- the record outcome remains `success`;
- `seatDefaulted` exactly contains requested, applied, and reason;
- `reviveRecord` preserves the marker;
- captured stdout contains the exact requested-versus-default warning line.

## Stdout capture discipline

Use Bun's spy facility on `process.stdout.write` or a local wrapper that delegates to the original
writer. The test needs accumulated text, not suppression. Restore it in `finally`, even when the cast
throws. Capture only the degraded cast so the baseline does not introduce a second warning candidate.

The exact test implementation must remain compatible with the overloaded Node write signature. Bun's
`spyOn(...).mockImplementation(...)` can collect `String(chunk)` and return `true`; restoration in a
`finally` block prevents leaked global state. If the repository's typecheck rejects that overload,
use a small typed cast local to the test rather than changing production APIs.

## Compatibility and non-effects

- No changes to `SeatDefaulted` types or run-log normalization.
- No changes to `KNOWN_SEATS` or the default value.
- No changes to materializer output.
- No changes to outcome vocabulary.
- No changes to `RunSummary`; the acceptance reads the durable record.
- No warning on absent reports.
- No live executor, BAML parser, or Lisa process in tests.
- No ticket phase/status edit.
- No changes to CLI parsing or source assembly.

## Verification

Run the focused cast test first, then the full repository gate. Inspect `git diff --check`, the scoped
diff, and repository status before committing. Commit only this ticket's production/test files and
work artifacts, leaving pre-existing Lisa board changes unstaged.
