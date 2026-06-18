# T-002-03 — Review: decompose-epic-runner

Handoff for a human reviewer. What changed, how it's tested, what to scrutinize, and
the open concerns for T-002-04 (the live proof). This ticket is the **convergence
node of E-001**: it wires the four foundation modules (seam, budget, gates, log) plus
the BAML play into one runnable lever. Committed as `608e648`.

## What changed (files)

| Action | File | Role |
|---|---|---|
| create | `src/play/materialize.ts` | WorkPlan → lisa story/ticket files; member→alias maps + pure render pair + impure write |
| create | `src/play/materialize.test.ts` | 7 pure render/alias tests |
| create | `src/play/project-context.ts` | assemble epic + charter + thin go-and-see snapshot |
| create | `src/play/project-context.test.ts` | 3 pure snapshot-formatter tests |
| create | `src/play/decompose-epic-core.ts` | the runner's PURE decision core (baml-free) |
| create | `src/play/decompose-epic.ts` | the IMPURE orchestrator `runDecomposeEpic` + `lisaValidate` |
| create | `src/play/decompose-epic.test.ts` | 12 pure classify / gate-translation / stream-sink tests |
| create | `src/cli.ts` | `vend run decompose-epic <epic.md> --budget <ms>,<tokens>` |
| create | `src/cli.test.ts` | 9 pure arg-parser tests |

No existing module was modified — this ticket only *composes* S-001/S-002. The four
foundation modules and `baml_src/` remain as the prior tickets left them.

## AC status

- **AC1 — `project-context.ts` assembles inputs.** ✅ `assembleInputs` reads the epic
  + the real `charter.md` (the bounds gate greps it) and builds a thin `project`
  snapshot (`src/**` listing + story/ticket ids) via the pure `buildProjectSnapshot`.
- **AC2 — `decompose-epic.ts` orchestrates render→dispense→parse→gate; pass→
  materialize, stop→log-only.** ✅ `runDecomposeEpic` runs the full spine; `classify`
  decides the outcome and `materialize` is called **only** on `success`. On any stop
  it writes nothing but the run log.
- **AC3 — `cli.ts` exposes the play.** ✅ `vend run decompose-epic <epic.md> --budget
  <ms>,<tokens>`; unknown command/play/args → usage + exit 2; non-success → exit 1.
- **AC4 — every message → stdout AND the run log; outcome logged once.** ✅
  `makeStreamSink` fans each stream-json message to stdout (live) + a per-run
  transcript `.vend/transcripts/<runId>.jsonl` (durable). The countable **outcome** is
  one `appendRunLog` to `.vend/runs.jsonl`.
- **AC5 — budget enforced both ways.** ✅ wall-clock via `timeoutMsFor(budget)` →
  seam `timeoutMs` (SIGKILL → `ClaudeTimeoutError` → `timed-out`); tokens via
  `check(budget, result.usage)` → `budget-exhausted` stops the line.
- **AC6 — materialized files pass `lisa validate`.** ✅ structurally — the render maps
  WorkPlan drafts to lisa frontmatter (member→alias, `type: story`, flow arrays),
  pinned by the materialize tests — and the runner spawns `lisa validate --path` after
  write. The **live** validate runs in T-002-04 (see concerns).

## Test coverage

`bun run check` green: **114 pass / 0 fail / 0 TS errors**, deterministic across 3
runs. T-002-03 adds **31** tests (7 + 3 + 12 + 9). The house purity split is honored:
every PURE unit is tested; every IMPURE verb is deliberately untested because its
logic lives in a tested pure core.

- **Tested (pure):** alias maps + `renderTicketFile`/`renderStoryFile`;
  `buildProjectSnapshot`; `classify` (all four outcomes + the budget-beats-CLEAR-gate
  ordering); `gateRowsFor` (STOP/CLEAR/null); `formatMessage` (incl. unknown type);
  `makeStreamSink` (order + both surfaces); `parseBudgetArg`/`parseArgs` (happy +
  every malformed case).
- **Untested (impure verbs, by design):** `runDecomposeEpic`, `materialize`'s write,
  `assembleInputs`'s reads, `lisaValidate`, the CLI `import.meta.main` dispatch.
  Same rule as `dispense`/`appendRunLog`/`clear`.
- **No native-addon flakiness reintroduced:** every test imports baml **type-only** or
  imports a baml-free module; no `bun test` process makes a native call. Verified by
  the 3× determinism run.

## What a reviewer should scrutinize

1. **The pure/impure file split.** `decompose-epic-core.ts` exists *only* so the
   runner's test never value-imports `b` (the BAML addon). The orchestrator re-exports
   the core (`export *`). Confirm the boundary holds: no value import of `sync_client`
   reaches a test. (This is deviation #1 — see `progress.md`.)
2. **Outcome priority.** `classify` is first-match `timeout > budget > gate >
   success`. A budget-exhausted run does **not** materialize even with a CLEAR gate
   (P7). If you disagree with budget-outranks-gate, this is the one line to change
   (`decompose-epic-core.ts`), and the "budget beats CLEAR gate" test pins it.
3. **Empty-plan handling.** Per T-002-02 #2, the runner does **not** special-case an
   empty/degraded parse — it calls `clear()` and the value gate stops it as malformed
   → `gate-failed`. An error subtype from `claude -p` funnels through the same path
   (its empty result text degrades). No separate error branch exists by design.
4. **`epicId` derivation.** Logged epic id is the epic file's frontmatter `id:` if
   present, else the basename. Fine for E-001 (`id: E-001`); confirm it's acceptable
   for epics authored without an `id:` line.
5. **`materialize` write target.** The runner writes to `<root>/docs/active/
   {stories,tickets}`. Correct for a real run, but means a live run on this repo will
   add files to the active board — which is exactly **T-002-04's** job, gated behind
   its own budget. Not exercised by any test.

## Open concerns / handoff to T-002-04 (the live proof)

1. **First real `claude -p` round-trip is unproven here.** Render→dispense→parse has
   only ever run against canned text (T-002-01) and fabricated verdicts (this ticket).
   T-002-04 is the first time `extractPromptText(b.request…)` output is sent to a live
   model and the reply SAP-parsed. Watch for prompt/output-format mismatches.
2. **`lisa validate` against the live board.** `lisaValidate` tolerates `lisa` being
   absent (returns `ok:false`, doesn't crash the record). T-002-04 must run on a
   machine with `lisa` on PATH and a valid `.lisa-layout.kdl`, and should expect the
   newly materialized story/ticket ids not to collide with existing ones (the model
   must pick fresh ids — the gates check uniqueness *within* the plan, not against the
   existing board). **A cross-board id-collision check is not implemented** and may be
   worth a follow-up signal if T-002-04 surfaces it.
3. **Transcript dir growth.** Each run writes a `.vend/transcripts/<runId>.jsonl`
   (gitignored). No rotation/cleanup — fine for the slice, a possible later signal.
4. **`model` logged is a sentinel by default.** With no `--model`, the seam uses the
   CLI default but the log records `DEFAULT_MODEL` (`claude-cli-default`), not the
   actual model the CLI chose. If the consistency layer needs the true model id,
   T-002-04 should read it off the terminal `result` message (open record) and pass it
   through — flagged, not built (out of scope).

## Critical issues

None. The wiring is complete, typechecks, and the suite is green and deterministic.
The only unproven surface is the live round-trip — which is precisely the scope of the
next ticket (T-002-04), not a gap in this one.
