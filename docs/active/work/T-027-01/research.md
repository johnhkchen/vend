# T-027-01 Research — board-freshness-gate

Descriptive map of the code the freshness gate touches. No solutions here — that's Design.

## The failure this gate answers

`work/T-025-01/sweep-logs/findings.md` records the concrete incident: E-025's live re-sweep spent the
macro-wallet down `steer.md` and cleared its #1 signal ("run the E1 measurement sprint") into a real
epic (E-026) — but `steer.md` was staged at **11:54** while the project had moved through the whole
measurement sprint + the E-024/E-025/E-026 builds by **22:30**. The spend was mechanically correct;
the board was ~10h stale, so the work it cleared rested on a premise (*E-014 is HOLD*) resolved hours
earlier. A wallet spent on a stale board is **overproduction** — the most expensive kind because it
looks like progress. Finding #2 in that file ends: "`vend work` should freshness-check the board
before spending." That is exactly this ticket.

## The `vend work` path (where the gate lands)

Two-file split, the house ENGINE ⊥ PLAY / pure-core discipline:

- **`src/play/work.ts`** — the IMPURE composition shell. `castWork(opts: WorkOptions): Promise<WorkResult>`:
  1. `readBoard(root, opts.boardPath)` (~80) — tries an explicit `--board`, else the `DEFAULT_BOARDS`
     steer→survey fallback; returns `{ md, path } | null` (ENOENT = "not this board", skip).
  2. `parseBoardSignals(board.md)` → ranked signals; `[]` ⇒ `empty-board`.
  3. `allocate(funded)` (~112) — **funds the wallet**. The freshness gate must sit BEFORE this.
  4. prices the chain once from the ledger (`recalibrate`), then drives `spendDown` casting
     `castProposeDecomposeChain` per signal.
  - `WorkResult` union (~66): `no-board` | `empty-board` | `spent`. The gate adds a 4th: `stale-board`.
  - `WorkOptions` (~48): `budget` | `boardPath` | `projectRoot` | `model` | `onStep`. The gate adds
    `staleOk`.
  - Already imports `readFile` from `node:fs/promises` and `join` from `node:path`. Needs `readdir` +
    `stat` (or `readFile`'s sibling `stat`) added for the mtime gather.
  - Header declares the module IMPURE and explicitly NOT unit-tested (it value-imports the BAML addon
    via the chain), so any unit-tested logic must live in the pure core, not here.

- **`src/play/work-core.ts`** — the PURE core (no fs/clock/addon). Holds `parseBoardSignals`,
  `labelForSignal`, `formatStepSignal`, `renderReceipt`. This is where a pure `isBoardStale` decision
  and a pure `renderStaleBoard` andon-render belong — they're unit-tested in `work-core.test.ts`.
  - Has the `amber(s, on)` helper (ANSI 33, IA-9 — andon is amber, never red), gated by `on` so the
    pure text stays assertable. The stale-board render reuses this exact stance.
  - No date/time formatter exists yet; `fmtDur`/`fmtTok` format spans, not absolute timestamps.

- **`src/cli.ts`** — the impure dispatch shell (`import.meta.main`).
  - `parseWorkArgs` (~369) — PURE parser: `--budget` (optional, real default), `--board` (optional).
    Returns the `work` `ParsedCommand` variant (~51): `{ cmd, budget?, board? }`. The gate adds a
    `--stale-ok` presence flag (like `run`'s `--no-gates`/`--intervened` — `argv.includes`) → `staleOk?`.
  - The `work` dispatch arm (~586) — lazy-imports `castWork` + work-core renderers, streams `onStep`,
    then branches on `result.kind`: `no-board` → stderr + exit 1; `empty-board` → stderr + exit 1;
    `spent` → `renderReceipt` + exit 0. The gate adds a `stale-board` branch: amber andon to stderr,
    exit 1 (like the other broken-precondition outcomes — the ticket is explicit).
  - `USAGE` (~16) — the `work` line needs `[--stale-ok]` appended.

- **`src/cli.test.ts`** — pure parser tests. The `work` block (~210–239) covers no-budget / `--budget` /
  `--board` / malformed / unexpected-positional. `--stale-ok` extends this block.

## The staleness signal — mtime, and the precedent for scanning the active dirs

The board is stale iff `boardMtime < newest mtime across docs/active/{epic,stories,tickets}`.

- **`src/graph/load.ts`** is the precedent for scanning those three dirs. `readNodes(dir)` does
  `readdir(dir)` (ENOENT → `[]`, tolerant of a partly-scaffolded board), filters `*.md`, skips
  `TEMPLATE.md`. `loadWorkGraph` reads `docs/active/epic`, `docs/active/stories`, `docs/active/tickets`
  in parallel. The freshness gather mirrors this readdir-per-dir idiom but takes `stat().mtimeMs` and a
  running max instead of file bodies — the no-shared-util idiom (load.ts returns parsed nodes, we need
  the newest mtime; don't couple).
- `node:fs/promises` `stat` returns `mtimeMs` (a float ms since epoch). `work.ts` already imports from
  `node:fs/promises`, so adding `stat`/`readdir` is one import line.

## Staleness precedent elsewhere (shape to echo, not reuse)

`src/shelf/press-core.ts` already models a "don't act on a stale snapshot" guard: the persisted
`.vend/menu.json` is `stale` iff its `stateHash`/schema version no longer matches a fresh read, and the
CLI renders "menu is stale (board changed since `vend`) — re-run `vend`" + exit 1 (`src/cli.ts` ~514).
Same *stance* (refuse + hand back the re-derive move), different signal (a content hash of the demand
board vs. an mtime of the staged board). The work gate is the macro-wallet analogue. Not reused — the
press guard hashes demand.md content; this gate compares staged-board mtime to the decomposed-state
mtime. Different inputs, parallel shape.

## House invariants that constrain the design

- **ENGINE ⊥ PLAY / pure-core testability:** the unit-tested decision (`isBoardStale`) and render
  (`renderStaleBoard`) must be pure and live in `work-core.ts`; the fs gather (stat/readdir) stays in
  the impure `work.ts`. This is the same split work.ts/work-core.ts already enforce.
- **IA-9 (andon = successful refusal, amber):** a stale board is a *refusal*, rendered amber via the
  existing `amber()` helper, never red, never a thrown crash. But it exits 1 like no-board/empty-board
  (the ticket pins this — a broken precondition, not the `spent` 0-exit).
- **IA-5 (recommend-never-auto):** the override is an explicit `--stale-ok`; the gate must NOT
  auto-re-survey (that would silently spend the wallet on unfunded survey/steer work). Out of scope.
- **IA-8 (two denominations) / IA-1 (the board is ranked demand):** unaffected — the gate runs before
  any wallet funding or cast.
- **Honest caveat:** mtime is a heuristic — a `git checkout` can reset it. The code + the andon copy
  must say so, and `--stale-ok` is the escape hatch. Not a hard lock.

## Constraints / assumptions surfaced

- `stat().mtimeMs` is a float; compares are exact-`<`. Fresh-on-tie (equal ⇒ fresh) is the chosen
  boundary (a board re-staged at the same instant as the last change is current).
- A project with NO active files (`newest = 0`): `isBoardStale(boardMtime, 0)` ⇒ `boardMtime < 0` ⇒
  false ⇒ fresh. Correct — there is no live state to be stale against.
- The gather reads only mtimes, never bodies — cheap, no parse, no addon. Tolerant of missing dirs
  (ENOENT → skip), matching load.ts.
- Live proof is free + deterministic: against the current `steer.md` (11:54) the gate refuses without
  any LLM cast (`find … -newer steer.md` confirms many active files are newer); `--stale-ok` proceeds.
