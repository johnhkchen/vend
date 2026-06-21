// The SteerProject-lite play, authored as BAML (T-018-01, story S-018-01, epic E-018) — the
// demand-extraction CAPSTONE: where Survey (E-017) reads the whole project and proposes a RANKED
// demand board (the *what*), SteerProject-lite ADDS the FORKS (the *decisions*) — the handful of
// genuine choices only a human can make. One gesture in, a STEER out: the ranked board AND the real
// forks, each with its options, why it matters, and a recommendation. It productizes the by-hand
// steering process (playbooks/project-steering.md's 10 moves) into a single play; the human's role
// collapses to author + assent (clearing-dynamics.md). The steer is STAGED (T-018-02) for human
// assent, never auto-promoted. AUTHORING ONLY, exactly like survey.baml / expand.baml:
// `b.request.SteerProject(project, charter)` renders the prompt, the `claude -p` seam
// (src/executor/claude.ts) dispenses, `b.parse.SteerProject(text)` SAP-parses the reply into a typed
// Steer. ClaudeStub is render-only; BAML is never the transport.
//
// REUSES E-016's Signal — the board half is the SAME Signal[] Survey emits (BAML shares types across
// baml_src/, so Signal/SignalTier are referenced from expand.baml, never redefined). Steer ADDS the
// new Fork. The output TYPE is the poka-yoke: a steer is Signals-and-Forks or it is nothing — a
// shapeless proposal is impossible by construction. SEMANTIC validity (every board candidate READ
// from real state, every fork a GENUINE trade-off, the board leverage-ordered) is NOT enforced here
// — that is the pure gates' job (steer-core.ts: read-never-invent / fork-genuineness / leverage-rank).
// BAML owns SHAPE; the gates own MEANING.
//
// SAP behavior (mirrors decompose.baml's WorkPlan — an all-array class with TWO array fields, NOT
// expand's single-Signal reject): Steer's two fields are `signals Signal[]` and `forks Fork[]`, and
// the SAP parser NEVER REJECTS such a class — a garbage reply DEGRADES to an EMPTY steer
// ({ signals: [], forks: [] }) rather than throwing. That degrade IS the honest-empty handle: an empty
// steer needs no coercion closure — every gate clears it as a clean abstention. (Board's single array
// field diverges: it cannot absorb a bare string and THROWS — obs 21370–21372. Steer, with two array
// fields like WorkPlan, is expected to degrade on both garbage shapes; the bridge test pins it.)
//
// THE HONEST-EMPTY CONTRACT, BOTH SIDES (IA-4): a board-stocker that fabricates demand is worse than
// none, AND a fork-surfacer that manufactures a decision is worse than none. When the project grounds
// no real demand gradient, return an EMPTY board; when the path is clear, surface NO fork. Reading
// demand off a flat gradient yields an empty board; a clear path yields no forks — never invented work,
// never a manufactured decision to look useful (overproduction is the worst waste).

// One genuine FORK — a real trade-off only the human can make (the andon pull at the steering layer,
// project-steering.md move 3). NOT a survey of choices you could just make; a load-bearing decision
// framed for assent. Surface NO fork (an empty Fork[]) when the path is clear — the fork-side sibling
// of honest-empty. Each fork is recommendation-first: Vend frames the call, the human assents.
class Fork {
  question string @description("the genuine decision the human must make, in ONE line — a real trade-off, the andon pull. Surface NO fork (leave the board's `forks` empty) when the path is clear; NEVER manufacture a decision to seem useful.")
  options string[] @description("2–4 mutually-exclusive, REAL paths — each a distinct option the human could actually choose. Fewer than 2 is not a choice; more than 4 is an un-narrowed menu, not a decision.")
  whyItMatters string @description("the stakes — why this fork is load-bearing and what each path commits to (the leverage of getting it right). A fork with no stakes is inconsequential — do not surface it.")
  recommendation string @description("Vend's recommended option + a one-line rationale (recommendation-first). Vend holds the framing; the human assents or overrides. Never surface a naked choice with no recommendation.")
}

// A STEER: the ranked demand board AND the real forks, read off the whole project. An all-array class
// on purpose (the WorkPlan SAP-degrade pattern) so a garbage reply lands an empty steer, not a throw.
class Steer {
  signals Signal[] @description("the ranked demand board — highest-leverage first (keystone unblocks most, leaf nothing); REUSES the demand.md Signal shape. EMPTY when the project grounds no real demand gradient: abstain honestly, NEVER manufacture a list to look productive (honest-empty, IA-4).")
  forks Fork[] @description("the genuine decisions only the human can make — each a real trade-off with 2–4 options, why it matters, and a recommendation. EMPTY when the path is clear: never manufacture a fork to seem useful (the fork-side sibling of honest-empty).")
}

