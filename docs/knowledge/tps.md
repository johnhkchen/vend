# Vend — The Toyota Production System Lens

The framing spine. Read alongside `vision.md` (the why) and `stack.md` (the how).
Every Vend design decision is judged against this lens: does it move us toward a
line that builds quality in and stops itself on a defect, or away from it?

**The thesis in one line:** *Vend is the Toyota Production System for
probabilistic knowledge work.* The vision's promise — consistency, "you got what
you paid for," repeatability over a natively unrepeatable process — is precisely
what TPS sells: defect-free output at volume from a fallible process. We did not
invent this problem; Ohno solved its physical-world twin sixty years ago. The
dev's situation is his founding question — **how does one operator run many
machines without shipping defects?**

---

## The mapping

The dev's loop today is, in TPS terms, a textbook un-improved line:

| TPS lens | The dev's loop today | Prescription → Vend mechanism |
|---|---|---|
| **Push / overproduction** (worst waste — it hides all others) | Batch-drafting epics in chat, stockpiling tickets to keep the loop fed | **Pull (kanban):** lisa's free capacity is the demand signal that pulls the next increment of tickets, JIT |
| **Manual inspection** | Dev sense-checks every decomposition live | **Jidoka — build quality in, don't inspect it in:** quality lives *inside the play* |
| **Andon** (anyone can stop the line) | A bad ticket flows downstream, found late at CI / after wasted sessions | Gates that **stop the play and summon the dev only on exception** |
| **Poka-yoke** (mistake-proofing) | Malformed or under-specified tickets are possible | Typed BAML I/O + lisa's schema make common defects *impossible by construction* |
| **Standardized work** | Judgment lives in ephemeral conversation | The **play** = the written-down best-known method, and the baseline for improvement |
| **Kaizen + genchi genbutsu** | Same mistakes recur; no improvement loop | **Outcomes from lisa → 5 Whys → harden the play** so that defect-class can't recur |
| **Mura → Muri → Muda** | Uneven demand → 3am overburden → defective plans | **Heijunka (level the load):** pull at takt removes the surge; the dev stops being surge capacity |

---

## The three load-bearing moves

**1. Jidoka answers "I can't supervise N agents."** One Toyota operator runs a
dozen machines because each *stops itself* on an abnormality; the human is freed
from watching and intervenes only on the andon pull. The dev can't supervise 24/7
execution for the same reason Ohno's operators couldn't watch every spindle —
they're doing it by *attention*. The fix is not more attention; it is **making
each play stop itself.** A play's gates (`@assert`/`@check`, `lisa validate`,
harness-readiness) *are* the andon cord, built into the artifact. And the
cultural inversion matters: **stopping the line is celebrated, not punished.** A
play that halts at 3am and waits is cheaper than one that pushes twelve bad
tickets into a tireless executor overnight. Design plays to be *eager to stop,
loud, and specific*; make stopping cheap. This deliberately inverts the dev's
current incentive ("keep the loop fed at all costs → push garbage").

**2. Pull kills the 3am behavior at the root.** The failure mode *is* push:
speculatively draft a batch, shove it in, hope. Overproduction is the worst waste
precisely because it manufactures the inventory of defects you later pay to
inspect. Invert it — don't pre-stock tickets; let lisa's spare capacity *pull* a
plan-increment when it is actually needed. Idealized, even the "two gestures"
become demand-driven: the pick is triggered by capacity; the dev only authors and
tends the play.

