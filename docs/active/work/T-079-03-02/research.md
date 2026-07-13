# Research — T-079-03-02 settle rides the cord

## Assignment and phase

- Ticket: `T-079-03-02` (`settle-rides-the-cord`).
- Parent story: `S-079-03` (`andon-carries-the-loop-home`).
- Current ticket phase is `research`; Lisa owns phase and status transitions.
- Attempt artifacts belong only in `.lisa/attempts/T-079-03-02/1/work/`.
- Ticket-owned source commits must use `lisa commit-ticket` with exact `--include` paths.
- The ordinary index and unrelated worktree changes must not be touched.
- The worktree already contains Lisa-managed changes and another ticket's `src/sweep/` work.

## Story contract

- The story covers the Vend/Lisa completion seam, marker crossing, settle consumption, provenance,
  and the event trigger.
- The story acceptance requires a fixture marker to print project, ticket count, and duration once.
- An immediate later settle must have no pending loop marker.
- Lisa's existing complete event, rather than a new Lisa event or journal interpretation, is the
  source of truth.
- The honest boundary is fixture-driven; a live Lisa loop remains an operational observation.
- Vend may only mutate Vend-owned state after crossing the seam.
- Auto-pulling signals, notification-content changes, and dashboard/daemon surfaces are excluded.

## Charter and vision constraints

- P4 requires the machine-known completion fact to reach its verdict without a human relay.
- P2 requires removal of a standing gesture, not a new run-time configuration conversation.
- P3 is inherited through settle: it reports existing gate facts rather than adding judgment.
- P5 favors the existing local `.vend/` marker and offline CLI path.
- N2 excludes a watcher dashboard or supervision surface.
- The epic permits settle to be typed or event-triggered and explicitly describes the cord as the
  existing Lisa completion event reaching Vend.

## Dependency T-079-03-01: producer contract

- `docs/knowledge/lisa-loop-settled-contract.md` is the durable seam agreement.
- The selected emission is the existing `on-notify complete` hook event.
- Lisa provides `LISA_PROJECT`, `LISA_TICKETS_DONE`, and `LISA_DURATION_SECS`.
- `.lisa/hooks/on-notify` calls the Vend recorder before optional ntfy delivery.
- The marker home is `.vend/loop-settled.json`.
- The v1 object is closed and contains exactly `v`, `kind`, `project`, `ticketsDone`, and
  `durationSecs`.
- The canonical fixture is `src/seam/fixtures/lisa-loop-settled.valid.json`.
- A later complete emission atomically replaces the one pending marker.
- Malformed marker bytes are an andon, must remain visible, and must not be consumed.
- A valid marker is consumed only after settle successfully reaches its terminal verdict.
- The contract excludes a watcher, daemon, new Lisa machinery, auto-pull, and notification changes.

## Existing seam core

- `src/seam/lisa-loop-settled-core.ts` is pure over plain values.
- `DEFAULT_LISA_LOOP_SETTLED_MARKER_PATH` single-sources the stable relative path.
- `LisaLoopSettledMarker` is the typed provenance shape.
- `parseLisaLoopSettledMarker` returns `valid` or `malformed` data and never leaks JSON exceptions.
- `reviveLisaLoopSettledMarker` enforces exact keys, literals, and non-negative safe integers.
- `serializeLisaLoopSettledMarker` produces deterministic JSON plus a newline.
- `classifyLisaCompleteEvent` validates the documented hook environment.
- Project provenance is the basename of Lisa's absolute project root.

## Existing seam effect shell

- `src/seam/lisa-loop-settled.ts` validates before filesystem mutation.
- It writes a unique sibling temporary file and atomically renames it onto the stable marker.
- Its only durable state target is below `.vend/`.
- It returns `recorded`, `ignored`, or `refused` result data.
- Its CLI entry reads the four Lisa environment fields and exits nonzero for refusal/write failure.
- `src/seam/lisa-loop-settled.test.ts` covers valid recording, refusal/no-write, replacement, and the
  real project hook path.
- The hook fixture currently proves recording even without an ntfy topic.

## Existing notify hook

