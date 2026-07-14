# T-017-01 — Research: Survey pure core

Descriptive map of the codebase territory this ticket lands in. No solutions here — that is
Design's job. The ticket: the **pure core of `Survey`** (E-017), the demand-extraction primitive
one scale up from `ExpandFragment` — where expand clears one fragment into one `Signal`, Survey
reads the WHOLE rough project and emits a **ranked board** (`Signal[]`), plus a `Survey` BAML
function (render + parse) wired authoring-only through a `survey-bridge`, plus three unit-tested
pure gates: read-never-invent, honest-empty, leverage-rank.

## The play split pattern (the house shape every play follows)

Every play in this repo is split into three modules for ONE concrete reason (recorded in every
core's header, e.g. `expand-core.ts:6-13`): the BAML native addon allows exactly **one** successful
native call per `bun test` process — its once-driven runtime reactor hangs the second call and makes
the suite flaky (obs 20213/20675). So:

- **`<play>-core.ts`** — the PURE judgment: gates + renderer. Imports BAML types **TYPE-ONLY**
  (erased under `verbatimModuleSyntax`), so no addon ever loads. Tested as an ordinary pure-function
  test. This is the bulk of T-017-01.
- **`baml_src/<play>.baml`** — the authored prompt + output type. `b.request.X` renders, the
  `claude -p` seam dispenses, `b.parse.X` SAP-parses the reply. `ClaudeStub` is render-only; BAML is
  never the transport.
- **`src/baml/<play>-bridge.ts`** — the AUTHORING-ONLY render/parse harness. A child `bun` process
  performs the native render/parse and emits JSON on stdout, so the test never loads the addon in its
  own process. T-017-02 adds the impure shell (`<play>.ts` + effect + CLI gesture); **out of scope here.**

ExpandFragment (E-016, just shipped) is the exact sibling to mirror — same scale-minus-one. The four
existing plays: DecomposeEpic, ProposeEpic, capture-note, ExpandFragment.

## The reuse target: E-016's `Signal` (already shipped)

`Signal` is already defined in `baml_src/expand.baml:42-50` and generated into
`baml_client/types.ts:133-141`. Fields (all required scalars except `advances`):

| field | type | meaning |
|---|---|---|
| `what` | string | one-line move; BLANK (with `why`) = honest-empty abstention |
| `why` | string | the leverage in one line |
| `tier` | `SignalTier` enum | `Keystone`/`High`/`Standard`/`Leaf` (member names; `@alias` → demand token) |
| `budget` | string | pre-filled envelope, demand.md notation |
| `advances` | string[] | charter invariant id(s) or core-feature advance |
| `grounding` | string | WHAT real state it was READ from — the read-never-invent citation |
| `readiness` | string | `ready` or `blocked: <prereq>` |

`SignalTier` is a closed enum (`baml_src/expand.baml:32-37`) with `@alias` tokens `keystone`/`high`/
`standard`/`leaf`. `b.parse` returns MEMBER names ("Keystone"); the renderer maps member → alias.
**BAML shares types across `baml_src/` files** — a new `survey.baml` can reference `Signal` /
`SignalTier` without redefining them (single source, no drift).

## The gate idiom (expand-core.ts is the template)

`src/play/expand-core.ts` is the precise model. Its shape:

- `EXPAND_GATE_NAMES = ["honest-empty", "read-never-invent", "value-link"]` — a `const` tuple that is
  the single source of gate ORDERING (value-priority). `clear()` runs them in this sequence;
  first stop wins (the andon: the line stops, does not accumulate findings); a CLEAR echoes every name.
- Each gate: `(signal, ctx) => Offense | null`, where `Offense = { unit, reason }`; `null` = pass.
- `clear(signal, ctx): GateVerdict` — returns the engine's play-agnostic `GateVerdict`
  (`src/engine/play.ts:73-75`), so it drops straight into `Play.gates` at registration with no adapter.
- **A STOP is RETURNED DATA, never a throw** (the `gates.ts` house rule: a programmer/wiring error
  throws — e.g. enum/map drift in `aliasTier`; an unworthy/empty signal is a returned STOP).
- Self-contained pure helpers (`nonEmpty`, `matchIds`, `flowArray`, `tierLabel`) — the **no-shared-util
  idiom**: each core copies its tiny predicates rather than coupling to a shared util module.
- `TIER_ALIAS` map (member → lowercase token) + `aliasTier` (throws `RangeError` on out-of-map drift).
- `renderSignalRow(signal): string` — pure demand-row renderer (`| what — why | Tier | budget | status |`),
  round-tripping `advances`/`grounding` in a trailing note. **This is exported and pure — reusable.**

Tests (`expand-core.test.ts`): every BAML import TYPE-ONLY; enum supplied as a string-literal cast
(`"Keystone" as SignalTier`); a `FULL_SIGNAL` fixture + one test per gate (pass + each stop) + renderer
round-trip + the `RangeError` drift guard. 11 tests, no addon loaded.

## The Play contract (where the core plugs in)

`src/engine/play.ts` defines `Play<I,O>` — six variation points (`render`/`parse`/`gates`/`effect`/
`budget`/`card`) + optional `maxTurns`. The relevant member:
`gates: (out: O, ctx: CastContext<I>) => GateVerdict`. `CastContext<I>` carries `{ inputs, projectRoot }`.
So the core's `clear` must return `GateVerdict` and take whatever context the gates need DERIVED from
inputs. `GateVerdict` = `{status:"clear", cleared?}` | `{status:"stop", gate, unit, reason}`.
The registration of `surveyPlay` onto this contract is **T-017-02, not here.**

## The array-output / SAP-degrade precedent (DecomposeEpic)

Survey's output is array-shaped (a board of signals), so the relevant SAP behavior is **DecomposeEpic's**,
not expand's. `baml_src/decompose.baml:14-17` pins it: `WorkPlan` is an all-array class
(`stories[]`/`tickets[]`); the SAP parser **never REJECTS** such a class — a malformed reply **degrades
to an EMPTY** `WorkPlan` rather than throwing. The consuming gate must classify an empty result as the
honest-empty case. This DIVERGES from expand's single-`Signal` output, whose required scalars make
`b.parse` THROW on garbage (caught + coerced to empty by the play's parse closure). For Survey, an
**empty board needs no coercion** — the degrade lands it there naturally.

## The bridge harness (expand-bridge.ts is the template)

`src/baml/expand-bridge.ts`: reads `{ ops }` from stdin, writes `{ results }` to stdout, one result per
op in order; a failing op yields `{ ok:false, error }` not a crash. `runOp` dispatches render vs parse.
`extractPromptText` (the pure reach-in that pulls the rendered prompt from the request body) is
**IMPORTED from `decompose-bridge.ts:35`** — already play-agnostic, never re-implemented. The bridge
value-imports `b` from `baml_client/sync_client.ts` (loads the addon) and runs only in the child
(`import.meta.main` guard). `expand.test.ts` spawns it via `Bun.spawn(["bun","run",BRIDGE])`, batching
all ops into ONE spawn (the addon limit is per-process).

## Charter / playbook grounding (the gate semantics)

- `playbooks/propose-epic.md` PE-1: read-never-invent — demand is READ off real state, never invented;
  every candidate cites its source.
- `information-architecture.md` IA-4: honest-empty — a flat gradient yields an empty board, not
  manufactured busywork (overproduction is the worst waste).
- `demand.md`: the signal-row format (`| Signal | Value | Budget | Status |`) + the leverage tiers
  (keystone unblocks most → leaf unblocks nothing) — the ranking leverage-rank enforces.

## Build / verify surface

`package.json` scripts: `check` = `baml:gen && check:typecheck && check:test`. So **a new `survey.baml`
must regenerate the client** (`bun run baml:gen`) before typecheck sees `Survey`/`Board`. `check:committed`
(D-005) and `check:head` are the commit-time gates. `baml_client/` is gitignored (a build product).

## Constraints & assumptions surfaced

- The core must be PURE: no fs, clock, network, process, or addon. Type-only BAML imports.
- A STOP is returned data; only a programmer error (enum/map drift) throws.
- Survey takes **two** inputs (`project`, `charter`) — NOT a fragment; it reads the whole project.
- Gate ordering and the empty-board polarity (empty = honest CLEAR, not a stop) are the open design
  questions carried into Design.
- T-017-02 (effect + CLI + registration + live cast) is explicitly downstream; this ticket ends at a
  pure, tested core + the BAML function + bridge.
- E-016 budget lesson (obs 21333): expand under-shot its cold-start budget (100k set, 211k spent);
  Survey is heavier. Budget calibration is a T-017-02 concern, but noted.
