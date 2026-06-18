# Process: steer and drive a project (the meta-play)

**Status:** codified by hand — and the source material *is this session*. **The
dream:** walk up to Vend and ask for **two hours of project steering**, and get
*this* — the interaction we have been having all along. **Eventual play:**
`SteerProject(state, intent, budget)`, the ~2-hour macro envelope from
`../demand.md`.

> This codifies **the interaction — how we steer** — **not** the outputs of the
> things steering calls for. The docs, epics, and tickets this session produced
> are *byproducts*; the process is the judgment-driving itself. When you read this
> later, do not mistake the artifacts for the work. The work is the driving.

---

## Where it sits — the top of the clearing stack

`vision.md` promises: *Vend turns you from the thing in the loop into the thing
that designs the loop.* This play **is** designing the loop, made buyable. It is
the broadest kind of clearing — it clears **direction itself** (ambiguity → decided,
captured, ranked forward motion), and from there it *commissions* the narrower
plays:

```
SteerProject            ← clears direction (this doc)        ~2h envelope
  ├─ DecomposeEpic       ← clears one epic → tickets         (playbook-decompose-epic.md)
  └─ AddGate, …          ← clears one check → gate           (ci-structural-gate.md)
```

## The nature of the process

It is **adaptive, not a fixed sequence.** The next move is chosen from where the
project *is* and what the human just surfaced — never from a script. It alternates
**diverge** (explore framing, find the real question) and **converge** (decide,
capture, queue). It is grounded in current state (read before assuming) and it
**captures durably as it goes**, so nothing of value rots in the transcript.

And it runs **jidoka at the steering layer**: it drives autonomously, but it
**stops the line at a genuine fork** and surfaces *that* — not a guess — to the
human. The forks are the andon pulls. "Two hours of steering" means the agent does
the driving and the human answers only the handful of real decisions it raises.

## The recurring moves (the repertoire, ordered adaptively)

1. **Orient on current state** — read the repo, the docs, the loop status, what's
   already decided. *Go and see* before deciding (this session opened by reading
   `lisa setup-guide` and `mc-design-eval` before proposing anything).
2. **Reflect understanding back** — restate the human's intent in sharpened form so
   drift is caught *before* acting ("let me play it back…": the TPS lens, the
   clearing-house frame).
3. **Surface the real forks** — present the genuinely consequential decisions,
   recommendation first; ask on real forks (stack / playbook format / surface),
   decide-and-proceed on defaults. Never survey what you can just choose.
4. **Integrate steering** — fold in corrections, new constraints, feature requests,
   and *sharpen* (the BAML pivot; "it's simpler than that"; the 2-hour budget).
5. **Resist over-building** — when the conception elaborates past what the slice
   needs, that is the well-formed-wrong reflex firing. **Stop the line; ship the
   smaller real thing.** (The human caught this repeatedly; the play must catch it
   on itself.)
6. **Capture durably as you go** — crystallize decisions into the charter / demand
   board / knowledge docs, by stable reference not restatement, so alignment is
   *computed later, not stored stale*.
7. **Verify load-bearing assumptions on the machine** — not from memory (the
   BAML-on-Bun smoke test; the live Dagger check). A stack bet gets proven before
   it's committed.
8. **Queue the next pull** — surface and rank demand by leverage, stage what's
   ready (E-003), keep momentum without overproducing inventory.
9. **Log the decision** — append the `(state, options, choice, human verdict,
   provenance)` record so steering becomes *learnable*, not merely *done* (see
   `steering-data-model.md`). The human's correction is the **dense signal** and is
   unrecoverable once the turn passes — keep what you cannot reconstruct.
10. **Stop a block cleanly** — end with a tight, honest offer of next moves; do not
   sprawl.

## The process's own andon (when it stops the line)

- **Over-building** — elaborating past the current slice → stop, shrink.
- **An un-captured decision** — a real call living only in chat → capture it before
  moving on, or it rots; and **log it** (`steering-data-model.md`), since the
  human's correction is the dense, unrecoverable training signal.
- **An unverified load-bearing assumption** — a stack/tooling bet taken on memory →
  verify on the machine first.
- **Drift from the charter** — work that advances no named invariant → refuse it.
- **A genuine fork** — a consequential decision that is the human's to make →
  **escalate it, don't guess.** This is the andon that defines the 2 hours: the
  agent drives to the forks and hands them up.

## What good steering produces

**Forward motion with the judgment encoded** — *not* a single deliverable:

- decisions made (or the real forks cleanly surfaced for the human),
- framing sharpened and **durably captured** (charter / knowledge / demand),
- the demand board **stocked and ranked**, the next pull teed up,
- and **nothing over-built**.

A two-hour run is "good" if the project is meaningfully *further* and the human had
to decide only the things genuinely theirs to decide.

## Why this is the hardest — and most valuable — play to systematize

It is the highest play in the stack: it decides *which lower plays to run, on what,
and in what order*. It looks unsystematizable because its *order* is adaptive — but
its **moves recur** (above), its **state is durable and readable** (the charter,
demand board, knowledge docs, lisa status are exactly what it reads and writes),
and its **forks are explicit andon** (escalation points, not hidden guesses). Those
three facts are what make a ~2-hour `SteerProject` play possible at all.

```
SteerProject(state, intent, budget)
  -> { decisions | surfaced-forks, durable-artifacts, ranked-demand, next-pull }
   gated by: advances-the-charter · captured-durably · no-over-build
             · escalates-the-real-forks (the andon)
```

When this play runs, the human has finally become *the thing that designs the
loop* — answering forks and reviewing captures, while the steering itself is
dispensed. That is the whole vision, bought two hours at a time.
