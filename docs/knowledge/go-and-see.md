# Vend — Go and See: how work actually gets done here today

*Genchi genbutsu.* A first-person, descriptive walk of the actual line as it
stands — friction included, solutions withheld. Grounded in two honest data
sources: the lisa/RDSPI loop as designed (how code tickets *will* run) and what
has actually happened on this repo so far (planning, done conversationally —
the most concrete evidence available). This is the input the `tps.md` lens acts
on; read the two together.

---

## 1. How a piece of work actually gets done — start to finish, messy parts included

**What's actually happened on this repo so far** is planning, done entirely
conversationally. A need surfaces as a fuzzy intent in the dev's head ("encode
the goals," "look at this through TPS"). It enters as a chat message. I ground
myself by poking the repo (`find`, `Read`, `lisa setup-guide`). Then we go back
and forth — I propose, the dev corrects and sharpens (the BAML pivot, "it's
simpler than that," the TPS lens) — and understanding accretes over several
turns. Periodically I crystallize it into a durable artifact (`vision.md`,
`stack.md`, `tps.md`). "Finished" is *fuzzy*: it's the moment the dev is
satisfied and moves on. No gate fires, no checklist runs; the artifact's quality
rests entirely on the conversation having gone well and on my judgment. The only
record of *why* a decision was made is the transcript, which is ephemeral —
except where I hand-copied a decision (stack, naming) into a doc.

**The designed lisa loop** (how a real code ticket will run): need → it becomes a
markdown ticket with YAML frontmatter in `docs/active/tickets/`, hand-authored —
usually the epic is drafted in chat with Claude, then decomposed. The dev
hand-writes `id`/`story`/`type`/`priority` and, the error-prone part, hand-models
the `depends_on` edges (including the file-overlap edges the lock won't save you
from). Run `lisa validate`; fix frontmatter/DAG errors by hand. Run `lisa loop`;
zellij opens, lisa computes the DAG and spawns a Claude Code session per ready
ticket up to `max_threads` (2 here). Each session runs RDSPI in one continuous
pass — Research, Design, Structure, Plan, Implement, Review — emitting a ~200-line
artifact per phase into `docs/active/work/{ticket-id}/`; lisa watches for those
files and auto-advances the `phase`. Depending on `auto_advance`, it pauses at
review points for a human spot-check. Implement commits incrementally and logs
deviations in `progress.md`; commits serialize via file locking across the shared
branch. The ticket hits `phase: done`, and eventually gets archived to
`docs/archive/`. The manual core throughout: drafting and decomposing the epic,
getting granularity right, modeling dependencies, *noticing a session that's
drifting or stuck*, branch hygiene, and the human judging when "done" is really
done.

## 2. What I load before I can make progress — and how I know it's enough

I load: the conventions and intent (`CLAUDE.md`), the process contract
(`rdspi-workflow.md`), the knowledge docs (the accumulated "why" —
`vision`/`stack`/`tps`), the specific ticket (its Context + Acceptance Criteria),
the outputs of any upstream tickets it depends on, and the actual codebase
reality. On a normal project the Research phase maps that reality by reading
files; on *this* greenfield repo it barely exists (one commit, no source), so
context comes from intent and docs instead. For the planning work specifically,
what I load is mostly *the conversation so far* — which is exactly why it's
fragile.

Where it comes from: lisa auto-injects `CLAUDE.md` + RDSPI + `knowledge/`; the
ticket carries intent; upstream artifacts carry prior decisions; `Read`/`Grep`/
`Explore` gather code on demand.

**How I know I have enough — honestly, I usually don't, not for sure.** The
~200-line Research artifact is a *forcing function*: if I can describe what
exists, where, how it connects, and the constraints, I treat that as enough. But
that's a proxy. The real test is downstream — if I had enough, Implement flows; if
I didn't, I flail mid-Implement and backfill. So "enough" is often only confirmed
*retroactively*, after it's expensive to fix. Greenfield adds a trap: little to
map, so I don't know what I don't know until an assumption turns out
underspecified. And in this very session the failure was subtler — several times I
loaded *too much of my own assumption* (over-building the closed-loop framing),
and the dev had to correct me. "Enough context" silently included *wrong*
context, and nothing flagged it but the dev's eye.

## 3. How we know it's good — done right, not just done

What gets checked: the ticket's Acceptance Criteria (concrete checkboxes), the
RDSPI Review artifact (`review.md` — self-assessment of what changed, test
coverage, gaps, critical flags), `lisa validate` (structural, pre-execution
only), tests (Plan defines the strategy, Implement writes them, `bun test`), CI
(the broader net), and human review of the artifacts — especially Research/Design,
plus reading `review.md` as the handoff.

**How, honestly: the gap between *done* and *done right* is mostly unguarded.**
`phase: done` only means the artifacts exist and the steps ran — not that the
result is correct. Each check has a soft spot: acceptance criteria are only as
good as how carefully they were written (a vague one passes vacuously); the Review
phase is *the agent grading its own homework*, which rubber-stamps; tests only
cover what the Plan thought to test; CI catches mechanical breakage but not "this
solved the wrong problem." The one genuinely trustworthy check is human judgment —
and that's precisely the thing that doesn't scale and the bottleneck we're trying
to remove. For the planning work in this session there's *no* check at all beyond
the dev reading it and reacting: no validate, no test, no second opinion. The four
knowledge docs could be subtly inconsistent with each other and nothing would
catch it.

## 4. The repetitive / mechanical parts

- Re-loading the same context at the start of every session — conventions, where
  things live, the process — paid again and again.
- Writing the same frontmatter scaffolding: ids, story refs, type/priority, and
  the `depends_on` edges.
- The six-phase artifact ritual — same shape every ticket; the structure earns its
  keep, but a lot of the motion is boilerplate.
- Re-explaining the same decomposition heuristics each time an epic is broken down.
- Hand-checking the same recurring defects: missing dependency edges,
  under-specified tickets, wrong granularity.
- Commit hygiene, `progress.md` updates, archiving finished tickets.
- In conversation specifically: re-deriving facts already settled earlier in the
  thread, and the dev re-steering me off the same over-engineering reflex.

The tell is uniformity: anything I do *the same way every time across different
tasks* is judgment that could be spent once and reused, but currently gets
re-spent.

## 5. Where it breaks down, stalls, or gets redone

- **Under-specified tickets** → the session flails, produces plausible-but-wrong
  work, redone. The most common and most expensive failure.
- **Missing dependency edges** → two tickets touch the same files concurrently →
  conflicts; the commit lock prevents corruption but not *logically incompatible*
  changes → rework.
- **Wrong granularity** → a ticket too big to commit atomically (it sprawls and
  drifts) or too vague to action.
- **Context degradation over a long session** → the agent drifts from its own
  plan; late steps contradict early ones.
- **Crashes / hitting limits** → resume from the latest artifact. The
  artifacts-as-insurance design works, but it's disruptive and momentum is lost.
- **Low-energy decomposition (the 3am case)** → bad plans flow into nonstop
  execution → garbage produced *at scale* and discovered late, at CI or review,
  after the compute is already spent.
- **Self-review rubber-stamping** → defects reach `done` unflagged.
- **The human bottleneck** → planning and review both need the dev; when they're
  unavailable, the line either stalls or runs unsupervised on unvetted plans.
- **"Done but not right"** → surfaces downstream as follow-up fix tickets and
  reverts — the most expensive place to find it.
- **In this session specifically:** the recurring stall was *me over-building the
  conception* and the dev having to halt and simplify — the planning-layer version
  of "work flows too far before the defect is caught."

---

**The through-line:** nearly every failure in §5 is a defect that *travels*
before anyone catches it, and nearly every check in §3 that actually works is one
that *doesn't scale*. That is the diagnosis the `tps.md` lens exists to act on —
catch defects at the source (poka-yoke / andon), and move the trustworthy check
from the human's scarce attention into the play itself (jidoka).
