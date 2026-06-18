# Plan — T-001-04 countable-run-log

Ordered, independently verifiable steps. Each is small enough to commit atomically.
The testing strategy and the per-step verification gate are stated up front.

## Testing strategy

- **Pure functions (`buildRunRecord`, `serializeRunRecord`) — unit-tested to the
  branch** in `run-log.test.ts`, fabricated inputs only, no fs (the `budget.test.ts`
  model). This file is the `check:test` gate for the ticket.
- **`appendRunLog` — not unit-tested.** It is the thin impure fs verb; all its
  logic lives in the two pure functions it composes (the `dispense` rule from
  `claude.ts`). Writing to disk in a unit test would only exercise `node:fs`, not
  our code. This exclusion is deliberate and recorded in Review.
- **Gate for every step:** `bun run check` (= `tsc --noEmit` then `bun test`) must
  be green. Strict TS + `noUncheckedIndexedAccess` + `verbatimModuleSyntax` are on,
  so type-only symbols use `import type` and any indexed access is guarded.

## Acceptance-criteria → step traceability

- AC #1 (record fields + configurable path) → Steps 2, 4
- AC #2 (append-only, one line/run, failed run still logs) → Steps 3, 4, 5
- AC #3 (pure construction tested, append is thin fs call) → Steps 2–6
- AC #4 (no seam/budget dependency) → Step 2 (local structural types), Step 7 check

## Steps

### Step 1 — Clear the placeholder
Delete `src/log/.gitkeep`. Verify `src/log/` is otherwise empty.
*Gate:* tree clean; nothing imports the gitkeep (it is inert).

### Step 2 — Types, constants, and pure helpers (`run-log.ts` §1–§3)
Write the module header comment, then `DEFAULT_RUN_LOG_PATH`, `RUN_OUTCOMES`,
`RUN_LOG_SCHEMA_VERSION`, all the exported types (`RunOutcome`, `UsageInput`,
`NormalizedUsage`, `GateResult`, `RunRecordInput`, `RunRecord`,
`AppendRunLogOptions`), and the non-exported helpers `num`, `assertNonEmpty`,
`assertOutcome`, `normalizeUsage`, `normalizeGates`. No imports from sibling
modules — the decoupling lands here.
*Gate:* `tsc --noEmit` green; `grep` for `executor`/`budget` imports returns
nothing.

### Step 3 — Pure builder + serializer (`run-log.ts` §4)
`buildRunRecord`: validate (4 string fields + 2 timestamps non-empty, outcome in
`RUN_OUTCOMES`), normalize usage/cost/gates, stamp `v`, `Object.freeze` the record.
`serializeRunRecord`: `JSON.stringify(record) + "\n"`.
*Gate:* `tsc --noEmit` green (tests arrive in Step 6, but the surface compiles).

### Step 4 — The thin impure append (`run-log.ts` §5)
`appendRunLog(input, opts)`: resolve path (default `.vend/runs.jsonl`), compose
`serializeRunRecord(buildRunRecord(input))`, `mkdir(dirname(path),
{recursive:true})`, `appendFile(path, line, "utf8")`. Add the two `node:` imports.
*Gate:* `tsc --noEmit` green.

### Step 5 — Verify the failure path needs no special handling
Confirm by inspection: `appendRunLog` branches on nothing — `outcome` is a passed
field, so the `gate-failed`/`timed-out`/`budget-exhausted` paths call the exact
same function as `success`. AC #2's "a failed run still writes a record" is
structural, not a code branch. (No code change; a checkpoint that the design held.)
*Gate:* a test in Step 6 asserts each `RUN_OUTCOMES` member builds a valid record.

### Step 6 — Unit tests (`run-log.test.ts`)
Implement the coverage map from Structure §test: happy path, normalization
(missing/partial/non-finite usage, absent cost/gates), validation throws (empty
strings, bad outcome), immutability (frozen), `test.each(RUN_OUTCOMES)`, and the
serialization countability contract (single trailing `\n`, no interior `\n`,
`JSON.parse` round-trip, embedded-newline-stays-one-line). Fabricated inputs only.
*Gate:* `bun test` — all green; every pure function and branch covered.

### Step 7 — Full gate + decoupling audit
Run `bun run check` (typecheck + full suite, including the prior modules' tests).
Re-confirm `run-log.ts` imports only `node:fs/promises`, `node:path` (and
`run-log.test.ts` only `bun:test` + `./run-log.ts`). No import from
`src/executor/` or `src/budget/`.
*Gate:* `bun run check` green end-to-end; decoupling grep clean.

## Commit boundaries

Steps 2–4 form the module and Step 6 its test; they are mutually dependent for a
green gate, so the natural atomic unit is **one commit: "T-001-04 implement
countable run-log (pure build/serialize + thin append) with unit tests"** once
Step 7 is green. Step 1 (gitkeep delete) folds into the same commit. Per CLAUDE.md
and the prior tickets' practice, the agent leaves files staged/untracked and
**Lisa owns the git commit** — the Implement phase ends at a green `bun run check`,
not at a `git commit`.

## Risks & mitigations

- **R: a string field with an embedded newline could split a record across lines.**
  Mitigation: `JSON.stringify` escapes `\n`; pinned by an explicit serialization
  test (Step 6).
- **R: `verbatimModuleSyntax` rejects value/type import mixing.** Mitigation:
  `node:fs/promises` imports are values (`appendFile`, `mkdir`); no type-only
  symbol is imported as a value. Verified by `tsc`.
- **R: scope creep toward a reader/query API.** Mitigation: Design fixed it out of
  scope; this plan adds no read path.
