# T-073-02-02 — Research

## Assignment and workflow constraints

- The ticket starts in `phase: research` and all six RDSPI phases must run continuously.
- Attempt artifacts belong only in `.lisa/attempts/T-073-02-02/1/work/`.
- Lisa owns ticket phase/status transitions and later publication into `docs/active/work/`.
- Ticket-owned source must be committed only with `lisa commit-ticket` and exact include paths.
- The existing modified ticket and `.lisa/provenance.jsonl` are Lisa-managed concurrent state.
- The repository gate is `bun run check`: BAML generation, TypeScript, and all Bun tests.

## Product and story contract

- Vend makes reusable agent work dependable through enforceable gates.
- P3 says gates are the contract; failed review evidence must prevent a clear settlement.
- P4 says autonomy is the default; the proof must not add a human approval interaction.
- Story `S-073-02` owns run-level enforcement of a cross-vendor verdict.
- A FAIL must settle as `gate-failed` with the cross-review verdict on the ledger record.
- A PASS must settle as success with its passing verdict attached.
- The story explicitly accepts fixture proof using primed pass/fail stub executors.
- A live second-vendor endpoint remains deferred and metered.
- Per-playbook review rubric authoring and new executors are out of this slice.

## Dependency state

- `T-073-02-01` is complete at the current HEAD.
- Its source commit is `8dde3c0 feat(engine): enforce cross-review settlement gate`.
- Its completion publication commit is `6e5e4fc Complete T-073-02-01`.
- The dependency added the pure settlement decision and focused cast integration coverage.
- This ticket therefore owns demonstration coverage, not another production-policy change.

## Cast pipeline

- `src/engine/cast.ts` contains the impure, play-generic `castPlay` shell.
- `CastOptions.executor` injects the authoring executor instance.
- `CastOptions.crossReviewRegistry` injects the configured executor capability set.
- `resolveSeatOfExecution` maps the injected executor id onto a known seat.
- The play output is parsed and its authored gates execute before any effect.
- `classify` authorizes the effect only when the ordinary gates clear.
- A successful effect reports the concrete artifact paths it wrote.
- `captureEffectDiff` asks Git for the patch over exactly those artifacts.
- A non-empty patch is stored under `.vend/artifacts/<run-id>.diff`.
- Only a landed, gated cast with a patch and known authoring seat can be cross-reviewed.
- `resolveComplementExecutor` selects the sole configured seat other than the author.
- `dispenseReviewVerdict` sends one context-complete prompt to that complement.
- The review prompt includes authored play/gate context and the captured patch bytes.
- The reviewer is capped at one turn and must return strict pass/fail JSON.
- The returned verdict carries the resolved reviewing-seat provenance.
- `settleCrossReview` appends a `cross-vendor-review` gate row.
- A failed review changes the final run outcome to `gate-failed`.
- A passing review preserves the prior outcome.
- The final append writes exactly one durable JSONL record per cast.

## Settlement semantics

- Cross-review happens after the effect because a concrete landed patch is the review input.
- Consequently `RunSummary.materialized` remains an honest physical fact on refusal.
- “Blocked/no clear” is represented by final outcome `gate-failed`, not by rewriting history.
- The failing ledger line carries both the ordinary passing gate and failed review gate.
- The passing ledger line carries both passing rows.
- The atomic `crossVendorVerdict` records authoring seat, reviewing seat, verdict, and detail.
- Absence of a complement or diff leaves cross-review inert.
- This ticket need not alter those semantics; it must demonstrate them together.

## Existing focused coverage

- `src/engine/cast-core.test.ts` pins `settleCrossReview` as pure policy.
- `src/engine/cast.test.ts` has separate fail, pass, and single-seat integration cases.
- The fail case asserts a `gate-failed` summary and refusing ledger verdict.
- The pass case asserts success and a passing ledger verdict.
- Those cases were added by the enforcement dependency and test each branch separately.
- `src/cross-review/review.test.ts` pins strict reply parsing and one-turn dispense behavior.
- `src/log/run-log.test.ts` pins verdict normalization, omission, serialization, and revival.
- `src/engine/cast-diff.ts` is indirectly exercised by cast integration tests.

## Relevant fixture patterns

- Cast tests create temporary directories and remove them in `afterEach`.
- A local Git repository is initialized with an empty baseline commit.
- Git identity is supplied per command, avoiding global developer configuration.
- `BIG_BUDGET` prevents budget exhaustion from obscuring the gate outcome.
- Stub executors implement the production `Executor` interface and return `ResultMessage`.
- Stub review registries use executor ids `claude` and `openai-compat`.
- Those ids resolve to execution seats `claude` and `codex`, respectively.
- File-writing fixture plays report absolute artifact paths from their effects.
- Ledger assertions parse the actual JSONL file rather than only inspecting summaries.

## Demonstration boundary

- A distinct end-to-end test can run bad and good casts in one scenario.
- It can use one temporary Git project and one ledger to show the contrasting lines together.
- The authoring executor can return a small parsed fixture describing bad versus good content.
- The effect can write that content to a reported artifact so Git creates a real patch.
- A queued/primed complement stub can return FAIL for the bad cast and PASS for the good cast.
- Recording its calls proves both captured diffs reached the complement seat.
- The production reviewer parser and settlement code remain in the path.
- No BAML addon, network access, token spend, real vendor endpoint, or human input is needed.

## Constraints and assumptions

- “Intentionally bad” should be visible in the actual captured patch, not only a fixture name.
- “Good” should likewise have recognizable passing evidence in its patch.
- The stub is explicitly primed; it is not claimed to make a semantic model judgment.
- The test should assert ledger cardinality so one cast cannot silently append twice.
- The test should assert ordered run ids/outcomes to connect each line to its cast.
- It should assert both verdict payloads and both review gate rows.
- It should assert the authoring/reviewing seats to prove complement routing.
- It should make the lack of human approval observable through a fully awaited autonomous call.
- No production source change is indicated by the current code or acceptance contract.

## Files likely involved

- New: a dedicated end-to-end test under `src/engine/`.
- Read-only: `src/engine/cast.ts`, `src/engine/cast-core.ts`, `src/engine/cast-diff.ts`.
- Read-only: `src/cross-review/review.ts`, `src/cross-review/resolve-complement.ts`.
- Read-only: `src/log/run-log.ts`, `src/executor/executor.ts`, `src/engine/play.ts`.
- Private attempt artifacts: research, design, structure, plan, progress, and review Markdown.
