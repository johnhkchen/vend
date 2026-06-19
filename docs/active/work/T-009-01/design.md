# T-009-01 — Design: EpicCard type + ProposeEpic function + bridge/tests

Decisions, grounded in Research. Each is argued against the proven DecomposeEpic /
CaptureNote pattern and the card model.

## D0 — Overall stance: be the third instance, invent nothing

The substrate (ClaudeStub, the prompt shape, the subprocess bridge, the type-only-import
test discipline) is settled across two plays. The only genuinely new design work is the
**`EpicCard` type** — what closed sets become enums, how the card's
rendered-twice fields are modeled, and how `color` handles multi-color. Everything else
is a faithful copy of `note.baml` / `note-bridge.ts` / `note.test.ts`. Deviating from
the proven shape is a regression risk (it reintroduces the native-addon flake), so the
bias is *maximal mirroring*.

## D1 — Which fields become enums (the poka-yoke)

DecomposeEpic's core lesson: closed lisa sets are **enums**, so an out-of-set value is
unrepresentable by construction. Apply the same to the card's closed sets.

| Field | Decision | Rationale |
|---|---|---|
| `color` | **enum `CardColor`** (array — see D2) | WUBRG is a fixed 5-set; the color pie is closed. |
| `type` (stat-block) | **enum `CardType`** = Sorcery \| Permanent | The single-use/reusable axis is binary and closed. |
| `kind` (frontmatter) | **enum `CardType`** (same enum) | Same axis — see D3. |
| `rarity` | **enum `CardRarity`** = Common\|Uncommon\|Rare\|Mythic | The value tier is a fixed ladder (leaf→keystone). |
| `manaCost` | **string** | Free-form mana notation `{2}{U}` — not a closed set. |
| `id`,`title`,`serves`,`intent`,`value`,`doneLooksLike`,`context` | **string** | Free prose / identifiers. |
| `advances` | **string[]** | Open list of charter-invariant ids (`["P1"]`). |

Enum members follow the established convention exactly: **uppercase-first member name +
`@alias("lowercase-token")`**. The alias is what `{{ ctx.output_format }}` shows the
model and what SAP accepts; `b.parse` returns the **member** name. So aliases are the
lowercase card-model tokens (`white`, `blue`, `permanent`, `rare`, …); parsed values are
title-case member names (`White`, `Blue`, `Permanent`, `Rare`).

**Rejected:** modeling `color`/`type`/`rarity` as free strings. That throws away the
poka-yoke — the entire reason DecomposeEpic uses enums — and lets the model emit
"purple" or "legendary". Refused.

## D2 — `color` is `CardColor[]`, not a single `CardColor`

The card model states **multi-color is normal** and gives the worked example
*DecomposeEpic = Blue planning + White gates → Azorius (WU)*. A single-color field could
not represent the project's own flagship play. So `color CardColor[]`.

- Mono-color cards (most epics) → a one-element array (`["blue"]` → `[Blue]`).
- Multi-color (Azorius etc.) → `["white","blue"]` → `[White, Blue]`.

**Consequence for SAP leniency:** an array field never causes the whole class to reject;
but EpicCard *also* has required scalars (`id`, `title`, …), so the **class** still
rejects a garbage reply (like `Note`, unlike all-array `WorkPlan`). `color` simply
degrades to `[]` within an otherwise-parsed card if the model omits it. Acceptable —
color-presence is a PE-gate concern (T-009-02), not a shape concern.

**Rejected:** single `color CardColor`. Cannot express the documented Azorius example;
contradicts card-model.md. Refused.

## D3 — `kind` and `type` share one enum (`CardType`); they are the same axis

The ticket lists both `kind` (frontmatter) and `type` (stat-block) as EpicCard fields,
and the real card (E-009) carries both: `kind: permanent` and the stat-block line
"Permanent — Engine play". They are the **same single-use/reusable axis rendered twice**
(lowercase in frontmatter, title-case in the stat-block). Modeling them as one enum
`CardType` used by both fields means:

- One closed set, single-sourced — no chance of two different enum definitions drifting.
- The downstream renderer (T-009-02) produces the two render forms from one source: the
  `@alias` (`permanent`) for frontmatter `kind:`, the member name (`Permanent`) for the
  stat-block type line.
