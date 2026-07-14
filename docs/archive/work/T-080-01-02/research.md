# Research — T-080-01-02 recorder refusal leaves trace

## Assignment and repository state

- Ticket: `T-080-01-02`.
- Parent story: `S-080-01`, “cord-fails-loud”.
- The ticket starts in `phase: research`.
- The assignment requires one continuous pass through all six RDSPI phases.
- Phase artifacts belong only in `.lisa/attempts/T-080-01-02/1/work/` during this attempt.
- Lisa publishes admitted artifacts and changes ticket phase/status after lease verification.
- Ticket frontmatter must not be edited by this worker.
- Ticket-owned source units must be committed with `lisa commit-ticket` and exact repeated
  repository-relative `--include` paths.
- Ordinary `git add` and `git commit` are forbidden for ticket work.
- The worktree already contains Lisa-owned modifications to:
  - `.lisa/provenance.jsonl`;
  - `docs/active/tickets/T-080-01-02.md`;
  - `docs/active/tickets/T-080-02-02.md`.
- Exact-path commit isolation is required so those concurrent files remain untouched.
- `lisa commit-ticket --help` confirms the local syntax requires `--ticket-id`, `--message`, and
  one or more `--include` arguments.

## Product and charter context

- Vend is a local-first clearing and orchestration tool for reusable, gated playbooks.
- Its consistency promise depends on gates and state transitions remaining observable without a
  human supervising every agent step.
- P4 requires autonomy against gates rather than live human supervision.
- P5 requires the product to own usable state locally and work offline on one machine.
- The Lisa-to-Vend cord records whole-loop completion into Vend-owned local state.
- The hook deliberately contains recorder errors so a Vend failure cannot block Lisa.
- Before this story, that containment also made recorder refusal invisible.
- A local failure trace preserves the never-block-Lisa boundary while making the next free Vend
  verdict able to expose what happened.
- This ticket adds no conversation, approval step, watcher, daemon, remote service, or network
  dependency.

## Parent-story contract

- Story scope names the seam core, seam recorder, canonical fixture, and the settle consumption
  edge.
- `.lisa` hooks and Lisa itself are explicitly outside the edit surface.
- T-080-01-01 already made `durationSecs` optional while keeping malformed present values
  refusable.
- This ticket runs after that schema change and before settle consumes the trace.
- T-080-01-03 depends on the trace path and line shape established here.
- Story acceptance requires a refusable input to append one timestamp-and-reason line under
  `.vend/`.
- The next settle ticket will render the most recent applicable reason as
  `cord: last recording failed — <reason>`.
- A successful claim newer than the failure trace suppresses that later warning.
- The hook's swallow-errors containment remains unchanged.
- Retry, queue, and delivery guarantees are out of slice.
- The honest boundary explicitly acknowledges that a process which never starts cannot leave a
  trace.
- Proof for this ticket is fixture/unit-level and free; the epic closeout owns the bare live rerun.

## Ticket acceptance

- Recorder tests must exercise a relative `LISA_PROJECT` refusal.
- Recorder tests must exercise a non-numeric `LISA_TICKETS_DONE` refusal.
- Each refused event must append exactly one timestamp-plus-reason line.
- Recorder tests must force marker publication to fail.
- That write failure must append exactly one timestamp-plus-reason line.
- A successful recording must append no failure line.
- Recorder failure handling must not throw out of the recorder.
- `git check-ignore` must confirm the chosen `.vend/` trace path is ignored.
- `bun run check` must pass.

## Existing pure seam core

- `src/seam/lisa-loop-settled-core.ts` owns external event classification and marker schema.
- `DEFAULT_LISA_LOOP_SETTLED_MARKER_PATH` is `.vend/loop-settled.json`.
- `classifyLisaCompleteEvent` first ignores non-complete events.
- It then refuses a missing, blank, or relative `LISA_PROJECT`.
- Its exact project refusal reason is
  `LISA_PROJECT must be an absolute project root`.
- It derives only the basename after absolute-path validation.
- It refuses a missing or malformed ticket count.
- Its exact count refusal reason is
  `LISA_TICKETS_DONE must be a non-negative safe integer`.
