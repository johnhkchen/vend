# Structure — T-003-04 vend-select-resolve-and-dispatch

The blueprint: files, public interfaces, internal organization, ordering. Not code.

## Files

| File | Action | Purpose |
|---|---|---|
| `src/shelf/press-core.ts` | **new** (~90 ln) | PURE: epic-path derivation, staleness compare, run planning, result/opts types. BAML-free → unit-testable. |
| `src/shelf/press.ts` | **new** (~75 ln) | IMPURE shell: read cache → re-gather → staleness → parse → plan → dispatch. Value-imports `runDecomposeEpic` (loads BAML addon at runtime — fine in a `bun` CLI process). Re-exports `press-core`. |
| `src/shelf/press-core.test.ts` | **new** (~110 ln) | Fixture tests for the three pure helpers. Imports ONLY `press-core.ts` → no addon. |
| `src/cli.ts` | **modify** | Add `select` to `ParsedCommand`; `parseArgs` routes selection-shaped argv to `select`; `import.meta.main` gains a lazy-import `select` arm. |
| `src/cli.test.ts` | **modify** | Update the two placeholder assertions (44-48) to select; add select-parse cases. |

No deletions. `.vend/menu.json` stays gitignored runtime telemetry.

## `src/shelf/press-core.ts` — public interface (PURE)

```
EPIC_DIR = "docs/active/epic"                       // const

interface PlannedRun { id: string; epicPath: string; budget: Budget }

interface PressOpts {                                // input to pressShelf
  selection: string; all?: boolean; budget?: Budget;
  projectRoot?: string; demandPath?: string;
}

type PressResult =                                   // pressShelf's discriminated return
  | { kind: "no-menu";       cachePath: string }
  | { kind: "stale" }
  | { kind: "bad-selection"; error: SelectionError }
  | { kind: "dispatched";    runs: RunSummary[] }

epicPathFor(root: string, id: string): string
  // join(root, EPIC_DIR, `${id}.md`)

isMenuStale(cache: MenuCache, fresh: {demand;lisa}, pressAll: boolean): boolean
  // cache.version !== MENU_CACHE_VERSION
  //   || cache.stateHash !== stateHash({demand, lisa, all: pressAll})

planRuns(cache: MenuCache, indices: readonly number[], root: string,
         override?: Budget): PlannedRun[]
  // indices PRE-VALIDATED by parseSelection ⇒ actions[i-1] is always present;
  // budget = override ?? action.budget
```

**Imports (all BAML-free):** `join` (node:path, value); `stateHash` (gather.ts,
value — gather has no addon import); `type MenuCache, MENU_CACHE_VERSION` (menu.ts —
`MENU_CACHE_VERSION` is a value import for the version check); `type Budget`
(budget.ts); `type SelectionError` (select.ts, type-only); **`type RunSummary`
(decompose-epic.ts — `import type`, erased, NO runtime addon load).** The `import type`
on `RunSummary` is the linchpin that keeps this module addon-free.

## `src/shelf/press.ts` — the impure shell

```
export * from "./press-core.ts"

pressShelf(opts: PressOpts): Promise<PressResult>
  1. root = opts.projectRoot ?? process.cwd()
  2. cachePath = join(root, MENU_CACHE_FILE)
  3. read+JSON.parse cache; on throw OR shape-invalid (actions not array)
       → return { kind: "no-menu", cachePath }
  4. { demand, lisa } = await gather({ projectRoot: root, demandPath: opts.demandPath })
  5. if isMenuStale(cache, {demand, lisa}, opts.all ?? false)
       → return { kind: "stale" }
  6. try indices = parseSelection(opts.selection, cache.actions.length)
       catch SelectionError e → return { kind: "bad-selection", error: e }
       (re-throw non-SelectionError — a genuine bug)
  7. planned = planRuns(cache, indices, root, opts.budget)
  8. runs = []; for run of planned (IN ORDER):
       runs.push(await runDecomposeEpic({ epicPath: run.epicPath, budget: run.budget,
                                          projectRoot: root }))
  9. return { kind: "dispatched", runs }
```

