# T-029-01 — Design: visual-atoms

The direction is **fixed** (clean-typographic, human-set). So this is not a "which look" decision —
it is a decision about the **shape of the atoms doc**: how many principles, how the palette and type
hierarchy are expressed without becoming a hex/pixel spec, and how the two load-bearing rules (the
meter, the andon) are written so they encode the *honest* constraints, not decoration. Every option
is judged against the research: it must formalize the **live look** and mirror the IA-doc shape.

## Decision 1 — The atom count and boundary with T-029-02

**Options**

- **(A) Five atoms** — DL-1 governing restraint · DL-2 palette · DL-3 type hierarchy · DL-4 meter ·
  DL-5 andon. Surfaces (Home/Counter/Ledger/production-line mocks + card-as-lens) become DL-6… in
  T-029-02.
- **(B) Three atoms** — fold palette + type hierarchy into DL-1; meter + andon into one "honest
  rules" principle.
- **(C) Seven+ atoms** — split palette into per-tone principles, type hierarchy into per-lever
  principles.

**Choice: (A) five atoms.** It maps 1:1 onto the ticket's four required captures (governing
principle, palette, type hierarchy, and the *two* honest rules counted separately) — the AC literally
enumerates "the two honest rules … as DL principles," which forces meter and andon to be **distinct**
numbered atoms (DL-4, DL-5), ruling out (B). (C) over-fragments: the IA doc keeps each concern to one
principle (IA-9 is *one* andon principle, not five), and the anti-stale contract rewards fewer, denser
invariants. Five is the smallest set that gives each ticket-required atom its own citable number and
leaves a clean DL-6 boundary for the surfaces ticket.

Boundary with T-029-02: **this ticket creates `design-language.md` with the preamble + DL-1…DL-5 +
a partial index**; T-029-02 appends DL-6… (the surfaces) and completes the index. Rejected
alternative: T-029-01 writes only a fragment file and T-029-02 assembles — but the IA-doc shape is a
single growing file, and creating it now lets the atoms be cited immediately. The story DAG
(atoms → surfaces, T-029-01 → T-029-02) makes the append order safe (no concurrent write).

## Decision 2 — How to express the palette (DL-2) without a hex spec

**Options**

- **(A) Tone → meaning → binding table.** Each tone gets *what it means* + *how it is rendered in
  the terminal's levers* (e.g. amber = the andon = ANSI 33; dim = metadata = ANSI 2 / indent), no RGB.
- **(B) Prose only** — describe meanings in paragraphs, no binding.
- **(C) Full hex/256-color palette** — concrete values per tone.

**Choice: (A) the meaning→binding table, no hex.** The ticket is explicit: "what each tone *means*,
not a hex spec." (C) is a non-goal (the epic names "a full component/widget library or theming engine"
out of scope, and color-accessibility audit is deferred). (B) loses the load-bearing fact that the
charter is *grounded in code* — the one real binding that exists (amber = ANSI 33, and nothing else)
is the proof the palette is honest, so it must be named. (A) records the *meaning* (the durable part)
and the *current binding* (the grounding) while staying principle-level: "amber = the andon" is the
invariant; "= `\x1b[33m`" is the live anchor, flagged as the current realization not a frozen value.

The five tones, fixed by the ticket: **amber** (the andon, the single reserved saturated color, and
*nothing else*) · **default foreground** (content + in-flight) · **dim/muted** (metadata, envelopes,
secondary) · **a quiet settle accent** (a clean finish) · **never red, ever** (a stop is a successful
refusal, not an error — IA-9). The settle accent is the one tone with no live binding yet (the receipt
is currently plain default on a clean stop); DL-2 names it as intent and flags it honestly.

## Decision 3 — How to write the type hierarchy (DL-3)

**Options**

- **(A) Lever-by-lever**: enumerate the terminal's levers (case, weight, dim, indent, whitespace,
  glyph) and state how each is *spent* to make the recommendation lead and the shelf/detail recede.
- **(B) Region-by-region**: describe the hierarchy per surface (Home, Counter…). — but that is the
  *surfaces* ticket's job (T-029-02), and would duplicate it.

