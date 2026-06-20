# T-029-01 — Research: visual-atoms

Descriptive map for the **visual atoms** of `design-language.md` (DL-1…). This ticket is the
visual complement of the IA spine: it captures the *tokens* (governing restraint principle,
palette/tone meanings, type hierarchy, the meter rule, the andon rule). Doc-only — no source is
touched. The job here is to map what already exists so the charter formalizes the **live look**,
not an imagined one.

## 1. The doc this parallels — `information-architecture.md`

The shape to mirror is settled and on disk. IA-doc properties (the anti-stale contract):

- **Principle-level, capped, slow.** Numbered invariants (IA-1…IA-17), each a short paragraph,
  not a spec. Opens with a one-line statement of what it is *for* and *what it must not become*
  ("small by design and slow by design").
- **A governing decision first.** IA-1 (recommendation-first) is stated as *the* decision that
  "sets the information hierarchy everywhere." The design-language doc wants the same shape: a
  governing DL-1 (clean-typographic restraint) that dictates everything below it.
- **An anti-drift clause.** "Where a future surface and this file disagree, fix one — they are
  not allowed to drift." The DL doc inherits this verbatim.
- **A terminal index.** IA closes with a one-line-per-principle index (`IA-1 recommendation-first
  · IA-2 …`). DL mirrors it.
- **Lenses carry over, scoped.** TPS (assembly line + andon cord) and MTG (shelf = cards, budget
  = mana) are named as *lenses*, living in `tps.md` / `card-model.md` / `mana-economics.md` — not
  literal chrome. DL-doc keeps cards as a doc/spec lens, never TUI chrome (that decision lands in
  T-029-02; this ticket only needs to not contradict it).

The IA principles this ticket gives a **look** to (the cited subset): **IA-1** (the home leads
with demand — the recommendation leads, the shelf recedes), **IA-6** (Confirm→Run→Settle),
**IA-7** (production line, never the raw stream), **IA-8** (the meter must not lie about its two
denominations), **IA-9** (the andon is a successful refusal — amber, not red).

## 2. The live emitted surfaces — the reference look, grounded in code

The charter must formalize what these functions already print. Inventory:

### 2a. The two-denomination meter — `src/budget/wallet.ts` `formatWallet` (IA-8)

```
◇ 120k/2.0M · 1.9M left   ⏱ 12m/2h · 1h48m left
```

- The single source of two-denomination truth, reused by the production line *and* the receipt
  so the meter never lies (one formatter, two call sites).
- **Distinct glyphs already: `◇` tokens, `⏱` wall-clock.** Header comment is explicit: `⏱`
  wall-clock is a **HARD WALL** (overrun halts mid-flight); `◇` tokens are **DETECT-AFTER** (a
  cleared cast's burn can overshoot; `debit` floors remaining at 0). This is exactly IA-8.
- **Honest tension (load-bearing for DL-4):** today both denominations share the *same text
  shape* — `spent/funded · left`. The glyph differs but the *form* does not. IA-8 says drawing
  the two identically "would be a lie." The current text is the minimum-honest version (distinct
  glyph, distinct units); a richer surface (the TUI) must draw `⏱` as a **countdown to a hard
  stop** and `◇` as a **burn-vs-envelope fill that can trip the andon late** — *different shapes*,
  not two identical bars. DL-4 is where that rule gets written down.

### 2b. The production line — `src/play/work-core.ts` `formatStepSignal` (IA-7)

```
▶ casting: <candidate label>
    ◇ 120k/2.0M · 1.9M left   ⏱ 12m/2h · 1h48m left
✓ done   : <candidate label>
    ◇ …meter…
```

- One distilled "which pull is running" line + the meter — never the raw executor stream (IA-7).
- Type hierarchy is carried by **glyph + indent**: `▶`/`✓` lead at column 0; the meter is
  indented 4 spaces beneath (subordinate detail recedes). `labelForSignal` truncates to the
  "what" half (before ` — `), dropping the rationale — the recommendation leads, detail recedes.

### 2c. The Settle receipt — `src/play/work-core.ts` `renderReceipt` (IA-6)

```
═ vend work — receipt ═

Cast 3, cleared 2:
  ✓ <candidate>   ◇ 45k   ⏱ 6m
  ⚠ <candidate>   andon: gate-failed   ◇ 30k   ⏱ 4m      ← amber when color on
  ✓ <candidate>   ◇ 52k   ⏱ 7m

wallet: ◇ 127k/2.0M · 1.9M left   ⏱ 17m/2h · 1h43m left

stopped: board cleared — <detail>                         ← amber only when stop === andon
```

- A `═`-ruled header (the one chrome rule in the whole surface), blank-line separation between
  blocks (whitespace as the divider, not boxes), 2-space indent for the per-cast list.
- `STOP_HEAD` maps each clean stop to calm phrasing: `andon` → "andon — refused (a successful
  stop, not a crash)"; `wallet-exhausted` / `board-cleared` are neutral. Amber is applied *only*
  to the andon step line and the andon stop line.

