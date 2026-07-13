# Structure — T-080-02-01

## Change summary

The ticket extends the existing sweep plan with one explicit optional provenance path, wires its
dirty-state observation into preparation, preserves exact commit validation, and adds pure plus real
Git fixture proof.

All source changes stay inside `src/sweep/`, matching the story's disjoint file boundary.

## File inventory

| Path | Action | Responsibility |
|---|---|---|
| `src/sweep/sweep-core.ts` | modify | Canonical provenance path, input fact, optional plan cargo, authoritative pathspec assembly |
| `src/sweep/sweep-core.test.ts` | modify | Pure clean/dirty assembly and existing refusal/invariant coverage |
| `src/sweep/sweep.ts` | modify | Exact dirty observation and declared-plan pathspec validation |
| `src/sweep/sweep.test.ts` | modify | Rendering fixture updates plus real Git dirty/clean/mismatch acceptance |
| attempt-local artifacts | create | RDSPI evidence and final disposition |

No source file is created, deleted, or moved.

## `src/sweep/sweep-core.ts`

### Module comment

Update the description from a pathspec restricted solely to epic cards to a pathspec containing
exact epic cards plus the one optional provenance ledger.

The pure/effect boundary remains unchanged.

### Canonical constant

Add near `SWEEP_EPIC_PREFIX`:

```ts
export const SWEEP_PROVENANCE_PATH = ".lisa/provenance.jsonl" as const;
```

This is public because the shell and tests must use the same exact path.

### `SweepFlipSet`

Add:

```ts
readonly provenancePath: typeof SWEEP_PROVENANCE_PATH | null;
```

Update the pathspec documentation to state that it is the exact ordered commit pathspec: card paths
followed by optional provenance.

No generic ancillary-path type is introduced.

### `ComputeSweepInput`

Add required:

```ts
readonly provenanceDirty: boolean;
```

The graph and presweep fields remain unchanged.

### Successful assembly

After producing nonempty sorted flips, derive:

```ts
const provenancePath = input.provenanceDirty ? SWEEP_PROVENANCE_PATH : null;
```

Return:

- existing kind and flips;
- explicit `provenancePath`;
- pathspec of flip paths plus the non-null path;
- unchanged deterministic message.

Refusal structures remain byte-for-byte compatible and carry no optional cargo.

### Internal boundaries

Do not import Git/status parsing into the core.

Do not change clearance, epic ID validation, refusal ordering, or message helper behavior.

## `src/sweep/sweep-core.test.ts`

### Imports

Import `SWEEP_PROVENANCE_PATH` beside `computeSweep` for canonical expected values.

### Common inputs

Every `computeSweep` call adds an explicit `provenanceDirty` value. Existing tests use `false`
unless the test is specifically about carriage.

### Cards-only assertion

The existing successful expected object adds:

```ts
provenancePath: null
```

Its pathspec and message remain unchanged.

### Dirty assertion

Add a test using the same eligible graph and presweep verdict with `provenanceDirty: true`.

Expect:

```ts
provenancePath: SWEEP_PROVENANCE_PATH
pathspec: ["docs/active/epic/E-100.md", SWEEP_PROVENANCE_PATH]
```

Also assert message equality with the clean plan so carriage does not silently alter clearance
provenance wording.

### Existing contract tests

Preserve all named refusal shapes, inconsistent verdict throws, sorting, and caller-array
non-mutation assertions.

## `src/sweep/sweep.ts`

### Imports

Add `parsePorcelainLine` from `../ci/committed-core.ts`.

Add `SWEEP_PROVENANCE_PATH` from the sweep core import block.

No new fs or Git dependency is required.

### Exact status observation

Add a private pure helper:

```ts
function porcelainHasPath(porcelain: string, expectedPath: string): boolean
```

It splits status output by line, parses each line through the shared parser, and checks exact
equality.

The helper has no effects and no prefix behavior.

### `prepareSweep`

Keep one graph load and one `git status --porcelain` call.

