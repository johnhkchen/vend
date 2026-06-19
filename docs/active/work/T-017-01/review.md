# T-017-01 — Review: Survey pure core

Handoff for a human reviewer. The pure core of `Survey` (E-017) — the demand-extractor at PROJECT
scale — landed: a ranked `Board` output, the `Survey` BAML function (render + parse) wired
authoring-only through a `survey-bridge`, and three unit-tested pure gates (honest-empty,
read-never-invent, leverage-rank). All ACs met; full suite green. One genuine SAP finding carried to
T-017-02.

## What changed (files)

**Created (source):**
- `baml_src/survey.baml` — `class Board { signals Signal[] }` + `Survey(project, charter) -> Board`.
  References the shared `Signal`/`SignalTier` from `expand.baml` (no redefinition; BAML shares the dir).
  All-array class on purpose (the `WorkPlan` SAP-degrade pattern); authoring-only via `ClaudeStub`.
- `src/play/survey-core.ts` — the PURE core. `SURVEY_GATE_NAMES`, `TIER_RANK` + `tierRank`, the three
  gates, `clear(board): GateVerdict`, `renderBoard(board)`. Addon-free (type-only BAML imports; the one
  value import is the pure `renderSignalRow` from `expand-core.ts`).
- `src/baml/survey-bridge.ts` — authoring-only render/parse child harness; mirrors `expand-bridge.ts`;
  `extractPromptText` imported from `decompose-bridge.ts`.

**Created (tests):**
- `src/play/survey-core.test.ts` — 10 pure-function pins (no addon loaded).
- `src/baml/survey.test.ts` — 6 offline BAML pins via the child bridge.

**Regenerated (build product, gitignored):** `baml_client/*` — now exposes `Board` + `Survey`.

**Not modified:** no existing source touched — Survey is purely additive. (`docs/active/tickets/
T-017-01.md` shows as modified in the tree from Lisa's own phase bookkeeping, not this work.)

## Acceptance criteria — status

- [x] **Ranked `Signal[]` output + `Survey` BAML (render + parse), authoring-only via a `survey-bridge`,
  no transport in BAML.** `Board` wraps the ranked `Signal[]`; `b.request.Survey` / `b.parse.Survey`
  proven offline; `ClaudeStub` render-only; bridge runs native work only in the child.
- [x] **Pure gates — read-never-invent, honest-empty, leverage-rank — each unit-tested:** grounded
  candidates pass; a fabricated (ungrounded) one is refused; a no-gradient project yields the empty board
  (clears); the set comes back leverage-ordered (an inversion stops). All four AC scenarios pinned, plus
  ties, single-element, blank-filler, and the enum-drift `RangeError`.
- [x] **Pure core (no fs/spawn), composes into `Play.gates`.** `clear` returns the play-agnostic
  `GateVerdict`; no external context needed, so the T-017-02 closure is `(board, _ctx) => clear(board)`.
- [x] **`bun run check:*` green.** `baml:gen` + `tsc --noEmit` clean + `bun test` → **528 pass, 0 fail**
  (16 new).

## Test coverage assessment

Strong on the load-bearing judgment. Each gate has a PASS case and its STOP case; the renderer has
populated / empty / drift cases. The empty-board CLEAR polarity (the most likely regression — treating
empty as a failure by analogy to expand) is directly guarded. The BAML layer pins parse, both garbage
shapes, and render offline — no model call, no network.

**Gaps (acceptable for a pure-core ticket, flagged for T-017-02):**
- **No live cast.** A real `vend survey` against the repo is T-017-02 (needs the effect + CLI +
  registration). Real-world board quality, budget usage, and run-to-run consistency (the E-016 variance
  lesson, obs 21333/21340) are unmeasured here by design.
- **No multi-field-grounding semantic check.** `read-never-invent` checks only that `grounding` is
  non-blank — a pure gate cannot verify a citation actually corresponds to real state (PE-2 poka-yoke,
  not an oracle). Same limitation expand accepts.
- **No `value-link` at board scale.** Dropped per the ticket's three-gate spec; each surveyed candidate
  is re-gated downstream when pulled (expand/propose). If a board-level value-link is ever wanted it is
  an additive gate.

## Open concerns / notes for T-017-02 (the registration ticket)

1. **HONEST-EMPTY IS HYBRID, NOT PURE-DEGRADE — the load-bearing handoff.** design.md predicted a garbage
   reply always degrades to an empty board (the `WorkPlan` analogy). Probing the live parser showed
   `Board`'s **single** array field diverges from `WorkPlan`'s **two**: an OBJECT-shaped reply lacking
   `signals` degrades to `{signals: []}`, but a bare UNSTRUCTURED string **throws**
   (`Failed to coerce value`). **T-017-02's parse closure MUST catch the throw and coerce to an empty
   board** — exactly as expand's closure does — so both garbage shapes reach the honest-empty gate
   instead of crashing `castPlay`. Pinned by two distinct tests in `survey.test.ts`. This does not affect
   the pure core.
2. **Budget pre-fill.** E-016 under-shot its cold-start budget (100k set, 211k spent; obs 21333). Survey
   reads the WHOLE project and is heavier — give `surveyPlay.budget` a generous cold-start envelope and
   watch the first live cast closely (the E-017 sweep plan already flags this).
3. **`renderSignalRow` reuse is a deliberate cross-core import** (design D5): the demand row is a shared
   output CONTRACT, and `expand-core.ts` is pure, so the import is addon-safe and DRY. If a reviewer
   prefers strict per-core isolation, it is a ~6-line copy to decouple — but drift between two plays
   writing the identical `demand.md` row argues against it.
4. **No `maxTurns` set here** — that is a T-017-02 calibration (per-play turn cap), as with every play.

## Critical issues needing human attention

None. The work is additive, fully green, and the one behavioral surprise (the SAP hybrid) is documented
and pinned. The single thing the next ticket MUST not miss is concern #1 (catch-and-coerce in the parse
closure) — without it, an unstructured model reply crashes the cast instead of producing an honest-empty
andon.
