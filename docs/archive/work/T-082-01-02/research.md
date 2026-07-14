# Research — T-082-01-02 cast-settle-cap-detection

## Assignment and phase constraints

- The ticket is `T-082-01-02`, generation 1, and begins in Research.
- The parent story is `S-082-01` and was read before the ticket.
- Attempt artifacts belong only under `.lisa/attempts/T-082-01-02/1/work/`.
- Lisa owns publication to `docs/active/work/T-082-01-02/` and ticket frontmatter transitions.
- Ticket-owned source commits must use `lisa commit-ticket` with exact repository-relative paths.
- The complete repository gate is `bun run check` on Bun 1.3.13.
- Existing Lisa-managed worktree changes are present in `.lisa/provenance.jsonl` and ticket files;
  they are not ticket-owned source and must be preserved.

## Contract from the story and ticket

- The story slice covers only the cast settlement shell and its pure classification helpers.
- The prerequisite ledger schema work in `T-082-01-01` is complete.
- A rate-limit-shaped executor failure must produce exactly one `runs.jsonl` row.
- That row must carry a complete cap marker beside `seatOfExecution`.
- A non-rate-limit failure must carry no cap marker and retain the existing record shape.
- The proof is fixture-based through an injected stub executor; no live provider call is wanted.
- Classification happens only at settlement.
- Mid-run interception, retry, rerouting, quota fetching, lane heat, wallet, and budget changes are
  explicitly outside the slice.
- `RUN_OUTCOMES` has no rate-limit-specific outcome and the epic does not request one.

## Charter and vision constraints

- P7 treats budget as a hard contract; cap evidence makes the provider window exhaustion countable.
- P4 removes the need for an operator to watch failures and annotate the ledger manually.
- N4 keeps Vend as orchestrator rather than executor; observing terminal evidence is in scope,
  controlling or rerouting a live executor is not.
- The local-first principle rules out provider quota queries for this classification.
- Executor neutrality requires classification over the open executor seam rather than Claude-only
  classes or imports.
- Gates and durable evidence are the consistency contract, so a marker must be conservative and
  auditable rather than inferred from weak ambient signals.

## Existing ledger marker contract

- `src/log/run-log.ts` exports `CapWindowExhausted`.
- Its complete shape is `{ signal: string, reason: string }`.
- `RunRecordInput` and `RunRecord` expose optional `capWindowExhausted` fields.
- The write boundary normalizes the two strings atomically.
- The read boundary applies the same normalization.
- Partial, empty, malformed, or non-object marker values are omitted without losing the row.
- A valid nested marker is rebuilt from only `signal` and `reason` in deterministic order.
- The marker is serialized immediately after `seatOfExecution`.
- Absence is represented by omission, never `null`, `false`, or an empty object.
- The schema version remains 1 because the marker is an additive optional fact.
- The ledger deliberately does not classify executor failures or import executor policy.
- The containing row already supplies the lane (`seatOfExecution`), burn (`usage`), model, and
  settlement time (`endedAt`), so the marker need not duplicate those facts.

## Cast module boundaries

- `src/engine/cast.ts` is the impure orchestrator.
- It selects and probes an executor, creates the transcript, dispenses, meters, parses, gates,
  effects, settles, appends one ledger record, and returns or rethrows.
- `src/engine/cast-core.ts` contains pure decisions and takes only plain values.
- `src/engine/cast-core.test.ts` tests that pure core without filesystem, process, network, or BAML.
- `src/engine/cast.test.ts` injects stub executors into `castPlay` and inspects real temporary JSONL
  files, making it the branch-level acceptance location named by the ticket.
- `cast.ts` already type-imports ledger marker types and value-imports pure helpers from
  `cast-core.ts`; adding an engine-core classifier does not reverse the dependency graph.

## Executor seam behavior

- `src/executor/executor.ts` defines the executor-neutral `Executor` interface.
- `Executor.dispense` returns an open `ResultMessage` or rejects.
- `ExecutorTimeoutError` is the only typed operational failure that `castPlay` currently handles
  as a non-throwing terminal outcome.
- The executor contract permits open external records and does not define a rate-limit error class.
- `ResultMessage` has a required string `subtype` plus open additional fields.
- The Claude adapter returns terminal `result` messages for every subtype, including error
  subtypes, and throws only when no terminal result exists or the child/timeout path fails.
- The OpenAI-compatible adapter throws a plain `Error` for non-OK HTTP statuses.
- Its HTTP error message includes `HTTP <status>` and response text, so HTTP 429 evidence currently
  reaches `castPlay` as an ordinary rejection rather than a typed error.
- Injected stub executors can represent either terminal error messages or thrown operational
  failures without spending tokens.

