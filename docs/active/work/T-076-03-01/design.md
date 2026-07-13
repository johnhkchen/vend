# Design — T-076-03-01

## Decision

Extend the existing doctor probe composition with one sixth check that resolves the complement
through `resolveComplementExecutor`, then calls the resolved reviewer's existing `Executor.probe()`.
Represent reviewer provisioning with an optional `ExecutorRegistry` in `DoctorProbeDeps`, matching
the configuration seam already used by `castPlay`.

The sixth check has two visible forms:

```text
cross-review: not provisioned — casts skip review
cross-review reviewer dispensable: <seat>
```

The first is green and exact for an inert/default registry. The second maps the resolved reviewer's
probe result: green for `ok: true`, red with provider detail and fix-it guidance for `ok: false`.

## Required behavior matrix

| Author/configuration | Canonical resolution | Probe | Doctor check |
|---|---|---|---|
| default Claude author | `null` | none | green inert line |
| explicit one-seat registry | `null` | none | green inert line |
| explicit two-seat, Claude author | Codex reviewer | `ok` | green, names `codex` |
| explicit two-seat, Claude author | Codex reviewer | non-ok | red, names `codex`, carries fix |
| explicit two-seat, Codex author | Claude reviewer | `ok`/non-ok | named `claude` result |
| unknown/lane-less author | `null` | none | green inert line |
| resolver/factory/probe throws | exceptional effect | throws | generic red reviewer check via `safeCheck` |

The inert result is green because it describes what the cast will actually do: skip review. It is
not proof that a reviewer is reachable and does not claim one is configured.

## Option A — registry injection plus canonical resolve-and-probe (chosen)

Add a reviewer registry fact to `DoctorProbeDeps`:

```ts
readonly crossReviewRegistry: ExecutorRegistry | undefined;
```

The real default is `undefined`, which invokes `resolveComplementExecutor`'s one-seat default.
Tests pass explicit two-seat registries whose factories return inert fake executors with controlled
`probe()` results.

The reviewer check performs:

1. project active executor id to author seat with `resolveSeatOfExecution`;
2. call `resolveComplementExecutor(authorSeat, registry)`;
3. return the exact inert green check when resolution returns `null`;
4. otherwise call only `reviewer.executor.probe()`;
5. map the result to a check named with `reviewer.seat`.

### Advantages

- Reuses the exact resolver used by cast orchestration.
- Treats the registry as configured capability, not the built-in adapter catalog.
- Makes default inert behavior a consequence of canonical resolution, not a doctor special case.
- Makes provisioned unit tests exercise both resolution and probe dispatch.
- Uses the existing `Executor.probe()` injection surface on fake executors.
- Gives tests a direct way to prove the reviewer factory/probe is or is not called.
- Keeps concrete Claude/OpenAI transports out of doctor logic.
- Leaves room for a future caller to pass the same configured registry to doctor/preflight.

### Costs

- `DoctorProbeDeps` learns the same registry configuration type already used by cast.
- The default dependency object carries an explicit `undefined` registry fact.
- A throwing resolver factory reaches `safeCheck` under a generic reviewer check name because the
  seat-specific name is not available until resolution succeeds.

The exceptional-name limitation does not weaken acceptance: built-in `probe()` implementations
return expected reachability failures as structured data, and those results have the reviewer seat.

## Option B — inject a complete reviewer-probe reader

Add a dependency such as:

```ts
reviewerProbe(env): Promise<{ seat: AgentSeat; result: ExecutorProbeResult } | null>
```

The default reader would resolve and probe; tests would inject `null`, ok, and non-ok facts.

### Advantages

- Closely mirrors the active `executorProbe(env)` dependency.
- Keeps doctor tests very small and fully fact-driven.
- Exposes the narrowest possible effect surface to `probeDoctor`.

### Rejection rationale

- Provisioned tests would bypass canonical complement resolution entirely.
- A separate composite result shape would be a new reviewer-probe mechanism adjacent to the
  already sufficient executor probe contract.
- It would be easier for reviewer provisioning semantics to drift from cast semantics.
- It would not naturally expose the current registry as the relevant configuration fact.

This ticket explicitly calls for resolver reuse, so testing through the resolver is higher value
than hiding it behind a fabricated composite fact.

## Option C — infer provisioning from `builtinExecutors`

Treat every installed adapter as a configured reviewer and resolve from `builtinExecutors`.

### Rejection rationale

