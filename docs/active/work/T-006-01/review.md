# T-006-01 — Review: cross-reference the KB and roadmap

Handoff for a human reviewer. What this spike produced, how each AC was met, the
contradictions it surfaced, and — as the ticket Notes require — **where forcing a
planning sorcery through RDSPI showed the seams** (the motivation for the BAML
sorcery engine). This was a *planning* cast (E-006), not a code change: the only
"permanent" left behind is one markdown plan plus one ledger append.

## What changed (artifacts)

| Action | File | Role |
|---|---|---|
| create | `work/T-006-01/research.md` | mapped the KB (11 docs) + the roadmap (6 epics, board state, value model) |
| create | `work/T-006-01/design.md` | chose the sequencing function (leverage×readiness + escalate the fork) and the epic-scoped id scheme |
| create | `work/T-006-01/structure.md` | fixed the deliverable's section layout + the planned-story record schema |
| create | `work/T-006-01/plan.md` | ordered the steps to produce the plan; per-step AC verification |
| create | **`work/T-006-01/roadmap-plan.md`** | **the deliverable** — the ranked next wave of stories |
| create | `work/T-006-01/progress.md` | Implement tracking + 3 deviations |
| create | `work/T-006-01/review.md` | this handoff |
| append | `.vend/decisions.jsonl` | `D-2026-06-18-007` — the steering decision (move: queue) |

**No** `tickets/`, `stories/`, `epic/`, or `demand.md` writes. The lone modified
board file (`tickets/T-006-01.md`, `M`) predates this session — untouched here.

## AC status

- **AC1 — produces `roadmap-plan.md`, a sequenced plan of the next wave for the staged
  epics.** ✅ Six stories across five tracks (E-004, E-005, E-003×2, E-002, E-007),
  ordered as a recommended pull spine.
- **AC2 — each story cites the KB doc(s) that drive it + a value tier + budget
  envelope.** ✅ Every story record carries a `Cites:` line naming real
  `docs/knowledge/**` files, a `demand.md` value tier, and a bounded envelope. Verified:
  6 story `Cites:` lines (+1 provenance).
- **AC3 — sequenced by leverage + readiness; names the recommended next pull and why.**
  ✅ Ranked by leverage×readiness (effort and ID order explicitly rejected in Design);
  **E-004 named the recommended next pull** with rationale; the shelf-vs-CI fork
  escalated rather than resolved.
- **AC4 — flags any contradiction (or states none found).** ✅ Bounds check reports
  **F1** (story-id scheme self-contradiction) and **F2** (demand.md internally stale)
  as genuine contradictions, **F3** (E-002 has no card) as a gap, **F4** (RDSPI
  mismatch) cross-referenced here. The *principle* layer was checked and found
  coherent.
- **AC5 — plans stories only; no ticket materialization; no id collisions.** ✅ No
  tickets minted; epic-scoped story ids (`S-<epic>-<n>`) are collision-free against the
  live `{S-001,S-002,S-006}`; grep-verified 0 collisions.

## The headline (for the reviewer in a hurry)

**Pull E-004 (id-guard) next.** It is the cheap, ready enabler that makes every later
epic safe to decompose *in place*; without it the same id-collision (F1) keeps biting.
Pair the tiny E-005 (model-id) alongside. **Then a real fork is yours to call:**
E-003 shelf (recommended — advances the core feature P2) vs E-002 CI (de-risk the
fleet first). E-007 (the BAML sorcery engine) sequences last because its input is the
friction this very cast produced.

## The commissioned friction — RDSPI vs. a sorcery (F4)

The ticket Notes ask explicitly: record where forcing a one-shot planning *sorcery*
through RDSPI (built for code *permanents*) shows the mismatch. It showed in four
places:

1. **Research was the only phase that fit cleanly.** "Map the terrain" is exactly what
   a survey *is*. For a code ticket Research maps a codebase; here it mapped documents
   — the one honest analogue.
2. **Structure had almost nothing to structure.** Its job ("which files created/
   modified/deleted, module boundaries") degenerated to "define the headings of one
   markdown file and the schema of a list item." The phase did real work only by being
   *reinterpreted* as "shape of the deliverable." A permanent has architecture; a
   sorcery has an output format.
3. **Plan defined a test strategy with nothing to execute.** "What gets unit tests,
   integration tests, verification criteria" became "apply the AC checklist to a
   document" — grep and `jq`, not `bun test`. There is no suite for a plan. The phase
   was salvageable only by treating the ACs *as* the tests.
4. **Implement = write prose, and "commit incrementally" had no referent.** The
   six-phase ritual assumes code that compiles and commits in atomic units; a survey
   produces one artifact in one motion. `progress.md`'s "deviations" were *planning*
   choices, not code adjustments.

**The through-line:** RDSPI's six phases assume a *permanent* — something with
architecture, tests, and incremental commits. A sorcery is *cast once for a moment*:
its value is a single judgment-dense artifact, and 5 of 6 phases had to be bent to
fit it. The ceremony wasn't wasted (it forced the sequencing rigor and the bounds
check up front), but four of the six phases earned their keep only by reinterpretation.
**This is the concrete motivation for a BAML sorcery engine** (`card-model.md`): a
casting flow shaped like `cast(sorcery, budget) → resolve-against-gates → one
artifact`, *not* a six-phase permanent pipeline. E-007 (S-007-01) should take this
review as its primary input.

## Open concerns / for human attention

1. **The fork awaits your verdict.** `decisions.jsonl` D-2026-06-18-007 logged
   `humanVerdict: pending`. The shelf-vs-CI call is genuinely yours; the survey
   recommends E-003 but the CI-first case is real. Backfill the verdict so the trace
   stays learnable (`steering-data-model.md`).
2. **F2 — `demand.md` is stale and should be swept** (E-003/CI rows still say "blocked
   on E-001"; E-001 is done). Reported, not fixed — a small later pull.
3. **F3 — author `epic/E-002.md`** before S-002-01 can be cast; `ci-strategy.md` holds
   the full steering, so it's a transcription, not a design task.
4. **F1 / id scheme is a decision you should ratify.** I adopted epic-scoped story ids
   to dodge the collision; if you prefer to keep flat numbering, that choice needs to
   be made *before* E-004 lands (E-004 is where the namespace gets automated). The
   survey demonstrates the problem; the convention call is yours.
5. **No code, no tests, no commit.** Correct for a spike — but it means the only
   quality check on this plan is *your* read (`go-and-see.md` §3: planning work has no
   gate but the human's eye). Research and Design are the highest-leverage pages to
   scrutinize.

## Bottom line

The cast produced what good steering produces (`project-steering.md`): forward motion
with the judgment encoded — a ranked next wave, the real fork surfaced not guessed,
the bounds check run, the decision logged, and nothing over-built. The project is
meaningfully *further*, and the one thing genuinely yours to decide (the fork) is the
one thing handed up.
