# Design — T-078-02-02

## Decision summary

Add a standalone doctor-only charter convention probe with an injected charter reader and a pure
charter-text-to-`Check` mapper. Import `matchIds` from the clearing gates, count distinct P labels,
and encode the diagnostic state explicitly in the passing check's name:

- `charter convention: green — N labeled invariant(s) found`;
- `charter convention: amber — no labeled invariants found; ...<labeling how-to>`.

Both shapes are `passed` checks. That preserves doctor exit zero for amber without altering the
settled binary `Check` model. Wire the probe only into the normal `vend doctor` branch, not cast
preflight and not the kitchen doctor. Prove the pure mapper and injected read boundary in a unit
test, then prove real cwd-based CLI wiring in the existing doctor smoke suite.

## Design goals

1. Reuse the exact detector used by the gates.
2. Report the distinct P-label count for labeled charters.
3. Teach the convention when the count is zero.
4. Make green versus amber visible in plain, non-color output.
5. Keep amber non-blocking by construction.
6. Keep the check outside cast preflight.
7. Preserve kitchen doctor behavior.
8. Preserve the existing doctor report and exit-code model.
9. Keep filesystem access in a thin injectable shell.
10. Cover the CLI wiring without a model call or budget.

## Option A — make zero labels a failed doctor check

The simplest binary mapping would be:

- labels present → `passed(...)`;
- zero labels → `failed(..., howTo)`.

### Advantages

- Uses the current renderer's `✓`/`✗` distinction directly.
- Keeps guidance in the existing `hint` field.
- Looks similar to board hygiene and resumable-decompose failures.

### Disadvantages

- `renderDoctorReport` maps any failed check to exit one.
- It violates the explicit ticket acceptance that amber keeps exit zero.
- It would turn a convention diagnostic into a blocking readiness verdict.
- It would conflict with N2 and the story's refused-not-deferred boundary.

### Disposition

Rejected.

## Option B — extend `Check` and `doctor-core` to three states

Introduce a status such as `"green" | "amber" | "red"`, add an amber constructor, update the
renderer, and derive exit one only from red.

### Advantages

- Models warning semantics explicitly.
- Could give amber its own symbol or ANSI treatment.
- Generalizes to future non-blocking diagnostics.

### Disadvantages

- Broadens this ticket beyond the story's named files and precedent.
- Changes every doctor producer and many tests for one diagnostic.
- Introduces a public semantic expansion with no other current consumer.
- Risks changing settled headers, check counts, formatting, and compatibility.
- Creates a generic warning framework where the story requests one convention line.

### Disposition

Rejected as disproportionate and outside the intended slice.

## Option C — return a green check and place amber in its name

Use `passed` for both label states, while rendering the state and detail as part of the line:

```text
✓ charter convention: green — 7 labeled invariants found
✓ charter convention: amber — no labeled invariants found; label charter values like ...
```

### Advantages

- Amber cannot flip doctor exit status.
- The state remains visible even without ANSI color.
- Requires no doctor-core changes.
- Fits the existing probe composition seam.
- The line carries both status and how-to in the CLI smoke output.
- The check remains diagnostic data, not a health failure.

### Disadvantages

- The existing renderer still prefixes amber with the general passing `✓` marker.
- The word `amber` is presentation data in the name rather than a typed status.
- Future warnings would need either the same convention or a core redesign.

### Assessment

The apparent `✓`/amber tension is acceptable in the current model: `✓` means “this check did not
block doctor,” while the explicit `amber` label says the convention needs operator attention. The
ticket specifically requires non-blocking amber, not a reusable severity framework. Plain text is
also more testable and survives redirected output.

### Disposition

Chosen.

## Option D — print an extra warning outside the doctor check model

The CLI could run the detector and write a separate amber line before or after the report.

### Advantages

- Could use a custom symbol or color without changing `Check`.
- Would not affect report exit status.

### Disadvantages

- The line would not be a doctor check despite the acceptance language.
- It creates a second renderer and output channel.
- The report header's check count would omit the diagnostic.
- Wiring and testing would bypass the board-hygiene precedent.

### Disposition

Rejected.

## Probe module design

Create `src/doctor/charter-convention-probe.ts`.

The module will export stable wording constants where tests need exact public copy:

```ts
export const CHARTER_CONVENTION_CHECK = "charter convention";
export const CHARTER_CONVENTION_HOW_TO =
  "label charter invariants like `P1 — Author once, run forever` so casts can cite them in `advances`";
```

The exact example mirrors the detector dependency's gate explanation and the convention described
by the epic. It teaches three facts:

- labels start with `P` and a number;
- the label is attached to an invariant description;
- casts cite those labels through `advances`.

