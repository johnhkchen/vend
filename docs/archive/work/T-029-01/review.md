# T-029-01 — Review: visual-atoms

Handoff for a human reviewer. What changed, what's covered, what to watch.

## What changed

**One knowledge file created**, plus the RDSPI work artifacts. No source touched.

| Path | Change | Lines |
|---|---|---|
| `docs/knowledge/design-language.md` | **created** — the visual-atoms charter (DL-1…DL-5) | ~95 |
| `docs/active/work/T-029-01/{research,design,structure,plan,progress,review}.md` | created — RDSPI trail | — |

Committed as `5e74718` on `main` (the branch this RDSPI sweep ran on, matching the prior E-026/E-027/
E-028 ticket history).

### The deliverable in one paragraph
`design-language.md` is the clean-typographic complement to `information-architecture.md`: an
IA-doc-shaped, capped, anti-stale charter capturing the **visual atoms** the eventual TUI composes
from. Five principles: **DL-1** clean-typographic restraint (governing — type/whitespace carry it,
chrome is the exception, color is meaning); **DL-2** the five-tone palette as *meanings* not hex
(amber reserved for the andon and nothing else; default; dim; a settle accent; never red); **DL-3**
type hierarchy from the terminal's six levers (case/weight/dim/indent/whitespace/glyph, recommendation
leads / detail recedes); **DL-4** the two-denomination meter that cannot lie (◇ detect-after burn vs
⏱ hard-wall countdown — IA-8); **DL-5** the amber andon as a successful refusal (four payloads, calm
voice, non-red/non-chrome — IA-9). Each atom ends with a `Grounds in:` pointer to the live function it
formalizes; the index defers DL-6… (surfaces) to T-029-02.

## Acceptance criteria — all met

- **AC#1** — `design-language.md` exists with DL-1 (clean-typographic restraint) + the palette/tone
  meanings (amber-reserved, default, dim, settle accent, never-red) + the type hierarchy;
  principle-level, capped, IA-doc shape. ✅
- **AC#2** — the two honest rules captured as DL principles: the two-denomination meter that can't
  conflate ◇/⏱ (DL-4, IA-8) and the amber andon with four payloads + calm voice + non-red/non-chrome
  (DL-5, IA-9). ✅
- **AC#3** — grounded in the live emitted surfaces (a `Grounds in:` line per principle), an index
  line per principle, `bun run check:*` green doc-only. ✅

## Test coverage

No code changed, so no tests were added. The verification surface for a charter doc is conformance +
non-regression:

- `bun run check:typecheck` — clean.
- `bun run check:test` — **853 pass / 0 fail** (identical to pre-change; a doc cannot regress it).
- **Grounding integrity** — all six cited function names (`amber`, `formatWallet`, `formatStepSignal`,
  `renderReceipt`, `renderStaleBoard`, `formatWalkAwayFindings`) were verified present in `src/`
  during Research. This is the doc's real "test": if a future rename breaks a `Grounds in:` pointer,
  the doc is stale and must be fixed (anti-drift).

## Open concerns / known limitations

1. **Two honest gaps are documented, not closed.** DL-2 records that **dim** is today approximated by
   indentation (no ANSI-2 applied) and the **settle accent** has no live binding yet. These are named
   deliberately (the IA-doc habit of surfacing gaps), but they are real divergences between the
   charter's intent and the current CLI. The downstream TUI epic closes them; until then the doc is
   the contract, the CLI is a partial realization. **Not a defect — a flagged intent.**
2. **DL-4's target shape is aspirational.** The meter is honest *today* via distinct glyphs + units,
   but the "countdown vs fill — different shapes" target is not yet drawn anywhere (the CLI is one
   line of text). A reviewer should confirm they're comfortable shipping the *target* as charter
   before a surface implements it. (It is grounded in IA-8, which already states the principle.)
3. **`Grounds in:` is a new convention** not present in the IA doc. It is the anti-drift anchor that
   makes "fix one" checkable, but it also couples the doc to function names. If those functions are
   refactored, the pointers need maintenance. Low cost, high value — flagged for awareness.
4. **The card-as-lens decision is referenced but not stated here.** The preamble says cards stay a
   lens and *defers the explicit decision to T-029-02*. If T-029-02 slips, the charter is momentarily
   incomplete on that point. Acceptable per the story DAG (atoms → surfaces).

## Nothing critical for human attention

No source risk, no test regression, no irreversible action. The single judgment call worth a human
glance is concern #2 (shipping the meter's *target* shape as charter ahead of any surface drawing
it) — consistent with how the IA doc states IA-8.

## Handoff

T-029-02 appends DL-6… (Home/Counter/Ledger/production-line ASCII mocks + the explicit
card-as-lens-not-chrome decision) after the index seam and completes the index. The append target is
unambiguous (`(DL-6… surfaces — T-029-02)`), and the DAG serializes the write (T-029-01 → T-029-02),
so no concurrent-edit collision.
