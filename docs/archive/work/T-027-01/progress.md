# T-027-01 Progress — board-freshness-gate

Status: **Implement complete.** All four plan steps done, full gate green (839/0), live proof captured.
No deviations from the plan.

## Steps

- [x] **Step 1 — pure decision + render + units** (`work-core.ts`, `work-core.test.ts`)
  - `isBoardStale(boardMtimeMs, liveMtimeMs)` = `boardMtimeMs < liveMtimeMs` (fresh-on-tie), with the
    honest mtime caveat in the doc comment.
  - `renderStaleBoard` — amber IA-9 andon: board path, both ISO timestamps, the re-survey next move,
    the `--stale-ok` caveat; `opts.color` gates the ANSI (default plain), reusing the in-file `amber()`.
  - Tests: the boundary trio (older→true, newer→false, equal→false) + degenerate (`_,0`→false); the
    render (both timestamps, move, caveat, color-gate). `bun test` 20/0 in-file.
  - Commit `feat(work-core): pure isBoardStale + stale-board andon render (T-027-01)`.

- [x] **Step 2 — the impure gate** (`work.ts`)
  - Imports: `readdir`, `stat`, `isBoardStale`. `WorkOptions.staleOk?`. `WorkResult` +`stale-board`
    variant. `ACTIVE_DIRS` const + private `newestActiveMtimeMs(root)` (load.ts readdir idiom,
    mtime-only, ENOENT/stat-fault tolerant). Gate in `castWork` after empty-board, before `allocate`:
    when `!staleOk` and stale → return `stale-board` (no fund, no cast).
  - Commit `feat(work): freshness gate — refuse a stale board before funding the wallet (T-027-01)`.
  - *Note:* this commit alone left `cli.ts` momentarily not-typecheck-clean (the new variant isn't
    narrowed until Step 3's branch) — an expected Step 2/3 coupling, called out in plan.md. Resolved
    by Step 3 in the same session; the working tree is green at every step boundary from Step 3 on.

- [x] **Step 3 — CLI flag + render + dispatch** (`cli.ts`, `cli.test.ts`)
  - USAGE `[--stale-ok]`; `staleOk?` on the `work` `ParsedCommand`; `--stale-ok` arm in `parseWorkArgs`
    (presence flag, shape-preserving spread); the `stale-board` dispatch branch (amber andon → stderr →
    exit 1); `renderStaleBoard` added to the lazy import; `staleOk` threaded into `castWork`.
  - Tests: `--stale-ok` parses, composes with `--budget`/`--board`, bare `work` shape unchanged.
  - Commit `feat(cli): vend work --stale-ok + stale-board andon render (T-027-01)`.

- [x] **Step 4 — live proof + full gate** (`stale-board-proof.md`)
  - `bun run check` → **839 pass, 0 fail** (was 830).
  - Proof 1: `vend work` vs the live stale `steer.md` (11:54; 50 newer active files) → amber andon,
    exit 1, **no cast** (no `▶ casting`, no fund, no ledger append).
  - Proof 2: `--stale-ok --budget 1,1` → proceeds past the gate to the normal spend path (receipt,
    exit 0), no LLM cast needed to prove the override threads through.

## Acceptance criteria — all met

- [x] Pure `isBoardStale` unit-tested: older→true, newer→false, equal→false (no I/O).
- [x] `castWork` gathers board mtime + newest `docs/active/{epic,stories,tickets}` mtime and returns
      `stale-board` **before funding** when stale and not `--stale-ok`; `--stale-ok` spends anyway.
- [x] CLI renders `stale-board` as an amber andon with both timestamps + the re-survey move, exiting
      like no-board/empty-board; `parseWorkArgs` accepts `--stale-ok` (unit-tested).
- [x] Live proof (free, deterministic): refuses the live stale `steer.md` without casting; `--stale-ok`
      proceeds; `bun run check` green.

## Deviations

None. The only wrinkle is the documented Step 2/3 typecheck coupling (a single new union variant must
be narrowed at its one consumer) — committed as two atomic steps per the plan, green from Step 3 on.
