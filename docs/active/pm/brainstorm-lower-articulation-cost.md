# Brainstorm — lower the articulation cost of feeding Vend

**Date:** 2026-06-19 · Product-trio ideation (PM · Designer · Engineer) · **active discovery
cycle** (gate down). First artifact of the next cycle.

**HMW:** make it easier to use Vend in your workflow when you're *out of ideas in the
moment* (too many decisions), the project is *still very rough* with obvious low-hanging
fruit, but **articulating that fruit is exhausting**.

## The reframe

The pain is not *not knowing what to do*. The fruit exists and you can feel it. The pain is
the **extraction / expression cost** — turning a felt "this is rough" into a stated,
allocatable signal. That's upstream of Vend's current entry point, which still expects a
reasonably well-formed signal. **The opportunity: Vend should articulate *for* you, from
what's already latent in the project, and present it with the fewest possible decisions.**

> Meta-proof: this very session demonstrated the relief — a PM agent surveyed the rough
> project and drafted the batch so the human didn't have to. Most ideas below ship that.
> And the fruit to pick first *is the fruit-picker itself* — which is the point.

---

## Ideation — three lenses, 5 each

### Product Manager (value · alignment · impact)
1. **Survey play, shipped** — register `Survey`: read the rough repo + docs → propose a
   stocked demand board of low-hanging fruit. Turns "articulating is exhausting" into
   "review a list." (IA-3 bootstrap; already a staged signal.)
2. **"Vend, what's next?"** — one bare command surfaces the single highest-leverage move now
   + 2 alternates (recommendation-first, IA-1). The fatigued user gets a pull, not a blank page.
3. **Latent-fruit harvest** — mine what's *already written but unstructured* (TODO/FIXME,
   failing tests, `go-and-see` friction notes, scattered kaizen one-liners, andon'd runs) and
   auto-draft them into candidate signals. The articulation already happened in fragments;
   Vend assembles it.
4. **SteerProject-lite** — productize this session: a "steer my project for an hour" play
   that surveys, drafts the batch, and surfaces only the *real forks*. You answer a handful
   of decisions instead of composing from scratch. (Top of the clearing stack.)
5. **Decision-diet mode** — on a fatigue signal, Vend *narrows* choices: defaults the budget
   (measured envelope), the tier (leverage), the play — and presents **one** pre-filled
   recommended run to accept. Collapses N decisions to one yes/no.

