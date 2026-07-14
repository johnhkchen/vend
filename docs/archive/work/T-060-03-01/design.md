# T-060-03-01 — Design: how the re-drive runs and how the gold master flips

Grounded in `research.md`. Enumerates the real decisions for the live drive and the gold-master flip,
each with the rejected alternatives.

## The decision shape

This is a *capture* ticket: the "design" is the **drive protocol** (which flow, which flags, which
budget) plus the **shape of the positive gold master**. The acceptance criterion pins three artifacts:
(1) a sandbox runs.jsonl record showing ≥1 slice cleared with the reduced-grounding marker and no
instant budget-exhausted; (2) a cleared forward-E1 record accrued; (3) `EXPECTED-OUTCOME.md` committed
in its positive form. Every decision below serves those three.

## Decision 1 — Shipped flow, not the diagnostic hack

**Chosen:** Drive the **shipped** two-gesture flow exactly as a user would —
`copy → lisa init → vend init --template hackathon → vend steer → vend work → vend svg` — with **no**
`cat charter.md SEED.md > docs/knowledge/charter.md` hack.

**Why:** E-059 (confirmed in research §"The drive surface") makes `assembleSteerInputs` read `SEED.md`
tolerantly and the tuned charter at `docs/knowledge/charter.md`. The whole point of the positive gold
master is that the *shipped* path now renders the board. Keeping the diagnostic hack would prove
nothing new and would contradict the verdict we are trying to flip.

**Rejected:** Re-run the diagnostic re-steer (T-058-05 Step 6′). That step existed only to isolate
"empty because of input wiring" from "engine broken" when the shipped flow abstained. With the wiring
fixed there is nothing to isolate — the shipped steer IS the test. Running the hack would re-introduce
the staleness that forced `--stale-ok` last time.

## Decision 2 — Omit `--budget` on `vend work` (exercise the calibrated default)

**Chosen:** Run `vend work --no-intervened` with **no** `--budget`, letting it fall to the calibrated
cold-start envelope (T-060-02-02).

**Why:** Finding #2 (budget shape) is closed precisely by making the omit-default fund a cold-start
clear. The AC says "no instant budget-exhausted" — the cleanest live proof is to omit `--budget` and
watch the default authorize the first pull. work-core's unit tests assert `canAfford(price)` holds at
equality and the per-cast funding floor (350k tokens) funds each cast even on a cold ledger; this drive
is the first LIVE exercise of that path, which is exactly what E-060 wants demonstrated.

**Rejected:**
- *Pass the old corrected explicit budget* (`7300000,500000`). It would clear, but it would re-prove
  the T-058-05 workaround rather than the T-060-02-02 fix — the default is the thing under test.
- *Pass a deliberately tight budget* to re-show the failure. Pointless; that finding is already
  recorded in the negative gold master.
- **Contingency (not the plan):** if the omit-default instant-exhausts live (contradicting the unit
  tests), fall back to one explicit generous `--budget`, and record the discrepancy honestly as a
  finding — do **not** silently switch and claim the default worked.

## Decision 3 — `--no-intervened` to accrue forward-E1; record the marker

**Chosen:** Pass `--no-intervened` on `vend work` so every chain cast records `intervened:false`.

**Why:** The AC requires "a cleared forward-E1 record is accrued." Per research §"Forward-E1", that is
exactly a live `intervened:false` cleared run. The reduced-grounding marker rides automatically
(decompose degrades because the sandbox has no `.mcp.json`), so the same record carries
`reducedGrounding:true` — the "reduced-grounding marker set" the AC names.

**Rejected:** Leaving intervention unreported (absent). That would not accrue a *forward-E1* record
(the bit must be `false`, recorded at run time) — it would be an "unknown", failing the AC. We never
fabricate the bit, but a genuine walk-away drive legitimately reports `--no-intervened`.

## Decision 4 — No `--stale-ok` unless the freshness gate actually blocks

**Chosen:** Run `vend work` **without** `--stale-ok` first. `vend svg` between steer and work is
read-only and does not mutate the graph, and the shipped steer writes the board directly, so the
staged board should be fresh.

**Why:** `--stale-ok` was a T-058-05 artifact of the diagnostic re-steer touching `docs/knowledge/`.
Without the hack, the board should pass the freshness gate honestly. Cleaner drive = more faithful
gold master.

