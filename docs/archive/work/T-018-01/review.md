# T-018-01 — Review: steer-pure-core

Handoff for a human reviewer. The pure core of `SteerProject-lite` (E-018): the `Fork` type, the
`Steer` output (board `Signal[]` reusing E-016 + `Fork[]`), the `SteerProject` BAML function, the
`steer-bridge`, and the three pure gates — all unit-tested, full gate green.

## What changed (files)

**Created**

- `baml_src/steer.baml` — `class Fork { question, options: string[], whyItMatters, recommendation }`;
  `class Steer { signals: Signal[]; forks: Fork[] }` (reuses E-016's `Signal`/`SignalTier` from
  `expand.baml`, never redefined); `function SteerProject(project, charter) -> Steer` (render-only
  `ClaudeStub`) — the surveyor framing PLUS the fork-surfacer instruction (surface only genuine
  forks; empty when the path is clear).
- `src/play/steer-core.ts` — the PURE core: `STEER_GATE_NAMES`, `MIN/MAX_FORK_OPTIONS`,
  `clear(steer): GateVerdict`, `renderFork`/`renderForks`. Type-only BAML imports; two pure
  runtime imports (`renderSignalRow` from expand-core, `TIER_RANK` from survey-core — both genuine
  shared contracts). Addon-free.
- `src/play/steer-core.test.ts` — 17 pure unit tests.
- `src/baml/steer-bridge.ts` — the offline render/parse child-process bridge (mirror of survey-bridge).
- `src/baml/steer.test.ts` — 4 offline BAML pins (parse / two degrade probes / render).

**Regenerated:** `baml_client/*` (gitignored build product) — adds `Fork`/`Steer` to `types.ts`.

**Modified / deleted:** none. The survey/expand cores and the engine are untouched; the `TIER_RANK`
reuse is a read-only import.

## Acceptance criteria

- [x] **`Fork` + `Steer` + `SteerProject` (render + parse), authoring-only via a `steer-bridge`.**
      Types generated and pinned; the bridge runs both ops offline (`steer.test.ts` green).
- [x] **Pure gates — read-never-invent, fork-genuineness, leverage-rank — each unit-tested.**
      Grounded board passes; a manufactured/inconsequential fork is refused (six refusal arms:
      one-option, duplicate options, blank question, blank why-it-matters, >4 options, no
      recommendation); a clear-path input yields an empty `Fork[]` (clears); the board comes back
      leverage-ordered (inversion → stop). All in `steer-core.test.ts`.
- [x] **Core is pure (no fs/spawn) and composes into the `Play.gates` contract shape.** `clear`
      returns the engine's `GateVerdict`; the pure test loads no native addon. `(steer) =>
      clear(steer)` drops into `Play.gates` (wired in T-018-02).
- [x] **`bun run check:*` green.** baml:gen → tsc clean → 562 pass / 0 fail.

## Test coverage

| Surface | Tests | Where |
|---|---|---|
| `clear` all-pass (board + genuine fork; empty steer; board-no-forks) | 3 | `steer-core.test.ts` |
| read-never-invent stop | 1 | `steer-core.test.ts` |
| fork-genuineness (6 refusal arms + 2 pass cases) | 8 | `steer-core.test.ts` |
| leverage-rank (inversion stop, tie pass, drift `RangeError`) | 3 | `steer-core.test.ts` |
| `renderFork` / `renderForks` (content + empty) | 2 | `steer-core.test.ts` |
| `b.parse` round-trip (board tiers + fork) | 1 | `steer.test.ts` |
| SAP degrade (object-shaped + bare string) | 2 | `steer.test.ts` |
| `b.request` render | 1 | `steer.test.ts` |

**Gaps (by design, deferred to T-018-02):** `castSteer` (assemble inputs → render → dispense →
gates → effect → log) and the staging effect are NOT in this ticket; the live `vend steer` cast is
the sweep verification. The `assembleSteerInputs` impure verb and the staging-artifact composition
are untested here because they don't exist yet.

## Open concerns / notes for the reviewer

1. **No board honest-empty gate (intentional — confirm the call).** The ticket names exactly three
   gates and assigns the honest-empty role to forks (fork-genuineness). So a board carrying a
   blank-but-grounded *filler signal* — which survey-core's `honest-empty` gate would refuse — is
   NOT refused by steer-core. The board's *emptiness* is still honest (an empty `signals[]` clears),
   but blank-content padding among real signals is no longer a board-side stop. If the reviewer
   wants survey's full board hygiene, fold a content check into read-never-invent (require `what`/
   `why` non-blank as well as `grounding`). Left as the ticket specifies for now. (design.md D5.)

2. **fork-genuineness is structural, not semantic.** The gate refuses provably-fake shapes (<2
   distinct options, >4 options, no stakes, no recommendation) — it cannot judge whether a
   well-formed fork is *truly* consequential. That semantic judgment is the model's job under the
   prompt + the human's assent at staging. The gate is a poka-yoke (the read-never-invent analogue),
   not an oracle. A model could still surface a well-shaped but trivial fork; the human catches it.

3. **SAP degrade verified — a clean simplification for T-018-02.** Probed live: `Steer`'s two array
   fields degrade BOTH garbage shapes (object + bare string) to `{signals:[], forks:[]}` — unlike
   survey's single-field `Board`, which throws on a bare string. So T-018-02's `parse` closure needs
   **no try/catch** (survey's needed one). Pinned by the two degrade tests; documented in
   `steer.test.ts` and `progress.md`.

4. **Cross-core import direction.** steer-core → survey-core (`TIER_RANK`) and steer-core →
   expand-core (`renderSignalRow`). Both targets are pure (type-only BAML), so steer-core stays
   addon-free (the pure test proves it loads no addon). This follows survey-core's own reuse of
   `renderSignalRow`; the `TIER_RANK` reuse keeps a single source for the leverage ordinal.

## Bottom line

The pure core is complete, faithful to the ticket's three-gate spec, and green. The signature
**fork-genuineness** gate is implemented and exhaustively tested (refusal + honest-empty pass). The
SAP-degrade question is resolved in T-018-02's favor (no catch needed). Ready for T-018-02 to
register `steerProjectPlay`, add the staging effect, and wire the `vend steer` gesture.
