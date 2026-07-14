# T-070-01-02 — Design

## Decision summary

Treat the optional routing seat as a three-way disposition inside `materialize`: omitted,
known, or unknown. Reuse `findUnknownSeat` to decide the branch. Omitted and known seats behave
exactly as today. An unknown seat selects no renderer seat, so every ticket uses the byte-identical
default mint, while `materialize` returns a structured `seatDefaulted` report. `decomposeEffect`
forwards that report on its `EffectResult` and no longer produces the retired refusal.

## Option 1 — Catch and retry

The effect could catch the existing `UnknownSeatError` and call `materialize` a second time without
an agent. This is mechanically small and preserves the materializer signature.

Rejected because:

- exceptions would still represent a safe degradation;
- the board would be read twice for an unknown request;
- the effect would manufacture the report separately;
- direct materializer callers would still see refusal;
- it obscures the intended materializer contract.

## Option 2 — Prevalidate in the effect

The effect could call `findUnknownSeat`, pass either the request or `undefined`, and attach the
report to `EffectResult`.

Rejected because:

- it duplicates seat disposition outside the write boundary;
- direct materializer calls would not implement the behavior;
- `MaterializeResult` would not report the fact, contrary to story scope;
- future consumers could silently lose requested-vs-actual honesty.

## Option 3 — Resolve in materialize and return the report

`materialize` checks the raw optional request once. It derives:

- undefined request → effective seat undefined, no marker;
- known request → effective seat equal to request, no marker;
- unknown request → effective seat undefined, structured marker.

The effective seat, never the unchecked request, reaches `renderTicketFile`. This option is
selected because it keeps the decision adjacent to the write, reuses the canonical oracle,
and exposes the disposition to the effect as returned data.

## Report shape

Add an optional `seatDefaulted` object to both result contracts:

```ts
{
  requested: string;
  applied: "claude";
  reason: string;
}
```

The field name matches the sibling run-record ticket and gives T-070-01-03 a direct value to
thread. `requested` preserves the raw input. `applied` names the actual Lisa default rather than
using a boolean. `reason` makes the degradation self-describing in provenance.

Use the stable reason code `unknown-seat`, matching the sibling ledger schema fixture. Do not
embed the current known-seat list; membership
remains owned by `KNOWN_SEATS`, and future additions should not rewrite old marker meaning.

## Type ownership

Define and export `SeatDefaulted` from `src/engine/play.ts` beside `EffectResult`, because the
generic cast boundary is the downstream consumer. Import that type only into `materialize.ts`
and use it in `MaterializeResult`. The import erases at runtime and creates no module cycle.

This avoids independently spelled anonymous production types. It also lets T-070-01-01's
run-record marker remain structurally compatible without this ticket touching the ledger.

## Default selection

Use a local `DEFAULT_AGENT_SEAT = "claude"` constant in `materialize.ts`, typed as `AgentSeat`.
This does not change `KNOWN_SEATS`; it names which known seat Lisa applies when frontmatter is
absent. The renderer still receives `undefined`, not `claude`, because byte identity is required.

The constant is not added to `agent-seat.ts`, respecting the story's instruction that the file
is reused, not changed. It is an implementation fact needed only for honest reporting.

## Materializer flow

Before board reads, derive `seatDefaulted` and `effectiveAgent` from the raw argument. Do not
throw for the unknown branch. Continue through collision detection, charter snapshotting,
rendering, bare-code validation, and writes exactly once. Render with `effectiveAgent`.

Return file paths plus `seatDefaulted` only when defaulting occurred. If a later structural guard
or filesystem write fails, no successful disposition report escapes; the failure is authoritative.

## Effect flow

Destructure `seatDefaulted` from `materialize` with the path arrays. Run Lisa validation exactly
as today. Return the optional report alongside `ok`, `detail`, and `artifacts`.

Forward the report even when Lisa validation returns `ok:false`, because files were written and
the seat disposition occurred. The effect's overall status still reflects validation honestly.

Remove the `UnknownSeatError` import and catch arm. Preserve collision and bare-code handling.
Do not remove `unknown-seat` from the ledger outcome vocabulary.

## Test design

### Direct materializer proof

Replace the throw test with an unknown-seat test using `kodex`. Mint the same fixture twice into
separate targets: once without an agent and once with `kodex`. Read every file and assert exact
byte equality. Explicitly assert every degraded ticket lacks `agent:`. Assert the exact marker
and that the default run has no marker. Keep the multi-ticket `codex` test.

### Effect proof

Invert the existing unknown effect test. Use `kodex`, a successful validator, and prove:

- `ok === true`;
- `outcome` is absent;
- the marker is returned through `EffectResult`;
- validation runs once;
- the full story/ticket board exists;
- tickets contain no `agent:` key;
- bytes match a separate default effect mint.

Keep the valid `codex` effect test and assert marker absence.

## Rejected scope

- Do not alter CLI parsing or source assembly.
- Do not update cast stdout or run records.
- Do not purge historical outcome vocabulary.
- Do not add seats or normalize inputs.
- Do not stamp `agent: claude`; absence is the compatibility contract.
- Do not weaken graph, collision, charter, or Lisa validation behavior.

## Verification

- Run both focused test files during implementation.
- Run `bun run check` before Review.
- Inspect the final diff for ticket-frontmatter edits and unrelated overlap.
