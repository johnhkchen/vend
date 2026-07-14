# T-021-02 — Research: presentation-spec-schema-and-validator

_Descriptive map of what exists. No solutions here — those land in `design.md`._

## The ticket in one line

Define the **presentation-spec** as typed code-as-config — the seven knobs (vocabulary,
density, field-visibility, grouping, metaphor, labels, color-language) — plus a **validator**
that accepts a well-formed spec and rejects a malformed one (`density: 'huge'`) with a clear
error.

_Advances: P1, calibratable-spec._

## Where this sits

- **Epic E-021 `linear-presentation-surface`** — the MCP-independent presentation layer built
  as a clean **data/presentation split**: the canonical graph (epics→stories→tickets) is the
  fixed source of truth; the human reads a *projection* governed by a tunable spec.
  **One-way authority is the hard boundary** — the projection (and its spec) read the graph,
  never write back.
- **Story S-021-02 `presentation-spec`** — this ticket. It is the *calibration brick*: the
  spec is the only thing the eventual calibration loop edits. The graph never changes; the
  **spec** does. T-021-01 (`read-only-graph-model`, already shipped) is the data side; this is
  the first piece of the presentation side.
- **Consumer / contract** lives in `docs/active/pm/linear-surface-prep.md`. §2a names the
  seven knobs; **§2b gives the spec sketch the AC points at**; §2c defines the role-based
  presets (designer / dev) that the calibration loop starts from.

## The authoritative source: linear-surface-prep.md §2a/§2b/§2c

§2a — **the knobs (what's tunable):**

- **Vocabulary** — `plain · mixed · technical` (how much dev language leaks through).
- **Density** — `low · medium · full` (how much per card).
- **Field visibility** — which fields sit on the **face** vs behind **Details**.
- **Grouping** — `by epic · by story · by status · by role · by leverage`.
- **Metaphor** — `tree · board · timeline`.
- **Labels** — the status/word language (`open → "To do"`, `done → "Done"`).
- **Color language** — what color *means* (`by leverage · by status · by role`).

§2b — **the spec sketch (the calibration artifact)**, a small declarative config:

```yaml
presentation:
  preset: designer            # designer | dev | custom
  vocabulary: plain           # plain | mixed | technical
  density: low                # low | medium | full
  face:                       # what appears on the card face
    [plain_title, why, state, breakdown]
  details:                    # progressive disclosure (dev layer)
    [charter_codes, file_cites, baml_internals, raw_acceptance_criteria]
  group_by: story             # epic | story | status | role | leverage
  metaphor: tree              # tree | board | timeline
  labels:
    status: { open: "To do", in_progress: "In progress", done: "Done" }
  color_language: leverage    # leverage | status | role
```

§2c — **role presets:** *designer* = `vocabulary: plain · density: low · metaphor: tree`
(intent on the face, dev detail hidden); *dev* = `vocabulary: technical · density: full`
(cites and gates visible). The calibration loop: start from a preset → adjust knobs → save.

**Observations the spec type must honor:**

- Knob keys in the YAML are **snake_case** (`group_by`, `color_language`) — but the house TS
  convention is camelCase fields (see model.ts: `depends_on → dependsOn`). The validator must
  bridge snake-input → camel-typed-output, exactly as `coerceTicket` does.
- "Field visibility" is split into **two arrays** in §2b: `face` (intent-layer tokens) and
  `details` (dev-layer tokens). The token vocabularies are closed and distinct.
- `labels` nests one level: `labels.status` is a map of canonical-status → display-string.
- `preset` is a meta/origin marker (`designer | dev | custom`), not one of the seven knobs but
  present in the sketch; it is a label, never cross-checked against the knob values
  (`custom` = hand-tuned).

## House patterns this must match (read from the live tree)

The project has a strong, consistent idiom — three precedents bound this ticket:

1. **Pure core, no I/O** (`src/play/id-guard.ts`, `src/gate/gates.ts`, `src/graph/model.ts`).
   The judgment lives in a pure module — no fs, clock, network, or native addon — so the test
   is an ordinary pure-function test. The presentation spec is pure data validation; it fits
   this mould exactly. A future loader (read the YAML, extract `presentation:`) is the impure
   verb, **out of scope here** (cf. the model.ts ↔ load.ts split).

2. **Two refusal disciplines, chosen by meaning** (the budget.ts house rule, restated in
   `gates.ts` lines 16-18):
   - A **programmer error** (malformed *call*) → **throws** (`assertPlan` → `TypeError`).
   - An **expected refusal** (input that doesn't clear) → **returned data**, not an exception
     (`gates.clear` returns a `GateResult` discriminated union; `isStop` narrows it).
   - `model.ts` *throws* typed errors (`GraphParseError`, `GraphIntegrityError`) because a
     corrupt board is corrupt *data*. `GraphIntegrityError` **collects ALL violations** and
     throws once — "report a corrupt board in full," not first-error-only.

3. **Closed sets as `as const` tuples + derived union types** (`gates.ts`:
   `GATE_NAMES = [...] as const; type GateName = (typeof GATE_NAMES)[number]`). This is the
   house way to declare an enum *and* get a runtime membership oracle for validation in one
   place. The seven knobs are all closed sets — this is the obvious tool.

4. **Discriminated-union result + narrower** (`gates.ts`: `GateResult = GateClear | GateStop`,
   `isStop(r): r is GateStop`). The friendly shape for a UI that must *show* why a spec failed.

## Testing idioms (from model.test.ts / gates.test.ts)

- `import { describe, expect, test } from "bun:test";`
- Small fixture builders at the top; `expect(...).toEqual(...)`, `toThrow(ErrorClass)`,
  `toBe(...)`. No fs, no BAML — pure-function tests run free of the bun-test one-call limit.
- `bun run check` = `baml:gen && tsc --noEmit && bun test`. Current suite is green at 610
  tests after T-021-01.

## Constraints & assumptions

- **No external schema library** (zod etc.) is in the stack; validation is hand-rolled, the
  same way `gates.ts` and `model.ts` coerce `unknown` by hand. Confirmed: no `paths` / schema
  dep in tsconfig/package.json.
- The validator's input is `unknown` (a plain object — e.g. a parsed-YAML record, or a
  hand-authored TS literal). Whether the caller passes the whole document or the inner
  `presentation:` value is the **loader's** concern; this ticket validates the **spec object
  itself** (the value under `presentation:`).
- "Code-as-config" (stack.md): the spec is a **TS type**; presets are exported TS constants;
  the validator turns untyped input into the typed shape or refuses.
- New home: there is no `src/present/` yet. The data side lives in `src/graph/`; the
  presentation side wants its own directory. (Decision deferred to design.)
