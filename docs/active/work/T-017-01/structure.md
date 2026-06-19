# T-017-01 — Structure: file-level blueprint

The shape of the code (not the code). Four files created, one regenerated build product. No existing
file is modified — Survey is purely additive (BAML shares the existing `Signal`/`SignalTier`). Ordering
matters because typecheck cannot see `Board`/`Survey` until the client is regenerated from the new BAML.

## Files

| file | action | what it holds |
|---|---|---|
| `baml_src/survey.baml` | **create** | `Board` class + `Survey(project, charter) -> Board` function |
| `baml_client/types.ts` (+ client) | **regenerate** | `bun run baml:gen` emits `Board` + `Survey` (gitignored build product) |
| `src/play/survey-core.ts` | **create** | the pure core: gate names, tier rank, 3 gates, `clear`, `renderBoard` |
| `src/play/survey-core.test.ts` | **create** | offline pure-function pins for the gates + renderer |
| `src/baml/survey-bridge.ts` | **create** | authoring-only render/parse child harness |
| `src/baml/survey.test.ts` | **create** | offline BAML parse/degrade/render pins via the bridge |

## `baml_src/survey.baml`

Header comment in the house voice (mirrors `expand.baml:1-26`): Survey = demand-extraction at PROJECT
scale, one above ExpandFragment; reads the whole project → a ranked board for human pull; authoring-only;
the output TYPE is the poka-yoke; SAP all-array DEGRADE (cite WorkPlan, NOT expand's reject) → empty
board is the honest-empty handle; BAML owns SHAPE, the gates own MEANING.

- **No `Signal`/`SignalTier` redefinition** — referenced from `expand.baml` (BAML shares the dir).
- `class Board { signals Signal[] @description("the ranked demand board — highest-leverage first;
  EMPTY when the project grounds no real demand gradient (honest-empty, never a manufactured list)") }`
- `function Survey(project: string, charter: string) -> Board` with `client ClaudeStub` and a prompt
  that: frames the demand-extractor-at-project-scale role; states read-never-invent (every candidate
  cites real state in `grounding`); states honest-empty (a flat gradient → empty board, abstain, do
  not manufacture); states rank-by-leverage (order keystone→leaf, never by effort); renders
  `{{ project }}`, `{{ charter }}`, `{{ ctx.output_format }}`. Two inputs only.

## `src/play/survey-core.ts`

PURE module, addon-free. Imports TYPE-ONLY: `Board`, `Signal`, `SignalTier` from
`../../baml_client/index.ts`; `GateVerdict` from `../engine/play.ts`. Imports VALUE: `renderSignalRow`
from `./expand-core.ts` (pure, addon-free — the one allowed cross-core import per D5).

Public / internal members, in file order:

1. **Header comment** — the pure-core rationale + the empty-board polarity note (D3) + the
   one-cross-import note (D5).
2. `export const SURVEY_GATE_NAMES = ["honest-empty", "read-never-invent", "leverage-rank"] as const;`
   + `export type SurveyGateName` — the single source of gate ORDERING.
3. `export const TIER_RANK: Readonly<Record<string, number>>` = `{ Keystone:0, High:1, Standard:2,
   Leaf:3 }` — NEW (leverage ordinal; expand-core has only the alias map). Keyed by enum MEMBER name.
4. `function tierRank(member: string): number` — map lookup; throws `RangeError` on out-of-map member
   (enum/map drift — the one programmer-error throw, mirroring `aliasTier`).
5. `function nonEmpty(s: unknown): boolean` — COPIED from expand-core (no-shared-util idiom).
6. `interface Offense { unit; reason }` — one gate's finding (the expand-core shape).
7. The three gates, each `(board: Board) => Offense | null`:
   - `honestEmptyGate` — `signals.length === 0` ⇒ `null` (CLEAR). Else the FIRST signal with blank
     `what` AND blank `why` ⇒ Offense (manufactured/degraded filler). Else `null`.
   - `readNeverInventGate` — FIRST non-blank signal with blank `grounding` ⇒ Offense (speculation).
     Else `null`.
   - `leverageRankGate` — scan adjacent pairs; FIRST `tierRank(signals[i].tier) >
     tierRank(signals[i+1].tier)` ⇒ Offense naming the inversion. Else `null`.
8. `const GATES: ReadonlyArray<readonly [SurveyGateName, (board: Board) => Offense | null]>` — the
   ordered table; names match `SURVEY_GATE_NAMES`.
9. `export function clear(board: Board): GateVerdict` — run GATES in order; first Offense ⇒
   `{status:"stop", gate, unit, reason}`; none ⇒ `{status:"clear", cleared:[...SURVEY_GATE_NAMES]}`.
10. `export function renderBoard(board: Board): string` — `board.signals.map(renderSignalRow).join("\n")`;
    an empty board renders `""` (no rows). PURE.

**Boundary:** the core decides and renders; it never touches fs/process/the model. It plugs into
`Play.gates` as `(board, _ctx) => clear(board)` and into the staging effect's renderer — both wired in
T-017-02.

## `src/play/survey-core.test.ts`

`bun:test`. Every BAML import TYPE-ONLY; enum via string-literal cast (`"Keystone" as SignalTier`).
Fixtures + cases (covers the four AC scenarios + drift guard):

- `mkSignal(over)` helper → a complete grounded `Signal`; `mkBoard(...signals)` → `{ signals }`.
- A `RANKED` board: Keystone, High, Standard signals in order — all grounded.
- **clear — ranked grounded board ⇒ clear** echoing `SURVEY_GATE_NAMES` (AC: grounded candidates pass).
- **clear — empty board ⇒ clear** (AC: no-gradient project yields the empty board; the polarity proof).
- **clear — a blank filler entry ⇒ honest-empty STOP** (a board padded with an empty signal).
- **clear — an ungrounded candidate ⇒ read-never-invent STOP** naming it (AC: a fabricated one is
  refused).
- **clear — an out-of-order board (High before Keystone) ⇒ leverage-rank STOP** (AC: leverage-ordered).
- **clear — equal-tier adjacent signals (ties) ⇒ clear** (non-strict ordering).
- **renderBoard — N grounded signals ⇒ N rows**, each carrying its `what`; empty board ⇒ `""`.
- **renderBoard / clear — out-of-map tier member ⇒ RangeError** (enum/map drift guard, via
  `renderSignalRow`'s alias path and `leverageRankGate`'s rank path).

## `src/baml/survey-bridge.ts`

Mirrors `expand-bridge.ts` exactly. Value-imports `b` from `../../baml_client/sync_client.ts`;
type-imports `Board`; imports `extractPromptText` from `./decompose-bridge.ts`.

- `export type SurveyBridgeOp = { mode:"render"; project; charter } | { mode:"parse"; text }`.
- `export type SurveyBridgeResult = {ok:true;mode:"render";prompt} | {ok:true;mode:"parse";board:Board}
  | {ok:false;error}`.
- `export function runOp(op): SurveyBridgeResult` — parse ⇒ `b.parse.Survey(op.text)`;
  render ⇒ `b.request.Survey(op.project, op.charter)` → `extractPromptText`; try/catch → `{ok:false}`.
- `if (import.meta.main)` entry: set render-only key, read `{ops}` from stdin, map `runOp`, write
  `{results}` to stdout.

## `src/baml/survey.test.ts`

Mirrors `expand.test.ts`. Spawns the bridge via `Bun.spawn(["bun","run",BRIDGE])`, one spawn batching
all ops (the addon limit is per-process). Pins:

- **parse — a canned board reply ⇒ a typed `Board` with N signals**, tiers mapped to MEMBER names,
  groundings round-tripped.
- **parse — a garbage reply ⇒ DEGRADES to an empty board** (`signals: []`) — the all-array divergence
  from expand's reject (cite WorkPlan). This is the load-bearing SAP pin.
- **render — `b.request` renders `project` + `charter` sentinels + the demand-extractor framing** into
  the prompt.

## Ordering of changes (Plan will sequence)

1. `baml_src/survey.baml` → `bun run baml:gen` (so `Board`/`Survey` exist for typecheck).
2. `src/baml/survey-bridge.ts` (needs the generated client).
3. `src/play/survey-core.ts` (needs `Board` type + `renderSignalRow`).
4. The two test files.
5. `bun run check` green.

## Out of scope (T-017-02)

`survey.ts` impure shell, the staging effect, `surveyPlay` registration onto the registry, the
`vend survey` CLI gesture, the default budget/card/maxTurns, and the live cast. None appear here.
