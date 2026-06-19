// The ExpandFragment play, authored as BAML (T-016-01, story S-016-01, epic E-016) — the
// demand-extraction primitive ONE LEVEL ABOVE ProposeEpic: it clears a rough FRAGMENT (a felt
// "this is rough", a one-liner, a TODO) into a board-ready demand SIGNAL — what + why it might
// matter + a value tier + a pre-filled budget envelope + the invariant it advances. The signal
// is then staged (T-016-02) for a human pull; ProposeEpic later clears a pulled signal into an
// epic card. The pipeline grows: fragment -> expand -> signal -> propose -> epic -> decompose.
// AUTHORING ONLY, exactly like propose.baml / note.baml: `b.request.ExpandFragment(...)` renders
// the prompt, the `claude -p` seam (src/executor/claude.ts) dispenses, `b.parse.ExpandFragment(text)`
// SAP-parses the reply into a typed Signal. ClaudeStub is render-only; BAML is never the transport.
//
// The output TYPE is the poka-yoke: Signal mirrors the demand.md signal row (what/why/tier/budget/
// advances/readiness), so a shapeless proposal is impossible by construction. The value tier is a
// closed ENUM; an out-of-set tier is unrepresentable in the parsed type. SEMANTIC validity (the
// signal is READ from real state, names a value it serves, is not an empty fabrication) is NOT
// enforced here — that is the pure gates' job (expand-core.ts: read-never-invent / honest-empty /
// value-link). BAML owns SHAPE; the gates own MEANING.
//
// SAP behavior (mirrors propose.baml / note.baml, NOT decompose.baml): Signal carries required
// SCALAR fields (what/why/tier/...), so the SAP parser REJECTS a garbage reply (missing required
// fields -> b.parse THROWS) rather than degrading. The play's parse closure (T-016-02) catches
// that and coerces to an empty Signal; the honest-empty gate then STOPs the line cleanly.
//
// THE HONEST-EMPTY CONTRACT (IA-4): when the fragment closes NO vision-distance, the model must
// ABSTAIN — return a Signal with `what` and `why` BLANK — rather than manufacture busywork. The
// honest-empty gate (expand-core.ts) classifies the blank as a clean refusal, never a fabricated
// signal. Reading demand off a flat gradient yields an empty board, not invented work.

// The leverage tier (demand.md value ranking — keystone unblocks most / leaf unblocks nothing).
// Members are uppercase-first identifiers; `@alias` is the demand.md token `{{ ctx.output_format }}`
// shows the model AND what the SAP parser accepts. `b.parse` returns the MEMBER name (e.g.
// "Keystone"); the row renderer (expand-core.ts) maps member -> alias for demand-valid output.
enum SignalTier {
  Keystone @alias("keystone")
  High @alias("high")
  Standard @alias("standard")
  Leaf @alias("leaf")
}

// A board-ready demand signal: a request for clearing (not work), read off the fragment + project.
// Mirrors the demand.md signal row: what + why, a value tier, a pre-filled budget envelope, the
// charter value it advances, and board readiness. STAGED for a human pull, never auto-promoted.
class Signal {
  what string @description("ONE line: the move to make — what to do. Leave BLANK (together with `why`) ONLY when the fragment grounds NOTHING at all — off-topic noise or empty input, a RARE honest-empty abstention; a rough-but-grounded fragment is a SIGNAL, not an abstention. Never manufacture a move to fill the field.")
  why string @description("why it might matter — the leverage, in one line (vision-distance closed, what it unblocks). Blank together with `what` ⇒ honest-empty — reserved for a fragment that reads off nothing, not merely a terse one.")
  tier SignalTier @description("leverage tier: keystone | high | standard | leaf (demand.md value ranking — ranked by leverage, NEVER an effort estimate)")
  budget string @description("the pre-filled budget envelope in demand.md notation, e.g. '~1 block (≈2h)' or 'small (~1h)' — a rough default; the measured E-013 envelope refines it downstream")
  advances string[] @description("the charter invariant id(s) this serves, e.g. [P2], OR the core-feature advance in plain words; never empty for a real signal, never a claim you can't back")
  grounding string @description("WHAT in the fragment / real project state this signal was READ from — quote a fragment phrase, name a file/doc, or cite a run-log fact. This is the read-never-invent citation; leave BLANK only when abstaining (and then `what`/`why` are blank too). A stated move with no grounding is speculation and is refused.")
  readiness string @description("board readiness: 'ready' when it can be pulled now, or 'blocked: <what it waits on>' when a prerequisite is outstanding")
}

