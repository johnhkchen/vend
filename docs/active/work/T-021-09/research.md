# T-021-09 — Research: rubric-scorecard-probe

Descriptive map of the codebase as it bears on standing up a "good enough" rubric
scorecard probe over the rendered designer preset. No solutions here — that is design.

## The ticket, restated

- Stand up the 'good enough' scorecard as a **probe over the rendered designer preset** —
  five dimensions: **comprehension, structure, density, language, navigability**.
- Mirror the existing **consistency-probe harness** (`src/probe/run-consistency-probe.ts`).
- AC: a probe **patterned on `run-consistency-probe.ts`** scores the designer render across
  the five dimensions and emits a **per-dimension scorecard**; the **language** dimension
  **mechanically fails on any untranslated-jargon token on a face**.
- Advances: P1, rubric-pass.

## The probe family (the pattern to mirror)

`src/probe/` holds two probe pairs, each a **pure core + impure harness** split:

- `variance.ts` (pure) ↔ `run-probe.ts` (impure). The original paired gated-vs-ungated
  consistency probe (T-014). `variance.ts` is the only unit-tested half.
- `consistency.ts` (pure) ↔ `run-consistency-probe.ts` (impure). The any-play, single-arm
  generalization (T-019). `consistency.ts` is the only unit-tested half.

The **house rule is explicit** in both harness headers: the `run-*.ts` harness is *NOT
unit-tested* — its impure verbs (fs, casting) are proven live; the tested judgment is the
pure core (`consistency.test.ts`, `variance.test.ts`). The classification/judgment that the
AC needs teeth on therefore belongs in a **pure core**, with the harness only loading the
live board, rendering, calling the core, and printing.

### Pure-core anatomy (`consistency.ts`, the closest analogue)

- Defines a closed-set vocabulary of outcomes (`PROBE_OUTCOMES = [...] as const`) → a derived
  union type, the spec.ts/as-const idiom.
- A result record (`ProbeResult`) the impure harness fills and hands in.
- A report type (`ConsistencyReport`) + a pure builder (`consistencyReport(results)`).
- A pure formatter (`formatConsistencyReport(r): string`) — one honest line.
- PURE: no fs/clock/network/process. Imports only another pure module (`variance.ts`).
- Zero-safety discipline: rates defined as 0 (never NaN) on an empty set; honest caveats
  when an arm is too small to be meaningful (IA-8 — "the meter must not lie").

### Impure-harness anatomy (`run-consistency-probe.ts`)

- `if (import.meta.main)` CLI entry parsing `Bun.argv`, usage to stderr, `process.exit`.
- Seeds/loads its fixed input, runs the work, classifies each result, hands the labelled
  list to the pure core, prints `formatConsistencyReport` + a raw tally.
- Writes only to a disposable temp root (no-pollution invariant). Reads the live repo.

## The render under test (the designer preset)

The thing the probe scores is produced by the landed E-021 data/presentation split:

- `src/present/spec.ts` — `PresentationSpec` (7 knobs) + `DESIGNER_PRESET` (the canonical
  designer spec: `vocabulary: plain`, `density: low`, all four face fields, `groupBy: story`,
  `metaphor: tree`, `colorLanguage: leverage`, status labels). `validateSpec`/`parseSpec`.
- `src/present/translate.ts` — per-node projection into a `Card` (scrubbed `face` + dev
  `details` bucket). **Key for this ticket:**
  - `JARGON_CLASSES` — the single source of "what is jargon" (charter codes, BAML/SAP, `*.ts`
    file paths, raw `phase:` tokens) as named regexes.
  - `jargonTokens(text)` — every jargon token in a string (read side).
  - `faceText(card)` — all present face strings joined.
  - **`faceJargon(card): string[]`** — the AC predicate: jargon that leaked onto the face,
    *"which MUST be empty for any spec/overlay"*. This is the mechanical language gate already
    sitting in the codebase, returned as data (the budget.ts rule), never thrown.
  - `scrubFace` is the write side — every face string passes through it, so a clean render's
    `faceJargon` is empty by construction. The probe is the **independent verifier** that the
    guarantee held.
- `src/present/project.ts` — `projectGraph(graph, spec, overlays?) → Projection`. The
  `Projection` is the structured form of the render: `groups` (each `{key, label, cards}`),
  `links` (`depends_on` edges), and echoed knobs (`density`, `colorLanguage`, `metaphor`,
  `groupBy`). Each `ProjectedCard = { card, color }`. Deeply frozen; graph reference-unchanged
  (one-way authority).
- `src/present/paper.ts` — `renderPaper(graph, spec, opts?) → string`. The MCP-independent
  paper artifact: a preset header, the **designer view** (`## ◤ Designer view —` Mermaid tree
  + `### Card faces` blockquotes), and the **founder/director brief** (`## ◤ Founder/director
  view —` themes table). Pure string building. Faces render as `> **title** · chip` blocks;
  the tree is a fenced ```mermaid` graph TD`. The IA-4 placeholder is the literal
  `nothing here`.

## The live board input

- `src/graph/load.ts` — `loadWorkGraph(opts?) → Promise<WorkGraph>`. The single impure,
  **read-only** verb (imports `readFile`/`readdir` only) that reads `docs/active/**` into the
  pure graph. Defaults to the live repo; redirectable for fixtures. `paper.test.ts` already
  uses it for its live-board AC.
- `src/graph/model.ts` — `buildGraph(epics, stories, tickets)` from `RawNode`s; `WorkGraph`
  (`epics`, `stories`, `tickets`, `byId`); `deepFreeze`. The test fixtures in
  `paper.test.ts`/`project.test.ts` build genuine frozen graphs via `buildGraph` (the mould to
  reuse for pure-core tests).

## Constraints & invariants in scope

- **One-way authority (E-021):** the probe READS the graph/render and never writes a node.
  Enforced live by `src/present/authority-guard.ts` (T-021-07): a static classifier that fails
  any `src/present` (and probe) source that both imports a write primitive AND references
  `docs/active` in *executable* (comment-stripped) code. The probe must reference `docs/active`
  only in header comments (provenance), exactly as every present module does, and must not
  import any fs writer. `loadWorkGraph` is the read-only seam.
- **House testability split:** the impure harness is not unit-tested; the AC's teeth live in a
  pure core test (`buildGraph` fixtures, no fs).
- **`check:committed` gate (D-005):** any uncommitted `src/` file blocks any thread from
  stopping. New probe files must be committed. The gate polices presence, not test coverage.
- **IA-4 / honest-empty:** an empty board renders `nothing here`; the scorer must treat an
  empty render as a vacuous pass per dimension, never a fabricated failure or success.
- **IA-8 / the meter must not lie:** scores carry their evidence (failing card ids, counts);
  a vacuous pass (no cards) must read as such, not as a clean win.
- **P5 determinism:** the render and the projection are byte-deterministic; the score over them
  must be too (no clock/random).

## Open questions carried to design

1. Does the pure scorer read the **render string**, the **`Projection`**, or both? (Language
   is naturally a face/`Card` check via `faceJargon`; structure/navigability are naturally
   artifact-level — headings, tree fence.)
2. How are the four non-language dimensions made **mechanical** (deterministic, not a model
   judgment) without becoming vacuous no-ops?
3. Pass semantics: per-dimension boolean + overall "good enough" = all pass? How to keep the
   language gate the hard, AC-pinned one while the others stay honest proxies.
