# Structure — T-071-02-03

## Modified production files

### `src/play/decompose-effect.ts`

- Import `DEFAULT_RUN_LOG_PATH` and `loadRunLog` from the ledger module.
- Import `inferDefaultSeat` from the pure lane-heat reader.
- Add one small impure composition before `materialize`.
- Compute `seatInferred` only when `ctx.inputs.agent` is absent.
- Compute `effectiveAgent` as explicit agent first, inferred seat second, otherwise undefined.
- Pass `effectiveAgent` through the existing materializer parameter.
- Spread `seatInferred` into the successful effect result only when inference happened.
- Preserve graph refusal, `--after`, collision, bare-code, validation, and seat-default behavior.

### `src/engine/play.ts`

- Add a play-generic `SeatInferred` structural interface with `seat` and `reason`.
- Add optional `seatInferred` to `EffectResult`.
- Keep it adjacent to `SeatDefaulted` as effect disposition/provenance data.
- Do not import lane policy or run-log types.

### `src/engine/cast.ts`

- Import/type the new effect marker from the play contract.
- Add local `seatInferred` state beside `seatDefaulted`.
- Assign it directly from the effect result.
- Spread it into the final `appendRunLog` input only when present.
- Optionally surface a concise stdout provenance line, parallel to defaulting.
- Do not include it on early refusal paths where no effect ran.

## Modified test files

### `src/engine/cast.test.ts`

- Extend the addon-free fixture plan to cover every-ticket stamping.
- Add helpers that create/write normalized ledger records at the production project path.
- Add a direct effect-level cast test for hot-Claude inference.
- Add a both-cool byte-comparison test.
- Add an explicit-agent override test.
- Add a chain test using `castChain`, a producing fixture first step, and the same effect-bearing
  decompose fixture as the second step.
- Keep all execution token-free via the injected stub executor.

### `src/play/decompose-effect.test.ts` (only if needed)

- A smaller policy test may be added if cast integration does not isolate the effect decision well.
- Avoid redundant coverage if the real effect through `castPlay` already pins all branches.

## Public interfaces

```ts
interface SeatInferred {
  readonly seat: string;
  readonly reason: string;
}

interface EffectResult {
  // existing fields
  readonly seatInferred?: SeatInferred;
}
```

No new exported routing function is required. `inferDefaultSeat` and `loadRunLog` already provide the
necessary boundaries.

## Data flow

```text
direct run adapter ─┐
                    ├─ DecomposeInputs ─ decomposeEffect ─ materialize tickets
chain step adapter ─┘                         │
                 project ledger ─ load ─ inferDefaultSeat
                                             │
                                             └─ EffectResult.seatInferred
                                                        │
                                                        └─ castPlay ─ run record
```

## Ordering

1. Add the effect contract field so downstream code typechecks.
2. Compose ledger inference in the effect.
3. Forward provenance in the cast loop.
4. Add direct and chain integration coverage.
5. Run focused tests, typecheck/full gate, audit diff, then commit exact files.

## Ownership boundary

- No ticket/story frontmatter edits.
- No changes to `lane-heat.ts`, `run-log.ts`, `materialize.ts`, CLI parsing, or concrete chain wiring.
- No writes to `docs/active/work/T-071-02-03/`; Lisa publishes private artifacts later.
- Existing dirty `.lisa*`, `.codex/hooks.json`, and ticket metadata remain untouched.
