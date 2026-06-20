# T-023-02 — Research: converge-or-accept-the-head

> Descriptive map of what exists for the survey head-vs-tail decision. No solutions here — those are
> Design. This ticket is **measure-then-decide** (E-014/E-022 discipline): run the T-023-01 head
> instrument on survey, read the verdict, then take the *warranted* path. The instrument already
> exists and is wired; this ticket runs it and rules on the result.

## The question this ticket answers

E-022's whole-board equivalence judge read survey as `genuine-disagreement` (0.00, N=3 — the boards
differ as **full rankings**). But the contract's real concern is narrower: does the **load-bearing
#1 pull** flip run-to-run (IA-1's single recommendation), or do the boards only re-order their
**tail** while agreeing on the head? T-023-01 built the head-isolating instrument to measure exactly
this. T-023-02 runs it on survey and takes the path the measurement warrants:

- **head-stable** → *accept* (no build): amend IA-17 to record survey's divergence as
  tail-re-ordering-by-design — the #1 pull is consistent; downgrade the "converge" verdict honestly.
- **head-flips** → *converge* (bounded build): build the consensus-cast convergence lever
  (judge-as-gate), stage a consensus board, amend IA-17 to "converged at the head."

## The instrument (already built — T-023-01, commit f58ee52)

### `src/probe/head-stability.ts` — the pure core

- `extractTopPicks(boardMarkdown, k=1): string[]` — PURE parser. Keys on the `## Pull these` block's
  `vend chain "<what> — <why>"` lines (regex `/vend chain "([^"]*)"/g`), which both the survey and
  steer effects render **top-ranked-first**. Returns raw head text (trimmed, not normalized). Total
  on every edge: empty/abstention board → `[]`; `k<=0` → `[]`; `k` beyond length → all heads.
- `topPick(boardMarkdown): string | null` — the single #1 pull, or `null` when nothing is staged.
  This is the accessor the harness's `extractHead` hook calls.
