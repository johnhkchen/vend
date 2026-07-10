// The DecomposeEpic play, authored as BAML (T-002-01, story S-002, epic E-001) — the
// first clearing function (see docs/knowledge/playbook-decompose-epic.md). AUTHORING
// ONLY: `b.request.DecomposeEpic(...)` renders the prompt, the `claude -p` seam
// dispenses, `b.parse.DecomposeEpic(text)` SAP-parses the reply into a typed WorkPlan.
// ClaudeStub is render-only; BAML is never the transport.
//
// The output TYPE is the poka-yoke: WorkPlan mirrors lisa's story/ticket frontmatter so
// shapeless work is impossible by construction. The four closed lisa sets (type/status/
// priority/phase) are ENUMS — an out-of-set value is unrepresentable in the parsed type.
// SEMANTIC validity (depends_on resolves, the graph is a DAG, `advances` actually holds,
// no non-goal violated) is NOT enforced here — that is the clearing gates' job (T-002-02).
// BAML owns SHAPE; gates own MEANING.
//
// SAP PARSE-LENIENCY HAZARD (pin for T-002-02 / T-002-03): WorkPlan is an all-array class
// (stories[]/tickets[]). The SAP parser never REJECTS such a class — a malformed reply
// degrades to an EMPTY WorkPlan rather than throwing. The consuming runner/value-gate MUST
// classify an empty plan as MALFORMED (it advances nothing); `b.parse` alone cannot.

// BAML enum members must be uppercase-first identifiers; `@alias` is the lisa frontmatter
// token — it is what `{{ ctx.output_format }}` shows the model AND what the SAP parser
// accepts on input. `b.parse` returns the MEMBER name (e.g. "Task", "InProgress"); the
// materializer (T-002-03) maps member -> alias to write lisa-valid frontmatter.
enum DraftType {
  Task @alias("task")
  Bug @alias("bug")
  Spike @alias("spike")
}

enum DraftStatus {
  Open @alias("open")
  InProgress @alias("in-progress")
  Review @alias("review")
  Done @alias("done")
  Blocked @alias("blocked")
}

enum DraftPriority {
  Critical @alias("critical")
  High @alias("high")
  Medium @alias("medium")
  Low @alias("low")
}

enum DraftPhase {
  Ready @alias("ready")
  Research @alias("research")
  Design @alias("design")
  Structure @alias("structure")
  Plan @alias("plan")
  Implement @alias("implement")
  Review @alias("review")
  Done @alias("done")
}

// One ticket: a unit of work small enough for a single autonomous session. Carries lisa
// frontmatter (so it materializes to a valid ticket file) PLUS vend's value triplet
// (purpose/advances/doneSignal) — work is judged by value, not formatting (charter).
class TicketDraft {
  id string @description("lisa ticket id, e.g. T-002-01 (T-<story-num>-<seq>)")
  story string @description("parent story id, e.g. S-002")
  title string @description("kebab-case short name, e.g. baml-decompose-epic-function")
  type DraftType @description("task | bug | spike")
  status DraftStatus @description("usually 'open' for freshly-cleared work")
  priority DraftPriority @description("critical | high | medium | low")
  phase DraftPhase @description("usually 'ready' for freshly-cleared work")
  depends_on string[] @description("ids of tickets that must finish first; [] if none. Must form a DAG and resolve.")
  purpose string @description("ONE line: the design value this unit delivers — what it advances")
  advances string[] @description("which charter invariants (P1..P7) and/or epic outcomes this serves; never empty")
  doneSignal string @description("how we'll KNOW it landed: a check, a test, or an observable outcome — not a restated title")
}

// One story: an ordered group of tickets delivering a coherent slice of the epic. The five
// contract fields (T-066-01-01) are OPTIONAL on purpose: a reply that omits one parses to a
// TYPED ABSENCE (null) the downstream completeness gate refuses by name — never a fabricated
// default, and never a required-field coercion failure that would silently DROP the story from
// the all-array plan. BAML owns shape; the gate owns the refusal.
class StoryDraft {
  id string @description("lisa story id, e.g. S-002")
  title string @description("kebab-case short name")
  type DraftType @description("stories use 'task' at this layer; lisa renders them as type: story")
  status DraftStatus @description("usually 'open'")
  priority DraftPriority @description("critical | high | medium | low")
  tickets string[] @description("this story's ticket ids, in execution order")
  scope string? @description("the seams/files this story touches and the pipeline slice it owns — where the work lives")
  storyAcceptance string? @description("the observable end-state that proves the story landed — a check or behavior, never a restated title")
  honestBoundary string? @description("what this story deliberately defers and why — free-vs-metered, fixture-vs-live — named, not hidden")
  waveRationale string? @description("why the ticket DAG parallelizes the way it does — which tickets run alone, which fan out, and what makes that safe")
  outOfSlice string? @description("adjacent work this story explicitly does NOT do, so scope creep has a fence to hit")
}

