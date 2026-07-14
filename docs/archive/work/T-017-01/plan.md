# T-017-01 — Plan: ordered, verifiable steps

Five steps, each committable and independently verifiable. Order is forced by the typecheck dependency:
nothing in `src/` can reference `Board`/`Survey` until the BAML client is regenerated. Testing strategy
is per-step below; the whole thing closes on `bun run check` green.

## Step 1 — Author the `Survey` BAML function + regenerate the client

**Do:** write `baml_src/survey.baml` — the `Board { signals Signal[] }` class and
`Survey(project, charter) -> Board` (referencing the shared `Signal`/`SignalTier`; `client ClaudeStub`;
the read-never-invent / honest-empty / rank-by-leverage prompt). Then `bun run baml:gen`.

**Verify:** `bun run baml:gen` exits 0; `baml_client/types.ts` now contains `export interface Board`
and the client exposes `Survey`. `grep -n "interface Board" baml_client/types.ts` hits.

**Commit:** `feat(survey): author Survey BAML — ranked Board output (T-017-01)`.
*(baml_client is gitignored; the commit is the `.baml` source only.)*

## Step 2 — The authoring-only bridge

**Do:** write `src/baml/survey-bridge.ts` mirroring `expand-bridge.ts` — `SurveyBridgeOp`/`Result`
types, `runOp` (parse → `b.parse.Survey`; render → `b.request.Survey(project, charter)` +
`extractPromptText`), the `import.meta.main` stdin/stdout entry.

**Verify:** `tsc --noEmit` clean (the bridge sees the generated `Survey`/`Board`). A quick manual
smoke is optional here — Step 5's `survey.test.ts` is the real proof.

**Commit:** `feat(survey): add authoring-only render/parse bridge (T-017-01)`.

## Step 3 — The pure core (the heart of the ticket)

**Do:** write `src/play/survey-core.ts` per Structure §survey-core — `SURVEY_GATE_NAMES`, `TIER_RANK`,
`tierRank` (throws on drift), copied `nonEmpty`, the three gates (`honestEmptyGate`,
`readNeverInventGate`, `leverageRankGate`), the `GATES` table, `clear(board)`, and `renderBoard(board)`
reusing `renderSignalRow` from `expand-core.ts`.

**Verify:** `tsc --noEmit` clean. `clear` returns `GateVerdict` (assignable into `Play.gates`). No fs/
process/addon import present (`grep -nE "node:fs|Bun\.|import.*sync_client" src/play/survey-core.ts`
returns nothing).

**Commit:** `feat(survey): pure core — three board gates + renderer (T-017-01)`.

## Step 4 — The pure-core test (the gate proofs)

**Do:** write `src/play/survey-core.test.ts` — the fixtures (`mkSignal`/`mkBoard`/`RANKED`) and the
cases enumerated in Structure: ranked-grounded ⇒ clear; empty ⇒ clear; blank filler ⇒ honest-empty
stop; ungrounded ⇒ read-never-invent stop; out-of-order ⇒ leverage-rank stop; ties ⇒ clear;
`renderBoard` row count + empty; the `RangeError` drift guard.

**Verify:** `bun test src/play/survey-core.test.ts` green; every gate has a pass case AND its stop case
(the four AC scenarios all covered). Confirm the test process loads NO native addon (it imports only
types + the pure `expand-core`).

**Commit:** `test(survey): pin the three board gates + renderer (T-017-01)`.

## Step 5 — The offline BAML test (parse/degrade/render pins)

**Do:** write `src/baml/survey.test.ts` mirroring `expand.test.ts` — one `runBridge` spawn batching:
a canned multi-signal board reply (parse → typed `Board`), a garbage reply (parse → DEGRADES to empty
board — the load-bearing SAP pin), and a render op (sentinels + framing present in the prompt).

**Verify:** `bun test src/baml/survey.test.ts` green — the degrade pin proves an empty board needs no
coercion (the honest-empty handle is structural). The render pin proves both inputs reach the prompt.

**Commit:** `test(survey): offline BAML parse/degrade/render pins (T-017-01)`.

## Final gate

`bun run check` (= `baml:gen && check:typecheck && check:test`) green across the WHOLE suite — the new
~9 core tests + ~3 BAML tests join the existing ~511 with zero regressions. Then `bun run
check:committed` (D-005) — no source left uncommitted.

## Testing strategy summary

- **Unit (pure, no addon):** the three gates + `renderBoard` — `survey-core.test.ts`. This is where the
  ticket's "each gate unit-tested" AC is met. Fast, deterministic, the bulk of the proof.
- **Offline integration (BAML via child bridge):** parse/degrade/render — `survey.test.ts`. Proves the
  authored prompt renders and the SAP degrade lands an empty board, WITHOUT a model call or network.
- **No live cast here.** A real `vend survey` against the repo is T-017-02 (needs the effect + CLI +
  registration). Budget/consistency monitoring (the E-016 lesson) rides on that downstream cast.

## Risks & mitigations

- **BAML rejects something in `survey.baml`** (shared-type reference, list field) — caught immediately
  at Step 1's `baml:gen`; the `WorkPlan`/`Signal` precedents make both well-trodden.
- **`renderSignalRow` import couples cores** — accepted in Design D5 (shared output contract, pure
  module); if it ever proves wrong it is a one-line copy to decouple.
- **Empty-board polarity bug** (treating empty as a stop) — directly guarded by the Step 4 "empty ⇒
  clear" test, the one most likely to catch a polarity inversion.
