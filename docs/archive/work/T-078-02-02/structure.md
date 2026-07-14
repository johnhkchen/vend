# Structure — T-078-02-02

## Change inventory

### Create

- `src/doctor/charter-convention-probe.ts`
- `src/doctor/charter-convention-probe.test.ts`

### Modify

- `src/cli.ts`
- `src/doctor/doctor-cli.smoke.test.ts`

### Delete

- none

### Explicitly unchanged

- `src/doctor/doctor-core.ts`
- `src/doctor/doctor-probe.ts`
- `src/doctor/preflight.ts`
- `src/doctor/board-hygiene-probe.ts`
- `src/gate/gates.ts`
- `src/init/**`
- kitchen doctor modules
- ticket/story/epic frontmatter
- shared `docs/active/work/T-078-02-02/`

## Architecture

```text
docs/knowledge/charter.md
          │ readFile (injected effect)
          ▼
charter-convention-probe.ts
          │ charter string
          ▼
gate/gates.ts::matchIds(charter, "P")
          │ distinct count
          ▼
doctor-core.ts::passed(name)
          │ one non-blocking Check
          ▼
cli.ts doctor composition
          │ alongside dependency / board / resume checks
          ▼
doctor-core.ts::renderDoctorReport
          │
          ├── green count, exit unaffected
          └── amber how-to, exit unaffected
```

The dependency direction stays one-way:

- doctor imports the shared gate detector;
- gates do not import doctor;
- CLI composes effects;
- core renderer remains unaware of charter semantics.

## `src/doctor/charter-convention-probe.ts`

### Responsibility

Own exactly the doctor-facing translation from charter text/read facts to one diagnostic check.

It does not:

- define what a P label is;
- parse markdown structure;
- rewrite the charter;
- decide report exit status;
- participate in cast preflight;
- print output;
- inspect kitchen overlays.

### Imports

Runtime imports:

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { matchIds } from "../gate/gates.ts";
import { CHARTER_PATH } from "../play/project-context.ts";
import { passed, type Check } from "./doctor-core.ts";
```

No native addon or executor import is introduced.

### Public constants

```ts
export const CHARTER_CONVENTION_CHECK = "charter convention";
```

This is the stable prefix used by green, amber, and read-fault lines.

```ts
export const CHARTER_CONVENTION_HOW_TO =
  "label charter invariants like `P1 — Author once, run forever` so casts can cite them in `advances`";
```

The unit and smoke tests import the constant instead of duplicating the complete operator guidance.

### Dependency interface

```ts
export interface CharterConventionProbeDeps {
  readonly readCharter: () => Promise<string>;
}
```

The interface carries the one effect the module needs. It supplies charter bytes, not a path, so
tests can use plain strings and a thrown error.

### Default dependency

```ts
const DEFAULT_CHARTER_CONVENTION_DEPS: CharterConventionProbeDeps = {
  readCharter: () => readFile(join(process.cwd(), CHARTER_PATH), "utf8"),
};
```

This keeps cwd selection at call time and reuses the canonical project-relative path.

### Pure mapping export

```ts
export function charterConventionCheck(charter: string): Check
```

Internal steps:

1. `count = matchIds(charter, "P").size`.
2. If count is positive:
   - compute singular/plural noun;
   - return `passed("charter convention: green — ...")`.
3. If count is zero:
   - return `passed("charter convention: amber — no labeled invariants found; ...")`.

No additional regex or normalization is allowed in this module.

### Probe export

```ts
export async function probeCharterConvention(
  deps: Partial<CharterConventionProbeDeps> = {},
): Promise<Check[]>
```

Internal steps:

1. shallow-merge defaults and overrides;
2. await `readCharter()`;
3. map via `charterConventionCheck`;
4. return a one-element array;
5. catch any thrown value;
6. return one `passed` amber check naming the unreadable canonical path, error detail, and how-to.

An internal `messageOf(error: unknown): string` performs total error rendering, matching existing
doctor probe conventions.

### Invariants

- Every resolved call returns exactly one check.
- Every returned check has `ok: true`.
- No returned check has a `hint`, because the binary renderer treats hints as red-check suffixes.
- The amber how-to lives in the line name and is therefore visible.
- No input produces a blocking result.

## `src/doctor/charter-convention-probe.test.ts`

### Responsibility

Pin the shared-detector mapping and injected effect boundary independently of CLI/environment state.

### Imports

- Bun test primitives;
- `renderDoctorReport` and `EXIT_OK`;
- all public probe constants/functions needed for assertions.

### Fixture strings

```text
LABELED: P1, P2, repeated P2
ONE_LABEL: P7
UNLABELED: ordinary invariant prose without P-number tokens
```

### Test groups

`charterConventionCheck — shared label detector`

- distinct count and green state;
- singular grammar;
- zero-label amber state and exact guidance;
- render of amber remains `ok` with exit zero.

`probeCharterConvention — injected charter read`

- injected labeled bytes flow through the pure mapper;
- thrown read error becomes a non-blocking amber line;
- the error line includes `CHARTER_PATH`, the backend detail, and the shared how-to;
- no rejection escapes.

The unit test performs no filesystem writes.

## `src/cli.ts`

### Existing location

Only the `if (parsed.cmd === "doctor")` non-kitchen branch changes.

### Import wiring

Add a lazy import beside the existing board/recovery imports:

```ts
const { probeCharterConvention } =
  await import("./doctor/charter-convention-probe.ts");
