# T-070-01-02 — Research

## Ticket and story contract

- The ticket begins in `phase: research`; no earlier artifact exists for it.
- The behavior is a disposition flip for an optional Lisa routing seat.
- An unknown requested seat must no longer discard a cleared, fully generated board.
- The full board must be written with no `agent:` key on any ticket.
- Those ticket bytes must equal the existing default mint.
- The successful effect result must report that the requested seat was defaulted.
- Existing valid-seat behavior remains: `codex` stamps `agent: codex` on every ticket.
- The effect path must neither throw `UnknownSeatError` nor produce `unknown-seat`.
- The parent story limits this ticket to materializer/result/effect files.
- Run-record schema belongs to T-070-01-01.
- Cast-loop persistence and stdout warning belong to T-070-01-03.
- `KNOWN_SEATS` is reused and must not be modified.
- Ticket bodies, epic cards, BAML schema, and Lisa dispatch are outside this slice.
- The honest boundary is fixture-only and token-free; no metered cast is required.

## Product and charter constraints

- Vision P2 keeps the run a pick + budget + go transaction.
- Vision P4 favors autonomous progress against gates over a human retry loop.
- Vision P6 keeps routing metadata distinct from Vend's executor implementation.
- The epic classifies an invalid routing preference as safe degradation, not invalid work.
- Structural invalidity remains refusing: graph, collision, bare-code, and validation behavior stays.
- The board's default route is represented by absence of an `agent:` key.
- The epic names the applied default as Lisa's default seat, `claude`.
- Honest requested-vs-actual provenance must be returned as data for later persistence.

## Current seat vocabulary

- `src/play/agent-seat.ts` is pure and addon-free.
- It exports `KNOWN_SEATS = ["claude", "codex"] as const`.
- It exports `AgentSeat`, derived from that tuple.
- It exports `findUnknownSeat(seat: string): string | null`.
- Matching is exact; case and whitespace are intentionally not normalized.
- Known seats return `null`; unknown values return the original raw string.
- The module distinguishes Lisa allocation seats from Vend executor selection.
- Existing tests pin both canonical seats and the raw unknown return.

## Current materializer boundary

- `src/play/materialize.ts` owns pure file renderers and the impure filesystem verb.
- `renderTicketFile` accepts an optional string seat.
- When present it inserts `agent: <seat>` immediately after `priority:`.
- When absent it emits zero seat-related bytes.
- The no-agent full-file golden pins the default ticket shape.
- A `codex` full-file golden pins the one-line routed difference.
- `MaterializeResult` currently contains only `storyFiles` and `ticketFiles`.
- `materialize(plan, targets, charter, agent?)` receives the raw optional string.
- Its first operation checks a present seat with `findUnknownSeat`.
- An unknown result causes `UnknownSeatError` before board reads or writes.
- A known raw seat is passed unchanged to every ticket renderer.
- Stories never receive or render the seat.
- Collision detection follows the seat guard.
- Charter snapshotting, rendering, and the bare-code guard follow collision detection.
- All files are rendered before any mkdir/write operation.
- The returned paths are accumulated only after writes succeed.

## Existing materializer tests

- `src/play/materialize.test.ts` uses plain typed fixture objects and temporary directories.
- BAML imports are type-only, keeping the test addon-free.
- The default golden asserts complete ticket bytes and absence of `agent:`.
- The valid-seat test writes multiple tickets and checks each for one `agent: codex`.
- The story is checked for absence of `agent:`.
- The unknown-seat test currently expects `UnknownSeatError` and zero output.
- That test is the direct regression point for this ticket.
- The same real-filesystem block supplies suitable fixtures and cleanup.

## Current effect boundary

- `src/play/decompose-effect.ts` owns cleared-plan writes and Lisa validation.
- It canonicalizes identifiers and refuses graph violations before materialization.
- It applies `--after` dependencies only after checking the live board.
- It calls `materialize` with `ctx.inputs.agent` unchanged.
- On materialization success it runs the injected `LisaValidator`.
- The success `EffectResult` contains validation status, detail, and artifact paths.
- `IdCollisionError` becomes the named `id-collision` failure outcome.
- `BareCodeError` becomes the named `bare-code` failure outcome.
- `UnknownSeatError` becomes `ok:false`, `outcome:"unknown-seat"`.
- Unexpected exceptions remain exceptions.

## Shared effect result contract

- `src/engine/play.ts` defines the generic `EffectResult` interface.
- It currently carries `ok`, optional `outcome`, `detail`, `artifacts`, and `produced`.
- Expected effect refusals are returned data rather than exceptions.
- `EffectResult` is consumed by the generic cast loop.
- Optional fields preserve compatibility for unrelated plays.
- T-070-01-03 will need a named optional report field to persist and warn.
- This ticket therefore adds a field without changing generic success semantics.

## Existing effect test

- `src/play/decompose-effect.test.ts` drives the real effect with a stub validator.
- It assembles inputs through the production direct-run source adapters.
- The valid `codex` test proves transport, validation, stamping, and story absence.
- The unknown test currently requests `gpt` and expects a refusal with zero writes.
- That test must invert to a successful degraded write using the ticket's `kodex` spelling.
- A stub validator keeps the proof free and deterministic.

## Compatibility boundaries

- `RUN_OUTCOMES` still contains `unknown-seat` for append-only ledger read compatibility.
- This ticket stops producing that outcome but must not purge the literal.
- Existing records from E-069's window may still contain it.
- Unknown seats must not be normalized into another explicit ticket seat.
- Omitting the key is the byte-compatible delegation to Lisa's default.
- `renderTicketFile` can remain total and unchanged.
- `agent-seat.ts` can remain unchanged because it supplies the required oracle.
- The BAML `DecomposeInputs.agent` remains an optional raw string.

## Repository state and coordination

- The worktree already contains Lisa-managed and E-069/E-070 board changes.
- Those changes predate this session and are not owned here.
- T-070-01-01 may independently edit `src/log/run-log.ts`; this ticket must not.
- T-070-01-03 depends on both sibling tickets and will consume this effect report later.
- The story's DAG declares the first two tickets file-disjoint.

## Research conclusions

- The raw request must be separated from the effective renderer seat.
- `findUnknownSeat` is the existing single source for that decision.
- A known seat yields effective seat = requested and no degradation report.
- An omitted seat yields effective seat = undefined and no report.
- An unknown seat yields effective seat = undefined plus a requested/default report.
- Returning the report from `materialize` lets the effect forward it without duplicate validation.
- Optional result fields maintain unrelated call sites.
- Direct materializer and real-effect fixtures can prove the complete ticket contract.
