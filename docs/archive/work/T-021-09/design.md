# T-021-09 — Design: rubric-scorecard-probe

Decisions, with rejected alternatives, grounded in research.md. The shape: a **pure scoring
core** (`rubric.ts`) + an **impure probe harness** (`run-rubric-probe.ts`), the exact
consistency-probe split the AC names.

## D1 — Pure core scores, impure harness loads/renders/prints (the mandated split)

The AC says *"patterned on `run-consistency-probe.ts`"*. That file's own header pins the house
rule: the harness is **not unit-tested**; the tested judgment is the pure core. So:

- `src/probe/rubric.ts` — PURE: takes already-produced render data, returns a `Scorecard`.
  No fs/clock/network. The **only unit-tested half**. The AC's teeth (language fails on face
  jargon) live here, tested over `buildGraph` fixtures.
- `src/probe/run-rubric-probe.ts` — IMPURE harness: `loadWorkGraph()` → `projectGraph` →
  `renderPaper` → `scoreDesignerRubric` → print `formatScorecard`. CLI `import.meta.main`,
  read-only, NOT unit-tested (header says so, mirroring `run-consistency-probe.ts`).

**Rejected:** one impure file doing both. It would force the AC's mechanical-language test to
touch fs and violate the established split — and the AC explicitly invokes the split pattern.

## D2 — The core scores `(render: string, projection: Projection)` — both views

Resolves research Q1. The five dimensions divide cleanly along two views:

- **Face-level** (per `Card`): comprehension, density, **language** — naturally read the
  `Projection`'s cards (`faceJargon`, `faceText`, present face fields).
- **Artifact-level**: structure (the Mermaid tree is emitted), navigability (the section
  headings are present; links resolve) — naturally read the rendered string + the projection's
  links.

So the pure entry is `scoreDesignerRubric(render: string, projection: Projection): Scorecard`.
Both inputs are pure values the harness already builds (`renderPaper`, `projectGraph` on
`DESIGNER_PRESET`). This is the faithful reading of "scores the designer render" — the render
is the artifact, the projection is its structured source, and the scorer sees both.

**Rejected — projection only:** loses the artifact-level wayfinding checks ("does the render
actually carry its headings / tree fence") which is half of what "navigability/structure"
mean for a human. **Rejected — render string only:** the language gate would have to re-parse
face lines out of Markdown (brittle, coupled to paper.ts's `> **` format). `faceJargon` over
the structured `Card` is robust and is *the existing predicate the AC names*.

## D3 — `faceJargon` IS the language gate (reuse, do not reinvent)

Research found `faceJargon(card): string[]` already exists in translate.ts, documented as the
predicate *"which MUST be empty for any spec/overlay"*. The language dimension is exactly:

> language **fails** iff `∃ card. faceJargon(card).length > 0`.

The core imports `faceJargon` (pure) and folds it across `projection`'s cards. The failing
tokens (with their card ids) are the dimension's evidence (IA-8). Because `scrubFace` cleans
every face on the write side, a real designer render passes; the probe is the **independent
check** that the one-classifier-two-uses guarantee (translate.ts D2/D3) held end-to-end.

**Rejected — a second jargon regex in the probe.** Two sources of "what is jargon" would
drift. The whole translate.ts design is one shared `JARGON_CLASSES`; the probe joins that, it
does not fork it.

## D4 — Each dimension is mechanical, deterministic, and non-vacuous

Resolves research Q2/Q3. Every dimension yields a `DimensionScore`:
`{ dimension, score: 0..1, pass: boolean, detail: string, failures: string[] }`. Definitions:

- **language** (hard, AC-pinned): `pass = no card has face jargon`. `score = clean/total`
  cards; `failures = ["T-x: PE-1, foo.ts", ...]`. Empty board → vacuous pass (score 1, no
  cards).
- **comprehension**: a card is comprehensible iff it has a non-empty **plain title** AND a
  **state** chip (the minimum to know *what* and *where it stands* without dev context).
  `pass = all cards comprehensible`; `failures` lists cards missing either. Vacuous pass when
  no cards.
- **density**: appropriate to the projection's declared `density` knob. Mechanical proxy: each
  card's **face character volume** (length of `faceText(card)`) ≤ the per-density budget
  (`{ low: 240, medium: 480, full: Infinity }`). A terse designer (low) face passes; a wall of
  prose on a low-density card fails. `failures` lists over-budget cards with their char counts.
- **structure**: the decomposition is legible. Mechanical: the render contains the Mermaid
  fence (` ```mermaid ` + `graph TD`) AND every projection group carries a non-empty `label`.
  `pass` = both. Empty board still emits the tree fence with one `nothing here` → vacuous pass.
- **navigability**: you can find your way. Mechanical: the render carries its three section
  headings (`Designer view`, `Card faces`, `Founder/director view`) AND no projection link
  dangles (every `from`/`to` resolves to a projected card id). `pass` = both. A board with no
  deps has zero links → no dangling → pass.

`score` is a 0..1 fraction where a fraction is natural (clean-card ratio, in-budget ratio),
else 1/0 for the boolean artifact checks — so the headline number degrades gracefully and the
`failures` array carries the truth (IA-8).

**Rejected — per-field-count density cap.** Designer routes all four face fields, so a
field-count cap either flags the designer preset itself or is a vacuous no-op (research showed
both). Character volume is the meaningful "too much per card" signal and leaves the legitimate
designer face passing. **Rejected — model-judged comprehension/navigability.** The AC says
*mechanically*; a deterministic proxy keeps the probe pure, fast, and P5-consistent.

## D5 — Scorecard = the five dimensions + an overall "good enough" verdict

`Scorecard = { dimensions: readonly DimensionScore[]; pass: boolean }`, where
`pass = dimensions.every(d => d.pass)` — the "good enough" gate (rubric-pass). A pure builder
`scoreDesignerRubric(render, projection)` assembles it; a pure `formatScorecard(card): string`
prints one line per dimension (`✓/✗ name — detail`) plus a headline `good enough: yes/no`,
mirroring `formatConsistencyReport`'s honest one-liner.

## D6 — `RUBRIC_DIMENSIONS` as a closed-set `as const` (the house idiom)

`export const RUBRIC_DIMENSIONS = ["comprehension","structure","density","language",
"navigability"] as const` → `type RubricDimension = (typeof RUBRIC_DIMENSIONS)[number]`. The
single source of the five names; the scorecard always carries all five, in this order
(spec.ts/consistency.ts `PROBE_OUTCOMES` precedent).

## D7 — Harness: read-only, designer-only, prints to stdout, exits clean

`run-rubric-probe.ts` loads the live board (or an optional `[root]` arg, like
`run-consistency-probe.ts`'s redirectable input), projects + renders under `DESIGNER_PRESET`,
scores, prints `formatScorecard`, and `process.exit(0)`. It writes nothing — no temp root is
needed (unlike the casting probes) because scoring a render has no side effects. It references
`docs/active` only in its header comment (provenance), importing only `loadWorkGraph` (the
read-only seam) — so `authority-guard` stays green (T-021-07 invariant).

**Rejected — exit non-zero on a failing scorecard.** v1 the probe is an *instrument* a human
reads (the run-probe.ts stance), not a CI gate; a non-zero exit would conflate "I ran" with "I
judged the board good enough". Keep it a reporter; wiring it into `check:*` is a later ticket.
