# T-077-02-01 — Design

## Decision summary

Add a new addon-free pure module, `src/play/degrade-disposition.ts`, with two related decisions:

1. `classifyCharterCite` classifies one caller-located cite as `resolvable`, `degradable`, or
   `structural` using only a `CharterSnapshot` and plain cite metadata.
2. `materializationDisposition` folds cite classifications into `materialized`,
   `materialized-with-degrades`, or `structural-refusal`.

An unresolved, well-shaped cite is always degradable. It returns exactly one
`{code, location, action}` record. A malformed code or blank location is structural because the
caller has not supplied a valid editorial cite to transform. A resolvable cite returns its charter
title and never creates a degradation record.

## Option 1 — Put the classifier into `charter-snapshot.ts`

The snapshot module could grow action and materialization policy beside its parser.

Advantages:

- one import gives callers both snapshot construction and classification;
- the membership lookup is adjacent to snapshot creation;
- fewer files are added.

Rejected because:

- `charter-snapshot.ts` currently has a deliberately narrow parser/resolver responsibility;
- snapshot creation asks what a code meant, while disposition asks what a cut should do;
- action/location policy would make the zero-policy snapshot module know about consumers;
- later ledger code needs the disposition contract without needing snapshot construction;
- a separate module gives the story DAG one stable shared seam.

## Option 2 — Return only `DegradeDisposition | null`

The classifier could return `null` for a resolvable cite and a record for a miss.

Advantages:

- minimal implementation;
- later appliers could filter out nulls;
- the requested record shape is directly represented.

Rejected because:

- it cannot represent structural refusal as a distinct branch;
- it makes resolvable and invalid input easy to conflate;
- it does not satisfy the ticket's explicit three-way classification;
- it does not provide the named `materialized-with-degrades` versus structural-refusal taxonomy.

## Option 3 — Reuse `RunOutcome`

The module could return existing outcomes such as `success`, `bare-code`, or `gate-failed`.

Advantages:

- no second outcome vocabulary;
- direct compatibility with the current cast and ledger surfaces.

Rejected because:

- `RunOutcome` describes terminal execution, not cite-level judgment;
- a degraded materialization is still a successful run, so relabeling it would be false;
- `bare-code` is the whole-cut refusal the story is specifically retiring for editorial cites;
- importing the ledger into the pure play policy seam reverses the desired dependency;
- later structural failures already have several distinct run outcomes.

## Option 4 — Three-way cite union plus materialization fold

This is selected.

Advantages:

- every branch is explicit and exhaustively narrowable;
- callers can apply per-cite transformations using the single-cite result;
- the aggregate fold gives later shell/ledger code a named materialization taxonomy;
- structural refusal remains categorically different from a successful degraded clear;
- the module remains pure, local, total, and independent of BAML, fs, clock, and ledger code;
- both parallel applier tickets can share exactly the same record shape.

Cost:

- adds a second small classifier function;
- introduces a few literal-union types;
- caller locations remain strings because the complete field vocabulary belongs to later appliers.

The cost is warranted because the ticket exists specifically to settle shared vocabulary before the
parallel branches begin.

## Cite input

Use a plain object:

```ts
interface CharterCite {
  readonly code: string;
  readonly location: string;
  readonly action: "strip" | "annotate";
}
```

Rationale:

- `code` is the cited token to resolve.
- `location` is caller-owned provenance such as `T-077-02-02.purpose` or a rendered file/field.
- `action` names the transformation the caller will apply if the cite is unresolved.
- An object prevents positional argument swaps.
- Readonly fields match the tree's pure-core style.
- The action vocabulary is deliberately only the two actions named by the story.

Do not encode all possible locations as a union in this ticket. The two later appliers have not yet
settled their exact location strings, and the ledger must preserve those strings without importing
their field-specific types. The classifier validates only that location is nonblank.

## Code normalization and validity

Trim surrounding whitespace before lookup and recording. A valid cited charter code matches the
same shape accepted by `charter-snapshot.ts`: `[A-Z]{1,3}\d+`.

Consequences:

- `" N4 "` resolves/records canonically as `N4`.
- lowercase, blank, punctuation-only, or prose values are structural classifier inputs.
- the classifier does not independently parse charter prose.
- a valid code absent from the supplied snapshot is degradable, including against an empty
  snapshot.
- foreign but well-shaped prefix families are still valid cites; snapshot absence determines the
  degrade.

The malformed-code branch is not a new board gate. Production callers should invoke this classifier
only after identifying a citation token. It is the total function's defense against invalid direct
inputs and the explicit structural branch required by the contract.

## Single-cite result

Use a discriminated union keyed by `classification`:

```ts
type CharterCiteClassification =
  | { classification: "resolvable"; code: string; location: string; title: string }
  | { classification: "degradable"; disposition: DegradeDisposition }
  | { classification: "structural"; code: string; location: string; reason: StructuralReason };
```

Stable structural reasons are:

- `invalid-code`;
- `missing-location`.

Validate code before location, giving deterministic first-offense behavior. Preserve a trimmed
location in all branches. The action is intentionally absent from resolvable results because no
transformation occurs.

## Degradation record

The shared record is exactly:

```ts
interface DegradeDisposition {
  readonly code: string;
  readonly location: string;
  readonly action: "strip" | "annotate";
}
```

No reason field is added. Snapshot absence is the common meaning of every record in this story,
while `action` states the observable disposition. Adding a free-form reason would duplicate policy
and complicate the atomic ledger normalization later.

## Materialization taxonomy

Fold a readonly list of single-cite classifications with first structural finding winning:

- no structural and no degradations → `{status: "materialized", degrades: []}`;
- no structural and at least one degradation →
  `{status: "materialized-with-degrades", degrades: [...]}`;
- any structural classification → `{status: "structural-refusal", finding: ...}`.

The fold does not deduplicate degradation records. Each caller-observed occurrence is provenance;
locations and ordering belong to the caller. It returns a fresh array and does not mutate input.

The structural branch carries the original structural classification rather than laundering it into
a string. It carries no successful degradation array because nothing was materialized.

## Boundary with later tickets

This ticket will not:

- change rendering or remove `BareCodeError`;
- change `stripNonGoalAdvances`;
- change `boundsGate`;
- add a field to `MaterializeResult` or `EffectResult`;
- edit `RunRecord` or cast summaries;
- change `RunOutcome`;
- decide the eventual annotation text;
- weaken graph, id, completeness, or Lisa-validation refusals.

Later appliers will choose their location strings and invoke the shared classifier. The ledger ticket
will consume `DegradeDisposition` records and can use `materializationDisposition` for presentation
without inventing another success/refusal distinction.

## Testing decision

Create `src/play/degrade-disposition.test.ts` with no filesystem or BAML imports.

Pin:

- known code → resolvable with exact title;
- unknown well-shaped code → degradable with exact strip record;
- unknown well-shaped code → degradable with exact annotate record;
- empty snapshot still degrades a valid code;
- whitespace normalization;
- invalid code → structural `invalid-code`;
- blank location → structural `missing-location`;
- invalid code wins over blank location;
- aggregate clean result → `materialized`;
- aggregate degraded result → `materialized-with-degrades`, ordered records;
- aggregate structural result → `structural-refusal` even if degradations precede it;
- frozen inputs and snapshot remain unchanged.

## Verification

- Run the focused new unit test.
- Run `bun run build` or the full typecheck through the repository gate.
- Run `bun run check` before committing.
- Inspect `git diff --check`.
- Commit only the new source and test with exact `lisa commit-ticket --include` paths.