- It accepts an absent duration and refuses a malformed present duration.
- A valid classification carries the original validated absolute `projectRoot`.
- The core is pure over plain values and imports only path operations.
- Marker parse/build/serialize functions freeze valid typed values and keep deterministic JSON
  field ordering.
- No failure-line type, path, serializer, or parser currently exists.

## Existing recorder effect

- `src/seam/lisa-loop-settled.ts` is the thin process/filesystem shell.
- `recordLisaLoopSettled` currently accepts only the Lisa event input.
- A non-complete classification is returned unchanged.
- Therefore ignored and refused results perform no filesystem effect today.
- A complete result resolves the marker path beneath the classified absolute project root.
- Publication uses a unique sibling temporary path containing PID and UUID.
- The recorder creates `.vend/`, writes bytes with `flag: "wx"`, and atomically renames the
  temporary file onto the stable marker.
- A `finally` block removes the temporary path if publication does not finish.
- A successful result is frozen and includes `kind: "recorded"`, the relative path, and marker.
- The result union currently has `recorded`, `ignored`, and `refused` variants.
- Filesystem errors currently reject the `recordLisaLoopSettled` promise.
- The `import.meta.main` shell catches that rejection, writes stderr, and sets exit code 1.
- A refused outcome also writes stderr and sets exit code 1.
- No failure path currently writes durable local evidence.

## Existing hook boundary

- `.lisa/hooks/on-notify` calls the recorder only for `complete`.
- It resolves the recorder relative to the hook's own directory.
- It invokes `bun run` with `LISA_EVENT=complete` and inherits all other Lisa environment facts.
- Recorder stdout and stderr are redirected to `/dev/null`.
- `vend settle` runs only when the recorder process exits successfully.
- Recorder or settle failure is contained with shell conditionals and `|| :`.
- The hook always proceeds to optional ntfy behavior and ultimately exits zero.
- Editing this hook is expressly outside the story scope.
- A recorder failure should therefore continue to produce a non-success result/process status so
  the hook does not run settle against a missing marker.
- The durable trace is the visibility channel; stderr is not, because the hook discards it.

## Root-selection constraint

- A marker write failure occurs only after classification has yielded a validated absolute project
  root.
- Its trace can therefore be rooted beneath that validated project.
- A non-numeric ticket count can still carry a valid absolute `LISA_PROJECT`; that absolute path is
  available even though the whole event is refused.
- A relative-project refusal, by definition, has no acceptable project root from the event.
- It cannot safely join `.vend/` to the rejected relative value without making the trace location
  depend on untrusted input.
- The recorder process normally runs with the project as its current working directory.
- `process.cwd()` is already the local shell default used by other Vend commands.
- A testable effect boundary can accept an explicit working root while production defaults to
  `process.cwd()`.
- Root selection can prefer an absolute input project path and otherwise fall back to that working
  root.
- This keeps relative-project refusals local and allows temporary-root tests without global
  `process.chdir` mutation.

## Trace-shape constraints

- The story requires one physical line containing a timestamp and reason.
- The later settle ticket needs deterministic field recovery and the reason text verbatim.
- Plain delimiter formats require escaping when an operating-system error contains delimiters or
  line breaks.
- JSON Lines naturally represents one object per physical line.
- `JSON.stringify` escapes embedded CR/LF characters, so one reason remains one physical record.
- Parsing JSON later recovers the exact original reason string.
- A two-field object with `timestamp` followed by `reason` gives deterministic output.
- An ISO-8601 UTC timestamp is lexically readable and can be validated independently.
- The clock is an effect and should be injected or called only in the impure recorder.
- Serialization and validation of already-supplied timestamp/reason values can remain pure.
- The trace is append-only; unlike the singleton marker it must not rename over older evidence.

## Failure-reason constraints

- Classifier refusals already carry stable user-facing reason text.
- Those reasons should be logged without replacing them with generic labels.
- Filesystem failures are arbitrary thrown values and need deterministic string conversion.
- Existing main-shell wording distinguishes `marker refused` from `marker write failed`.
- A durable write-failure reason should retain that category plus the underlying error detail.
- The later renderer consumes a reason, not a stack trace.
- Error stacks and absolute temporary filenames are noisy and unnecessary for the stated verdict.
- A small helper can convert `Error` to `.message` and other thrown values with `String(value)`.

