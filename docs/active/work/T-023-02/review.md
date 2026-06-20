# T-023-02 — Review: converge-or-accept-the-head

Handoff for a human reviewer. What changed, how it's verified, what to weigh. This was a
**measure-then-decide** ticket: run the T-023-01 head instrument on survey, read the verdict, take
the warranted path. The verdict came back **head-stable**, so the path was **accept** — amend the
contract, build nothing.

## The result in one paragraph

The head-isolating probe (T-023-01) was run on survey, N=3, logged. The authoritative **semantic**
head read is `head-stable` (1.00): all three casts chose the **same #1 pull** — the keystone "scaffold
the Bun/TypeScript project" — while the **lexical** baseline flipped (0.00) because that same pull was
*worded* differently each time. So survey's run-to-run divergence is **tail re-ordering, not head
instability**: the load-bearing #1 recommendation (the thing IA-1 feeds) is consistent. E-022's
whole-board "converge" verdict is honestly **downgraded to tail-divergence-by-design**, and **no
convergence lever is built** — you don't converge a head that doesn't move.

## What changed

| File | Action | Summary |
|---|---|---|
| `docs/active/work/T-023-02/sweep-logs/survey-head.log` | **create** | Live N=3 survey head sweep transcript (the raw evidence; IA-8 no-silent-caps). |
| `docs/active/work/T-023-02/findings.md` | **create** | **The deliverable (AC#1):** head-vs-tail verdict, the warranted path recommendation-first (IA-5), the between-sweep whole-board swing, honest-sample block (IA-8). |
| `docs/knowledge/information-architecture.md` | **modify** | **IA-17 amended (AC#2):** survey clause → *tail-divergence-by-design (the #1 pull is consistent)*; added a "Survey's head, isolated" paragraph with the measured read; the old "lever must first isolate…" hook resolved. |
| `docs/active/work/T-023-02/{research,design,structure,plan,progress}.md` | **create** | RDSPI artifacts. |

**No `src/**` change.** No file deleted. The E-022 / T-023-01 instrument (`equivalence.ts`,
`head-stability.ts`, `run-equivalence-judge.ts`, the consistency path) is byte-for-byte untouched —
the ticket *ran* the instrument, it did not modify it. The convergence lever designed in
`structure.md`/`design.md` D5 (`consensus.ts` + `run-consensus.ts`) was deliberately **not built**
(it is the head-flips branch; the head was stable).

## How it's verified

- **The verdict is auditable, not asserted.** Every claim in `findings.md` traces to a line in
  `sweep-logs/survey-head.log`; the four read lines are quoted verbatim. All 3 casts produced
  **signal** (0 honest-empty, 0 budget-exhausted), so the head read is non-vacuous (the `n<2`
  vacuous-stable trap, design D6, did not fire — confirmed).
- **The decision rule was fixed before the run** (`design.md` D3): head-stable → accept. The branch
  is warranted by the measurement, not chosen to suit it.
- **Gate:** `bun run check` = **761 pass / 0 fail**, tsc + baml clean — *identical to the baseline*
  (`f58ee52`), as expected when no source is touched. AC#4 green.

## Test coverage

- **No new code ⇒ no new tests, correctly.** The accept path is documentation-only; there is nothing
  to unit-test. The instrument it ran is already fully covered (T-023-01: 18 pure tests over
  `head-stability.ts`; the harness is the house "not-unit-tested, proven live" rule).
- **The measurement is the test here.** The probe's pure core was validated in T-023-01; this ticket
  exercised the *live* harness end-to-end (the path T-023-01's review explicitly deferred as "the next
  operator step"). It ran clean: 3/3 signal, both head lines produced, no parser/abstention edge hit.
- **Gap (inherent, not a defect):** N=3 is a small sample (see below). There is no automated guard
  that the head *stays* stable as the project evolves; that is the human re-measure trigger, flagged
  below.

## Open concerns / things a reviewer should weigh

1. **N=3 → directional, not proof (AC#3).** One judge, one model, one repo, run-to-date. The semantic
   head read is a clean, unambiguous 1.00 (3/3) — not borderline — but a larger N could in principle
   surface a flip. Low risk *while `src/**` is empty* (scaffolding is overwhelmingly the right #1);
   the honest move is to **re-measure once the keystone resolves** (when `src/**` is no longer empty,
   a new #1 must emerge and the head's stability is genuinely re-opened). Recorded in findings +
   IA-17.
2. **The whole-board judge swung between sweeps** (E-022 `genuine-disagreement` 0.00 → this sweep
   `equivalent-diversity` 1.00). This is reported honestly and is *load-bearing for the conclusion*,
   not a footnote: it shows the whole-board read is itself unstable at N=3 (it scores the volatile
   tail), which is exactly why the contract should rest on the head. A reviewer who only saw E-022's
   0.00 should note the head read — not the whole-board read — is the stable, contract-relevant
   signal. (Likely cause of the swing: a different N=3 draw + a grown board snapshot since E-022; both
   N=3 reads are directional.)
3. **The lexical head genuinely flips (0.00).** The contract is explicitly *semantic* (IA-17), so
   surface-form convergence is neither promised nor needed for IA-1. If any future consumer keys on
   the head's *wording* rather than its meaning, it would read instability that isn't there — worth a
   note for whoever wires survey's #1 into the home.
4. **No lever was built — by design, and reversibly.** The consensus-cast lever is fully *designed*
   (`design.md` D5, `structure.md`) but unbuilt. If a future re-measure (concern 1) flips the head,
   the head-flips branch is ready to execute without re-designing.

## Critical issues needing human attention

None blocking. The gate is green, the change is additive (docs only), the verdict is auditable. The
one judgment left to the human (IA-5) is **assent to the IA-17 downgrade** (survey: converge →
tail-divergence-by-design) — the evidence supports it; the framing gesture is yours.
