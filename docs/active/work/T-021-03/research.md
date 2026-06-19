# T-021-03 — Research: role-presets-save-load-seat-default

_Descriptive map of the codebase relevant to this ticket. What exists, where, how it
connects. No solutions proposed here._

## The ticket in one line

Ship the **designer** and **dev** presets as **saved specs**, with **save/load** and a
**per-seat default** so the designer's tuned view reproduces on demand. AC: loading the
`designer` preset returns `vocabulary:plain · density:low · metaphor:tree`; saving a tuned
spec and reloading it **round-trips byte-equal**; a test confirms the **designer seat resolves
to the designer preset by default**. `depends_on: [T-021-02]`. Advances **P1**,
**calibratable-spec**.

## What T-021-02 already delivered (the foundation this builds on)

`src/present/spec.ts` (committed, `phase: done`) is the **pure** presentation-spec module:

- **The type** — `PresentationSpec` (all `readonly`, camelCase): `preset, vocabulary, density,
  face[], details[], groupBy, metaphor, labels, colorLanguage`. `labels` is
  `{ status: Readonly<Record<string,string>> }`.
- **Closed-set knobs** as `as const` tuples that are both the type source and the runtime
  membership oracle: `VOCABULARIES, DENSITIES, GROUPINGS, METAPHORS, COLOR_LANGUAGES, PRESETS
  (["designer","dev","custom"]), FACE_FIELDS, DETAIL_FIELDS`.
- **The two presets, already authored**: `DESIGNER_PRESET` (`vocabulary:plain, density:low,
  groupBy:story, metaphor:tree, colorLanguage:leverage`, full face, all details, status labels
  open/in_progress/done) and `DEV_PRESET` (`vocabulary:technical, density:full, groupBy:epic,
  metaphor:tree, colorLanguage:status`, empty status labels). **Both `Object.freeze`-d**,
  including the nested `labels.status`.
- **The validator** — `validateSpec(input): SpecResult` (total, pure, returns a verdict,
  collects every violation); `parseSpec(input): PresentationSpec` (the throwing seam, throws
  `PresentationSpecError`); `isValidSpec(r)` (narrower).

Crucially, `spec.ts`'s header **explicitly defers** persistence and the §2b snake_case YAML
config to a "future loader": _"Reading a YAML config file and extracting its `presentation:`
wrapper is a FUTURE impure loader's job (the model.ts ↔ load.ts split); this module validates
the spec OBJECT itself."_ T-021-03 is the first persistence layer — but is **not** required to
own the full §2b `presentation:`-wrapper / snake_case render contract (that is the eventual
Linear-config concern; T-021-04 is the vocabulary-translation layer, also not the YAML config).

## The "seat" concept (where it is defined, where it is not)

"Seat" is a **product/PM term**, not yet a code symbol. Grep across `src/` finds **zero**
occurrences of `seat`. It is defined in the PM docs:

- `docs/active/pm/linear-surface-prep.md` §2c: _"The **same graph** renders differently per
  seat"_ — Designer preset vs Dev preset; **calibration loop**: start from the designer preset
  → show → adjust knobs → **save the preset** once "good enough."
- `docs/active/pm/linear-surface-mock.md`: two seats from the same canonical graph — the
  **designer** view and the dev view.
- `docs/active/pm/job-stories-visual-surface.md:87`: _"The designer preset **loads by default**
  for the designer's seat."_ — this is the AC's "seat default" in the founder's words.

So the **seats** are at least `designer` and `dev` (the two presets that exist). A `founder`
seat appears in job-stories but **has no preset**, so it is out of scope here.

## House persistence patterns (the precedents to mirror)

This ticket introduces a **write path** for specs. The established patterns:

