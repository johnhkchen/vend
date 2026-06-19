# T-019-01 — Plan: generalize the consistency probe

Ordered, independently-verifiable steps. Each step commits atomically.

## Testing strategy

- **Pure core (`consistency.ts`)** — fully unit-tested in `consistency.test.ts` (the AC's
  unit-test surface): `bun:test`, fabricated `ProbeResult[]`, no fs/clock/addon. The AC's three
  fixtures are the must-pass cases: all-same → 0 variance; mixed outcomes counted; honest-empty
  rate computed.
- **Impure harness (`run-consistency-probe.ts`)** — NOT unit-tested (house rule for impure
  verbs; run-probe precedent). Verified by (a) `tsc --noEmit` clean, (b) a one-shot live
  smoke-run against a seeded play, (c) reasoning-checked against run-probe's proven discipline.
- **Gate:** `bun run check` green (baml:gen + typecheck + test) AND `run-probe.ts` byte-for-byte
  unchanged (AC#3). `git diff --stat` must show only additions under `src/probe/`.

## Step 1 — Pure core: `src/probe/consistency.ts`

Write the module per structure.md: `ProbeOutcome`, `PROBE_OUTCOMES`, `ProbeResult`, `OutcomeMix`,
`ConsistencyReport`; `outcomeMix`, `consistencyReport`, `formatConsistencyReport`. Import only
`dispersion` + `SetDispersion` from `./variance.ts`. House-style header comment (purity + why
classification is elsewhere).

- **Verify:** `tsc --noEmit` clean.
- **Commit:** `feat(probe): pure consistency core — variance + outcome mix (T-019-01)`

## Step 2 — Pin the core: `src/probe/consistency.test.ts`

Cases from structure.md §test. Must include the three AC fixtures explicitly. Cover the
divide-by-zero (empty input ⇒ rates all 0, no NaN), the signal-only dispersion (honest-empty /
budget-exhausted do not perturb variance), the null-output-signal drop, and the `n < 2` caveat
in the formatter.

- **Verify:** `bun test src/probe/consistency.test.ts` green; full `bun test` green (no
  regression).
- **Commit:** `test(probe): cover consistency core to the branch (T-019-01)`

## Step 3 — Impure harness: `src/probe/run-consistency-probe.ts`

Write per structure.md: `ProbeTarget`, `decomposeTarget` + `surveyTarget` builders, copied
temp-ledger helpers (`initLisaProject`/`seedTempRoot`/`collectOutput`), `classifyRun`, `castN`,
`main`, and the `import.meta.main` CLI with arg validation. Value-import `decompose-epic.ts` +
`survey.ts` (self-registration). House-style header (impure sweep verb; not tested; the two
invariants).

- **Verify:** `tsc --noEmit` clean; `bun run src/probe/run-consistency-probe.ts` with no args
  prints usage + supported targets and exits non-zero.
- **Commit:** `feat(probe): any-play consistency sweep harness (T-019-01)`

## Step 4 — Live smoke + AC#3 guard

- Confirm `run-probe.ts` is unchanged: `git diff <base> -- src/probe/run-probe.ts` empty.
- Smoke the harness's *seeding + classification path* without burning a full N×live-model sweep
  where avoidable: at minimum a `--no-cast` / dry path is **not** in scope, so instead verify the
  wiring by a small live cast only if the environment permits `lisa`/`claude`; otherwise record
  the smoke as "deferred to T-019-02 sweep" in progress.md (run-probe itself was proven the same
  way — live at sweep, not in CI).
- **Verify:** `bun run check` fully green.
- **Commit:** folded into Step 3 if no code change; else `chore(probe): …`.

## Step 5 — Final gate

- `bun run check` green end-to-end.
- `git diff --stat` shows only new files under `src/probe/` (+ this work dir).
- Write `progress.md` then `review.md`.

## Risk table

| Risk | Likelihood | Mitigation |
|---|---|---|
| Honest-empty marker for survey drifts from the effect's prose | med | `isAbstention` keys on a stable substring (`"no demand staged"`); documented as a known coupling in review.md; default predicate (null/blank) is the safety net |
| Harness can't run live in this session (no `lisa`/`claude`/network) | high | Harness logic mirrors proven run-probe; verify by typecheck + reasoning; defer live N×sweep to T-019-02 (the sweep ticket) — same as run-probe's proving path |
| Accidentally touching `run-probe.ts` (AC#3) | low | Copy (not import) shared helpers; explicit `git diff` guard in Step 4 |
| `addon one-call-per-process` flakiness | low | No `bun test` value-imports the harness or the play modules; the pure core imports only `variance.ts` |
| Budget too low ⇒ all budget-exhausted (run-probe's first-sweep bug) | med | Per-cast budget defaults to the play's **recalibrated** budget; token override arg available |

## Out of scope (documented seams, not this ticket)

- Wiring expand/propose/steer probe targets (add a `ProbeTarget` entry — no core change).
- Running the actual sweep + producing findings (that is **T-019-02**).
- Any change to `castPlay` to surface parsed output (classification stays harness-side).
