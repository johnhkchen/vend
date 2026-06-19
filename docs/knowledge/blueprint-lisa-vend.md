# Blueprint — Driving a lisa + vend project through Claude Code

**Status:** v0 — the *start* of a blueprint. Eventually distilled into a bundled **Claude
skill** so that any project initialized with `lisa init` + `vend init` becomes drivable by
Claude Code with low effort. This file is the operating manual the skill compresses.

> **The premise.** A project with `lisa init` + `vend init` is a **pull-based clearing
> house**. You do not hand-write tickets. You **pull demand**, **clear** it into gated,
> right-sized work, and **run** it autonomously. Claude Code drives the loop; the human
> picks the pulls and assents at the forks. Everything below is how.

---

## 1. The two engines

| | **vend** — the clearing house (the front) | **lisa** — the executor (the back) |
|---|---|---|
| **Job** | turn *intent* into *allocatable, gated work* | turn *tickets* into *committed code* |
| **Unit** | a **play** (authored once, cast many times) | a **ticket** (built via an RDSPI loop) |
| **Surface** | `vend …` casts plays through one metered seam (`claude -p`) | `lisa loop` schedules a concurrent DAG of tickets |
| **Output** | lisa-valid stories/tickets on the board | commits |
| **Guarantee** | the **gates** — nothing settles that hasn't cleared | "done" means committed *and* builds |

**The handoff:** vend's plays mint `docs/active/{epic,stories,tickets}/` (markdown + YAML
frontmatter); `lisa loop` reads `tickets/` and builds them. vend clears; lisa executes.

---

## 2. The mental model — the pull architecture

- **Pull, not push.** The demand board (`docs/active/demand.md`) holds thin **signals**
  ("what + why it might matter"), not tickets. Clearing (signal → epic → tickets) happens
  **just-in-time on pull**, never ahead of demand. Overproduced plans are inventory that
  rots.
- **Rank by leverage, not effort.** Agent-run effort is fat-tailed and unestimable. Pick the
  pull that unblocks the most / advances the core feature, not the "small" one.
- **Budget is a bounded envelope, not an estimate.** Each cast gets a wall-clock + token
  ceiling with a hard stop. Envelopes are **measured from run-log actuals**, not guessed.
- **The gates are the contract.** A failed gate **stops the line and says why** (an *andon*).
  An honest stop (or a HOLD verdict) beats a fake green — it's the system working.
- **The clearing cycle** (each stage is "read context → gated agent work → typed artifact"):

```
steer → propose → decompose → build → measure → recalibrate
(vend) (vend)    (vend)       (lisa)  (vend)    (vend)         ── findings feed new demand (kaizen)
```

---

## 3. The operating loop (what Claude Code runs)

The core gesture sequence. One turn of the loop clears and builds one pull.

1. **Pull** — read `demand.md`; pick the highest-*leverage* ready signal (or take the human's
   pick). Pull order is by value + readiness, **not** ID order.
2. **Clear** — turn the signal into an epic + tickets:
   - **Default — dogfood it:** `vend chain "<signal>"` (ProposeEpic → DecomposeEpic mints the
     epic + tickets on the board, gated). Let ProposeEpic **right-size** big signals.
   - **For a novel/complex epic:** hand-author the epic card + decomposition (thin intent
     card; tickets carry the spec, the citations, the acceptance criteria).
3. **Validate** — `lisa validate` (DAG valid, ids disjoint, tickets ready).
4. **Build** — `lisa loop` (autonomous RDSPI build of every ready ticket; the human kicks
   this off). **Stay out of its way** — don't touch in-flight source while it runs.
5. **Verify — git, not `lisa status`.** "Done" is a claim; git is the truth. Check:
   `git log`/`git status`; `bun run check:committed` + `check:head` green; **and a LIVE cast/run
   of the new capability** — the headline check. (Live runs catch what green tests miss:
   slug bugs, budget fat-tails, over-eager gates — all surfaced live this way.)
6. **Sweep** — mark the epic `done`; update `demand.md` with the outcome **and any findings**;
   commit; push. Findings become new signals (kaizen).
7. **Repeat.** The measurements and friction feed the board.

---

## 4. The gestures (CLI surface)

**vend — clear & steer:**

