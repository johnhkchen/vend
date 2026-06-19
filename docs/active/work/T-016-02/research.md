# T-016-02 — Research

Map of the codebase as it bears on registering `expandFragmentPlay` and adding the
`vend expand "<fragment>"` gesture that **stages** a priced signal. Descriptive — what
exists, where, how it connects. No solutions here.

## The thing this ticket wires

T-016-01 (done, committed `56c80e6` / `080c38f`) shipped the **pure core** of expand-fragment:

- `baml_src/expand.baml` — `SignalTier` enum (`Keystone|High|Standard|Leaf`, `@alias`ed to the
  demand tokens), `Signal` class (`what · why · tier · budget · advances[] · grounding ·
  readiness`), and `function ExpandFragment(fragment, charter, project) -> Signal`. Authoring-only;
  BAML owns SHAPE, never transport.
- `src/play/expand-core.ts` — three value-ordered pure gates (`honest-empty → read-never-invent →
  value-link`), `clear(signal, {charter})` returning the engine's `GateVerdict`, `ExpandClearContext`
  (`{charter}` only — a signal mints no id, so NO `existingEpicIds`), and `renderSignalRow(signal)`
  → one `demand.md` table row (`| **what** — why | **Tier** | budget | readiness (advances … ·
  grounded …) |`). PURE: no fs/spawn/addon. `TIER_ALIAS` maps enum member → demand token.
- `src/baml/expand-bridge.ts` — the child-process render/parse bridge (`b.request`/`b.parse`),
  the native-addon-per-process workaround. `runOp` + `ExpandBridgeOp`/`ExpandBridgeResult`.
- Tests: `expand-core.test.ts` (11 pure), `expand.test.ts` (3 offline BAML pins via one child spawn).

What does **not** yet exist: the impure **shell** (the `Play` object + registration), the
**effect** (the world-touching write), input assembly, the cast verb, and the CLI gesture.
This ticket adds exactly those — the propose-epic pattern, one notch upstream.

## The pattern to mirror (propose-epic, the sibling planning play)

The house splits every play into three files. The mirror is exact and load-bearing:

| Concern | propose-epic | expand-fragment (this ticket) |
|---|---|---|
| pure gates + renderer | `propose-core.ts` (`clear`, `renderCard`) | `expand-core.ts` (`clear`, `renderSignalRow`) — **exists** |
| addon-free impure effect + Inputs type | `propose-effect.ts` (`proposeEpicEffect`, `ProposeEpicInputs`, `EPIC_DIR`) | **to create**: `expand-effect.ts` |
| BAML-loading shell (Play + register + cast) | `propose-epic.ts` | **to create**: `expand-fragment.ts` |
| child-process bridge (tests) | `propose-bridge.ts` | `expand-bridge.ts` — **exists** |

`propose-epic.ts` (read in full) is the template for the shell:
- `parseProposeEpic(text)` — `try b.parse.ProposeEpic … catch → EMPTY_CARD`. The cast loop calls
  `play.parse` with no error channel, so a SAP-reject (Signal has required scalars → `b.parse`
  THROWS, like `EpicCard`/`Note`, unlike all-array `WorkPlan`) must be caught and coerced; the
  first gate then STOPs cleanly instead of crashing `castPlay`. expand needs `parseExpandFragment`
  → `EMPTY_SIGNAL`; the **honest-empty** gate (blank `what`+`why`) catches the coercion.
- `proposeEpicPlay: Play<ProposeEpicInputs, EpicCard>` — six variation points: `render` (via
  `extractPromptText(b.request…)` from `decompose-bridge.ts`), `parse`, `gates` (`clear(card,
  {charter, existingEpicIds})`), `effect`, `budget` (inlined — 30m/16k — never depends UP onto the
  shelf), `card` (`{color, type, rarity}`). Then `registry.register(proposeEpicPlay)` at module load.
- `assembleProposeEpicInputs(opts)` — IMPURE: reads the REAL charter (`CHARTER_PATH`), builds a
  light `buildProjectSnapshot` (`srcFiles: []`), lists board ids via `listIdsIn`. expand needs the
  same minus `existingEpicIds` (its `ExpandClearContext` has no id set).
- `castProposeEpic(opts)` — IMPURE: `assemble → castPlay(play, inputs, budget, {subject, projectRoot,
  model, runId, transcriptDir})`. expand's `castExpandFragment` is the byte-for-byte analogue with
  `subject: opts.fragment`.

`note.ts` / `note-core.ts` are the second reference: `note-core.ts` keeps `slugify(title)` (lowercase,
non-alnum→`-`, fallback `"note"`), `renderNoteFile`, and the **effect** `captureNoteEffect` (mkdir +
writeFile under `NOTES_DIR`) all in the core, tested against a real temp dir. The slug + per-file
write idiom is the model for staging an expanded signal under a slug.

## The engine seam (unchanged — we only register onto it)

- `src/engine/play.ts` — the `Play<I,O>` contract (6 members + optional `maxTurns`), `GateVerdict`
  (`clear{cleared?}` | `stop{gate,unit,reason}`), `CastContext<I>` (`{inputs, projectRoot}`),
  `EffectResult` (`{ok, outcome?, detail?, artifacts?, produced?}`), and the `registry` singleton
  (`register` throws `DuplicatePlayError` on a dup name; `get` returns a typed `PlayLookup`).
