# Plan — T-079-03-01

## Objective

Land the lisa loop-settled agreement and executable crossing as one coherent seam unit: a documented
on-notify contract, exact Vend-owned marker schema, strict fixture-driven validation, atomic recorder,
and existing-hook invocation that remains independent of ntfy configuration.

## Ownership guard

Before source edits:

1. Preserve the already modified Lisa-managed paths:
   - `.lisa/provenance.jsonl`
   - `docs/active/tickets/T-079-01-01.md`
   - `docs/active/tickets/T-079-03-01.md`
2. Do not edit ticket phase/status frontmatter.
3. Do not write artifacts to `docs/active/work/T-079-03-01/`.
4. Own only the seven paths named in Structure.
5. Use `apply_patch` for repository and artifact edits.
6. Use no ordinary `git add`, `git add -A`, or `git commit`.
7. Commit through `lisa commit-ticket` with exact repository-relative includes.

## Step 1 — create the canonical marker fixture

Create:

```text
src/seam/fixtures/lisa-loop-settled.valid.json
```

Write exactly one compact JSON object plus final newline:

```json
{"v":1,"kind":"lisa-loop-settled","project":"vend","ticketsDone":2,"durationSecs":41}
```

Verification:

- valid JSON;
- exact five keys;
- no absolute machine-specific path;
- numeric quantities;
- deterministic field order.

## Step 2 — implement the pure schema core

Create `src/seam/lisa-loop-settled-core.ts`.

1. Export schema version, kind, and default Vend-owned path.
2. Define the readonly marker and input interfaces.
3. Define valid/malformed parse result types.
4. Define complete/ignored/refused lisa event result types.
5. Add small object, non-empty-string, and non-negative-safe-integer guards.
6. Add an exact-key-set guard.
7. Implement strict marker construction.
8. Implement tolerant revival from `unknown`.
9. Implement JSON text parsing that returns malformed data instead of throwing.
10. Implement complete-event classification from lisa environment strings.
11. Derive only the project basename from `LISA_PROJECT`.
12. Implement deterministic serialization with final newline.
13. Freeze admitted marker/result values to match house record conventions.

Focused verification:

- module has no filesystem, process, clock, random, or network dependency;
- every required field is atomic;
- version and kind are literal constraints;
- extra keys are refused;
- zero is accepted for both quantities;
- unsafe integers are refused.

## Step 3 — pin the schema with the real fixture

Create `src/seam/lisa-loop-settled-core.test.ts`.

1. Read the fixture from `import.meta.dir/fixtures`.
2. Assert parsing produces the exact typed marker.
3. Assert serialization reproduces the fixture bytes.
4. Test strict builder acceptance and programmer-error rejection.
5. Table-test malformed JSON/schema values.
6. Include an extra-key refusal.
7. Include wrong version/kind refusals.
8. Include string/negative/fractional/unsafe quantity refusals.
9. Prove an attention event is ignored.
10. Prove malformed complete-event facts are refused.
11. Prove a valid absolute project root becomes its basename.
12. Prove `0` quantities survive as real values.

Run:

```bash
bun test src/seam/lisa-loop-settled-core.test.ts
```

Success criteria:

- canonical fixture passes;
- every malformed fixture returns the malformed/refused branch;
- no thrown parse error escapes the external read boundary.

## Step 4 — implement the atomic Vend-owned recorder

Create `src/seam/lisa-loop-settled.ts`.

1. Import filesystem effects only in this shell.
2. Classify the event before filesystem access.
3. Return ignored/refused data without creating `.vend`.
4. Join project root to the constant `.vend/loop-settled.json` only.
5. Create the parent directory recursively.
6. Write serialized bytes to a unique sibling temp file with exclusive creation.
7. Rename the complete temp file onto the stable marker.
8. Clean the temp path in `finally` if necessary.
9. Return the relative marker path and admitted marker.
10. Add an `import.meta.main` adapter over the four lisa environment variables.
11. Set non-zero exit only for malformed complete-event facts.
12. Keep normal execution silent.

Focused verification:

- no arbitrary path option exists;
- the only durable write target is `.vend/loop-settled.json`;
- incomplete bytes are never published at the stable name;
- an expected malformed event is data, not a filesystem exception.

## Step 5 — test the filesystem authority boundary

Create `src/seam/lisa-loop-settled.test.ts`.

1. Allocate temporary roots using `mkdtemp`.
2. Record a valid complete event.
3. Read the exact `.vend/loop-settled.json` path.
4. Validate it with the pure parser.
5. Assert `.lisa` does not exist.
6. Assert root contents show only `.vend` after a direct record.
7. Record malformed complete input and assert the root stays empty.
8. Record an attention event and assert the root stays empty.
9. Record twice and assert the second value replaces the first.
10. Assert no temporary siblings remain.
11. Clean every root in `finally`.

Run:

