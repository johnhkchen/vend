# Research — T-079-01-02

## Assignment and workflow

- Ticket: `T-079-01-02` — `settle-verb-one-screen-free`.
- Parent story: `S-079-01` — `settle-verdict-is-free`.
- The ticket begins in `phase: research`.
- The assignment requires one continuous RDSPI pass through Review.
- Attempt artifacts belong under `.lisa/attempts/T-079-01-02/1/work/`.
- Lisa publishes admitted artifacts to `docs/active/work/T-079-01-02/`.
- Ticket phase and status frontmatter are Lisa-owned and must not be edited by this worker.
- Source commits must use `lisa commit-ticket` with exact repository-relative includes.
- Ordinary `git add` and `git commit` are prohibited for ticket work.
- The shared worktree contains concurrent T-079-03/Lisa changes.
- Those existing paths are unrelated and must be preserved and excluded from commits.

## Product and story contract

- The operator currently commissions a status inspection by hand after a loop.
- This ticket turns that inspection into the typed gesture `vend settle`.
- The verb is free: it spends no tokens and invokes no executor.
- It reads the canonical board, repository gate, presweep state, and work review artifacts.
- It prints one deterministic terminal verdict and exits.
- It reports the board delta since the previous settle.
- It reports cleared counts for each epic.
- It reports the gate result and presweep result.
- It names open review concerns.
- Every exception must be red and carry an exact next action.
- It advances a durable last-settle marker after producing a valid verdict.
- An immediate repeat must therefore report an empty delta.
- `.vend/runs.jsonl` must remain untouched.
- Event-triggering belongs to S-079-03, not this ticket.
- Sweep/closeout mutation belongs to S-079-02, not this ticket.
- A TUI or standing dashboard is explicitly out of scope.

## Charter grounding

- P2 is advanced by making the inspection a direct typed gesture without a budget negotiation.
- P3 is advanced by presenting current gate state as part of the operator contract.
- P4 is advanced by removing a human relay/inspection step.
- P5 is preserved because all state and computation remain local.
- P6 is preserved because settle never selects or invokes an executor.
- P7 is not engaged because no budgeted work is dispatched.
- N2 constrains settle to print-and-exit rather than become a monitoring surface.
- The command assembles machine-known facts; it introduces no new quality judgment.

## Dependency contract: settle core

- T-079-01-01 is committed at HEAD and complete.
- `src/settle/settle-core.ts` is the authoritative pure computation.
- `computeSettleVerdict` accepts one loaded `WorkGraph` and observed facts.
- It returns either a complete `SettleVerdict` or a named `SettleRefusal`.
- `SettleVerdict.delta.firstSettle` distinguishes first observation from repeats.
- `SettleVerdict.delta.newlyDoneTicketIds` is the stable delta line source.
- `SettleVerdict.epics` supplies id, title, cleared/total, ids, and `allDone`.
- `SettleVerdict.gate` carries a settle-owned gate summary.
- `SettleVerdict.presweep` preserves canonical `SweepVerdict` facts.
- `SettleVerdict.reviewConcerns` contains structured named concerns.
- `SettleVerdict.exceptions` is already ordered gate, presweep, review.
- Every exception already has a nonblank `nextAction`.
- `SettleVerdict.nextMarker` is the only continuation the shell should persist.
- `LAST_SETTLE_MARKER_PATH` is `.vend/last-settle.json`.
- `serializeLastSettleMarker` produces canonical versioned JSON bytes.
- A malformed marker returns `malformed-last-settle-marker` refusal data.
- The shell must not reinterpret exception policy or marker validity.

## Canonical graph loading

- `src/graph/load.ts` is the existing filesystem graph shell.
- `loadWorkGraph({ root })` reads `docs/active/{epic,stories,tickets}`.
- Missing board directories degrade to empty node lists.
- Valid frontmatter is coerced and linked by `src/graph/model.ts`.
- Parse and integrity defects throw named graph errors.
- The graph arrays are deterministic and deeply frozen.
- Ticket `phase === "done"` is the completion authority.
- The settle shell should reuse this loader without duplicating YAML parsing.
- The board loader is read-only and does not expose a write path.

## Gate source

- The story explicitly leaves gate sourcing to this ticket's Design phase.
- The epic names the existing `bun run check` gate as source machinery.
- `package.json` defines `check` as BAML generation, typecheck, then full tests.
- No current `.vend` file records a durable repository-gate result.
- Run-log gate rows are cast-local and not a current repository verdict.
- Review markdown often mentions a gate result, but prose is not authoritative or current.
- Reading an old artifact would claim freshness the data cannot prove.
- Running `bun run check` provides current repository truth without tokens.
- The command can suppress the gate's multiline stdout/stderr and summarize it into one line.
- Bun test output commonly contains a `<n> pass` count that can enrich a green detail.
- A green result without a parseable count can still honestly say `bun run check passed`.
- A red result must include a stable exact rerun/repair action.
- Gate failure is verdict data, not a reason to invoke an executor.

## Presweep source

- `src/ci/presweep-core.ts` is the canonical pure `done => committed` judge.
- `donePhaseIds` derives sorted phase-done ticket ids.
- `classifySweep` consumes those ids plus Git porcelain text.
- `SWEEP_PREFIXES` includes source paths and `docs/active/`.
- `.vend/` is deliberately outside presweep scope.
- Therefore advancing `.vend/last-settle.json` will not make an immediate repeat fail presweep.
- `src/ci/check-presweep.ts` is a CLI shell over the same core.
- Settle can reuse the core directly after one `git status --porcelain` call.
- This avoids reparsing a subprocess's human text.
- A failed presweep names concrete offender paths and does not prevent verdict construction.