Continue building `presweep` exactly as today.

Call `computeSweep` with:

- graph;
- presweep;
- `provenanceDirty` derived from the same status output and canonical path.

No provenance dirt is added to presweep offenders.

### `commitSweep`

Replace `flipPaths` equality with an expected plan path derivation:

```text
flip paths + declared non-null provenancePath
```

Require a nonempty flip list and exact `sameStrings(plan.pathspec, expectedPaths)`.

Keep validation before filesystem reads.

Update error detail to state that pathspec must exactly equal the nonempty ordered declared plan
paths.

All card preparation, writes, add, commit, SHA read, and rollback logic remains structurally
unchanged and consumes `plan.pathspec`.

## `src/sweep/sweep.test.ts`

### Imports

Extend Bun test imports if necessary for async rejection assertions.

Add filesystem imports for fixture directories/files and OS/path helpers:

- `mkdir`, `mkdtemp`, `readFile`, `rm`, `writeFile`;
- `tmpdir`;
- `join`.

Import:

- `SWEEP_PROVENANCE_PATH`;
- `commitSweep`;
- `prepareSweep`.

### Static plan fixture

Add `provenancePath: null` to the existing in-memory `SweepFlipSet` so its rendering remains the
cards-only baseline.

### Fixture shape

Define an internal `SweepCommitFixture` with:

- root;
- epic absolute path;
- provenance absolute path;
- a synchronous `git(...args)` helper returning trimmed stdout and asserting success.

### Fixture builder

Create a disposable directory and the required graph folders plus `.lisa/`.

Write:

- one open epic `E-100`;
- one story `S-100-01` listing `T-100-01`;
- one phase-done ticket;
- baseline provenance JSONL.

Initialize Git, configure fixture identity, add the fixture content, and commit a baseline.

Fixture `git add` / `git commit` commands are isolated test setup, not repository ticket commits.

### Dirty provenance acceptance

Append/replace provenance bytes after baseline.

Call `prepareSweep({ root })` and narrow to a flip-set.

Assert `renderSweepPlan` contains both exact paths.

Call `commitSweep(plan, { root })`.

Inspect returned SHA, `git show --stat --oneline`, `git diff-tree --name-only`, epic status, and clean
porcelain.

Remove fixture in `finally`.

### Clean provenance acceptance

Prepare without changing provenance.

Assert the complete pathspec equals only the epic path and `provenancePath` is null.

Remove fixture in `finally`.

### Mismatched plan invariant

Prepare a clean plan, clone it with a pathspec that appends the canonical provenance path while
leaving `provenancePath` null, and call `commitSweep`.

Assert rejection contains the pathspec invariant detail.

Assert HEAD, epic bytes, and status porcelain are unchanged.

## Interfaces unchanged

The following remain stable:

- `computeSweep` return union and refusal discriminants;
- `EpicFrontmatterFlip`;
- `renderSweepPlan` output grammar;
- `renderSweepRefusal`;
- confirmation reader;
- CLI parse/dispatch behavior;
- presweep classifier and prefix contract;
- graph schema.

`ComputeSweepInput` and successful `SweepFlipSet` intentionally gain required fields because the
new plan state must be explicit at compile time.

## Ordering of implementation

1. Change core types and assembly.
2. Update all core test callers and add clean/dirty assertions.
3. Wire exact status observation in the shell.
4. Update commit pathspec validation.
5. Update static shell plan fixture.
6. Add real Git acceptance fixture and cases.
7. Run focused tests, typecheck, diff checks, and full gate.

The four source/test files form one coherent unit: intermediate commits would leave required type
fields unwired or acceptance unproven.

## Excluded paths

Do not modify:

- `.lisa/provenance.jsonl` in the shared repository;
- `src/ci/*`;
- `src/cli.ts` or `src/cli.test.ts`;
- `src/settle/*`;
- `src/seam/*`;
- board cards or ticket frontmatter;
- generated `baml_client/`.
