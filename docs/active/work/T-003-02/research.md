# Research — T-003-02 gather-persist-and-vend-entry

Descriptive map of the codebase as it bears on wiring the pure menu model
(T-003-01) to reality: gather structured inputs from `demand.md` + `lisa status`,
shape them into `Action[]`, rank → render → **persist `.vend/menu.json`** → print,
and make bare `vend` the browse surface. What exists, where, how it connects. No
solutions proposed here.

## The ticket in one line

Add `src/shelf/gather.ts` (the IMPURE verb that reads `demand.md` signals +
`lisa status` readiness, with the pure shaping unit-tested) and extend `src/cli.ts`
so bare `vend` does gather → `rankActions` → `renderMenu` → write `.vend/menu.json`
→ print, instantly (no LLM). The cache carries a freshness marker (timestamp +
state-hash) so T-003-04 can detect a materially-stale menu. Selection parsing is
T-003-03 (done); resolve + dispatch is T-003-04.

## What T-003-01 already delivered (the pure side this composes)

`src/shelf/menu.ts` is committed (`a204459`) and is the deterministic core:

- `type ValueTier = "keystone" | "high" | "standard" | "leaf"` — demand.md ranking.
- `type Readiness = "ready" | "blocked"`.
- `interface Action { id, title, tier, readiness, budget }` — `budget` is
  `src/budget/budget.ts`'s `Budget` (`{ timeMs, tokens }`), a type-only import.
- `interface MenuCache { version, generatedAt, stateHash, all, actions }` and
  `const MENU_CACHE_VERSION = 1`.
- `rankActions(actions) -> Action[]` — stable sort, tier then readiness, copies input.
- `visibleActions(actions, all?) -> Action[]` — the SINGLE shared filter (default
  hides `readiness === "blocked"` OR `tier === "leaf"`).
- `renderMenu(actions, opts?) -> string` — numbered visible rows + `(+K hidden …)`
  footer + empty-state guidance.
- `formatBudget(budget) -> string` — `2h/50k`-style human envelope.

T-003-01's review (`work/T-003-01/review.md`) leaves three binding instructions for
this ticket:
1. **Index contract:** persist `visibleActions(rankActions(actions), all)` (the SAME
   filter `renderMenu` uses) into `MenuCache.actions`, with the same `all`, so the
   numbers shown equal the persisted list. Do NOT re-derive the visible set.
2. **`generatedAt`/`stateHash` are this ticket's to fill** — the pure model only
   declares their shape. `generatedAt` is a clock read (impure); `stateHash` hashes
   the board state the menu was computed from.
3. **Numbering differs between `vend` and `vend --all`** by design — the cache
   records `all` plus the displayed list; T-003-04 reads against it, never recomputes.

## The inputs to gather

### `demand.md` (`docs/active/demand.md`) — the value model

Markdown prose + two pipe tables (`## Signals`, `## Kaizen signals`). Each table row
is one signal: a bold lead phrase (the name), a **Value** cell carrying a bold tier
(`**Keystone**`, `**High**`, `**Standard**`, `**Leaf**`), a Budget-envelope cell
(human prose like `~1 feature block (≈2h)`, `small (~1h)`, `tiny (mins)` — NOT a
machine `<ms>,<tokens>`), and a Status cell. Status cells reference a staged epic id
where one exists (`Spec staged → E-003`, `done → E-001`) and carry readiness words
(`ready`, `done`, `blocked`). demand.md is explicit: "Pull order is by value +
readiness, **not** ID order" and "Budget ∝ value: keystone → fat; leaf → thin."

Key consequence: the Budget envelopes in demand.md are **human prose, not
parseable numbers**. The Action's warranted `Budget` must be DERIVED from the tier
(a tier→envelope default), not parsed out of the cell. This matches "budget ∝ value"
and the fact that the only structured budget surface is `--budget <ms>,<tokens>`.

### `lisa status` — readiness

`lisa` is on PATH (`/opt/homebrew/bin/lisa`, obs 20298). `lisa status` prints a DAG
summary then per-wave ticket lines, e.g.:

```
  T-003-02      research  open  gather-persist-and-vend-entry  deps: T-003-01  blocks: T-003-04
  T-004-02      done  open  refuse-materialize-on-collision  deps: T-004-01 ...
```

Each line: ticket id, **phase** (`done`/`ready`/`research`/…), status (`open`), title,
then `deps:`/`blocks:`. Ticket ids encode their epic by prefix (`T-003-xx` ⇒ `E-003`).
So an epic's done-ness is derivable: an epic is **done** when it has tickets and all
are phase `done`. An epic with no tickets yet (a staged-but-undecomposed signal like
E-002) is precisely a *vendable* action — running `DecomposeEpic` on it is the play.

`lisa` exposes only `init|validate|status|setup-guide|doctor|version|loop` — there is
no machine/JSON status flag, so `status` stdout is the parse surface. lisa may be
absent in some environments; gather must degrade (empty readiness) rather than crash.

