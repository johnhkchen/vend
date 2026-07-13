# Research — T-080-01-01 marker tolerates untracked duration

## Ticket and workflow state

- Ticket: `T-080-01-01`.
- Parent story: `S-080-01`, “cord-fails-loud”.
- Current ticket phase at assignment start: `research`.
- The assignment requires one uninterrupted RDSPI pass through Review.
- Phase artifacts belong in this attempt-private directory.
- Lisa owns ticket phase/status transitions and later artifact publication.
- Ticket-owned source commits must use `lisa commit-ticket` with exact repository-relative includes.
- The ordinary Git index must not be used for ticket work.
- The working tree already contains two Lisa-owned frontmatter changes:
  - `docs/active/tickets/T-080-01-01.md`: `phase: ready` to `phase: research`;
  - `docs/active/tickets/T-080-02-01.md`: `phase: ready` to `phase: research`.
- Those existing changes are outside this ticket's source ownership and must remain untouched.

## Product and charter context

- Vend is a local-first orchestrator for reusable, gated playbooks.
- The product promise is repeatability over probabilistic agent work.
- Gates are the contract that makes autonomous execution trustworthy.
- P3 states that quality lives inside the work and a unit without an enforceable gate is not done.
- P4 states that work proceeds against gates rather than live human supervision.
- The Lisa-to-Vend seam removes a human relay at whole-loop completion.
- A completion fact that disappears because an optional measurement is absent weakens both principles.
- This ticket does not add a new gesture, watcher, daemon, executor, or network dependency.

## Parent-story contract

- The story scope covers the Lisa-to-Vend seam recorder and its settle consumption edge.
- Named seam files are:
  - `src/seam/lisa-loop-settled-core.ts`;
  - `src/seam/lisa-loop-settled.ts`;
  - `src/seam/fixtures/lisa-loop-settled.valid.json`.
- Named settle files are:
  - `src/settle/settle-core.ts`;
  - `src/settle/settle.ts`.
- The `.lisa` hook scripts and Lisa itself are explicitly untouched.
- Story acceptance requires an unset `LISA_DURATION_SECS` to still publish a claimable marker.
- The next settle must print the loop line without fabricating a duration.
- Later tickets own refusal tracing and surfacing a cord failure.
- This ticket runs before those later seam/settle tickets because it settles the optional marker shape.
- The story's honest boundary is fixture/unit proof only.
- No live Lisa loop, tokens, or end-to-end trial is required in this ticket.
- The epic closeout owns the later bare end-to-end rerun.

## Ticket acceptance

- `classifyLisaCompleteEvent` must classify an otherwise-valid complete event with
  `durationSecs: undefined` as `kind: "complete"`.
- The resulting marker must represent duration as honestly absent.
- A present but malformed `LISA_DURATION_SECS` must continue to refuse.
- Closed-schema revive and parse behavior must round-trip both valid marker shapes.
- The committed fixture must be updated.
- `renderSettleResult` must print a loop line for the untracked-duration marker.
- That line must not invent an `Ns` duration.
- `bun run check` must be green.

## Existing producer contract

- `.lisa/hooks/on-notify` is the existing project-owned producer entry.
- Its `complete` arm invokes `src/seam/lisa-loop-settled.ts` before optional ntfy handling.
- Recorder failure is redirected and contained by the hook.
- A successful recorder invocation triggers `vend settle` through `src/cli.ts`.
- The hook is intentionally not part of this ticket's edit surface.
- The hook passes Lisa environment through the recorder process environment.
- `src/seam/lisa-loop-settled.ts` reads:
  - `LISA_EVENT`;
  - `LISA_PROJECT`;
  - `LISA_TICKETS_DONE`;
  - `LISA_DURATION_SECS`.
- The effect shell calls the pure classifier before creating `.vend/`.
- A non-complete or refused event returns without a marker write.
- A complete classification is serialized to a unique temporary sibling.
- Rename atomically publishes `.vend/loop-settled.json`.
- A later successful completion replaces the pending singleton marker.

## Existing pure seam model

- `src/seam/lisa-loop-settled-core.ts` owns schema and classification policy.
- Marker schema version is literal `1`.
- Marker kind is literal `lisa-loop-settled`.
- Stable marker path is `.vend/loop-settled.json`.
- `LisaCompleteEventInput.durationSecs` is already typed as `string | undefined`.
- `LisaLoopSettledMarkerInput.durationSecs` is currently a required `number`.
- `LisaLoopSettledMarker.durationSecs` is currently a required `number`.
- `MARKER_KEYS` currently contains exactly five keys including `durationSecs`.
- `hasExactMarkerKeys` requires every key and rejects any additional key.
- `parseEventQuantity` maps `undefined` to `null`.
- It also maps malformed decimal strings to `null`.
- `classifyLisaCompleteEvent` uses the same `null` outcome for absence and malformed presence.
- Consequently an absent duration currently returns the refusal:
  `LISA_DURATION_SECS must be a non-negative safe integer`.
- `buildLisaLoopSettledMarker` requires a non-negative safe integer duration.
- It always creates a marker with a `durationSecs` own property.
- `reviveLisaLoopSettledMarker` requires the five-key shape and a valid numeric duration.
- `serializeLisaLoopSettledMarker` rebuilds before JSON serialization.
- Markers returned by the builder are frozen.