**3. "Request inputs" is an andon pull at the planning layer.** Instead of the
dev front-loading perfect context (which they can't, least of all at 3am), the
**play pulls exactly the context it is missing, when it is missing, and stops to
request it** rather than hallucinating a plan from a thin prompt. That is JIT
applied to *information*, and poka-yoke on the input side: an under-specified
`Play` cannot silently produce garbage — it raises its hand. The defect
"insufficient context" is caught at the source, where it is cheapest, not at
inspection, where it is most expensive.

---

## Standard work and kaizen

The **play** is TPS standardized work: the current best-known method to decompose
a class of intent, *written down*, repeatable, and the baseline for improvement.
The critical TPS insight — standardized work is **owned by the operator and
continuously revised**, never frozen and handed down. So the play must be *easy to
revise*; its whole value is being the thing you improve. Outcomes from lisa are
the **kaizen signal**: every defect that slips through gets a **5 Whys**, and the
fix strengthens the play's andon/poka-yoke so that *class* of defect can never
recur. The play hardens monotonically.

## The role shift

When jidoka freed the operator from watching the machine, it did not make them
idle — it promoted them to *improving the standard and answering andon*. That is
the dev's new job, and the **new medium** they must master: not drafting
decompositions (line work) but **authoring and continuously hardening plays**, and
responding to the handful of andon pulls a day (engineering the line). The dev
stops being the line worker and becomes the **industrial engineer of their own
planning line.** This is what "design the loop, don't run it" means — with a
sixty-year-old precedent showing it works. Note that this is a *design*
discipline, not a styling one: authoring a play is designing the interface between
human intent and an executor that will never ask a clarifying question, so every
affordance, default, and failure mode must be designed in up front.

---

## Genchi Genbutsu — how work actually gets done here today

*Go and see.* Honest answers grounded in two data sources: the lisa/RDSPI design,
and the most concrete evidence available — *this very session*, in which the work
(encoding goals, choosing the stack, mapping TPS) is being done the un-standardized,
conversational, judgment-in-the-hands way. That transcript is Exhibit A for the
problem Vend exists to solve.

**1. How a piece of work actually gets done — the real steps, messy ones included.**
Something needs doing → it must become a *ticket* (markdown + YAML frontmatter) in
`docs/active/tickets/`. Today that is manual: the dev drafts an epic in chat with
Claude, decomposes it into stories/tickets, hand-writes frontmatter (`id`, `story`,
`type`, `priority`, `depends_on`), and — the error-prone part — hand-models the
dependency DAG, especially file-overlap edges (the "critical rule"). `lisa validate`
catches structural errors; fix by hand. `lisa loop` launches zellij and spawns a
Claude Code session per ready ticket (≤ `max_threads`, here 2). Each session runs
RDSPI — Research → Design → Structure → Plan → Implement → Review — emitting a
~200-line artifact per phase into `docs/active/work/{ticket-id}/`; lisa auto-advances
on artifact detection. Review pauses let the dev spot-check (Research/Design are
highest-leverage). Implement commits incrementally; `progress.md` logs deviations.
"Finished" = `phase: done`, then archived to `docs/archive/`. *The messy/manual core
— epic drafting, decomposition, dependency edges, granularity calls, catching an
off-rails session, branch hygiene, judging real done-ness — is exactly the work that
has no standard and doesn't survive 24/7.* → **the play encodes it; gates stop the line.**

**2. What must be loaded before progress, and how you know you have enough.**
Context comes from: `CLAUDE.md` (conventions) + `rdspi-workflow.md` + the
`knowledge/` docs (auto-injected by lisa), the ticket itself (intent + acceptance
criteria), upstream tickets' `work/` artifacts, and the codebase reality the
Research phase maps. *How you know you have enough* is the weak spot: the
~200-line Research artifact is a forcing function, not a guarantee — on a greenfield
repo there is almost no code to map, so "enough" is a judgment call against intent,
and you don't know what you don't know. → **request-inputs andon: the play pulls
missing context and stops rather than guessing.**

**3. How we know work is good — done right, not just done.** Checks today:
acceptance-criteria checkboxes, RDSPI Review (`review.md` self-assessment + flagged
issues), `lisa validate` (structural, pre-execution), tests (Plan defines strategy,
Implement writes them, `bun test`), CI (the inspection layer), and human spot-checks
of artifacts. **The gap:** `phase: done` ≠ *good*. Acceptance criteria are only as
good as how they were written; self-review is the agent grading its own homework;
human review doesn't scale to 24/7. Quality is largely *inspected in*, not *built
in*. → **jidoka: move the checks inside the play as andon gates; CI hardens the
output side.**

**4. What feels repetitive or mechanical.** Re-establishing the same context every
session; writing ids/frontmatter/dependency edges; the six-artifact ritual's
boilerplate; re-explaining the same decomposition heuristics each epic; hand-checking
the same failure patterns (missing deps, under-specified tickets, wrong granularity);
commit hygiene and archiving. *Every item on this list is a standardized-work or
poka-yoke candidate* — the repetition is the signal of what to encode once.

**5. Where work breaks down, stalls, or is redone.** Under-specified tickets → the
agent flails → rework. Missing dependency edges → two tickets touch the same files →
conflicts (the lock is a safety net, not a fix) → rework. Wrong granularity → not
atomically committable, or too vague. Context degradation over a long session →
drift. Crashes/limits → resume from artifact (insurance, but disruptive).
Decomposition done at low energy → bad plans flow into nonstop execution → *garbage
at scale, discovered late*. Self-review rubber-stamps. The human bottlenecks at
planning and review → the line stalls when they're unavailable. "Done but not right"
slips to CI or later → follow-up fix tickets and reverts. → **these are the precise
andon / poka-yoke / pull targets; each is one row of the mapping above.**

---

## The idealized line (the design target)

Even if v0 is thinner, design *toward* this: author a play once → lisa's capacity
**pulls** plan-increments at takt → each increment is **poka-yoke'd and
andon-gated** so defects stop the line and summon the dev only on real exception →
**outcomes feed kaizen** that monotonically hardens the play. The dev's day shrinks
to a few andon pulls and improving the standard. That is one operator running many
machines — Ohno's answer, applied to probabilistic work.

---

## Glossary

| Term | Meaning |
|---|---|
| **Jidoka** | Autonomation — automation with a human touch; machines detect defects and stop themselves. Lets one operator oversee many machines. |
| **Andon** | The signal/cord that stops the line on a detected defect and summons help. Stopping is encouraged. |
| **Poka-yoke** | Mistake-proofing — design that makes defects impossible or immediately obvious. |
| **Just-in-Time (JIT)** | Produce only what's needed, when needed, in the amount needed. Pull, not push. |
| **Kanban** | The pull signal: downstream demand authorizes upstream production. |
| **Takt time** | The rhythm of production matched to demand. |
| **Heijunka** | Production leveling — smoothing volume/mix to remove bursts and starvation. |
| **Standardized work** | The current best-known method, written down; the baseline for improvement, owned and revised by the operator. |
| **Kaizen** | Continuous improvement — small, relentless, against the standard. |
| **Genchi genbutsu** | "Go and see" — ground decisions in the actual place and thing. |
| **Muda / Mura / Muri** | Waste / unevenness / overburden. Mura causes Muri causes Muda. |
| **5 Whys** | Ask "why" until you reach root cause, then fix the cause, not the symptom. |
