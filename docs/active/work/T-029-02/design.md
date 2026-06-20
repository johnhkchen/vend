# T-029-02 — Design: surfaces-and-card-as-lens

The direction is **fixed** (clean-typographic, E-029) and the atoms are **fixed** (DL-1…DL-5). So this
is not a "which look" decision — it is a decision about the **shape of the surfaces layer**: how many
surface atoms, where the Counter's three beats land, how literal the ASCII mocks are, and how the
card-as-lens decision is stated so it *binds* (no TUI epic re-introduces card chrome by default). Every
option is judged against the research: it must compose the live emitters and mirror the IA/DL-doc shape.

## Decision 1 — The surface atom count and numbering

**Options**
- **(A) Four atoms** — DL-6 Home · DL-7 the Counter (Confirm→Run→Settle, one principle, three
  sub-mocks) · DL-8 the Ledger · DL-9 card-as-lens-not-chrome.
- **(B) Six atoms** — split the Counter into DL-7 Confirm / DL-8 Run / DL-9 Settle, push Ledger to
  DL-10, card-as-lens to DL-11.
- **(C) Three atoms** — fold card-as-lens into DL-6 Home (the shelf is where chrome would intrude).

**Choice: (A) four atoms, DL-6…9.** The ticket's four required captures map 1:1 — Home, Counter
(Confirm→Run→Settle named as *one* spine, IA-6's own framing), Ledger, and the *explicit* card-as-lens
principle the AC demands as its own item. (B) over-fragments the Counter: IA-6 states the spine as
**one** decision ("Confirm → Run → Settle"), and the Run beat is already DL-3 (production line) + DL-4
(meter) — three atoms would re-state the meter rule and break the "one concern, one principle" habit
the IA doc keeps (IA-9 is *one* andon principle, not five). (C) buries the card decision the AC wants
*explicit and citable* — it must be its own numbered DL so a TUI epic can be pointed at "DL-9 says no
card chrome." Four is the smallest set giving each ticket-required surface its own citable number.

Numbering continues the file: DL-1…5 exist, so surfaces are **DL-6, DL-7, DL-8, DL-9**, and the index's
reserved tail line is replaced by real entries.

## Decision 2 — The Counter: one atom with three sub-mocks vs. three atoms

**Choice: one atom (DL-7), three labelled sub-mocks** — Confirm, Run, Settle — under a single "the
Counter is the three-beat spine" principle. Rationale: IA-6 *is* one principle over three beats; the
Run beat's look is already owned by DL-3 (the `▶`/indent hierarchy) and DL-4 (the meter), so DL-7's job
is to **compose** them into the beat sequence, not redefine them. Confirm has no live renderer (an IA
open thread — the adjust mechanism), so its sub-mock shows the *settled* part (accept-the-default,
budget pre-filled from tier) and stays silent on the open adjust gesture — honesty over invention. Run
and Settle sub-mocks reproduce `formatStepSignal` and `renderReceipt` faithfully. This keeps the meter
rule stated **once** (DL-4) and referenced, never duplicated.

Rejected: three Counter atoms (Decision 1 (B)) — duplicates DL-4 and inflates the cap.

## Decision 3 — How literal the ASCII mocks are

**Options**
- **(A) Schematic-but-faithful** — recognizably the live emitter (real glyphs `▶ ✓ ⚠ ◇ ⏱ └ ═`, real
  layout: column-0 leads, 4-space meter indent, `═` header), with placeholders for content
  (`<pull>`, `<label>`), and amber shown as an inline `← amber` annotation (the doc is plain text).
- **(B) Verbatim live strings** — copy the exact emitted output including sample numbers.
- **(C) Abstract wireframe** — boxes-and-labels diagram, no real glyphs.

**Choice: (A) schematic-but-faithful.** The ticket says the mocks are **reference, not pixel specs**,
yet must be "consistent with T-029-01's atoms (type-led, amber only on the andon, no boxed cards)" —
so they must use the *real* glyph and indent vocabulary (else they cannot be checked against the live
surface) but not freeze sample numbers (which drift). (B) freezes incidental values (`120k/2.0M`) that
the code legitimately changes — the mock would rot. (C) loses the type-led discipline that *is* the
point — an abstract box diagram could not show "amber only on the andon" or "no boxed cards." (A) is
the form the IA doc itself uses (IA-2's `Home = Board + Shelf` ASCII tree). Amber is annotated
`← amber` because the charter is plain markdown; the annotation makes DL-2's "amber and nothing else"
*visible* in the mock.

A hard rule for every mock (DL-1/DL-2 applied): **no box-drawing frame around any element** (only the
receipt's single `═` header rule and the `└` sub-reading leader are allowed); **amber annotated only on
the andon line**; **the recommendation/headline leads at column 0, detail recedes by indent.**

## Decision 4 — DL-6 Home: what the mock shows and the honest composite gap

**Choice:** DL-6 states **demand leads, supply serves** (DL-1 applied to the whole screen — the visual
parallel to IA-1) and shows a mock with the **board ranked first** (the NOW + why leading), the
**shelf list receding beneath** (numbered, `[Tier] · 2h/50k · state`, *not* cards), and the
**provenance-split ledger summary line** at the foot (forward vs attested at a glance — cross-referenced
to DL-8). The principle **names the honest gap**: there is no single `renderHome` composite emitter
today — Home is `renderMenu` + `renderBoard` + the audit line composed by the CLI; the mock formalizes
the *composition*, and a TUI closes the gap *against this mock*. Grounds in `renderMenu` / `renderBoard`
/ `formatWalkAwayFindings`. Rejected: inventing a `renderHome` look the code doesn't have (would drift).

## Decision 5 — DL-8 Ledger: the "gates working" framing is the load-bearing visual rule

**Choice:** DL-8 restates IA-10 as a *visual* principle: the andon rate is rendered as a **"gates
working" reading, never a red defect count** — `⚠ over` is the andon glyph (amber family), and the line
itself carries "gates working, not defects." The mock reproduces `formatWalkAwayFindings` faithfully:
the headline walk-away rate, the `└` provenance sub-line (E-028 forward vs attested), the andon-rate
line with its non-defect framing, outcome mix, cost-vs-envelope. The visual rule: **no surface
red-flags the andon number; `⚠` is never red** (DL-2/DL-5). Grounds in `formatWalkAwayFindings`. This is
the surface where the IA-10 "two success states" stance becomes a concrete rendering rule.

## Decision 6 — DL-9 card-as-lens-not-chrome: stating it so it *binds*

This is the AC's explicit decision. **Choice:** DL-9 states three things as an invariant:
1. **The card/mana model is a doc/spec lens** — it lives in `card-model.md` and the proposed epic
   `.md` files (`renderCard`'s stat block is *doc* chrome), giving budget/single-use-vs-reusable/the
   taxonomy a shape. It is a *reading aid for authors*, not a UI widget.
2. **The TUI surfaces render no boxed cards** — Home/Counter/Ledger are lists, rows, one `═` rule,
   indentation. This is **already true in code** (`renderMenu` is a numbered list, not a card grid) —
   DL-9 names the existing split so it isn't lost.
3. **Cost may appear as a compact inline glyph at most** (e.g. `{U}` or the `2h/50k` envelope) — never
   a framed card. The allowance is bounded so "inline glyph" can't be stretched back into chrome.

Grounds in `renderCard` (the lens, in the *doc*) vs `renderMenu`/`renderReceipt` (the TUI, *no* cards).
The principle's binding clause: *no TUI epic re-introduces card chrome by default; if a future surface
wants a card, it changes DL-9 first* (the anti-drift contract — fix one, don't drift). Rejected: stating
it only in prose without the doc-vs-TUI grounding — the grounding is what makes "no chrome" checkable.

## Decision 7 — Index + grounding, mirroring DL-1…5

**Choice:** each surface principle ends with a one-line **`Grounds in:`** pointer (the DL-doc habit),
and the file's closing index replaces its reserved tail line with real entries: `DL-6 home-demand-leads
· DL-7 counter-confirm-run-settle · DL-8 ledger-gates-working · DL-9 card-as-lens-not-chrome`. A short
section intro ("The surfaces — composing the atoms") precedes DL-6, mirroring the "The two honest
rules" intro before DL-4/5. No new preamble (the file's preamble already scopes the whole doc).

## What is rejected, summarized

- **Re-opening the direction or the atoms** — both fixed. Surfaces compose; they do not redefine.
- **Three Counter atoms / six total** — duplicates DL-4, inflates the cap (Decision 1/2).
- **Verbatim or abstract mocks** — rot or lose the type-led discipline (Decision 3).
- **Inventing a `renderHome` composite** — drift; name the gap instead (Decision 4).
- **A boxed-card TUI, or card-as-lens left implicit** — the AC bans the first and demands the second be
  explicit and citable (Decision 6).

## The resulting surface set (input to Structure)

DL-6 Home — demand leads, supply serves (board first, shelf list receding, ledger summary line) ·
DL-7 the Counter — Confirm → Run → Settle, one spine, three faithful sub-mocks · DL-8 the Ledger —
the andon rate as "gates working," never a red defect count · DL-9 card-as-lens-not-chrome — the lens
is doc/spec, the TUI renders no card chrome, cost as an inline glyph at most. Each with a small
schematic-but-faithful ASCII mock (real glyphs, no boxed cards, amber annotated only on the andon) and
a `Grounds in:` pointer; the index completed; honest gaps (no `renderHome`, no Confirm renderer, the
settle accent) named, not hidden.
