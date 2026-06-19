# T-015-02 Research — warranted default & turns observability

Descriptive map of the codebase as it stands after T-015-01. What exists, where, how it
connects. No solutions here.

## The ticket in one line

Two things on top of T-015-01's `--max-turns` mechanism: (1) a **warranted default** turn
cap that applies when no per-cast override is given (override still wins), justified
in-code against the observed tail; (2) make **turns-used observable** so the cap is
tunable from data, not frozen.

## The dispense path, end to end

The cast pipeline (`src/engine/cast.ts` → `src/executor/claude.ts`):

```
runPlay (dispatch.ts) → assembleAndCast (decompose-epic.ts) → castPlay (cast.ts)
   → dispense (claude.ts) → buildArgs → spawn `claude -p … [--max-turns n]`
   → stream-json → terminal `result` → meter (budget.check) → classify → effect → appendRunLog
```

### What T-015-01 already wired (the mechanism)

- `src/executor/claude.ts`
  - `DispenseOptions.maxTurns?: number` (line 74) — "Omitted ⇒ no flag ⇒ turns unbounded".
  - `buildArgs({ … maxTurns })` (line 109) — guarded push `if (maxTurns) args.push("--max-turns", String(maxTurns))`, appended **last**. Truthy guard ⇒ `0` treated as absent.
  - `dispense` (line 253) destructures `maxTurns` and forwards it into `buildArgs`.
- `src/engine/cast.ts`
  - `CastOptions.maxTurns?: number` (line 51) — "the mid-flight bound (IA-8)".
  - `castPlay` passes `maxTurns: opts.maxTurns` straight to `dispense` (line 126) — pure pass-through, `undefined ⇒ no flag ⇒ unbounded turns`.

So the wire from `CastOptions.maxTurns` to the CLI flag is complete. **What's missing for
this ticket:** (a) nothing *sets* a default — `opts.maxTurns` undefined ⇒ unbounded;
(b) `RunOptions` (decompose-epic.ts) does not carry `maxTurns`, and `assembleAndCast` does
not thread it (the "no command surface yet" boundary noted in T-015-01 review §Open
concerns #1); (c) turns-used is never read or logged.

## Where a default could live (the candidate homes)

- **The seam** (`buildArgs`/`dispense`) — deliberately a *dumb argv builder* with no
  policy; T-015-01 review §Design notes explicitly says validation/policy belongs
  upstream, not here. Ruled out by house convention.
- **The generic spine** (`castPlay`, cast.ts) — play-agnostic; a constant here would apply
  to every play uniformly.
- **The Play** (`src/engine/play.ts` `Play<I,O>`) — already houses `budget: Budget`
  (line 139), documented as "The default mana cost — the warranted budget envelope
  (overridable at the counter)". A `maxTurns` here would be the *exact same kind of field*:
  a per-play warranted default, overridable per cast. The observed tail (~85–95k) is
  decompose-epic's tail; the warranted number is naturally per-play.

`decomposeEpicPlay` (decompose-epic.ts line 163) declares `budget: { timeMs: 7_200_000,
tokens: 50_000 }` inline — the established place a play states its warranted defaults.

## Turns-used: where it surfaces today (AC2 substrate)

The `claude -p` terminal `result` message **carries `num_turns`** — confirmed live in
`.vend/transcripts/*.jsonl` (values seen: `A1`=2, `A2`=4, `A3`=1, run-…=7, 3, 2). Sample
keys on a real result message:
`subtype, result, usage, total_cost_usd, num_turns, duration_ms, stop_reason, …`.

- `ResultMessage` (claude.ts line 34) types `subtype/result/usage/total_cost_usd/model`
  but **not** `num_turns`. It extends `StreamMessage = { type } & Record<string, unknown>`,
  so `result.num_turns` is reachable but typed `unknown` — needs a typed optional field to
  read cleanly.
- `castPlay` already has `result` in scope at the `appendRunLog` call (cast.ts line 182),
  right where `usage` / `costUsd` are harvested off the same object.

### The run-log record (the durable, tunable surface)

`src/log/run-log.ts` is the append-only ledger. It has a *settled pattern* for optional,
back-compat fields — `envelope`, `project`, `intervened` are each:
- declared optional on `RunRecordInput` (lines 109–121) and `RunRecord` (lines 138–149);
- normalized by a small helper (`normalizeEnvelope`/`normalizeProject`/`normalizeIntervened`,
  lines 193–215) that returns `undefined` when absent;
- spread into the frozen record **only when present** (`buildRunRecord` lines 243–259) — so
  an absent field is *omitted*, byte-for-byte identical to a pre-field record;
- revived on the read side (`reviveRecord` lines 331–347) the same way — kept only when
  valid, dropped (never rejects the record) otherwise.

A new `turnsUsed?: number` field slots straight into this pattern. `RUN_LOG_SCHEMA_VERSION`
stays `1` — additive optional fields don't bump it (envelope/project/intervened didn't).

