# T-018-01 — Plan: steer-pure-core

Ordered, independently-verifiable steps. Each step ends green or with a pinned observation.
Testing strategy: the gates + renderer are unit-tested PURELY (`steer-core.test.ts`, no addon);
the BAML render/parse are pinned OFFLINE via the child-process bridge (`steer.test.ts`). The
live cast is T-018-02's sweep verification, not this ticket.

## Step 1 — Author `baml_src/steer.baml` and regenerate

- Write `baml_src/steer.baml`: header comment, `Fork` class, `Steer` class (`signals
  Signal[]` + `forks Fork[]`, referencing `Signal` from expand.baml), `SteerProject(project,
  charter) -> Steer` with the surveyor + fork-surfacer prompt.
- Run `bun run baml:gen`.
- **Verify:** command exits 0; `grep -n "interface Steer\|interface Fork" baml_client/types.ts`
  shows both with the expected fields (`Steer.signals: Signal[]`, `Steer.forks: Fork[]`).
- Commit: `feat(steer): SteerProject BAML — Fork + Steer (board + forks) types`.

## Step 2 — Implement `src/play/steer-core.ts`

- Imports (type-only BAML; runtime `renderSignalRow`, `TIER_RANK`).
- `STEER_GATE_NAMES`, `MIN/MAX_FORK_OPTIONS`, `nonEmpty`, `tierRank` (throws `RangeError`).
- The three gates per design D5; the `GATES` table; `clear(steer)`.
- `renderFork` / `renderForks`.
- **Verify:** `bun run check:typecheck` clean (the test arrives next step).

## Step 3 — Pure unit tests `src/play/steer-core.test.ts`

- `mkSignal` / `mkFork` / `mkSteer` builders.
- Cover: all-clear (echo names), empty steer clear, board-no-forks clear; read-never-invent
  stop; the six fork-genuineness refusal arms + empty-forks-pass + genuine-fork-pass;
  leverage-rank inversion stop + drift `RangeError`; renderFork/renderForks.
- **Verify:** `bun test src/play/steer-core.test.ts` green; no addon loaded (pure test).
- Commit: `feat(steer): pure core — Fork/board gates + fork renderer (T-018-01)`.

## Step 4 — The offline bridge `src/baml/steer-bridge.ts`

- Mirror survey-bridge: `SteerBridgeOp` / `SteerBridgeResult`, `runOp` (`b.parse.SteerProject`
  / `b.request.SteerProject` + imported `extractPromptText`), `import.meta.main` stdin/stdout.
- **Verify:** `bun run check:typecheck` clean; a manual `echo '{"ops":[...]}' | bun run
  src/baml/steer-bridge.ts` smoke (optional) returns JSON.

## Step 5 — Offline BAML pins `src/baml/steer.test.ts`

- `runBridge`, the canned steer (2-signal board + 1 genuine fork), the four ops.
- **Probe the SAP degrade FIRST** (read-never-invent: don't assume). Run the bridge against
  the object-shaped and bare-string garbage; record whether each DEGRADES to `{signals:[],
  forks:[]}` or THROWS. Write the assertions to the OBSERVED behavior and document any
  divergence from the WorkPlan prediction in `progress.md`.
- Assert canned parse (tiers `Keystone`/`High`, fork round-trip), the degrade probes, and the
  render (project + charter sentinels + `demand`/fork framing in the prompt).
- **Verify:** `bun test src/baml/steer.test.ts` green.
- Commit: `test(steer): offline BAML pins — parse, SAP-degrade, render (T-018-01)`.

## Step 6 — Full gate + review

- `bun run check` (baml:gen → typecheck → test) green; confirm zero regressions in the rest of
  the suite (the survey/expand cores untouched; TIER_RANK reuse is additive).
- Write `progress.md` (deviations, the observed SAP behavior) and `review.md`.
- Leave commits for the Lisa sweep per the house convention (other tickets defer final commit
  to sweep); if the loop commits incrementally, the messages above apply.

## Testing strategy summary

| Surface | How | File |
|---|---|---|
| `clear` + three gates | pure unit test | `steer-core.test.ts` |
| fork-genuineness arms | pure unit test (each refusal + empty-pass) | `steer-core.test.ts` |
| `renderFork`/`renderForks` | pure unit test | `steer-core.test.ts` |
| `b.parse.SteerProject` round-trip | offline bridge (child process) | `steer.test.ts` |
| SAP degrade (the honest-empty handle) | offline bridge probe | `steer.test.ts` |
| `b.request.SteerProject` render | offline bridge | `steer.test.ts` |

## Risks & mitigations

- **SAP degrade differs from prediction** (e.g. `Steer` throws on a bare string like `Board`
  rather than degrading like `WorkPlan`). *Mitigation:* the Step-5 probe pins the REAL
  behavior; if it throws, that is a documented T-018-02 concern (the parse closure needs a
  catch, as survey's does) — it does not block this ticket's pure core. Either way, recorded.
- **`baml-cli` version drift refusing generate.** *Mitigation:* `version "0.222.0"` is already
  pinned in generators.baml and matches the installed CLI (survey regenerated cleanly today).
- **Over-strict fork gate** rejecting a genuine fork. *Mitigation:* the gate is structural
  (≥2 distinct options, named stakes, recommendation) — provably-fake shapes only; the
  genuine-fork-passes test guards the happy path.
- **Cross-core coupling** (`steer-core` → `survey-core` for `TIER_RANK`). *Mitigation:*
  survey-core exports it as the single source and is pure; the import keeps steer-core
  addon-free (verified by the pure test loading no addon).
