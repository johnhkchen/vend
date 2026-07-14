# Design — T-077-04-03

## Decision to make

The ticket must expose locally persisted decompose recovery state through `vend doctor` while
preserving the existing separation between cast preflight, board hygiene, draft persistence, and
CLI rendering. The design needs exact, actionable wording and deterministic behavior without
turning doctor into a repair engine.

## Required observable contract

Given a readable persisted draft for epic `E-077`, the normal build-workspace doctor path emits a
failed `Check` with:

```text
name: resumable-decompose: E-077
hint: resume with `vend run decompose-epic E-077 --resume`
```

The renderer then prints the check, includes the literal command, and returns exit code 1. The
wording may include surrounding prose, but the entire runnable command must be present verbatim.

## Option 1 — add the condition to `probeDoctor`

Extend `DoctorProbeDeps`, load the draft store inside `probeDoctor`, and append the recovery check
to its dependency results.

Advantages:

- One top-level probe call returns every doctor condition.
- No CLI composition change beyond the probe's own implementation.
- Existing doctor-probe tests already cover broad dependency composition.

Rejected because:

- `probeDoctor` is also used by cast preflight.
- A red resumable-state diagnostic could block the very cast used to resume or repair it.
- Draft state is project board/recovery state, not a runtime dependency.
- The ticket explicitly requires wiring alongside `probeBoardHygiene`, not inside `probeDoctor`.
- It would broaden a stable module and violate the story's doctor-only boundary.

## Option 2 — fold recovery into board hygiene

Teach `probeBoardHygiene` to load both the work graph and draft store, replacing an orphan warning
with a resumable warning when the epic has a draft.

Advantages:

- Could avoid showing both an orphan check and a recovery check for the same epic.
- Semantically relates the half-minted board to the available recovery state.
- One board probe could present a combined diagnosis.

Rejected because:

- The ticket names a separate `probeResumableDecompose` API.
- Board hygiene's source of truth is the work graph and orphan detector.
- Recovery state exists independently of whether the current board still appears orphaned.
- Coupling graph and draft reads complicates testing and failure reporting.
- It would modify the direct precedent rather than mirror it.
- The story explicitly says the probe is wired alongside board hygiene.

## Option 3 — separate resumable-decompose probe

Create `src/doctor/resumable-decompose-probe.ts` with a pure record-to-check mapper and a thin,
injectable loader shell. Compose its returned checks as a third sibling in the normal doctor CLI.

Advantages:

- Matches the ticket wording exactly.
- Keeps cast preflight unchanged.
- Keeps board hygiene's graph-only responsibility intact.
- Reuses the public draft store rather than duplicating JSONL parsing.
- Unit tests can inject plain draft facts without filesystem IO.
- CLI can run all three independent reads concurrently.
- Future draft lifecycle changes remain behind the store's public loader contract.

Chosen. This is the smallest design aligned with the story and existing source boundaries.

## Module boundary

The new module owns only:

- stable check-name constants;
- stable resume-hint construction;
- pure conversion from readable draft records to `Check[]`;
- an injectable asynchronous call to `loadDecomposeDrafts`;
- conversion of loader rejection to a red diagnostic check.

It does not own:

- JSONL parsing or filesystem path policy;
- active/settled draft lifecycle;
- graph orphan detection;
- doctor report formatting or exit codes;
- CLI argument parsing;
- resume execution;
- draft repair or deletion.

## Public API

Proposed exports:

```ts
export const RESUMABLE_DECOMPOSE_CHECK = "resumable-decompose";
export const RESUMABLE_DECOMPOSE_OK = "resumable-decompose: no drafts";

export interface ResumableDecomposeProbeDeps {
  readonly loadDrafts: () => Promise<ReadDecomposeDraftsResult>;
}

export function resumableDecomposeChecks(
  records: readonly DecomposeDraftRecord[],
): Check[];

export async function probeResumableDecompose(
  deps?: Partial<ResumableDecomposeProbeDeps>,
): Promise<Check[]>;
```

The types come from the existing store and doctor core. The default dependency is
`loadDecomposeDrafts()`, which reads `.vend/decompose-drafts.jsonl` beneath the process cwd.

## Check shape

For each unique epic with an active/readable draft:

