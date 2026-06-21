# T-045-02 — Plan: execute the settle

Ordered, independently-verifiable steps. The analysis is done (see structure.md); this sequences the
capture, the one doc edit, and the gate. No code, so the "tests" are the audit re-run + `lisa
validate` + `bun run check` (already green at baseline: 1087 pass / 0 fail).

## Step 1 — Pin the forward numbers (DONE in research/structure)
- `bun run src/cli.ts audit` → forward (live) **10**, 9/10 untouched.
- Revive-path composition (`readRuns`/`reviveRecord`, not raw grep) → forward-10 = **5 cleared /
  5 censored (3 budget-exhausted + 2 timed-out) / 1 genuine `--intervened`**.
- **Verify:** the two numbers agree (audit's `9/10 untouched` == 10 reported − 1 intervened). ✓

## Step 2 — Confirm E-044 live (concrete #1)
- Read T-045-01 `progress.md` / `staged/steer.md`: fresh #1 = "Build the typed multi-node DAG";
  self-referential signal absent board-wide; cleared into E-046 (`typed-dag-fan-out-join-substrate`).
- **Verify:** #1 is concrete product demand, not a meta-task. ✓

## Step 3 — Confirm E-043 live (no orphan) + the partial-chain caveat
- Epic files 45→46 (only E-046 new); `grep '^title:' docs/active/epic/E-0*.md | uniq -d` empty (no
  duplicate-title card).
- E-046 has no `S-046*`/`T-046*` on disk; its `decompose-epic` record is `budget-exhausted`.
- **Verify:** single clean mint (E-043 held) AND E-046 is a partial chain (P7 censor), recorded as
  such — not mislabeled an orphan, not hidden. `lisa validate` green. ✓

## Step 4 — Write the ≥10-bar verdict (the load-bearing call)
- Compose the verdict text: **MET** (no under-claim) + didn't-break caveat (no over-claim:
  bar-met, not bulletproof; 1 genuine intervention is the thin stress signal).
- **Verify:** verdict cites forward-only numbers; contains both the "met" claim and the caveat;
  uses neither "bulletproof"/"forward-confirmed-robust" nor a hedge that erases the met bar.

## Step 5 — Update `docs/active/demand.md` (Frontier 1) — the only mutation
Edit two regions:
1. **`In flight` table row** (line ~88): change `forward-e1-cadence-sweep` status from `active →
   E-045 … Awaiting lisa loop` to a **settled** reading — ≥10 bar **met**, composition, E-043/E-044
   confirmed, E-046 partial chain. (Keep the row; this frontier is a *cadence*, the sweep continues.)
2. **Frontier 1 `Pullable signals`** (the `Accrue cleared forward-E1 to ≥10` bullet, ~line 103):
   update from "pulled → E-045 (in flight)" / "8/10" to the post-settle state: forward **10/10 bar
   met**, composition, the upgrade provisional→bar-met (not bulletproof), and that genuine-intervention
   depth (1) is now the *next* cadence target, not the sample-size bar.
- Also reflect E-046 as a newly-minted (partial) Frontier-3 chain where the board already lists the
  DAG signal (note it's minted-but-un-decomposed; a future pull resumes decompose).
- **Verify:** `demand.md` reads forward-only, states met+caveat, names E-043/E-044 live + E-046
  partial chain. No combined-pool number presented as the verdict basis.

## Step 6 — Gate: `bun run check`
- Re-run `bun run check`; doc-only edit ⇒ expect unchanged green (1087 pass / 0 fail).
- **Verify:** exit 0, 0 fail. (AC#5)

## Step 7 — progress.md + review.md
- `progress.md`: step log + the settle verdict recorded.
- `review.md`: handoff — what changed (demand.md + artifacts), the verdict, test coverage (n/a code;
  gate green), open concerns (E-046 needs a decompose pull to finish its chain; genuine-intervention
  depth still 1 — the next cadence target).

## Testing strategy
No unit/integration tests added — this ticket reads already-green seams (`auditWalkAway`, E-043's
`propose-effect.test.ts` double-run guard, E-044's prompt-only contract tests). Verification is
empirical (audit re-run, `lisa validate`, revive-path composition) + the regression gate
(`bun run check`). The structural guarantees for E-043/E-044 are their existing shipped tests; this
settle confirms them *live*, which no unit test can do.

## Branch outcomes (all recorded honestly)
- **Bar met (actual):** forward 10 ≥ 10 → provisional → bar-met + caveat. ← this run.
- (Hypothetical, not taken) Bar short: would record "N short, go stays provisional, cadence
  continues." Not applicable — 10 reached.
