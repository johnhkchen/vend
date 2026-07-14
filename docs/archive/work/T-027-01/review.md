# T-027-01 Review — board-freshness-gate

Handoff for a human reviewer. What changed, how it's covered, and the open concerns — enough to review
without reading every diff.

## What this does

`vend work` no longer spends a macro-wallet down **whatever staged board it finds**. Before funding the
wallet, it compares the board's mtime against the newest `docs/active/{epic,stories,tickets}` mtime; if
the board is older (stale), it **refuses** — an amber IA-9 andon handing back the re-survey move — and
exits 1 without casting. `--stale-ok` overrides (IA-5). This closes the concrete gap E-025's live
re-sweep exposed: a wallet cleared a ~10h-stale `steer.md` into E-026 on an already-resolved premise
(`work/T-025-01/sweep-logs/findings.md`).

## Files changed (4 source + 2 test, no new files)

| File | Change |
|---|---|
| `src/play/work-core.ts` | +`isBoardStale` (pure decision), +`renderStaleBoard` (amber andon), reusing the in-file `amber()` |
| `src/play/work-core.test.ts` | +`isBoardStale` boundary tests, +`renderStaleBoard` render/color tests |
| `src/play/work.ts` | +`staleOk` on `WorkOptions`, +`stale-board` on `WorkResult`, +`newestActiveMtimeMs` gather + `ACTIVE_DIRS`, the gate in `castWork` before `allocate` |
| `src/cli.ts` | +`--stale-ok` in `parseWorkArgs`, +`staleOk` on the `work` `ParsedCommand`, +`stale-board` dispatch branch, USAGE |
| `src/cli.test.ts` | +`--stale-ok` parser cases |

Four commits (one per plan step), then the docs/proof commit:
1. `feat(work-core): pure isBoardStale + stale-board andon render`
2. `feat(work): freshness gate — refuse a stale board before funding the wallet`
3. `feat(cli): vend work --stale-ok + stale-board andon render`
4. `docs(T-027-01): live proof + progress …`

## The house shape (why it's split this way)

- **Pure decision + render in `work-core.ts`**, the addon-free unit-tested core; **impure gather + gate
  in `work.ts`**, which value-imports the BAML addon and is therefore proven by the free live refusal,
  not `bun test` — the same ENGINE ⊥ PLAY split work.ts/work-core.ts already enforce.
- `newestActiveMtimeMs` **mirrors** `src/graph/load.ts`'s readdir-per-dir idiom (the no-shared-util
  precedent load.ts's own header invokes) but takes `stat().mtimeMs` + a running max — it needs the
  newest mtime, not parsed node bodies. Tolerant of a missing dir / vanished file (skip), matching
  load.ts.
- The gate sits **after** the empty-board check (nothing stale about an empty board; saves the stat)
  and **before** `allocate` (the line the epic says to guard). `--stale-ok` skips the gather entirely.

## Test coverage

- **`isBoardStale`** — the AC boundary trio (older→true, newer→false, equal→false / fresh-on-tie) plus
  the degenerate `(_, 0)→false` (no live state ⇒ never stale). Pure, no I/O.
- **`renderStaleBoard`** — both ISO timestamps present, the refused board path, the re-survey move, the
  `--stale-ok` caveat; color off = plain, color on = amber (33), never red (31). Deterministic via
  fixed-ms fixtures (`new Date(ms)` is total — no clock read).
- **`parseWorkArgs`** — `--stale-ok` parses to `{cmd:"work",staleOk:true}`, composes with
  `--budget`/`--board`, and bare `work` keeps its shape (no spurious `staleOk` key).
- **Live proof** (`stale-board-proof.md`) — covers the one thing units can't: the impure gather + gate
  end-to-end against the real board. Refuses the live stale `steer.md` (no cast, exit 1); `--stale-ok`
  proceeds. Free + deterministic.
- **Full gate:** `bun run check` → **839 pass, 0 fail** (was 830 → +9: the new units).

### Coverage gaps (by design, flagged honest)

- `newestActiveMtimeMs` and the `castWork` gate-wiring are **not** unit-tested — work.ts can't be
  value-imported by `bun test` (the addon). They're covered by the deterministic live refusal, the
  module's standing proof discipline (E-024/E-025). A reviewer who wants belt-and-suspenders could
  extract the gather behind the executor seam later, but that's not this slice.
- No test pins the *exact* andon wording (only that the load-bearing pieces — timestamps, move, caveat
  — appear). Intentional: copy is allowed to evolve without a brittle string-equality test.

## Open concerns / known limitations

1. **mtime is a heuristic** — the central honest caveat, surfaced in three places: the `isBoardStale`
   doc comment, the `castWork` gate comment, and the andon copy itself. A `git checkout` (or a `touch`,
   or cloning the repo) can reset file mtimes and produce a false stale/fresh verdict. `--stale-ok` is
   the documented escape hatch; the gate only ever *refuses to spend* — it never mutates the board, so
   a false positive costs a flag, not data. A board-embedded **state fingerprint** (a content hash, not
   mtime) is the stronger downstream signal the epic names as out of scope.
2. **Board-level, not per-signal.** The gate refuses the whole board if it predates *any* active
   change; it can't tell "9 of 10 signals are still live." That's the harder per-candidate-liveness
   problem the epic defers — a board freshly re-staged clears the gate wholesale, which is the intended
   coarse contract for this slice.
3. **`ACTIVE_DIRS` is duplicated** (load.ts names the same three dirs independently). This is the
   deliberate no-shared-util idiom, not an oversight — coupling to load.ts's `LoadOptions` to share the
   list would drag the graph builder onto the mtime path. If a fourth active dir is ever added, two
   sites update. Low risk, called out so it's a known, not a surprise.
4. **No auto-re-survey** (epic non-goal, re-affirmed): the gate hands back the move; it does not cast
   `survey`/`steer` itself — that would spend the wallet on unfunded work (IA-5). A `--refresh` opt-in
   is a deliberate downstream pull.

## Recommendation

Ready for review. The behavior change is gated, reversible (refuse-only, never mutating), unit-tested at
the pure boundary, and proven free + deterministic against the exact board that triggered the epic. The
one thing a reviewer should weigh is concern #1 — whether mtime is a strong enough signal for the
default-refuse stance, or whether the state-fingerprint refinement should be pulled forward. Given
`--stale-ok` and the no-mutation guarantee, shipping the mtime gate now (and fingerprinting later) is
the low-risk path.