- `.lisa/hooks/on-notify` is a project-owned POSIX shell hook.
- For `complete`, it locates `src/seam/lisa-loop-settled.ts` relative to the hook directory.
- It invokes the recorder with `LISA_EVENT=complete` and suppresses recorder output.
- Recorder failure is contained with `|| :`, so Lisa completion is not failed by Vend recording.
- It then performs the pre-existing optional ntfy behavior.
- If no topic exists, the hook exits successfully after local recording.
- The hook currently does not invoke settle, so recording alone does not retire the relay/inspection
  gesture.

## Dependency T-079-01-02: settle verb

- `src/cli.ts` parses bare `settle` as a free no-argument command.
- It rejects positionals, flags, and especially `--budget`.
- CLI dispatch dynamically imports `runSettle` and `renderSettleResult`.
- A verdict prints to stdout and exits 0; a typed refusal prints to stderr and exits 1.
- Unexpected observation failures become a named `settle: could not observe repository` error.
- No executor, budget, play registry, or run ledger participates.

## Existing pure settle core

- `src/settle/settle-core.ts` computes a deterministic verdict from plain graph/gate/presweep/review
  facts and prior marker bytes.
- `.vend/last-settle.json` is distinct from the loop-settled marker.
- The last-settle marker stores the sorted phase-done ticket frontier for delta computation.
- Missing last-settle state means first settle; malformed state returns an actionable refusal.
- `SettleVerdict` includes delta, epic clearance, gate, presweep, review concerns, exceptions, and the
  next last-settle marker.
- It currently has no loop provenance field or loop-marker input.
- `SettleRefusal` currently names only malformed last-settle state.

## Existing settle effect shell

- `src/settle/settle.ts` is the impure boundary.
- It concurrently loads the board, last-settle bytes, and review dispositions.
- It then runs `bun run check` and `git status --porcelain` to obtain gate and presweep facts.
- It delegates verdict judgment to `computeSettleVerdict`.
- On a verdict, it atomically advances `.vend/last-settle.json`.
- It renders a one-screen report headed by `settle`.
- It currently neither reads nor deletes `.vend/loop-settled.json`.
- `.vend/*` is ignored by Git and outside presweep's source/board path scope.

## Existing settle coverage

- `src/settle/settle-core.test.ts` pins delta, clearance, marker refusal, sorting, and exceptions.
- `src/settle/settle.test.ts` pins review-disposition parsing and terminal rendering.
- `src/cli.test.ts` contains a fixture repository acceptance test for two typed settles.
- That CLI fixture proves the first delta, gate line, presweep, named concern, last-settle advance,
  unchanged run ledger, no executor call, and empty second delta.
- No existing test supplies `.vend/loop-settled.json` to settle.
- No existing test observes provenance in a rendered verdict.
- No existing test proves consume-on-settle or event-triggered settle.
- The relevant baseline is green: 56 tests across `src/settle` and `src/seam`.

## State and ordering observations

- Producer publication is atomic, but consumer ownership/consumption is not implemented.
- A naive read followed much later by `rm(stablePath)` could delete a newer marker that replaced the
  bytes read earlier.
- The repository gate may be materially slower than marker I/O, widening that replacement window.
- A consume operation therefore has observable ordering relative to producer replacement and
  last-settle advancement.
- A settle refusal must not advance last-settle state or consume malformed loop evidence.
- A gate-red result is still a successfully observed terminal verdict in current settle semantics;
  the CLI exits 0 because observation succeeded and reports the exception in red.
- Event-triggered settle must preserve stdout/stderr so the verdict can reach the operator.
- Hook failure containment must remain: a settle failure may be visible but cannot make the Lisa
  completion hook fail.

## File ownership boundary for this ticket

- Expected ticket-owned implementation surfaces are `src/settle/settle-core.ts`, its tests,
  `src/settle/settle.ts`, its tests, the hook, and seam integration tests.
- `src/cli.ts` already exposes the required free verb; no parser change is presently indicated.
- The producer schema and contract are dependency-owned and should be reused unchanged.
- Board frontmatter is Lisa-owned during this attempt and must not be edited.
- Shared `docs/active/work/` is publication-owned by Lisa and must not receive attempt artifacts.

## Research conclusion

The producer and verdict independently exist and are both well tested. The missing behavior is the
consumer join: strict loop-marker admission, provenance carried through the typed settle result,
consume-on-success lifecycle, terminal rendering, and invocation of the already-free settle verb by
the existing complete hook. The existing contract supplies all marker facts and excludes alternate
watcher machinery; the current modules supply the pure/effect boundary into which the join fits.