### 2d. The stale-board andon — `src/play/work-core.ts` `renderStaleBoard` (IA-9)

```
⚠ stale board — refused (a successful stop, not a crash)     ← amber
  board:           docs/active/pm/staged/steer.md
  board staged:    2026-06-19T20:11:04.000Z
  project changed: 2026-06-20T00:49:12.000Z  (newer than the board)
  The board predates the project's current state — spending would clear superseded work.
  Re-survey before spending:  vend steer  (or  vend survey ),  then  vend work
  (mtime is a heuristic — a git checkout can reset it; pass --stale-ok to spend anyway.)
```

- This is the IA-9 andon in the flesh, and it already carries the **four payloads**: which gate
  (freshness) · what survived (nothing spent — refused before funding) · why (board predates live
  state, in the user's terms) · the next pull (re-survey, then `vend work`). Calm/protective
  voice ("a successful stop, not a crash"). Amber on the headline only; metadata recedes by indent.

### 2e. The audit readout — `src/ledger/walk-away.ts` `formatWalkAwayFindings`

```
E1 — walk-away trust · all plays · 15 runs [standard]
  walk-away rate: 87% (13/15 ran untouched) · trend 80% → 93% (target → 100%)
    └ forward (live): 50% (1/2 untouched) · attested back-fill: 92% (12/13 untouched)
  andon rate: 13% vs 10% budget — ⚠ over (gates working, not defects)     ← ⚠ is NOT red
  outcome mix: 13 success · 1 censored (budget/timeout) · 1 gate-failed · 0 id-collision
  cost vs envelope: tokens ×0.82 · time ×0.74 (median over 12 successful runs)
```

- The `└` sub-line is a type-hierarchy device: a provenance disaggregation that *recedes beneath*
  the headline rate (indent + box-drawing leader). Forward vs attested split (T-028-01).
- Crucially: `⚠ over` is **not** an error — the line itself says "gates working, not defects"
  (IA-10). The andon vocabulary (`⚠`, "within"/"over") never reaches for red.

### 2f. The one color helper — `amber()` (work-core.ts) / no `dim()` yet

- The **only** ANSI color in `src/` is `amber(s, on)` → `\x1b[33m…\x1b[0m`. Its comment states the
  invariant outright: "an andon renders amber (a successful refusal), NEVER red." Gated by an `on`
  flag so the pure text stays test-assertable; the CLI passes `color: true`.
- **There is no `dim()`/ANSI-2 applied anywhere.** The "dim/muted = metadata" intent is today
  expressed structurally — through **indentation and word order**, not a dim SGR. Honest gap to
  record: the palette's "dim secondary" is a charter principle the current CLI approximates with
  whitespace; a richer surface would add the actual dim attribute. DL-2/DL-3 name the principle;
  the gap is the downstream TUI's to close (anti-drift: fix one, don't let them diverge silently).

## 3. The glyph + structural vocabulary already in use

A small, consistent set — the atoms the charter is really cataloguing:

| Token | Meaning in the live surface | IA tie |
|---|---|---|
| `◇` | tokens — a detect-after burn | IA-8 |
| `⏱` | wall-clock — a hard-wall countdown | IA-8 |
| `▶` | a cast is running (production line) | IA-7 |
| `✓` | done / cleared / within budget | IA-6/IA-10 |
| `⚠` | andon — a successful refusal (amber) | IA-9 |
| `→` | a trend (walk-away toward 100%) | — |
| `·` | inline separator (keeps one line scannable) | — |
| `└` | a sub-reading that recedes beneath its headline | IA-7/IA-8 |
| `═` | the one rule (receipt header) — chrome as the exception | DL-1 |
| amber `\x1b[33m` | the single reserved saturated color | IA-9 |

## 4. Constraints & assumptions

- **Direction is fixed.** Clean-typographic, human-set (2026-06-20, E-029 frontmatter). Not re-opened.
- **Atoms only.** This ticket writes DL-1…DL-N *atoms*; surfaces (Home/Counter/Ledger mocks +
  card-as-lens) are T-029-02. The file may be created here with the atoms and extended there.
- **Capped + anti-stale.** Principle-level, IA-doc length, not a pixel spec or component library.
- **Terminal type is poor.** A terminal has almost no type to spend — only case, weight (bold),
  dim, indent, whitespace, and a small glyph set. The hierarchy must come from *deliberate use of
  those levers*, not font sizes.
- **`bun run check:*` is doc-only-safe.** No source touched ⇒ typecheck/test stay green; the gate
  is satisfied by not regressing, not by new tests.

## 5. Open questions carried into Design

- How many DL atoms? (Proposal: DL-1 governing, DL-2 palette, DL-3 type hierarchy, DL-4 meter,
  DL-5 andon — five atoms; surfaces start at DL-6 in T-029-02.)
- How to record the meter tension (2a) — as a principle with an honest "today vs target" note, or
  silently? (The IA doc's style is to name gaps, not hide them.)
- How literal to make the palette without becoming a hex spec? (Tone *meanings*, glyph/attribute
  bindings, not RGB.)
