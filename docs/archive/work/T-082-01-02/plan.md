# Plan — T-082-01-02 cast-settle-cap-detection

## Goal

Make explicit terminal executor cap evidence durable on the existing cast settlement row while
leaving ordinary terminal failures byte-compatible and keeping all classification pure,
conservative, settle-only, and executor-neutral.

## Preconditions

- Parent story `S-082-01` and ticket `T-082-01-02` have been read.
- Prerequisite `T-082-01-01` is complete and `CapWindowExhausted` is available.
- Baseline focused suites are green: 96 pass, 0 fail.
- Work artifacts are written only in the private attempt directory.
- Existing Lisa-managed worktree changes are unrelated and must remain untouched.
- Source commit must use `lisa commit-ticket` with exact paths.

## Step 1 — Add pure classifier tests first

Modify `src/engine/cast-core.test.ts`.

1. Import `classifyCapWindowExhaustion` from `./cast-core.ts`.
2. Add a focused describe block for terminal executor cap evidence.
3. Pin the exact `http-429` marker for numeric status evidence.
4. Pin the same marker for explicit HTTP-429 diagnostic text.
5. Pin the exact `rate-limit` marker for textual/typed rate-limit evidence.
6. Prove HTTP 429 wins when both evidence classes exist.
7. Prove a generic terminal failure returns `undefined`.
8. Prove `error_max_turns` returns `undefined`.
9. Prove a successful result mentioning 429 returns `undefined`.
10. Prove null/malformed optional diagnostic data is total and returns `undefined`.

Verification after edit:

```bash
bun test src/engine/cast-core.test.ts
```

Expected before implementation: new tests fail because the export does not exist.

## Step 2 — Implement the pure classifier

Modify `src/engine/cast-core.ts`.

1. Add type-only imports for `ResultMessage` and `CapWindowExhausted`.
2. Define stable marker constants.
3. Reuse the existing `isRecord` structural predicate.
4. Add safe named-field access for open external records.
5. Add the failure-shaped terminal guard.
6. Add precise structured 429 detection.
7. Add bounded diagnostic-string extraction.
8. Add explicit HTTP-429 and rate-limit text matchers.
9. Export `classifyCapWindowExhaustion(result)`.
10. Keep HTTP evidence ahead of broader textual evidence.
11. Return fresh complete marker values or `undefined` only.

Verification:

```bash
bun test src/engine/cast-core.test.ts
bun run build
```

Acceptance at this checkpoint:

- helper is pure and total;
- controlled marker strings are exact;
- healthy/success/max-turn controls remain unmarked;
- typecheck sees no runtime dependency or open-record access error.

## Step 3 — Add branch-level acceptance tests

Modify `src/engine/cast.test.ts`.

1. Add a deterministic terminal-failure stub or inline fixture.
2. Use known executor id `claude` for lane provenance.
3. Add the 429/rate-limit fixture cast.
4. Assert exactly one physical non-empty `runs.jsonl` line.
5. Assert `seatOfExecution: "claude"`.
6. Assert exact complete `capWindowExhausted` payload.
7. Assert raw key adjacency/order around seat and marker.
8. Assert `reviveRecord` preserves the marker.
9. Add the non-rate terminal-failure control.
10. Assert exactly one row and complete marker absence.
11. Construct the full expected existing row with actual timestamps.
12. Assert the entire raw JSONL file is byte-identical to that manual expected line.

Verification before shell wiring:

```bash
bun test src/engine/cast.test.ts
```

Expected state: the ordinary control passes; marked fixture fails because `cast.ts` has not yet
threaded the pure result into the ledger.

## Step 4 — Wire classification into terminal settlement

Modify `src/engine/cast.ts`.

1. Import `classifyCapWindowExhaustion` from `cast-core.ts`.
2. Derive `capWindowExhausted` once from the terminal `result` after dispense.
3. Do not inspect or react to stream `rate_limit_event` messages.
4. Do not alter `timedOut`, budget, gate, effect, outcome, or exception paths.
5. Add the optional marker spread immediately after `seatOfExecution` in the final append.
6. Document settle-only one-way evidence in a concise comment.
7. Ensure absence contributes no key.

Verification:

