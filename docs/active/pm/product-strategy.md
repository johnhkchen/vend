# Product Strategy Canvas — vend

> **Desk-only strategy capstone** (per `README.md` — staging, not a pull). Synthesizes
> `vision.md`, `charter.md` (P1–P7/N1–N4), `persona-research.md` (the segments + the survey-proven
> trust collapse), and `pestle-analysis.md` (the macro forces) into one coherent 9-section strategy.
> The test of this doc is **internal coherence** — every section should reinforce the same spine:
> *consistency, sold to people newly pushed into probabilistic agent work, defended on vend's own
> invariants.* Nothing promoted.

---

## 1. Vision

> **Vend turns you from the thing *in* the loop into the thing that *designs* the loop.**

The aspiration: make **repeatability over a natively unrepeatable process** an ordinary thing to own.
Agent work is probabilistic; vend sells the one thing probability can't give you — **consistency** —
by moving the expensive judgment (the *lotería* labors: examine, synthesize, set the criterion, review)
to **authoring, paid once**, and freezing it as **gates**. Values upheld: *author once, run forever*;
*gates are the contract*; *autonomy by default*; *local-first*. We inspire by giving people their
attention back — you stop babysitting agents and start dispatching pre-built, gated work.

## 2. Market segments (by problem/JTBD, grounded in `persona-research.md`)

| Segment | JTBD | Evidence | Shipped fit |
|---|---|---|---|
| **The operator/puller** (Devraj — non-dev founder/PM) | *"Show me where my product stands and what's stuck, so I decide what to fund next — without reading logs."* | [S] Anthropic Mgmt cohort; Fortune solo-founders | **Strongest now** — he *is* the designed-for human at the counter (P2 + IA-5 + P7) |
| **The visual steerer** (Maya — designer) | *"Let me see and steer what the agents build, without a dev playing telephone."* | **Internal primary source** (the originating "mini-stroke" request) + [S] Arts/Design cohort | **In flight** — depends on E-055 + the round-trip |
| **The author** (the technical originator) | *"Encode my process once; stop re-specifying it every run."* | Dogfood reality (vend clears its own roadmap) | **Shipped** — the proven user today |

**First segment: the operator/puller (Devraj).** *Why first:* the **structural relief is already
shipped** (gates, two-gesture transaction, budget contract, ranked board) — he needs no unbuilt
surface to get value, unlike Maya (gated on E-055). He's also the **human-gated puller** the whole
clearing model (`clearing-roles`) is built around. The author is the *truest* first user (dogfood);
the operator is the first *expansion* user; the designer is the *highest-ceiling* user, pulled in once
E-055 lands. **Sequence: author (have) → operator (ship onboarding) → designer (ship the surface).**

## 3. Relative costs — differentiated value, not low cost

**Premium *value* position (Starbucks, not Southwest)** on the axis that matters — **consistency** — with
a **low *marginal* cost** quirk that's a genuine edge:
- The product's worth is the **gate/consistency guarantee**, not being cheap. We compete on "you got
  what you paid for," never on price-per-token.
- But vend is **local-first and rides the user's existing subscription seam** (`claude -p`), so the
  *marginal* cost to adopt is near-zero — no new cloud bill, no per-seat SaaS. **Premium value at
  commodity marginal cost** is the rare position; P7 (budget contract) makes even the *executor* spend
  legible and bounded.

## 4. Value propositions (what-before / how / what-after / alternatives)

**Operator/puller (Devraj)**
- *Before:* flying blind — can't read the run well enough to decide what to fund; status trapped in
  artifacts he can't audit; can't tell motion from progress.
- *How:* a **ranked board he picks from** (IA-5 recommend-never-auto-cast), a **two-gesture pull**
  (P2), a **dependency map** (E-055) to fund the keystone not a leaf, **gates** that make "done" real,
  a **budget contract** (P7) that bounds spend.
- *After:* a 20-second glance replaces a status meeting; he allocates capital (his real lever) with
  confidence; the autonomous run clears against gates without him babysitting.
- *Alternatives today:* trusting a contractor's word · reading raw `runs.jsonl` · standup theater ·
  vanilla Claude Code (back in the loop).

