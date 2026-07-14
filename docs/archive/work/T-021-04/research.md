# T-021-04 — Research: vocabulary-translation-layer

_Descriptive map of the codebase the ticket touches. What exists, where, how it connects. No
solutions — those are Design's job._

## The ask (restated from the ticket)

Implement the **field-mapping + vocabulary policy**: translate canonical fields/jargon (charter
codes, BAML, SAP, RDSPI phase names, file paths, play names) to plain **face** language, or route
them behind disclosure (the **details** bucket), governed by the presentation spec. _Advances P1,
data-presentation-split._

**AC (the single testable contract):** given `T-018-01`, the layer emits the plain face from
prep §1c, and a test asserts **zero** tokens from a jargon denylist (`P5` / `PE-1` / `BAML` /
`SAP` / `*.ts` / `phase:done`) appear on the **face**, while they remain **reachable in the
details bucket**.

## The two upstream dependencies (both landed)

This ticket is the third leg of E-021's data/presentation split. Its two inputs already exist:

### `src/graph/model.ts` (T-021-01) — the DATA side

The canonical board as one frozen graph. Relevant exported types (all `readonly`, string-typed —
the faithful-mirror rule keeps `type/status/priority/phase` as plain strings, never narrowed):

- `TicketNode` — `id, storyId, title, type, status, priority, phase, dependsOn[], blocks[], body`.
- `StoryNode` — `id, epicId|null, title, status, priority, tickets: TicketNode[], body`.
- `EpicNode` — `id, title, status, advances[], serves, kindLabel|null, stories: StoryNode[], body`.
- `AnyNode = EpicNode | StoryNode | TicketNode`; `WorkGraph { epics, stories, tickets, byId }`.

Key facts for this ticket: the `body` field is the **raw markdown** below the frontmatter fence —
this is where all the jargon lives (charter codes, `BAML`, `SAP`, `Cites:` file paths, play
names). `title` is the kebab-case canonical title (`steer-pure-core`). `status`/`phase` are raw
strings (`open`, `done`). Containment is **object refs** (`epic.stories`, `story.tickets`) so a
projection can read child counts without re-joining; cross/back edges (`storyId`, `dependsOn`,
`blocks`) stay id strings.

### `src/present/spec.ts` (T-021-02) — the PRESENTATION side

The typed, pure presentation spec. Relevant exports:

- `PresentationSpec { preset, vocabulary, density, face: FaceField[], details: DetailField[],
  groupBy, metaphor, labels: { status: Record<string,string> }, colorLanguage }`.
- `FACE_FIELDS = ["plain_title", "why", "state", "breakdown"]` — the closed set of face tokens.
- `DETAIL_FIELDS = ["charter_codes", "file_cites", "baml_internals", "raw_acceptance_criteria"]` —
  the closed set of dev-layer tokens behind disclosure.
- `DESIGNER_PRESET` (face = all four; details = all four; labels.status `{open:"To do",
  in_progress:"In progress", done:"Done"}`) and `DEV_PRESET`.
- `VOCABULARIES = ["plain","mixed","technical"]`.

The spec is the **router input**: `spec.face` decides which face tokens render; `spec.details`
decides which dev tokens are reachable; `spec.labels.status` maps a raw status → a display chip;
`spec.vocabulary` governs how aggressively jargon is scrubbed.

## The presentation contract (the PM prep docs)

`docs/active/pm/linear-surface-prep.md` is the render contract; §1a/§1b/§1c are this ticket's spec:

- **§1a field mapping** — `title → plain title`; `type/phase/status → one state chip` (no
  `phase:done` raw); context paragraph `→ "Why this matters"`; ACs `→ "What done means"` (raw ACs
  behind *Details*); `depends_on → visual links`; `Cites: → Details`; charter codes / BAML / SAP
  `→ translated or hidden`.
- **§1b vocabulary policy** — charter codes (`P5`, `PE-1`, `IA-7`) **translate to the plain idea or
  hide, never show the code**; RDSPI phase names / `BAML` / `SAP` / file paths → **dev layer,
  hidden**; internal play names (`survey-core.ts`) → drop/rename to the capability. **Principle:**
  the **face** carries _what · why · state · how-it-breaks-down_; the **how** lives one
  disclosure-tap deeper.
- **§1c worked before→after for `T-018-01`** — the exact target this ticket's AC names. Face:
  > **Build the brain that reads a project and proposes real choices** · ✅ Done
  > _Why:_ So Vend can offer a ranked to-do list **plus** the genuine either/or decisions…
  > _What "done" means:_ ranked list, flags real decisions, refuses to invent fake work…
  > _[ Details ▸ ]_ — the Fork type, the BAML function, the gates, the file cites.

`linear-surface-mock.md` confirms the same face/Details split rendered over the live board, and
restates: "_Not one charter code, file path, or `BAML` on the face._"

## The fixture the AC names: `T-018-01`

`docs/active/tickets/T-018-01.md` — `title: steer-pure-core`, `phase: done`. Its **body** is
dense with every denylist class: charter codes `R1`, `R3`, `PE-1`; `BAML`, `SAP`; file cites
`src/play/survey-core.ts`, `src/play/expand-core.ts`, `baml_src/`, `src/baml/survey-bridge.ts`;
play names; an `## Acceptance Criteria` section. It is the natural worst-case fixture: a node
whose raw content trips every denylist class, so a clean face is a real guarantee, not a no-op.

A blocker the design must face honestly: the plain prose of §1c ("Build the brain that reads a
project…") **cannot be derived deterministically** from `steer-pure-core` + a jargon body. It is
**authored** intent text. So "emit the plain face from §1c" implies an **authored plain overlay**
is a layer input — the layer's job is to **route and guarantee** (scrub), not to invent prose.
This mirrors the house **honest-empty** discipline (`survey-core.ts`): never manufacture content.

## House patterns this module must mirror

- **Pure core** (`gates.ts`, `model.ts`, `spec.ts`, `id-guard.ts`): no fs/clock/network/native
  addon. Type-only imports of `TicketNode`/`PresentationSpec` (erased at runtime), so the test is
  an ordinary pure-function test. `*-core.ts` naming + `*.test.ts` sibling.
- **Verdict-not-throw** (the budget.ts rule, restated in `gates.ts`/`spec.ts`): an expected,
  recoverable outcome is **returned data**, not an exception. Here, "this face is clean" is a
  predicate returning a list of leaks, not a throw.
- **Closed-set membership oracles** (`spec.ts` as-const tuples): the denylist classes and the
  charter-code translation table are `as const` constants, the single source of the policy.
- **Faithful mirror** (`model.ts`): the layer reads raw strings; it never edits the graph (E-021's
  one-way authority — calibration edits the spec, never the data).

## Constraints & boundaries

- **No new dependency** — pure string/regex work; no `Bun.YAML`, no fs. Unlike T-021-03's
  `presets.ts` (which adds fs verbs), this leg is 100% pure.
- **No existing file modified** — new module `src/present/translate.ts` + its test. `spec.ts` and
  `model.ts` are imported type-only, never edited (concurrency-safe vs T-021-03's `presets.ts`).
- **Sibling T-021-03** (same story, `implement` phase) owns `src/present/presets.ts` — disjoint
  file, no shared edit, so no missing-dependency edge.
- **Scope guard** — this is the translation/routing layer, **not** the renderer (no Mermaid, no
  Linear, no TUI). It emits a typed `Card` (face + details buckets); rendering is downstream.