- This is the exact semantic error corrected by `T-076-01-01`.
- Installed adapter availability is not operator provisioning.
- Default doctor would attempt OpenAI-compatible reachability and go red on fresh installs.
- Default casts do not dial that reviewer, so doctor would cease to describe actual cast behavior.

## Option D — duplicate complement selection inside doctor

Inspect executor ids, choose the opposite known seat, and construct it directly.

### Rejection rationale

- Duplicates author membership, ambiguity, and one-seat behavior.
- Creates a second source of truth for seat resolution.
- Risks doctor and cast disagreeing about whether cross-review will run.
- Violates the story's direct reuse requirement.

## Option E — add a dedicated reviewer transport probe

Introduce `probeReviewer()` or call a concrete provider's auth/network reader.

### Rejection rationale

- Every reviewer is already an `Executor` with required `probe()`.
- Concrete transport logic would regress executor neutrality.
- A second probe mechanism adds behavior without improving the shallow readiness guarantee.
- Direct provider checks risk spending or exposing details inconsistently with the established seam.

## Option F — call `dispense()` with a cheap prompt

Perform a live review-like request to prove the reviewer end to end.

### Rejection rationale

- Violates the story's FREE/probe-level boundary.
- Spends tokens and consumes budget before a cast.
- Makes doctor slow and potentially destructive.
- Exceeds the shallow dispensability guarantee already established for the primary seat.

## Check naming

Export two constants:

```ts
CROSS_REVIEW_INERT_CHECK = "cross-review: not provisioned — casts skip review"
CROSS_REVIEW_DISPENSABLE_CHECK = "cross-review reviewer dispensable"
```

Resolved names append the seat:

```text
cross-review reviewer dispensable: codex
cross-review reviewer dispensable: claude
```

Why seat rather than executor id:

- acceptance explicitly asks to name the reviewer seat;
- the resolver already returns the authoritative `AgentSeat`;
- executor ids are routing implementation details (`openai-compat` maps to the Codex seat);
- the primary check already names executor identity, so this line clearly distinguishes reviewer
  responsibility.

## Pure core and impure shell

Keep effect composition in `doctor-probe.ts`, the established impure shell. Add a pure mapper for
reviewer probe results:

```ts
reviewerDispensableCheck(seat, result): Check
```

Avoid duplicating reason/hint formatting by extracting a private general mapper that accepts the
full check name and fallback subject. The existing exported `executorDispensableCheck` delegates to
that helper and preserves its public behavior byte-for-byte. The new reviewer mapper delegates to
the same helper with a reviewer-specific name and fallback.

Resolution and `probe()` remain in an async reviewer check verb. The registry and active executor
id are plain inputs. `safeCheck` surrounds the verb inside `probeDoctor`.

## Never-throw behavior

The sixth operation joins the existing `Promise.all` through:

```ts
safeCheck(CROSS_REVIEW_DISPENSABLE_CHECK, () => crossReviewCheck(...))
```

Expected reachability failures remain structured non-ok probe results and preserve their details.
Unexpected resolver, factory, or probe throws become a generic named red check with the thrown
message. `probeDoctor` therefore continues to resolve rather than reject.

## Ordering and concurrency

Append the reviewer check after the active executor dispensability check. This reads naturally:

1. common local dependencies;
2. active executor configuration;
3. active executor reachability;
4. optional reviewer state/reachability.

The operation remains independent and may run concurrently in the existing `Promise.all`.
Stable input order makes the reviewer line sixth regardless of completion timing.

## Test design

Use fake executors implementing both required methods. `dispense()` should throw if called so a
test fails if doctor crosses the unmetered boundary. Their `probe()` methods return injected facts
and increment call counters.

Cover:

- default environment and registry: six green checks, exact inert sixth line, no reviewer probe;
- explicit two-seat registry with reachable Codex reviewer: green named seat check, one probe;
- explicit two-seat registry with unreachable Codex reviewer: red named seat check, reason and fix;
- pure reviewer mapper fallback for malformed non-ok result;
- unexpected reviewer probe throw: returned generic red check, never rejection;
- guarded-live shape updated from five to six and includes exact inert line.

Existing preflight deterministic tests need no fixture changes because their omitted reviewer
registry resolves inertly and performs no external effect.

## Scope guard

Modify only:

- `src/doctor/doctor-probe.ts`;
- `src/doctor/doctor-probe.test.ts`.

Do not change cross-review resolver, executor transports, cast orchestration, CLI parsing,
renderer, preflight composition, configuration UI, ticket frontmatter, or shared work artifacts.
