# T-006-01 — Research: cross-reference the KB and the roadmap

Descriptive map of the two input corpora this spike must cross-reference — the
**knowledge base** (`docs/knowledge/**`, the durable "why") and the **roadmap**
(`demand.md` + the epic cards + `.vend/decisions.jsonl`, the "what's next"). No
solutions here; this is the terrain the Design phase will sequence over.

This is a **planning spike** (`type: spike`), not a code change. The thing being
mapped is *documents and board state*, not a codebase — itself a finding (see §5).

---

## 1. The knowledge base — what each doc owns

| Doc | Owns | Stable handles to cite |
|---|---|---|
| `vision.md` | The narrative: "design the loop, don't run it." | the one-line; 7 design principles |
| `charter.md` | The **value function** — indexed spine planning references by ID. | **P1–P7** invariants · **N1–N4** non-goals · the **5 value criteria** (purposeful/grounded/allocatable/in-bounds/verifiable) · the one-page amendment cap |
| `tps.md` | The framing lens: Vend = TPS for probabilistic knowledge work. | jidoka · andon · poka-yoke · pull/JIT · kaizen · the 3 load-bearing moves |
| `go-and-see.md` | Genchi genbutsu — how work *actually* gets done today, friction included. | the 5 sections; "done ≠ done right"; over-build is the recurring stall |
| `card-model.md` | The MTG lens for the shelf. | budget=mana · **Sorcery=single-use / Permanent=reusable** · color pie→play taxonomy · graduation · the `card={...}` target shape |
| `stack.md` | The toolchain record. | TS-on-Bun · BAML authoring-only · `claude -p` seam · provisional `src/**` layout |
| `ci-strategy.md` | The CI/CD steering for E-002. | **The Central Rule** (Dagger invokes, never defines) · `/ci` structure · 3-class defect model · measured 18.4s cold-start → keep-warm mandatory · Dagger `v0.21.4` |
| `playbook-decompose-epic.md` | The first clearing function (v0 lever). | the 4 value-ordered gates (value→allocation→bounds→structural) · the `DecomposeEpic(...)->WorkPlan` shape |
| `playbooks/project-steering.md` | The **meta-play** — clears *direction itself*. | the 10 recurring moves · the steering andon · `SteerProject(state,intent,budget)` |
| `playbooks/steering-data-model.md` | The capture spec for `decisions.jsonl`. | the decision record schema · "keep what you cannot reconstruct" |
| `playbooks/ci-structural-gate.md` | The how-to-repeat for adding a gate. | the 6 repeatable steps · `AddGate(checkName,command)` |