- The structural gate (T-009-02) can later assert `kind === type` (they should always
  agree); a divergence is a model error caught downstream.

I keep **both fields** rather than collapsing to one, because the ticket's AC enumerates
both and the goal is to *mirror the epic card* faithfully. The mild redundancy (the model
emits the value into two fields) is the cost of fidelity; it is cheap and gate-checkable.

**Rejected (a):** two distinct enums (`CardKind` + `CardType`) with identical members —
pure duplication, drift risk, no benefit. **Rejected (b):** a single `kind` field, drop
`type` — violates the AC's explicit field list and the "mirror the card" instruction.

## D4 — The function: copy DecomposeEpic's structure, raise it one level

```
function ProposeEpic(signal: string, charter: string, project: string) -> EpicCard {
  client ClaudeStub
  prompt #" … {{ signal }} … {{ charter }} … {{ project }} … {{ ctx.output_format }} "#
}
```

Same three-input signature *shape* as DecomposeEpic (an artifact + charter + project),
but the first input is a thin **demand signal**, not an epic, and the output is a single
**card**, not a DAG. The prompt encodes the authored judgment that is paid once — the
play-above-decompose framing and the load-bearing rules:

- **PE-1 pull-only** — fire on a *pulled* signal; never speculatively drain the board
  (overproduction is the worst waste). This guard is rendered as framing, not enforced
  here.
- **PE-3** — assign a card (manaCost = warranted budget envelope; color = discipline;
  type/kind = Sorcery|Permanent; advances = the charter invariant).
- **PE-4** — state value (`serves`, one line) + an **epic-level** `doneLooksLike`
  (observable at the epic level, not a ticket checklist).
- **PE-6** — intent, **not** decomposition (stop at the bigger-picture play; stories are
  DecomposeEpic's job).
- **PE-7** — right-size to ~one 2-hour feature block.

Mirrors `CaptureNote`'s framing density (a focused preamble), not a terse stub — the
authored judgment is the product.

**Rejected:** a richer input type (a `DemandSignal` class). The ticket signature is
`signal: string`; the structured demand model is not in scope and `string` matches both
sibling functions. Refused.

## D5 — Bridge: `propose-bridge.ts`, mirror `note-bridge.ts` exactly

Define `ProposeBridgeOp` = `{mode:"render"; signal; charter; project} | {mode:"parse";
text}` and `ProposeBridgeResult` (`render` → `prompt`, `parse` → `card: EpicCard`,
failure → `{ok:false,error}`). **Import `extractPromptText` from `decompose-bridge.ts`**
— it is already play-agnostic; re-implementing it would duplicate a verified helper. The
`import.meta.main` block sets the render-only key and runs the stdin→stdout JSON protocol,
identical to the two siblings.

## D6 — Tests: model after `note.test.ts` (required-scalar behavior), not decompose

EpicCard has required scalars, so it behaves like `Note` under SAP. Pins:
1. **parse** — a canned reply (lisa-token aliases) → typed `EpicCard`; assert id/title/
   serves, the enum member names (`color[0]==="Blue"`, `type==="Permanent"`,
   `kind==="Permanent"`, `rarity==="Rare"`), `advances`, and the four body fields.
2. **garbage → REJECTED** — `b.parse` throws on a non-card reply (required field missing);
   assert `ok===false`. This is the divergence from WorkPlan's degrade-to-empty.
3. **render** — `b.request` renders `signal`/`charter`/`project` sentinels into the
   prompt, plus a framing token (e.g. "epic" / the proposer preamble).

All imports type-only; one `runBridge` spawn; ops batched in a module-level `RESULTS`.
A present-but-empty pin (like note's third test) is **optional** and lower-value here
because the structural gate is T-009-02's job; I include the garbage-reject pin (highest
signal: proves EpicCard is a required-scalar class) and keep the suite tight.

## D7 — Regeneration & commit hygiene

Run `bun run baml:gen` after editing `propose.baml` so `EpicCard` + the three enums exist
in `baml_client/` for the type-only imports to resolve. `baml_client/` is gitignored —
it is **not** staged. Commits include only `baml_src/propose.baml`, `src/baml/
propose-bridge.ts`, `src/baml/propose.test.ts`, and the work artifacts. `check:committed`
stays satisfied.
