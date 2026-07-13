# T-076-01-01 — Plan

## Objective

Make omitted/default complement resolution represent a one-seat Claude configuration, while
preserving explicit two-seat reviewer provisioning through the existing registry injection seam.

## Execution rules

- Work continuously through Implement and Review.
- Do not edit ticket phase/status frontmatter.
- Write attempt artifacts only under `.lisa/attempts/T-076-01-01/1/work/`.
- Do not write to `docs/active/work/T-076-01-01/`.
- Do not use ordinary staging or commit commands.
- Commit only exact ticket-owned source paths with `lisa commit-ticket`.
- Do not include Lisa-owned board/orchestration files.
- Stop on this ticket after `review.md` is written.

## Step 1 — Pin the default regression

Modify `src/cross-review/resolve-complement.test.ts` first.

Add direct assertions that omit the registry argument:

```ts
expect(resolveComplementExecutor("claude")).toBeNull();
expect(resolveComplementExecutor("codex")).toBeNull();
```

Verification intent:

- The Claude assertion reproduces the exact rc.4 shape named by the ticket.
- The Codex assertion covers every currently known author seat.
- With current source, the test must fail because `builtinExecutors` supplies a complement in both
  directions.
- No network or dispense occurs; current construction is inert even though the result is wrong.

Run:

```bash
bun test src/cross-review/resolve-complement.test.ts
```

Expected before implementation: the new default assertions fail.

Record the red result in `progress.md` as characterization evidence.

## Step 2 — Introduce the one-seat cross-review default

Modify `src/cross-review/resolve-complement.ts`.

Import `DEFAULT_EXECUTOR_ID` from the selector module.

Add a private `defaultCrossReviewRegistry` containing only the default executor id. Its nullary
factory must construct through `executorFor` with:

- explicit `{ executor: DEFAULT_EXECUTOR_ID }` selection;
- empty environment `{}`;
- `builtinExecutors` as the installed-adapter catalog.

Change the resolver's default parameter from `builtinExecutors` to this private registry.

Update comments/doc blocks to state:

- installed built-ins are not automatically provisioned reviewers;
- the default is a one-seat Claude capability and is inert;
- passing an explicit registry is the provisioning route.

Do not change the resolver algorithm.

## Step 3 — Make positive provisioning evidence explicit

Review the existing two positive tests.

Rename their descriptions, if useful, so they say the two-seat registry is explicitly
provisioned. Do not change fixture behavior.

Verify that:

- Claude author plus explicit two-seat registry returns the Codex/OpenAI-compatible stub;
- Codex author plus explicit two-seat registry returns the Claude stub;
- explicit one-seat registry stays inert;
- absent/unknown and opposite-only registries stay inert.

Run:

```bash
bun test src/cross-review/resolve-complement.test.ts
```

Expected: all resolver tests pass.

## Step 4 — Verify selector behavior did not regress

Run the resolver and selector suites together:

```bash
bun test src/cross-review/resolve-complement.test.ts src/executor/select.test.ts
```

Verification criteria:

- resolver default is inert;
- explicit reviewer registry resolves;
- `builtinExecutors` still contains an OpenAI-compatible factory;
- `VEND_EXECUTOR=openai-compat` still selects it explicitly;
- no-env ordinary execution still defaults to Claude.

This distinction is the core design proof: catalog membership remains, implicit review
provisioning disappears.

## Step 5 — Inspect the exact diff

Run:

```bash
git diff -- src/cross-review/resolve-complement.ts \
  src/cross-review/resolve-complement.test.ts
git diff --check -- src/cross-review/resolve-complement.ts \
  src/cross-review/resolve-complement.test.ts
```

Confirm:

- only the intended import, private default, signature default, documentation, and tests changed;
- no concrete executor transport import was introduced;
- the explicit registry code path remains unchanged;
- no OpenAI-compatible factory exists in the default cross-review registry;
- formatting and whitespace are clean.

## Step 6 — Run the full gate

Run:

```bash
bun run check
```

This must complete green before any ticket commit. Record:

- BAML generation result;
- typecheck result;
- test pass/fail/skip counts;
- any pre-existing skips separately from failures.