**Coherence read.** The *principle* layer is internally consistent: vision↔charter
are pinned ("when the two disagree, fix one"); tps and card-model are two lenses on
the same charter, not rival claims; ci-strategy nests cleanly under tps ("inspection
is the weakest check"). Contradictions, where they exist, live at the *operational*
layer (§4), not the principle layer.

This survey **is** `project-steering.md`, move-for-move: orient on state (§1–§3),
surface the real forks (Design), capture durably (the deliverable), log the decision
(`decisions.jsonl`). It is that meta-play run as one autonomous cast (E-006, P4).

## 2. The roadmap — board state at survey time

**Epics on disk** (`docs/active/epic/`): E-001, E-003, E-004, E-005, E-006, plus
`TEMPLATE.md`. **E-002 is referenced everywhere but has no epic file** — it exists
only as a `demand.md` signal (the CI backstop). Finding, carried to §4.

| Epic | Title | Status | Advances | Readiness now |
|---|---|---|---|---|
| E-001 | dispense-slice | **active→done** (committed `4a1d632`; 114 tests green; A1 live) | P1,P3,P7 | shipped |
| E-002 | CI structural backstop | signal only (no file) | (enabler) | **unblocked** — needs epic card |
| E-003 | vend-cli-shelf | open (spec staged) | P2 | **unblocked** (E-001 done) |
| E-004 | cross-board-id-guard | open | P3 | **ready** |
| E-005 | thread-real-model-id | open | P3 | **ready** |
| E-006 | survey-the-roadmap | open (this) | P4 | in progress |

**Stories on disk:** S-001, S-002 (both E-001), S-006 (E-006). **Tickets:**
T-001-01…04, T-002-01…04, T-006-01. These are the live ids the plan must not
collide with (AC: "no id collisions with the live board").

## 3. The value + budget model (the ranking instrument)

From `demand.md` — the plan must sequence with *this* instrument, not invent one:

- **Value = leverage, never effort.** Tiers: **Keystone** (unblocks the DAG / is the
  core feature) → **High** (advances core feature or a charter invariant, or de-risks
  much that follows) → **Standard** (real value, bounded blast radius) → **Leaf**
  (unblocks nothing).
- **Budget = a bounded envelope, not an estimate.** Agent runs are fat-tailed; you
  *bound*, you don't estimate. Denomination: wall-clock + token ceiling; human unit =
  the **~2-hour feature block**; a single dispense is minutes-to-tens.
- **Pull order = value + readiness, not ID order.** Ids are assigned on pull.

**`demand.md`'s own open fork** (verbatim intent): after E-001, the `vend` shelf
(E-003) and the CI backstop (E-002) are **both High but pull in opposite
directions** — shelf advances the *core feature*, CI is the *enabler*. The board
"surfaces the trade, it doesn't resolve it." It adds a **cheap prerequisite either
way**: pull the id-collision guard (E-004) first if you want the *machine* to
decompose the next epic in place. This is the spine the Design phase sequences along.

**Kaizen signals (all ready, from E-001's live proof):** E-004 id-guard (High,
~1h) · bound-dispense-exploration (Standard, ~1h) · E-005 model-id (Standard, mins).

## 4. Cross-reference frictions (raw — the bounds check, refined in the deliverable)

What "go and see" surfaces when the KB is laid against the board. Logged here
descriptively; the deliverable states them as contradictions or "none found."

- **F1 — story-id scheme is self-contradictory.** E-001 consumed *both* `S-001` and
  `S-002` under a **flat sequential** scheme. E-006 used **epic-matched** numbering
  (`E-006`→`S-006`/`T-006-01`). Under epic-matched numbering, E-002's natural story
  id `S-002` is **already taken** by E-001's second story. This is the cross-board
  id-collision (E-004) showing up *by hand, at planning time, at story granularity* —
  the very defect E-004 automates for tickets. Load-bearing for "no id collisions."
- **F2 — `demand.md` is internally stale.** Its signal table marks E-001 **done**,
  but the same file's E-003 and CI rows still read "**blocked on E-001**." E-001 is
  committed (`4a1d632`, `decisions.jsonl` D-001 outcome `done`). Both are now
  unblocked; the board hasn't been swept since E-001 landed.
- **F3 — E-002 is an epic without a card.** Referenced as "E-002" in `ci-strategy.md`,
  `demand.md`, and `E-001.md` ("the next pull, E-002"), but no `epic/E-002.md`
  exists. Planning its stories presumes a card to hang them on. A gap, not a
  contradiction — but it gates "plan E-002's stories."
- **F4 — RDSPI mismatch (the commissioned friction).** E-006 is a *sorcery* forced
  through RDSPI, which is built for code *permanents*. "Structure/Implement" have no
  natural meaning for a survey whose only output is one markdown plan. The ticket
  Notes explicitly ask this be recorded in Review — it is the motivation for the BAML
  sorcery engine. Mapped now, surfaced in `review.md`.

## 5. Constraints & assumptions

- **Stories only.** Plan stories; do **not** materialize their tickets (each epic's
  own later cast does that). No writes to `docs/active/tickets/` or `stories/`.
- **Cite, don't invent.** Each planned story names the KB doc(s) that drive it
  (charter recompute, not speculation) and carries a value tier + budget envelope per
  `demand.md`.
- **Sequence by leverage + readiness**, not effort (fat-tailed; unestimable).
- **Greenfield-of-documents trap** (`go-and-see.md` §2): there is barely any *code*
  to map for a planning ticket — "enough context" is a judgment call against intent,
  and the recurring failure mode here is **over-building** the plan past the slice
  (`decisions.jsonl` D-003). The Design phase must hold that andon: plan one wave,
  rank it, stop — do not stockpile inventory that rots (`demand.md` opening).
