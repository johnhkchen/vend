# T-002-03 — Progress: decompose-epic-runner

Status: **implementation complete, `bun run check` green (114 pass / 0 fail / 0 TS
errors), deterministic 3/3.**

## Done

| Step | Module(s) | State |
|---|---|---|
| 1 | `src/play/materialize.ts` + `.test.ts` | ✅ alias maps + pure render pair + impure `materialize` write; 7 tests |
| 2 | `src/play/project-context.ts` + `.test.ts` | ✅ pure `buildProjectSnapshot` + impure `assembleInputs`; 3 tests |
| 3 | `src/play/decompose-epic-core.ts` + `decompose-epic.test.ts` | ✅ pure `classify`/`gateRowsFor`/`formatMessage`/`makeStreamSink`; 12 tests |
| 4 | `src/play/decompose-epic.ts` | ✅ impure `runDecomposeEpic` + `lisaValidate` (untested verb) |
| 5 | `src/cli.ts` + `.test.ts` | ✅ pure `parseBudgetArg`/`parseArgs` + `import.meta.main` shell; 9 tests |
| 6 | full suite | ✅ green, deterministic ×3, no live-board mutation by tests |

## Deviations from the plan (documented, per RDSPI)

1. **Pure cores split into `decompose-epic-core.ts`** (structure.md had them in
   `decompose-epic.ts`). **Why:** the orchestrator value-imports `b` from
   `baml_client/sync_client` (the BAML native addon). If the runner's test imported
   the orchestrator module, the addon would load into the `bun test` process and
   reintroduce the once-driven-reactor flakiness (memory 20213/20218). Physically
   separating the baml-free cores lets `decompose-epic.test.ts` import only them. The
   orchestrator re-exports the core (`export *`) so callers still have one entry.
   This is the *same* purity split the plan called for — just enforced at the file
   boundary, which the test constraint requires.

2. **`lisaValidate` kept in `decompose-epic.ts`** (structure.md floated a possible
   `src/play/lisa.ts`). Chose the single-file home to avoid a one-function module;
   it is an impure verb either way.

3. **CLI uses a dynamic `await import("./play/decompose-epic.ts")`** inside
   `import.meta.main`, not a static top-level import. **Why:** keeps the runner (and
   its baml value-import) out of `cli.ts`'s module graph when `cli.test.ts` imports
   the pure parsers — the test never loads the addon. Top-level `await` is fine under
   Bun ESM.

4. **`parseBudgetArg` rejects blank fields explicitly.** `Number("")` coerces to `0`
   (an integer), so `"1000,"` would have slipped past the integer guard as a
   malformed budget. Added an empty-field guard before the `Number.isInteger` check.

## Key wiring decisions realized in code

- **Outcome priority (Design D2):** `classify` is first-match `timeout > budget >
  gate > success`; a budget-exhausted run does **not** materialize even with a CLEAR
  gate (P7 contract breach). Pinned by the "budget beats CLEAR gate" test.
- **Empty/degraded parse is not special-cased** (T-002-02 #2): the runner calls
  `clear()` unconditionally; the value gate stops an empty plan as malformed →
  `gate-failed`. An error subtype from `claude -p` funnels through the same path.
- **Two `GateResult` types** (T-002-02 #1) meet in `gateRowsFor`, which translates the
  gates' whole-plan verdict into run-log per-gate rows.
- **Both surfaces (AC#4):** `makeStreamSink` fans each stream message to stdout (live)
  + a per-run transcript `.vend/transcripts/<runId>.jsonl` (durable); the countable
  outcome is one `appendRunLog` to `.vend/runs.jsonl` — T-001-04's ledger schema
  untouched.
- **BAML in-process (Design D3):** `b.request`/`b.parse` are called directly in the
  runner (a plain `bun` process — no addon one-call limit); the subprocess bridge
  stays test-only. `extractPromptText` is reused from `decompose-bridge.ts`.
- **No live-board clobber:** `materialize` takes explicit dirs; the runner composes
  them from `projectRoot`. Tests assert on rendered strings only — they never spawn
  `claude`/`lisa` or write under `docs/active/`.

## Not done here (correctly out of scope)

- A live end-to-end run (real `claude -p`, real `lisa validate`) — that is **T-002-04**
  (the live proof / first kaizen signal). `runDecomposeEpic`, `materialize`'s write,
  `lisaValidate`, and the CLI dispatch shell are the untested impure verbs by design.
- No `vend` bin in `package.json` (AC asks for the `src/cli.ts` entry point, which
  exists; a bin alias is a packaging nicety deferred).
