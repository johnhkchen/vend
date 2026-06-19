# T-011-02 Plan — propose-decompose-chain-and-gesture

Ordered, independently-verifiable steps. Each ends green (`tsc --noEmit` + `bun test`) and is
committable. Testing strategy is inline per step.

## Step 1 — `PlayStep.opts` derivable from upstream (engine/chain.ts)

- Add `export type StepOptions = CastOptions | ((upstream: string | undefined) => CastOptions);`
- Change `PlayStep.opts` to `StepOptions`; doc-comment the function form.
- In `castChain`'s `cast` thunk, resolve: `const opts = typeof s.opts === "function" ?
  s.opts(upstream) : s.opts;` then `castPlay(s.play, inputs, s.budget, opts)`.
- **Verify:** `tsc --noEmit` clean; `bun test` still 331 pass (chain.ts is untested but the type
  must compile; chain-core unaffected).
- **Why first:** the chain module (step 2) depends on the function-opts form.

## Step 2 — `castProposeDecomposeChain` (play/chain-propose-decompose.ts)

- New module per structure §2. Export `ChainProposeDecomposeOptions`,
  `epicSubjectFromPath(epicPath)` (pure: `epicPath.split("/").pop() ?? epicPath` → strip `.md`;
  fall back to the full path if empty), and `castProposeDecomposeChain(opts)`.
- Build the two `PlayStep`s (ProposeEpic static opts; DecomposeEpic function opts deriving the
  subject); `return castChain(steps);`.
- Full module header: addon-loading ⇒ not bun-test-imported; PE-1 single-signal; acyclic; logic
  proven by `runChain` + the offline thread test + live sweep.
- **Verify:** `tsc --noEmit` clean (the `PlayStep<any,any>[]` element type compiles; the
  function-opts and async adapt typecheck). `bun test` unchanged (no test imports this yet).

## Step 3 — offline thread proof (play/chain-propose-decompose.test.ts)

- Real-temp-dir test, addon-free imports only: `proposeEpicEffect`/`EPIC_DIR`/`ProposeEpicInputs`
  (propose-effect.ts), `assembleInputs` (project-context.ts), `materialize` (materialize.ts),
  `CastContext` (engine/play.ts), `EpicCard`/`WorkPlan`/draft types (baml_client, TYPE-ONLY).
- Reuse the `FULL_CARD` / `CHARTER` / `seedRoot` shape from propose-effect.test.ts. The charter
  must live at `docs/knowledge/charter.md` under the temp root (assembleInputs reads it) — seed it.
- **Case A (signal→epic→exact thread):** `proposeEpicEffect(FULL_CARD, ctx)` → `produced` =
  `<root>/docs/active/epic/E-0XX.md`; read that file; then `assembleInputs({ epicPath: produced,
  projectRoot: root })` and assert `inputs.epic === <file contents>` and contains the minted id +
  `FULL_CARD.serves`. This is "the threaded epic is the exact one ProposeEpic minted."
- **Case B (epic→tickets):** build a minimal typed `CANNED_PLAN: WorkPlan` (1 story + 1 ticket,
  ids disjoint from the seeded board, e.g. `S-900` / `T-900-01`), `materialize(CANNED_PLAN,
  { storiesDir: <root>/docs/active/stories, ticketsDir: <root>/docs/active/tickets })`; assert the
  ticket + story files exist and contain the planned ids.
- **Case C (subject derivation):** assert the basename-of-`produced` derivation yields the minted
  id (inline regex, mirroring `epicSubjectFromPath`'s contract — NOT imported, to keep the addon
  out of this bun-test process).
- **Verify:** `bun test` — new file adds ~3 cases, all pass; no addon loaded (confirm the test
  process does not crash on a second BAML call — it makes none).

## Step 4 — chain-core STOP-halt assertion for this ticket (engine/chain-core.test.ts)

- Add one `describe`/`test` framed as "AC: a ProposeEpic STOP halts before DecomposeEpic": a
  two-step chain, step 1 → `summary("gate-failed")`, step 2 → `neverStep`; assert
  `result.halted === true`, `result.steps.length === 1`, `result.outcome === "gate-failed"`.
  (The generic T-011-01 cases already prove this; this names it to the chain semantics. If judged
  redundant at implementation, add a comment pointer instead and skip — note the choice in
  progress.md.)
- **Verify:** `bun test` green.

## Step 5 — the `chain` gesture parse (cli.ts) + tests (cli.test.ts)

- `cli.ts`: extend `USAGE`; add `chain` to `ParsedCommand`; route `argv[0] === "chain"` to a new
  PURE `parseChainArgs`; collect positionals + optional `--budget` (mirror `parseSelectOrBrowse`).
  Missing signal → usage; malformed budget → usage; signal = positionals joined by space.
- `cli.test.ts`: add the parse cases from structure §6.
- **Verify:** `bun test` — new parse cases pass; existing parse cases unchanged.
- **Note:** parsing is pure and fully tested here; the `import.meta.main` dispatch arm is the
  untested impure shell (the established cli pattern).

## Step 6 — the `chain` dispatch arm (cli.ts `import.meta.main`)

- Add the `chain` arm per structure §5: lazy-import `castProposeDecomposeChain`, run it, print one
  line per `result.steps` entry, print `haltReason` to stderr if halted, exit 0 only on
  `outcome === "success" && !halted`.
- **Verify:** `tsc --noEmit` clean. (The arm itself is exercised by the live sweep, not a unit
  test — it spawns. A non-`import.meta.main` import does not run it, so `bun test` is unaffected.)

## Step 7 — full gate + commit(s)

- `bun run check` (baml:gen → tsc → bun test): expect ~335 pass (331 baseline + the new
  chain-thread cases + cli chain parse cases).
- `bun run check:committed` and `bun run check:head` green.
- Commit. Suggested two commits: (1) steps 1–4 "castProposeDecomposeChain + offline thread proof";
  (2) steps 5–6 "vend chain <signal> gesture". Or one cohesive commit if cleaner. Conventional
  message: `T-011-02: propose→decompose chain + \`vend chain\` gesture (E-011)`.

## Testing strategy summary

| Concern | How proven | Where |
|--------|-----------|-------|
| thread `produced` → next input | pure unit (fake casts) | chain-core.test.ts (T-011-01) |
| STOP halts before downstream | pure unit | chain-core.test.ts (re-asserted, step 4) |
| ProposeEpic produces the epic path | real-fs effect test | propose-effect.test.ts + step 3 A |
| the threaded epic is the EXACT minted one | real-fs reconstruction | step 3 case A |
| epic → tickets materialize | real-fs | step 3 case B |
| run-log subject derivation | inline assertion | step 3 case C |
| the gesture parses | pure unit | cli.test.ts (step 5) |
| end-to-end live (signal in → tickets out) | **human sweep** | AC#4 |

## Risks / watch-items

- **`noUncheckedIndexedAccess`:** the decompose adapter's `upstream` is `string | undefined`;
  `assembleInputs` wants a `string`. Guard or `as string` with the documented invariant
  (`runChain` never casts a non-first step with an absent upstream — chain-core.ts:53,112).
- **Addon-in-bun-test:** the test must import ZERO addon-loading module. Double-check imports in
  step 3 resolve only to addon-free files (propose-effect, project-context, materialize, play
  types). Do NOT import `chain-propose-decompose.ts` from the test.
- **Charter path in the temp root:** `assembleInputs` reads `docs/knowledge/charter.md`; the test
  must seed it or `assembleInputs` throws ENOENT.
