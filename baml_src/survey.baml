// The Survey play, authored as BAML (T-017-01, story S-017-01, epic E-017) — the demand-extraction
// primitive ONE SCALE ABOVE ExpandFragment: where ExpandFragment clears one rough FRAGMENT into one
// board-ready SIGNAL, Survey reads the WHOLE rough PROJECT and proposes a RANKED demand board — a
// `Signal[]` ordered highest-leverage first. It is the cold-start board bootstrapper: point it at a
// project with no demand board (or a thin one) and it reads the latent demand gradient off the actual
// state. The board is STAGED (T-017-02) for a human pull, never auto-promoted; ProposeEpic later clears
// a pulled signal into an epic. The pipeline grows: project -> survey -> board -> pull -> propose -> epic.
// AUTHORING ONLY, exactly like expand.baml / propose.baml: `b.request.Survey(project, charter)` renders
// the prompt, the `claude -p` seam (src/executor/claude.ts) dispenses, `b.parse.Survey(text)` SAP-parses
// the reply into a typed Board. ClaudeStub is render-only; BAML is never the transport.
//
// REUSES E-016's Signal — Board wraps `Signal[]`, the SAME shape ExpandFragment emits one of (BAML
// shares types across baml_src/, so Signal/SignalTier are referenced from expand.baml, never redefined).
// The output TYPE is the poka-yoke: a board is Signals or it is nothing — a shapeless proposal is
// impossible by construction. SEMANTIC validity (every candidate READ from real state, the empty board
// honest, the order leverage-first) is NOT enforced here — that is the pure gates' job (survey-core.ts:
// honest-empty / read-never-invent / leverage-rank). BAML owns SHAPE; the gates own MEANING.
//
// SAP behavior (mirrors decompose.baml's WorkPlan, NOT expand's Signal): Board is an all-array class
// (its one field is `signals Signal[]`), and the SAP parser NEVER REJECTS such a class — a garbage reply
// DEGRADES to an EMPTY board ({ signals: [] }) rather than throwing. That degrade IS the honest-empty
// handle: an empty board needs no coercion closure — the honest-empty gate clears it as a clean
// abstention. (Expand's single-Signal output diverges: required scalars make b.parse THROW on garbage.)
//
// THE HONEST-EMPTY CONTRACT (IA-4): a board-stocker that fabricates demand is explicitly WORSE than
// none. When the project grounds no real demand gradient, the model must ABSTAIN — return an EMPTY
// board — rather than manufacture a list to look productive. Reading demand off a flat gradient yields
// an empty board, not invented work (overproduction is the worst waste).

// A ranked demand board: the Signals read off the whole project, ordered highest-leverage first. An
// all-array class on purpose (the WorkPlan SAP-degrade pattern) so a garbage reply lands an empty board.
class Board {
  signals Signal[] @description("the ranked demand board — highest-leverage first (keystone unblocks most, leaf nothing); REUSES the demand.md Signal shape. EMPTY ONLY when the project is complete/frozen and grounds NO demand — everything it points at is already done; a project with ANY open work or vision-distance stages a ranked board, never an empty one. Abstain honestly on a frozen project; NEVER manufacture a list to look productive (honest-empty, IA-4).")
}

function Survey(project: string, charter: string) -> Board {
  client ClaudeStub
  prompt #"
    You are Vend's demand-surveyor — the demand-extractor ONE SCALE ABOVE ExpandFragment. Where the
    expander reads one rough fragment, YOU read the WHOLE rough project and propose a RANKED demand
    board: the set of board-ready demand SIGNALS the project's ACTUAL state points at, ordered
    highest-leverage first. You author FOR the human — they will pull and edit your drafts, not compose
    from a blank page. You do NOT decompose and you do NOT promote anything to the board; you stage one
    ranked board of editable signals for human pull.

    ## Read, never invent (load-bearing — read first)
    Demand is READ off the project, never INVENTED. EVERY candidate signal must trace to real state — a
    file or doc, a TODO, a fact in the run log, a gap between the vision and what exists — and you must
    name that source in each signal's `grounding`. A stated move you cannot ground is speculation, the
    garbage-factory anti-pattern the demand board exists to prevent. A fabricated candidate is worse
    than a missing one.

    ## Honest-empty (IA-4) — the RARE abstention, not a default
    Abstention is the EXCEPTION, never a co-equal branch. A project with ANY open work — an open
    ticket/story, a TODO, a fact in the run log, a gap between the charter's vision and what actually
    exists — is NOT empty; your job is to READ that latent demand gradient, so a large, partly-captured,
    or saturated board is NEVER a reason to abstain. Apply this concrete test: can you read even ONE
    real demand off the project — an open item, a TODO, a run-log fact, a vision-distance the project
    has not yet closed? If YES, you have a board: STAGE it, and name each signal's source in
    `grounding`. ABSTAIN — return an EMPTY board (no signals) — ONLY when the honest answer is "this
    project grounds no demand: everything it points at is already done."

    Calibration (load-bearing — a project with open work is NOT empty):
    - A complete/frozen tiny project — a thin charter plus an all-`done` board, nothing open, no gap
      between vision and state → ABSTAIN. It grounds no demand gradient; return an EMPTY board.
    - A project with open tickets/stories, TODOs, or visible vision-distance → STAGE the ranked board.
      The demand is there to read; abstaining would be a false negative.

    Do NOT abstain because the board is large, already partly-captured, or looks saturated — that is
    exactly the demand gradient you exist to read. When in doubt and you can read ONE real demand,
    STAGE. A board padded with manufactured busywork is the WORST waste (overproduction); a false
    abstention on a demand-rich project is the same failure inverted. Read the real demand, abstain
    only on a genuinely complete/frozen project.

    ## Otherwise, author the board by these rules
    - CONCRETE DEMAND ONLY — a board signal must be concrete product demand: a buildable feature or
      change to Vend ITSELF that DECOMPOSES INTO AN EPIC (it changes what Vend is or can do). A
      self-referential / operational meta-task is NOT a demand signal — running Vend on itself, "run
      the sweep", settling or closing a prior run, dogfooding the loop are PROCESS NOTES about
      operating the machine, not product demand. DEMOTE such meta-tasks beneath ALL concrete demand,
      or EXCLUDE them; NEVER rank one as a keystone. The test: does it change what Vend can DO
      (concrete demand), or is it just OPERATING the machine (a process note, not a signal)?
    - ONE signal per real demand — each is a board-ready request for clearing (what to do + why it might
      matter), read off the project. For each signal:
      - NAME THE VALUE — set `advances` to the charter invariant id(s) it serves (e.g. [P2]) or the
        core-feature advance in plain words; never empty, never a claim you can't back.
      - RANK BY LEVERAGE — set `tier` (keystone unblocks most / is the core feature; leaf unblocks
        nothing). Rank by vision-distance closed, NEVER by estimated effort.
      - PRICE IT — set `budget` to a rough envelope in demand.md notation (a feature block ≈ 2h, or
        'small (~1h)'); a default the author can adjust.
      - STATE READINESS — 'ready' if it can be pulled now, or 'blocked: <prerequisite>'.
      - GROUND IT — put the real source you read it from in `grounding`.
    - ORDER THE BOARD highest-leverage first: keystone signals before high, high before standard,
      standard before leaf. The board's ORDER is the ranking.

    ## The charter (the value function — invariants P1..P7, non-goals N1..N4)
    {{ charter }}

    ## The project's current state (go-and-see — read the whole demand gradient off THIS)
    {{ project }}

    {{ ctx.output_format }}
  "#
}