The stdout/live surface: `castPlay` writes `· effect ✓` / `· andon: …` lines (cast.ts
172–174) via the `· ` convention; `formatMessage` (cast-core.ts 91) renders the `result`
line. A `· turns: N` line is the cheap operator-facing surface.

## The pure/impure discipline (house pattern, must respect)

- `claude.ts`: pure helpers (`buildArgs`, parsing) + one impure verb (`dispense`, spawns).
- `cast.ts`: impure orchestrator; its JUDGMENT lives in `cast-core.ts` (pure, addon-free,
  unit-tested) — `classify`, `resolveLoggedModel`, `makeStreamSink`. New pure resolution
  logic (default-vs-override, turns harvest) belongs in `cast-core.ts` to stay testable.
- `decompose-epic.ts` value-imports the **BAML addon** → cannot be loaded in `bun test`.
  Its pure constants/judgment live in `decompose-epic-core.ts` (addon-free), which
  `decompose-epic.test.ts` imports. A justified `DECOMPOSE_MAX_TURNS` constant belongs in
  the core so its value is testable without the addon.
- `run-log.ts`: pure pair (`buildRunRecord`/`serializeRunRecord`) + read (`reviveRecord`/
  `readRuns`) + one impure verb (`appendRunLog`). All normalization is unit-tested.

## The evidence — the default's justification (AC1, AC3)

From `demand.md` (line 93, the E-015 row) and E-014's E2 probe (2026-06-19):

- `decompose-epic` **blew its 50k token envelope ~80% of the time** across 20 fresh casts;
  **tail ~85–95k tokens**. It *censored* E-014's consistency measurement until the per-cast
  budget was raised to 180k.
- The fat tail is **agentic wandering**, not input size — A2's tiny fixture once burned
  119k. `claude -p` is the full agent; turns are the unit of wandering.
- Clean decompose runs in the live transcripts land at **1–7 turns** (`num_turns` 1,2,2,3,
  4,7). This is the legitimate-run band the default must not cut into.

## Constraints / assumptions surfaced

- **Err generous** (ticket): a false andon on a legitimate run is worse than letting one
  tail through. The number is a *judgment, not a guess to freeze* — pick defensible, log
  turns, let data refine.
- **No CLI override flag is required** by the ACs: the override is `CastOptions.maxTurns`,
  already in place (T-015-01). Precedence (override > default) is the only contract.
- **The live sweep (AC3)** spawns a real metered `claude -p` decompose cast — the same
  forward-looking *human sweep* posture E-014's measurement sprint took (it cannot be an
  automated unit test; the seam's `dispense` is deliberately un-unit-tested). Wiring +
  documented command + green check is what this ticket lands; the live number is read by
  running the documented command.
- `RUN_OUTCOMES` is unchanged — a turn-capped run logs whatever terminal outcome its
  `result` + gates produce (T-015-01 review §Open concerns #2); no new outcome here.
- Schema stays v1; all new fields additive and omitted-when-absent (back-compat invariant).