**Visual steerer (Maya)**
- *Before:* the work is a markdown wall; she's an involuntary bottleneck; "change the UI" is a verbal
  command a dev relays (the telephone game).
- *How:* the **card model + E-055 SVG board** (see structure, not prose); the **annotation
  round-trip** (steer-as-demand, never silently mutating truth); a **static snapshot** safe to inspect.
- *After:* she reads and steers the board directly; her edits become demand; no dev telephone.
- *Alternatives today:* screen-sharing someone's terminal · Figma-to-code handoff · GUI wrappers /
  "Agent View" dashboards (motivated, partial).

**Author**
- *Before:* judgment trapped in one pair of hands, re-paid every run (EL VETERANO's squint).
- *How:* encode process + gates **once** as a playbook (P1); shelf it; pick + budget + go forever.
- *After:* expertise becomes a reusable, named, gated asset that compounds.
- *Alternatives today:* re-prompting from scratch · prompt-library snippets · bespoke scripts.

## 5. Trade-offs (the explicit NOs — N1–N4, sharpened by strategy)

- **Not a chat copilot (N1)** — the win is *removing* yourself from the loop, not conversing better in it.
- **Not a babysitting dashboard (N2)** — better per-step approval solves the wrong problem.
- **Not a one-off prompt runner (N3)** — the unit is the *reusable, gated playbook*.
- **Not an executor (N4)** — vend orchestrates; Claude Code (and later others) execute. **This is also
  the moat (§9):** staying not-the-executor is what lets vend be executor-*agnostic*.
- **Strategy-level NOs:** **not enterprise-first** (local-first/indie/non-dev channel, not procurement
  cycles) · **not cloud-first** (P5; cloud is a later surface layer, never the foundation) · **not a
  dev-facing orchestration *library*** (LangGraph/CrewAI's game) — vend's unit is the *product* (shelf +
  counter + non-dev surface). Saying no to the library market is what frees us to win the counter.

## 6. Key metrics

- **North Star — cleared runs that pass their gates without human intervention.** The literal
  consistency proof; it's the headline promise made countable. (Operationalized today as the keystone's
  **≥10 cleared forward-E1 records** bar that moves the macro-wallet provisional→confirmed.)
- **OMTM (this cycle) — time-to-first-driven-board for a non-dev** (PRD KR2): copied example + one-line
  seed → a reviewed, ranked demand board in one short session, no code. *Why this one:* it's the single
  measurement that tests the **riskiest strategic hypothesis** (does the non-dev channel convert?) and
  it directly feeds the North Star (every driven board produces cleared runs).

## 7. Growth — product-led, example-driven

- **PLG, not sales-led.** Local-first + open-source + copy-an-example. No seat sales, no demos-to-
  procurement. The product teaches itself by being *driven*.
- **Channels:** (1) **driveable examples** (hackathon → small-biz → Figma — show-don't-tell for the
  conceptual learning curve PESTLE flagged); (2) **the lisa ecosystem** (vend→lisa one-way; `vend init`
  complements `lisa init`); (3) **Homebrew distribution** (Frontier 7, `dist` JS-mode — installable like
  lisa). (4) **Dogfood proof** — vend clears its own roadmap; the repo *is* the demo.
- **Unit economics:** near-zero marginal cost (rides the user's subscription seam; local state). The
  budget contract (P7) is the cost-control story. **Risk:** the seam is Anthropic's to reprice (PESTLE
  §2) — P6 is the hedge.
- **Scale:** more driven projects → more cleared runs → North Star compounds; each example lowers the
  next user's activation cost.

## 8. Capabilities (build vs. partner/ride)

| Capability | State | Build or ride |
|---|---|---|
| Typed, graph-structured orchestration | **Have** (engine/chain; DAG substrate E-046/E-054) | **Build** — core |
| Gates as first-class contract | **Have** | **Build** — *the* differentiator |
| Articulation trilogy (expand/survey/steer) | **Have** | **Build** — the seed→board on-ramp |
| Executor-agnosticism (P6) | **In progress** (open-model runner, Frontier 2) | **Build** — the strategic hedge |
| The non-dev visual surface | **Building** (E-055; round-trip staged) | **Build** — the channel-opener |
| Distribution | **Planned** (Frontier 7) | **Ride** — `dist`/`justfile`/lisa toolchain (don't roll our own) |
| The executor | n/a | **Ride** — Claude Code first (N4); never build a model runner |
| Tool integrations | per-play MCP (E-032) | **Ride** — the MCP standard (Figma, etc.) |

**Must-develop to win:** (1) the **non-dev surface that actually relieves the text wall** (E-055 + face
legibility); (2) **proven executor-agnosticism** (P6 at parity, not just in architecture); (3)
**frictionless install + onboarding** (Frontier 7). The first two are existential; the third is the
channel.

## 9. Can't / Won't — defensibility (against the PESTLE §4 absorption threat)

The central threat is **the executor (Claude Code) absorbing orchestration + visual surfaces.** Vend's
defensible ground is precisely what the executor *structurally cannot* take:

1. **Executor-agnostic neutrality — uncopyable by the executor.** Claude Code cannot be
   executor-*agnostic* against itself; being the **consistency layer over *any* executor** (incl. open
   models) is a position the executor can't occupy without cannibalizing its own lock-in. **This is the
   single strongest moat** — and the reason N4 (not-an-executor) is strategy, not modesty.
2. **The authored-playbook library = switching cost.** Your encoded judgment + gates accrue as a
   private asset; leaving means re-authoring your expertise. The moat is **the accumulated playbooks,
   not the tech** — it deepens with use.
3. **Local-first data posture (P5)** — a position cloud-first platforms won't take (it forecloses their
   data/billing model). Political/legal hedge *and* a trust differentiator.
4. **Consistency-as-contract positioning** — "gates are the product" is a category stance, not a
   feature a dashboard bolts on. Hard to copy without re-architecting around gates as first-class.

**Barriers to new entrants:** low *technical* barrier (orchestration is increasingly commodity) but a
**high positioning + accrued-judgment barrier** — the winner is whoever owns *consistency* and holds
the most encoded playbooks, not whoever ships the best graph. Compete on the counter and the library,
never the plumbing.

---

## Coherence check (does the canvas reinforce itself?)

✅ **Spine holds.** Vision (consistency) → segments (people drowning in probabilistic output) → value
(gates remove the verification labor) → metric (cleared-without-intervention) → moat (executor-agnostic
consistency layer + accrued playbooks). Every section points at **gates + executor-agnosticism +
local-first**. The trade-offs (N4 especially) are *load-bearing for the moat*, not just scope-cuts.
The growth model (examples → cleared runs → North Star) closes the loop back to the metric.

⚠ **The one tension to hold:** §2/§7 lead with the **operator** (shipped fit) while §1's emotional
center and the internal primary source are the **designer** (unbuilt fit). That's deliberate sequencing
— *sell what ships, build toward the ceiling* — but it means the **near-term GTM rests on the operator
while the highest-ceiling story (Maya) waits on E-055.** Don't let the vision's pull reorder the build.

## Critical hypotheses (must be true) → cheapest test

1. **The non-dev channel converts** (the riskiest; PESTLE §B / persona seam). *Pull is [hypothesis],
   push is [S].* → **Test:** the OMTM — drive the hackathon example end-to-end with a real non-dev;
   measure time-to-first-board. (This is also E-055's render-and-watch / Maya's near-free test.)
2. **Gates stay necessary as models improve** (the thesis bet). → **Test:** track the verification-gap
   surveys over time; watch whether better models shrink the "almost-right" frustration. A leading
   indicator, not a one-shot.
3. **Executor-agnosticism holds at parity** (the moat's foundation). → **Test:** the open-model runner
   (Frontier 2) clearing a *real* graph cast, not just rendering — proves P6 is real, not architectural.
4. **The visual surface actually relieves the text wall** (Maya/Sam's fit). → **Test:** put one real
   E-055 `.svg` in front of the originating designer; does it clear her "good enough" bar?

**Strategy in one line:** *Be the local-first, executor-agnostic **consistency layer** for people newly
pushed into probabilistic agent work — win on gates, defend on neutrality + accrued judgment, and ship
the non-dev channel before the executor closes it.*