**Imports:** `readFile` (node:fs/promises); `join` (node:path); `gather`,
`MENU_CACHE_FILE` (gather.ts); `parseSelection`, `SelectionError` (select.ts);
`type MenuCache` (menu.ts); **`runDecomposeEpic` (decompose-epic.ts — value import,
the addon load)**; `isMenuStale`, `planRuns`, types (press-core.ts).

Note step 8 passes no `model` — `--model` is out of scope; omitting ⇒ CLI default
(RunOptions.model optional). `runDecomposeEpic` streams live + appends one log record
per call, so the loop needs no print/log code of its own.

## `src/cli.ts` — modifications

### `ParsedCommand` (add one arm)
```
| { cmd: "select"; selection: string; all: boolean; budget?: Budget }
```

### `parseArgs` (restructure the tail)
```
if (argv.length === 0) return { cmd: "browse", all: false }     // unchanged
if (argv[0] === "run")  return <existing run-parse block, unchanged>
return parseSelectOrBrowse(argv)                                 // new
```

### `parseSelectOrBrowse(argv)` — new pure helper in cli.ts
```
walk argv:
  "--all"            → all = true
  "--budget"         → budgetVal = next token (consume it)
  else               → positional.push(token)
if "--budget" present but budgetVal missing/blank → usage("missing --budget …")
if budgetVal present: budget = parseBudgetArg(budgetVal)  (catch → usage(e.message))
if positional empty:
  return all ? { cmd:"browse", all:true } : usage("missing selection")
if !positional.every(t => /^[\d\s,-]+$/.test(t)):
  return usage(`unknown command: ${positional[0]}`)
return { cmd:"select", selection: positional.join(","), all, ...(budget?{budget}:{}) }
```
This subsumes the old `argv.every(a=>a==="--all")` browse-all line (now: positional
empty + all → browse all).

### `import.meta.main` (add the `select` arm, after `browse`)
```
if (parsed.cmd === "select") {
  const { pressShelf } = await import("./shelf/press.ts")
  const r = await pressShelf({ selection: parsed.selection, all: parsed.all,
                               budget: parsed.budget })
  switch (r.kind) {
    "no-menu":       stderr `no menu at ${r.cachePath} — run \`vend\` first`; exit 1
    "stale":         stderr `menu is stale (board changed since \`vend\`) —
                            re-run \`vend\`${parsed.all?" --all":""}`; exit 1
    "bad-selection": stderr `${r.error.message}`; exit 2
    "dispatched":    for s of r.runs: stdout `run ${s.runId}: ${s.outcome}
                            (materialized: ${s.materialized})`
                     exit r.runs.every(s=>s.outcome==="success") ? 0 : 1
  }
}
```

## Ordering of changes (also the Plan's spine)

1. `press-core.ts` (pure) + `press-core.test.ts` — lands & goes green with zero coupling
   to the addon or the CLI. The highest-leverage, independently-verifiable unit.
2. `cli.ts` parseArgs + `cli.test.ts` — pure parser change, green in isolation.
3. `press.ts` (impure shell) wiring core → gather → select → runner.
4. `cli.ts` `import.meta.main` select arm (lazy import of press.ts).
5. Manual smoke (`vend`, then `vend <sel>`, stale, out-of-range) + full suite + typecheck.

## Invariants the structure preserves

- **`cli.test.ts` loads no addon** — `press.ts` is only ever lazily imported inside
  `import.meta.main`, never at `cli.ts` module top level.
- **`press-core.test.ts` loads no addon** — `RunSummary` enters via `import type` only.
- **Index contract** — resolution is `cache.actions[i-1]`, no re-rank/re-filter.
- **Validate-before-dispatch** — `parseSelection` (step 6) precedes `planRuns`/dispatch.
- **One log record per pick** — structural via `runDecomposeEpic`, no added log code.
