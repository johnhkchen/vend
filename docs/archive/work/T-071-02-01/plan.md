# Plan — T-071-02-01

## Step 1 — establish the pure result and policy surface

- Create `src/play/lane-heat.ts`.
- Import seats from `KNOWN_SEATS` and record burn from `totalTokens`.
- Define the recent tail size and decisive heat ratio as named constants.
- Define `InferredSeat` with `seat` and `reason`.
- Keep imports directed from play-layer reader to existing leaf contracts.

Verification:

- TypeScript accepts the derived `AgentSeat` values.
- Search confirms no seat-name literals in production reader.
- Search confirms there are no fs, clock, executor, or quota dependencies.

## Step 2 — implement aggregation

- Initialize one mutable local burn bucket per entry of `KNOWN_SEATS`.
- Restrict observation to the last `LANE_HEAT_WINDOW` records.
- Match `seatOfExecution` exactly against current known seats.
- Add `totalTokens(record)` only for matching attributed records.
- Ignore legacy absence and raw unknown/future seats.
- Do not mutate input records or registry values.

Verification:

- Empty and unknown-only fixtures produce no decision.
- A weighted fixture demonstrates output/cache pricing comes from `totalTokens`.
- A long fixture demonstrates records outside the tail do not contribute.

## Step 3 — implement conservative ranking

- Sort a fresh bucket array ascending by burn.
- Identify coolest and hottest entries.
- Return `null` if fewer than two seats are known.
- Return `null` if all burn is zero.
- Return `null` on exact high or low ambiguity.
- Return `null` when hottest burn is below `HOT_LANE_RATIO * coolest burn`.
- Return the unique coolest seat when dominance is decisive.
- Special-case zero cooler burn only for readable reason formatting, not decision math.

Verification:

- Clearly hot fixtures work in both lane directions.
- A 1.5x active pair returns null as both cool.
- Equal positive totals return null.
- Returned reason deterministically names weighted evidence.

## Step 4 — add colocated unit tests

- Create `src/play/lane-heat.test.ts`.
- Use `buildRunRecord` for normalized fixtures.
- Derive the two active seat names from `KNOWN_SEATS`.
- Assert the registry currently gives at least two seats for the ticket fixture.
- Cover all acceptance branches.
- Add regression teeth for cost weighting and recency.
- Assert the returned decision shape exactly.

Verification:

- Run `bun test src/play/lane-heat.test.ts`.
- Resolve failures in the ticket-owned files only.

## Step 5 — inspect and refine

- Review the diff for accidental scope expansion.
- Confirm the implementation has no lane literals.
- Confirm return types are readonly and public surface is minimal.
- Confirm comments do not claim quota/reset knowledge.
- Confirm multi-seat ambiguity returns null.

Verification:

- Run focused tests again if the implementation changes.
- Run `bun run build` if type feedback is needed before the full gate.

## Step 6 — run the repository gate

- Execute `bun run check`.
- Record BAML, typecheck, test counts, failures, and any expected skips.
- If unrelated concurrent changes cause failure, isolate evidence before changing anything.
- Do not weaken tests or bypass hooks.

Verification:

- Gate exits zero.
- All ticket tests pass within the full suite.

## Step 7 — commit the meaningful source unit

- Use `lisa commit-ticket` only.
- Ticket id: `T-071-02-01`.
- Include exactly `src/play/lane-heat.ts`.
- Include exactly `src/play/lane-heat.test.ts`.
- Use a concise ticket-specific message.
- Do not stage or commit attempt artifacts.
- Do not include Lisa/config/ticket-frontmatter changes.

Verification:

- Capture the returned commit hash.
- `git status --short` shows neither ticket-owned source path dirty/untracked.
- Unrelated pre-existing changes remain present and excluded.

## Step 8 — review and handoff

- Write `progress.md` with completed work, checks, commit, and deviations.
- Write `review.md` with outcome, file inventory, acceptance mapping, test coverage, and limitations.
- State honestly whether the numeric relative policy is inferred rather than provider-quota sourced.
- Remain on this ticket and stop after review; Lisa handles publication and completion.

## Planned commit shape

One source commit is appropriate because the reader and its proof are one inseparable pure unit.
There is no independently useful schema, effect, or integration change in this ticket.

## Rollback shape

The change is additive. Reverting the one Lisa commit removes the reader and tests without schema
migration or effects on existing call sites.