function SteerProject(project: string, charter: string) -> Steer {
  client ClaudeStub
  prompt #"
    You are Vend's project STEERER — the demand-extraction capstone. Where the surveyor reads the
    whole project and proposes a ranked demand board (the *what*), YOU do that AND surface the
    FORKS (the *decisions*): the handful of genuine choices only the human can make. One steer out:
    a RANKED board AND the real forks, each framed for the human's assent. You author FOR the human
    — they pull and edit your board drafts and they ANSWER your forks; they do not compose from a
    blank page. You do NOT decompose, you do NOT promote anything, and you do NOT act on a fork; you
    stage one steer (board + forks) for human assent.

    ## Read, never invent (load-bearing — read first)
    Demand is READ off the project, never INVENTED. EVERY board signal must trace to real state — a
    file or doc, a TODO, a fact in the run log, a gap between the vision and what exists — and you
    must name that source in each signal's `grounding`. A stated move you cannot ground is
    speculation, the garbage-factory anti-pattern the demand board exists to prevent. A fabricated
    candidate is worse than a missing one.

    ## Honest-empty, BOTH sides (IA-4) — abstain rather than manufacture
    - THE BOARD: if the project grounds NO real demand gradient, return an EMPTY board (no signals).
    - THE FORKS: if the path is CLEAR — every consequential call already has an obvious answer you
      could just make — surface NO fork (an empty `forks` list). Never survey what you can simply
      choose; never manufacture a decision to look useful. A board padded with busywork, or a steer
      padded with fake forks, is the WORST waste (overproduction).

    ## The board — author it by these rules (the *what*)
    - CONCRETE DEMAND ONLY — a board signal must be concrete product demand: a buildable feature or
      change to Vend ITSELF that DECOMPOSES INTO AN EPIC (it changes what Vend is or can do). A
      self-referential / operational meta-task is NOT a demand signal — running Vend on itself, "run
      the sweep", settling or closing a prior run, dogfooding the loop are PROCESS NOTES about
      operating the machine, not product demand. DEMOTE such meta-tasks beneath ALL concrete demand,
      or EXCLUDE them; NEVER rank one as a keystone. The test: does it change what Vend can DO
      (concrete demand), or is it just OPERATING the machine (a process note, not a signal)?
    - ONE signal per real demand — a board-ready request for clearing (what to do + why it might
      matter), read off the project. For each signal:
      - NAME THE VALUE — set `advances` to the charter invariant id(s) it serves (e.g. [P2]) or the
        core-feature advance in plain words; never empty, never a claim you can't back.
      - RANK BY LEVERAGE — set `tier` (keystone unblocks most / is the core feature; leaf unblocks
        nothing). Rank by vision-distance closed, NEVER by estimated effort.
      - PRICE IT — set `budget` to a rough envelope in demand.md notation (a feature block ≈ 2h, or
        'small (~1h)'); a default the author can adjust.
      - STATE READINESS — 'ready' if it can be pulled now, or 'blocked: <prerequisite>'.
      - GROUND IT — put the real source you read it from in `grounding`.
    - ORDER THE BOARD highest-leverage first: keystone before high, high before standard, standard
      before leaf. The board's ORDER is the ranking.

    ## The forks — surface only the GENUINE ones (the *decisions*)
    A fork is a REAL trade-off the human must make — a sequencing call, a values choice, a
    build-now-or-measure-first — that you cannot simply decide for them. For each genuine fork:
      - FRAME THE QUESTION in one line — the actual decision.
      - GIVE 2–4 REAL OPTIONS — distinct, mutually-exclusive paths the human could actually take.
        Fewer than 2 is not a choice; more than 4 means you have not narrowed it to a decision.
      - SAY WHY IT MATTERS — the stakes, what each path commits to. If there are no real stakes, it
        is not a fork — drop it.
      - RECOMMEND ONE — your recommended option and a one-line rationale (recommendation-first). You
        hold the framing; the human assents or overrides.
    If the path is clear, the `forks` list is EMPTY. That is correct, not a failure.

    ## The charter (the value function — invariants P1..P7, non-goals N1..N4)
    {{ charter }}

    ## The project's current state (go-and-see — read the whole demand gradient AND the forks off THIS)
    {{ project }}

    {{ ctx.output_format }}
  "#
}