```bash
bun test src/engine/cast-core.test.ts src/engine/cast.test.ts
bun run build
```

Expected result:

- all focused pure branches pass;
- marked cast writes one complete marker beside the seat;
- ordinary failure control matches exact old bytes;
- all prior cast behavior remains green.

## Step 5 — Inspect the diff and scope

Run read-only checks:

```bash
git diff -- src/engine/cast-core.ts src/engine/cast-core.test.ts src/engine/cast.ts src/engine/cast.test.ts
git status --short
```

Review for:

- only four ticket-owned source paths changed;
- no ordinary index entries;
- no run-log schema edits;
- no executor implementation edits;
- no live-stream classification;
- no new outcome;
- no raw error prose persisted;
- no effect/outcome/rethrow behavior change;
- unrelated Lisa-managed files preserved.

If implementation must deviate from Design, record the deviation and rationale in `progress.md`
before proceeding.

## Step 6 — Run complete verification

Run the required gate:

```bash
bun run check
```

The gate must prove:

- BAML generation succeeds;
- TypeScript compilation succeeds;
- the full repository test suite succeeds;
- existing run-log and cast suites remain green;
- no downstream consumer rejects the additive marker wiring.

No commit occurs on a red gate. Diagnose and fix only ticket-owned failures; do not absorb unrelated
worktree changes.

## Step 7 — Write implementation progress

Create/update private `progress.md` with:

- each completed step;
- files changed;
- exact focused test counts;
- exact full gate result;
- scope/diff review result;
- any deviations or explicit statement of none;
- intended exact commit paths.

The artifact remains private to the attempt and is not passed to the source commit.

## Step 8 — Commit the source unit through Lisa

First inspect the local CLI syntax:

```bash
lisa commit-ticket --help
```

Then commit exactly the four ticket-owned paths, using the actual supported option spelling:

```bash
lisa commit-ticket \
  --ticket-id T-082-01-02 \
  --message "feat(cast): record cap-window exhaustion (T-082-01-02)" \
  --include src/engine/cast-core.ts \
  --include src/engine/cast-core.test.ts \
  --include src/engine/cast.ts \
  --include src/engine/cast.test.ts
```

Do not use `git add`, `git add -A`, `git commit`, force-add, or a broad include.

Post-commit checks:

```bash
git status --short
git show --stat --oneline HEAD
git diff --cached --name-only
```

Ticket-owned source paths must be clean and unstaged. Lisa-managed unrelated paths may remain.

## Step 9 — Review and disposition

Create private `review.md` covering:

- outcome and acceptance judgment;
- exact source changes;
- pure classifier semantics and false-positive controls;
- cast fixture proof and byte-compatibility proof;
- focused and full test results;
- commit identity and exact path list;
- scope exclusions;
- limitations/open concerns;
- worktree/artifact integrity.

Write exactly one disposition JSON object:

```json
{"disposition":"pass","reason":null}
```

only if acceptance is fully met, `bun run check` is green, source is committed through Lisa, and
ticket-owned paths are clean. Otherwise write a blocking disposition with a non-empty actionable
reason.

## Verification matrix

| Requirement | Direct proof |
|---|---|
| failure-shaped HTTP 429 classified | pure unit tests |
| textual rate-limit classified | pure unit tests |
| healthy/success/max-turn not classified | pure negative tests |
| complete marker and stable vocabulary | exact object assertions |
| exactly one JSONL record | cast fixture physical-line assertion |
| marker alongside seat | raw row/order + parsed assertions |
| revived marker complete | `reviveRecord` assertion |
| non-rate failure has no marker | raw + revived negative assertions |
| non-rate row unchanged | whole-file manual expected byte comparison |
| settle-only, no interception | diff inspection; unchanged `onMessage` |
| no broader behavior regression | focused cast suite + `bun run check` |

## Stop conditions

- Stop and block if a complete marker cannot be written without changing the run-log schema.
- Stop and block if the acceptance fixture requires a live provider burn.
- Stop and block if `bun run check` remains red for a ticket-owned cause.
- Stop and block if `lisa commit-ticket` cannot create a scoped commit without touching unrelated
  files.
- Otherwise complete Review and remain on this ticket for Lisa's completion confirmation.