- `headVerdictsFromExactMatch(heads): EquivalenceVerdict[]` — the **deterministic lexical** verdict
  source: every unordered pair `{i,j}` is `equivalent` iff `normalizeHead`-equal (trim + collapse
  whitespace + casefold). The cheap baseline that drives fixtures and the harness's `[lexical
  exact-match]` line.
- `classifyHeadStability(verdicts, n): HeadStabilityReport` — DELEGATES the honest e/P arithmetic to
  `classifyEquivalence` (denominator = **expected** pairs `P=n(n-1)/2`, IA-8) and re-maps the label
  via `LABEL_MAP` (`equivalent-diversity→head-stable`, `genuine-disagreement→head-flips`,
  `mixed→mixed`, `satisfies Record<EquivalenceClass,…>` so a new class is a compile error). Pair
  fields renamed to head scope (`stablePairs`/`flippedPairs`).
- `formatHeadStabilityReport(r)` — one honest line; appends a `⚠` caveat when `n<2` (vacuous) or the
  judge returned fewer verdicts than expected head-pairs.
- Classes: `HEAD_STABILITY_CLASSES = ["head-stable","head-flips","mixed"]`.

### `src/probe/run-equivalence-judge.ts` — the impure harness (already wired)

`bun run src/probe/run-equivalence-judge.ts survey [N] [tokenBudget]` (default N=5; survey budget
300k/cast). It seeds a **disposable** temp root (`mkdtemp` → `lisa init`), copies the live charter +
board snapshot in, casts survey N× into a temp ledger (the two invariants: **no ledger pollution**,
**no collision**), prints the `formatConsistencyReport` dispersion line + whole-board
`formatEquivalenceReport`, then — because `surveyTarget.extractHead = topPick` is set — runs the
**head block** (lines 358-370): extract each signal board's #1, print
`formatHeadStabilityReport` twice — a deterministic `[lexical exact-match]` line and the
authoritative `[semantic judge]` line (reusing `judgeEquivalence` over just the heads). The head
read is purely additive; the whole-board reads above it are unchanged.

So **measuring the head verdict requires no code change** — only running the (already-shipped)
harness and reading its two new head lines. Code is built *only* on the head-flips branch (the lever).

## The contract to amend — IA-17 (`docs/knowledge/information-architecture.md:212-235`)

IA-17 "Consistency is gated validity, not lexical identity." Two axes: **validity consistency** (the
promise, gated, measured) and **lexical/content consistency** (adjudicated per play). Current
per-play record (E-022 sweep, N=3, 2026-06-19): expand → by-design; **survey → converge**
(`genuine-disagreement` 0.00, whole-board); steer → by-design. The text **already anticipates this
ticket**: *"survey's lever must first isolate whether the load-bearing #1 pull flips or only the tail
re-orders."* That sentence is the hook T-023-02 resolves — replacing it with a measured head verdict.

Supporting principles: **IA-1** — the home leads with a single recommended pull (the head is what
survey feeds it). **IA-5** — recommend-never-auto: surface the state recommendation-first, the
deciding framing is the human's. **IA-8** — the meter must not lie (honest about small N).

## Prior evidence in hand

- `work/T-022-02/findings.md` — the whole-board sweep: survey `genuine-disagreement` 0.00 over N=3
  (boards differ as full rankings). Crucially it flags the **head-vs-tail caveat** this ticket
  measures, and notes anecdotally that *the one surviving board's #1 was the obvious keystone*
  ("Scaffold the Bun/TS project — src/** is empty against 62 tickets") — a hint the head may be
  stable, but **not measured** (the head instrument did not exist when that sweep ran).
- `work/T-022-02/sweep-logs/{survey,steer,expand}.log` — the E-022 sweep transcripts. **They predate
  the T-023-01 head instrument**, so they carry only the whole-board read — no head line. T-023-02
  must run a fresh survey sweep to get the head verdict; the new logs land in
  `work/T-023-02/sweep-logs/`.

## The survey board shape the parser depends on (`src/play/survey-effect.ts`)

`renderStagedBoard(board)` emits `# Survey — staged demand board`, a `| Signal | Value | Budget |
Status |` table (one `renderBoard` row per signal), then a `## Pull these` fenced block with one
`vend chain "<what> — <why>"` line per signal, **top-ranked first** (the first carries `#
recommended next pull (highest leverage)`). The empty case emits `# Survey — no demand staged` (the
abstention marker `surveyTarget.isAbstention` keys on "no demand staged"). The parser keys on the
`vend chain "…"` block, not the table — both encode the same top-first order, and the chain line
carries the clean quoted head with no `**` to strip.

## Constraints & assumptions

- **The sweep spends real subscription credits** (`dispense` → `claude -p`, subscription-auth). The
  E-022 survey sweep took ~5 min for N=3 at 300k/cast. Bounded N (3–5), cost-aware, logged — the
  ticket's explicit envelope. The probe is self-contained (disposable temp ledger, no real-log
  pollution), so running it is safe to the repo.
- **Small N → directional, not proof** (AC#3, the E-014 honesty discipline). One repo, one model,
  one environment, run-to-date. A 1.00/0.00 head read is unambiguous; a borderline `mixed` is a
  directional steer, not a settled fact.
- **AC#4: `bun run check:*` must stay green.** The instrument already passes (761 tests at f58ee52);
  the only code risk is on the head-flips branch (the consensus lever + its unit tests).
- **The lever (head-flips branch) is bounded and split per the house pattern**: a PURE
  consensus-selection core (unit-tested on fixtures) + the impure N-cast + judge-gate harness (not
  unit-tested — the live-cast/fs verbs), exactly as `equivalence.ts` ↔ `run-equivalence-judge.ts`.
- **Tooling confirmed present**: bun 1.3.9, lisa 0.2.11, `claude` CLI on PATH (subscription seam).