## The CLI entry to extend (`src/cli.ts`, from T-002-03)

Today: pure `parseBudgetArg` / `parseArgs` (tested) + a thin `import.meta.main`
shell that calls `runDecomposeEpic` and exits. `parseArgs` recognizes ONLY
`run decompose-epic <epic.md> --budget …`; anything else → a `usage` result. Bare
`vend` currently falls through to usage. This ticket adds a `browse` command for the
no-args (and `--all`) invocation. `vend <selection>` (a numeric arg) stays a usage
result here — T-003-04 (which also edits `cli.ts`, the R4 file-overlap edge) adds
selection dispatch. The house split must hold: parsing stays pure/tested; the impure
orchestration (gather → persist → print) lives behind a runner the shell calls, the
way `runDecomposeEpic` does — keeping the `import.meta.main` block thin.

## The house "pure core + impure verb" pattern (the precedent to match)

`src/play/project-context.ts` is the closest analogue: `buildProjectSnapshot(parts)`
is the PURE, test-pinned formatter; `assembleInputs` is the IMPURE verb (reads
files, walks `src/`, lists ids via `listIdsIn`) and is left untested — "its logic is
the pure formatter plus thin fs reads" (obs 20402). `src/play/id-guard.ts`
(`detectCollisions`) and `src/cli.ts` (`parseArgs`) are the same shape. So gather.ts
must factor every nontrivial decision into PURE functions (parse demand signals,
parse lisa done-epics, derive readiness/budget, shape `Action[]`, compute
`stateHash`), leaving only file reads, the `lisa` spawn, the clock, and `writeFile`
in the untested impure verb.

## The `.vend/` seam and freshness contract

`.vend/` exists (`runs.jsonl`, `decisions.jsonl`, `transcripts/`). `.gitignore` is
`.vend/*` with a single exception (`!.vend/decisions.jsonl`) — so `.vend/menu.json`
is runtime telemetry, NOT committed (correct: it is regenerated per browse). The
epic requires a "materially-stale menu warns 're-run vend' rather than acting on
stale indices," so `MenuCache.generatedAt` (ISO clock stamp) + `stateHash` (a
deterministic hash of the inputs the menu was computed from — demand.md text + lisa
output + the `all` flag) are the marker. T-003-04 recomputes the hash and compares.
The hash itself is PURE/deterministic (a string→string fold) and so is testable;
only the clock stamp and the file write are impure.

## Conventions to match

- **Module layout:** `src/shelf/<name>.ts` + co-located `<name>.test.ts`
  (`bun:test`, `describe/test/expect`). `src/shelf/` already holds `menu.ts`,
  `select.ts`.
- **Doc header:** ticket id + job + explicit PURITY note (what the impure verb does
  that the pure helpers do not); JSDoc PURE/TOTAL on each pure export.
- **Imports:** explicit `.ts` extensions; type-only imports for cross-module types
  (`import type { Action, Budget }`). Reuse `menu.ts`'s `rankActions`/`visibleActions`
  rather than re-implementing the filter (index contract).
- **Spawning:** `Bun.spawn` is the runtime (cf. the `claude`/`lisa` spawns in
  `decompose-epic.ts`); `node:fs/promises` `readFile`/`mkdir`/`writeFile` for I/O.
- **Testing:** plain fixtures, `toEqual` for exact arrays, golden strings; `bun run
  check:test` / `check:typecheck` green (AC#4).

## Boundaries / constraints / assumptions

- **In scope:** `src/shelf/gather.ts` (pure parsers + shaping + `stateHash`; impure
  `gather` + browse orchestration + `writeMenuCache`); the bare-`vend` `browse`
  branch in `src/cli.ts`; tests for the pure surface. Advances **P2**.
- **Out of scope:** selection parsing (T-003-03, done), resolve + dispatch / staleness
  *check* (T-003-04), any LLM salience (the deferred fork side), filters beyond
  `--all`, the full TUI.
- **Assumption — vendable today = epic-targeted signals.** The only play is
  `DecomposeEpic`, whose target is an epic file. So a signal becomes an `Action`
  only when it names a staged epic id (`E-###`) that is not already done. Kaizen
  signals without a staged epic (they'd get an id on pull) are not yet vendable and
  do not appear. With the current board this yields E-002 + E-003 (E-001 dropped as
  done). Documented as a v1 scoping choice, not a permanent limit.
- **Assumption — readiness is two-state.** `blocked` when the Status cell carries a
  blocking word; otherwise `ready`. Done epics produce no action at all.
- **Assumption — budget ∝ value (tier→default envelope).** demand.md budgets are
  prose, so the warranted `Budget` is a fixed per-tier default, overridable later via
  `--budget` (T-003-04). The numbers are calibration-pending (demand.md: set from the
  run-log fat tails once enough data exists).
- **Resilience:** a missing `demand.md` or a failed `lisa` spawn degrades to an
  empty/partial menu (`renderMenu` already renders `(no actions)`), never a crash —
  matching `listIdsIn`'s tolerance of an absent dir.
