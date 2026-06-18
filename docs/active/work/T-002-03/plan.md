# T-002-03 — Plan: decompose-epic-runner

Ordered, independently-verifiable steps. Each ends green on `bun run check`
(baml:gen → typecheck → test) and is committable. Pure cores are built and tested
first; the impure orchestration that needs a live `claude`/`lisa` is written last
and verified by reasoning + the live proof in T-002-04 (out of scope here).

## Testing strategy (what gets a test, what doesn't)

| Unit | Tested? | How |
|---|---|---|
| `MEMBER_TO_ALIAS` maps, `renderTicketFile`, `renderStoryFile` | ✅ pure | fabricated `WorkPlan` objects (plain JS, type-only baml) |
| `buildProjectSnapshot` | ✅ pure | fabricated parts → assert the assembled string |
| `classify` | ✅ pure | every terminal state + the budget-beats-gate ordering |
| `formatMessage`, `makeStreamSink`, `gateRowsFor` | ✅ pure | sample messages + a fake writer/sink |
| `parseBudgetArg`, `parseArgs` | ✅ pure | valid + each malformed case |
| `materialize` write, `assembleInputs` read, `runDecomposeEpic`, `lisaValidate` | ❌ impure verbs | logic lives in the pure cores (house rule); proven live in T-002-04 |

No live `claude` spawn, no network, no `lisa` spawn in the suite. Same discipline as
`dispense`/`appendRunLog`/`clear` tests.

## Step 1 — `materialize.ts` + tests (pure first)

1. Define the four alias maps from `decompose.baml` (member → lisa token).
2. `renderTicketFile(t)`: build frontmatter (aliases applied; `depends_on` as a
   flow array; `[]` when empty) + body (`## Context` ← purpose, `## Acceptance
   Criteria` ← `- [ ] {doneSignal}`, `_Advances: …_`). `name = "{id}.md"`.
3. `renderStoryFile(s)`: frontmatter with hardcoded `type: story`, `tickets` flow
   array; minimal body. Throw on an unknown enum member key.
4. `materialize(plan, {storiesDir, ticketsDir})`: `mkdir -p` both, write each.
5. **Tests:** feed the canned `S-009`/`T-009-01/02` fixture (reuse the shape from
   `decompose.test.ts`). Assert: aliases mapped (`Task`→`task`, `InProgress`→
   `in-progress`, `Ready`→`ready`); story `type: story`; `depends_on: [T-009-01]`
   and `[]` both render; body contains purpose + doneSignal; unknown member throws.
6. **Verify:** `bun run check` green. **Commit:** "T-002-03: materialize WorkPlan
   → lisa files (pure render + impure write)".

## Step 2 — `project-context.ts` + tests

1. `buildProjectSnapshot({root, srcFiles, stories, tickets})` → a thin, stable
   string (headed sections; sorted lists for determinism).
2. `assembleInputs({epicPath, charterPath?, projectRoot?})`: read epic + charter;
   walk `src/**` + list story/ticket ids (impure); call `buildProjectSnapshot`.
3. **Tests:** `buildProjectSnapshot` on fabricated parts → assert sections present,
   deterministic ordering, no absolute-path leakage. (`assembleInputs` untested —
   impure read.)
4. **Verify + commit:** "T-002-03: assemble DecomposeEpic inputs (charter + snapshot)".

## Step 3 — `decompose-epic.ts`: pure cores + tests

1. `classify(i)`: first-match `timedOut → timed-out`; `exhausted →
   budget-exhausted`; `isStop → gate-failed`; else `success`. `materialize` true
   **only** on `success`. `gateLog` from `gateRowsFor`.
2. `gateRowsFor(g)`: CLEAR → one passed row per `GATE_NAMES` (or a single
   `{gate:"clear",passed:true}`); STOP → `[{gate: g.gate, passed:false, detail:
   `${g.unit}: ${g.reason}`}]`; null → `[]`. (Translates the two `GateResult`
   types — T-002-02 #1.)
3. `formatMessage(msg)`: a compact human line by `msg.type` (`system`/`assistant`/
   `result` etc.); never throws on an unknown type.
4. `makeStreamSink({write, sink})`: returns `onMessage` calling `write(formatMessage
   (msg))` and `sink(JSON.stringify(msg))` — pure given injected edges.
5. **Tests:**
   - `classify`: timeout (no budget/gate) → `timed-out`, no materialize; exhausted
     **with a CLEAR gate** → `budget-exhausted`, no materialize (pins D2 ordering);
     STOP → `gate-failed`; CLEAR + ok budget → `success` + materialize true.
   - `gateRowsFor`: STOP → one failed row carrying gate+unit+reason; CLEAR → passed
     rows; null → `[]`.
   - `makeStreamSink`: fake `write`/`sink` capture arrays; assert one call each per
     message, in order; `formatMessage` handles an unknown `type`.
6. **Verify + commit:** "T-002-03: runner decision core (classify + stream sink +
   gate translation)".

