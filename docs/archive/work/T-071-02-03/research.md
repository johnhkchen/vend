# Research — T-071-02-03

## Assignment and scope

- The ticket starts in `research` and requires every remaining RDSPI phase in one pass.
- Phase artifacts belong only in this attempt-private directory.
- Lisa owns ticket phase/status transitions; ticket frontmatter must not be edited by this work.
- Ticket-owned source must be committed with `lisa commit-ticket` and exact include paths.
- The parent story limits this slice to mint-time default-seat inference for two known lanes.
- Runtime rerouting, quota/reset modeling, dashboards, new lanes, and Lisa dispatch changes are out.

## Existing input path

- `src/play/project-context.ts` defines `DecomposeInputs` with optional `agent`.
- `contextSourcesForRun` omits the property when `--agent` is absent.
- `assembleInputs` preserves an explicit agent and otherwise leaves it absent.
- `src/play/decompose-epic.ts` uses that adapter for direct `decompose`/run casts.
- `src/play/chain-propose-decompose.ts` uses the same `assembleInputs` for its decompose step.
- Therefore both gestures converge before `decomposeEffect`; no CLI or chain-specific policy is needed.

## Existing effect and materialization path

- `src/play/decompose-effect.ts` is the impure board-writing boundary.
- It canonicalizes identifiers, validates graph integrity, applies `--after`, and calls `materialize`.
- `materialize` already accepts an optional raw seat and stamps every ticket for a known seat.
- Unknown explicit seats already degrade to an unrouted board and return `seatDefaulted`.
- Stories never receive an `agent` field.
- Validation occurs after successful materialization.
- The effect currently passes only `ctx.inputs.agent`; no inferred default exists.

## Existing heat reader

- `src/play/lane-heat.ts` was delivered by dependency T-071-02-01.
- `inferDefaultSeat(records)` is pure and returns `{ seat, reason }` or `null`.
- It consumes normalized `RunRecord` values and reuses run-log `totalTokens`.
- It considers the append-ordered last 100 records.
- It ignores absent and unknown execution seats.
- It returns null for empty, tied, ambiguous, and non-decisive relative heat.
- A decisively hotter Claude lane yields Codex as the cooler seat.

## Existing ledger boundary

- `src/log/run-log.ts` exports `loadRunLog` as the thin filesystem reader.
- Its default path is `.vend/runs.jsonl`; a missing file returns an empty record set.
- Callers using a project root must join the root with `DEFAULT_RUN_LOG_PATH`.
- Parse-skipped malformed lines do not prevent usable records from being returned.
- T-071-02-02 already added `SeatInferred`, normalization, serialization, and revival.
- No run-log schema work belongs to this ticket.

## Existing effect/cast contract

- `src/engine/play.ts` defines the play-generic `EffectResult` contract.
- It currently exposes `seatDefaulted` but not `seatInferred`.
- `src/engine/cast.ts` invokes the effect only after a gate-cleared materialization verdict.
- The cast loop treats effect disposition as authoritative data and does not re-run policy.
- It forwards `seatDefaulted` to stdout and the final `appendRunLog` input.
- The same pattern is the natural path for inference provenance.

## Existing test seams

- `src/play/decompose-effect.test.ts` drives the real effect/materializer with a stub validator.
- `src/engine/cast.test.ts` drives real effects through an injected, token-free stub executor.
- Its `seatDefaultPlay` fixture parses a complete addon-free `WorkPlan` and calls `decomposeEffect`.
- `src/engine/chain.ts` can run heterogeneous fixture plays through the same `castPlay` boundary.
- Concrete chain modules load the BAML addon and are intentionally avoided by addon-free unit tests.
- Temporary project roots isolate board files, transcripts, and ledger fixtures.

## Constraints and assumptions

- Explicit `agent` must win even if ledger heat points elsewhere.
- Inference must occur once per board-writing gesture, not once per ticket.
- Both-cool or absent evidence must preserve the current unrouted bytes and omit provenance.
- Inferred known seats should be passed through existing materialization, not stamped manually.
- The effect must read the pre-cast ledger: the current cast is appended only after the effect returns.
- A custom cast test output log path does not change the production ledger location visible to the effect.
- Tests should place heat fixtures at `<root>/.vend/runs.jsonl` and cast output elsewhere when isolation helps.
- Unrelated dirty Lisa/config/ticket files predate implementation and must remain untouched.

## Likely owned files

- `src/play/decompose-effect.ts`: load ledger, infer only when agent absent, pass effective seat, report marker.
- `src/engine/play.ts`: add the generic inferred-seat effect result type/field.
- `src/engine/cast.ts`: capture and forward marker to the run record.
- Tests in `src/engine/cast.test.ts` can cover the required end-to-end effect behavior.
- A focused effect test may be added to `src/play/decompose-effect.test.ts` if useful for the policy branch.

## Acceptance mapping

- Hot-Claude/no-agent: fixture ledger, stub executor, real effect, stamped Codex ticket, marker in record.
- Both-cool/no-agent: compare materialized bytes against current unrouted baseline and assert no marker.
- Explicit Claude: hot-ledger fixture still stamps Claude and emits no inference marker.
- Decompose and chain: direct `castPlay` fixture plus `castChain` using the same effect-bearing play.
- Final gate: `bun run check` must pass before commit.