**Choice: (A) lever-by-lever.** It is the atom: a small, durable vocabulary the surfaces ticket then
*composes*. Grounded directly in the research — the live surfaces already carry hierarchy through
**indent** (4-space meter under the production line, `└` sub-reading under the headline rate) and
**glyph weight** (`▶`/`✓`/`⚠` lead at column 0). DL-3 names the levers and the rule: *type
hierarchy + whitespace carry the information; chrome is the exception.* It also records the honest
constraint — a terminal has almost no type to spend, so each lever must be used deliberately, and
**dim is today approximated by indent** (no ANSI-2 applied yet), a gap named not hidden.

## Decision 4 — DL-4 (the meter) — encode the two-denomination honesty

This is load-bearing, not decoration (the AC calls it out). The principle must state that **◇ and ⏱
are drawn so the meter cannot conflate them** (IA-8). Grounded in `formatWallet`: distinct glyphs
already (`◇` detect-after burn, `⏱` hard-wall countdown). The design decision is **how honest to be
about the current text**: today both denominations share the shape `spent/funded · left`.

**Choice:** DL-4 states the *invariant* (the two denominations are never one bar; ⏱ is a countdown
to a hard stop, ◇ is a burn-vs-envelope that can trip the andon *late*) **and** records the current
realization honestly — distinct glyphs + units today (the minimum-honest form), with the richer
"countdown vs fill" *shapes* as the target a TUI implements. This matches the IA-doc habit of naming
the gap (IA-8 itself cites the live 108.9k/60k overshoot). Rejected: stating only the ideal and
pretending the code already draws two shapes (that would let doc and code drift — the contract bans it).

## Decision 5 — DL-5 (the andon) — the four payloads + non-red/non-chrome treatment

**Choice:** DL-5 restates IA-9's andon as a *visual* principle: **amber, calm/protective voice,
carrying its four things** (which gate · what survived · why · the next pull), set apart by
**typographic means, not red and not chrome** — amber on the headline only, metadata receding by
indent, whitespace as the divider. Grounded in `renderStaleBoard` (the live andon that already
carries all four payloads) and the `amber()` helper's "NEVER red" invariant. The "without red/chrome"
clause is the differentiator from a conventional error box: the andon sets itself apart by *tone +
restraint*, which is the whole DL-1 thesis applied to the most design-laden moment.

## Decision 6 — Reference grounding: an index line per principle

The ticket asks for "a short index line per DL principle (the IA doc's index pattern)" and grounding
"in the live emitted surfaces." **Choice:** each DL principle ends with a one-line **`Grounds in:`**
pointer naming the live function/surface it formalizes (e.g. DL-4 → `formatWallet`; DL-5 →
`renderStaleBoard` / `renderReceipt`). This is the anti-stale anchor: a principle that names its live
surface can be checked against it, and "fix one, don't drift" has a concrete referent. The doc also
closes with the IA-style one-line index (`DL-1 clean-typographic-restraint · DL-2 palette …`).

## What is rejected, summarized

- **Re-opening the direction** — fixed (clean-typographic). Not in scope.
- **Hex / 256-color palette, component library, theming engine** — epic non-goals.
- **Per-surface hierarchy / ASCII mocks of Home/Counter/Ledger** — T-029-02's job; this ticket would
  collide with it (the missing-dependency-edge smell). Atoms only here.
- **Hiding the meter/dim gaps** — the IA doc names gaps; so does this. Honesty is the brand (DL-1).

## The resulting atom set (input to Structure)

DL-1 clean-typographic restraint (governing) · DL-2 palette/tone meanings (amber-reserved, default,
dim, settle accent, never-red) · DL-3 type hierarchy from terminal levers · DL-4 the two-denomination
meter that cannot lie (IA-8) · DL-5 the amber andon — four payloads, calm voice, non-red/non-chrome
(IA-9). Each grounded in a named live surface; a partial index; the IA-doc preamble (purpose +
anti-drift clause + lens-scoping). Surfaces (DL-6…) deferred to T-029-02.
