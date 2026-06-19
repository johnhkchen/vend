# T-021-04 — Review: vocabulary-translation-layer

_Handoff doc: what changed, test coverage, open concerns. Enough to review without reading every
diff._

## What changed

Two new files, one commit (`d6d2ec1`). **No existing file modified or deleted.**

| File | LoC | Purpose |
|---|---|---|
| `src/present/translate.ts` | ~310 | The pure vocabulary policy + the spec-driven node projection. |
| `src/present/translate.test.ts` | ~210 | 20 pure tests incl. the AC contract over a `T-018-01` fixture. |
| `docs/active/work/T-021-04/{research,design,structure,plan,progress,review}.md` | — | RDSPI artifacts. |

### The shape delivered

`projectNode(node, spec, overlay?) → Card`. The spec is the router: a field lands on the **face**
iff its token is in `spec.face`, in the **details** bucket iff in `spec.details` — that is the
field-visibility knob, so the same node renders differently under `DESIGNER_PRESET` vs
`DEV_PRESET` through one code path.

Public surface: the policy (`JARGON_CLASSES`, `jargonTokens`, `scrubFace`, `CODE_PLAIN`,
`translateCode`); extractors (`extractCharterCodes/FileCites/BamlInternals`,
`rawAcceptanceCriteria`); face helpers (`humanizeTitle`, `stateChip`, `structuralBreakdown`); the
projection (`projectNode` + `PlainOverlay`/`FaceContent`/`DetailContent`/`Card` types); the verdict
seam (`faceText`, `faceJargon`).

### Three design decisions a reviewer should weigh

1. **Authored overlay, not synthesis (D1).** The §1c plain prose ("Build the brain…") cannot be
   derived from `steer-pure-core` + a jargon body by a pure function. So the layer **routes +
   guarantees** authored intent text and, absent an overlay, **omits** `why`/`breakdown` rather
   than inventing them (the `survey-core.ts` honest-empty discipline). The layer's code-worthy
   value is the deterministic no-jargon guarantee and the spec routing — both fully here.
2. **One classifier, two uses (D2/D3).** `JARGON_CLASSES` is the single source backing both
   `scrubFace` (write) and `jargonTokens`/`faceJargon` (read), so the scrubber and the leak
   predicate cannot drift. Class-based regex (not a literal word list) because each §1b family is
   open-ended (`P1`…`PE-7`, any `*.ts`).
3. **Default hide over translate (D4).** `CODE_PLAIN`/`translateCode` exist (§1b "translate or
   hide") but the default face path **hides** (scrubs); choosing which codes to surface is a
   spec/authoring call. `hidden ⊆ "zero codes on the face"`, so this satisfies the AC conservatively.

## Test coverage

`bun run check` green: **672 pass / 0 fail**, 1629 expect() calls (was 610 pre-module; +20 new,
zero regressions). All new tests pure (plain-object node fixtures, no fs/BAML).

- **Classifier** — `jargonTokens` finds every denylist representative deduped; `scrubFace` removes
  them, keeps clean prose, tidies wreckage (empty parens, doubled spaces, whitespace-only → "").
- **Extractors** — each pulls its class from the fixture body; `rawAcceptanceCriteria` slices the
  AC section and returns "" when absent.
- **Helpers** — `humanizeTitle` jargon-free; `stateChip` → "Done" (phase-aware) and bare-word
  fallback for unlabeled status, never `phase:`; `structuralBreakdown` counts children/deps.
- **Routing** — `DESIGNER_PRESET` emits four face fields; `DEV_PRESET` omits `why`; `details:[]`
  → empty bucket; no overlay → no invented `why`; the card is frozen (mutation throws).
- **AC contract (the headline block)** — `projectNode(T-018-01, DESIGNER_PRESET, §1c overlay)`:
  (1) face == §1c (plainTitle/state="Done"/why/breakdown exact); (2) `faceJargon` is `[]` AND each
  of `P5/PE-1/BAML/SAP/.ts/phase:done` absent from `faceText`; (3) those tokens reachable in
  `details` (charterCodes ⊇ {PE-1,R1,P5}, bamlInternals ⊇ {BAML,SAP}, fileCites ⊇ survey-core.ts,
  rawAcceptanceCriteria non-empty).

### Coverage gaps (honest)

- **No epic/story projection integration test.** `projectNode` is exercised end-to-end only on a
  ticket; `structuralBreakdown` is unit-tested for epic/story but the full epic/story → Card path
  isn't asserted. Low risk (same code path), but a reviewer wanting full confidence would add one.
- **`scrubFace` over-strip boundary** — the `filePath` class (`[\w./-]*\.ts`) is not exercised
  against a benign face word ending in `.ts`; none occurs in practice, but the boundary is untested.
- **No live-board test** — by design (the loader is T-021-01's concern; this layer takes a node).

## Open concerns / known limitations

1. **`mixed`/`technical` vocabulary is plumbed but not graduated.** `spec.vocabulary` is read into
   the spec but the face scrub is **unconditionally plain** for v1. A `mixed` face that shows
   *translated* codes and a `technical` face that shows *raw* dev tokens is a deliberate follow-on
   (design D-rejected for v1). The AC is a `plain`-face guarantee, which is met. **Flag for the
   next ticket if calibration needs the middle of the range.**
2. **Charter-code translation is unused on the face by default.** `CODE_PLAIN` covers only a few
   codes; surfacing translated principles is deferred to a renderer + the `mixed` vocabulary work.
3. **The overlay is per-call, not yet sourced.** Who authors/stores the `PlainOverlay` per node is
   out of scope here — likely a sibling of T-021-03's preset persistence, or an authored sidecar.
   Noted as the natural next integration seam.

## For the human reviewer

Nothing blocks merge. The AC is met and pinned by a contract test. The one judgment call worth a
look is **D1 (authored overlay vs synthesis)** — it accepts that plain prose is authored, not
generated, which is the honest division of labor but means a node with no overlay shows only a
humanized title + state + structural breakdown. If the product expects the layer to *generate*
plain titles, that is a scope change (and an impure one) to raise before building further.
