# T-016-01 — Research

`expand-fragment` pure core. Map of what exists, where, how it connects. Descriptive only.

## The ticket in one line

Build the **pure core** of the `expand-fragment` play (R1 pure-core-first, R3 foundation),
mirroring `propose-core.ts`: the **`Signal` output shape**, the **`ExpandFragment` BAML
render/parse** (authoring-only, via an `expand-bridge`), and three **pure gates** —
read-never-invent (PE-1), honest-empty (IA-4), value-link. No fs, no spawn. T-016-02 (register
play + staging effect + `vend expand` gesture) is downstream and out of scope here.

## The play pattern this clones (three-file split per play)

Every play in `src/play/` is split into three modules for one reason — the BAML native addon
allows exactly **one** native call per `bun test` process (obs 20675/20702), so any module that
value-imports `b` (`baml_client/sync_client`) cannot be value-imported by a `bun test` file. The
split quarantines the addon:

| File (propose example) | Loads addon? | Tested by | Role |
|---|---|---|---|
| `propose-core.ts` | No (types only) | `propose-core.test.ts` (pure) | gates + renderer + id-mint |
| `propose-effect.ts` | No (addon-free, impure) | `propose-effect.test.ts` (temp-dir) | the fs verb |
| `propose-epic.ts` | **Yes** (`b.request`/`b.parse`) | — (logic is the tested core) | the `Play` shell + register + cast |
| `baml/propose-bridge.ts` | Yes (subprocess only) | `baml/propose.test.ts` (spawns child) | render/parse pins |

T-016-01 builds the **core** (`expand-core.ts`) + the **bridge** (`baml/expand-bridge.ts`) + the
BAML function (`baml_src/expand.baml`). The shell/effect/gesture are T-016-02.

## Key reference files (read)

- **`src/play/propose-core.ts`** — the exact template. `clear(card, ctx)` runs an ordered gate
  table `GATES: [name, (card,ctx)=>Offense|null][]`, returns the engine's `GateVerdict` (first
  STOP wins — the andon; CLEAR echoes every gate name). `nonEmpty()` idiom, `matchIds(text,"P"|"N")`
  greps live charter ids, `flowArray()` renders YAML flow arrays, `renderCard()` is the pure
  member→alias renderer (throws `RangeError` only on enum/map drift). All BAML imports TYPE-ONLY.
- **`src/play/note-core.ts`** — the simpler single-gate precedent (`clearNote`): blank
  title/summary/points → STOP. The honest-empty pattern's ancestor (SAP degrades a bad reply to an
  empty object; the gate classifies emptiness as a STOP). Also shows a pure `renderNoteFile`.
- **`src/engine/play.ts`** — the contract. `GateVerdict = {status:"clear", cleared?} | {status:"stop",
  gate, unit, reason}` (play-agnostic, `gate: string`). `Play<I,O>` with `gates: (out, ctx:
  CastContext<I>) => GateVerdict`. `CastContext<I> = { inputs:I, projectRoot }`. The core's `clear()`
  must return a `GateVerdict` so it drops into `Play.gates` (T-016-02) with no adapter — exactly as
  propose's `clear` does.
- **`baml_src/propose.baml`** — the BAML authoring template. `enum`s use uppercase-first members +
  `@alias("lowercase-token")`; `b.parse` returns the MEMBER name ("Blue"), the renderer maps
  member→alias. `class EpicCard` with `@description` per field is the poka-yoke. `function
  ProposeEpic(signal, charter, project) -> EpicCard { client ClaudeStub prompt #"..."# }`. Required
  scalar fields ⇒ SAP **rejects** a garbage reply (throws) rather than degrading (the Note behavior,
  not the all-array WorkPlan behavior).
- **`src/baml/propose-bridge.ts`** + **`decompose-bridge.ts`** — the subprocess bridge. `runOp(op)`
  dispatches `render`/`parse`; `extractPromptText(req)` (imported from `decompose-bridge.ts`, fully
  play-agnostic) reaches into `req.body.json().messages`. `import.meta.main` block reads `{ops}` from
  stdin, writes `{results}` to stdout. `propose.test.ts` spawns it in a child `bun` (one spawn covers
  every op — the per-process addon limit).
