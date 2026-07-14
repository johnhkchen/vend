# T-027-01 Live proof — `vend work` refuses the stale steer board

Free, deterministic, **no LLM cast**. Run 2026-06-19, against the live `docs/active/pm/staged/steer.md`
(staged 11:54) with 50 `docs/active/{epic,stories,tickets}` files newer than it — the exact failure
`work/T-025-01/sweep-logs/findings.md` flagged (the spend that cleared a ~10h-stale board into E-026).

## Setup (the gate fires deterministically)

```
steer.md: 11:54:37
active files newer than steer.md: 50
```

## Proof 1 — default: refuse + exit 1, cast nothing

`bun run src/cli.ts work --board docs/active/pm/staged/steer.md`

```
⚠ stale board — refused (a successful stop, not a crash)        ← amber (ANSI 33), IA-9
  board:           docs/active/pm/staged/steer.md
  board staged:    2026-06-19T18:54:37.971Z                      ← both timestamps
  project changed: 2026-06-20T05:39:27.930Z  (newer than the board)
  The board predates the project's current state — spending would clear superseded work.
  Re-survey before spending:  vend steer  (or  vend survey ),  then  vend work   ← next move handed over
  (mtime is a heuristic — a git checkout can reset it; pass --stale-ok to spend anyway.)  ← honest caveat
exit=1
```

No `▶ casting` line printed → **no chain cast, no wallet funded, no ledger append**. The refusal lands
*before* `allocate`. Exit 1, like no-board/empty-board (the broken-precondition outcomes), via stderr —
a successful refusal, not a crash.

## Proof 2 — `--stale-ok` proceeds past the gate (IA-5 override)

`bun run src/cli.ts work --board …/steer.md --stale-ok --budget 1,1` (a deliberately tiny budget so the
override is proven *without* a real multi-cast LLM sweep — the wallet funds but affords no pull):

```
═ vend work — receipt ═
No cast ran — the wallet funded nothing on this board.
wallet: ◇ 0/1 · 1 left   ⏱ 0s/1ms · 1ms left
stopped: wallet exhausted — wallet can't afford the next pull (9 left on the board) — 1 tokens / 1 ms left
exit=0
```

No stale-board refusal printed → `--stale-ok` bypassed the gate and reached the normal spend path
(which then stopped cleanly on the tiny budget). The override threads end-to-end.

## Full gate

`bun run check` → `839 pass, 0 fail` (typecheck + full suite), up from 830 (the new `isBoardStale`,
`renderStaleBoard`, and `--stale-ok` parser cases).
