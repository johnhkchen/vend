# Research — T-078-02-02

## Assignment and phase

- Ticket: `T-078-02-02`, `doctor-charter-convention-check`.
- Parent story: `S-078-02`, `charter-convention-teaches-itself`.
- Current ticket phase on entry: `research`.
- The assignment requires all remaining RDSPI phases in one continuous pass.
- Phase artifacts belong only in this attempt-private directory.
- Lisa publishes admitted artifacts later; shared `docs/active/work/T-078-02-02/` is not an output.
- Ticket and story frontmatter must not be edited by the worker.
- Ticket-owned source must be committed with `lisa commit-ticket` and exact `--include` paths.

## Story contract

The story covers the three places where a newcomer encounters Vend's P-label convention:

1. clearing-gate refusal wording and the shared label detector;
2. a doctor charter-convention probe;
3. the charter emitted by `vend init`.

This ticket owns only the second surface.

The story acceptance relevant here is:

- a charter containing P-labeled invariants produces a green doctor line;
- the green line reports the number of distinct labeled invariants;
- a charter containing no P-labeled invariants produces an amber doctor line;
- the amber line teaches the labeling convention;
- amber remains diagnostic and does not change doctor's successful exit code;
- the doctor probe uses the same detector as the clearing gates.

The honest boundary is fixture-proven and free:

- no model call;
- no metered cast;
- no automatic charter rewrite;
- no migration of existing projects;
- no blocking behavior for the amber result.

The story explicitly refuses making amber blocking under N2, “Not a babysitting dashboard.”

## Dependency state

`T-078-02-01` is complete and committed before this ticket.

Its landed source changes are visible at commit `609df6c` / the subsequent ticket completion state.
The dependency exported the existing gate detector:

```ts
export function matchIds(text: string, prefix: "P" | "N"): Set<string>
```

The function:

- searches with word boundaries;
- matches `P` or `N` followed by one or more digits;
- deduplicates through a `Set`;
- retains first encounter order;
- returns zero entries for an unlabeled charter.

This is the required shared seam. The doctor must import it from `src/gate/gates.ts`; a parallel
regex would violate the story's purpose.

## Current doctor model

`src/doctor/doctor-core.ts` defines the pure doctor report model.

The unit is:

```ts
interface Check {
  readonly name: string;
  readonly ok: boolean;
  readonly hint?: string;
}
```

Two constructors enforce the settled binary contract:

- `passed(name)` returns `{ name, ok: true }`;
- `failed(name, hint)` returns `{ name, ok: false, hint }`.

`renderDoctorReport` derives the entire report and exit status from `Check.ok`:

- every check green: `doctor: ok`, exit `0`;
- any check red: `doctor: FAILED`, exit `1`;
- green lines render with `✓`;
- red lines render with `✗` and an optional hint suffix.

There is no third status in `Check`, no warning count, and no amber exit policy in the core.

The story scope names only a new probe and doctor wiring, not a redesign of `doctor-core.ts`.
Therefore the current binary core is a constraint on the new diagnostic representation.

## Existing doctor effect layers

`src/doctor/doctor-probe.ts` is the dependency probe.

It checks:

- Lisa on `PATH`;
- Claude on `PATH`;
- the BAML addon;
- active executor configuration;
- active executor dispensability;
- cross-reviewer dispensability when configured.

It is reused by cast preflight, so doctor-only diagnostics do not belong in it.

`src/doctor/preflight.ts` composes only `probeDoctor` with `renderDoctorReport` for cast gating.
Adding charter convention checks there would make an onboarding diagnostic part of the cast guard.
The story forbids that outcome.

## Doctor-only probe precedent

`src/doctor/board-hygiene-probe.ts` is the closest named precedent.

Its relevant structure is:

- a standalone module separate from `doctor-probe.ts`;
- one injected effect dependency;
- a default dependency that reads the current project;
- a pure fact-to-`Check` conversion;
- a small async wrapper for the real-world read;
- thrown read/parser errors converted to returned check data;
- tests over injected facts, without filesystem dependence.

The separation is load-bearing: board hygiene appears in `vend doctor` but not cast preflight.

`src/doctor/resumable-decompose-probe.ts` follows the same composition pattern:

- doctor-only;
- cwd-relative default storage;
- injected loader;
- pure mapping;
- returned checks;
- lazy CLI import.

