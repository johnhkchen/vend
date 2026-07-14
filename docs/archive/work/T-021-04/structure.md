# T-021-04 — Structure: vocabulary-translation-layer

_The blueprint — files, boundaries, public interface, internal organization, ordering. Not code;
the shape of the code._

## Files

| File | Change | Purpose |
|---|---|---|
| `src/present/translate.ts` | **create** | The pure vocabulary policy (classifier + scrubber + code table) + the spec-driven `projectNode` projection into a face/details `Card`. |
| `src/present/translate.test.ts` | **create** | Pure tests: classifier/scrubber units, extractors, `projectNode` routing, and the **AC integration** over a `T-018-01` fixture. |

New code only. **No existing file is modified or deleted.** `spec.ts` and `graph/model.ts` are
imported **type-only** (erased at runtime, keeping the module pure). Disjoint from T-021-03's
`src/present/presets.ts` — no shared edit, no concurrency edge.

## `src/present/translate.ts` — internal organization (top → bottom)

Order mirrors `spec.ts` / `gates.ts`: header doc → type-only imports → closed-set policy constants
→ classifier (read + write) → code-translation table → body extractors → face/state helpers →
the `Card` types → the `projectNode` projection → the `faceText`/`faceJargon` verdict seam.

### 1. Module header (the house discipline)

States: this is the **vocabulary-translation / field-mapping** leg of E-021's data/presentation
split (the prep §1a/§1b/§1c render contract); **pure** (no fs/clock/network/native addon — type-
only graph+spec imports), so the test is an ordinary pure-function test; the plain prose is
**authored** (overlay), the layer **routes + guarantees** (the honest-empty discipline — never
invent prose); the **classifier is one source** feeding both the scrubber (write) and the leak
predicate (read), so they cannot drift; reads the graph, **never edits it** (one-way authority).

### 2. Type-only imports

```
import type { EpicNode, StoryNode, TicketNode, AnyNode } from "../graph/model.ts";
import type { PresentationSpec, FaceField, DetailField } from "./spec.ts";
```

No value imports from those modules → zero runtime coupling to the BAML addon or fs.

### 3. Closed-set policy constants (the §1b denylist as `as const`)

```
export const JARGON_CLASSES = {
  charterCode: /\b(?:P\d+|PE-\d+|IA-\d+|R\d+)\b/g,
  bamlSap:     /\b(?:BAML|SAP)\b/g,
  filePath:    /\b[\w./-]*\.ts\b|\bbaml_src\/\S*/g,
  phaseRaw:    /\bphase:\s*\w+\b/g,
} as const;
export type JargonClass = keyof typeof JARGON_CLASSES;
```

One named regex per §1b family. The single source of "what is jargon." (Regex literals are
recreated per call inside the functions to avoid `lastIndex` state from the `g` flag — see §4.)

### 4. The classifier — read and write (one policy, two uses)

- `jargonTokens(text: string): string[]` — run every class over `text`, collect all matches,
  **dedupe preserving first-appearance order**. The read side; the leak predicate's engine. Builds
  fresh `RegExp`s from `.source`/`.flags` per call (no shared `lastIndex`).
- `scrubFace(text: string): string` — run every class as `.replace(…, "")`, then collapse runs of
  whitespace and trim, and tidy now-dangling punctuation (`"(", " ,"`) left by removed tokens. The
  write side; every face string passes through it. Empty/whitespace input → `""`.

### 5. Code-translation table (§1b: translate or hide)

```
export const CODE_PLAIN: Readonly<Record<string, string>> = {
  "PE-1": "every suggestion traces to something real — no invented work",
  // … the codes prep §1b names; absent code → null (hide)
};
export function translateCode(code: string): string | null
```

Exported for a future renderer; the default face path **hides** (D4), so this is not on the AC path
but documents the policy and is unit-tested for the known/unknown branches.

### 6. Body extractors (route dev content → details)

All pure, all operate on `node.body`:

- `extractCharterCodes(body): string[]` — `jargonTokens` filtered to the `charterCode` class
  (deduped, appearance order).
- `extractFileCites(body): string[]` — the `filePath` class matches.
- `extractBamlInternals(body): string[]` — the `bamlSap` class plus `b.request`/`b.parse.\w+`
  call mentions.
- `rawAcceptanceCriteria(body): string` — slice from the `## Acceptance Criteria` heading to the
  next `## ` (or end); `""` when absent.

### 7. Face / state helpers

- `humanizeTitle(title: string): string` — kebab → sentence case (`steer-pure-core → "Steer pure
  core"`), then `scrubFace`. The `plain_title` fallback when no overlay.
- `stateChip(node, spec): string` — `spec.labels.status[node.status] ?? node.status`. Never emits
  `phase:done` (it reads `status`, and even if a label is missing the raw value is a bare word like
  `done`, not the `phase:` form). The §1a state chip.
