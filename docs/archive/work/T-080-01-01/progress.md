# Progress — T-080-01-01 marker tolerates untracked duration

## State

Implement complete. Review is in progress.

## Baseline

- Read AGENTS, vision, RDSPI workflow, parent story, ticket, charter grounding, seam contract, and
  relevant seam/settle code and tests.
- Confirmed ticket phase is `research`; Lisa owns phase advancement.
- Confirmed `lisa commit-ticket --help` exact option shape.
- Confirmed pre-existing working-tree changes are Lisa-owned phase transitions in:
  - `docs/active/tickets/T-080-01-01.md`;
  - `docs/active/tickets/T-080-02-01.md`.
- Wrote Research, Design, Structure, and Plan artifacts to this attempt-private directory.
- Focused baseline command:

```text
bun test src/seam/lisa-loop-settled-core.test.ts src/seam/lisa-loop-settled.test.ts \
  src/settle/settle-core.test.ts src/settle/settle.test.ts
```

- Baseline result: 62 pass, 0 fail, 183 expectations across 4 files.

## Planned implementation units

### Unit 1 — marker schema and durable contract

- [x] Widen duration to an optional marker property.
- [x] Keep the four/five-field v1 schema closed.
- [x] Distinguish absent event duration from malformed present duration.
- [x] Update fixture and core round-trip tests.
- [x] Prove direct recorder publication without duration.
- [x] Update settle-core valid/malformed fixtures.
- [x] Update durable seam documentation.
- [x] Run focused tests and full gate.
- [x] Commit exact paths with `lisa commit-ticket`.

### Unit 2 — honest settle surface

- [x] Conditionally render tracked duration.
- [x] Pin untracked and tracked terminal output.
- [x] Run the real hook fixture with duration unset.
- [x] Run focused tests and full gate.
- [x] Commit exact paths with `lisa commit-ticket`.

## Unit 1 result

- `LisaLoopSettledMarkerInput.durationSecs` and `LisaLoopSettledMarker.durationSecs` are optional.
- The closed schema admits only the four required keys or those four plus `durationSecs`.
- The builder conditionally materializes duration, so untracked markers have no own duration key.
- `classifyLisaCompleteEvent` admits `undefined` but keeps present invalid strings refused.
- The canonical fixture is the four-field untracked shape.
- Inline tracked bytes prove the existing five-field shape round-trips unchanged.
- The direct recorder test publishes and parses the untracked shape below `.vend/` only.
- Settle-core tests accept untracked provenance and use an actual extra-key schema mismatch.
- The durable knowledge contract now describes duration as optional when untracked.
- Focused unit result: 54 pass, 0 fail, 137 expectations across 3 files.
- Full gate before commit: 1,922 pass, 1 intentional skip, 0 fail, 6,287 expectations across 126
  files.
- Commit: `ab5ff95e850736f047c48bc74405a8a247cc80a1` —
  `feat(seam): admit untracked loop duration`.
- The commit used `lisa commit-ticket` with exactly six repository-relative include paths.

## Unit 2 result

- `renderSettleResult` builds the project/ticket loop line first.
- It appends `in Ns` only when `durationSecs !== undefined`.
- A measured zero still renders as `in 0s`.
- An untracked marker renders exactly `loop: vend — 1 ticket done` in the terminal fixture.
- The renderer tests exclude `undefineds` and any numeric duration suffix for the untracked form.
- The real project-owned hook fixture explicitly unsets `LISA_DURATION_SECS`.
- That fixture proves record, settle trigger, honest line, single firing, consumption, and empty repeat.
- Focused acceptance result: 69 pass, 0 fail, 203 expectations across 4 files.
- Full gate before commit: 1,924 pass, 1 intentional skip, 0 fail, 6,293 expectations across 126
  files.
- Commit: `5a2bb150251059943b76993b6810ca2e351a57fa` —
  `fix(settle): render loops without tracked duration`.
- The commit used `lisa commit-ticket` with exactly three repository-relative include paths.

## Final verification

- Post-commit `bun run check`: 1,924 pass, 1 intentional skip, 0 fail, 6,293 expectations across
  126 files.
- BAML generation passed.
- TypeScript `tsc --noEmit` passed.
- `git diff --check` passed for every ticket-owned path.
- Ticket-owned tracked paths have no remaining diff.
- `git status --short` shows only Lisa-owned ticket phase changes and Lisa-published untracked work
  directories for T-080-01-01 and concurrent T-080-02-01.
- Concurrent sweep-ticket source appeared during the first full gate and was committed independently
  before final audit; exact-path Lisa transactions prevented ownership overlap.
- No ordinary index command was used.

## Deviations

No implementation deviation from Design or Structure.

The Plan split `src/seam/lisa-loop-settled.test.ts` across two commits as intended: direct recorder
evidence landed with Unit 1, then the real-hook unset-duration evidence landed with Unit 2.
