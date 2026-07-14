# T-027-01 Design — board-freshness-gate

The ticket prescribes the house shape (pure decision + impure gather + new outcome + CLI render). The
real design choices are the seams: where each piece lives, the staleness boundary, the timestamp
render, and what stays out. Each is decided against the Research map, not assumptions.

## D1 — Where the pure decision lives

**Options:**
- (a) `isBoardStale` in `work-core.ts` (the existing pure core for `vend work`).
- (b) A new `src/play/freshness.ts` module.
- (c) Inline the `boardMtime < liveMtime` compare in `work.ts`.

**Decision: (a).** `work-core.ts` already IS "the pure, unit-tested half of the counter gesture" and
already holds the other pure decisions (`parseBoardSignals`) and renders (`renderReceipt`,
`formatStepSignal`) with the `amber()` IA-9 helper right there. A one-line predicate plus its andon
render belong with their siblings; a new module (b) is ceremony for ~2 functions and splits the work
render across two files. (c) fails the unit-test AC — `work.ts` value-imports the BAML addon so `bun
test` can't touch it; the decision must be pure-core. Rejected (b)/(c).

## D2 — The staleness boundary (fresh-on-tie)

`isBoardStale(boardMtimeMs, liveMtimeMs) = boardMtimeMs < liveMtimeMs`.

- board **older** than live ⇒ `true` (stale) — the failure case.
- board **newer** ⇒ `false` (fresh) — staged after the last change, current.
- **equal** ⇒ `false` (fresh-on-tie). A board re-staged at the same instant the project last moved is
  current, not stale; `<` (not `<=`) encodes that. The AC pins equal ⇒ fresh explicitly.

No I/O, no clock, total. Rejected a tolerance window (`board < live - epsilon`): the ticket says
mtime-exact, and a fudge factor is an undocumented second heuristic on top of an already-heuristic
signal — `--stale-ok` is the honest escape hatch, not a silent slop band.

## D3 — The impure mtime gather

A private helper in `work.ts`: `newestActiveMtimeMs(root): Promise<number>` — the newest `mtimeMs`
across `*.md` files in `docs/active/{epic,stories,tickets}`.

**Mirror, don't reuse, `load.ts`.** `loadWorkGraph` reads the same three dirs but returns parsed
`RawNode` bodies; we need only the max mtime. Coupling to it would drag frontmatter parsing + the BAML-
free graph builder onto the gather path for nothing. The no-shared-util idiom (load.ts's own header
invokes it): do the thin readdir+stat here.

- `readdir(dir)` per dir, ENOENT/any error → skip (tolerant of a partly-scaffolded board, the load.ts
  precedent). Filter `*.md`. (Skipping `TEMPLATE.md` is optional — a template's mtime rarely dominates
  and including it can only make the board look *more* stale, never less; mirror load.ts and skip it
  for fidelity to "real nodes," but it is not load-bearing.)
- `stat(join(dir, name)).mtimeMs`, keep a running `max`, start `0`. Per-file stat error → skip.
- Returns `0` when there are no active files at all → `isBoardStale(boardMtime, 0)` is false (fresh):
  a project with no decomposed state can't have a stale board. Correct degenerate behavior, no special-
  casing needed.

Rejected `Promise.all` fan-out parallelism (load.ts uses it for 3 dirs): the gather is mtime-only and
trivially cheap; a sequential max keeps the reduce obvious. Either is fine; sequential reads cleaner.

Board mtime itself: `stat(board.path).mtimeMs` on the path `readBoard` already resolved — no second
path-resolution, no re-read.

## D4 — The `stale-board` WorkResult variant + gate placement

Add to the union: `{ kind: "stale-board"; boardPath: string; boardMtimeMs: number; liveMtimeMs: number }`.
Carries both timestamps so the CLI render needs no second stat. Mirrors `empty-board` (carries
`boardPath`) and `no-board` (carries `tried`) — data, not a thrown error.

**Placement:** after the `empty-board` check, before `allocate`. Funding the wallet is the line the
gate guards (the epic: "before funding the wallet"). Order: readBoard → parseSignals (empty-board) →
**freshness gate** → allocate → price → spendDown. An empty board short-circuits even earlier (nothing
to be stale about), so empty-board precedes the freshness gather — and saves the stat work on an empty
board.

The gate runs only when `!opts.staleOk`. With `--stale-ok` the gather is skipped entirely (no stat
cost, the human has spoken) and the flow proceeds straight to `allocate`.

## D5 — The CLI andon render

