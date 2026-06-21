# Discovery — what makes E-055's SVG a *good artifact* when a user points vend at their project

> **Desk-only discovery** (per `README.md` — staging, not a pull). Multi-perspective ideation (PM /
> Designer / Engineer) on the design of E-055's `projectionToSvg` output, for the three personas in
> `persona-research.md` driving a *real* project. Grounded in the visual authorities: `design-language.md`
> (DL-1…DL-9) and `linear-surface-mock.md` (the designer preset + the 5-dim "good enough" rubric).
> Nothing promoted.

## The opportunity (confirmed)

**Outcome:** a non-dev (or a dev mid-context-switch) points vend at their project, gets a **single
static SVG** that is glanceable, comprehensible without a developer, and **steerable** — and it relieves
the text wall instead of reframing it.

**Opportunities (the OST branches the ideas attach to):**
- O1 — *"I can't comprehend the face"* (jargon/density) — the #1 rubric dimension.
- O2 — *"I can't tell what's stuck / what to fund."* (Devraj — edges as payload)
- O3 — *"the re-render is jarring; I lose my map."* (Sam — stability under delta)
- O4 — *"I can't decide / it's just a picture, not a verdict."* (recommendation-first)
- O5 — *"I can't trust it or share it."* (provenance + self-contained file)

## ⚠ The load-bearing reconciliation (decide this first — human's call)

**DL-9: the TUI renders no boxed cards (card model = lens, not chrome).** The **SVG is a different
surface** — the designer-preset projection, not the terminal. It is precisely **where the card lens
legitimately becomes chrome** (boxed cards, the lotería deck). Two atoms need a conscious amendment, not
a silent override:
- **DL-9** — name the SVG as the ratified exception: *"a surface that wants a card changes DL-9 first."*
  This is that change.