- `src/engine/cast.ts` — `castPlay(play, inputs, budget, opts)`: render → dispense (seam, wall-clock
  budget) → meter (`check`) → parse → gates (skippable via `--no-gates`) → `classify` → on
  materialize `effect` → `appendRunLog` (one record). Returns `RunSummary {runId, outcome,
  materialized, produced?}`. `CastOptions` already carries `subject` (required, stamped on `epic`),
  `projectRoot`, `project`, `model`, `maxTurns`, `runId`, `transcriptDir`, `intervened`, `skipGates`.
  Nothing here changes — expand plugs in as the fourth registered play.
- `extractPromptText` lives in `decompose-bridge.ts` and is play-agnostic — reused by every shell's
  `render`. expand's `render` calls it on `b.request.ExpandFragment(...)`, exactly as `expand-bridge`
  already does.

## The gesture surface (`src/cli.ts`)

A pure `parseArgs(argv) → ParsedCommand` + an `import.meta.main` dispatch shell. The closest
precedent is **`chain`** (read in full):
- `parseChainArgs` — signal is every non-flag token `join(" ")` (multi-word and quoted both
  round-trip); `--budget` OPTIONAL; missing signal → `{cmd:"usage", error:"missing <signal>"}`.
- Dispatch arm: lazy-imports `castProposeDecomposeChain` (keeps the BAML addon off the pure-parse
  path), prints `run <id>: <outcome> (materialized: …)` per step, exits non-zero on failure/halt.
- `ParsedCommand` is a discriminated union; `USAGE` is a banner; the `parseArgs` head dispatches by
  `argv[0]` (`run`/`chain`/`envelope`/`audit`, else select/browse).

`cli.test.ts` pins the pure parsers only (no dispatch) — the `chain` block (lines 122–145) is the
exact shape to copy for `expand`: no-budget, multi-token join, `--budget` override, missing-arg
usage, malformed-budget usage. `parseBudgetArg` is the shared budget parser.

`press.ts` (the shelf press) and `dispatch.ts` (`runPlay` by name) are NOT on this ticket's path —
the gesture is its own command (PE-1 pull-discipline: one explicit fragment, never a board drain),
exactly as `chain` is its own command rather than a `select` shape.

## The staging contract (`docs/active/pm/`)

`docs/active/pm/README.md` defines the PM desk: an **upstream**, un-promoted space. "The PM writes
only here. It never edits `demand.md`, `epic/`, `stories/`, or `tickets/`." Staging a candidate is
NOT pulling it; promotion is a separate human gesture. The handoff diagram:
`proposed-batch.md` (staged signals) → human pulls one → `vend chain "<signal>"` → active board.
The **staging unit is a signal string** — "exactly what the clearing plays already take." Live dir
contents: evergreen `README.md`/`process-gate.md`, dated `cycle-*/` archives, and the PM agent's
`proposed-batch.md` + discovery docs. There is **no machine-written staging inbox** yet — the README
notes "a future play could batch-read this file directly; for now the handoff is the signal string +
a human pull." This ticket is that machine writer's first instance: `vend expand` must land its
candidate **somewhere under `docs/active/pm/`** that a human reviews and pulls, never on `demand.md`.

## The signal shape it stages

`docs/active/demand.md` is the live board: a `## Signals` markdown **table** —
`| Signal | Value | Budget (envelope) | Status |`. A signal is "one line of what + why it might
matter," ranked by leverage, priced with a budget envelope, pulled just-in-time. `renderSignalRow`
already emits exactly this row shape. The staged artifact must be "in the `demand.md` shape" (a table
row) yet land in the PM desk, not on the board.

## Constraints & assumptions surfaced

1. **Purity / addon discipline (the hard constraint).** `expand-fragment.ts` value-imports `b`
   (BAML addon) → NO `bun test` may value-import it; its logic must live in already-tested cores.
   `expand-effect.ts` must import NO BAML (only the pure `renderSignalRow` + node:fs + type-only
   engine imports) so `expand-effect.test.ts` can exercise it against a real temp dir — the
   `propose-effect.ts` / `note-core.ts` rule.
2. **A signal has no id.** `ExpandClearContext` deliberately omits `existingEpicIds`; the effect
   cannot mint an `E-0XX` id. The artifact name must come from a **slug** of the signal, not a board
   id — diverging from `proposeEpicEffect`'s re-mint.
3. **`baml_client/` is generated + gitignored** (regenerated by `baml:gen`, which `bun run check`
   runs first). `Signal`/`SignalTier` are exported via `baml_client/index.ts` (`export * from
   "./types"`). Type-only imports keep the addon out of tests.
4. **`EMPTY_SIGNAL` needs a tier enum value** to satisfy the type even though honest-empty fires
   first on blank `what`/`why` (it is never rendered) — the `EMPTY_CARD` precedent.
5. **No live model call in CI.** AC#4's "live cast" is the human sweep; the test proof is an
   **offline** fixture→staged-file path (the `propose-effect.test.ts` precedent: an effect temp-dir
   test + a `clear → classify` wiring test, both addon-free).
6. **Budget default.** The gesture headline `vend expand "<fragment>"` carries no budget, so the
   play needs an inlined warranted default the CLI falls back to (the `chain` ergonomic).
