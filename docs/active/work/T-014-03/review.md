# T-014-03 — Review

*The handoff: what changed, how it's verified, what a reviewer must know. This is the
**synthesis** ticket (PRD KR4) — it consumes the E1/E2 instruments from T-014-01/02 and
returns the epic's go / reroute decision.*

## What this ticket delivered

A one-page **findings note** (`docs/active/work/T-014-03/findings.md`) that reads the two
evidence instruments and returns the decision: **HOLD — do not green-light the
macro-wallet; the gate is not yet satisfied because neither number has been collected.**
Plus a one-line bridge on `demand.md` so the board reflects the verdict.

## The headline finding (read this first)

Both instruments are **built, tested, committed, and green** — but **unfed**:
- **E1 (trust):** `.vend/runs.jsonl` has 10 records, **0** carrying the `intervened` bit
  (the instrument is forward-looking; no run predates it). Walk-away rate reads "no
  self-reports yet." KR1 (≥10 reports) **unmet**.
- **E2 (consistency):** no `run-probe.ts` sweep has been run, so the variance-reduction
  number does not exist yet.

Therefore the gate **cannot return "go,"** and "not-yet-measured" is honestly distinct from
"weak" — so it does not trigger an E1-weak or E2-weak reroute either. The correct verdict is
**HOLD**, with the decision rule pre-wired so the eventual measurement sprint produces a
two-line read, not another synthesis cycle. This is the evidence-based call the PRD's whole
thesis demands (don't build on unproven assumptions); the macro-wallet was already gated in
`demand.md` behind a **go** verdict, and HOLD keeps it gated.

## Files

### Created (the deliverable)
- **`docs/active/work/T-014-03/findings.md`** (~95 lines) — the one-page note: TL;DR verdict
  → the two numbers (one paragraph each, E1 `vend audit` fragment fenced verbatim) → the
  decision (HOLD + 3-branch rule table + measurement-sprint next pull) → sample limits →
  how-to-produce commands → citations.

### Modified (the bridge)
- **`docs/active/demand.md`** — one `Status (T-014-03): HOLD …` line appended to the
  macro-wallet entry's existing "⚠ Gated by E-014" note, pointing at findings.md.

### RDSPI work artifacts (this dir)
- `research.md`, `design.md`, `structure.md`, `plan.md`, `progress.md`, `review.md`.

### Not touched
- **All of `src/`** — no code change. By design (Design Option C: synthesis + decision, not
  a feature). The instruments were complete and committed in T-014-01/02.
- **`.vend/runs.jsonl`** — read-only; populating it is the human measurement sprint.

## How it satisfies the acceptance criteria

- **AC1 — the two numbers, one-paragraph read each.** ✓ E1 (unrecorded; the andon 40–50% vs
  10% is observable but contaminated by failure-test epics E-900/E-901 — not a trust read)
  and E2 (not yet measured; the censoring-inflation caveat stated). Each is a full paragraph
  with its current state.
- **AC2 — explicit go / reroute + the concrete next pull per branch.** ✓ Verdict **HOLD /
  not-go**; a rule table names the next pull for E1+E2-green (un-gate the wallet), E1-weak
  (promote andon-UX), and E2-weak (promote the consistency-promise fix); the **measurement
  sprint** is the named next pull *now*.
- **AC3 — honest about the sample's limits.** ✓ One self-reporting user, ≤5 casts/arm, one
  epic, contaminated andon sample; "a directional steer, not a proof."
- **AC4 — `bun run check:*` green; numbers are the human sweep step.** ✓ 467 pass / 0 fail,
  typecheck clean (run twice; unchanged from the T-014-01/02 baseline). The note's "How to
  produce the numbers" section documents the human sweep commands, exactly as AC4 frames it.

## Test coverage

No new tests — and that is correct. This ticket adds **zero code**; it composes the output
of instruments already exhaustively unit-tested in their own tickets (T-014-01: 13
walk-away cases; T-014-02: 68 variance assertions). Re-testing here would duplicate.
Verification was **AC-mapping** (above) **+ the `check:*` regression guard** (green,
unchanged). The "live measurement" is the downstream human sweep, deliberately out of scope.

## Open concerns / limitations

1. **The decision is HOLD pending measurement — not a final go/reroute.** This is the single
   most important thing to carry forward. The instruments are ready but unfed; the verdict
   flips to go/reroute only after the human runs the sprint. The note pre-wires that read.
2. **The andon rate (40–50% vs 10%) looks alarming but is a test artifact.** The ledger
   includes deliberate failure-test epics (E-900/E-901). A reviewer must **not** read it as
   E1-weak evidence; the genuine A2 signal (walk-away rate) is unmeasured, not bad.
3. **The E2 number, once produced, must be read with its censoring caveat.** Gates buy
   consistency by censoring; a heavily-censored gated arm inflates the reduction toward
   100%. `formatVarianceReport` flags it; the note repeats the warning.
4. **Sample is structurally tiny** (one user, one epic, ≤5 casts/arm). Even a green verdict
   means "the assumptions didn't break," not "proven." Accepted per PRD §5.
5. **The measurement sprint is unscheduled.** It is the named next pull but requires a human
   to cast ≥10 `--intervened`/`--no-intervened` runs and one `run-probe.ts` sweep. Until
   then E-014's gate stays open and the macro-wallet stays gated.

## Critical issues needing human attention

None blocking. The one **action** a human owns: run the measurement sprint (the two command
blocks in findings.md), then re-apply the rule table to the populated numbers to flip HOLD →
go / reroute. No code review burden — the change is two documents and adds no surface area.