- **DL-2** — the terminal palette reserves **amber=andon, never red**. The SVG uses
  `color_language: state` (the mock's green/amber/purple). Reconcile: the **state palette is the
  designer-preset binding of DL-2's meanings**, not a new vocabulary — and it must still **never red-flag
  the andon rate** (DL-8/IA-10). *Stop = a successful refusal, even in color.*

*Recommend: a short DL amendment ratifying "the SVG/designer-preset surface renders the card lens as
chrome; the state palette is its DL-2 binding" — before building, like the Linear-surface charter Q.*

---

## Ideation — three perspectives, 5 each

### Product Manager (value · strategic alignment · customer impact)

1. **Verdict-first header** — the SVG *leads* with the founder brief's "where it stands · the one
   decision waiting on you" (DL-1/IA-1 recommendation-first), *above* the graph. The artifact answers
   *"what do I do?"* before *"what is everything?"* → O4, Devraj.
2. **Multi-seat presets from one graph** — `projectionToSvg(projection, {preset})` emits the **designer
   view** *and* the **founder brief** (the mock's two seats) from one IR via density/groupBy/vocabulary
   knobs. One renderer, two artifacts; serves both the operator (shipped segment) and the designer
   (ceiling). → all.
3. **The SVG as the shareable trust object** — a self-contained file that drops into Slack/a deck/an
   investor update and renders identically everywhere: KR3 (gold-master) made tangible; carries the
   brand (lotería card language). → O5.
4. **Provenance footer** — a quiet ledger line (walk-away rate · gates-working, DL-6/DL-8) so the board
   carries *trust at a glance* — turns a status picture into a credibility object. → O5, Devraj
   "investor-legible."
5. **Vocabulary policy enforced at the face** — strip charter codes/BAML/paths to plain language (the
   mock's translation). The make-or-break for *comprehension-without-a-developer*; without it the SVG
   reframes the text wall (the explicit persona risk). → O1.

### Product Designer (UX · usability · delight)

1. **Card faces as the lotería deck** — each node a *recognizable card* (plain title · why · state), not
   a dense box: recognition over reading, and the brand made visible. → O1, delight.
2. **Color=state with REDUNDANT glyph/shape encoding** — done/active/blocked carried by color **and** a
   status glyph (✅🔄⚠) **and** position, so it survives color-blindness and grayscale print. Closes the
   `persona-research` accessibility gap; honors DL-2 ("color is meaning") *and* adds the redundancy DL-2
   alone doesn't. → O1/O5.
3. **Swimlanes as the spatial skeleton** — groupBy lanes (by epic/theme/state) give the eye a stable
   map; lane headers are the navigation; whitespace divides (DL-1). → O3 (Sam), O2 (structure).
4. **Edges that read as flow; critical path loud, rest hairline** — `depends_on` drawn so
   blocked/critical-path is visually dominant and the rest recedes; the eye is *led to what's stuck*. →
   O2, Devraj.
5. **Solve the static-Details problem by layering, not interaction** — no tap exists, so push dev-detail
   into a *visually recessive* layer (smaller/dimmer, a corner legend) or omit in the low-density preset.
   The face stays clean; detail is present-but-quiet, not a hidden tap. → O1.

### Software Engineer (technical possibility · data leverage · scale)

1. **Content-addressed, stable-under-delta layout** — a node's position is a pure function of its
   **stable ID + lane**, never its index. Reserve lane slots; append, don't reflow. Adding a card leaves
   the rest *put*. → O3 (Sam's hard requirement — the keystone tech idea).
2. **Fully self-contained SVG** — system-font stack or fonts-as-paths, **zero external refs**, everything
   inline → byte-identical render anywhere (the gold-master/consistency bar; Maya's "opens as a file"). →
   O5.
3. **Third consumer of the Projection IR, preset as data** — `projectionToSvg` joins
   `project.ts`/`paper.ts` over the same frozen E-021 IR; the **preset header is config**, the renderer is
   pure. No new data path; the mock's preset *is* the API. → all, low-risk.
4. **Deterministic grid solver with ID tie-breaks** — swimlane columns × topo rows, ties broken by stable
   ID; a bounded, deterministic crossing-reduction pass (no force-directed — E-055 scope). Determinism
   *and* legibility. → O2/O3.
5. **Overlays as a composable render pass** — use E-055's `overlays?` arg: status / critical-path /
   annotations render as a *separate layer* over the base graph, so one base SVG re-skins into many views
   (highlight the critical path; show a diff; the round-trip's post-its). → O2, future round-trip.

---

## Prioritized — top 5 (alignment × impact × feasibility × differentiation)

### 1. Content-addressed, stable-under-delta layout *(Engineer 1)*
*One line:* a node's position is a pure function of its stable ID + lane, so adding work never reshuffles
the board.
*Why:* the **foundational** technical property — without it Sam's whole value collapses and *every*
persona gets a jarring re-render. Determinism-per-render (E-055's stated scope) is **not** enough;
stability-*under-change* is the real bar. Highest leverage, and it's an architecture choice made now or
paid for later.
*Assumptions to validate:* a pure ID→slot map yields a *legible* layout (not just a stable one); lane
slot-reservation doesn't waste the canvas on sparse boards.

### 2. Verdict-first header (recommendation before graph) *(PM 1)*
*One line:* the SVG opens with "where it stands · the one decision waiting on you," then the graph beneath.
*Why:* the single highest-impact UX move — DL-1/IA-1 applied to the artifact. Turns a *picture* into a
*decision surface* (Devraj funds from it; Maya knows where to steer). Differentiates from every generic
graph-render that leads with the graph.
*Assumptions:* the verdict can be derived from the IR (board ranking + andon state) without a human
authoring it; one-decision-at-a-time holds on a busy board.

### 3. Vocabulary policy + clean card faces *(PM 5 / Designer 1)*
*One line:* every node face is plain title · why · state — no charter codes, BAML, or paths.
*Why:* the make-or-break for the #1 rubric dimension (*comprehension without a developer*); the named
risk is that the SVG just reframes the text wall. Reuses the **already-built** translation layer
(`paper.ts`/the mock) — high readiness.
*Assumptions:* the translation that worked on paper holds on a *fresh* project's vocabulary (not just the
vend repo's) — the A3 steer-on-fresh-seed risk, again.

### 4. Color=state with redundant glyph/shape encoding *(Designer 2)*
*One line:* status is carried by color **and** glyph **and** position — never color alone.
*Why:* closes the `persona-research` accessibility gap, reconciles DL-2 ("color is meaning") for the SVG,
and is cheap. Two of three personas lean on color as primary signal — redundancy makes it safe.
*Assumptions:* the state palette stays legible in grayscale/print; the glyph set reads cross-culturally.

### 5. Multi-seat presets from one graph *(PM 2 / Designer 3)*
*One line:* `projectionToSvg(projection, {preset})` emits the designer view *and* the founder brief from
one IR.
*Why:* serves both the **shipped** segment (operator/founder brief) and the **ceiling** segment (designer
tree) without two renderers; reuses the mock's proven two-seat design. Strategic reach per unit of build.
*Assumptions:* the same layout engine serves both densities; "founder brief" may be a *different shape*
(summary table) than a scaled-down tree — may need its own template.

**Deliberately deferred** (real, lower now): live/animated SVG (out of E-055 scope) · the annotation
round-trip overlay (Engineer 5 — staged, charter-gated) · diff/critical-path overlays (Engineer 5 —
post-v1; the `overlays?` arg keeps the door open) · interactive tap-to-expand (the medium is static —
Designer 5 solves this without interaction).

## The cheapest test (do this first — it's already queued)

**Render one real `.svg` of the current vend board and put it in front of the originating designer**
(Maya — `graph-view-human-projection`'s "good enough" bar), scored on the **5-dim rubric** (comprehension
· structure · density · language · navigability). Where it fails, **turn a preset knob, not the graph**,
and re-render — the exact converge-on-a-knob loop the paper mock established. This tests #2/#3/#4/#5 in one
shot for near-free; #1 (stability) is tested by *adding one card and re-rendering* — measure how much moved.

## Handoff note

These five are **design inputs for whoever clears E-055**, not a re-scoping of it. #1 (stable layout) and
the DL-9/DL-2 reconciliation are the two that should be **decided before** the build, because they're
architecture/charter, not polish. The rest converge on the rubric loop. Desk-only; pull E-055 forward by
the normal gesture.
