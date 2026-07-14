# T-023-02 — Structure: converge-or-accept-the-head

> The blueprint: which files are created/modified/deleted, under each branch of the decision rule
> (D3). The **always** set runs regardless of verdict; the **head-flips only** set is the conditional
> lever. Not code — the shape of the change.

## Always (every verdict)

### Created

| Path | What |
|---|---|
| `docs/active/work/T-023-02/research.md` | (done) instrument + contract + evidence map |
| `docs/active/work/T-023-02/design.md` | (done) options, decision rule, both branches |
| `docs/active/work/T-023-02/structure.md` | (this file) |
| `docs/active/work/T-023-02/plan.md` | the ordered run-then-branch sequence |
| `docs/active/work/T-023-02/sweep-logs/survey-head.log` | the live N=3 survey sweep transcript, teed (IA-8 — no silent caps) |
| `docs/active/work/T-023-02/findings.md` | **the deliverable**: head-vs-tail verdict (both head lines + whole-board context), the warranted path recommendation-first (IA-5), honest-sample block (IA-8) — AC#1 |
| `docs/active/work/T-023-02/progress.md` | Implement-phase log: what ran, what landed, deviations |
| `docs/active/work/T-023-02/review.md` | the handoff |

### Modified

| Path | What |
|---|---|
| `docs/knowledge/information-architecture.md` | amend **IA-17**'s survey clause to the measured verdict (AC#2). head-stable → *tail-divergence-by-design, #1 pull consistent*; head-flips → *converged at the head, lever's measured effect*. The existing hook sentence ("survey's lever must first isolate whether the load-bearing #1 pull flips or only the tail re-orders") is **replaced** by the resolved finding. Cite `work/T-023-02/findings.md`. |

No source code is created or modified on the **head-stable** / **mixed** / **abstention** paths — the
warranted action there is *accept + document*, and the instrument already exists. This is by design
(D4): the ticket's value on those paths is the *precision the contract gains*, not a feature.

## Head-flips only (the conditional lever — D5)

Built **only if** the semantic head read is `head-flips`. Split per the house pure-core / impure-
harness pattern (exactly `equivalence.ts` ↔ `run-equivalence-judge.ts`).

### Created (head-flips)

| Path | What | Tested? |
|---|---|---|
| `src/probe/consensus.ts` | PURE consensus-selection core: given N boards' heads + per-pair head-equivalence verdicts, cluster equivalent heads and return the **agreed top-ranked signal** (modal cluster's head) + a confidence, or an honest "no consensus" when no cluster has a majority. Reuses `EquivalenceVerdict`; imports only `equivalence.ts` (the union-find/clustering over the verdict graph). No fs/clock/addon. | **yes** — `consensus.test.ts` |
| `src/probe/consensus.test.ts` | Branch-complete pure fixtures: unanimous → that head; plurality → modal cluster; tie/no-majority → no-consensus; n<2 vacuous; verdict-graph clustering (transitive equivalence). | — |
| `src/probe/run-consensus.ts` (or extend `run-equivalence-judge.ts`) | IMPURE harness: cast survey N×, run the equivalence judge as a **gate** over the heads, call the pure core to select the consensus, **stage one consensus board** whose #1 is the agreed pull, then re-sweep to measure the lever's effect. Not unit-tested (live-cast/fs verbs). | no (house rule) |

### Decision: extend vs new harness file (head-flips)

Prefer a **new `run-consensus.ts`** over extending `run-equivalence-judge.ts`: the judge harness is a
*meter*; the consensus harness makes the judge a *gate* and **writes** a consensus board (a new
side-effect). Keeping them separate preserves the judge instrument's read-only, no-pollution
contract (the self-contained-instrument idiom) and matches T-023-01's reuse-by-copy precedent. The
pure `consensus.ts` core + the staging verb are the new units; both reuse `equivalence.ts` and
`head-stability.ts` by import (pure) / copy (seeding helpers), not by mutating them.

### Deleted

None, on any path. The ticket is additive (accept) or additive-plus-new-module (converge). The
E-022/T-023-01 instrument paths stay byte-for-byte (AC#4 / the extend-don't-break rule).

## Ordering of changes

1. **Run the sweep** (always) → `survey-head.log` lands. This produces the verdict that selects the
   branch. Nothing downstream is written before the verdict is read.
2. **Write `findings.md`** (always) — the verdict + warranted path. AC#1 satisfied here.
3. **Amend IA-17** (always) — the contract clause matching the verdict. AC#2 satisfied here.
4. **(head-flips only)** build `consensus.ts` + tests → `run-consensus.ts` → re-sweep → record the
   lever's measured effect in `findings.md` + IA-17. AC#2/AC#3 lever half satisfied here.
5. **`bun run check`** (always) — green gate. AC#4. On the accept path this is unchanged from f58ee52
   (no source touched); on the converge path it must include the new `consensus.test.ts`.
6. **Write `progress.md` then `review.md`** (always).

## Interfaces touched (none on the accept path)

- **Accept path:** zero `src/**` surface change. Only docs (`findings.md`, IA-17). The public probe
  API (`head-stability.ts`, `equivalence.ts`) is untouched.
- **Converge path:** one new pure export surface (`selectConsensus(...)` in `consensus.ts`, signature
  fixed during Implement against the verdict types) + one new harness CLI. No existing signature
  changes — `classifyHeadStability` / `classifyEquivalence` / `topPick` are consumed, not modified.

## Risk notes carried into Plan

- The sweep may abstain or budget-exhaust, leaving `<2` signal boards → vacuous head read (D6). The
  plan must check the signal-board count before reading the verdict and re-run with more budget rather
  than record a false "stable."
- The two head lines (lexical vs semantic) may disagree (e.g. same pull reworded → lexical flips,
  semantic stable). Per D1/D3 the **semantic** line is authoritative; the plan records both and reads
  the semantic one, noting any divergence as evidence about wording variance.
