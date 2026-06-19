# T-009-02 — Design: PE gates + card renderer

Decisions, each argued against the codebase reality from Research and the proven
`gates.ts` / `materialize.ts` / `note-core.ts` patterns. The bias (T-009-01 D0): be the
next instance of a settled pattern; invent only what the card genuinely makes new.

## D0 — Stance: this is `gates.ts` raised one level, plus a `materialize`-style renderer

The four-gate `clear()` over a `WorkPlan` (gates.ts) and the pure `renderTicketFile`
(materialize.ts) are the two templates. The PE core is *the same two shapes* over an
`EpicCard`: an ordered-andon `clear()` with three gates, and a member→alias render. The
new work is (a) what each PE gate can check **purely on a single card** and (b) the
epic-card markdown shape. Everything structural copies the precedent.

## D1 — Return type: engine `GateVerdict`, not gates.ts `GateResult`

The AC says `clear(card, ctx) -> GateResult` and cites `gates.ts` for "the GateResult
shape". But the **registrable** type T-009-03 needs for `Play.gates` is engine
`play.ts`'s `GateVerdict`, and the precedent — `clearNote` (the play E-009 tells us to
mirror) — returns `GateVerdict` directly so `note.ts` registers `gates: clearNote` with
no adapter.

**Decision:** `clear` returns engine **`GateVerdict`**. It is the *same discriminated-union
shape* the AC cites (`{status:"clear", cleared?} | {status:"stop", gate, unit, reason}`) —
gates.ts's `GateResult` is documented as structurally assignable to it — but using the
engine type means zero adaptation at registration (T-009-03). This honors the AC's intent
(the GateResult *shape*) while matching the live second-play pattern.

**Rejected:** returning gates.ts `GateResult`. It would force an adapter or a cast at
registration, and binds the PE core to DecomposeEpic's `GateName` union (`value|allocation
|bounds|structural`) — wrong vocabulary (PE has no `allocation` gate). Refused.

## D2 — The clearing context: `{ charter, existingEpicIds }`

The gates need two things beyond the card. **Bounds** greps the live charter for `P#/N#`
(the gates.ts `matchIds` discipline — alignment recomputed at call time, never stored, so
retiring an invariant surfaces a dangling ref). **Structural** needs the live epic ids to
check disjointness. So:

```ts
export interface ProposeClearContext {
  readonly charter: string;              // greped for live P#/N# (bounds)
  readonly existingEpicIds: readonly string[];  // the live board (structural disjointness)
}
```

This mirrors `gates.ts`'s `ClearContext {epic, charter}` — a small derived context, not the
whole world. T-009-03 builds it impurely (read charter file, `listIdsIn(epicDir)`), exactly
as the decompose runner builds its `ClearContext` and materialize gathers board ids. The
pure core never touches fs.

**Rejected:** passing the raw `CastContext<I>` (engine) into the pure gate. That couples the
pure core to the engine's input-assembly type and to `projectRoot`; the derived two-field
context keeps the core testable with plain literals (the gates.ts precedent). Refused.

## D3 — The three gates, in value-priority order (andon on first failure)

