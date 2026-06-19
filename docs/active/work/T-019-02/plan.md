# T-019-02 — Plan: ordered, verifiable steps

Each step is independently checkable. Testing strategy first, then the sequence.

## Testing strategy

- **No new unit tests.** The change extends the IMPURE sweep harness only (the house rule: impure
  verbs — `castPlay`, fs, seeding — are proven live, not unit-tested; their judgment is the already-
  tested pure core `consistency.ts`). T-019-01's 10 core tests still cover the tally + dispersion.
- **Typecheck is the static gate** for the harness edit (`bun run check:typecheck`).
- **CLI-guard smokes** (no model spawn) prove the dispatch/usage wiring: no-args, unsupported play,
  `expand` without a fragment → usage banner + exit 2.
- **The live sweep is the behavioral verification** (AC#4) — the human/loop verification at sweep;
  attempted here expand-first, real numbers folded into `findings.md`.
- **`bun run check` green** is the merge gate (AC#4): `baml:gen` + typecheck + 586 tests.

## Steps

### Step 1 — Extend the harness (`src/probe/run-consistency-probe.ts`)
Add the value-imports, `expandTarget` / `steerTarget`, the `resolveTarget` cases (make it `async`,
read the fragment file for expand), and `SUPPORTED`. Per `structure.md`.
**Verify:** `bun run check:typecheck` clean.

### Step 2 — Author the fixed grounded fragment
`docs/active/work/T-019-02/fixtures/grounded-fragment.txt` — one paragraph, real board-backed need
(D2), so expand's correct outcome is a clean signal.
**Verify:** file present, non-empty, references a genuine demand.

### Step 3 — Green gate + guard smokes
`bun run check` (586 pass, typecheck clean). Then smoke the CLI guards (exit 2 + usage on
no-args / unsupported / expand-without-fragment). No model spawn.
**Verify:** check green; each guard prints usage and exits non-zero.

### Step 4 — Launch the live sweep (background, expand-first)
`bun run src/probe/run-consistency-probe.ts expand <fragment> 3` in the background (the direct
E-016 confirm/refute — highest value, cheapest). Then survey (`… survey 3`) and steer (`… steer 3`)
as time/quota allow. Capture stdout (the per-cast `outcome → probe-outcome` lines, the
`formatConsistencyReport` line, the raw `RunOutcome` tally) to a log file under the work dir.
**Verify:** the temp root is disposable (no `.vend/runs.jsonl` or live board mutation); each cast
logs an outcome; the report line prints.

### Step 5 — Write `findings.md` (the deliverable)
E-014 shape (D7). Fold in real numbers per completed arm; report any unfinished arm as *pending the
at-sweep run* with its exact command (never fabricated). Per play: dispersion + outcome mix +
honest-empty rate (read from the right denominator per D4 — mix for survey/steer, raw tally for
expand), and the verdict via the D5 3-branch rule. If "tune the gates": name the concrete
`demand.md` signal + `vend chain` pull string (AC#3). Honest-about-the-sample section (small N,
one input, directional not proof — E-014).
**Verify:** AC#1 (results in the note), AC#2 (per-play variance + mix + honest-empty rate +
verdict), AC#3 (tune branch names the demand.md bridge) all satisfiable from the note's content.

### Step 6 — progress.md + review.md
`progress.md` tracks step state + deviations as I go. `review.md` is the handoff: files changed,
coverage, open concerns (the expand honest-empty blind spot; any deferred arm; the kaizen signal).

## Risk table

| Risk | Likelihood | Mitigation |
|---|---|---|
| Live casts slow/expensive (2.85M tok ceiling) | high | N=3; expand-first; background; note stands on completed arms + E-016 prior; AC#4 carve-out |
| A cast times out / subscription hiccup | med | per-arm isolation (disposable temp root); report that arm as pending, not failed; raw tally honest |
| Expand honest-empty mis-read as budget-exhausted | certain (by design) | D4: read expand honest-empty from raw `gate-failed` tally + andon line, not the mix; documented |
| Live board snapshot changes between casts | low | the harness copies it once per sweep into the temp root (fixed across that sweep's casts) |
| Marker string drift (survey/steer) | low | `isAbstention` matches the exact heading + body substring confirmed from source |
| Starvation masquerading as inconsistency | med | D3: real recalibrated budgets, never a capped micro-sweep |

## Definition of done

- Harness runs on expand/survey/steer (AC#1); `bun run check` green (AC#4).
- `findings.md` states per-play variance + outcome mix + honest-empty rate + a clear verdict, honest
  about the small sample (AC#2); a "tune the gates" branch names the demand.md signal (AC#3).
- All six RDSPI artifacts present in `docs/active/work/T-019-02/`.
