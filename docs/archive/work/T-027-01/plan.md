# T-027-01 Plan — board-freshness-gate

Ordered, independently-verifiable steps. Each step is an atomic commit. Tests land with the code they
cover. Three implementation commits + a live-proof verification, matching the Structure ordering.

## Step 1 — Pure decision + render + units (work-core.ts)

**Change:** add `isBoardStale` and `renderStaleBoard` to `src/play/work-core.ts`; add their two
`describe` blocks to `src/play/work-core.test.ts`.

**Why first:** pure, addon-free, zero dependency on the other steps. The unit-tested contract the whole
gate rests on. Lands green in isolation.

**Verify:**
- `bun test src/play/work-core.test.ts` — the new `isBoardStale` trio (older→true, newer→false,
  equal→false) + degenerate (`_,0`→false), and `renderStaleBoard` (both ISO timestamps, re-survey move,
  caveat, color-gating) pass; the existing work-core tests stay green.
- `tsc --noEmit` clean.

**Commit:** `feat(work-core): pure isBoardStale + stale-board andon render (T-027-01)`

## Step 2 — The impure gate (work.ts)

**Change:** in `src/play/work.ts` — extend imports (`readdir`, `stat`, `isBoardStale`); add `staleOk`
to `WorkOptions`; add the `stale-board` variant to `WorkResult`; add the private `newestActiveMtimeMs`
gather + the `ACTIVE_DIRS` constant; insert the freshness gate in `castWork` after the empty-board
return and before `allocate`.

**Why second:** depends on Step 1's `isBoardStale`. No CLI yet — but the module typechecks and the
existing suite (which never value-imports work.ts) stays green.

**Verify:**
- `tsc --noEmit` clean (the new `WorkResult` variant is exhaustively handled nowhere yet that breaks —
  cli's switch is updated in Step 3; until then cli still compiles because the work arm branches on
  `result.kind` with `if`s, not an exhaustive switch).
- `bun test` — full suite green (work.ts is not value-imported by any test; the gate is impure and
  proven live in Step 4, per the module's standing stance).

**Commit:** `feat(work): freshness gate — refuse a stale board before funding the wallet (T-027-01)`

## Step 3 — CLI flag + render + dispatch (cli.ts + cli.test.ts)

**Change:** `src/cli.ts` — USAGE `[--stale-ok]`; `staleOk` on the `work` `ParsedCommand`; the
`--stale-ok` arm in `parseWorkArgs`; the `stale-board` dispatch branch (amber andon → stderr → exit 1);
thread `staleOk` into `castWork` and add `renderStaleBoard` to the lazy import. `src/cli.test.ts` —
the `--stale-ok` parser cases.

**Why third:** depends on Steps 1–2 (`renderStaleBoard`, the `stale-board` result, `WorkOptions.staleOk`).

**Verify:**
- `bun test src/cli.test.ts` — `work --stale-ok` → `{cmd:"work",staleOk:true}`; composition with
  `--budget`/`--board`; bare `work` unchanged. Existing `work` parser tests green.
- `tsc --noEmit` clean.

**Commit:** `feat(cli): vend work --stale-ok + stale-board andon render (T-027-01)`

## Step 4 — Live proof (free, deterministic, no LLM) + full gate

**Change:** none (verification only; capture the transcript under `work/T-027-01/`).

**Why last:** the capstone AC — prove the gate refuses the live stale `steer.md` without casting.

**Verify (the AC's "Live proof"):**
1. `bun run check` (baml:gen + typecheck + full `bun test`) green.
2. `bun run src/cli.ts work` (no flags) against the live board: refuses with the amber stale-board
   andon, exits 1, **casts nothing** (no `▶ casting` line, no ledger append). The current `steer.md` is
   11:54; many `docs/active/**` files are newer (E-027 etc.), so the gate fires deterministically.
3. `bun run src/cli.ts work --stale-ok --budget 1,1`: proceeds *past* the gate (the budget is
   intentionally tiny so it then stops cleanly on wallet-exhausted/price without a real multi-cast
   spend — proving the override threads through, not exercising a full LLM sweep). Confirm no
   stale-board refusal is printed.
4. Capture the refusal transcript to `work/T-027-01/stale-board-proof.md`.

**Commit:** `docs(T-027-01): live proof — vend work refuses the stale steer board` (the proof artifact).

## Testing strategy summary

| Surface | Test | Where |
|---|---|---|
| `isBoardStale` boundaries | unit (older/newer/equal/degenerate) | work-core.test.ts |
| `renderStaleBoard` copy + color | unit (timestamps, move, caveat, ANSI gate) | work-core.test.ts |
| `--stale-ok` parsing | unit (presence, composition, shape) | cli.test.ts |
| the gather + gate (impure) | live refusal, deterministic | Step 4 proof |
| no regressions | full `bun run check` | Step 4 |

The impure gather (`newestActiveMtimeMs`) + the `castWork` wiring are NOT unit-tested by design
(work.ts value-imports the BAML addon → no `bun test` may import it; the module's standing stance). They
are covered by the free, deterministic live refusal — the same proof discipline E-024/E-025 used, but
here with no LLM spend at all.

## Rollback / risk

- **mtime heuristic false-positive** (a `git checkout` resets the board mtime newer-than-live, or the
  reverse): `--stale-ok` is the documented escape hatch; the caveat is in the andon copy + the code
  comment. No data is destroyed — the gate only *refuses to spend*; it never mutates the board.
- **Degenerate empty project** (no active files): `newest = 0` ⇒ never stale ⇒ no false refusal.
- Each commit is independently revertible; Steps 1–3 leave the suite green, Step 4 is docs-only.