```

### Composition wiring

Change the `Promise.all` tuple from three results to four:

```ts
const [dependencyChecks, boardChecks, resumableChecks, charterChecks] = await Promise.all([
  probeDoctor(),
  probeBoardHygiene(),
  probeResumableDecompose(),
  probeCharterConvention(),
]);
```

Then concatenate in the same order:

```ts
checks = [...dependencyChecks, ...boardChecks, ...resumableChecks, ...charterChecks];
```

Existing checks retain their exact relative positions.

### Comment update

Update the doctor dispatch explanation to name the convention diagnostic and its non-blocking
behavior. Do not claim all checks are binary prerequisites after this addition.

No parse behavior, kitchen branch, print call, or exit call changes.

## `src/doctor/doctor-cli.smoke.test.ts`

### New helper

Add a small async fixture helper or inline setup that:

- creates a temp root;
- creates `docs/knowledge/`;
- writes supplied charter bytes to `charter.md`;
- returns the root;
- is paired with recursive cleanup in `finally`.

Existing `mkdtemp`, `rm`, and `join` imports remain useful. Add `mkdir`/`writeFile` as needed.

### Labeled smoke case

Fixture contents include two distinct labels and one duplicate.

Assertions:

- stdout contains `charter convention: green`;
- stdout contains `2 labeled invariants found`;
- no stack trace in stdout/stderr.

The assertion may also pin exit zero on the known-green fixture environment; the mandatory exit
assertion belongs at minimum to amber.

### Unlabeled smoke case

Fixture contents contain no P-number token.

Assertions:

- exit code equals zero;
- stdout contains `charter convention: amber`;
- stdout contains `CHARTER_CONVENTION_HOW_TO`;
- no stack trace or unhandled rejection appears.

This uses the real cwd-backed default reader and real CLI composition.

## Ordering of implementation

1. Create the probe module.
2. Create its unit test.
3. Run focused tests.
4. Run the full repository gate.
5. Commit those exact two files through Lisa.
6. Modify CLI composition.
7. Extend the smoke suite.
8. Run focused tests.
9. Run the full repository gate.
10. Commit those exact two files through Lisa.
11. Review all ticket commits and the worktree.

## File ownership and commit boundaries

Commit unit 1 includes exactly:

- `src/doctor/charter-convention-probe.ts`
- `src/doctor/charter-convention-probe.test.ts`

Commit unit 2 includes exactly:

- `src/cli.ts`
- `src/doctor/doctor-cli.smoke.test.ts`

Attempt-private artifacts are not repository source and are not included in ticket commits.
Lisa-owned ticket/provenance changes and other tickets' work artifacts remain untouched.

## Verification criteria

- TypeScript accepts imports and tuple shapes.
- Probe unit tests prove count, singular/plural, amber guidance, read faults, and exit zero.
- CLI smoke proves labeled and unlabeled cwd wiring.
- Existing doctor failure cases remain exit one.
- Existing cast preflight tests remain unchanged and green.
- Kitchen doctor suites remain unchanged and green.
- `bun run check` is green before both source commits and at final review.