The charter convention belongs beside these modules.

## Current CLI composition

The `doctor` dispatch arm is in `src/cli.ts`.

It first distinguishes a standalone kitchen workspace from a normal Vend/build workspace.

For a kitchen workspace it runs only `probeKitchen`.

For a normal workspace it currently imports and runs in parallel:

1. `probeDoctor()`;
2. `probeBoardHygiene()`;
3. `probeResumableDecompose()`.

It concatenates the returned checks in that order, renders once, prints once, and exits with the
core-derived exit code.

The new charter convention probe belongs only in the normal workspace branch. The story explicitly
excludes the kitchen overlay charter, and a kitchen workspace has its own doctor contract.

All doctor-specific imports are lazy. This keeps native and filesystem dependencies off the pure
CLI parse path. New wiring should preserve that property.

## Charter location

`src/play/project-context.ts` exports:

```ts
export const CHARTER_PATH = "docs/knowledge/charter.md";
```

That is the canonical project-relative location read by decompose and other play inputs.

A doctor effect can read `join(root, CHARTER_PATH)`, with `root` defaulting to `process.cwd()`.
Importing the constant avoids a second path literal.

The current live charter contains P1 through P7, so the shared detector reports seven distinct
P-labels.

An organic or pre-fix scaffold charter may contain ordinary prose but no `P\d+` token; the detector
reports zero for it.

## Existing smoke-test seam

`src/doctor/doctor-cli.smoke.test.ts` spawns the real entry point:

```text
bun run src/cli.ts doctor
```

Its `runDoctor` helper accepts:

- an environment object;
- an optional cwd.

The suite already creates temporary roots for cwd-sensitive doctor behavior.

Current smoke coverage proves:

- a real doctor report is printed;
- exit zero corresponds to an all-green report;
- a deliberately broken executor produces exit one and a named fix;
- a persisted decompose draft is wired into the live CLI.

The charter acceptance can use two temporary roots, each carrying
`docs/knowledge/charter.md`, and the existing real CLI helper.

The development environment has Lisa and Claude on `PATH`, the BAML addon loads, the default
executor probe succeeds, and the live doctor command exits zero. Existing tests nevertheless avoid
assuming every host is green except where a fixture-specific contract needs the successful path.

## Representation constraint for amber

The binary doctor core has no warning type. A `failed` check necessarily flips the whole report to
exit one, which is forbidden for the unlabeled charter.

The diagnostic therefore has to remain `ok: true` while making its status explicit in the check
name. The observable line can say `charter convention: green — ...` or
`charter convention: amber — ...`; the report core remains unchanged and sees both as non-blocking
checks.

This is descriptive of the available seam, not yet the design decision. Alternatives are evaluated
in the next phase.

## Worktree and concurrency constraints

The branch is ahead of origin and contains changes from other Lisa work:

- `.lisa/provenance.jsonl` is modified;
- ticket frontmatter files are modified by Lisa;
- another ticket's shared work directory is untracked.

These are not owned by this ticket and must not be staged, reverted, or included.

The source directories expected for this ticket are disjoint from sibling init work:

- this ticket: `src/doctor/` plus `src/cli.ts` wiring;
- sibling `T-078-02-03`: `src/init/`.

The exact source candidates are:

- create `src/doctor/charter-convention-probe.ts`;
- modify `src/doctor/doctor-cli.smoke.test.ts`;
- modify `src/cli.ts`.

No shared phase artifact path is ticket-owned during this attempt.

## Verification surface

Focused tests can cover:

- the pure charter-text-to-check mapping;
- the injected probe wrapper;
- the CLI output for labeled and unlabeled charter fixtures;
- zero exit for amber.

The repository gate remains `bun run check`, which runs BAML generation, TypeScript checking, and
the full Bun test suite.

## Research conclusions

- The shared detector is landed and ready for reuse.
- Doctor-only checks compose in the CLI, not in cast preflight.
- The canonical charter path already has a shared constant.
- A new module can preserve pure-core/impure-shell separation with an injected read dependency.
- The doctor core is intentionally binary; a red check cannot represent non-blocking amber.
- The new line must expose its green/amber state without changing the core verdict model.
- The CLI smoke file is the established place to prove cwd-backed doctor wiring.
- Kitchen behavior, gate verdicts, schemas, init output, and charter repair are outside this ticket.