1. **Pure-core / impure-verb split.** Judgment (render, validate, link) is pure and unit-tested
   with fabricated inputs; the single world-touching verb is thin and not unit-tested. Seen in:
   - `src/graph/model.ts` (pure) ↔ `src/graph/load.ts` (impure verb `loadWorkGraph`).
   - `src/play/materialize.ts` — keeps the pure render pair (`renderTicketFile`,
     `renderStoryFile`) **and** the one impure verb (`materialize`, `mkdir -p`+`writeFile`) in
     **one file**, with the header explaining the split.
   - `src/log/run-log.ts` — pure `buildRunRecord`/`serializeRunRecord` + impure `appendRunLog`
     (`mkdir -p` + append) in one file.
2. **Serialization is YAML via `Bun.YAML`.** `src/graph/model.ts:parseFrontmatter` uses the
   built-in `Bun.YAML.parse` (Bun 1.3.9) — _"the ONE runtime global it uses."_ No external YAML
   dependency exists or is wanted. `Bun.YAML` exposes **both** `parse` and `stringify`.
   `Bun.YAML.stringify(obj, null, 2)` emits readable **block-style** YAML and round-trips
   **byte-equal** (`stringify(parse(stringify(x,null,2)),null,2) === stringify(x,null,2)`,
   verified). The frontmatter is currently written as hand-built strings and only ever parsed
   back — no spec has yet been serialized programmatically.
3. **`.vend/` is the project-state dir.** `run-log.ts` defaults to `.vend/runs.jsonl`
   (`DEFAULT_RUN_LOG_PATH`), overridable per call. Tests redirect to a temp dir so the live
   state is never touched (`materialize.test.ts`, `load.test.ts` temp-dir fixtures).
4. **Path defaults are overridable options.** `LoadOptions.root`, `MaterializeTargets`,
   `DEFAULT_RUN_LOG_PATH` — every fs verb takes an injectable path/dir so tests use a temp dir.
5. **ENOENT tolerance.** `load.ts:readNodes` treats a missing dir as empty (`try/catch → []`,
   _"the project-context.ts ENOENT→[] precedent"_). A missing file is a normal first-run state,
   not an error.
6. **Corrupt input is a loud, typed refusal.** `loadWorkGraph` propagates
   `GraphParseError`/`GraphIntegrityError` unchanged; `materialize` throws `IdCollisionError`
   before any write. The verdict-vs-throw duality: `validateSpec` returns a verdict (expected,
   recoverable), `parseSpec` throws (corrupt-config-as-data).

## Test conventions

- `bun:test` (`import { describe, expect, test } from "bun:test"`).
- Pure tests over fabricated records (`spec.test.ts`, `model.test.ts`).
- Impure fs tests use a temp dir created/removed around the test, then assert round-trip and a
  live smoke (`load.test.ts`, `materialize.test.ts`).
- `bun run check` (typecheck + lint + test) is the green gate before commit.

## Constraints & assumptions surfaced

- **No new dependency.** Persistence must use `Bun.YAML` + `node:fs/promises` only (house rule).
- **Byte-equal round-trip requires a canonical serializer.** The serialized form must be
  deterministic given a spec — fixed key order, stable label-map order — so `save → load →
  save` reproduces identical bytes. `Bun.YAML.stringify` preserves insertion order, so a
  serializer that builds a plain object in one fixed field order satisfies this.
- **camelCase canonical shape is kept.** `validateSpec` validates camelCase; persisting the
  camelCase shape needs **no snake↔camel bridge** and composes directly with the validator. The
  §2b snake_case/`presentation:`-wrapper config is explicitly deferred (spec.ts header).
- **The presets are frozen and shared by reference.** A "tuned" spec is derived by spreading a
  preset; serialization reads values, never mutates, so freezing is not in the way.
- **"Resolve seat default"** must mean: return the seat's **saved** spec if one exists, else the
  seat's **built-in preset** — that is what makes "the tuned view reproduces on demand" and
  "designer seat resolves to the designer preset by default" the same code path.
- `src/present/` currently holds only `spec.ts` + `spec.test.ts`; this ticket adds to it.
