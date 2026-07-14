# T-016-02 — Progress

Implementation log against `plan.md`. Zero deviations from the plan; the offline test
strategy held. The live cast is the human sweep (AC#4).

## Completed

### Step 1 — addon-free effect (`expand-effect.ts`) + test ✅
- `src/play/expand-effect.ts`: `STAGING_DIR = "docs/active/pm/staged"`, `ExpandFragmentInputs`,
  pure `slugify` + `renderStagedSignal`, and `expandFragmentEffect` (mkdir + writeFile under
  `pm/staged/<slug>.md`, returns `{ok, detail, artifacts:[path], produced:path}`). BAML imports
  type-only; value-imports only `renderSignalRow` (pure) + node:fs.
- `src/play/expand-effect.test.ts`: 7 tests — effect temp-dir write (row + pull string + trailer),
  **the staging-contract negative assertion** (no `demand.md`/`epic`/`stories`/`tickets` write),
  `clear → classify` wiring (grounded→materialize+3 rows; honest-empty→gate-failed; ungrounded→
  read-never-invent gate-failed), and `slugify`/`renderStagedSignal` pins. Green (7 pass, 29 expects).

### Step 2 — shell (`expand-fragment.ts`) ✅
- `PLAY`, `RunSummary` re-export, `EMPTY_SIGNAL` (placeholder tier — never rendered),
  `parseExpandFragment` (try/catch → empty), `expandFragmentPlay: Play<ExpandFragmentInputs, Signal>`
  (render via `extractPromptText(b.request.ExpandFragment…)`, `gates: clear(signal, {charter})`,
  `effect: expandFragmentEffect`, `budget: 20m/12k`, `card: blue/green permanent rare`),
  `registry.register(...)`, `ExpandFragmentOptions`, `assembleExpandFragmentInputs` (charter + light
  snapshot, NO `existingEpicIds`), `castExpandFragment`.
- Smoke (plain `bun`, not bun-test): registry shows `["expand-fragment"]`; `has` true; parse of
  garbage → empty `what`; the effect stages a faithful demand-row file under `pm/staged/`.

### Step 3 — gesture (`cli.ts`) + parse tests ✅
- `cli.ts`: `USAGE` line, `ParsedCommand` `expand` arm, `parseArgs` dispatch (`argv[0] === "expand"`),
  `parseExpandArgs` (fragment = non-flag tokens joined; `--budget` optional — the `parseChainArgs`
  shape), and the `import.meta.main` `expand` arm (lazy-imports the shell, `budget = parsed.budget ??
  expandFragmentPlay.budget`, prints the run summary, outcome → exit code).
- `cli.test.ts`: 5 `expand` parse pins mirroring the `chain` block (no-budget, multi/single-token
  join, `--budget` override, missing-fragment usage ×2, malformed-budget usage ×2).

### Step 4 — full gate ✅
- `bun run check` (baml:gen → typecheck → test): **511 pass / 0 fail** (was 499; +12 = 7 effect +
  5 CLI). `check:typecheck` green; `baml:gen` regenerated `baml_client` (gitignored, not committed).

## Deviations from plan
None. The `clear → classify` block was included in Step 1 (as plan.md flagged was possible, since
`clear` already exists from T-016-01) rather than deferred — no functional difference.

## Files touched
- created: `src/play/expand-effect.ts`, `src/play/expand-effect.test.ts`, `src/play/expand-fragment.ts`
- modified: `src/cli.ts`, `src/cli.test.ts`
- artifacts: `docs/active/work/T-016-02/{research,design,structure,plan,progress,review}.md`
- generated (not committed): `baml_client/**`
- untouched: `expand-core.ts`, `expand.baml`, `expand-bridge.ts`, engine, propose/note/decompose.

## Not done here (by design)
- The **live cast** (`vend expand "<a real rough fragment>"` → a real staged file) is the human
  verification at sweep (AC#4) — no billed model in CI.
- No measured E-013 budget pre-fill on the staged signal yet — the model proposes a rough `budget`
  string; wiring the measured `recalibrate` envelope into the staged row is a documented follow-up
  (carried over from T-016-01's open concern #1).