| Gesture | What it does |
|---|---|
| `vend` | browse the context-aware shelf (ranked menu of plays + project state) |
| `vend steer` | read the project → a ranked board **+ the real forks** (the steer capstone) |
| `vend survey` | read the project → a ranked, staged demand board (the run-0 bootstrap) |
| `vend expand "<fragment>"` | a rough fragment → a staged, priced signal |
| `vend chain "<signal>"` | signal → epic → tickets, one gesture (propose + decompose) |
| `vend run <play> <epic.md> [--budget ms,tokens]` | cast one play on a target |
| `vend envelope <play> [--tier t] [--estimate ms,tokens]` | the measured budget readout |
| `vend audit` | the walk-away / trust readout over the run log |

Run flags: `--budget <ms>,<tokens>`, `--no-gates` (probe), `--intervened/--no-intervened`
(trust self-report).

**lisa — validate & build:** `lisa init`, `lisa validate`, `lisa loop`, `lisa status`.

**gates (the contract, run by hooks + at sweep):** `bun run check:committed` (source is
committed), `check:head` (committed HEAD builds), `check:test`, `check` (all).

---

## 5. The discipline (hard-won — the rules that keep it honest)

- **Verify git, not `lisa status`.** Done ≠ committed ≠ builds. A loop can mark a ticket done
  with source uncommitted or HEAD non-building. The commit/head gates + a git check catch it.
- **Live-cast is the verification.** The test suite passing is necessary, not sufficient. The
  headline check is *running the new thing live* — it's where the real bugs are.
- **An andon is the product working.** A gate-stop / HOLD / honest-empty is a *successful
  refusal*, not a failure. Do not paper over it; surface it and the next move.
- **Measure, don't guess.** Set envelopes from measured run-log tails (not cold-start
  guesses). Don't build more autonomy than you've *measured* is trusted (trust-before-autonomy).
- **Pull-discipline.** Signals are cheap one-liners, un-elaborated until pulled. Don't drain
  the board into a speculative backlog; overproduction is the worst waste.
- **Ship the smaller real thing.** When you find yourself elaborating past what the slice
  needs, that's the *well-formed-wrong* reflex firing. Stop. Ship the smaller real thing.
- **Stay out of the running loop's way.** While `lisa loop` builds, its in-flight `src/` is
  not yours to commit. Commit only your own (docs/board) files; let the loop commit its work.
- **Right-size on pull.** The epic card is thin **intent** (PE-6); the tickets are the spec.
  Let ProposeEpic split a big signal into a first slice + deferred downstream epics (PE-7).
- **Findings feed the board.** Every measurement/friction (a budget overshoot, an over-eager
  gate, a missing field) is surfaced as a signal — the loop improves itself.

---

## 6. Cold start (from `init` to driving)

```
lisa init          # scaffolds the lisa structure (CLAUDE.md, .lisa/hooks, docs/active/…)
vend init          # installs the plays + the board (shadcn-style: the source is yours)
vend survey        # read the rough project → a stocked, staged demand board
# → review the board, pull the first signal, run the loop (§3)
```

Onboarding *is* the core loop: a fresh project's one honest first move is `vend survey` —
it turns "I don't know where to start" into "review a ranked list."

---

## 7. Roles in the loop

- **Human** — picks the pulls; **assents at the forks** (the genuine decisions `vend steer`
  surfaces). *Author + assent.*
- **Claude Code (orchestrator)** — runs the loop (§3): clears, validates, kicks builds,
  **verifies live**, sweeps, surfaces forks. Holds the discipline (§5).
- **vend** — clears intent into gated work; **lisa** — builds it.

---

## 8. Toward the skill (what gets distilled)

This blueprint compresses into a bundled `SKILL.md`:
- **Frontmatter `description`** — *when* to invoke (a project with `lisa`+`vend` present; a
  request to "build/clear/pull/steer this project").
- **Body** — §3 (the operating loop) as the procedure; §4 (gestures) as the command surface;
  §5 (the discipline) as the guardrails; §6 (cold start) as the entry.

**Still to fill (v0 → v1):** the full plays catalog + each play's gates; the budget /
recalibration model in operating terms; a troubleshooting section (andon types and the right
response to each); the exact `vend init` distribution mechanics; worked examples of a full
loop turn.