```bash
bun test src/seam/lisa-loop-settled.test.ts
```

Success criteria:

- valid event crosses into Vend state;
- invalid/non-complete event does not cross;
- replacement is singular and parseable;
- no test observes a `.lisa` write.

## Step 6 — extend the existing project-owned notify hook

Modify `.lisa/hooks/on-notify`.

1. Keep the shebang and executable mode.
2. Resolve `HOOK_DIR` before any early exit.
3. For `$1 = complete`, locate the recorder below `$LISA_PROJECT/src/seam/`.
4. Invoke it with Bun and `LISA_EVENT=complete`.
5. Contain any recorder exit/fault with the same non-blocking hook posture as curl.
6. Only after recording, resolve the optional ntfy topic.
7. Preserve attention rendering exactly.
8. Preserve complete push title/body/priority/tags exactly.
9. Preserve the final unconditional `exit 0`.

Add a hook integration case to `src/seam/lisa-loop-settled.test.ts`:

1. Put a fake executable `curl` first on `PATH`.
2. Set a fake topic so no local secret file is consulted.
3. Invoke the real hook with `complete` and a temporary `LISA_PROJECT`.
4. Let the hook run the real seam recorder from the repository source.
5. Assert the marker appears in the temporary project's `.vend` directory.
6. Validate the marker through the core parser.
7. Confirm the hook exits zero.

This proves the actual crossing, not only the recorder in isolation.

## Step 7 — write the durable knowledge contract

Create `docs/knowledge/lisa-loop-settled-contract.md`.

Pin:

- selected emission and source variables;
- why the completion journal is not the selected source;
- exact home and JSON fixture;
- producer and consumer;
- validation constraints;
- atomic producer lifecycle;
- consume-on-successful-settle lifecycle;
- malformed-marker refusal;
- last-unconsumed-marker replacement semantics;
- version evolution;
- vend-only write authority;
- no ntfy dependency;
- ticket boundaries and out-of-scope behavior.

Cross-check every identifier and byte shape against the exported constants and fixture.

## Step 8 — inspect and run focused verification

Run:

```bash
git diff --check -- \
  docs/knowledge/lisa-loop-settled-contract.md \
  src/seam/lisa-loop-settled-core.ts \
  src/seam/lisa-loop-settled-core.test.ts \
  src/seam/lisa-loop-settled.ts \
  src/seam/lisa-loop-settled.test.ts \
  src/seam/fixtures/lisa-loop-settled.valid.json \
  .lisa/hooks/on-notify

bun test \
  src/seam/lisa-loop-settled-core.test.ts \
  src/seam/lisa-loop-settled.test.ts
```

Inspect for:

- no `src/settle` or CLI overlap;
- no write target outside `.vend`;
- no schema duplication in shell;
- no ntfy payload drift;
- no accidental changes in Lisa-managed paths.

## Step 9 — run the repository gate

Run:

```bash
bun run check
```

Success criteria:

- BAML generation passes;
- TypeScript passes;
- complete Bun suite passes;
- no generated source remains dirty;
- ticket-owned diff remains exactly scoped.

If any check fails:

- diagnose within the owned paths first;
- record a deviation in `progress.md` before widening scope;
- do not weaken the schema or remove authority assertions to make a test green.

## Step 10 — commit the single meaningful seam unit

After the full gate is green, run:

```bash
lisa commit-ticket \
  --ticket-id T-079-03-01 \
  --message "feat(seam): record lisa loop settlement" \
  --include docs/knowledge/lisa-loop-settled-contract.md \
  --include src/seam/lisa-loop-settled-core.ts \
  --include src/seam/lisa-loop-settled-core.test.ts \
  --include src/seam/lisa-loop-settled.ts \
  --include src/seam/lisa-loop-settled.test.ts \
  --include src/seam/fixtures/lisa-loop-settled.valid.json \
  --include .lisa/hooks/on-notify
```

These paths are one meaningful unit: the documented shape, canonical fixture, validator, producer,
actual event crossing, and proof must not land independently.

## Step 11 — verify commit ownership

After the Lisa transaction:

1. Run `git status --short --branch`.
2. Confirm all seven ticket-owned paths are clean.
3. Confirm Lisa-managed dirty paths remain preserved and uncommitted by this unit.
4. Inspect `git show --stat --oneline HEAD`.
5. Inspect `git show --name-only --format= HEAD`.
6. Confirm the commit contains exactly the seven includes.
7. Re-run the focused tests if the commit hook reports any surprising rewrite.

## Step 12 — Review

Write `progress.md`, `review.md`, and the exact JSON disposition in the attempt directory.

Pass only if:

- the marker is actually produced from the existing complete hook;
- the canonical fixture validates;
- malformed markers are refused;
- the effect writes only Vend-owned state;
- focused and full gates are green;
- the source unit is committed and clean;
- all acceptance clauses are honestly met.
