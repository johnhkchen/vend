# Steer jank ledger — observed at the 2026-07-13 proving moment

Context: board fully swept (E-001..E-077), rc.7 just published, fresh `vend steer` cast from
the installed binary as the canonical "what now?" gesture. Run: run-2026-07-13T17-07-45-166Z,
340s wall, success. The board it staged was excellent — fresh, evidence-grounded, correct about
every swept rung, with two genuinely strategic forks. The jank is all in the *experience around*
the cast, not the judgment inside it:

1. **Pre-cast silence.** The gesture gives no acknowledgment of scope or funding before tokens
   flow — no "reading the board (77 epics / 229 tickets), funding ~40m/400k". The humane funding
   echo (E-072) only fires on an explicit `--budget`; the default-envelope path says nothing
   until the progress line starts. The two-gesture promise deserves a one-line receipt at the
   counter.

2. **Live spend undercounts by ~2×.** Final live line read `105k/400k tokens`; the ledger's
   true weighted spend was ~214k. The live accumulator deliberately skips the terminal
   cumulative usage and only folds per-message increments — so the number an operator watches is
   neither sampled-only nor cumulative, and isn't labeled as either. This is the lisa field
   report's measurement-vocabulary ask reproduced on our flagship gesture, after E-077 shipped
   the detect-after label. The label landed; the number itself is still misleading.

3. **The ledger's `turnsUsed` field still records the wrong unit.** Summary printed
   `agent turns: 9; executor conversation events: 20` — the ledger recorded `turnsUsed: 20`
   (events). Across recent runs the recorded field has been 2, 20, and 45 for comparable casts.
   T-072-04-01 fixed the display; the *durable record* — what recalibration and envelopes read —
   still mixes units. This quietly poisons the turn dimension of every envelope.

4. **No turn denominator on steer.** The line shows bare `turn 9` (decompose shows `turn N/15`).
   Steer has no configured cap — fine — but the display inconsistency reads as a missing limit,
   not an unlimited one. Say `turn 9 (no cap)` or give steer a cap.

5. **Board succession is silent.** The new steer.md overwrites the old in place. Four unpulled
   rows from the July 11 board (stop-reason threading, prompt ordering, SVG accessibility,
   detached/notify) vanished — correctly re-ranked below the cutoff, but the operator cannot
   distinguish "dropped as done" / "re-ranked below cutoff" / "forgotten". A one-line
   `superseded` trailer (what carried, what dropped and why) would make succession legible.
   (Git history holds the old board, but that's archaeology, not UX.)

6. **Steer's own finding (row 4 of the new board): the go-and-see snapshot lies about src.**
   All four articulation plays pass `srcFiles: []` by design and the snapshot renders
   `Source modules (src/**): (none)` — a false claim on any code-bearing repo,
   indistinguishable from a genuinely empty project. Steer caught this itself and priced it
   (~1h). Honest-empty violated by the clearing house's own primary input.

Positive observations, for balance: wall-time and elapsed agree; the detect-after label and
humane envelope denominator work; the board correctly recognized all five swept rungs of the
practice ladder and produced the two forks (forward-E1 rehoming, TUI-vs-CLI+SVG v1) that ARE the
real strategic state of the project.

Disposition: items 2+3 are the sharp ones (measurement records feeding envelopes); item 6 is
already a priced row on the staged board; 1/4/5 are small polish. Candidate epic: "the steer
receipt" (1+2+3+4) — one honest counter, one honest line, one honest record.