If the gate fails:

1. identify whether the failure is caused by the two ticket paths;
2. fix ticket-owned failures within scope;
3. rerun the focused tests;
4. rerun the full gate;
5. do not commit while red.

## Step 7 — Update implementation progress

Write `.lisa/attempts/T-076-01-01/1/work/progress.md` with:

- completed source changes;
- red/green characterization evidence;
- focused test evidence;
- full check evidence;
- deviations from this plan, if any;
- exact intended commit paths;
- remaining work.

The artifact is private attempt state and is not part of the source commit.

## Step 8 — Commit the meaningful source unit

Use only:

```bash
lisa commit-ticket \
  --ticket-id T-076-01-01 \
  --message "fix(cross-review): keep default reviewer registry inert (T-076-01-01)" \
  --include src/cross-review/resolve-complement.ts \
  --include src/cross-review/resolve-complement.test.ts
```

The two source paths form one atomic unit: policy change plus regression proof.

Do not include:

- ticket/story/epic markdown;
- private attempt artifacts;
- shared published work artifacts;
- unrelated modified or untracked files.

## Step 9 — Verify post-commit state

Capture the commit id and inspect:

```bash
git show --stat --oneline HEAD
git show --check HEAD
git status --short
```

Confirm:

- commit message names T-076-01-01;
- commit contains exactly the two planned source paths;
- no whitespace errors;
- both ticket-owned paths are clean;
- no ticket-owned source remains staged, modified, or untracked.

If HEAD may include another concurrent worker's commit, use the commit id returned by Lisa for the
inspection instead of assuming HEAD.

## Step 10 — Review acceptance

Write `.lisa/attempts/T-076-01-01/1/work/review.md`.

Assess each acceptance item independently:

### Default inertness

- Direct `resolveComplementExecutor("claude")` returns `null`.
- Direct `resolveComplementExecutor("codex")` returns `null`.
- The first is explicitly identified as the rc.4 regression shape.

### Explicit provisioning

- Passing a two-seat `ExecutorRegistry` still resolves the sole complement.
- Registry injection is documented as the existing provisioning convention.
- No UI/config schema was invented.

### No implicit dialable OpenAI reviewer

- Default cross-review registry contains only Claude.
- Its default algorithm cannot select or construct `OpenAICompatExecutor`.
- Ordinary explicit OpenAI author selection remains unchanged and separately tested.

### Full gate

- `bun run check` green with exact evidence.

## Testing strategy rationale

The ticket is a pure resolution-policy change. Adjacent unit tests are sufficient because:

- all inputs are plain seat/registry values;
- factories can return inert stub executors;
- no network behavior is needed to prove a factory is unreachable by default;
- cast integration already proves explicit `crossReviewRegistry` threading;
- the dependent ticket will exercise the skipped-marker settlement branch;
- later stories own unreachable-reviewer and no-network end-to-end characterization.

The selector suite is included as a regression guard because the design intentionally preserves
the OpenAI-compatible built-in catalog while narrowing only cross-review's default.

## Risk controls

### Risk: accidentally disable explicit OpenAI execution

Control: do not edit `builtinExecutors`; run selector tests.

### Risk: default registry misrepresents the author

Control: include Claude through `DEFAULT_EXECUTOR_ID`, not an empty registry.

### Risk: process env redirects the default factory

Control: pass explicit id and empty env to `executorFor`.

### Risk: explicit review tests pass through an implicit path

Control: keep and name the injected two-seat fixture as explicit provisioning.

### Risk: scope overlaps the dependent marker ticket

Control: do not edit `cast.ts` or `run-log.ts`.

### Risk: concurrent Lisa state enters the commit

Control: exact repeated `--include` paths and post-commit inspection.

## Done condition

Implementation is complete only when:

- both source files contain the planned change;
- focused tests are green;
- `bun run check` is green;
- the exact two source paths are committed through `lisa commit-ticket`;
- ticket-owned source state is clean;
- `progress.md` and `review.md` exist in the private attempt directory;
- Review honestly names any remaining concern;
- work stops on T-076-01-01 pending Lisa completion handling.