- **`src/play/propose-effect.ts`** / **`propose-epic.ts`** — downstream (T-016-02) referents: the
  effect mints+writes, the shell registers `proposeEpicPlay` and exposes `castProposeEpic`. Read for
  context on where the core plugs in; not modified here.

## The `Signal` shape — already specified by the spec sources

`demand.md` defines a signal as "one line of *what + why it might matter*" and ranks by **value
tier** (`keystone | high | standard | leaf` — exactly `ValueTier` in `src/shelf/menu.ts:23`). The
demand table columns are `| Signal | Value | Budget (envelope) | Status |`.

`job-stories-articulation.md` Story 1 AC#2 nails the field list: each candidate carries **"what ·
why · value tier · a pre-filled budget envelope (from measured data, E-013)"**. The ticket adds
**`advances` invariant** and **readiness**. So the `Signal` class fields are:
`what · why · tier · budget · advances · grounding · readiness` (grounding added as the
read-never-invent citation handle — see Design).

## The three gates — their spec anchors

- **read-never-invent (PE-1, `playbooks/propose-epic.md` "pull-discipline guard"):** "demand is
  *read, never invented*"; a speculative signal is the garbage-factory anti-pattern. PE-2 is the
  operational form: **cite the source** — "the card traces to the demand signal *and* the KB/charter
  value it serves." Job-story AC#4: "Every candidate **traces to real project state**; none is
  invented."
- **honest-empty (IA-4, `information-architecture.md:66`):** "The empty state is honest, not seeded
  … we do not manufacture fake starter signals (overproduction)." Job-story AC#5: "If nothing
  genuinely closes vision-distance, Vend says so — an **honest empty board**, not manufactured work."
  Story 2 AC#5: "A fragment that maps to **no real demand** is allowed to be dropped, not
  force-expanded."
- **value-link (PE-3/PE-4):** the card "names a charter value it serves; advances-nothing-nameable
  is refused" (propose value gate). The `advances` array is the handle (mirrors `EpicCard.advances`).

## Constraints & assumptions

- **Purity:** `expand-core.ts` imports BAML **type-only** (`Signal` from `baml_client/index.ts`),
  engine types type-only. No `node:fs`, no `Bun.spawn`, no clock. Verified by `propose-core.test.ts`
  running as an ordinary pure test.
- **`baml_client/` is untracked/generated** (`git ls-files baml_client` → 0). Adding a class to
  `baml_src/expand.baml` requires `bun run baml:gen` (baml-cli 0.222.0 present) before `tsc`/tests
  see `Signal`. The `check` script already runs `baml:gen` first.
- **SAP rejection:** because `Signal` carries required scalars (`what`/`why`/…), `b.parse` **throws**
  on a garbage reply (the EpicCard/Note behavior). The play's `parse` closure (T-016-02) will catch
  and coerce to an `EMPTY_SIGNAL`; the **honest-empty** gate then STOPs the line cleanly. The bridge
  test pins both the parse-of-canned and the reject-of-garbage paths.
- **GateVerdict reuse:** a STOP is **returned data**, never a throw (the gates.ts house rule); a
  drift/wiring error in the renderer is the one `throw` (RangeError), as in `propose-core`.
- **Staging is T-016-02's concern:** the core renders a Signal to the demand-row shape (pure), but
  the staging dir (`docs/active/pm/`) write is the effect, out of scope here.

## Open questions resolved during research

- *Does the core need `existingEpicIds`?* No — a signal mints no id (it is not an epic). The gate
  context needs only the **charter** (for value-link's invariant validity), mirroring a slimmed
  `ProposeClearContext`.
- *How does the model express "honest empty"?* It returns a `Signal` with blank `what`/`why` (abstain
  rather than manufacture); the honest-empty gate detects the blank — the `clearNote`/value-gate
  empty-degradation classification, applied to a fragment.
