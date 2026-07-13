# Structure — T-072-01-01

## Change boundary

Two existing repository files are ticket-owned:

- `src/cli.ts` — production banner, parsed command model, pure routing, and shell
  dispatch.
- `src/cli.test.ts` — parser, banner-inventory, and direct-shell verification.

No source files are created or deleted. No modules outside `src/cli.ts` are touched.
Phase artifacts live only in the private attempt work directory and are not source
commit inputs.

## `src/cli.ts`

### 1. `USAGE` constant

Replace the flat line ordering with a stable section structure:

1. synopsis line;
2. blank line;
3. free heading;
4. eight existing free command syntax lines;
5. blank line;
6. metered heading;
7. six existing metered verb syntax lines;
8. one selection syntax line;
9. blank line;
10. the existing newcomer hint.

The free section owns these rendered markers:

```text
vend shelf
vend doctor
vend user-guide
vend --version
vend envelope
vend audit
vend svg
vend init
```

The metered section owns:

```text
vend run
vend chain
vend expand
vend annotate
vend survey
vend steer
vend <selection>
```

Existing detailed suffixes remain attached to their commands. The selection suffix
is `[--all] [--budget <ms>,<tokens>]`, matching `parseSelectOrBrowse`.

No extra exported list is introduced. `USAGE` remains the public help/banner value
used by both errors and successful help.

### 2. `ParsedCommand` union

Insert a leaf member:

```ts
| { readonly cmd: "help" }
```

Place it near other read-only informational leaves (`user-guide`, `version`). It
carries no payload because all help text is the static `USAGE` constant.

No existing union member changes shape.

### 3. `parseArgs`

After the zero-argument browse return, add one early alias intercept:

```ts
if (argv[0] === "--help" || argv[0] === "help") return { cmd: "help" };
```

This occurs before `--version`, the named-verb routing table, and
`parseSelectOrBrowse`. No helper function is added.

Update the surrounding comment to document help as a global discovery query and its
short-circuit behavior. Existing parser helpers remain untouched.

### 4. direct dispatch shell

Immediately after the `usage` failure branch, add:

```ts
if (parsed.cmd === "help") {
  process.stdout.write(`${USAGE}\n`);
  process.exit(0);
}
```

This ordering ensures:

- help never shares the error stream or error exit;
- later union narrowing excludes `help`;
- no lazy imports execute;
- the final run fallthrough still sees only its expected command type.

No other dispatch arm is reordered or edited.

## `src/cli.test.ts`

### 1. parser alias tests

Within the main `parseArgs` describe block, add one test asserting:

```ts
expect(parseArgs(["--help"])).toEqual({ cmd: "help" });
expect(parseArgs(["help"])).toEqual({ cmd: "help" });
```

This is placed near bare browse and other global-surface cases.

### 2. grouped banner inventory

Add a dedicated `describe("help command and grouped usage ...")` block. Define
expected command marker arrays inside the test so they are visibly the acceptance
contract rather than production implementation data.

The test performs these structural checks:

- `USAGE` contains the free heading before the metered heading;
- slicing at headings produces distinct `freeSection` and `meteredSection` strings;
- each of eight free markers is in the free section;
- none of those free markers is in the metered section;
- each of seven metered markers is in the metered section;
- none of those metered markers is in the free section;
- concatenating both expected arrays yields fifteen unique entries.

The marker strings include `vend ` to avoid accidental matches in prose. The
selection gesture uses `vend <selection>` as its marker.

### 3. direct shell tests

Add an async test that loops over `--help` and `help`. For each spelling:

- run `[process.execPath, "src/cli.ts", spelling]` from the repository cwd;
- collect stdout and stderr;
- await the subprocess exit;
- assert exit code zero;
- assert decoded stdout is exactly `${USAGE}\n`;
- assert decoded stderr is empty.

Use `Bun.spawn` because the test suite already runs under Bun and the target script
has no compile/build prerequisite. `process.execPath` invokes the same Bun runtime
as the test runner.

No environment or temporary directory setup is required because help returns before
any cwd-dependent import or effect.

## Public interfaces after change

`USAGE` remains:

```ts
export const USAGE: string
```

`parseArgs` remains:

```ts
export function parseArgs(argv: readonly string[]): ParsedCommand
```

`ParsedCommand` gains one valid output:

```ts
{ readonly cmd: "help" }
```

There are no new exports, new dependencies, filesystem effects, or network effects.

## Ordering constraints

1. Update the banner and command type together so the production help representation
   is coherent.
2. Add parser routing before shell dispatch so TypeScript recognizes the reachable
   command and the shell handles it.
3. Add tests after the production shape exists.
4. Run the focused test before the full gate.
5. Commit both ticket-owned files in a single meaningful source unit because the
   implementation and its acceptance proof are inseparable and touch the same two
   tightly coupled files.

## Explicit non-changes

- Do not edit `parseSelectOrBrowse` or its unknown-command string.
- Do not add edit-distance/suggestion logic.
- Do not alter `user-guide` aliases.
- Do not add a `browse` verb.
- Do not classify internal aliases as separate real commands.
- Do not alter budgets, play dispatch, or any command-specific parser.
- Do not change ticket phase/status frontmatter.
- Do not write to `docs/active/work/T-072-01-01/`.

## Structural verification

- TypeScript discrimination accepts every existing branch plus `help`.
- Focused tests prove pure parse outputs and both shell aliases.
- Banner slicing proves each contract command is in exactly its assigned group.
- Full check proves no existing substring assertion or command behavior regressed.
- Git/Lisa status proves no ticket-owned file is left modified, staged, or untracked
  after the exact-path commit.
