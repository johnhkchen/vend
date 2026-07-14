# T-015-02 Progress

Status: **implementation complete, green.** Four atomic commits, no deviations from plan.md.

## Steps completed

| Step | What | Commit | Verify |
|------|------|--------|--------|
| 1 | run-log `turnsUsed?` field (write + read) + 6 tests | `b004579` | `bun test run-log.test.ts` → 63 pass |
| 2 | `ResultMessage.num_turns?` + `resolveMaxTurns`/`resolveTurnsUsed` (pure) + 8 tests | `58ce3fc` | `bun test cast-core.test.ts` → 20 pass |
| 3 | `Play.maxTurns?` + `DECOMPOSE_MAX_TURNS = 15` + wire + 2 tests | `aa0b32e` | `bun test decompose-epic.test.ts` → 14 pass; typecheck clean |
| 4 | thread resolve + harvest + log + surface through `castPlay` | `7b165a1` | `bun run check` → **485 pass / 0 fail**, typecheck clean |

## Deviations from plan

None. Step 3's open decision (import the constant from the core vs inline) resolved to the
**core import** — `decompose-epic.ts` now `import { DECOMPOSE_MAX_TURNS } from
"./decompose-epic-core.ts"`; typecheck clean, no cycle (the core is addon-free, decompose-epic
already loads the addon). Single source of truth, value testable without BAML.

## AC status

- **AC1 (default applies; override wins; justified in-code):** ✅ `resolveMaxTurns(opts.maxTurns,
  play.maxTurns)` in `castPlay` — override `??` play default `??` undefined. `Play.maxTurns?`
  carries it; `decomposeEpicPlay.maxTurns = DECOMPOSE_MAX_TURNS = 15`, justified against the
  ~85–95k tail in `decompose-epic-core.ts`'s doc-comment. Precedence pinned by 4 unit tests.
- **AC2 (turns observable):** ✅ `turnsUsed` logged on the run record (durable, `jq`-able) and
  a `· turns: N / N cap` stdout line. Harvested from `result.num_turns` (confirmed live on the
  terminal result). Round-trip + back-compat covered by 6 run-log tests.
- **AC3 (live bound-check sweep):** ◻ **wired, not yet run.** Forward-looking human sweep —
  the documented command is in plan.md §Step 5 / review.md. `dispense` is the seam's one
  un-unit-tested verb (spawns), so the live number is produced by running:
  `vend run decompose-epic docs/active/epic/E-013.md --budget 7200000,180000` then
  `tail -1 .vend/runs.jsonl | jq '{outcome, turnsUsed, tokens:(.usage|add)}'`.
- **AC4 (`bun run check:*` green; no false andon):** ✅ full check green (485 pass, typecheck
  clean). The default only adds a `--max-turns` flag a legitimate ≤7-turn run never hits, so
  existing casts/tests are unaffected. Live no-false-andon is the AC3 sweep's cross-check.

## Test delta

471 → **485** (+14): 6 run-log (`turnsUsed`), 8 cast-core+decompose (resolvers + constant).