```ts
failed(
  `${RESUMABLE_DECOMPOSE_CHECK}: ${epic}`,
  `resume with \`vend run decompose-epic ${epic} --resume\``,
)
```

Reasons for this wording:

- The check name exactly satisfies the acceptance criterion.
- The hint starts with an action verb.
- Backticks make the command visually identifiable in terminal output.
- The literal command remains contiguous and copyable.
- It claims only resume availability, not automatic repair or guaranteed success.

## Green state

A readable store with no resumable drafts returns:

```ts
passed("resumable-decompose: no drafts")
```

This mirrors board hygiene's stable green `Check` rather than returning an empty array. A concrete
green result makes the world fact visible and keeps doctor check counts stable across fresh
projects. “No drafts” is deliberately narrower than “clean” because lifecycle meaning belongs to
the store, and the probe should not over-claim.

## Multiple records and deduplication

The persisted store is append ordered and can contain repeated checkpoints for one epic. Doctor
reports recovery choices, not historical attempts, so duplicate epic warnings would be noise.

The mapper will walk records from newest to oldest and keep the first occurrence of each epic.
It will then restore those selected records to their forward append order before mapping checks.
This gives:

- one actionable check per epic;
- the latest checkpoint as the representative fact;
- stable ordering based on store evidence rather than locale sorting;
- no timestamp comparison or new precedence rule.

If T-077-04-02 changes the public loader to return only active records, this deduplication remains
safe and idempotent. If it introduces an explicit active selector, the probe will consume that
public selector rather than reimplement settlement semantics.

## Malformed rows

`readDecomposeDrafts` already skips malformed and unsupported rows. The probe receives only valid
records plus a skipped count. This ticket will not create a second red condition for `skipped > 0`:

- tolerant recovery is the store's established contract;
- a valid later/earlier draft must remain usable;
- corruption diagnostics were not accepted in this ticket;
- inventing them would add wording and policy outside the story.

If all rows are skipped, the valid-record view is empty and the probe returns the no-drafts green
check. A true read rejection is handled separately.

## Loader failure

Like board hygiene, the probe never rejects an expected diagnostic read failure. It returns:

```ts
failed(
  "resumable-decompose: drafts readable",
  `repair the decompose draft store: ${message}`,
)
```

This names the failing boundary and keeps the doctor output stack-free. The error-to-message helper
is total over `unknown`, following the board-hygiene implementation.

## CLI integration

In the non-kitchen doctor branch:

1. lazily import `probeDoctor`;
2. lazily import `probeBoardHygiene`;
3. lazily import `probeResumableDecompose`;
4. invoke all three in one `Promise.all`;
5. concatenate dependency, board, then resumable checks;
6. render and exit through the unchanged doctor core.

This ordering keeps established checks stable and appends the new condition. The reads are
independent, so concurrency is safe. Kitchen workspaces remain unchanged because the story targets
the canonical build board and `.vend/` decompose state.

## Core test design

Create `src/doctor/resumable-decompose-probe.test.ts`.

Use plain record fixtures built through the public strict store builder so tests remain aligned
with schema validation. Cover:

1. one persisted draft returns exact red name and literal command;
2. rendered result exits with `EXIT_FAILED` and contains both;
3. an empty readable store returns the stable green check and `EXIT_OK`;
4. repeated records for one epic produce one check using latest order;
5. multiple epics produce deterministic unique checks;
6. a loader rejection becomes a red drafts-readable check rather than a rejected promise.

The unit suite injects the loader; no filesystem is required for the core behavior.

## Smoke test design

Extend `src/doctor/doctor-cli.smoke.test.ts` because it already owns real doctor dispatch proof.

Changes:

- allow `runDoctor` to accept an optional cwd;
- create a temporary root with `mkdtemp`;
- append a schema-valid draft at `<root>/.vend/decompose-drafts.jsonl`;
- spawn the real CLI with cwd set to that root;
- assert exit code 1;
- assert stdout contains `✗ resumable-decompose: E-077`;
- assert stdout contains `vend run decompose-epic E-077 --resume`;
- assert stdout/stderr contain no stack frames;
- remove the fixture in `finally`.

The fixture does not need authored board files because `loadWorkGraph` treats missing directories
as empty and board hygiene emits a green no-orphan check. Host dependency failures may coexist;
the target assertions remain deterministic.

## Rejected scope

- Do not suppress or rewrite the board-hygiene orphan check.
- Do not alter `probeDoctor` or cast preflight.
- Do not implement `--resume` parsing or execution.
- Do not clear or rewrite persisted drafts.
- Do not report parsed plan or gate details in doctor output.
- Do not add JSON output, flags, or prompts to doctor.
- Do not change kitchen doctor behavior.
- Do not change report rendering or exit-code rules.

## Design decision

Land a separate, total, injectable resumable-decompose doctor probe. Map the latest readable draft
per epic to an exact red check carrying the full resume command, keep empty state explicitly green,
and compose it beside board hygiene only in the normal `vend doctor` CLI path. Verify both the
pure check contract and the real cwd-sensitive CLI wiring.