`clear` runs an ordered table `[["value",…],["bounds",…],["structural",…]]` and returns the
**first** STOP, else CLEAR echoing all three names — the exact `gates.ts` `clear()` machine
(report the highest-priority defect; don't accumulate). Gate names: `"value"`, `"bounds"`,
`"structural"` (the PE gate set; no `allocation` — there's no DAG in a single card).

### value — the card states value and names what it advances
Purely checkable on one card (the demand signal is an input, not a field — Research
constraint): the card must carry the value-bearing fields that make it *worth allocating*
(charter criterion 1, "advances something nameable"):
- `serves` non-empty (PE-4, the one-line value);
- `advances` is a non-empty array with every entry non-blank (PE-3, names the charter
  invariant — never empty, the gates.ts `valueGate` `advances` rule);
- `value` non-empty (the body's "what capability this realizes");
- `intent` non-empty (PE-6, there is a bigger-picture play).

A present-but-empty SAP reply (blank-stringed card) fails here — the note-core lesson
applied to a card (the empty-degradation a parser can't reject). Uses the `nonEmpty` idiom
(`typeof s==="string" && s.trim().length>0`), shared across gates.ts/note-core.

### bounds — `advances` holds; no non-goal advanced
A faithful copy of `gates.ts` `boundsGate`, over the card's `advances`:
- grep `ctx.charter` for `P\d+` (invariants) and `N\d+` (non-goals) — `matchIds`;
- an `advances` entry shaped `N\d+` (or naming a live non-goal) → STOP "cannot advance a
  non-goal" (PE-5 bounds-check);
- an entry shaped `P\d+` not in the live charter → STOP "no such invariant (dangling ref)";
- free-text entries (epic-outcome prose) pass — human-judgment territory, not failed by
  rule (the gates.ts policy exactly).

PE-5 also says "prerequisites named" — that is semantic (is *this* prose a real
prerequisite?) and not purely decidable, so like gates.ts's free-text stance it is **not**
rule-failed here; it lives in the model's prompt (T-009-01) and human review. Documented as
a known boundary (Review), not silently dropped.

### structural — valid frontmatter + id disjoint from the board (E-004 reuse)
The last fixture on the way out (gates.ts `structuralGate` order — "only now"):
- every required card field present + non-empty: `id, title, kind, advances, serves,
  manaCost, color, type, rarity, intent, value, doneLooksLike, context`. Enum-valued fields
  (`kind/type/rarity/color`) are checked for **presence** only — BAML already guarantees the
  *value* is in-set, so re-checking duplicates the type (the gates.ts `REQUIRED_*` rule).
  `color` must be a non-empty array (PE-3, "never empty"; the array SAP-degrades to `[]`).
- `id` well-formed: matches `^E-\d{3}$` (epic-card id shape — the R6 granularity).
- `kind === type` (D3 of T-009-01: the same axis rendered twice must agree; a divergence is
  a model error caught here).
- **disjointness**: `detectCollisions([card.id], ctx.existingEpicIds)` non-empty → STOP
  "id already on the board" (the E-004 guard, reused verbatim — AC's "colliding/duplicate
  id → structural STOP").

### Ordering rationale
value→bounds→structural is value-priority (gates.ts): a card that advances nothing AND
collides is reported as a *value* failure (the deepest defect first). The andon stops at the
first; later gates never run.

## D4 — `nextEpicId(existing)`: the mint helper, exported separately

The AC: structural "reuses `detectCollisions` for epic-id disjointness **+ computes the
next free `E-0XX`**". Minting is not a *gate*'s job (a gate judges; it doesn't assign), so I
expose a pure helper the T-009-03 effect calls to mint the id it writes:

```ts
export function nextEpicId(existing: readonly string[]): string  // -> "E-0XX"
```
Parse every `E-\d+` in `existing`, take `max+1`, zero-pad to 3 (`E-010`). Empty board →
`E-001`. PURE and TOTAL. This keeps the gate (disjointness *check*) and the effect (id
*assignment*) cleanly split while satisfying the AC's "mints the next free id" in this
module. The gate and the mint both lean on the same `existingEpicIds`.

**Rejected:** minting *inside* the structural gate and rewriting `card.id`. A pure gate must
not mutate its input or have a side-effect-shaped return; and the model already mints an id
(propose.baml prompt). The gate verifies; the effect (T-009-03) may overwrite with
`nextEpicId` if it distrusts the model. Clean separation. Refused.

## D5 — `renderCard(card) -> string`: member→alias, mirror `renderTicketFile`

A PURE function returning the `E-0XX.md` markdown (Research render target). Structure:

1. **member→alias maps** (module constants, the `materialize.ts` pattern): `COLOR_ALIAS`
   (`White→white`…), `CARD_TYPE_ALIAS` (`Sorcery→sorcery`, `Permanent→permanent`),
   `RARITY_ALIAS` (`Common→common`…). An `alias(table, member, field)` helper that
   **throws `RangeError`** on an unknown member (enum/map drift = programmer error, the
   materialize house rule — never a silently-wrong token).
2. **frontmatter** (E-009 shape): `id`, `title`, `status: open` (a freshly *proposed* card
   is `open` — not yet cleared by decompose), `kind` (alias), `advances` (`flowArray`),
   `serves: >` folded. No color/mana/rarity in frontmatter (E-009 doesn't carry them).
3. **stat-block**: a deterministic, parseable block carrying `manaCost`, `color` (aliases
   joined), `type` (alias), `rarity` (alias) — the four stat fields the frontmatter omits,
   so the markdown round-trips **every** card field (AC). A trailer naming the play
   (`propose-epic`), the note-core honesty trailer.
4. **body**: `## Intent — the bigger-picture play` (intent), `## Value to the design`
   (value), `## Done looks like` (doneLooksLike), `## Context & constraints` (context) —
   the E-009/TEMPLATE section headings.

Return a plain `string` (not `{name, body}`): the AC signature is `renderCard(card) ->
string`, and the *filename* (`${card.id}.md`) is the effect's concern (T-009-03), derivable
from `card.id`. Returning the body alone matches the AC and keeps the renderer single-purpose.

**Rejected:** reproducing E-009's exact ASCII-art box. Pixel-perfect art is brittle to
round-trip and adds no value over a clean, deterministic, greppable block; generated prose
should read as generated (the note-core precedent). The box is a hand-authoring nicety. A
clean stat-block that contains every field is the right altitude.

## D6 — Tests: four AC pins + helper coverage, all type-only imports

`propose-core.test.ts`, modeled on `note-core.test.ts`/`materialize.test.ts` — every BAML
import **type-only**, no addon, no fs (the renderer/gates are pure; no temp-dir needed).
A module-level `FULL_CARD: EpicCard` fixture (built directly, the shape `b.parse` yields).
Pins:
1. **value/pass** — `FULL_CARD` + a context whose charter contains `P1` → `clear` returns
   `{status:"clear", cleared:["value","bounds","structural"]}`.
2. **bounds STOP** — a card with `advances:["N4"]` (advancing a non-goal) → STOP at
   `gate:"bounds"`.
3. **structural STOP (collision)** — `existingEpicIds` already contains `FULL_CARD.id` →
   STOP at `gate:"structural"` naming the id (the E-004 reuse proven). Plus a malformed-id
   pin and a `kind!==type` pin for the structural field checks.
4. **render round-trip** — `renderCard(FULL_CARD)` `toContain`s id, title, serves, each
   `advances` entry, manaCost, each color alias, type alias, rarity alias, and all four
   body fields; frontmatter has `status: open` and `kind:` as the lowercase alias.
Plus a `nextEpicId` pin (empty→`E-001`, gappy board→max+1 padded) and a value-STOP pin
(blank `serves`/empty `advances`). Tight but covers every export and every AC.

## D7 — Module boundary & commit hygiene

`src/play/propose-core.ts` runtime-imports **only** `detectCollisions` from `id-guard.ts`
(pure). `EpicCard`/`CardColor`/`CardType`/`CardRarity` are **type-only** imports from
`baml_client/index.ts`. No engine import is needed at runtime — `GateVerdict` is imported
**type-only** from `engine/play.ts` (the note-core precedent). `baml_client/` is gitignored;
only the source + test + work artifacts are committed; `check:committed` stays green.
</content>