### Product Designer (UX · usability · delight)
6. **Rough-notes inbox** — dead-simple capture: brain-dump a messy half-thought ("the CLI
   parser is getting gross"); Vend refines fragments into proper signals *later*. Capture is
   one gesture, zero structure; articulation is deferred to the machine. (Seeds off the
   existing `capture-note` play.)
7. **Accept-the-default Counter** — Confirm pre-fills *everything*; the only act is Enter.
   Adjust is the hidden exception. "Do the next thing" becomes one keystroke (P2 literalized).
8. **Low-hanging-fruit board view** — Home sorts surfaced demand by *effort-to-leverage*, the
   cheap-and-valuable items front and center as "grab one of these." Delight = a pile of
   ranked easy wins, not a daunting backlog.
9. **Fragment-friendly dialog** — talk to Vend in fragments; it never demands a well-formed
   spec, it reflects back a sharpened version ("did you mean: consolidate the CLI
   arg-parsers?") for one-tap confirm. Articulation becomes *editing*, far cheaper than *composing*.
10. **The empty-handed start** — opening Vend with nothing in mind shows not a blank prompt
    but "here are 3 things I noticed about your project." The tool volunteers; you never face
    the blank page that triggers the fatigue.

### Software Engineer (tech · data leverage · scale)
11. **Codebase-index → signals** — wire the structural graph (complexity hotspots,
    god-functions, the O(n²) it already found, dependency violations) into auto-drafted
    signals. The map *is* a fruit-detector; it surfaces what grep can't. (The index practice
    already runs at dev-time — productize its output as demand.)
12. **Ledger-generates-demand (IA-15)** — a play that rotted (andon-rate spike) or whose cost
    trends up auto-surfaces a pull signal. The system notices its own decay and proposes the
    fix — zero articulation. (Staged signal.)
13. **Heuristic gap-scanners** — cheap deterministic checks emitting candidate signals:
    undocumented public functions, tests missing for changed files, gates not covering a
    source dir (exactly the scope-gap that became E-012), stale docs vs code. Each gap = a
    pre-articulated signal.
14. **"What did I leave unfinished" detector** — scan recent commits + working tree for
    half-done threads (a function added without a test, last session's TODO, a play registered
    without its follow-up) and resurface them as "finish this?" Leverages git + run-log history.
15. **`expand-fragment` function** — a BAML function: 5-word fragment + project context →
    a well-formed signal (what · why · tier · rough envelope). The **articulation primitive**
    that powers the inbox, the dialog, and the Counter. Small, reusable everywhere.

---

## Prioritized top 5 (composable — they form one loop)

| Rank | Idea | One-sentence | Why selected | Key assumptions to validate |
|------|------|--------------|--------------|------------------------------|
| **1** | **`expand-fragment` primitive** (#15) | A function that turns a few words + project context into a well-formed demand signal. | Smallest, lowest-effort, highest-leverage substrate — one BAML function on the proven dispense that *every* other idea reuses. Build the primitive first. | A fragment + context is *enough* signal to draft a usable what/why/tier; the draft is good enough to edit rather than redo. |
| **2** | **Rough-notes inbox** (#6) | One-gesture capture of messy half-thoughts; refined into signals later. | Attacks the exhaustion at the exact moment it strikes — capture costs nothing, structure is deferred. Seeds off existing `capture-note`. Pairs with #1. | People will dump fragments if it's truly frictionless; deferred refinement (vs in-the-moment) is acceptable, not lossy. |
| **3** | **Survey play, shipped** (#1) | Vend reads the rough repo+docs and proposes a stocked board of low-hanging fruit. | The keystone "articulate for you" move and the IA-3 onboarding bootstrap at once. Already staged; new play on the proven engine. | Survey's proposals are *trustworthy enough to pick from* (not noise); the rough project has enough signal in it to harvest. |
| **4** | **Codebase-index → signals** (#11) | Auto-draft signals from the structural graph's hotspots, gaps, and violations. | Feeds #3 with concrete, grep-invisible fruit; the index already runs at dev-time, so it's mostly *wiring output to demand*. High differentiation. | The index's findings map to *valuable* work (not just lint noise); freshness/re-index cost stays low. *(Note: the MCP was live this session but can disconnect — confirm the local binary is the dependency, not a remote service.)* |
| **5** | **Decision-diet / accept-the-default** (#5+#7) | When you're fatigued, Vend pre-fills everything and offers one recommended run to accept. | Serves the *other* half of the HMW — "too many decisions" — by collapsing N choices to one yes. Literalizes P2; needs measured envelopes (have them, E-013). | Accept-the-default is right often enough to trust; a single recommended pull beats a ranked list for a tired user. |

**The loop they form:** `expand-fragment` (the engine) → the **inbox** captures fragments →
**Survey + index-harvest** surface latent fruit → **decision-diet** presents one easy yes.
Capture without structure, articulate by machine, decide with one keystroke.

---

## Opportunity-Solution-Tree sketch

```
OUTCOME: more progress per session despite fatigue (near-zero articulation cost)
│
├─ OPP "I can't formulate the next move"      → Survey (#1) · index-harvest (#11) · expand-fragment (#15)
├─ OPP "Too many decisions to even start"     → decision-diet (#5) · accept-the-default Counter (#7)
└─ OPP "My half-thoughts evaporate first"     → rough-notes inbox (#6) · unfinished-detector (#14)
```

---

## Note on this cycle

Mostly **low effort, high leverage** — and several are already staged signals (Survey,
IA-15) or existing seeds (`capture-note`, the codebase index). That's the HMW answering
itself: the cheapest fruit on the tree *is the machinery that picks the fruit*. A natural
discovery → brief here would start with **#1 (`expand-fragment`)** as the primitive, since
everything else composes on it.