## Pure mapping

Export:

```ts
export function charterConventionCheck(charter: string): Check
```

It computes:

```ts
const count = matchIds(charter, "P").size;
```

For `count > 0`, it returns a passing line with `green` and the count. Singular/plural wording is
grammatical:

- `1 labeled invariant found`;
- `7 labeled invariants found`.

For `count === 0`, it returns a passing line with `amber`, the zero-label cause, and the how-to.

The mapper owns no filesystem, environment, clock, process, network, or addon access.

## Effect boundary

Expose an injectable dependency:

```ts
export interface CharterConventionProbeDeps {
  readonly readCharter: () => Promise<string>;
}
```

The real default reads:

```ts
readFile(join(process.cwd(), CHARTER_PATH), "utf8")
```

`CHARTER_PATH` comes from `src/play/project-context.ts`, so the doctor and the decompose inputs
cannot drift to different charter locations.

Export:

```ts
export async function probeCharterConvention(
  deps?: Partial<CharterConventionProbeDeps>,
): Promise<Check[]>
```

It returns a one-element array for direct composition with the other doctor probes.

## Unreadable or missing charter

The detector needs charter text, while a cold or malformed workspace may lack a readable charter.

Three choices exist:

1. throw;
2. return a red check;
3. return a non-blocking amber check with the how-to.

Throwing violates doctor probe conventions. Red would violate the story's diagnostic-only boundary
and make `vend doctor` block in arbitrary directories solely because no convention can be counted.

The chosen behavior is a passing amber check. It names the path/read problem and includes the same
labeling how-to. This keeps the module total at the doctor surface and does not pretend a count was
observed.

The injected unit test will pin this fault behavior separately from the zero-label behavior.

## CLI integration

In the non-kitchen doctor branch:

- lazily import `probeCharterConvention`;
- add it to the existing `Promise.all` alongside independent probes;
- append its result after the board and resumable checks or in a stable documented position;
- flatten all four result arrays before rendering.

Chosen order:

1. environment dependency checks;
2. board hygiene;
3. resumable decompose state;
4. charter convention.

This is additive and leaves all pre-existing line order unchanged.

The kitchen branch remains byte-identical because the story excludes overlay charters and kitchen
doctor has separate prerequisites.

`castPreflight` remains byte-identical because it calls only `probeDoctor`.

## Test design

### Unit test module

Create `src/doctor/charter-convention-probe.test.ts`.

Cases:

1. labeled charter with duplicates:
   - calls the shared detector indirectly;
   - reports the distinct count;
   - returns `ok: true`;
   - contains `green`.
2. one label:
   - pins singular wording.
3. unlabeled charter:
   - contains `amber`;
   - contains the exact how-to;
   - remains `ok: true`;
   - renders through `renderDoctorReport` with exit zero.
4. injected read failure:
   - resolves rather than rejects;
   - contains `amber`, the read detail, and the how-to;
   - renders exit zero.

This proves the pure core and impure wrapper without touching the real filesystem.

### CLI smoke

Extend `src/doctor/doctor-cli.smoke.test.ts` with temp-project fixtures.

The labeled fixture writes a charter with P1, P2, and a duplicate P2. The spawned CLI must show:

- `charter convention: green`;
- `2 labeled invariants found`.

The unlabeled fixture writes ordinary charter prose with no P token. The spawned CLI must show:

- `charter convention: amber`;
- the labeling how-to;
- exit zero;
- no stack trace.

Both use the real CLI and cwd-relative default reader. They perform no model call.

## Commit design

Two meaningful source units are available:

1. the standalone probe plus its unit test;
2. CLI composition plus the CLI smoke test.

Run `bun run check` before each `lisa commit-ticket` transaction. Use exact includes and never touch
the ordinary index.

## Scope guard

Do not change:

- `doctor-core.ts` or its binary verdict;
- `doctor-probe.ts` dependency checks;
- `preflight.ts` cast guard;
- gate detector semantics;
- gate verdict logic;
- schemas;
- init charter content;
- kitchen doctor behavior;
- real project charters;
- ticket frontmatter;
- shared work artifacts.

## Acceptance mapping

- “shared detector” → import `matchIds` from `gates.ts` in the pure mapper.
- “green with invariant count” → labeled mapper and labeled CLI smoke fixture.
- “amber with how-to” → unlabeled mapper and unlabeled CLI smoke fixture.
- “doctor exit code stays 0” → amber uses `passed`; both unit render and CLI smoke assert zero.
- “diagnostic and never blocking” → no integration into `probeDoctor`/`castPreflight`; read failures
  also degrade to passed amber.