## Non-throwing containment constraint

- The current exported recorder throws for marker filesystem failures.
- Acceptance now requires tested failure paths to complete without throwing.
- The result union can add a named write-failure outcome rather than conflating it with event
  refusal.
- The main shell can still set exit code 1 for both refusal and write failure.
- That preserves the hook's “do not settle after failed recording” conditional.
- Trace append itself can also fail in pathological cases such as an unwritable `.vend/`.
- No algorithm can durably write into a filesystem that rejects both marker and log writes.
- The story's honest boundary permits a remaining pre-boot/unspawned window and buys visibility,
  not delivery guarantees.
- The exported recorder can contain trace-write errors as result data so it never leaks a rejected
  promise into its caller.
- Tests can force marker-target failure while keeping the sibling trace path writable, proving the
  promised normal failure case.

## Existing tests and useful seams

- `src/seam/lisa-loop-settled-core.test.ts` pins marker construction, schema, classification, and
  serialization.
- It already contains the two ticket-named classifier refusal categories.
- `src/seam/lisa-loop-settled.test.ts` owns actual filesystem and real-hook coverage.
- Its success test creates a temporary root and confirms the only top-level entry is `.vend`.
- Its current “ignored and malformed events write nothing” test expects the root to remain empty;
  that assertion must change because refused complete events will now create trace state.
- The replacement test proves atomic singleton marker behavior.
- A target directory at `.vend/loop-settled.json` can force rename failure while leaving the parent
  `.vend/` writable for log append.
- Fixed timestamps can be supplied through recorder options for exact assertions.
- Existing `pathExists` and temporary-root helpers are reusable.
- A success case can assert that the trace path does not exist.
- `git check-ignore` can run against the repository-relative trace constant from the repository
  root.

## Ignore and persistence state

- Root `.gitignore` contains `.vend/*`.
- It selectively re-includes only `.vend/decisions.jsonl` and `.vend/forward-e1.jsonl`.
- A new `.vend/` seam failure log is ignored without changing `.gitignore`.
- Runtime telemetry is intentionally local and not source-controlled.
- `git check-ignore` is the correct executable proof because negation rules can make visual
  inspection insufficient.
- The log is durable on the local filesystem across processes despite being excluded from Git.

## Documentation and downstream boundary

- `docs/knowledge/lisa-loop-settled-contract.md` is the durable seam agreement.
- It currently says malformed complete facts are refused and create no marker.
- It documents hook containment but not durable failure trace behavior.
- It lists Vend-owned marker and temporary-file state but no seam log.
- The new path, line shape, root fallback, and append behavior are cross-ticket contracts for
  T-080-01-03 and should be recorded there.
- This ticket should not implement settle reading, timestamp comparison, or cord rendering.
- T-080-01-03 owns those consumer decisions and tests.
- No fixture marker change is required because the marker schema is unchanged in this ticket.

## Verification surface

- Core tests can pin exact JSONL bytes, timestamp validation, reason preservation, and one newline.
- Effect tests can pin one appended record per refusal.
- Effect tests can pin one appended record for one forced marker-write failure.
- Effect tests can prove ignored and successful events append no trace.
- Effect tests can prove every named recorder call resolves rather than rejects.
- A real Git invocation can prove the exported log path is ignored.
- Focused tests are `bun test src/seam/lisa-loop-settled-core.test.ts src/seam/lisa-loop-settled.test.ts`.
- `bun run build` catches result-union and option-interface consumer drift.
- `bun run check` is the required final gate: BAML generation, typecheck, and full tests.

## Ticket ownership conclusion

- Expected production changes are confined to the seam core and seam recorder.
- Expected tests are confined to their adjacent seam test files.
- The durable contract document should change with the trace format.
- `.gitignore` should remain unchanged because its existing rule already covers the path.
- `.lisa/hooks/on-notify` should remain unchanged.
- Settle source/tests should remain unchanged until T-080-01-03.