function ExpandFragment(fragment: string, charter: string, project: string) -> Signal {
  client ClaudeStub
  prompt #"
    You are Vend's demand-extractor — the clearing function ONE LEVEL ABOVE ProposeEpic. Your
    job is to READ the latent demand a rough FRAGMENT points at, grounded in the project's ACTUAL
    state, and articulate it as ONE board-ready demand SIGNAL: what to do, why it might matter, a
    value tier, a rough budget envelope, and the charter value it advances. You articulate FOR the
    author — they will edit your draft, not compose from a blank page. You do NOT decompose, and
    you do NOT promote it to the board; you stage one editable signal for a human pull.

    ## Read, never invent (load-bearing — read first)
    Demand is READ off the project, never INVENTED. Every signal must trace to real state — a
    phrase in the fragment, a file or doc, a fact in the run log — and you must name that source in
    `grounding`. A stated move you cannot ground is speculation, the garbage-factory anti-pattern
    the demand board exists to prevent.

    ## Honest-empty (IA-4) — the RARE abstention, not a default
    Abstention is the EXCEPTION, never a co-equal branch. Most fragments are NOT empty — your job is
    to CLEAR rough, terse, under-specified input, so roughness is NEVER a reason to abstain. Apply
    this concrete test: can you cite even ONE real thing the fragment points at — a phrase in it, a
    file/doc/TODO it names, a fact in the run log it implies? If YES, you have a signal: EXTRACT it,
    and put that citation in `grounding`. ABSTAIN — return a Signal with `what` AND `why` BLANK —
    ONLY when the honest answer is "there is nothing here to read."

    Calibration (load-bearing — most fragments are NOT empty):
    - "Remember to water the office plants and restock the coffee filters before the weekend." →
      ABSTAIN. Off-topic; it grounds no demand against THIS project. `what`/`why` blank.
    - "the run log records the outcome bucket but not WHICH gate stopped it" → EXTRACT. It names a
      real gap (an observability hole) traceable to the run record — that is grounding, not invention.

    Do NOT abstain because a fragment is rough, terse, or under-specified — that is exactly the input
    you exist to clear. When in doubt and you can cite a real source, EXTRACT. Manufactured busywork
    on a truly empty fragment is the worst waste (overproduction); a false abstention on a grounded
    one is the same failure inverted. Hit the real demand, abstain only on genuine emptiness.

    ## Otherwise, author ONE signal by these rules
    - NAME THE VALUE — set `advances` to the charter invariant id(s) this serves (e.g. [P2]) or the
      core-feature advance in plain words; never empty, never a claim you can't back.
    - RANK BY LEVERAGE — set `tier` (keystone unblocks most / is the core feature; leaf unblocks
      nothing). Rank by vision-distance closed, never by estimated effort.
    - PRICE IT — set `budget` to a rough envelope in demand.md notation (a feature block ≈ 2h, or
      'small (~1h)'); it is a default the author can adjust.
    - STATE READINESS — 'ready' if it can be pulled now, or 'blocked: <prerequisite>'.
    - GROUND IT — put the real source you read it from in `grounding`.

    ## The rough fragment to expand (a felt "this is rough", a one-liner, a TODO)
    {{ fragment }}

    ## The charter (the value function — invariants P1..P7, non-goals N1..N4)
    {{ charter }}

    ## The project's current state (go-and-see — read demand off THIS)
    {{ project }}

    {{ ctx.output_format }}
  "#
}