## Step 4 — `decompose-epic.ts`: impure `runDecomposeEpic` + `lisaValidate`

1. Write the orchestration spine (Structure step 1–10): assemble → render →
   dispense(timeoutMs) → (budget check → parse → clear) → classify → maybe
   materialize + `lisaValidate` → `appendRunLog` → return summary.
2. Stamp `startedAt`/`endedAt` via `new Date().toISOString()` (the runner owns the
   clock; the log stays clock-free).
3. Derive `epicId` for the log from the epic filename or a leading `id:` line;
   fall back to the basename. `model` ← `opts.model ?? DEFAULT_MODEL` (logged
   verbatim; passed to the seam only when not the default sentinel).
4. `lisaValidate({projectRoot})`: spawn `lisa validate --path`; tolerate a missing
   binary (log a warning, treat as non-fatal-to-record but mark validate-failed).
5. **No new unit test** (impure verb). **Typecheck must pass.**
6. **Verify + commit:** "T-002-03: wire end-to-end runner (render→dispense→gate→
   materialize→validate→log)".

## Step 5 — `src/cli.ts` + tests

1. `parseBudgetArg("<ms>,<tokens>")` → `{ timeMs, tokens }`; throw `RangeError` on
   wrong arity / non-numeric (positive-int enforced downstream by budget).
2. `parseArgs(argv)`: match `run decompose-epic <path> --budget <v>`; else a usage
   result with an error string.
3. `import.meta.main` block: dispatch to `runDecomposeEpic`, print the summary,
   `process.exit(outcome === "success" ? 0 : 1)`; usage → exit 2.
4. **Tests:** `parseBudgetArg` valid + (`"100"`, `"a,b"`, `"100,"`, `"0,5"`)
   malformed; `parseArgs` happy path + unknown subcommand + missing `--budget`.
5. **Verify + commit:** "T-002-03: vend CLI entry (run decompose-epic --budget)".

## Step 6 — full-suite + determinism gate

1. `bun run check` green (baml:gen + typecheck + all tests).
2. Run `bun test` 3× — confirm no BAML/bun-test flakiness reintroduced (every baml
   import in tests must be **type-only**; no value import of the client into the
   test process).
3. Confirm no live `docs/active/` mutation by the suite (materialize tests target a
   temp/asserted-string path, never the real board).
4. **Commit:** "T-002-03: green check, deterministic suite".

## Verification criteria (maps to AC)

- AC1 `project-context.ts` assembles epic + charter + snapshot → Step 2 + its test.
- AC2 `decompose-epic.ts` orchestrates render→dispense→parse→gate; pass→materialize,
  stop→log-only → Steps 3–4; `classify`/`gateRowsFor` tests pin the branch logic.
- AC3 `cli.ts` exposes `vend run decompose-epic <epic.md> --budget <ms>,<tokens>` →
  Step 5 + `parseArgs` test.
- AC4 every message → stdout + transcript; outcome logged once → `makeStreamSink`
  test + the single `appendRunLog` call in Step 4.
- AC5 budget enforced (wall-clock via seam timeout; tokens vs result; exhaustion
  stops) → `timeoutMsFor` wired in Step 4; `classify` budget-beats-gate test.
- AC6 materialized files pass `lisa validate` → `lisaValidate` tail in Step 4
  (live-proven in T-002-04; structurally the render maps to lisa frontmatter,
  pinned by Step 1 tests).

## Risks / mitigations

- **`lisa validate` needs project config** at `--path`: the runner validates the
  real repo root (which has `.lisa-layout.kdl`); tests never spawn lisa.
- **BAML in-process double call**: safe in a plain `bun` process (memory 20232);
  if it ever regressed, the bridge-subprocess fallback is available — note, don't
  pre-build it.
- **Empty/degraded parse**: not special-cased — `clear()`'s value gate stops it as
  malformed → `gate-failed` (T-002-02 #2).
