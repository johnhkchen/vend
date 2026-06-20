# T-023-01 — Research: top-pick-stability-probe

Descriptive map of the code the ticket touches. No solutions here — those are `design.md`.

## What the ticket asks

E-022's equivalence judge classified the survey play's run-to-run dispersion as
`genuine-disagreement` (score 0.00, N=3) — but it compared **whole boards**. A board can re-order
its *tail* while keeping the *same #1 pull*; the consistency contract (IA-1 / IA-17) only cares
whether the **load-bearing #1 recommendation** flips run-to-run. So: build a **head-isolating**
measurement — extract each board's #1 (and top-k) and classify whether the *head* is stable across
N casts, independently of tail order — and print it **beside** E-022's whole-board reads.

## The house split (the pattern every probe in `src/probe/` follows)

Established by `variance.ts` (E-014), generalized by `consistency.ts` (E-019), repeated by
`equivalence.ts` (E-022):

- **Pure core** — plain values in, fresh values out. No fs/clock/network/process/addon. Imports
  only other pure modules. Unit-tested to the branch on fabricated fixtures.
- **Impure harness** (`run-*.ts`) — seeds a disposable temp project, casts the play N× (live
  `castPlay` + `dispense`), collects materialized outputs, hands the pure core already-formed data,
  prints the read. **Not** unit-tested (the live verbs are proven by running them).

T-023-01 must add a new pure core + extend the existing E-022 harness, staying inside this split.

## The files the ticket cites, and what they contain

### `src/probe/equivalence.ts` (the core to mirror)
- `EQUIVALENCE_CLASSES = ["equivalent-diversity","genuine-disagreement","mixed"]` — closed vocab.
- `EquivalenceVerdict { i, j, equivalent, reason? }` — one **unordered pair**'s boolean verdict
  (`j > i`), the unit the judge produces and the core tallies. Mirrors `variance.ts`'s `PairDiff`.
- `EquivalenceReport { classification, score, n, totalPairs, equivalentPairs, divergentPairs,
  verdictsSeen }`.
- `classifyEquivalence(verdicts, n)` — the tally. **Honest-pessimistic** (IA-8): denominator is the
  *expected* pair count `P = n·(n−1)/2`, **not** `verdicts.length`, so a short judge reply cannot
  inflate the score; `score = e/P`. Classification: `total===0` (n<2) ⇒ vacuous
  `equivalent-diversity`; `e===total` ⇒ `equivalent-diversity`; `e===0` ⇒ `genuine-disagreement`;
  partial (incl. all-equivalent-but-short-of-coverage) ⇒ `mixed`.
- `formatEquivalenceReport(r)` — one honest line; appends a `⚠` caveat when n<2 or
  `verdictsSeen < totalPairs`.
- **Key insight:** head-stability is *the same aggregation applied to heads* — all head-pairs
  equivalent ⇒ stable, none ⇒ flips, partial ⇒ mixed. The tally math is a genuine shared contract.

### `src/probe/run-equivalence-judge.ts` (the harness to extend)
- CLI: `bun run src/probe/run-equivalence-judge.ts <play> [fragment.md] [N] [tokenBudget]`.
- Resolves an articulation play to a `JudgeTarget { play, seed, assemble, subject, outputDirs,
  isAbstention }`. Targets: `survey`, `expand`, `steer` (all output to `docs/active/pm/staged`).
- Seeding/collection helpers (`seedTempRoot`, `seedCharter`, `seedBoardSnapshot`, `collectOutput`,
  `castN`) are **COPIED** from `run-consistency-probe.ts`, not imported (self-contained-instrument
  idiom + the cited consistency path must stay byte-for-byte).
- The judge cast: `buildJudgePrompt(outputs)` → labelled `### OUTPUT k` blocks + a per-pair JSON
  ask; `parseVerdicts(reply, n)` → tolerant extraction (first `[`..last `]`, drop malformed /
  out-of-range / duplicate, `i<j`); `judgeEquivalence(outputs, budget)` → `<2 ⇒ []`, else
  `dispense` then parse.
