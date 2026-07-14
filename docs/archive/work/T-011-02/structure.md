# T-011-02 Structure — propose-decompose-chain-and-gesture

File-level blueprint. Shape of the code, not the code. Ordering noted where it matters.

## 1. MODIFY `src/engine/chain.ts` — `PlayStep.opts` derivable from upstream

The only primitive change. Make the per-step cast options optionally depend on the upstream
`produced` (so a step can name its run-log record from the threaded value — D3).

```
export type StepOptions = CastOptions | ((upstream: string | undefined) => CastOptions);

export interface PlayStep<I, O> {
  readonly play: Play<I, O>;
  readonly budget: Budget;
  readonly opts: StepOptions;                                  // was: CastOptions
  readonly adapt: (upstream: string | undefined) => I | Promise<I>;
}
```

In `castChain`'s per-step `cast` thunk, resolve opts against the same `upstream` the adapter sees:

```
cast: async (upstream) => {
  const inputs = await s.adapt(upstream);
  const opts = typeof s.opts === "function" ? s.opts(upstream) : s.opts;
  return castPlay(s.play, inputs, s.budget, opts);
}
```

- Boundary: still imports engine + `Budget` only — never `src/play/`. Acyclic preserved.
- Doc-comment the function form: "a step MAY derive its cast options (e.g. the run-log `subject`)
  from the threaded `upstream`, resolved at cast time."
- Backward-compatible: a static `CastOptions` is still a valid `StepOptions`. No existing callers.

## 2. CREATE `src/play/chain-propose-decompose.ts` — the concrete chain (impure shell)

The convergence node of E-011. Public surface:

```
export interface ChainProposeDecomposeOptions {
  readonly signal: string;                 // the ONE pulled demand signal (PE-1)
  readonly budget?: Budget;                // optional override applied to BOTH steps
  readonly projectRoot?: string;           // default process.cwd()
  readonly model?: string;
  readonly transcriptDir?: string;
}

/** Derive the epic id (run-log subject) from a minted epic path. Pure, exported for the test. */
export function epicSubjectFromPath(epicPath: string): string;   // basename, strip ".md"

export async function castProposeDecomposeChain(
  opts: ChainProposeDecomposeOptions,
): Promise<ChainResult>;
```

Internal shape of `castProposeDecomposeChain`:
- `const root = opts.projectRoot ?? process.cwd();`
- Build `steps: PlayStep<any, any>[]` (the same documented type-erasure as `AnyPlay`):
  - **Step 1 — ProposeEpic:**
    - `play: proposeEpicPlay`
    - `budget: opts.budget ?? proposeEpicPlay.budget`
    - `opts: { subject: opts.signal, projectRoot: root, model: opts.model, transcriptDir: opts.transcriptDir }`
    - `adapt: () => assembleProposeEpicInputs({ signal: opts.signal, budget: <step budget>, projectRoot: root, model: opts.model, transcriptDir: opts.transcriptDir })`
  - **Step 2 — DecomposeEpic:**
    - `play: decomposeEpicPlay`
    - `budget: opts.budget ?? decomposeEpicPlay.budget`
    - `opts: (upstream) => ({ subject: epicSubjectFromPath(upstream ?? ""), projectRoot: root, model: opts.model, transcriptDir: opts.transcriptDir })`
    - `adapt: async (upstream) => assembleInputs({ epicPath: upstream as string, projectRoot: root })`
- `return castChain(steps);`

Imports (value): `castChain`, `type PlayStep`, `type ChainResult` from `../engine/chain.ts`;
`proposeEpicPlay`, `assembleProposeEpicInputs` from `./propose-epic.ts`; `decomposeEpicPlay` from
`./decompose-epic.ts`; `assembleInputs` from `./project-context.ts`; `type Budget`.

