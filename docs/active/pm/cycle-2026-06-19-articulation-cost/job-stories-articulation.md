# Job stories — "Vend articulates the next move for you"

**Date:** 2026-06-19 · **Feature:** the demand-extraction feature (NEXT horizon, O1/O3) —
Vend reads latent demand off the project and proposes runnable moves, so the builder **edits
a draft instead of composing from a blank page**. JTBD format (situation-first, role-agnostic).
**Design:** no mockup yet — anchored to the IA spine (IA-1 recommendation-first · IA-3 Survey
bootstrap · IA-4 honest-empty · IA-9 andon). *(Saved to the desk; uncommitted — loop holds the tree.)*

> Acceptance criteria are **observable and measurable**, and bound by the clearing-house
> discipline: demand is **read, never invented** (`propose-epic.md` PE-1); a flat gradient
> yields an **empty board, not busywork** (IA-4).

---

## Story 1 — Get unstuck from a blank page

**Title:** Surface the next move when I'm out of ideas

**Description:** When I sit down to a rough project, fatigued and unsure what to do next, I
want Vend to show me the highest-leverage candidate moves it sees, so I can start from a
proposed move instead of a blank page.

**Acceptance criteria:**
1. From bare state, Vend produces a **ranked shortlist (≤6)** of candidate moves read from
   current project state (repo + docs + run log), not a blank prompt.
2. Each candidate carries **what · why · value tier · a pre-filled budget envelope** (from
   measured data, E-013) — enough to pick without further specification.
3. Candidates are **ranked by leverage** (vision-distance closed per budget), highest first.
4. Every candidate **traces to real project state**; none is invented to fill the list (PE-1).
5. If nothing genuinely closes vision-distance, Vend says so — an **honest empty board**, not
   manufactured work (IA-4).
6. The list is produced within a stated budget envelope shown up front.
7. **Measure:** % of sessions that begin from a proposed move vs. a blank page (target ↑).

---

## Story 2 — Capture a half-thought without breaking flow

**Title:** Dump a rough idea in one gesture

**Description:** When a rough edge catches my eye mid-work but I have no energy to write it
up, I want to capture the fragment in one gesture with zero required structure, so I can keep
working and let Vend shape it into a signal later.

**Acceptance criteria:**
1. Capture takes **one gesture** and accepts a **free-text fragment** — no fields, tier, or
   budget required at capture time.
2. The fragment is **persisted immediately** (survives restart) and never blocks the current run.
3. Later, Vend **expands each fragment** into a well-formed signal (what · why · tier · rough
   envelope) via `expand-fragment`, on demand — not eagerly.
4. The expansion is presented as an **editable draft**, not a committed signal (PE-6: intent,
   not decomposition).
5. A fragment that maps to **no real demand** is allowed to be dropped, not force-expanded.
6. Captured fragments are visible in one place (the inbox) with their expansion state.
7. **Measure:** fragments captured/week; fragment→accepted-signal conversion rate.

---

## Story 3 — Accept or edit a proposal instead of authoring

**Title:** Turn a felt "this is rough" into a signal by editing, not writing

**Description:** When Vend has proposed a move and I mostly agree, I want to accept it or
tweak a line, so I can clear work without paying the full cost of articulating it myself.

**Acceptance criteria:**
1. Each proposal is **editable in place** (title, why, tier, budget) before it's pulled.
2. **Accept is a single assent**; edit is the exception, not the default path (P2).
3. The pre-filled **budget envelope is the measured default** (E-013); changing it is optional.
4. Accepting **stages** the signal (un-promoted); a separate, deliberate gesture **pulls** it
   onto the active board (PE-1 — Vend proposes, the human pulls).
5. Nothing materializes on the active board until the human pulls (no auto-cast, IA-5).
6. **Measure:** **acceptance/edit rate** of proposals (the O1 trust signal) — high accept or
   light-edit means extraction is trusted; high reject means the proposals read as noise.

---

## Story 4 — Resurface what I left unfinished

**Title:** Pick up dangling threads after a break

**Description:** When I return to the project after time away and can't remember where I left
off, I want Vend to resurface the half-done threads, so I can finish them instead of
re-discovering them.

**Acceptance criteria:**
1. Vend scans **recent commits, the working tree, and the run log** for unfinished threads (a
   function added without a test, a TODO from last session, a play registered without its follow-up).
2. Each is surfaced as a **"finish this?" candidate** with a one-line context of what's dangling.
3. Threads are **ranked by leverage**, consistent with Story 1's shortlist.
4. A thread already resolved (since committed/closed) is **not** resurfaced (no false positives).
5. Surfacing is **read-only** — it proposes, it does not auto-resume a run.
6. **Measure:** # dangling threads surfaced that the human accepts as real (precision).

---

## Story 5 — See the rot I can't spot by eye

**Title:** Find grep-invisible fruit

**Description:** When the project has hidden structural problems I can't see by reading files,
I want Vend to point at them as concrete candidate work, so I can clear real issues I'd
otherwise miss.

**Acceptance criteria:**
1. Vend draws on the **structural graph** (complexity hotspots, god-functions, dependency-
   direction violations, hidden O(n²)) to draft candidate signals.
2. Each structural finding becomes a **signal with what · why · tier · envelope**, not a raw metric.
3. Findings are **filtered for value** — lint-level noise is excluded; only work that closes
   real vision-distance is surfaced (charter: purposeful + grounded).
4. Each finding **names the location** (file/function) so it's verifiable against source.
5. The index dependency is **local** (no remote service required) and its **freshness state**
   is shown (a stale graph is flagged, not silently trusted).
6. **Measure:** % of structural signals accepted as valuable vs. dismissed as noise.

---

## Story 6 — Be handed one move when even the list is too much

**Title:** Collapse the shortlist to a single recommended run

**Description:** When even a ranked list feels like too many decisions, I want Vend to hand me
the one move worth doing now — pre-priced and ready — so I can make progress with a single yes.

**Acceptance criteria:**
1. Vend presents **one recommended move** prominently, with up to 2 alternates tucked beneath
   (recommendation-first, IA-1).
2. The recommendation arrives **fully pre-filled** — play, budget, tier — so the only required
   act is **accept** (decisions-per-run → 1).
3. The budget is the **measured envelope**; the user can adjust, but adjust is the hidden
   exception (P2/IA-5).
4. The recommendation is **honest under uncertainty** — if confidence is low (cold-start), it
   says so rather than feigning precision (IA-8/IA-13).
5. Accepting still respects all **gates and the andon** — a single assent does not bypass the
   contract (P3).
6. **Measure:** pre-fill **accept rate** (accepted as-is vs. changed) — the readiness signal
   for collapsing the counter UI.

---

## Coverage note

Six situations, one feature: blank-page (1), mid-flow capture (2), accept-vs-author (3),
returning (4), hidden rot (5), choice overload (6). Together they lift the **articulation
load (O1)** and the **capture load (O3)**, and tee up the **decision load (O2)** — the
not-trust-gated half of `Outcome-Roadmap-2026.md`'s NEXT horizon. Each story carries a
**measurable acceptance/precision signal**, so the feature can be validated, not just shipped.
