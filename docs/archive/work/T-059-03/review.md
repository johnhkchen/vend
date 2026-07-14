# T-059-03 — Review: gold-master re-drive on the corrected seed

Handoff for a human reviewer. This ticket re-drives the E-058 flow on the **corrected** seed
(after T-059-01/02 wired the seed intent + tuned charter into steer's input) to turn the
negative gold master positive. It is **honest-on-outcome**: the make-or-break input fix is
proven free and deterministically; the one metered board cast is delegated to the human (P7),
not faked. **No `src/` change** — the deliverable is a captured artifact + the RDSPI trail.

## What changed

| File | Change |
| --- | --- |
| `docs/active/work/T-059-03/{research,design,structure,plan,progress,review}.md` | **created** — the RDSPI trail. |
| `docs/active/work/T-059-03/steer-input.proof.txt` | **created** — verbatim stdout of the free make-or-break proof (assembled steer input, no model cast). |
| `docs/active/work/T-059-03/EXPECTED-OUTCOME.positive-scaffold.md` | **created** — the positive gold-master **draft** with `⟪FILL FROM LIVE RUN⟫` slots; the human fills it after the authorized cast. |
| `examples/templates/hackathon-seed/EXPECTED-OUTCOME.md` | **UNTOUCHED** — the committed negative gold master stays until a real positive drive replaces it. |
| `src/**`, ticket frontmatter | **UNTOUCHED** (AC4; Lisa owns phase transitions). |

## The drive, and its honest outcome

Free track, all real exit codes (sandbox = throwaway tmpdir; committed template read-only):
`lisa init` ✓ → `vend init --template hackathon` (11 created / 7 skipped, no-clobber held) →
`vend doctor` (4/4 green) → `vend svg` (valid honest-empty SVG). Wiring guard:
`check:typecheck` clean; `bun test` on the T-059-01/02 files **64 pass / 0 fail**.

**The make-or-break (A3), proven free:** on the corrected sandbox, `assembleSteerInputs` now
emits a `## Stated intent (SEED.md)` section carrying the team-finder line, and the charter
steer reads is the hackathon value function — **not** the stub. This is the *exact* input that
was absent in T-058-05 and caused the honest-empty steer. The root cause is closed
deterministically, at zero spend (`steer-input.proof.txt`).

**The metered half, delegated:** the live `vend steer` board generation + the gold-master
capture is the one billed, human-authorized cast (P7). It was **not** run here (the ticket
gates the spend on the human three times; the cast needs Doppler secrets absent from the env).
plan.md Track 2 + the scaffold give a run-and-paste handoff.

## Acceptance criteria — honest status

- **AC1 — a live drive stages a non-empty grounded board off `SEED.md`, rendered on SVG.**
  **Partially met, honestly.** The input fix that *causes* a non-empty board is proven free and
  deterministically (the honest-empty rule can no longer fire). The live board cast itself is
  the delegated human-authorized step — not run, not faked. ⚠️→⏸️
- **AC2 — `EXPECTED-OUTCOME.md` re-captured positive + forward-E1; A3 closed.** **Set up, not
  closed.** The positive gold-master scaffold is written with every metered slot marked
  `⟪FILL FROM LIVE RUN⟫`; the committed file is untouched. A3's *input-fix* half is recorded
  **closed**; the *board-capture* half awaits the authorized cast. No number was invented. ⏸️
- **AC3 — honest boundaries recorded (findings #2 budget, #3 MCP).** **Met.** Both are written
  as the expected stop points in the scaffold + plan, not papered over. ✅
- **AC4 — no `src/` change; spend human-authorized.** **Met.** Zero `src/` change; the metered
  spend is left to the human. ✅

## Test coverage

- **No automated tests added** — by design (T-058-05 precedent): the seed is outside vend's
  `tsconfig include:["src"]`; there is no code to unit-test. The gates are the per-step CLI
  assertions in `progress.md` (real exit codes / output).
- **Vend's own suite stays green** — this ticket adds only markdown; typecheck clean and the
  measured wiring's tests are 64/0.
- **The product-level test is re-runnability** — encoded in the scaffold's re-run block;
  "comparable, not identical" is the bar.

## Open concerns / flags for a human

1. **The one remaining step is a metered, human-authorized cast (the load-bearing flag).** To
   fully close AC1/AC2: run `doppler run -- bun run "$VEND" steer --budget 7200000,400000` in a
   fresh sandbox (plan.md Step 6 / the scaffold's re-run block), confirm a grounded board,
   fill the `⟪…⟫` slots with observed numbers, flip the banner to CAPTURED, and copy the
   scaffold over the committed `EXPECTED-OUTCOME.md`. The free proof says the input is correct;
   only the live run can supply the real board + spend.
2. **Why the cast was not run autonomously.** The ticket gates the spend on P7 three times and
   the cast needs Doppler-injected secrets (a real money, outward-facing action). The
   honest-on-outcome discipline forbids the alternative (inventing a positive gold master).
   This matches T-058-05, where a human ran the metered drive after Lisa wrote the trail.
3. **The wiring under measurement is uncommitted.** T-059-01/02's `src/` edits sit in the
   working tree (`phase: done`). The free proof ran against that working tree — so the positive
   re-drive depends on those edits being committed/intact. Worth confirming they land before
   the human runs the authorized drive.
4. **Findings #2/#3 remain genuine boundaries** — a *full* slice clear (decompose → work) is
   still gated on `codebase-memory-mcp`; the budget envelope is a separate calibration. Both
   are out of scope here and recorded as such.

## Bottom line

The make-or-break of E-059 — *does the corrected seed put a real demand gradient where steer
reads it?* — is answered **yes**, proven deterministically and for free. The negative gold
master's root cause is closed. What remains is a single authorized cast to capture the live
board and flip the gold master positive; everything for that is staged so the human runs one
command and pastes. The honest split — proven-free vs authorized-spend — is the deliverable,
not a papered-over green.