**Contingency:** If `work` blocks on staleness, add `--stale-ok` and note it as a deviation. (Low
risk; documented either way.)

## Decision 5 — Throwaway sandbox; capture records as durable evidence

**Chosen:** `mktemp -d` sandbox, `cp -R examples/templates/hackathon-seed/. $SANDBOX/`, strip
`node_modules/.astro/.vend`, drive via `VEND=$PWD/src/cli.ts`. After the drive, **copy the sandbox's
`.vend/runs.jsonl` into `docs/active/work/T-060-03-01/runs.jsonl`** as durable evidence (the sandbox
itself is ephemeral).

**Why:** Mirrors the T-058-05 protocol — the committed template is never mutated, only
`EXPECTED-OUTCOME.md` is written back. The captured runs.jsonl makes the forward-E1 + reduced-grounding
records reviewable without the sandbox, satisfying the "a runs.jsonl record … shows ≥1 slice cleared"
clause durably.

**Rejected:** Drive in-place over the committed seed (mutates the template, pollutes git) — violates
the "template not mutated" invariant. Drive in the main repo (`cd` to repo root) — would pollute the
real `.vend/runs.jsonl` and the real `docs/active/` graph with sandbox epics. The sandbox isolation is
the whole reason the prior drive used `mktemp`.

## Decision 6 — The positive gold master's shape

**Chosen:** Rewrite `EXPECTED-OUTCOME.md` so:
- The **capture banner** restamps the date/host/executor/spend from THIS drive (2026-06-29).
- The **headline verdict** flips: the *shipped* flow now produces a **coherent board** (not an
  honest-empty steer); the A3 finding is **closed** by E-059; ≥1 slice **clears** end-to-end with a
  reduced-grounding marker (decompose degrades, not andons) under the calibrated default budget.
- The **"What the drive actually yielded" table** shows the shipped-flow board items (was 0), forks,
  **slices cleared ≥1** (was "epic minted, decompose refused"), budget, and the forward-E1 record.
- The **"three follow-ups" section** flips from open findings to **closed** (each names the landing
  ticket: E-059, T-060-01-01/02, T-060-02-02), or is replaced by a short "what's still imperfect"
  (cold-start wallet overshoot, reduced-grounding depth) so the file stays honest, not triumphal.
- The **re-run block** drops the diagnostic hack and reflects the shipped flow + omit-`--budget`.

**Why:** The gold master is the re-runnable consistency bar; it must describe the flow that now works
and remain honest about residual imperfections (cold-start overshoot is acknowledged in the
T-060-02-02 review; reduced grounding is a real, recorded degrade, not a silent pass).

**Rejected:** A triumphal rewrite that hides the reduced-grounding degrade or the wallet overshoot.
That would violate honest-on-outcome and IA-8 (the quote is the p90 price, the degrade is real). The
positive gold master is "board renders AND a slice clears **with an honest reduced-grounding marker**,"
not "everything is now perfect."

## Decision 7 — Commit boundary

**Chosen:** One commit touching **only** `EXPECTED-OUTCOME.md` + `docs/active/work/T-060-03-01/`. Leave
`src/engine/cast.ts`, `src/log/run-log.ts`, the `*.test.ts`, and `justfile` unstaged (other tickets'
working-tree state). Do **not** edit ticket frontmatter (Lisa advances phases).

**Why:** Matches the T-060-02-02 review's disjoint-commit discipline and the RDSPI/concurrency rule
(commit only your ticket's files; file-locking serializes). The marker code is *active* for the drive
without being *committed by this ticket*.

## Failure handling (honest branches)

| If… | Then… |
| --- | --- |
| shipped steer renders an empty board | Do NOT flip to positive. Record that E-059 did not deliver on the live seed; stop and flag — this is a regression finding, not a pass. |
| `work` instant-exhausts on omit-`--budget` | Fall back to explicit `--budget`, record the discrepancy vs the unit tests as a finding; flip only if a slice then clears, noting the default needed help. |
| decompose andons instead of degrading | Do NOT flip. The graceful-degrade fix failed live; record and flag. |
| a slice clears but no `reducedGrounding` on the record | Investigate the marker wiring; the AC needs the marker present. Flip only once the marker is confirmed on the record. |
| `claude -p` auth/spawn fails | Stop; report the environment block honestly. No fabricated capture. |
