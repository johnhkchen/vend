# T-029-02 — Research: surfaces-and-card-as-lens

Descriptive map for the **surfaces** layer of `design-language.md` (DL-6…). T-029-01 settled the
*atoms* (DL-1…DL-5: restraint, palette, type hierarchy, the meter rule, the andon rule). This ticket
composes those atoms into the three **surfaces** a TUI epic reads to know what to build — **Home, the
Counter, the Ledger** — and settles the **card-as-lens** decision. Doc-only: no source is touched; the
job is to map what already exists so the surface principles formalize the **live look**, not an
imagined one.

## 1. The boundary this continues

`design-language.md` exists on disk with the preamble + DL-1…DL-5 + a partial index whose tail line
already reserves the slot: *"(DL-6… the surfaces — Home / Counter / Ledger / production-line mocks +
the card-as-lens decision — T-029-02.)"* So this ticket **appends** DL-6… and **completes** the index;
it does not re-open the atoms or the direction (clean-typographic, human-set, E-029). The story DAG
(atoms → surfaces, T-029-01 → T-029-02) makes the append-order safe — no concurrent write to the file.

The atoms the surfaces compose (the cited subset, all from `design-language.md`):
- **DL-1** clean-typographic restraint (the recommendation leads, detail recedes, chrome is the
  exception, one rule `═`, one color amber).
- **DL-2** palette tone-meanings (amber = andon and nothing else; default = content; dim ≈ indent
  today; settle accent = intent only, no live binding; never red).
- **DL-3** hierarchy from the terminal's few levers (case · weight · dim · indent · whitespace · glyph).
- **DL-4** the two-denomination meter that cannot lie (`◇` detect-after burn, `⏱` hard-wall countdown).
- **DL-5** the andon as a successful refusal — amber, calm voice, four payloads, no red, no chrome.

## 2. The IA surfaces this gives a *look* to

The surfaces are already settled in `information-architecture.md` as *what the user sees and how they
move*; DL-6…8 settle *what each looks like*. The cited IA subset:

- **IA-1 / IA-2** — Home is **Board (pull-ranked) + Shelf (inventory beneath)**: "supply is visible;
  demand leads." The recommendation-first decision; the shelf *serves* the recommendation.
- **IA-6** — the Counter's spine is **Confirm → Run → Settle** (point-of-sale → assembly line →
  receipt); Confirm pre-fills the budget from the leverage tier (accept-the-default is the common case).
- **IA-7** — during Run, show a **production line** (node-level "which pull is running" + one distilled
  line), never the raw executor stream.
- **IA-8** — the meter's two denominations drawn so they cannot be conflated (DL-4's grounding).
- **IA-9 / IA-10** — the andon is a successful refusal (amber, four payloads); an andon rate is a
  "gates working" rate, **never a red defect count** — the Ledger frames it that way.

## 3. The live emitted surfaces — the reference the mocks formalize

The mocks are *reference*, not pixel specs; each must agree with a function that already prints. The
inventory (`grep "export function (format|render)" src/`):

### 3a. Home — Board + Shelf (IA-1/IA-2)

- **The shelf** — `renderMenu` (`src/shelf/menu.ts`). The shelf is a **numbered list, not boxed
  cards**: `1. <id> <title>  [Tier] · 2h/50k · ready`, with a `(+K hidden — vend --all)` footer when
  rows are omitted (the omission is visible, not silent). `formatBudget` renders the envelope
  human-scale (`2h/50k`). **This is the live proof the shelf already renders no card chrome** — a list,
  not a grid of stat blocks. This is load-bearing for DL-9.
- **The board** — `renderBoard` / `renderSignalRow` (`src/play/survey-core.ts`): the demand board is
  **rows of ranked signals**, not cards. The board leads (IA-1); the shelf list sits beneath.
- **The ledger summary line** — the provenance-split readout (E-028, `formatWalkAwayFindings`) is the
  one-line "trust at a glance" Home shows above/beside the board (forward vs attested — §3c).
- **Honest gap:** there is **no single `renderHome`/`renderBoard+Shelf` composite emitter yet** — Home
  is composed from `renderMenu` + `renderBoard` + the audit line by the CLI, not one function. The
  DL-6 mock therefore formalizes the **composition** of three live emitters, and names that there is
  no single composite today (a TUI closes it; the mock is the contract it closes against).

### 3b. The Counter — Confirm → Run → Settle (IA-6/7)

- **Confirm** — no dedicated renderer yet; the budget envelope is `formatBudget` (`2h/50k`) pre-filled
  from the board's tier. Honest gap: the Confirm gesture's shape is an IA open thread
  ("Confirm's budget-adjust interaction" — slider/presets/accept-default). The mock shows
  accept-the-default, the settled common case, and stays silent on the open adjust mechanism.
