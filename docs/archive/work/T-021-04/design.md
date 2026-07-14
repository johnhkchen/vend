# T-021-04 — Design: vocabulary-translation-layer

_Options, tradeoffs, the decision and its rationale. Grounded in research.md, not assumptions._

## The decision in one line

A **pure projection function** `projectNode(node, spec, overlay?) → Card`, where `Card` carries a
jargon-scrubbed **face** (only the `spec.face` tokens) and a dev-layer **details** bucket (only the
`spec.details` tokens). The vocabulary policy is a closed-set **jargon classifier + scrubber +
charter-code translation table**; the field-mapping is **spec-driven routing**; the plain prose is
supplied by an optional **authored overlay** (honest-empty fallback). New file
`src/present/translate.ts`, pure, mirroring `spec.ts`/`gates.ts`.

## D1 — Where does the plain prose come from?

The AC says "emit the plain face from prep §1c", whose face reads "_Build the brain that reads a
project and proposes real choices_". research.md established this **cannot be derived** from
`steer-pure-core` + a jargon body by any pure function.

- **Option A — derive plainly (humanize the kebab title).** `steer-pure-core → "Steer pure core"`.
  Pure, zero authored data. But it does **not** produce the §1c face — fails the AC literally, and
  produces a worse face than the dev title it started from.
- **Option B — synthesize via BAML/LLM.** Could produce §1c prose. But it is impure (native
  addon, non-deterministic), breaks the pure-core rule, and a translation layer that calls a model
  on every render is the wrong altitude. Rejected hard.
- **Option C — authored plain overlay (CHOSEN).** The plain prose is **human-authored intent
  text** (it already exists, in §1c and the mock). The layer accepts an optional
  `PlainOverlay { plainTitle?, why?, breakdown? }` and **routes + guarantees** it. When no overlay
  is supplied, the face falls back to the **humanized title** for `plain_title` and **omits**
  `why`/`breakdown` (honest-empty — never invent prose, the `survey-core.ts` discipline).

**Chosen: C.** It is the only option that both honors the pure-core rule and can reproduce §1c.
It is also honest about the division of labor: prose is authored once (paid at authoring, the Vend
thesis); the layer's value is the **deterministic guarantee** that no jargon leaks and the
**spec-driven routing** of every field — work that genuinely must be code.

## D2 — How is the no-jargon guarantee enforced?

The AC's teeth: "zero tokens from a denylist appear on the face." Two ways to guarantee it.

- **By construction only** — build the face solely from clean sources (overlay + labels +
  structural counts), so jargon never has a path onto the face. Simple, but brittle: an overlay
  author can paste a charter code into `why`, and nothing catches it.
- **Active scrubber (CHOSEN, in addition).** Every string written to the face passes through
  `scrubFace(text)`, which strips every jargon token (per the classifier) and collapses
  whitespace. The face is clean **even if** an overlay slips. The same classifier backs a
  `faceJargon(card): string[]` predicate — the verdict-not-throw seam — that the AC test asserts
  empty.

**Chosen: build-clean AND scrub.** Defense in depth, and the scrubber is the reusable core of the
vocabulary policy (it _is_ §1b expressed as code). The classifier is the single source of truth
for both "what to strip from the face" and "what to assert absent."

## D3 — The jargon classifier (the denylist as closed-set policy)

A set of named regex classes, `as const`, mirroring `spec.ts`'s closed-set tuples. Each class maps
a §1b jargon family to a pattern. Covering the AC denylist + §1b:

| Class | Pattern (intent) | Denylist hit |
|---|---|---|
| `charterCode` | `\b(?:P\d+\|PE-\d+\|IA-\d+\|R\d+)\b` | `P5`, `PE-1` |
| `bamlSap` | `\b(?:BAML\|SAP)\b` | `BAML`, `SAP` |
| `filePath` | `\b[\w./-]*\.ts\b` and `\bbaml_src/\S*` | `*.ts` (`survey-core.ts`) |
| `phaseRaw` | `\bphase:\s*\w+\b` (+ bare RDSPI phase words behind a `phase:` prefix) | `phase:done` |

