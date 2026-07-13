# Structure — T-075-04-01

## Change inventory

Two ticket-owned source files will be modified:

1. `src/cli.ts`
2. `src/cli.test.ts`

No source files will be created or deleted.
No present-layer, graph, projection, renderer, or board files will change.
No ticket frontmatter will be edited by this worker.

## `src/cli.ts`

### Existing role

`src/cli.ts` contains two architectural halves:

- pure CLI parsing and small formatting helpers at module scope;
- the effectful command dispatcher guarded by `if (import.meta.main)`.

The module-level exports are directly imported by `src/cli.test.ts`. The guard
prevents process output and exit effects when the module is imported for tests.

### New public function

Add:

```ts
export function formatSvgWriteLine(
  path: string,
  groupCount: number,
  cardCount: number,
  linkCount: number,
): string
```

Responsibilities:

- accept the output path exactly as returned by `writeBoardSvg`;
- accept the existing numeric group/card/link counts;
- format each count with its independently selected noun form;
- preserve current ordering: groups, cards, links;
- preserve current separators and em dash;
- include the trailing newline expected by `process.stdout.write`;
- perform no filesystem, process, clock, network, or graph work.

The function remains CLI-specific. It is not a general presentation-layer API.

### New private helper

Add a small module-local helper with a shape equivalent to:

```ts
function countedNoun(count: number, noun: string): string
```

Responsibilities:

- return `<count> <noun>` when `count === 1`;
- return `<count> <noun>s` otherwise;
- remain private to `src/cli.ts`;
- handle all three regular nouns without duplicating suffix logic.

This helper is an implementation detail and will not be imported by tests. The
public formatter is the behavior contract.

### Placement

Place the helper and exported formatter near the existing pure CLI formatting
helper `formatFundingLine`, before `parseArgs` and far above the impure dispatch.

Reasons:

- it keeps module-scope pure functions grouped together;
- it makes the helper available to the later SVG dispatch arm;
- it avoids defining logic inside the `import.meta.main` block;
- it keeps command parsing and effect control flow intact.

### SVG dispatch modification

Replace the existing inline template passed to `process.stdout.write` with a call
to `formatSvgWriteLine`.

The call will pass, in order:

1. `result.path`
2. `result.groupCount`
3. `result.cardCount`
4. `result.linkCount`

The dispatch remains responsible only for:

- obtaining the result from `writeBoardSvg`;
- passing plain result fields to the pure formatter;
- writing the returned string to stdout;
- exiting zero.

### Unchanged CLI boundaries

- `ParsedCommand` is unchanged.
- `parseArgs` is unchanged.
- `parseSvgArgs` is unchanged.
- `SVG_SEATS` is unchanged.
- usage text is unchanged.
- `--seat` and `--out` behavior is unchanged.
- lazy imports in the SVG arm are unchanged.
- output path splitting is unchanged.
- process exit behavior is unchanged.

## `src/cli.test.ts`

### Import modification

Extend the current import from `./cli.ts` to include `formatSvgWriteLine`.

The import remains safe because:

- `src/cli.ts` guards dispatch under `import.meta.main`;
- the formatter has no effectful dependencies;
- `svg-file.ts` remains lazily imported only inside the direct-run path.

### Test placement

Add formatter coverage adjacent to the existing SVG parser tests. The most
cohesive structure is a new describe block immediately after:

```ts
describe("parseArgs — svg (T-055-03 file-output seam)", ...)
```

Suggested describe name:

```ts
describe("formatSvgWriteLine")
```

This distinguishes output grammar from argument parsing while keeping all SVG
CLI behavior together in one section of the file.

### Required singular test

Call:

```ts
formatSvgWriteLine("board.svg", 1, 1, 1)
```

Assert the exact result:

```text
wrote board.svg — 1 group, 1 card, 1 link\n
```

This pins:

- singular `group`;
- singular `card`;
- singular `link`;
- the path position;
- the em dash;
- comma spacing;
- the trailing newline.

### Required plural test

Call with representative values greater than one, for example:

```ts
formatSvgWriteLine("board.svg", 2, 3, 4)
```

Assert the exact result:

```text
wrote board.svg — 2 groups, 3 cards, 4 links\n
```

Using distinct values proves each positional count is threaded to the correct
noun instead of accidentally repeating a field.

### Optional mixed-count coverage

No separate mixed-count test is required by acceptance. The implementation calls
the noun helper independently for each count, and the two exact cases exercise
both branches for every noun. Avoid broadening the test unless implementation
reveals a meaningful independent risk.

## Dependency direction

The resulting dependency flow remains:

```text
src/cli.test.ts
  -> imports pure formatSvgWriteLine from src/cli.ts

direct CLI execution
  -> src/cli.ts SVG arm
  -> lazy import src/present/svg-file.ts
  -> writeBoardSvg returns path and counts
  -> formatSvgWriteLine consumes plain fields
  -> process.stdout.write performs the output effect
```

No reverse dependency from the present layer to CLI wording is introduced.
No shared module is introduced.

## Behavioral boundary

The output changes only for nouns whose count equals one.

Before:

```text
wrote board.svg — 1 groups, 1 cards, 1 links
```

After:

```text
wrote board.svg — 1 group, 1 card, 1 link
```

For all representative counts greater than one, visible output is unchanged.
Zero remains plural, matching ordinary count grammar and existing output.

## Source ownership and commit unit

The implementation and its regression test form one meaningful source unit. Both
files should be committed in one Lisa ticket transaction because:

- the production change needs its gate in the same commit;
- the test imports the newly exported function;
- either file alone would be incomplete ticket work.

Exact include paths:

```text
src/cli.ts
src/cli.test.ts
```

The commit must exclude:

- `.lisa.toml`;
- `.lisa/hooks/on-stop.sh`;
- `.lisa/provenance.jsonl`;
- `.lisa/completion-journal.jsonl`;
- Lisa-managed ticket frontmatter;
- other tickets' work artifacts;
- this attempt-private artifact directory, which Lisa publishes separately.

## Verification structure

1. Run the targeted CLI test file.
2. Inspect the diff for only intended source changes.
3. Run `bun run check` as the repository gate.
4. Commit the exact two source paths with `lisa commit-ticket`.
5. Confirm the two source files are no longer modified or untracked.
6. Confirm unrelated pre-existing worktree changes remain present and unstaged.

## Non-changes

- No changes to `SvgFileResult`.
- No changes to `writeBoardSvg`.
- No changes to `src/present/svg-file.test.ts`.
- No changes to grouping presets.
- No changes to `projectGraph`.
- No changes to SVG string generation.
- No changes to the live board.
- No changes to package scripts or dependencies.
- No new errors or validation paths.