- `structuralBreakdown(node): string` — `epic → "N stories"`, `story → "N tickets"`,
  `ticket → "depends on N · blocks M"` (omit a zero clause). Always plain.

### 8. Card types (the output, D6)

```
export interface PlainOverlay { plainTitle?; why?; breakdown?; }      // authored intent text
export interface FaceContent   { plainTitle?; why?; state?; breakdown?; }   // all strings scrubbed
export interface DetailContent { charterCodes?; fileCites?; bamlInternals?; rawAcceptanceCriteria?; }
export interface Card { readonly id: string; readonly kind: AnyNode["kind"];
                        readonly face: FaceContent; readonly details: DetailContent; }
```

All fields `readonly`/optional; a field is present iff the spec routed it.

### 9. `projectNode` — the projection (the one public entry)

```
export function projectNode(node: AnyNode, spec: PresentationSpec, overlay?: PlainOverlay): Card
```

- Build `face`: for each `t` in `spec.face`, set the field per D5 (`plain_title`, `why`, `state`,
  `breakdown`); skip a token absent from the spec; omit `why`/`breakdown` when neither overlay nor
  structure supplies content (honest-empty). Every emitted string is `scrubFace`'d.
- Build `details`: for each `t` in `spec.details`, run the matching extractor; omit empty results
  (`[]`/`""`) so the bucket carries only present dev content.
- Return a frozen `Card` (`Object.freeze` face/details/card — the `model.ts`/`spec.ts` idiom).

### 10. Verdict seam (verdict-not-throw)

- `faceText(card): string` — join all present `face` strings with `" "` (the surface the human
  reads). The AC's "the face" as one string.
- `faceJargon(card): string[]` — `jargonTokens(faceText(card))`. The AC predicate: **must be empty**
  for any spec/overlay. Returned data, never a throw.

## Public interface (exports)

```
// policy
JARGON_CLASSES, type JargonClass, jargonTokens, scrubFace
CODE_PLAIN, translateCode
// extractors
extractCharterCodes, extractFileCites, extractBamlInternals, rawAcceptanceCriteria
// face helpers
humanizeTitle, stateChip, structuralBreakdown
// projection
type PlainOverlay, type FaceContent, type DetailContent, type Card, projectNode
// verdict seam
faceText, faceJargon
```

## `src/present/translate.test.ts` — coverage blueprint

`import { describe, expect, test } from "bun:test";` + the translate exports + `DESIGNER_PRESET`,
`DEV_PRESET` from `./spec.ts`. A `T-018-01` `TicketNode` fixture is built **inline** as a plain
object literal (mirroring the real frontmatter + body — body carries `R1`, `PE-1`, `BAML`, `SAP`,
`survey-core.ts`, an `## Acceptance Criteria` section), no fs.

- **classifier** — `jargonTokens` finds `P5`/`PE-1`/`BAML`/`SAP`/`survey-core.ts`/`phase:done` in a
  mixed string; dedupes; `scrubFace` removes every one and leaves clean prose; empty in → empty out.
- **extractors** — each pulls its class from the fixture body; `rawAcceptanceCriteria` slices the
  AC section; absent section → `""`.
- **helpers** — `humanizeTitle("steer-pure-core")` is jargon-free; `stateChip` maps `done → "Done"`
  via `DESIGNER_PRESET.labels`, and an unlabeled status falls back to the bare word (never
  `phase:done`); `structuralBreakdown` counts children.
- **projectNode routing** — `DESIGNER_PRESET` emits all four face fields; `DEV_PRESET` (face omits
  `why`) omits `why`; a spec with `details: []` yields an empty details bucket; honest-empty: no
  overlay → no `why`.
- **AC integration (the contract)** — project the `T-018-01` fixture with `DESIGNER_PRESET` + a
  `§1c overlay` (`plainTitle:"Build the brain that reads a project and proposes real choices"`,
  `why:…`, `breakdown:…`): (1) face reproduces the §1c plain face; (2) `faceJargon(card)` is `[]`
  AND each denylist token (`P5`,`PE-1`,`BAML`,`SAP`,`.ts`,`phase:done`) is absent from
  `faceText(card)`; (3) the same tokens are **reachable in details** — `charterCodes` ⊇ `{PE-1,R1}`,
  `bamlInternals` ⊇ `{BAML,SAP}`, `fileCites` ⊇ `{survey-core.ts}`, `rawAcceptanceCriteria` non-empty.
- **immutability** — the returned `Card` is frozen; mutating `card.face` throws.

## Ordering of changes (one atomic commit)

1. `src/present/translate.ts` (policy → extractors → helpers → types → `projectNode` → seam).
2. `src/present/translate.test.ts`.
3. `bun run check` green → commit. Self-contained; depends only on committed `spec.ts`/`model.ts`
   (type-only); touches no shared file → no concurrency coordination needed.
