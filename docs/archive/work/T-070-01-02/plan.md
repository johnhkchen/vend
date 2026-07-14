# T-070-01-02 — Plan

## Goal

Make an unknown Lisa routing seat degrade to the byte-identical default mint, return a structured
seat-defaulted report through materializer and effect contracts, and preserve valid stamping and
all structural refusals.

## Step 1 — Shared report contract

Modify `src/engine/play.ts`:

1. Define exported `SeatDefaulted` beside `EffectResult`.
2. Give it readonly `requested`, `applied`, and `reason` fields.
3. Type `applied` as `"claude"`.
4. Add optional `seatDefaulted` to `EffectResult`.
5. Document successful degradation/provenance semantics.

Verify unchanged effects compile because the field is optional and no runtime dependency appears.

## Step 2 — Materializer disposition

Modify `src/play/materialize.ts`:

1. Import `AgentSeat` and `SeatDefaulted` as types.
2. Define the local typed default-seat constant.
3. Add optional `seatDefaulted` to `MaterializeResult`.
4. Remove `UnknownSeatError`.
5. Replace the throwing guard with effective-seat/report derivation.
6. Preserve the raw unknown request in the report.
7. Pass `undefined` rather than the unknown request to ticket rendering.
8. Return the report only when present.
9. Update comments that describe refusal.

Verify omitted seats retain old bytes, `codex` stamps, and `kodex` writes without a stamp.

## Step 3 — Effect forwarding

Modify `src/play/decompose-effect.ts`:

1. Remove the `UnknownSeatError` import.
2. Read `seatDefaulted` from `MaterializeResult`.
3. Conditionally include it on `EffectResult`.
4. Remove only the unknown-seat catch arm.
5. Keep collision/bare-code outcomes and unexpected rethrow unchanged.

Verify the validator executes after unknown-seat materialization and success has no outcome.

## Step 4 — Direct materializer coverage

Modify `src/play/materialize.test.ts`:

1. Remove the deleted error import.
2. Assert known-seat result has no marker.
3. Replace the old refusal with paired default/`kodex` mints.
4. Use multiple tickets.
5. Assert the exact marker object.
6. Compare every corresponding file byte-for-byte.
7. Explicitly assert no degraded ticket contains `agent:`.

Run:

```bash
bun test src/play/materialize.test.ts
```

## Step 5 — Effect coverage

Modify `src/play/decompose-effect.test.ts`:

1. Retain the production input assembly route.
2. Add marker absence to the `codex` test.
3. Replace unknown failure with `kodex` degraded success.
4. Require exactly one validator call.
5. Assert `ok:true`, no outcome, and exact report.
6. Assert complete artifact count.
7. Mint a no-agent baseline in another temporary root.
8. Compare story and ticket bytes exactly.
9. Explicitly assert no `agent:` key.

Run:

```bash
bun test src/play/decompose-effect.test.ts
```

## Step 6 — Combined focused tests

```bash
bun test src/play/materialize.test.ts src/play/decompose-effect.test.ts
```

Do not weaken exact byte comparisons if a failure exposes unexpected renderer movement.

## Step 7 — Full gate

Run:

```bash
bun run check
```

This includes BAML codegen, typecheck, and the full test suite. Confirm:

- no production `UnknownSeatError` references remain;
- the effect no longer produces `unknown-seat`;
- the historical ledger literal remains;
- ticket phase/status frontmatter is untouched.

## Step 8 — Progress and commit

Write `progress.md` with completed steps, commands, deviations, files, and remaining work. Commit
only ticket-owned production, tests, and work artifacts; exclude pre-existing Lisa/board changes.
Allow the pre-commit hook to run and never bypass it.

Suggested subject:

```text
fix(play): default unknown materialize seats (T-070-01-02)
```

## Step 9 — Review

Inspect `git diff --check`, `git status --short`, and the ticket commit. Write `review.md` with
changes, acceptance results, test evidence, scope exclusions, and open concerns. Do not edit the
ticket frontmatter. Stop after review; Lisa owns transitions.

## Test matrix

| Case | Effective seat | Marker | Effect outcome | Expected |
|---|---|---|---|---|
| omitted | none | absent | absent | old default bytes |
| `claude` | claude | absent | absent | explicit claude stamp |
| `codex` | codex | absent | absent | explicit codex stamp |
| `kodex` | none | requested/applied/reason | absent | full default-byte board |
| collision | irrelevant | no result | `id-collision` | refusal unchanged |
| bare code | irrelevant | no result | `bare-code` | refusal unchanged |
| validator fails | disposition preserved | forwarded if defaulted | existing | `ok:false` |

## Stop conditions

- If `KNOWN_SEATS` no longer contains `claude`, stop because the named default conflicts.
- If T-070-01-01 lands an incompatible marker, adapt only within this ticket's files.
- If the full gate fails solely from unrelated concurrent board work, record exact evidence.
