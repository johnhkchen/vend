// The ProposeEpic play, authored as BAML (T-009-01, story S-009-01, epic E-009) — the play
// ONE LEVEL ABOVE DecomposeEpic: it clears a thin demand signal into an epic CARD (the
// `E-0XX.md`), which DecomposeEpic then clears into stories/tickets. The membrane between the
// pull board (demand.md signals) and decompose (see docs/knowledge/playbooks/propose-epic.md).
// AUTHORING ONLY, exactly like decompose.baml / note.baml: `b.request.ProposeEpic(...)` renders
// the prompt, the `claude -p` seam (src/executor/claude.ts) dispenses, `b.parse.ProposeEpic(text)`
// SAP-parses the reply into a typed EpicCard. ClaudeStub is render-only; BAML is never the transport.
//
// The output TYPE is the poka-yoke: EpicCard mirrors the epic card (frontmatter + the card
// stat-block + the body), so a shapeless proposal is impossible by construction. The card's
// closed sets — color (WUBRG), the single-use/reusable axis (Sorcery|Permanent), and rarity —
// are ENUMS; an out-of-set value is unrepresentable in the parsed type. SEMANTIC validity
// (the minted id is disjoint from the live board, `advances` actually holds, no non-goal
// violated) is NOT enforced here — that is the PE gates' job (T-009-02). BAML owns SHAPE; the
// gates own MEANING.
//
// SAP behavior (mirrors note.baml, NOT decompose.baml): EpicCard carries required SCALAR fields
// (id/title/serves/…), so the SAP parser REJECTS a garbage reply (missing required fields ->
// b.parse THROWS) rather than degrading. A present-but-empty reply (fields present but blank)
// coerces to an empty-stringed card; the PE structural/value gates (T-009-02) classify that as
// a STOP. `b.parse` alone owns neither check.

// BAML enum members must be uppercase-first identifiers; `@alias` is the card-model token — it is
// what `{{ ctx.output_format }}` shows the model AND what the SAP parser accepts on input. `b.parse`
// returns the MEMBER name (e.g. "Blue", "Permanent", "Rare"); the card renderer (T-009-02) maps
// member -> alias to write card-valid frontmatter and the stat-block.

// The play's discipline — the color pie (card-model.md). Multi-color is normal (DecomposeEpic is
// Azorius WU), so EpicCard.color is an ARRAY of these.
enum CardColor {
  White @alias("white")
  Blue @alias("blue")
  Black @alias("black")
  Red @alias("red")
  Green @alias("green")
}

// The single-use vs. reusable axis (card-model.md). Used by BOTH the frontmatter `kind` and the
// stat-block `type` — they are the same axis rendered two ways (lowercase alias in frontmatter,
// title-case member name in the stat-block); one enum keeps them from drifting.
enum CardType {
  Sorcery @alias("sorcery")
  Permanent @alias("permanent")
}

// The value tier (card-model.md), leaf -> keystone.
enum CardRarity {
  Common @alias("common")
  Uncommon @alias("uncommon")
  Rare @alias("rare")
  Mythic @alias("mythic")
}

// The proposed epic card: a statement of INTENT and VALUE (not a decomposition). Mirrors the epic
// card on disk (docs/active/epic/E-0XX.md + TEMPLATE.md): frontmatter, the card stat-block, the body.
class EpicCard {
  // --- frontmatter ---
  id string @description("epic id, e.g. E-010 (E-<3-digit>). Must be DISJOINT from the live board — the structural gate (T-009-02) enforces this; here, mint the next free id.")
  title string @description("kebab-case short name, e.g. register-propose-epic")
  kind CardType @description("sorcery (single-use) | permanent (reusable). The same axis as the stat-block `type` — keep them in agreement.")
  advances string[] @description("charter invariant ids this epic moves forward, e.g. [P1]; never empty, never a claim you can't back")
  serves string @description("ONE line: the value this realizes for the product — not a restatement of the charter")
  // --- the card stat-block ---
  manaCost string @description("the warranted budget envelope in mana notation, e.g. {2}{U} (color symbols match `color`); ~one 2-hour feature block (PE-7)")
  color CardColor[] @description("the play's discipline(s): white|blue|black|red|green. Multi-color is normal (e.g. [white, blue] = Azorius). Never empty.")
  type CardType @description("sorcery (single-use) | permanent (reusable) — the stat-block type line; agrees with frontmatter `kind`")
  rarity CardRarity @description("value tier: common | uncommon | rare | mythic (leaf -> keystone)")
  // --- the body ---
  intent string @description("the bigger-picture play: what someone wants done and why it matters to the product NOW. Intent, NOT a ticket breakdown (PE-6).")
  value string @description("what capability/quality this realizes and how it advances the core feature or the named invariant(s)")
  doneLooksLike string @description("what is observably true when the epic is cleared and executed — at the EPIC level, an observable outcome, not a ticket checklist (PE-4)")
  context string @description("the project reality to ground against (code, KB docs, prior epics); boundaries, non-goals respected, prerequisites named AS prerequisites (PE-5), and what is out of scope")
}

function ProposeEpic(signal: string, charter: string, project: string) -> EpicCard {
  client ClaudeStub
  prompt #"
    You are Vend's epic-proposer — the clearing function ONE LEVEL ABOVE decompose. Your job
    is to clear a single thin DEMAND SIGNAL into an epic CARD: a statement of intent and value
    that DecomposeEpic can later clear into stories and tickets. You write the bigger-picture
    play; you do NOT decompose it.

    ## Pull-discipline (PE-1, load-bearing — read first)
    You fire on a PULLED signal, invoked deliberately. You are NOT an auto-drainer over the
    whole board: elaborating every signal is overproduction, the worst waste, and the demand
    board exists to prevent exactly that. One signal in, one warranted card out.

    ## Author the card by these rules (PE-1…PE-7)
    - PE-2 CITE THE SOURCE — the card traces to THIS demand signal and to the charter/KB value
      it serves (put that value in `serves` and `advances`).
    - PE-3 ASSIGN A CARD — set `manaCost` (the warranted budget envelope, in mana notation; its
      color symbols must match `color`), `color` (the discipline(s) on the color pie; multi-color
      is normal), `type`/`kind` (sorcery = single-use | permanent = reusable), and `advances`
      (the charter invariant id(s)).
    - PE-4 STATE VALUE + AN EPIC-LEVEL DONE-SIGNAL — `serves` is one line of value; `doneLooksLike`
      is observable AT THE EPIC LEVEL (a verifiable outcome), never a ticket checklist.
    - PE-5 RESPECT NON-GOALS; FLAG PREREQUISITES — violate no non-goal; name any prerequisite AS a
      prerequisite in `context`, not as hidden scope.
    - PE-6 INTENT, NOT DECOMPOSITION — stop at the bigger-picture play. The stories and tickets are
      DecomposeEpic's output, not yours.
    - PE-7 RIGHT-SIZE — one epic ≈ one ~2-hour feature block. If the signal is bigger than that,
      say so in `context` (it is several epics); do not inflate one card.
    - Mint an `id` for a fresh epic (the next free E-0XX); keep it disjoint from the board.

    ## The demand signal to clear (what + why it might matter + a value tier)
    {{ signal }}

    ## The charter (the value function — invariants P1..P7, non-goals N1..N4)
    {{ charter }}

    ## The project's current state (go-and-see — clear against THIS)
    {{ project }}

    {{ ctx.output_format }}
  "#
}