- `main()` flow: resolve → seed → `castN` → print `formatConsistencyReport` (dispersion) → filter
  to `signal` outputs → `judgeEquivalence` → `classifyEquivalence` → print `formatEquivalenceReport`.
- **Reuse seam:** `judgeEquivalence` takes any `string[]`. Feeding it the extracted **heads**
  instead of full boards yields per-pair *head* verdicts with zero new judge machinery.

### `src/play/survey.ts` + `survey-core.ts` + `survey-effect.ts` (the board shape the parser reads)
- `surveyPlay` stages a ranked `Board` (`{ signals: Signal[] }`, highest-leverage first) under
  `docs/active/pm/staged/survey-board.md` via `surveyBoardEffect`.
- `renderStagedBoard(board)` (survey-effect.ts) produces the markdown the harness collects:
  - non-empty: `# Survey — staged demand board`, a table (`| Signal | Value | Budget (envelope) |
    Status |` + `|---|...|` separator + one `renderSignalRow` per signal, **top row = #1**), then a
    `## Pull these` block with one `vend chain "<what> — <why>"` per signal (top-first; the first
    tagged `# recommended next pull (highest leverage)`).
  - empty (honest abstention): `# Survey — no demand staged` — no table, no chain lines.
- `renderSignalRow(signal)` (expand-core.ts): `| **<what>** — <why> | **<Tier>** | <budget> |
  <readiness> (advances … · grounded in …) |`.
- **Two extractable orderings**, both top-first: the table rows, and the `## Pull these` chain
  lines. The chain lines carry the clean `what — why` inside quotes (no `**` to strip) — the more
  robust parse key.

### `src/play/steer-effect.ts` (free second board-shaped play)
- `renderStagedSteer` uses the **identical** `TABLE_HEADER` and the **identical** `## Pull these` /
  `vend chain "<what> — <why>"` / `# recommended next pull (highest leverage)` block (plus a
  `## Forks` half below). So one parser keying on the `vend chain` lines serves **survey and
  steer** boards alike. Empty case: `# Steer — nothing to stage` (no chain lines).

### `src/probe/consistency.ts` / `variance.ts` (the reads the head verdict prints beside)
- `consistencyReport` → `formatConsistencyReport` = the dispersion line already printed first.
- `dispersion` = mean line-set Jaccard over unordered pairs. Whole-board, order-insensitive.

## Constraints & assumptions surfaced

1. **Additive-only.** AC#3: `equivalence.ts` and the consistency path stay byte-for-byte; the
   harness change must be purely additive (one more printed line; existing reads unchanged).
2. **Vocabulary is the contract.** The ticket fixes the closed set `head-stable | head-flips |
   mixed`. It maps 1:1 onto `equivalent-diversity | genuine-disagreement | mixed` — the head read
   *is* equivalence over heads, renamed.
3. **Lexical vs semantic (IA-17).** Two #1 picks worded differently can mean the same pull. So the
   *harness* path must compare heads with the **judge** (semantic), not string equality. A pure
   exact-match path is still useful for deterministic fixtures + as a cheap pre-judge signal.
4. **Tail-independence is a parser property.** "tail re-order with a stable #1 ⇒ head-stable" is
   proven at the **extraction** layer (same #1 extracted regardless of tail order), then classified.
5. **Abstention safety.** An empty/abstention board has no chain lines ⇒ the parser returns `[]`;
   the harness already filters to `signal` outputs, so heads should exist, but the parser must be
   total on the no-head case.
6. **No YAML/markdown lib in the repo.** Parsing is hand-rolled string work (the house norm —
   frontmatter is never parsed back); a small regex over `vend chain "…"` suffices.
7. **Check gate:** `bun run check` = `baml:gen && tsc --noEmit && bun test`. Pure core + its test
   must keep it green; the impure harness is excluded from unit tests by the house rule.
