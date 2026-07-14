# Findings — Survey's head is stable; the divergence is tail re-ordering (T-023-02)

> The decide half of E-023's survey-convergence question. T-023-01 built the head-isolating
> instrument; this note runs it on survey (N=3, logged, disposable temp ledger) and takes the
> **warranted path** the measurement dictates. **Recommendation-first** (IA-5): the deciding framing
> is the human's; the evidence and the warranted path are ours. **Small N → directional, not proof**
> (the E-014 honesty discipline).

## TL;DR — the recommendation

**Survey's load-bearing #1 pull is consistent run-to-run. The divergence E-022 measured is
tail re-ordering, not head instability — so the warranted path is `accept`, not `converge`.**

- **Measured verdict (semantic, authoritative):** `top-pick stability: head-stable (score 1.00)` —
  all 3 head-pairs judged the same pull (3/3 stable over 3 boards).
- **Warranted path:** **accept — no convergence lever.** Amend IA-17: survey's run-to-run divergence
  is *tail-re-ordering by design*; the **#1 recommended pull (IA-1's single recommendation) is
  consistent**, the ranking below it is not promised. The E-022 "converge" verdict is **honestly
  downgraded** with this evidence — you don't converge what isn't moving.

The human's call (IA-5): assent to the downgrade (IA-17 amended below), or — if you judge the *tail*
ordering itself load-bearing enough to converge — re-open with a larger-N re-sweep. The evidence says
the head, the thing IA-1 actually feeds, does not move.

## The live read (2026-06-19, N=3, `sweep-logs/survey-head.log`)

`bun run src/probe/run-equivalence-judge.ts survey 3` — disposable temp root (`mkdtemp` → `lisa
init`), live charter + board snapshot seeded, 3 casts at 300k each into a temp ledger (no real
`.vend/runs.jsonl` or board pollution), all **3 → signal** (0 honest-empty, 0 budget-exhausted — the
read is non-vacuous). The four read lines, verbatim:

```
run-to-run signal dispersion: 0.75 over 3 (signal 3 · honest-empty 0 · budget-exhausted 0 (of 3); honest-empty rate 0%)
semantic equivalence: equivalent-diversity (score 1.00) (3 equivalent · 0 divergent of 3 pairs over 3 outputs)
top-pick stability: head-flips   (score 0.00) (0 stable · 3 flipped of 3 head-pairs over 3 boards)  [lexical exact-match]
top-pick stability: head-stable  (score 1.00) (3 stable · 0 flipped of 3 head-pairs over 3 boards)  [semantic judge]
```

### What the two head lines mean — and why the split is the whole point

The **lexical** baseline flips (0.00): the #1 pull is **worded** differently on every cast. The
**semantic** judge reads it stable (1.00): all three #1 picks are the **same pull**. Recovered from
the surviving (cast-3) staged board, the #1 each time is the keystone scaffold pull:

> *"Pull the foundational T-001 epic and scaffold the Bun/TypeScript project … 26 stories and 70+
> tickets are fully decomposed yet `src/**` is empty … The scaffold unblocks every downstream
> ticket."*

This is exactly what E-022's findings anticipated anecdotally ("the one surviving board's #1 was the
obvious keystone — Scaffold the Bun/TS project"). With `src/**` empty against the whole backlog, a
reasonable survey picks scaffolding **every time**; only the *phrasing* and the *tail* vary.

**The lexical-flip / semantic-stable split *is* IA-17 in miniature.** Consistency is gated validity,
not lexical identity: the load-bearing recommendation is the *same proposed work*, reworded. Reading
the lexical line alone would have wrongly declared the head unstable; the semantic judge — the meaning
axis T-022-01 built — is what reads the contract correctly. This is precisely the case for having the
head-isolating instrument.

## The headline nuance — the whole-board judge swung; the head did not

| Read | E-022 sweep (`work/T-022-02`) | This sweep (`work/T-023-02`) |
|---|---|---|
| Jaccard dispersion | 0.68 | **0.75** |
| Whole-board semantic | `genuine-disagreement` 0.00 | **`equivalent-diversity` 1.00** |
| Head (semantic) | *not measured (instrument post-dated it)* | **`head-stable` 1.00** |

