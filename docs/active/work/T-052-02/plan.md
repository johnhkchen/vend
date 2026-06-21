# T-052-02 — Plan

_Ordered steps for the Implement phase. The work is: write the runner → cast LIVE → settle honestly.
No `src/` change, so the "tests stay green" gate is a baseline confirmation, not a code change to
guard. The verification criterion is **the cast's own evidence**, read honestly._

## Testing strategy (up front)

- **No new unit tests.** This ticket adds **zero `src/` surface** — the wiring it exercises is already
  unit-pinned by `graph-real-play-core.test.ts` (T-052-01: `realPlayMacro` arithmetic + the
  covers-all-four-nodes / not-per-node dispatcher proofs). Re-testing the pure wiring here would
  duplicate T-052-01. The runner (`cast-live.ts`) is an evidence artifact, run directly, never
  imported — by the house discipline it is not unit-tested (it value-imports the addon-loading shell).
- **The verification IS the live cast.** AC is satisfied by the `GraphResult` the cast produces, read
  into `graph-cast-log.md`. "Green" here means: (a) the baseline suite + typecheck still pass
  (nothing in `src/` moved), and (b) the cast's `cast-result.json` shows the join ran.
- **Honest-degrade is a valid terminal state of the artifact**, not a test failure: if the cast
  degrades, the settlement records it truthfully and flags the AC gap (Design §fallback).

## Steps

### Step 1 — Baseline gate (confirm nothing is red before the cast)
- Run `bun run check:typecheck` and `bun test`. Confirm green (T-052-01 left it at 1191 pass).
- Confirm `git status` shows only `docs/active/work/T-052-02/**` + the (untouched) ticket files —
  **no `src/` diff**.
- _Verify:_ typecheck clean, suite green, no `src/` changes staged.
- _Commit:_ none yet (artifacts commit at the end with the settlement).

### Step 2 — Write the runner `cast-live.ts` (Structure §module shape)
- Create `docs/active/work/T-052-02/cast-live.ts`: sandbox prep (copy `docs/` + `CLAUDE.md` into
  `.vend/live-proof/E052-<stamp>/`), `castRealPlayGraph({ projectRoot: SANDBOX, macroBudget: 2×
  realPlayMacro })`, dump `cast-result.json`, echo node lines + wallet readout, exit by outcome.
- _Verify:_ `bun build docs/active/work/T-052-02/cast-live.ts --target=bun` (or `tsc` over it via the
  project) type-checks the import paths; do **not** run it yet.
- _Verify:_ a `--dry` guard or a quick read-through confirms the cast target is the SANDBOX, never cwd
  (blast-radius check — Structure §boundaries).

### Step 3 — Pre-cast snapshot (so the run's evidence is isolable)
- Record `wc -l .vend/runs.jsonl` (the pre-cast line count) so the settlement can slice **only this
  run's** new rows out of the append-only log.
- Confirm `.vend/live-proof/E052-*` does not already exist (fresh sandbox per run).
- _Verify:_ pre-cast `runs.jsonl` length noted in `progress.md`.

### Step 4 — Cast LIVE (the metered spend — the heart of the ticket)
- Run `bun run docs/active/work/T-052-02/cast-live.ts 2>&1 | tee docs/active/work/T-052-02/cast-stdout.log`.
- This spawns ~4 real `claude -p` casts (survey + 2 proposes concurrent + note). Expect ~5–10 min wall.
- _Verify:_ the run exits; `cast-result.json` is written; `cast-stdout.log` captured; new rows appended
  to `.vend/runs.jsonl` (count grew by ~4).
- _Outcome branches:_
  - **JOIN ran** → proceed to Step 5 with the success record.
  - **JOIN skipped / degraded** → still proceed to Step 5, but settle the *degrade* honestly (record
    cause; mark AC#1 not-met-live). Optionally re-cast once (fresh sandbox) if the cause is transient
    (a model error, not a structural skip); do not loop.

### Step 5 — Settle: write `graph-cast-log.md` (Structure §section blueprint)
- Read `cast-result.json` + the new `.vend/runs.jsonl` rows (slice from Step 3's count) +
  `cast-stdout.log` + the minted artifacts under the sandbox (`<sandbox>/docs/active/epic/*.md`,
  `<sandbox>/docs/active/notes/*.md`).
- Write the 7-section settlement: raw records → Read 1 concurrency → Read 2 **join ran** → Read 3
  one-envelope spend → Read 4 verdict → AC checklist. Quote real numbers; no invented figures.
- _Verify:_ every AC clause maps to a quoted piece of evidence (Design §AC mapping); honest on any gap.

### Step 6 — Final gate + artifacts
- Re-run `bun run check:precommit` (the repo's gate: tests green) — must still pass (no `src/` change,
  so it should be untouched-green).
- Write `progress.md` (the implement log + AC mapping) and `review.md` (the handoff).
- _Verify:_ `check:precommit` green; all RDSPI artifacts present.

### Step 7 — Commit
- Stage `docs/active/work/T-052-02/**` (runner + evidence + artifacts). Do **not** stage the ticket
  frontmatter (Lisa owns `phase`/`status`). The `.vend/live-proof/E052-*` sandbox is gitignored — it
  is not committed (the evidence lives in `cast-result.json` + `graph-cast-log.md`, which ARE committed).
- Commit message: `chore(play): settle E-052 live JOIN cast under shared wallet (T-052-02)` with the
  honest one-line outcome (join ran / degraded) in the body.

## Risks & mitigations (carried from Design)

| risk | mitigation |
|---|---|
| tight envelope budget-stops the note → join skips | widened `macroBudget` = 2× `realPlayMacro` (Step 2 / Design D2) |
| thin survey board → < 2 signals → propose STOP → join skips | sandbox = copy of the rich vend board (Step 2 / Design D1) |
| live cast mutates tracked repo board | cast against `.vend/` sandbox via `projectRoot` (gitignored) |
| live cast fails / hangs / errors in this env | honest-degrade fallback (Step 4 branch); record cause, flag AC gap |
| can't isolate this run's run-log rows | pre-cast line-count snapshot (Step 3) |
| over-claiming the join in the verdict | AC-mapping table forces each claim back to quoted evidence (Step 5) |

## Definition of done

- `cast-live.ts` exists and ran; `cast-result.json` + `cast-stdout.log` captured.
- `graph-cast-log.md` settles the run honestly with the 7 sections + AC checklist, citing real
  evidence.
- Baseline gate (`check:precommit`/typecheck/test) green — no `src/` regression.
- `progress.md` + `review.md` written; artifacts committed (sandbox excluded — gitignored).
- **AC met** iff the cast shows `capture-note` materialized with 2 upstreams under one bounded wallet;
  otherwise the artifact honestly records the degrade and the open gap (the deliverable is the honest
  settlement either way).