- **Run** — `formatStepSignal` (`src/play/work-core.ts`): `▶ casting: <label>` at column 0, the
  two-denomination meter indented 4 spaces beneath. The production line, node-level, against
  `formatWallet`'s meter (IA-7/IA-8). Already live.
- **Settle** — `renderReceipt` (`src/play/work-core.ts`): the `═`-ruled header (the one chrome rule),
  per-cast list (`✓`/`⚠` + `◇`/`⏱`), the wallet line, and a `stopped:` line whose stop reason is amber
  **only** when `stop === andon` (`STOP_HEAD` maps each stop to calm phrasing). Already live.

### 3c. The Ledger — run history + walk-away/andon readout (IA-10)

- `formatWalkAwayFindings` (`src/ledger/walk-away.ts`): the E1 walk-away readout, **provenance-split
  (E-028)** — a headline walk-away rate with a `└ forward (live) … · attested back-fill …` sub-line,
  an `andon rate: … vs … budget — ⚠ over/within (gates working, not defects)` line where `⚠` is
  **never red**, an outcome mix, and a cost-vs-envelope line. This is the IA-10 stance in the flesh:
  the andon number is framed as the gates working, never a defect count.
- `formatEnvelopeLabel` / `formatCorrectionLabel` (`src/ledger/recalibrate.ts`): the per-node
  recalibration labels (the inspectable record IA-15 describes).

### 3d. The card-as-lens evidence — the lens lives in the *doc*, not the TUI

- `renderCard` (`src/play/propose-core.ts`): the MTG **stat block** — a fenced ``` block carrying
  `<title>   <manaCost>` and `<type> — <colors>   (rarity: …)` — is rendered into an **epic card
  markdown file** (frontmatter + stat block + `## Intent / ## Value / ## Done looks like` body). The
  card chrome is **doc chrome**: it lives in `card-model.md`'s lens and the proposed epic `.md`, the
  spec artifact a human reads — **not** in any TUI emitter.
- By contrast every **TUI** emitter above (`renderMenu`, `renderReceipt`, `formatStepSignal`,
  `renderBoard`) renders **no boxed card**: lists, rows, a single `═` rule, indentation. The split is
  already real in the code — DL-9 only has to *name* it so no TUI epic re-introduces card chrome by
  default. The "cost as a compact inline glyph (`{U}`) at most" allowance maps to the mana-cost being a
  short token, never a framed card.

## 4. The glyph + structural vocabulary the surfaces reuse (from DL-3, all live)

| Token | Role in the surfaces | Atom |
|---|---|---|
| `▶` | a cast running (Counter · Run) | DL-3/DL-5 |
| `✓` | cleared / within budget (shelf state · receipt) | DL-3 |
| `⚠` | the andon — amber, a successful refusal | DL-5 |
| `◇ / ⏱` | the two denominations — never one bar | DL-4 |
| `└` | a sub-reading receding beneath its headline (ledger split) | DL-3 |
| `═` | the one rule — receipt header, chrome as the exception | DL-1 |
| `·` | inline separator (one scannable line) | DL-3 |
| `{U}` | a compact inline cost glyph — the *most* card chrome a surface may show | DL-9 |

## 5. Constraints & assumptions

- **Direction fixed** — clean-typographic (E-029). Surfaces are a *composition* of settled atoms, not a
  new look.
- **Mocks are reference, not specs.** Small ASCII, type-led, amber only on the andon, no boxed cards.
  "Where a future TUI and this charter disagree, fix one — no drift" (the IA-doc rule).
- **Capped + anti-stale.** A principle + an index line per surface, the IA-doc shape; each ends with a
  `Grounds in:` pointer to the live emitter(s) it formalizes.
- **Honest gaps named, not hidden** (the IA-doc habit): no single `renderHome` composite; no `Confirm`
  renderer (adjust mechanism is an IA open thread); the settle accent has no live binding (DL-2). The
  mocks formalize the *composition* and name the gap each time.
- **`bun run check:*` is doc-only-safe** — no source touched ⇒ typecheck/test stay green; the gate is
  satisfied by non-regression, not new tests.

## 6. Open questions carried into Design

- How many surface atoms? (Proposal: DL-6 Home, DL-7 Counter (Confirm→Run→Settle, one principle
  covering the three-beat spine), DL-8 Ledger, DL-9 card-as-lens-not-chrome — four atoms, DL-6…9.)
- Does the Counter get one atom (the spine) or three (one per beat)? The Run beat is already DL-3/DL-4
  territory; folding Confirm+Run+Settle into one DL-7 with three sub-mocks avoids re-stating the meter.
- How literal should the mocks be — re-print the live strings verbatim, or schematize? (Proposal:
  schematic but faithful — recognizably the live emitter, placeholders for content, the real glyphs.)
- Where does the ledger summary line live on Home — its own DL or a cross-reference from DL-6 to DL-8?
  (Proposal: DL-6 shows it in the Home mock and cross-references DL-8 for the full readout.)