- Module header documents: addon-loading (imports both plays' `b`) ⇒ NOT `bun test`-imported;
  its logic is `runChain` (tested) + the offline thread proof + live sweep. PE-1: one `signal`,
  no board read. Acyclic: a `src/play/` citizen importing UP onto the engine + plays.

## 3. CREATE `src/play/chain-propose-decompose.test.ts` — offline thread proof (AC#3)

Real-temp-dir test (propose-effect.test.ts discipline). Imports ONLY addon-free modules:
`proposeEpicEffect` + `EPIC_DIR` + types (propose-effect.ts), `assembleInputs` +
`buildProjectSnapshot`? no — just `assembleInputs` (project-context.ts), `materialize`
(materialize.ts), `epicSubjectFromPath` (the new chain module — **safe to import**: that one
exported helper is pure and the module *does* load the addon at import… ).

> ⚠ Import caveat: `chain-propose-decompose.ts` value-imports the plays (addon), so a `bun test`
> importing it would load the addon. Therefore `epicSubjectFromPath` must NOT be imported from
> there in a bun test. **Resolution:** keep `epicSubjectFromPath` tiny and duplicate the one-line
> assertion inline in the test (assert the basename derivation directly), OR place
> `epicSubjectFromPath` in an addon-free module. Chosen: assert the derivation inline in the test
> (it is `path.split("/").pop()!.replace(/\.md$/, "")`); `epicSubjectFromPath` stays defined in
> the chain module for the runtime, mirrored by an inline assertion in the test. (See plan step 4.)

Test cases:
1. **signal→epic→thread**: seed a temp board (charter + epics), run `proposeEpicEffect(FULL_CARD,
   ctx)` → `res.produced` is the minted `E-0XX.md` path. Then `assembleInputs({ epicPath:
   res.produced, projectRoot: root })` → `.epic` equals the file ProposeEpic wrote (read it back),
   and contains the minted id + the card's `serves`/`intent` — the threaded epic is the exact one
   minted.
2. **epic→tickets**: `materialize(CANNED_PLAN, { storiesDir, ticketsDir })` under the same root →
   ticket + story files exist on disk with the planned ids.
3. **subject derivation**: the minted path → its basename id (e.g. `E-010`).

(The constants `FULL_CARD` / `CHARTER` mirror propose-effect.test.ts; `CANNED_PLAN` is a minimal
`WorkPlan` with 1 story + 1 ticket, ids disjoint from the seeded board, built directly as typed
literals — no model.)

## 4. MODIFY `src/engine/chain-core.test.ts` — re-assert STOP-halts for this ticket (optional)

Add one focused case to the existing suite, framed to T-011-02's AC: a two-step chain where step 1
returns a `gate-failed` summary → step 2 (a `neverStep`) never runs; `halted: true`. This is the
"a ProposeEpic STOP halts before DecomposeEpic" guarantee at the pure-core level. (The existing
T-011-01 cases already cover this generically; this adds the ticket-named assertion. Keep DRY —
may be a comment pointer instead if redundant.)

## 5. MODIFY `src/cli.ts` — the `chain` gesture

- `USAGE` string: append the chain form, e.g.
  `usage: vend run <play> <epic.md> --budget <ms>,<tokens> | vend chain <signal> [--budget <ms>,<tokens>]`.
- `ParsedCommand` union: add `{ readonly cmd: "chain"; readonly signal: string; readonly budget?: Budget }`.
- `parseArgs`: before the generic tail, add `if (argv[0] === "chain") return parseChainArgs(argv);`
- New PURE `parseChainArgs(argv)`:
  - Collect positionals after `chain` and an optional `--budget <v>` (mirror
    `parseSelectOrBrowse`'s flag handling).
  - No positional signal → `{ cmd: "usage", error: "missing <signal>" }`.
  - `--budget` present but malformed/blank → `usage` with the parse error.
  - Signal = positionals joined with a space (so a multi-word unquoted signal round-trips, and a
    quoted one passes through as one token).
  - Return `{ cmd: "chain", signal, budget? }`.
- `import.meta.main` dispatch: add a `chain` arm BEFORE the `run` fall-through:
  ```
  if (parsed.cmd === "chain") {
    const { castProposeDecomposeChain } = await import("./play/chain-propose-decompose.ts");
    const result = await castProposeDecomposeChain({ signal: parsed.signal, budget: parsed.budget });
    for (const s of result.steps) process.stdout.write(`run ${s.runId}: ${s.outcome} (materialized: ${s.materialized})\n`);
    if (result.halted) process.stderr.write(`chain halted: ${result.haltReason}\n`);
    process.exit(result.outcome === "success" && !result.halted ? 0 : 1);
  }
  ```
  Lazy import keeps the addon off the pure-parse path (the established arm discipline).

## 6. MODIFY `src/cli.test.ts` — parse cases for `chain`

- `chain <signal>` (no budget) → `{ cmd: "chain", signal: "<signal>" }`.
- `chain "a pulled signal"` single token and `chain a pulled signal` multi-token → both join to
  the same signal string.
- `chain <signal> --budget 100,200` → carries the `Budget`.
- `chain` with no signal → `{ cmd: "usage", error: "missing <signal>" }`.
- `chain <signal> --budget nope` → `cmd: "usage"`.

## Ordering

1 (primitive) → 2 (chain module, depends on 1) → 3 (test for 2) → 5 (cli, depends on 2) → 6 (cli
test) → 4 (chain-core test, independent). Commit after the primitive+module+test are green, then
after the gesture+tests.

## Files NOT touched

- `src/shelf/press.ts` — board-drain gesture, out of scope per D4 (PE-1).
- `propose-epic.ts` / `decompose-epic.ts` / `propose-effect.ts` / `project-context.ts` /
  `materialize.ts` — reused as-is; no change needed (the `produced` thread + assemblers already
  exist from T-011-01 / E-009).
