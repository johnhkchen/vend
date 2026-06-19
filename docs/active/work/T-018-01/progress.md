# T-018-01 — Progress: steer-pure-core

Tracks execution against `plan.md`. All six plan steps complete; full gate green.

## Step status

| Step | Status | Notes |
|---|---|---|
| 1. `baml_src/steer.baml` + `baml:gen` | ✅ done | `Fork` + `Steer` generated in `baml_client/types.ts` with the expected fields |
| 2. `src/play/steer-core.ts` | ✅ done | three gates + `renderFork`/`renderForks`; typecheck clean |
| 3. `src/play/steer-core.test.ts` | ✅ done | 17 pure tests pass; no addon loaded |
| 4. `src/baml/steer-bridge.ts` | ✅ done | mirror of survey-bridge; smoke-probed live |
| 5. `src/baml/steer.test.ts` | ✅ done | 4 pins pass; SAP degrade probed FIRST, then pinned to observed reality |
| 6. full gate + artifacts | ✅ done | `bun run check` green (562 pass / 0 fail); progress + review written |

## Files created

- `baml_src/steer.baml` — `Fork`, `Steer` (`signals Signal[]` + `forks Fork[]`), `SteerProject(project, charter) -> Steer`.
- `src/play/steer-core.ts` — `STEER_GATE_NAMES`, `MIN/MAX_FORK_OPTIONS`, `clear`, `renderFork`, `renderForks`.
- `src/play/steer-core.test.ts` — 17 pure unit tests.
- `src/baml/steer-bridge.ts` — offline render/parse bridge (child process).
- `src/baml/steer.test.ts` — 4 offline BAML pins.
- `baml_client/*` — regenerated (gitignored build product).

## Deviations from plan

**None structural.** One finding resolved a planned open question, and one risk was retired by
measurement:

1. **SAP degrade — VERIFIED, matches the WorkPlan prediction (risk retired).** Plan Step 5
   probed both garbage shapes live via the bridge before writing assertions. Result: `Steer`
   (two array fields, like `WorkPlan`) **degrades BOTH** an object-shaped reply lacking the
   fields AND a bare unstructured string to `{signals:[], forks:[]}` — it never throws. This is
   the clean divergence from survey's single-field `Board` (which throws on a bare string and so
   needed a catch closure). **Consequence for T-018-02:** the steer play's `parse` closure needs
   **no try/catch** — both garbage shapes already reach a clean honest-empty andon. Pinned by the
   two degrade tests in `steer.test.ts` and documented in that file's header.

2. **No separate board honest-empty gate (design decision, not a deviation).** The ticket
   enumerates exactly three gates (read-never-invent, fork-genuineness, leverage-rank), and
   names fork-genuineness "the fork-side sibling of honest-empty." So — unlike survey-core, whose
   first gate is `honest-empty` — steer-core has no board honest-empty gate; the board's emptiness
   stays honest by construction (an empty `signals[]` passes all three gates). Recorded in
   `design.md` D5 and the steer-core header. A blank-but-grounded *board* signal (caught by
   survey's honest-empty) is therefore NOT refused by steer — see `review.md` open concerns.

## Verification

- `bun test src/play/steer-core.test.ts` → 17 pass.
- `bun test src/baml/steer.test.ts` → 4 pass.
- `bun run check` (baml:gen → typecheck → test) → tsc clean, **562 pass / 0 fail** (was 541; +21
  new, zero regressions in the survey/expand/engine suites).

## Commits

Per the house convention (other tickets this session deferred final commit to the Lisa sweep),
the working tree holds five new untracked source files + the regenerated (gitignored)
`baml_client/`. Commit messages, if the loop commits incrementally, follow `plan.md` Steps 1/3/5.
