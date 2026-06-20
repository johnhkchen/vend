# T-023-02 — Progress

## Status: Implement complete — accept path taken

The measurement decided the branch. Semantic head verdict = **head-stable (1.00)** ⇒ the **accept**
path (design D3/D4): amend IA-17, no convergence lever built.

## What ran

1. **Baseline gate** — `bun run check` → 761 pass / 0 fail (the T-023-01 baseline at `f58ee52`). Clean
   start.
2. **The bounded survey head sweep (AC#1)** — `bun run src/probe/run-equivalence-judge.ts survey 3`,
   teed to `sweep-logs/survey-head.log`. Disposable temp root, live charter + board snapshot seeded,
   3 casts at 300k each into a temp ledger (no real-log/board pollution). All **3 → signal** (0
   honest-empty, 0 budget-exhausted) ⇒ non-vacuous head read. Verdict lines:
   - `run-to-run signal dispersion: 0.75 over 3`
   - `semantic equivalence: equivalent-diversity (1.00)` (whole-board)
   - `top-pick stability: head-flips (0.00) [lexical exact-match]`
   - `top-pick stability: head-stable (1.00) [semantic judge]` ← **authoritative**
3. **Read the verdict, selected the branch (the pivot)** — semantic head = `head-stable` ⇒ **accept**.
   The three #1 picks (recovered from the surviving cast-3 board) were the same keystone scaffold
   pull, reworded — exactly the head-stable / lexical-flip pattern. Branch warranted by the printed
   line, not chosen to suit it.

## What landed (accept path — docs only, no `src/**` change)

| File | Action |
|---|---|
| `docs/active/work/T-023-02/sweep-logs/survey-head.log` | the live N=3 sweep transcript (IA-8 — no silent caps) |
| `docs/active/work/T-023-02/findings.md` | **AC#1** — head-vs-tail verdict, warranted path recommendation-first (IA-5), honest-sample block (IA-8) |
| `docs/knowledge/information-architecture.md` | **AC#2** — IA-17 survey clause amended to *tail-divergence-by-design*; the "lever must first isolate…" hook resolved |
| `docs/active/work/T-023-02/{research,design,structure,plan,progress}.md` | RDSPI artifacts |

## Deviations from plan

- **None structural.** The plan's Step 3b (the converge / consensus-lever build) was **not taken** —
  by design, it is the head-flips branch and the head was stable. The pure `consensus.ts` core +
  `run-consensus.ts` harness designed in structure.md/D5 are deliberately **not built** (no source
  code changes on the accept path).
- **One honest observation added beyond plan:** this sweep's *whole-board* read came back
  `equivalent-diversity` (1.00), where E-022's came back `genuine-disagreement` (0.00). Recorded in
  findings as the between-sweep whole-board swing — it strengthens, not weakens, the accept case (the
  head held while the whole-board judge swung). Not a deviation from the decision rule; the semantic
  *head* line is the authoritative input and it is unambiguous.

## ACs

- **AC#1** ✅ — sweep ran (bounded N=3, logged); head-vs-tail verdict in `findings.md`.
- **AC#2** ✅ — warranted path taken: head-stable → IA-17 amended to *tail-divergence-by-design*, no
  lever.
- **AC#3** ✅ — honest about the sample (N=3 directional); no lever ⇒ no unmeasured success claim; the
  whole-board swing is reported, not hidden.
- **AC#4** — `bun run check:*` green (see review; no `src/**` touched ⇒ unchanged from baseline).
