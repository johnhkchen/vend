# T-023-01 — Design: top-pick-stability-probe

Options and the chosen shape, grounded in `research.md`. Five decisions (D1–D5).

## D1 — Where the pure/impure line falls

The ticket allows the pure core to take "N survey boards' top-picks **or** per-pair
head-equivalence verdicts". This is the crux.

- **Option A — core tallies verdicts only** (exact mirror of `equivalence.ts`): parser + judge live
  entirely in the harness; the core is just a renamed `classifyEquivalence`.
  - *Against:* AC#1's fixtures are phrased over **boards/top-picks** ("all-same-#1", "tail re-order
    with a stable #1"). "tail re-order ⇒ head-stable" is only meaningful if a pure test can feed
    whole boards and see the tail ignored. Option A pushes extraction into the untested harness, so
    that fixture can't be a pure test — it degenerates into "all-equivalent verdicts", losing the
    thing the ticket most wants proven.

- **Option B — core owns extraction + a deterministic classifier, and the verdict tally** (chosen).
  The core exports: a pure **parser** (`extractTopPicks`), a pure **deterministic verdict builder**
  (exact/normalized head match → verdicts), and the **tally** (`classifyHeadStability`). The harness
  reuses the parser + the judge for the *semantic* path.
  - *For:* every AC#1 fixture becomes a pure board-markdown test, including tail-independence; the
    semantic (judge) path and the deterministic path **converge on one classifier** by both
    producing `EquivalenceVerdict[]`.

**Chosen: B.** It keeps the high-value extraction logic unit-tested and unifies both comparison
modes behind a single tally.

## D2 — How heads are compared: lexical vs semantic, and how they unify

IA-17 says consistency is *validity, not lexical identity*: two #1 picks worded differently may be
the same pull. So the **authoritative** comparison is the judge (semantic). But fixtures must be
deterministic, and most real surveys repeat the same keystone #1 verbatim — a cheap exact-match win.

Resolution — **two verdict sources, one classifier**:
- `headVerdictsFromExactMatch(heads)` — pure: normalize each head (trim, collapse whitespace,
  casefold) and emit `{i,j,equivalent: norm(i)===norm(j)}` for every pair. Deterministic ⇒ drives
  the fixtures and serves as the harness's printed *lexical* baseline.
- `judgeEquivalence(heads, budget)` (existing harness verb, reused verbatim) — semantic ⇒ the
  authoritative head verdicts in the live sweep.

Both yield `EquivalenceVerdict[]`, both flow into `classifyHeadStability(verdicts, n)`. The harness
prints **both** (lexical-exact head verdict *and* semantic head verdict) beside the whole-board
reads, so a head that is lexically-distinct-but-semantically-same is visible as the gap between them
— exactly the head-vs-tail caveat T-022-02 raised.

*Rejected:* a single fuzzy similarity threshold in the core (e.g. Jaccard over head tokens) — it
re-introduces a magic constant and still isn't the meaning axis; the judge already is.

## D3 — Reuse `classifyEquivalence` vs reimplement the tally

The head tally is *identical* arithmetic to `equivalence.ts` (e/P over expected pairs, the
honest-pessimistic denominator, the same three branch shapes) — a genuine **shared contract**, not
incidental duplication. So `classifyHeadStability` **delegates** to `classifyEquivalence` for the
math + evidence, then maps the label into the head vocabulary:

```
equivalent-diversity → head-stable
genuine-disagreement → head-flips
mixed                → mixed
```

The `EquivalenceReport`'s evidence fields (score, totalPairs, equivalentPairs, divergentPairs,
verdictsSeen, n) are carried straight onto `HeadStabilityReport` under the head classification. This
single-sources the IA-8 honesty math; only the closed vocabulary + formatter are new.

*Rejected:* copy the 8-line tally into head-stability.ts (the no-shared-util idiom). That idiom
guards against coupling on *incidental* helpers; here the per-pair equivalence aggregation is the
literal same contract, and `equivalence.ts` is pure, so importing it keeps the core pure. Copying
would risk the two honesty rules drifting — the exact failure IA-8 warns about.

*Reuse `EquivalenceVerdict`* (imported from `equivalence.ts`) rather than a parallel `HeadVerdict`
type — a per-pair equivalence boolean is the same unit whether the subject is a board or its head.

## D4 — The parser: which structure to key on, and totality

The board has two top-first orderings (table rows, `## Pull these` chain lines). **Key on the
`vend chain "<what> — <why>"` lines** (D4):
- The quoted string is the clean `what — why` head text — no `**`-stripping, no cell-splitting.
- It is **identical** across survey *and* steer boards (research.md), so one parser serves both.
- A simple global match `/vend chain "([^"]*)"/g` yields heads in rank order; `[0]` = #1, first-k =
  top-k.

Totality: an empty/abstention board (`# Survey — no demand staged` / `# Steer — nothing to stage`)
has no chain lines ⇒ `extractTopPicks` returns `[]`. `extractTopPicks(md, k)` returns up to `k`
heads (fewer if the board is shorter). The `#1` accessor returns `heads[0] ?? null`.

*Rejected:* parsing the markdown table cells — viable but needs `**` stripping and column splitting,
and the `recommended next pull` marker already disambiguates the head in the cleaner chain block.

## D5 — Harness wiring: extend `run-equivalence-judge.ts`, gated per target

AC#2 says print "**beside** the existing whole-board dispersion + equivalence numbers" ⇒ same
harness, same run, one more block. Implementation:
- Add an optional `extractHead?: (output: string) => string | null` to `JudgeTarget`. Set it for
  `surveyTarget` and `steerTarget` (identical board shape); leave it **undefined** for
  `expandTarget` (one signal, no ranked head).
- In `main()`, after the existing equivalence print, `if (target.extractHead)`: map the **signal**
  outputs to heads, drop nulls, then compute **both** head reads — lexical
  (`headVerdictsFromExactMatch`) and semantic (`judgeEquivalence` over the heads) — classify each
  with `classifyHeadStability`, and print two labelled lines via `formatHeadStabilityReport`.
- Everything before that point is unchanged ⇒ AC#3 "extend, don't break". `equivalence.ts` and the
  consistency path are untouched.

The judge prompt is **reused verbatim**: judging two #1 signal lines for "same proposed work" is
exactly the head-equivalence question `buildJudgePrompt` already poses. (Noted as an intentional
reuse, not an oversight; a head-specific prompt was considered and rejected as needless surface.)

## Resulting module surface (detail → structure.md)

New pure module `src/probe/head-stability.ts`:
- `HEAD_STABILITY_CLASSES` / `HeadStabilityClass`
- `HeadStabilityReport`
- `extractTopPicks(boardMarkdown, k=1): string[]` + `topPick(md): string | null`
- `headVerdictsFromExactMatch(heads): EquivalenceVerdict[]`
- `classifyHeadStability(verdicts, n): HeadStabilityReport`
- `formatHeadStabilityReport(r): string`

New test `src/probe/head-stability.test.ts` — the AC#1 fixtures + parser + honesty edges.

Harness edit `src/probe/run-equivalence-judge.ts` — `extractHead` hook + the head block in `main()`.

## Why this is the measure-then-decide instrument E-023 needs

The probe does **not** build a convergence lever (that is T-023-02, conditional on this read). It
only *measures* whether the head moves — lexically and semantically — so the data, not a guess,
chooses T-023-02's path (amend IA-17 if the head is stable; build the consensus-cast lever only if
it flips). This is the E-014/E-022 discipline: do not build the lever before knowing the head moves.
