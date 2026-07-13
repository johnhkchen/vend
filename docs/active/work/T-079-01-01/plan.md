# Plan — T-079-01-01

## Objective

Land a pure, fixture-proven settle verdict core that satisfies every T-079-01-01 acceptance clause and
establishes the all-done seam required by the settle and sweep dependents.

## Guardrails

- Work continuously through Implement and Review.
- Write RDSPI artifacts only in the private attempt directory.
- Do not edit ticket phase or status.
- Do not touch `src/cli.ts`; it belongs to the dependent ticket and has unrelated dirt.
- Use no filesystem, process, Git, clock, network, BAML, or executor dependency in the core.
- Use `phase === "done"` as the sole completion rule.
- Return malformed marker state as named refusal data.
- Use `lisa commit-ticket` only, with exact source includes.
- Preserve all unrelated worktree changes.
- Do not pass Review unless `bun run check` is green.

## Step 1 — create the settle directory and core skeleton

Create `src/settle/settle-core.ts` with:

- module comment explaining pure-core ownership;
- type-only imports for `WorkGraph` and `SweepVerdict`;
- marker path/version constants;
- exported marker, gate, review, epic-clearance, delta, exception, verdict, refusal, and input types;
- exported operation signatures.

Verification:

- imports are type-only;
- no effectful module appears;
- `tsc` can resolve the new file once functions are complete.

## Step 2 — implement marker parsing and serialization

Implement module-private record/string guards and one refusal constructor.

Implement `parseLastSettleMarker`:

1. treat `null` as valid first settle;
2. catch JSON syntax errors;
3. refuse null/array/non-object roots;
4. require exactly two schema keys;
5. require version 1;
6. require a nonblank string array;
7. require sorted unique ids;
8. return copied canonical marker data.

Implement `serializeLastSettleMarker`:

- validate with the shared marker validator;
- throw `TypeError` for invalid typed calls;
- emit canonical JSON plus newline.

Verification:

- malformed persisted bytes never escape an exception;
- refusal contains the stable code, marker path, reason, and removal/rerun action;
- round-trip bytes parse to the same marker.

## Step 3 — implement epic clearance derivation

Implement `deriveEpicClearance(graph)`:

- iterate every epic;
- flatten story tickets;
- determine cleared tickets from phase only;
- sort cleared ids;
- record counts and non-vacuous all-done flag;
- union current done ticket ids;
- collect sorted all-done epic ids;
- return fresh arrays.

Verification:

- status alone never counts;
- a phase-done ticket counts even if status differs;
- an empty epic is not all-done;
- all output ids are deterministic.

## Step 4 — implement input normalization

Add module-private copying/validation for gate, presweep, and review facts.

Gate rules:

- name/detail must be nonblank;
- failed gate requires nonblank next action;
- passing gate uses `null` action;
- copy every string/boolean into a fresh object.

Presweep rules:

- copy `ok`, done ids, and offenders;
- sort/dedupe ids and offenders for deterministic rendering;
- false with no offender is a `TypeError` wiring defect.

Review rules:

- every field must be nonblank;
- copy values;
- sort by ticket id, then name, then next action;
- do not mutate the caller array.

Verification:

- invalid programmer calls fail loudly;
- expected persisted marker failures remain returned data;
- normalized output is detached from input arrays.

## Step 5 — implement ordered exception derivation

Build exceptions from normalized facts in this order:

1. one gate exception when gate is false;
2. one presweep exception for each sorted offender;
3. one review exception for each sorted concern.

Use exact next-action wording:

- gate: caller-supplied action;
- presweep: `Commit or restore <path>, then rerun \`bun run check:presweep\`.`;
- review: caller-supplied action.

Verification:

- every exception action is nonblank;
- partial epics and empty delta create no exceptions;
- kind order never depends on input enumeration order.

## Step 6 — implement aggregate verdict computation

Implement `computeSettleVerdict(input)`:

- parse marker first and immediately return a refusal if invalid;
- normalize input facts;
- derive current clearance;
- compare current done ids to prior frontier;
- set `firstSettle` from marker absence;
- compute newly done ids;
- construct the versioned next marker from all current done ids;
- return copied current facts and ordered exceptions.

Verification:

- prior marker delta contains only newly done tickets;
- no marker contains all current done tickets;
- serializing `nextMarker` and recomputing yields empty delta;
- all-done ids match `deriveEpicClearance` exactly.

## Step 7 — create canonical fixture-board tests

Create `src/settle/settle-core.test.ts`.

Use `buildGraph` over plain raw-node fixture mappings. Construct:

