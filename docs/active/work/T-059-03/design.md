# T-059-03 — Design: how the corrected re-drive is conducted and captured

The decision: **prove the make-or-break input fix deterministically and for free, run every
free preflight step live, and hand off the single metered board cast as the human-authorized
step (P7) with a complete capture protocol — never fabricating the captured numbers.** This
section enumerates the options and explains why.

## The central tension

The ticket asks for two things that pull against each other under autonomous execution:

1. A **live, metered** drive that stages a real board and re-captures a **positive** gold
   master with **real spend/host/model** numbers.
2. That the **spend is human-authorized (P7)** — stated three times in the ticket ("the one
   metered cast of this epic"; "the human running the drive authorizes the metered spend";
   "the spend is human-authorized").

The honest-on-outcome discipline makes the resolution non-negotiable: the EXPECTED-OUTCOME
gold master is headed **"✅ CAPTURED, NOT A TARGET"** — its numbers are real or absent.
Producing a positive gold master with invented spend/board numbers would be the single worst
failure available here (laundered evidence dressed as a closed make-or-break). So the design
must maximize what is *honestly provable now* and cleanly delegate what *requires authorized
spend* — without ever blurring the two.

## Options considered

### Option A — Autonomously run the metered `vend steer` cast and capture the numbers
Run `doppler run -- bun run vend steer` in the sandbox, read the staged board, write the
positive gold master from the real output.
- **Pro:** fully closes AC1/AC2 in one pass; produces real numbers.
- **Con:** spends real money with **no human authorization** — directly contradicts the P7
  gate the ticket makes an acceptance criterion, and the harness rule on hard-to-reverse /
  outward-facing actions (a metered API cast). The T-058-05 precedent is explicit: Lisa wrote
  the trail (`wip(T-058-05): live drive pending`), a **human** ran the metered drive
  (`b9751f0`). **Rejected** — it violates the very criterion (AC4/P7) it would claim to meet.

### Option B — Fabricate plausible positive numbers from the diagnostic board
Reuse the T-058-05 diagnostic (4 signals, 2 forks, $0.91) as the "re-drive" result.
- **Con:** evidence laundering. The diagnostic was a *hand-modified* charter path, explicitly
  labeled "not the shipped flow." Presenting it as a captured re-drive is exactly the
  honest-on-outcome failure the discipline forbids. **Rejected, categorically.**

### Option C — Stop at R/D/S/P and declare the live drive "out of scope for the agent"
Write the four planning artifacts, leave Implement empty.
- **Con:** abandons the strongest honest evidence available. The make-or-break root cause
  (SEED.md never in steer's input) is **provable for free** by assembling steer's input. Not
  doing so leaves the ticket weaker than it can honestly be. **Rejected** — under-delivers.

### Option D (CHOSEN) — Free deterministic proof of the input fix + free preflight live +
metered cast handed off with a complete capture protocol and a clearly-marked scaffold
Execute everything that is free and real; prove the input root-cause fix deterministically;
delegate only the metered board generation to the human with a one-command re-run block and a
gold-master scaffold whose unfilled slots are loudly marked `⟪FILL FROM LIVE RUN⟫`.

## Why D, grounded in the research

The A3 root cause was **input wiring**, not the articulation engine (T-058-05 proved the
engine sound via the diagnostic board). Therefore the make-or-break can be split:

- **The fix is in the input** — and the input is **free to assemble**. Research confirmed
  `assembleSteerInputs` is fs-only; calling it without `castPlay` yields the exact
  `{project, charter}` the model will read, at zero spend and deterministically. Running it on
  a freshly-`vend init`'d sandbox **directly demonstrates** that the team-finder line and the
  hackathon charter now reach steer — i.e. the precise gap that caused the empty steer is
  closed. This is stronger than a single live board: it is *deterministic* and *re-runnable in
  CI-time*, where a live cast is probabilistic and metered.
- **The board generation is the model's job** — probabilistic, metered, and gated on P7. It
  is the one step D delegates. Given a corrected input that visibly contains a real demand
  gradient, the honest-empty rule (`baml_src/steer.baml:71`) no longer has grounds to fire;
  the expectation is a non-empty board. But *expectation is not capture* — so D writes no
  board numbers it did not observe.

This mirrors how the consistency contract treats validity: the **gate** (here, "does steer's
input carry a grounded intent?") is what's provable and what matters; the exact wording of the
board is "comparable, not identical" and belongs to the live run.

## The capture protocol (what the human does, and what they must not have to invent)

1. Author the metered drive under Doppler (`doppler run -- …` or the project's `just` recipe)
   in a tmpdir sandbox, funding steer generously (finding #2: ≥ the 2 h default time axis).
2. Read the staged `docs/active/pm/staged/steer.md`; confirm ≥1 signal traces to the
   team-finder line; `vend svg` to render it beside the Astro preview.
3. Optionally continue `vend work` until the expected decompose andon (finding #3) — record
   where it stops.
4. Fill the gold-master scaffold's `⟪FILL FROM LIVE RUN⟫` slots with the **observed**
   spend/host/model/board, flip the banner to CAPTURED, and accrue the forward-E1 record.

D produces steps 1–4 as an executable plan + a scaffold, so the human's burden is *run and
paste*, never *reconstruct*.

## Honest boundaries baked into the design

- The committed `EXPECTED-OUTCOME.md` (the negative gold master) is **left untouched** until a
  real positive drive exists. The positive version lives as a clearly-marked **draft scaffold**
  in the work dir — it cannot be mistaken for captured.
- Findings #2 (budget envelope) and #3 (`codebase-memory-mcp` absent) are recorded as the
  honest stop points, not papered over — they are *expected* boundaries of this drive's scope.
- A3 is recorded as **"input fix proven free; positive board capture pending human-authorized
  cast"** — honest about exactly which half is closed and which awaits spend.

## What success looks like for this ticket

The make-or-break input fix is demonstrated green and deterministic; the free preflight is
green and recorded with real exit codes; the metered capture is set up so a human closes it in
one authorized command; and nothing in the trail claims a number that was not observed.