## Work review artifacts

- Current Lisa attempts publish `review-disposition.json` beside `review.md`.
- Its stable contract is either pass/null or block/nonblank reason.
- `review.md` has no machine-stable concern schema.
- Headings vary (`Open concerns`, `Known limitations`, `Handoff`, and variants).
- Bullet prose often describes nonblocking limitations even when disposition is pass.
- Treating every Markdown bullet as an exception would add new judgment and many false positives.
- A blocked disposition is an unambiguous open review concern.
- Its ticket directory supplies the stable ticket id.
- Its nonblank reason supplies the operator-facing concern name.
- Its exact next action can name the disposition path and required resolution.
- Missing disposition files are common for legacy work and cannot automatically mean blocked.
- Malformed present disposition files must not silently look like a pass.
- The shell can map malformed present files into named concerns with a repair action.
- Filesystem enumeration must be sorted before facts reach the core.

## CLI parser and dispatch

- `src/cli.ts` owns the command union, literal verb list, help inventory, parser table, and shell.
- Free no-argument verbs use dedicated parsers (`doctor`, `shelf`, `user-guide`).
- A settle parser should accept only the bare verb.
- Any positional or flag after `settle`, including `--budget`, should return usage.
- `COMMAND_VERBS` drives typo suggestions and must include the new stable spelling.
- `USAGE` groups every real command as free or metered.
- The inventory test currently expects 17 canonical entries and will need 18.
- Dispatch arms use lazy imports to keep unrelated executor/BAML graphs off cheap parse paths.
- The settle arm should lazily import only the settle shell.
- The final generic run dispatch is the only executor-bearing fallback.
- A dedicated settle arm before that fallback structurally avoids `runPlay`.

## Terminal rendering

- The core deliberately does not own terminal color or presentation.
- The shell needs a deterministic pure formatter over `SettleResult`.
- One-screen means concise lines, not interactive state or pagination.
- Required lines are delta, per-epic clearance, gate, presweep, review concerns, exceptions.
- ANSI SGR red is the existing terminal-portable way to make exceptions red.
- Color should wrap the complete exception line and reset immediately.
- Exact next actions should be printed verbatim from core exception data.
- Normal partial epics are status, not red exceptions.
- Empty review concerns and empty exceptions should be explicit rather than omitted.
- A malformed marker refusal should name its reason and exact repair action.

## Marker persistence

- The core supplies canonical marker bytes but performs no filesystem I/O.
- The shell must read absence as `null` and propagate other read failures.
- The final marker belongs under the supplied/root cwd, not the source repo.
- The parent `.vend` directory may not exist on a first settle.
- Existing code uses write-temporary then rename for atomic local publication.
- `src/engine/cast-diff.ts` and the concurrent seam use this pattern.
- Atomic replacement prevents a partial marker from poisoning the next settle.
- The marker should advance only after a valid verdict is fully computed.
- A malformed-marker refusal must leave the malformed bytes untouched.
- Gate/presweep/review exceptions are still a valid observed verdict and may advance the marker.
- The marker write is the only intended mutation.

## Acceptance-test shape

- `src/cli.test.ts` already contains subprocess tests for free commands.
- Tests create isolated temporary roots and execute the absolute source CLI path.
- A fixture board can contain one epic, one story, and done/active tickets.
- The fixture needs a local `package.json` with a harmless deterministic `check` script.
- It needs a Git repository and committed source/board state for green presweep.
- A blocked review disposition can prove concern naming and red exception rendering.
- A sentinel `CLAUDE_CLI` can prove no executor invocation.
- Absence of `.vend/runs.jsonl` before and after proves no run-log touch.
- Reading the marker after the first invocation proves advancement.
- A second invocation proves empty delta behavior.
- Parser tests must prove bare settle succeeds and `--budget` is rejected.

## Scope and likely files

- Create `src/settle/settle.ts` for effect assembly and pure formatting helpers.
- Create `src/settle/settle.test.ts` for focused formatter/artifact behavior.
- Modify `src/cli.ts` for parse/help/dispatch wiring.
- Modify `src/cli.test.ts` for parser and subprocess acceptance coverage.
- Do not modify `settle-core.ts`; its contract is already committed.
- Do not modify graph, presweep, executor, run-log, or play modules.
- Do not write to shared `docs/active/work/T-079-01-02/`.

## Verification constraints

- Focused tests should cover `src/settle` and the relevant CLI test block.
- `bun run check:typecheck` must validate the new effect interfaces.
- `bun run check` is the mandatory completion gate.
- `git diff --check` should remain clean.
- Concurrent unrelated work may keep the overall worktree dirty.
- Exact-path diffs and status are the ticket-local cleanliness proof.
- Commit only the four planned source/test paths through `lisa commit-ticket`.

## Research conclusion

- Every input already has a canonical source except current gate truth and review extraction policy.
- Current gate truth must be measured inline because no trustworthy recorded result exists.
- Review disposition JSON is the only stable work-artifact concern contract.
- The existing pure settle core should remain the only verdict judge.
- A thin shell can load facts, render one screen, and atomically persist the continuation.
- CLI placement and a sentinel-backed fixture can prove the gesture is genuinely free.