## Current schema fixture and knowledge record

- `src/seam/fixtures/lisa-loop-settled.valid.json` is a single compact JSON line plus newline.
- Its current bytes include `"durationSecs":41`.
- The fixture test parses it, compares it to `expectedMarker`, and reserializes byte-for-byte.
- `docs/knowledge/lisa-loop-settled-contract.md` is the durable seam agreement.
- It currently describes `LISA_DURATION_SECS` without optionality.
- It says the JSON object has exactly five fields.
- It says missing quantities are not admitted.
- It says settle prints project, ticket count, and duration.
- Its version-evolution section says field semantic changes require coordinated documentation and
  fixture updates.
- The current repository `.lisa` sample describes duration as supplied on complete events.
- The ticket and epic record the observed external reality: Lisa may omit it when duration was not
  tracked.

## Current seam tests

- `src/seam/lisa-loop-settled-core.test.ts` covers fixture validation and byte round-trip.
- `expectedMarker` is the tracked-duration five-field object.
- Builder tests admit zero duration and reject invalid numeric duration values.
- Closed-schema tests reject missing kind, wrong kind/version, invalid fields, and extra keys.
- The current malformed matrix treats a missing duration as schema mismatch indirectly through the
  exact five-key check.
- Classifier tests cover a normal complete event with duration `"41"`.
- The refusal matrix covers partial `"41s"` and unsafe duration text.
- The attention test already passes both quantity inputs as `undefined` and expects ignore.
- No classifier test currently admits a missing duration on a complete event.
- `src/seam/lisa-loop-settled.test.ts` covers filesystem publication.
- Its valid event test always supplies duration `"90"`.
- Its replacement test always supplies durations.
- Its real-hook fixture supplies `LISA_DURATION_SECS: "120"` and expects `in 120s`.
- Refused and ignored events are proven not to create state.

## Existing consumer and renderer

- `src/settle/settle-core.ts` imports the seam parser and marker type.
- `SettleVerdict.loop` is `LisaLoopSettledMarker | null`.
- `computeSettleVerdict` parses pending loop bytes using the seam's closed schema.
- Valid marker facts flow into the verdict without a second marker representation.
- Malformed marker bytes become a named refusal and are preserved for diagnosis.
- `src/settle/settle.ts` claims the stable marker before observation.
- A successful verdict advances last-settle state and consumes the claim.
- Refusal or thrown failure restores the claim.
- `renderSettleResult` currently always interpolates `${result.loop.durationSecs}s`.
- With a widened marker type alone, that interpolation would produce `undefineds`.
- The renderer already has a pure `countNoun` helper and no duration fallback helper.
- A null loop prints `loop: none pending`.

## Current settle tests

- `src/settle/settle-core.test.ts` proves tracked marker bytes enter typed provenance.
- Its schema-mismatch case currently uses a marker with no `durationSecs` as malformed input.
- That case conflicts directly with the new accepted shape.
- `src/settle/settle.test.ts` builds a complete verdict with a tracked duration.
- Its terminal contract asserts `loop: vend — 1 ticket done in 41s`.
- Its lifecycle fixture writes a tracked marker and asserts `in 12s`.
- No rendering test currently uses a marker with absent duration.
- Existing tracked-duration output is a compatibility behavior within this ticket.

## Boundaries and constraints

- Pure-core / impure-shell remains the repository's architectural rule.
- Optionality policy belongs in the seam core, not the filesystem recorder.
- Rendering policy belongs in the pure terminal formatter.
- The recorder effect needs no new clock source because absence must remain honest.
- The marker remains a closed schema; optional does not mean arbitrary fields are accepted.
- Missing duration and malformed present duration are distinct external states.
- JSON can represent honest absence by omitting the property.
- JSON cannot preserve an own property whose value is JavaScript `undefined`.
- The tracked five-field marker remains valid because existing pending markers may already exist.
- The untracked four-field marker becomes the second valid v1 shape required by acceptance.
- No migration of persisted marker files exists or is needed because the reader must accept both.
- No marker version bump is requested by the ticket; both shapes are named as round-trippable.
- The fixture update must remain deterministic and newline-terminated.
- No timestamp or inferred duration is available from the selected event.
- A display fallback such as `0s`, `?s`, or an elapsed clock value would fabricate provenance.

## Verification surface

- Focused seam core tests can pin classification, construction, revival, parsing, and serialization.
- Focused seam effect tests can pin actual four-field bytes at the stable Vend path.
- Settle core tests can pin the untracked marker as valid typed provenance.
- Settle render tests can pin the exact line and absence of an `Ns` claim.
- The real-hook fixture can exercise the environment-unset path through recorder, settle, and
  consumption while leaving hook source unchanged.
- TypeScript checks all marker consumers after the optional field change.
- The full `bun run check` command performs BAML generation, typecheck, and the entire Bun test suite.

## Observed ownership history

- Commit `57261b4` introduced the seam marker contract and recorder.
- Commit `9896aa5` introduced settle consumption of the marker.
- Commit `d2a906c` connected the complete hook to settle.
- Commit `9738703` made the empty loop state explicit.
- The code is compact and local: the marker type has no unrelated consumers outside seam and settle.
- Later story tickets depend on the optional marker shape established here.