- `E-100` with all of its tickets phase-done;
- `E-200` with one phase-done and one non-done ticket;
- `E-300` with no stories/tickets;
- a ticket whose status says done but phase does not;
- a ticket whose phase says done independent of status.

This fixture proves the computation operates on the loaded graph contract, not a settle-local board
facsimile.

## Step 8 — pin marker behavior

Add marker tests for:

- no marker -> valid first settle;
- canonical serializer/parser round trip;
- invalid JSON -> named refusal;
- wrong version -> named refusal;
- extra/missing keys -> named refusal;
- non-string/blank ids -> named refusal;
- duplicates -> named refusal;
- unsorted ids -> named refusal;
- unknown but canonical historical id -> valid.

Assert the refusal code, path, diagnostic reason, and exact action.

## Step 9 — pin clearance and delta behavior

Add exact-object tests for:

- per-epic cleared/total counts;
- sorted cleared ticket ids;
- the all-done id array;
- empty epic not all-done;
- phase authority over status;
- prior marker newly-done delta;
- first-settle full-board delta;
- immediate repeat empty delta.

Use exact arrays rather than set-equivalence so ordering is part of the contract.

## Step 10 — pin gate/presweep/review and exception behavior

Provide:

- a failed gate with an exact rerun action;
- a failed presweep whose offenders begin unsorted;
- review concerns supplied in reverse ticket order.

Assert:

- all three source fields are carried in normalized form;
- exception kinds are `gate`, then presweep entries, then review entries;
- each name/message identifies its source;
- each next action is exact and nonblank;
- caller arrays retain their original order.

Also test a fully green input yields an empty exception list.

## Step 11 — run focused tests and typecheck

Run:

```bash
bun test src/settle
bun run build
```

If either fails:

- repair only ticket-owned files;
- document any plan deviation in `progress.md` before changing the approach;
- rerun until green.

## Step 12 — inspect ticket-owned diff

Run:

```bash
git diff --check -- src/settle/settle-core.ts src/settle/settle-core.test.ts
git diff -- src/settle/settle-core.ts src/settle/settle-core.test.ts
git status --short
```

Confirm:

- only the two new settle paths are ticket-owned;
- no unintended generated file is included;
- unrelated dirty paths are unchanged;
- no ticket-owned file is staged.

## Step 13 — run the full repository gate

Run:

```bash
bun run check
```

Record:

- BAML generation result;
- typecheck result;
- total passing/failing test count;
- any ambient failure honestly.

Do not commit a red gate.

## Step 14 — write implementation progress

Create private `progress.md` containing:

- completed steps;
- exact focused/full commands and outcomes;
- source file inventory;
- any deviations and rationale;
- current commit status;
- remaining Review work.

## Step 15 — commit the meaningful source unit

Run exactly:

```bash
lisa commit-ticket \
  --path . \
  --ticket-id T-079-01-01 \
  --message "feat(settle): compute pure board verdict" \
  --include src/settle/settle-core.ts \
  --include src/settle/settle-core.test.ts
```

Do not use ordinary `git add` or `git commit`.

Afterward inspect:

- `git show --stat --oneline HEAD`;
- `git show --name-only --format= HEAD`;
- `git status --short`;
- exact ticket paths for cleanliness.

If Lisa's commit hook reruns checks, record that evidence too.

## Step 16 — final review

Read the committed diff and re-evaluate each acceptance clause:

- fixture board + prior marker delta;
- per-epic counts;
- all-done set;
- gate field;
- presweep field;
- review-concern field;
- ordered actionable exceptions;
- first-settle full-board behavior;
- malformed marker named refusal;
- focused `bun test src/settle` green;
- full `bun run check` green;
- exact source commit and clean ticket paths.

## Step 17 — write Review artifacts

Create private `review.md` with:

- disposition;
- summary and file list;
- public contract;
- acceptance matrix;
- focused/full test evidence;
- architecture and purity assessment;
- commit id and scope;
- honest boundary and downstream handoff;
- open concerns.

Create `review-disposition.json` exactly as:

```json
{"disposition":"pass","reason":null}
```

only if all gates and acceptance checks pass. Otherwise write a block result with a non-empty,
actionable reason.

## Completion condition

The ticket is ready for Lisa admission when:

- all six private RDSPI artifacts exist;
- the exact disposition JSON exists;
- source/tests are committed via Lisa;
- ticket-owned paths are clean;
- `bun test src/settle` is green;
- `bun run check` is green;
- no acceptance gap is hidden;
- no out-of-slice CLI/effect work has started.

Then remain on T-079-01-01 and stop. Lisa owns artifact publication, completion commit, ticket
transition, and seat release.