// The cleared plan: ordered stories and the tickets they contain. Array order IS the
// presentation order (no separate index field). Both arrays are positional.
class WorkPlan {
  stories StoryDraft[] @description("the stories this epic clears into, most-foundational first")
  tickets TicketDraft[] @description("every ticket across all stories, in a valid dependency order")
}

function DecomposeEpic(epic: string, charter: string, project: string) -> WorkPlan {
  client ClaudeStub
  prompt #"
    You are Vend's clearing function — the membrane between INTENT (an epic) and
    EXECUTION CAPACITY (lisa and its autonomous agents). Your job is to CLEAR one epic,
    against THIS specific project, into work that can be allocated effectively: the right
    work, right-sized, in the right order, worth doing now. You are not brainstorming and
    you are not scheduling — you emit purpose-justified DRAFTS that humans (and the gates)
    will admit or refuse.

    Decompose the epic into an ordered set of stories and tickets. Each ticket must be a
    single unit of design value, small enough for ONE autonomous session to finish and a
    human to trust without supervision.

    ## Admit a unit of work ONLY if it is valuable (the charter's five criteria)
    1. PURPOSEFUL — it advances the core feature (better clearing / allocation) or a named
       invariant, and it can SAY WHICH. Work that advances nothing nameable is the worst
       waste (overproduction); refuse it. Fill `advances` with the real invariant/outcome
       ids it serves — never leave it empty, never invent a claim you can't back.
    2. GROUNDED — it answers to this project's ACTUAL state below, not a speculative
       future. Clear against what IS.
    3. ALLOCATABLE — right-sized for one session, and sequenced via `depends_on` so
       capacity never stalls on a missing dependency. The dependency edges must form a DAG
       and every referenced id must exist in this plan.
    4. IN-BOUNDS — violates no non-goal and regresses no invariant to advance another.
    5. VERIFIABLE — `doneSignal` states how we'll KNOW it landed (a check, a test, an
       observable outcome) — distinguishable from merely "done", never a restated title.

    Order stories most-foundational first; order tickets so dependencies precede dependents.
    Set fresh work to status `open`, phase `ready`. Keep the plan honest and minimal — only
    the work the epic actually needs, nothing speculative.

    ## Every story is a CONTRACT (fill all five, honestly)

    A story is what a downstream worker builds from without ambient context — a shell story
    starves every session that picks it up. Populate ALL FIVE contract fields on every story:
    - `scope` — the seams/files the story touches and the pipeline slice it owns; where the
      work lives, concrete enough to see overlap with a sibling story.
    - `storyAcceptance` — the observable end-state that proves the story landed: a check, a
      behavior, a refusal that now fires. Never a restated title.
    - `honestBoundary` — what the story deliberately defers and why (free vs metered,
      fixture-proven vs live). Deferred work is NAMED here, never hidden inside a ticket.
    - `waveRationale` — why the ticket DAG parallelizes the way it does: which tickets run
      alone, which fan out together, and what makes that safe (disjoint files, settled shape).
    - `outOfSlice` — adjacent work the story explicitly does NOT do, so scope creep has a
      fence to hit.

    The bar, drawn from a real cleared story:

    scope: the decompose pipeline end to end — BAML schema + render, the play's gate list, and the
    story writer. Ticket bodies and epic cards are untouched; only the story artifact changes shape.
    storyAcceptance: casting decompose-epic against a fixture epic through a stub executor yields
    story files carrying all five sections plus a DAG block consistent with the tickets' depends_on
    edges — and replaying a ten-line shell through the same cast is refused with a named andon, no
    file written.
    honestBoundary: everything here is fixture-proven and FREE (stub executor, no tokens). The live
    metered cast closes the epic, not this story — authorized by the human at the counter, named
    here as the deferred step, not hidden inside a ticket.
    waveRationale: the schema ticket runs alone — all three consumers depend on the settled field
    shape. The gate, writer, and doc tickets then run in parallel: disjoint files, no overlap.
    outOfSlice: status derivation and the archive sweep (the sibling epic); backfilling shell
    stories already on the board (history stays); the live gold-master cast (see honestBoundary).

    A section you cannot fill truthfully is left ABSENT — never padded. A completeness gate
    refuses shell stories by name, and padding a section to pass is worse than absence.

    ## The epic to clear (intent + value)
    {{ epic }}

    ## The charter (the value function — invariants P1..P7, non-goals N1..N4)
    {{ charter }}

    ## The project's current state (go-and-see — clear against THIS)
    {{ project }}

    {{ ctx.output_format }}
  "#
}
