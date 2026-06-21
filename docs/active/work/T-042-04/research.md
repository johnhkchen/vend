# T-042-04 — Research: doctor-cast-precondition-guard

_Ticket: reuse the doctor check as a precondition before a cast (mirror lisa's
`check_required_deps`-before-`run_loop`), so a cast against a broken environment refuses cleanly
at the door instead of crashing mid-run after a budget is committed. Advances P3, P4, P7._

Descriptive map of what exists and how it connects. No solutions here.

## The doctor pieces this ticket reuses (E-042, both upstream tickets done/landed)

- **`src/doctor/doctor-core.ts` (T-042-01, committed `afbacfc`)** — the PURE check/report model.
  - `interface Check { name; ok; hint? }`; constructors `passed(name)` / `failed(name, hint)`
    (hint REQUIRED on a failure — the E-008 "name the fix" convention).
  - `EXIT_OK = 0`, `EXIT_FAILED = 1` — the shared exit-code contract.
  - `interface DoctorReport { ok; exitCode; report }` — `ok` iff every check green; `exitCode`
    derived from `ok` (never a parallel field); `report` is the full human text listing EVERY
    check, naming each failure + its hint.
  - `renderDoctorReport(checks): DoctorReport` — PURE/TOTAL. Empty set → honest-empty, ok, exit 0.
    All green → `doctor: ok — N check(s) passed` + `✓` lines, exit 0. Any red → `doctor: FAILED —
    K of N check(s) failed` + marked lines (`✗ <name> — <hint>`) in INPUT ORDER, exit 1.
  - ZERO throws — a failed check is returned DATA, never an exception. ZERO impure imports.

- **`src/doctor/doctor-probe.ts` (T-042-02, uncommitted working tree)** — the IMPURE-but-addon-safe
  probe. `probeDoctor(deps?: Partial<DoctorProbeDeps>): Promise<Check[]>` runs the four
  vend-specific checks concurrently and returns them in FIXED order (lisa, claude, BAML, executor).
  - `interface DoctorProbeDeps { onPath; bamlLoadable; env }` — the world-facts are INJECTED;
    `DEFAULT_PROBE_DEPS` are the real envinfo / dynamic-import / `process.env` backends.
  - Named checks + hints are EXPORTED constants: `LISA_CHECK`/`LISA_HINT`, `CLAUDE_CHECK`/
    `CLAUDE_HINT`, `BAML_CHECK`/`BAML_HINT`, `EXECUTOR_CHECK` (suffixed with the resolved id).
  - **NEVER throws / NEVER rejects** (headline AC): every check runs through `safeCheck`, which
    degrades any thrown value to `failed(name, message)`. So `probeDoctor` always RESOLVES.
  - **Addon-safe at import**: the only BAML touch is a *dynamic* `import("@boundaryml/baml")`
    INSIDE `bamlAddonLoadable()` — module evaluation loads no addon. This is why
    `doctor-probe.test.ts` value-imports it as an ordinary `bun test` (injecting fabricated deps).

## The cast this gate guards

- **`src/play/work.ts` — `castWork(opts: WorkOptions): Promise<WorkResult>` (T-024-03, E-024)** —
  the `vend work` counter gesture: fund a macro-wallet once, walk away, spend it down across casts
  on the ranked board. The order of operations today:
  1. `readBoard(root, opts.boardPath)` → `no-board` if none readable.
  2. `parseBoardSignals(board.md)` → `empty-board` if zero signals.
  3. freshness gate (unless `opts.staleOk`): gather two mtimes, `isBoardStale` → `stale-board`.
  4. **`allocate(funded)`** — THE BUDGET-COMMIT POINT. Everything above is a pre-budget refusal.
  5. price the chain from the ledger; `spendDown(...)` casts the real chain per signal.
  6. return `{ kind: "spent"; session; funded }`.
- `WorkResult` is a tagged union: `no-board | empty-board | stale-board | spent`. Each non-`spent`
  kind is a **clean precondition refusal returned as DATA** — the CLI prints a hint and exits 1.
- **`castWork` is NOT unit-testable**: work.ts top-level `import`s `chain-propose-decompose.ts` →
  `decompose-epic.ts` → `../../baml_client/sync_client.ts`, which loads the BAML native addon at
  module eval. The house rule (file header) is explicit: "no `bun test` value-imports this module."
  Its branching is proven by its PURE core (`work-core.ts`, unit-tested) + LIVE smoke.

## The precedent patterns to mirror

- **`src/init/init-effect.ts` — `runInit` (T-040-03)**: the canonical "refuse-or-apply" gate.
  `runInit` checks `isLisaProject` BEFORE `applyInitScaffold`; a non-lisa root returns a typed
  `{ kind: "not-lisa"; root }` (DATA, nothing written) that the CLI maps to a fix-it hint + non-zero
  exit. A precondition refusal is a SUCCESSFUL stop, not a crash. **No override flag** — a hard gate.
- **The `stale-board` gate in `castWork`**: the existing precedent for a pre-budget refusal INSIDE
  `castWork` — a new `WorkResult` kind returned before `allocate`, rendered by the CLI, exit 1.
  Difference: stale-board IS overridable (`--stale-ok`) because mtime is a heuristic.

## CLI dispatch (`src/cli.ts`)

- The `work` arm (lines ~641–680): calls `castWork`, then matches each `WorkResult` kind. The three
  refusal kinds (`no-board`/`empty-board`/`stale-board`) `process.stderr.write(...)` + `exit(1)`;
  `stale-board` renders via `renderStaleBoard(result, {color:true})`. `spent` prints the receipt,
  exit 0. `parseWorkArgs` (line ~406) parses `--board` / `--stale-ok` / `--intervened`.
- **`vend doctor` standalone command (T-042-03) is NOT yet wired** — `grep doctor src/cli.ts`
  is empty. T-042-04 does NOT depend on T-042-03 (`depends_on: [T-042-02]` only); it composes the
  probe + renderer itself. (The same compose this ticket creates is reusable by T-042-03 later.)

## Constraints & assumptions surfaced

- The guard must be **addon-safe to value-import** so its precondition behaviour is unit-testable
  with injected deps — therefore it canNOT live in `work.ts`. It must live alongside the doctor
  modules (`src/doctor/`), composing `probeDoctor` + `renderDoctorReport`.
- "BEFORE any budget is spent" ⇒ the guard call in `castWork` must precede `allocate(funded)`
  (and, to "refuse at the door", precede the board read too — mirroring lisa's check-before-loop).
- "Same named-check + hint refusal" ⇒ the refusal text is `renderDoctorReport(...).report`
  verbatim — the doctor report IS the refusal surface, not a re-worded message.
- "Non-zero outcome / no partial metered run" ⇒ the gate returns a typed refusal kind BEFORE
  `allocate`/`spendDown`; nothing is metered, the run log is untouched, the CLI exits `exitCode` (1).
- "A wired env proceeds unchanged" ⇒ when `report.ok`, `castWork` falls through to its existing
  path byte-for-byte; the gate adds one resolved `probeDoctor` round-trip and no other change.
- Whether to add a `--skip-doctor` escape hatch: NOT in the AC. `runInit`'s `not-lisa` is a hard
  gate with no override; a broken dep is a hard environment fault (unlike the heuristic mtime), so
  the default stance is a hard gate (an override is a documented possible follow-up, not this slice).
