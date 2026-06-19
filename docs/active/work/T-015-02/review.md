# T-015-02 Review — warranted default & turns observability

Handoff for a human reviewer. The ticket put **policy + observability** on top of T-015-01's
`--max-turns` mechanism: a warranted *default* turn cap (override still wins, justified
in-code against the observed tail) and a *turns-used* signal logged so the cap is tuned from
data, not frozen.

## What changed

Five source files, three test files. Four atomic commits.

| File | Change | Commit |
|------|--------|--------|
| `src/log/run-log.ts` | `turnsUsed?` on `RunRecordInput`/`RunRecord`; `normalizeTurnsUsed`; build + revive | `b004579` |
| `src/log/run-log.test.ts` | +6 tests (round-trip, omit-when-absent, normalize, malformed, legacy line) | `b004579` |
| `src/executor/claude.ts` | `ResultMessage.num_turns?: number` (type only) | `58ce3fc` |
| `src/engine/cast-core.ts` | `resolveMaxTurns` + `resolveTurnsUsed` (pure) | `58ce3fc` |
| `src/engine/cast-core.test.ts` | +8 tests (precedence + harvest) | `58ce3fc` |
| `src/engine/play.ts` | `Play.maxTurns?: number` (the warranted-default field) | `aa0b32e` |
| `src/play/decompose-epic-core.ts` | `DECOMPOSE_MAX_TURNS = 15` with justification doc | `aa0b32e` |
| `src/play/decompose-epic.ts` | import + `decomposeEpicPlay.maxTurns = DECOMPOSE_MAX_TURNS` | `aa0b32e` |
| `src/play/decompose-epic.test.ts` | +2 tests (constant value + positive-int) | `aa0b32e` |
| `src/engine/cast.ts` | resolve cap → dispense; harvest turns → log + stdout | `7b165a1` |

No files created/deleted. No new modules, no new import edges (the one added import —
`decompose-epic.ts` → its addon-free core — is intra-package). `RUN_LOG_SCHEMA_VERSION`
unchanged (additive optional field). `.vend/` line format gains an optional key only.

## How it works (the decision trail)

- **Default home = the `Play` contract**, the per-play sibling of `budget` (which is already
  "the warranted budget envelope, overridable at the counter"). Not the seam (a dumb argv
  builder by design) and not a single engine-wide constant (the ~85–95k tail is
  decompose-epic's; other plays wander differently). `castPlay` resolves
  `resolveMaxTurns(opts.maxTurns, play.maxTurns)` — the override-wins precedence (AC1) in one
  pure, tested line.
- **The number = 15**, justified in `decompose-epic-core.ts`: clean decompose runs land at
  1–7 turns (live `num_turns`), the tail is agentic *wandering*, 15 ≈ 2× the clean-run
  ceiling — generous (no false andon; the ticket's tie-breaker) yet bounding. Explicitly a
  *seed refined from data*, not frozen — which is what AC2 exists to enable.
- **Turns observable** off the terminal `result.num_turns` (verified present on real
  transcripts): logged as `turnsUsed` on the durable record (calibration surface) and shown
  as `· turns: N / N cap` on stdout (operator surface).

## Acceptance criteria

- [x] **AC1** — default applies when no override; override (T-015-01) wins; justified
  in-code. `Play.maxTurns?` + `DECOMPOSE_MAX_TURNS = 15` (doc-justified against the tail) +
  `resolveMaxTurns(override ?? default)`. 4 precedence tests.
- [x] **AC2** — turns used observable. `turnsUsed` on the run record (round-trip + back-compat
  tested) and the `· turns:` stdout line; harvested via `resolveTurnsUsed(result.num_turns)`.
- [~] **AC3** — live bound-check (sweep). **Wired and runnable; the live cast is the human
  sweep step** (see below). Not asserted by an automated test.
- [x] **AC4** — `bun run check` green (**485 pass / 0 fail**, typecheck clean); a few-turn
  cast is unaffected (the cap adds a flag a ≤7-turn run never hits — no false andon in any
  existing test).

## Test coverage

- **New (14):** run-log `turnsUsed` (6: carries-through/round-trip, `0`-is-a-value,
  absent-omitted byte-for-byte, non-finite/negative/fractional coerced, malformed dropped on
  revive, pre-T-015-02 line parses); cast-core resolvers (8: override-wins / default-applies /
  neither-undefined / `0`-as-is; int passes, absent/NaN/neg/frac/string ⇒ undefined);
  decompose constant (2: value pinned at 15, positive-int).
- **Regression:** full suite green (471 → 485), no existing test touched in behaviour.
- **Deliberately not unit-tested:** `dispense` (spawns; the module's stated rule) and
  `castPlay`'s threading (the impure shell — `maxTurns`/`turnsUsed` are pass-through added
  exactly as `intervened`/`skipGates`/`project` were; the logic is the pure resolvers above).
  This matches the house pattern, not a gap.

## Open concerns / limitations

1. **AC3 live sweep is not yet executed.** `dispense` spawns a real, metered `claude -p`
   decompose cast — it cannot be an automated unit assertion, and per the project's posture
   (E-014's measurement sprint; T-014-03's forward-looking sweep) the live number is read by a
   human running the documented command:
   ```bash
   vend run decompose-epic docs/active/epic/E-013.md --budget 7200000,180000
   tail -1 .vend/runs.jsonl | jq '{outcome, turnsUsed, tokens:(.usage|add)}'
   ```
   **Pass criterion:** caps at ≤15 turns, total tokens **below the ~85–95k tail**, `turnsUsed`
   present, outcome `success` (AC4 no-false-andon cross-check). This is the one item a
   reviewer should action to close AC3.
2. **The number 15 is a judgment under a tiny sample** (~6 clean runs, one self-reporting
   author). It is deliberately generous and refined from the now-logged `turnsUsed` — but if
   the sweep shows it cuts a legitimate run, it should *rise*, not fall (the ticket's
   tie-breaker). The refinement loop is data-driven by design; auto-tuning (IA-14) is a later
   rung, not this ticket.
3. **No per-cast CLI override flag.** The override lives at `CastOptions.maxTurns` (programmatic);
   precedence is what AC1 required. A `vend run --max-turns N` knob is the same follow-up
   T-015-01 deferred — out of scope here, noted for a reviewer who wants the operator surface.
4. **No distinct "hit the turn cap" outcome.** A capped run logs whatever its terminal result +
   gates yield (T-015-01 §concern #2 unchanged); `turnsUsed` near the cap is the tell. A
   dedicated outcome would need the seam to surface the stop reason — a separate enhancement.

## Verdict

Complete and green for the buildable scope (AC1, AC2, AC4). AC3 is wired and one documented
command away — the live sweep is the human measurement step, honestly flagged, not claimed.
The only judgment call (15) is documented with its evidence, its tie-breaker, and a
data-driven path to refine it.