The **whole-board** equivalence read flipped between two N=3 sweeps (0.00 → 1.00). That is the
honest small-sample reality — and it is the strongest argument for the head-isolating instrument:
the whole-board judge is **itself unstable at N=3** (it scores the volatile *tail* ordering), while
the **head read is unambiguous** (the keystone is #1 every time). The contract should rest on the
stable, load-bearing signal, not the swinging full-ranking one. T-023-01's whole point — measure the
head, not the noise — is vindicated by the swing itself.

(Why might the whole board read as diversity now where E-022 read disagreement? Different N=3 draw,
and the live board snapshot grew since E-022 — more tickets sharpen the shared top cluster, so even
the *tails* now overlap more. Both are directional N=3 reads; neither is proof. The head, by
contrast, is stable across **both** the anecdote and this measurement.)

## The warranted path — accept (taken)

Per the decision rule fixed in `design.md` (D3) **before** the run:

- semantic head = **head-stable** ⇒ **accept** ⇒ amend IA-17 to *tail-divergence-by-design (the #1
  pull is consistent)*, **no lever**.

The convergence lever (consensus-cast / judge-as-gate, designed in D5) is **not built** — building it
would converge a head that does not move (the E-022 findings' own warning, and the measure-then-decide
discipline E-014/E-022 established). The contract gets *more precise*, which is the ticket's value on
this path; no source code changes.

### IA-17 amendment (done — `docs/knowledge/information-architecture.md`)

The survey clause is updated from "converge" to: survey divergence is **tail re-ordering by design —
the load-bearing #1 pull is consistent run-to-run (semantic `head-stable` 1.00, N=3); the ranking
below it is not promised.** The whole-board `genuine-disagreement` datum is **re-scoped**: it measured
the *tail*, not the head IA-1 feeds. The prior "lever must first isolate whether the #1 pull flips or
only the tail re-orders" hook is resolved: it re-orders.

## Honest about the sample (IA-8 / AC#3)

- **N=3 → directional, not proof.** Three casts, one judge, one model, one repo, one environment,
  run-to-date. The semantic head read is a clean 1.00 (3/3) — unambiguous, not borderline — but it is
  still a small sample. A 5×/9× re-run could in principle surface a head flip; the standing structural
  fact (empty `src/**` ⇒ scaffold is overwhelmingly the right #1) makes that unlikely while the
  backlog is unbuilt, and the read should be revisited once `src/**` is no longer empty (the keystone
  resolves and a new #1 must emerge — the natural re-measure trigger).
- **The lexical line genuinely flips.** The #1 is reworded every cast; if a future consumer keys on
  *surface form* (rather than meaning) the head would read unstable. The contract is explicitly
  semantic (IA-17) — surface-form convergence is not promised and is not needed for IA-1.
- **No unmeasured claim of success.** No lever was built, so there is nothing to claim worked beyond
  the measurement: the head is stable; that is the whole result. The whole-board swing is reported,
  not hidden.

## Citations

- Instrument: `src/probe/head-stability.ts` + the head block in `src/probe/run-equivalence-judge.ts`
  (T-023-01, commit `f58ee52`); its handoff `work/T-023-01/review.md`.
- The whole-board datum + the head-vs-tail caveat this resolves: `work/T-022-02/findings.md`.
- The judge reused as the head comparator: `src/probe/equivalence.ts` (T-022-01).
- The board shape the parser reads: `src/play/survey-effect.ts` (`renderStagedBoard`).
- The contract amended: `information-architecture.md` **IA-17** (+ **IA-1** the single-recommendation
  home the head feeds, **IA-5** recommend-never-auto, **IA-8** the meter cannot lie).
- Precedent: E-014 (measure-then-decide), E-022 (the equivalence sweep + fork discipline).
- The raw run: `sweep-logs/survey-head.log` (this ticket).
