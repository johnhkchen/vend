# Plan — T-079-02-01

## Goal

Land a pure, deterministic sweep computation that converts a current graph plus matching presweep
verdict into one exact epic flip set, while returning named refusals for unsafe or empty outcomes.

The completed unit must satisfy the ticket fixture acceptance and establish an effect-ready contract
for T-079-02-02 without implementing any effects.

## Step 1 — create the sweep core contract

Create `src/sweep/sweep-core.ts`.

Add the three required imports:

- runtime `SWEEP_PREFIXES` and type `SweepVerdict`;
- type-only `WorkGraph`;
- runtime `deriveEpicClearance`.

Resolve and guard the board prefix from `SWEEP_PREFIXES`, then export the epic-card prefix.

Define the public plain-data interfaces:

- `EpicFrontmatterFlip`;
- `SweepFlipSet`;
- `PresweepOffendersRefusal`;
- `StalePresweepRefusal`;
- `NoEpicsReadyRefusal`;
- `SweepRefusal`;
- `SweepResult`;
- `ComputeSweepInput`.

Verification after this skeleton: `bun run build` should typecheck or identify only not-yet-written
implementation references within the new file.

## Step 2 — implement canonical helpers

Add `sortedUnique(values)` that returns a new sorted deduplicated array.

Add `sameStrings(left, right)` for canonical array equality.

Add `epicPath(epicId)` with a canonical `E-<digits>` validation guard and a result beneath
`SWEEP_EPIC_PREFIX`.

Add `provenanceMessage(flips)` with deterministic subject/body formatting.

Keep all helpers filesystem-free. None accepts an optional root or absolute path.

Verification: run `bun run build` to pin strict readonly and discriminated-union types.

## Step 3 — implement presweep gating

At the start of `computeSweep`, canonicalize `doneIds` and `offenders` into fresh arrays.

Validate the verdict invariant:

- `ok: true` requires zero offenders;
- `ok: false` requires one or more offenders.

Throw `TypeError` for inconsistent typed calls. This is a wiring defect, not an operational andon.

For a valid failed verdict, return `presweep-offenders` with:

- sorted/deduplicated offender paths;
- a nonblank reason;
- an exact recovery action naming the offenders and `vend sweep`.

Do not call eligibility mapping or assemble flip/path/message values on this branch.

## Step 4 — bind presweep to the graph snapshot

Call `deriveEpicClearance(input.graph)` once after presweep passes.

Compare its sorted `doneTicketIds` with canonical presweep `doneIds`.

On mismatch return `stale-presweep`, including separate copied expected/observed arrays and an exact
instruction to rerun presweep and sweep.

This prevents a successful flip from combining cleanliness evidence and board completion from
different snapshots.

## Step 5 — assemble eligible flips

Construct a map from `graph.epics` to current status by epic ID.

Filter shared clearance records to `allDone === true` and current status other than `done`.

For each candidate, produce a new `EpicFrontmatterFlip`:

- exact ID and path;
- `field: "status"`;
- current `from` status;
- `to: "done"`;
- copied sorted cleared ticket IDs.

Sort flips by epic ID. Derive pathspec only by mapping `flip.path`, preserving exact equality and
order.

When no candidates remain, return `no-epics-ready` rather than a successful empty plan.

For candidates, return `kind: "flip-set"` with flips, pathspec, and rendered message.

## Step 6 — build the canonical fixture test

Create `src/sweep/sweep-core.test.ts`.

Use `buildGraph` with:

- `E-100`, status open, two phase-done tickets;
- `E-200`, status active/open, one phase-done and one review ticket;
- one story for each epic;
- ticket statuses that do not accidentally substitute for phase authority where useful.

Create a green presweep with exactly the three phase-done fixture ticket IDs.

Assert the entire success result exactly:

```ts
{
  kind: "flip-set",
  flips: [{
    epicId: "E-100",
    path: "docs/active/epic/E-100.md",
    field: "status",
    from: "open",
    to: "done",
    clearedTicketIds: ["T-100-01", "T-100-02"],
  }],
  pathspec: ["docs/active/epic/E-100.md"],
  message: "sweep: close E-100\n\nE-100 cleared by T-100-01, T-100-02",
}
```

This single assertion directly covers every ticket acceptance clause on the green path.

## Step 7 — add refusal and invariant tests

Add a failed presweep test with unsorted/duplicate offenders. Assert canonical offenders, named code,
actionable text, and absence of the flip property.

Add an only-partial graph test asserting `no-epics-ready`.

Add an already-done epic status test asserting it is not rewritten.

Add a stale presweep test asserting expected and observed ID arrays.

Add inconsistent verdict tests for:

- `ok: true` with offenders;
- `ok: false` without offenders.

Add an input non-mutation assertion for caller arrays.

Optionally add a multiple-all-done test if it materially clarifies deterministic ordering and
message composition without requiring a second fixture framework.

## Step 8 — focused verification and repair

Run:

```bash
bun test src/sweep
bun run build
```

Repair all failures within the two ticket-owned files. Do not modify upstream settle, presweep, or
graph APIs unless the implementation proves the researched contract impossible; such a deviation
must be documented before proceeding.

Inspect the source diff for:

- accidental effects;
- duplicate eligibility logic;
- broad pathspecs;
- mutable/shared arrays;
- missing ticket IDs in provenance;
- unrelated worktree paths.

## Step 9 — full repository gate

Run `bun run check` before committing, as required by AGENTS.md.

If the gate fails in an unrelated concurrent path, establish whether the failure is reproducible and
whether ticket-owned code contributed. Do not edit another ticket's files. Record any unresolved
external failure honestly in progress/review and block if the ticket cannot meet the gate.

## Step 10 — commit the source unit through Lisa

Commit exactly the two source paths with `lisa commit-ticket`:

```bash
lisa commit-ticket \
  --ticket-id T-079-02-01 \
  --message "feat(sweep): compute pure epic flips" \
  --include src/sweep/sweep-core.ts \
  --include src/sweep/sweep-core.test.ts
```

Do not use `git add` or ordinary `git commit`.

After the commit, verify:

- the commit file list contains only those two paths;
- both ticket-owned paths are clean;
- unrelated concurrent paths remain untouched.

## Step 11 — post-commit verification

Run at least the focused test post-commit. Run the full gate post-commit if the commit hook output did
not already provide trustworthy full-gate evidence or if the commit operation changed repository
state that could affect it.

Record exact commands, pass/fail counts, and commit hash in `progress.md`.

## Step 12 — Review artifacts

Create `review.md` with:

- disposition;
- summary and file inventory;
- public contract;
- acceptance mapping;
- focused/full test evidence;
- architecture and scope review;
- commit evidence;
- worktree ownership review;
- open concerns and downstream handoff.

Create `review-disposition.json` with exactly:

```json
{"disposition":"pass","reason":null}
```

only if acceptance is met, the gate is green, the source is committed, and ticket-owned paths are
clean. Otherwise write the exact block shape with a non-empty actionable reason.

After Review, remain on this ticket and stop. Lisa handles publication and completion.
