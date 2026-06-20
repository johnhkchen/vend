# What Vend should do to improve cognitive overhead

**Date:** 2026-06-19 · active discovery cycle · method: reframe surfaced ideas into
**opportunities (problems)**, score with **Opportunity = Importance × (1 − Satisfaction)**
(Dan Olsen), prioritize the top 3. Builds on `brainstorm-lower-articulation-cost.md` and the
`clearing-dynamics.md` lens. *(Saved to the desk; uncommitted — a lisa loop holds the tree.)*

---

## The articulation (the ask)

> **Cognitive overhead is everything Vend forces you to hold in your head that it could hold
> for you.** Vend should shrink the human's working set to exactly one item: *the next move,
> already extracted, already priced, ready to accept.* You hold **intent and assent**; Vend
> holds everything else — extraction, ranking, pricing, execution, verification.

Three things load a builder's mind, and Vend should absorb each:

1. **Figuring out what to do** → Vend *reads the demand off the project* and surfaces it, so
   you never face a blank page. (You stop *composing* the next move; you *edit* a proposed one.)
2. **Deciding among options** → Vend *collapses the choice* to one pre-filled recommended
   run, so the common act is a single assent, not a fork of decisions.
3. **Checking the work** → Vend *earns trust through visible gates*, so you stop watching and
   walk away — the gate-stop, not your vigilance, is what catches a defect.

This is the `clearing-dynamics.md` principle applied to the *mind*: the customer is the
project, the human assents. **Cognitive overhead is minimized exactly when the human's role
collapses to author + assent.** Everything below is in service of that one sentence.

---

## Themes → Opportunity scores

The cognitive-overhead problems the builder actually carries, scored (Importance & current
Satisfaction on 0–1; **Opportunity = Imp × (1 − Sat)**):

| # | Opportunity (problem, in the user's voice) | Imp | Sat | **Score** | Read |
|---|--------------------------------------------|-----|-----|-----------|------|
| **O1** | "I can feel the work but **can't formulate** the next move." | 0.9 | 0.2 | **0.72** | **Top** — Vend expects a formed signal; the gap is widest here. |
| **O4** | "I **can't trust it to run unattended**, so I keep watching." | 0.9 | 0.2 | **0.72** | **Top** — and *measured* unmet: E-014's **E1 = HOLD**. |
| **O2** | "**Too many decisions** to even start a run." | 0.8 | 0.35 | **0.52** | **Top** — two gestures is still two decisions for a tired user. |
| O3 | "My **half-thoughts evaporate** before I can structure them." | 0.6 | 0.2 | 0.48 | Close behind; cheap to serve. |
| O7 | "I can't tell **what's worth doing** vs noise." | 0.8 | 0.5 | 0.40 | Partly served (leverage-ranked board, recommendation-first). |
| O5 | "I can't tell **what state** a run/project is in." | 0.7 | 0.5 | 0.35 | Designed (IA-7) but TUI unbuilt. |
| O6 | "I have to **re-specify my process** every run." | 0.8 | 0.7 | 0.24 | **Already Vend's strength** (playbooks, P1) — *don't reinvest here.* |

**Strategic alignment.** O1/O2/O3 are the *clearing dynamic's demand side* (read + present
latent demand). O4 is the *trust contract* (P3/P4) — and the only top opportunity with hard
evidence it's unmet. O6 scoring lowest is the system working: the thing Vend was built to
solve is solved; overhead reduction must target the *underserved* problems, not the won ones.

---

## Top 3 opportunities

### O1 — Articulation cost ("I can't formulate the next move") · score 0.72

- **Rationale.** The single widest importance/satisfaction gap. The fruit exists and the user
  feels it, but Vend's entry point still expects a well-formed signal — so the overhead lands
  entirely on the human. The clearing dynamic says Vend should *read* this demand, not receive it.
- **Alternative solutions.** (a) **Survey play** — read repo+docs → propose a stocked board;
  (b) **`expand-fragment`** — few words + context → a full signal; (c) **codebase-index →
  auto-signals** (hotspots, gaps grep can't see); (d) **rough-notes inbox** (defer structure).
- **High-risk assumptions.** Machine-extracted demand is *trustworthy enough to pick from*
  (not noise); the rough project holds enough signal to harvest; **editing a draft is genuinely
  cheaper than composing** for the user.
- **Cheapest test.** Run a Survey-style pass by hand (≈ this session) and measure the
  **acceptance/edit rate** of the proposed signals. High accept → extraction is trusted. Or
  feed `expand-fragment` a 5-word fragment and check if the output is *edit-ready*. Near-free.

### O4 — Trust / vigilance cost ("I can't walk away") · score 0.72

- **Rationale.** The most expensive overhead of all: if trust is absent you *never leave the
  loop*, so you carry the full vigilance load every run. This is "supervision doesn't scale"
  restated as cognitive cost — and **E-014's E1 verdict (HOLD)** says it's currently real.
- **Alternative solutions.** (a) Make the gate-stop a **visible, legible event** (the andon
  UX, IA-9) so trust is *earnable and observable*; (b) **surface the E2 evidence** (gates cut
  variance ~21%) to the user as a reason to trust; (c) a **per-play track record** in the
  Ledger. **Explicitly NOT "more autonomy"** — that's the wrong fix and is gated by the HOLD.
- **High-risk assumptions.** *Visible* gates build trust faster than merely-working gates; a
  track record actually changes walk-away behavior; ~21% variance reduction is enough to *feel*.
- **Cheapest test.** Keep the E1 instrument running (intervention rate over more runs) and
  correlate it with making andons legible — does a visible gate-summary move the walk-away rate?

### O2 — Decision fatigue at the counter ("too many decisions") · score 0.52

- **Rationale.** Even two gestures = two decisions (which play, what budget). For a saturated
  user that's two too many; choice itself is the load. The fix is to collapse N choices to one
  assent without removing control.
- **Alternative solutions.** (a) **Accept-the-default Counter** — pre-fill play+budget+tier,
  one Enter; (b) **decision-diet mode** — narrow to one recommended run on a fatigue signal;
  (c) **recommendation-first home** — one move + 2 alternates.
- **High-risk assumptions.** The pre-filled default is right *often enough to accept blindly*;
  collapsing choice doesn't read as **loss of control** (tension with P2's "you allocate the
  budget" and IA-5 recommend-never-auto).
- **Cheapest test.** Measure how often the user **changes** the pre-filled budget/play vs
  accepts it — partly available now (envelope-vs-actual in the run log). High accept rate →
  defaults are trustworthy → collapse the UI safely.

---

## The one-line synthesis

**Vend improves cognitive overhead by holding the project's complexity so your mind holds one
thing.** Extract the move (O1), earn the trust to stop watching (O4), and collapse the choice
to one yes (O2) — author + assent, nothing else. The top opportunities aren't a feature list;
they're the three loads to lift off the human, in priority order, each with a near-free test.