`jargonTokens(text): string[]` runs every class and returns all matches (deduped, in order) — the
classifier's read side. `scrubFace(text)` runs every class as a replace and tidies whitespace —
its write side. **One classifier, two uses**, so the predicate and the scrubber can never drift.

_Why regex over a literal denylist of words?_ The denylist is **open-ended within a class** —
there are many charter codes (`P1`…`PE-7`…`IA-9`) and infinitely many `*.ts` paths. A class-based
pattern captures the family; a literal list would miss `PE-2`. The AC names representatives
(`P5`/`PE-1`), not an exhaustive list — classes generalize correctly.

## D4 — Charter-code translation table (§1b: "translate to the plain idea, or hide")

§1b offers two dispositions for a charter code: **translate** to the plain idea, or **hide**. The
face never shows the code either way. A small `as const` table maps known codes to their plain
idea (`PE-1 → "every suggestion traces to something real — no invented work"`, from §1b verbatim).
`translateCode(code): string | null` returns the plain idea or `null` (→ hide). This is exported
for a future renderer that wants to _surface_ a translated principle on the face deliberately; the
**default face path hides** (scrub) rather than translates, because translation requires choosing
_which_ codes matter — an authoring/spec decision, not the layer's. Keeping the table but
defaulting to hide is the conservative, AC-satisfying choice (hidden ⊆ "zero codes on the face").

## D5 — Field-mapping = spec-driven routing into two buckets

`projectNode` honors the spec as the router:

- **Face** — for each token in `spec.face` (∩ `FACE_FIELDS`), emit the corresponding field:
  - `plain_title` → `scrubFace(overlay.plainTitle ?? humanizeTitle(node.title))`
  - `why` → `scrubFace(overlay.why)` if present, else omitted (honest-empty)
  - `state` → the **state chip**: `spec.labels.status[node.status] ?? node.status`, never raw
    `phase:done`. (§1a: "one visual state chip … no `phase:done` raw".)
  - `breakdown` → `scrubFace(overlay.breakdown)` if present, else a **structural** summary
    (epic → "N stories"; story → "N tickets"; ticket → "depends on N · blocks M"), always plain.
- **Details** — for each token in `spec.details` (∩ `DETAIL_FIELDS`), extract from `node.body`:
  - `charter_codes` → `extractCharterCodes(body)` (deduped, in appearance order)
  - `file_cites` → `extractFileCites(body)`
  - `baml_internals` → `extractBamlInternals(body)` (BAML/SAP/`b.request`/`b.parse` mentions)
  - `raw_acceptance_criteria` → the verbatim `## Acceptance Criteria` section (or `""`)

A token absent from `spec.face`/`spec.details` produces no field — that **is** the field-visibility
knob. `DEV_PRESET` (face omits `why`) and `DESIGNER_PRESET` (face has all four) therefore project
the same node differently, with the same code path — exactly E-021's "same graph, many renders."

## D6 — Output shape: a typed `Card`, not a rendered string

The layer returns structured data, not markdown:

```
interface Card { id; kind; face: FaceContent; details: DetailContent }
interface FaceContent   { plainTitle?; why?; state?; breakdown? }     // strings, all scrubbed
interface DetailContent { charterCodes?; fileCites?; bamlInternals?; rawAcceptanceCriteria? }
```

Optional fields, present iff the spec routed them. Rejected: returning a pre-rendered face string —
that bakes in a metaphor/density the renderer owns, and makes the AC ("tokens on the face") test a
string-grep instead of a structural assertion. A typed Card keeps the layer at the translation
altitude and lets `faceText(card)` join face strings for the leak predicate.

## What is explicitly rejected / deferred

- **No rendering** (Mermaid/Linear/TUI/color/grouping) — downstream of this layer.
- **No graph mutation** — read-only; E-021 one-way authority.
- **No YAML/fs** — pure; the spec arrives already validated (T-021-02), the node already built
  (T-021-01). Persisting tuned specs is T-021-03's `presets.ts`.
- **`mixed`/`technical` vocabulary nuance** — `spec.vocabulary` is plumbed but the face scrub is
  unconditional (plain) for v1; graduated leak (mixed shows translated codes, technical shows raw)
  is a follow-on. Noted as a known limitation, not built — the AC is a `plain`-face guarantee.