## Current dispense and settlement flow

- `castPlay` resolves `seatOfExecution` before `probe` and `dispense`.
- Known executor id `claude` maps to seat `claude`.
- Known executor id `openai-compat` maps to seat `codex`.
- Unknown injected executor ids intentionally produce no seat marker.
- The dispense catch sets `timedOut` only for `ExecutorTimeoutError`.
- Every other rejection is immediately rethrown from the catch.
- That immediate rethrow occurs before parsing, classification, and the terminal append.
- Timeout proceeds through the ordinary classifier and terminal settlement append.
- `classify` currently prioritizes failed probe, timeout, gate stop, budget exhaustion, then success.
- There is no executor-failure input to `classify` today.
- A terminal error subtype is currently still treated as a returned result: it can be metered,
  parsed, gated, and even materialized depending on the play.
- Later settlement work is protected by a `try/catch/finally`.
- A settlement exception changes the row outcome to `errored`, appends in `finally`, then rethrows
  the original value after the append.
- The final append already conditionally spreads one-way facts such as `seatOfExecution`,
  `overEnvelope`, `seatDefaulted`, and `seatInferred`.
- The final append is the appropriate durable row boundary; there is no need for another append.

## Error visibility elsewhere

- Graph orchestration already converts a thrown cast into an `errored` node summary.
- This means preserving the throw after durable settlement maintains upstream control flow.
- `RunOutcome` already includes `errored`, so no new outcome vocabulary is needed.
- The cast settlement test proves that an unexpected post-effect settlement throw writes an
  `errored` row before rethrowing.
- Ordinary pre-settlement dispense failures currently retain their thrown behavior but do not get
  the same ledger protection.
- The ticket describes cap exhaustion as an “invisible errored run,” consistent with preserving
  the error while making its durable row visible.

## Available external evidence shapes

- OpenAI-compatible HTTP failures expose a message such as `... failed: HTTP 429 ...`.
- Generic SDK-style errors commonly expose numeric `status` or `statusCode` fields, a string or
  numeric `code`, a name, and a message, but the Vend seam does not standardize them.
- Claude stream transcripts contain `rate_limit_event` messages with nested `rate_limit_info`.
- Repository-local captured transcripts show many normal events with `status: "allowed"`.
- They also show `allowed_warning`, which is approaching a limit rather than exhaustion.
- Some normal events contain an overage status of `rejected` while the primary status is still
  `allowed`; that nested value alone is therefore not proof that the cast was denied.
- Consequently, the mere presence of `rate_limit_event`, a warning status, or an overage rejection
  cannot honestly mark a completed window exhaustion.
- The acceptance criterion names a failing executor, so successful stream telemetry is not needed
  to satisfy the ticket.

## Existing test patterns

- `stubExecutor` is the shared successful fixture in `src/engine/cast.test.ts`.
- Tests use `tmp()` and an explicit `runLogPath`, then split the JSONL file and parse its one row.
- Known-lane stubs use id `claude` to prove `seatOfExecution` propagation.
- The timeout fixture injects a rejecting executor and proves one `timed-out` row.
- Settlement-error fixtures assert rejection and then inspect the preserved `errored` row.
- `buildRunRecord`, `serializeRunRecord`, and `reviveRecord` are imported in the cast suite, so an
  unmarked row can be compared against canonical serialization rather than only checking absence.
- `cast-core.test.ts` groups pure behavior by named helper and asserts total handling of malformed
  external shapes in other classifiers/normalizers.

## Baseline verification

- `bun test src/engine/cast-core.test.ts src/engine/cast.test.ts` is green before changes.
- Baseline result: 96 pass, 0 fail, 451 assertions across the two files.
- Existing success, timeout, cross-review, transcript, provenance, turn-count, and lane-heat cast
  proofs all pass.

## Constraints surfaced by the map

- The classifier must be total over `unknown`; executor failures are external data.
- It must not read stacks, environment, files, clocks, or provider APIs.
- Marker strings should be stable engine-owned vocabulary, not raw provider prose.
- Classification should be conservative because false cap evidence will feed future capacity
  learning as if it were a hard observed boundary.
- A non-cap failure must not gain a placeholder key or altered nested marker shape.
- Exactly one append must occur on the executor-failure path.
- The original rejection must remain observable after the ledger append so graph and CLI behavior
  do not silently convert operational failures into successful summaries.
- Timeout remains its existing typed branch and must not be relabeled as cap exhaustion merely
  because its message happens to mention limits.
- Existing successful `rate_limit_event` telemetry must remain inert.
- No changes are indicated in run-log schema, executor implementations, lane heat, budgets,
  wallets, dispatch, or historical records.