A pure `renderStaleBoard(r: { boardPath; boardMtimeMs; liveMtimeMs }, opts: { color? }): string` in
`work-core.ts`, reusing the `amber()` helper (IA-9). Returns the refusal copy:

```
⚠ stale board — refused (a successful stop, not a crash)
  board staged:    <boardWhen>
  project changed: <liveWhen>  (newer than the board)
  The board predates the project's current state, so spending would clear superseded work.
  Re-survey before spending:  vend steer   (or  vend survey ),  then  vend work
  (mtime is a heuristic — a git checkout can reset it; pass --stale-ok to spend anyway.)
```

- **Timestamp format:** `new Date(ms).toISOString()` — deterministic given the ms input, so the pure
  render stays assertable in a unit test (no clock read, no locale drift). `new Date(ms)` with an
  argument is pure/total (only argless `new Date()`/`Date.now()` read the wall clock). A friendlier
  "10h ago" needs a *now* reference (impure) — rejected for the pure core; absolute ISO is honest and
  testable. The relative phrasing can be a downstream nicety.
- **Color gated by `opts.color`** (default false) exactly like `renderReceipt`, so tests assert plain
  text and the CLI passes `color: true`.
- **The honest caveat is IN the copy** (the mtime/git-checkout line) AND will be a code comment on
  `isBoardStale` — the ticket requires both.
- **Hands the next move** (`vend steer`/`vend survey`, then `vend work`) — IA-9's "andon summons the
  fix," matching the press-core "re-run `vend`" precedent.

**Dispatch:** in the `work` arm, a new branch before the `spent` handling:
```ts
if (result.kind === "stale-board") {
  process.stderr.write(`${renderStaleBoard(result, { color: true })}\n`);
  process.exit(1);
}
```
stderr + exit 1, exactly like `no-board`/`empty-board` (the ticket pins "exit like the other broken-
precondition outcomes" — NOT the `spent` 0-exit). `renderStaleBoard` joins the existing lazy import of
work-core's `renderReceipt`/`formatStepSignal`.

## D6 — The `--stale-ok` override (IA-5)

- `WorkOptions.staleOk?: boolean` (work.ts).
- `parseWorkArgs`: a presence flag — `const staleOk = argv.includes("--stale-ok")`, spread
  `...(staleOk ? { staleOk: true } : {})` so the default object shape is unchanged (the `--no-gates`/
  `--intervened` precedent in `parseRunArgs`). It is NOT a value flag, so it doesn't disturb the
  `--budget`/`--board` value-consuming loop — but it must be recognized in that loop's `else` (today an
  unknown token → `unexpected work argument`). Add an explicit `else if (a === "--stale-ok") staleOk =
  true;` arm so it isn't rejected as an unexpected positional.
- `ParsedCommand` `work` variant gains `readonly staleOk?: boolean`.
- Dispatch threads it: `castWork({ budget, ...(board), ...(staleOk ? { staleOk: true } : {}), onStep })`.
- `USAGE`: `vend work [--budget …] [--board <path>] [--stale-ok]`.

Rejected making `--stale-ok` a value flag or an env var: it's a binary human override, presence is the
right shape and matches every other boolean flag in the CLI.

## D7 — What stays out (epic non-goals, re-affirmed)

- **No auto-re-survey / `--refresh`.** Silently casting survey/steer to refresh the board spends the
  wallet on work the human didn't fund — violates IA-5/the funding gesture. Downstream pull.
- **No per-signal liveness.** The gate is board-level (one mtime compare), not "is this specific
  signal still live" (a harder problem).
- **No state-fingerprint embedded in the board.** A stronger signal than mtime, explicitly downstream.

## Test strategy (decided here, sequenced in Plan)

- **Unit (work-core.test.ts):** `isBoardStale` — older→true, newer→false, equal→false (the three AC
  boundary cases). `renderStaleBoard` — asserts both ISO timestamps appear, the re-survey move appears,
  the caveat appears, and `{color:true}` wraps in the amber escape while default stays plain.
- **Unit (cli.test.ts):** `parseWorkArgs` accepts `--stale-ok` (→ `{ cmd:"work", staleOk:true }`),
  composes with `--budget`/`--board`, and a bare `vend work` stays `{ cmd:"work" }` (no staleOk).
- **Live proof (free, deterministic, no LLM):** `bun run src/cli.ts work` against the live stale
  `steer.md` refuses with the andon + exit 1 and casts nothing; `--stale-ok` proceeds past the gate.
  `bun run check` green (typecheck + full test suite).
