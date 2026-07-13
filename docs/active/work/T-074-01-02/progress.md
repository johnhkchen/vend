# Progress — T-074-01-02

## Status

Implementation complete and fully verified. The meaningful doctor consumer unit is ready for its
Lisa-isolated source commit.

## Completed phases

- Research completed in `research.md`.
- Design completed in `design.md`.
- Structure completed in `structure.md`.
- Plan completed in `plan.md`.
- Implementation executed test-first.
- Full repository gate is green.

## Test-first evidence

The primary doctor test was edited before production source. The first focused run failed exactly
because the planned export did not exist:

```text
SyntaxError: Export named 'EXECUTOR_DISPENSABLE_CHECK' not found
0 pass
1 fail
1 error
```

This established that the new check contract was absent rather than already passing incidentally.

## Production implementation

Modified `src/doctor/doctor-probe.ts`:

- added the base check name `executor dispensable`;
- imported the executor-neutral `ExecutorProbeResult` type;
- consumed the canonical `executorFor` selector;
- added `DoctorProbeDeps.executorProbe`, a narrow injected reader;
- added a real default that invokes `executorFor({}, env).probe()`;
- added pure `executorDispensableCheck(id, result)` mapping;
- preserved executor reason plus repair hint in the rendered failure detail;
- added defensive actionable fallback text for malformed non-ok results;
- appended the new check after active executor config;
- kept the complete check set behind the existing never-throw `safeCheck` boundary;
- introduced no call to `dispense`.

The resulting production check names are exact:

```text
executor dispensable: claude
executor dispensable: openai-compat
```

depending on canonical environment selection.

## Primary coverage

Modified `src/doctor/doctor-probe.test.ts`:

- updated stable count/order assertions from four to five checks;
- injects `{ ok: true }` and proves the new check is green and hintless;
- injects a realistic denied Claude config/Keychain result and proves the check is red;
- asserts failure text includes the config-store cause;
- asserts failure text includes `claude login`;
- asserts failure text includes sandbox and Keychain access language;
- proves the injected reader is called once;
- covers incomplete non-ok fallback text;
- covers a throwing executor probe degrading to a named red check;
- updates the guarded-live shape test to five checks without forcing host verdict.

## Hermetic downstream fixture

Modified `src/doctor/preflight.test.ts` only to inject a successful shallow executor probe into its
three deterministic cases. This prevents local Claude auth/Keychain state from changing their
expected verdict. The guarded-live case still exercises the real defaults.

No production preflight source changed.

## Focused verification

Command:

```text
bun test src/doctor/doctor-probe.test.ts \
  src/doctor/preflight.test.ts \
  src/doctor/doctor-cli.smoke.test.ts
```

Result:

```text
24 pass
0 fail
115 expect() calls
```

Additional checks:

```text
bun run check:typecheck     PASS
git diff --check           PASS
doctor-probe.ts dispense scan: no matches
```

## Full gate

Command:

```text
bun run check
```

Result:

```text
BAML client generation: PASS
TypeScript no-emit check: PASS
1721 pass
1 skip
0 fail
5302 expect() calls
```

The one skip is the existing release-acceptance integration that requires built `dist/` artifacts.
It is unrelated to this ticket.

## Plan deviations

- `src/doctor/preflight.test.ts` required the anticipated hermetic fixture update and is included in
  the source unit.
- No architecture or scope deviation occurred.
- No executor, cast, funding, budget, shelf, or renderer source was changed.

## Exact commit boundary

The source commit will include only:

```text
src/doctor/doctor-probe.ts
src/doctor/doctor-probe.test.ts
src/doctor/preflight.test.ts
```

It will be created with `lisa commit-ticket --ticket-id T-074-01-02` and repeated exact `--include`
paths. Existing Lisa provenance, ticket transitions, and work publication state remain outside the
source transaction.

## Remaining

1. Create the exact-path Lisa source commit.
2. Verify committed paths and ticket-owned cleanliness.
3. Write `review.md` with the final commit id and handoff.
4. Stop on this ticket for Lisa completion publication.
