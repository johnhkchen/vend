# T-014-01 — Plan

Ordered, independently-verifiable steps. Each ends `bun run check` green and is committable.
Testing strategy: pure cores tested to the branch with fabricated inputs; impure verbs
(`appendRunLog`, the cli dispatch arm) deliberately untested (logic lives in the pure core),
per the house discipline.

---

## Step 1 — `intervened` field on the record (the durable contract)

**Edit** `src/log/run-log.ts`:
- Add `intervened?: boolean` to `RunRecordInput` and `RunRecord` (docs per structure.md).
- Add `normalizeIntervened(v): boolean | undefined` (boolean ⇒ itself, else undefined).
- `buildRunRecord`: compute `intervened`, conditional-spread it next to envelope/project.
- `reviveRecord`: `typeof r.intervened === "boolean" ? … : undefined`, conditional-spread.

**Test** `src/log/run-log.test.ts`:
- build with `intervened: true` ⇒ record has `intervened === true`.
- build with `intervened: false` ⇒ record has `intervened === false` (false is NOT absence).
- build with no `intervened` ⇒ `"intervened" in rec === false` (omitted, back-compat).
- build with a non-boolean (cast through `as never`) ⇒ omitted.
- `serializeRunRecord` round-trip → `JSON.parse` → `reviveRecord` preserves the bool.
- `reviveRecord` on a line with `intervened: "yes"` ⇒ field dropped, record still valid.
- `reviveRecord` on a pre-T-014-01 line (no field) ⇒ parses, `intervened` absent.

**Verify:** `bun test src/log/run-log.test.ts` green; `bun run check:typecheck` green.
**Commit:** "run-log: optional `intervened` bit (E1 trust capture)".

## Step 2 — write path: `cast.ts` + the thread

**Edit** `src/engine/cast.ts`: `CastOptions.intervened?: boolean`; conditional-spread into
the single `appendRunLog` call.
**Edit** `src/play/decompose-epic.ts`: `RunOptions.intervened?: boolean`; forward in
`assembleAndCast`'s `castPlay` opts.
(`dispatch.ts` unchanged — `opts` flows through.)

**Verify:** `bun run check:typecheck` green (no test — impure verbs, pass-through data).
**Commit:** "cast: thread `intervened` to the run-end append".

## Step 3 — the pure audit module

**Create** `src/ledger/walk-away.ts`:
- `TIER_ANDON_BUDGET` (IA-12 % side); reuse `DEFAULT_WINDOW`/`CENSORED_OUTCOMES` from
  recalibrate (import) or redeclare with a cite.
- Types: `OutcomeMix`, `CostVsEnvelope`, `InterventionStat`, `WalkAwayReport`, `AuditOptions`.
- `auditWalkAway(records, opts)`:
  - `scope = opts.play ? forPlay(records, opts.play) : records`, then `.slice(-(window))`.
  - outcome mix: seed all `RUN_OUTCOMES` to 0, count; `success`, `censored` (sum of
    `CENSORED_OUTCOMES`), `total`.
  - `andonRate = total === 0 ? 0 : (total - success) / total`; `andonBudget =
    TIER_ANDON_BUDGET[tier]`; `withinBudget = andonRate <= andonBudget`.
  - cost: over successes with `envelope.tokens>0`, push `totalTokens/env.tokens` and (when
    `wallClockMs!==null && env.timeMs>0`) `ms/env.timeMs`; medians or null; `n` = token pairs.
  - intervention: `reported = scope.filter(has bool)`, `intervened = count(true)`,
    `rate = reported? intervened/reported : null`; trend = split reported in half (earlier =
    first ⌊n/2⌋, recent = rest), each half's rate or null.
- `formatWalkAwayFindings(report)`: the E1 fragment (honest fallbacks).

**Verify:** `bun run check:typecheck` green.

## Step 4 — audit tests

**Create** `src/ledger/walk-away.test.ts` with a `rec(over)` factory. Cover every branch
named in structure.md §5 (mix, andon-vs-budget, cost null/non-null, intervention rate +
exclusion of absent-bit records + trend split + reported===0, format fallbacks).

**Verify:** `bun test src/ledger/walk-away.test.ts` green; full `bun test` green.
**Commit:** "ledger: pure walk-away audit (E1 trust numbers) + tests".

## Step 5 — CLI flag + `audit` verb

**Edit** `src/cli.ts`:
- `run` variant of `ParsedCommand` gains `intervened?: boolean`; `parseRunArgs` detects
  `--intervened` / `--no-intervened`; dispatch arm forwards into `runPlay` opts.
- `ParsedCommand` gains `audit` variant; `USAGE` gains the audit line; `parseArgs` routes
  `audit`; add `parseAuditArgs`.
- Impure `audit` arm: lazy-import `loadRunLog` + walk-away, print `formatWalkAwayFindings`,
  `exit(0)`.

**Edit** `src/cli.test.ts`: parse cases per structure.md §7.

**Verify:** `bun test src/cli.test.ts` green; full `bun run check` green.
**Commit:** "cli: `--intervened` flag + read-only `vend audit` (E1 findings surface)".

---

## Testing strategy summary

| Unit | Test? | Where |
|------|-------|-------|
| `buildRunRecord`/`reviveRecord` + `intervened` | yes (branch) | run-log.test.ts |
| `appendRunLog`, cast.ts, dispatch, decompose thread | no (impure pass-through) | — |
| `auditWalkAway`, `formatWalkAwayFindings` | yes (branch) | walk-away.test.ts |
| `parseRunArgs` (+flag), `parseAuditArgs` | yes | cli.test.ts |
| cli dispatch arm | no (impure shell) | — |

## Verification criteria (maps to AC)

- AC1 (optional `intervened`, back-compat, writable at run-end): Step 1 tests (absent ⇒
  omitted; false ≠ absence) + Step 2 thread + Step 5 flag.
- AC2 (pure audit returning andon-rate vs budget / outcome mix / cost-vs-envelope /
  intervention rate+trend, unit-tested incl. with & without `intervened`): Steps 3–4.
- AC3 (a surface prints the E1 findings fragment): `formatWalkAwayFindings` (Step 3) +
  `vend audit` (Step 5).
- AC4 (`bun run check:*` green; existing records unaffected): every step ends green; Step 1
  back-compat test proves existing records parse unchanged.

## Risks / deviations protocol

- If `--no-intervened` parsing collides with an existing `run` flag scan, prefer presence-
  detection (like `--all`) over value-consuming. Document any deviation in `progress.md`
  before proceeding.
- Keep `intervened` threading to the **`run` path only** (PRD anti-scope-creep). If a test
  tempts threading through `chain`/`select`, stop — that is out of scope; note it as a
  follow-up instead.
