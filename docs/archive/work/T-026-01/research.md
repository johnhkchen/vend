# T-026-01 — Research: E1 instrument readiness

**Ticket:** verify-e1-instrument-readiness (spike) · Story S-026-01 · Epic E-026
**Question:** Does the *real-session path* — `vend run <play> <epic.md> --budget … --intervened|--no-intervened` — actually append a genuine ledger record carrying the `intervened` bit, and does `vend audit` read it back? Surface any missing/flaky real-session path as a blocking prerequisite before the sprint commits wall-clock to it.

Descriptive only. No solution proposed here (that is Design).

## The instrument the sprint depends on

E-026 is the E1 walk-away **measurement sprint**: cast ≥10 real `vend run` sessions self-reporting whether the author intervened, then `vend audit` for the walk-away rate + trend. T-026-01 is the gate **in front of** that sprint — confirm the instrument records a real bit through a real cast before ten sessions are spent against it. A silently-dropped bit would make the whole sprint measure nothing.

## The end-to-end `intervened` threading path

Traced through the code, the bit flows along one unbroken pass-through chain (no transform, no default-coercion that could swallow it):

1. **Parse** — `cli.ts:parseRunArgs` (line 427):
   `--intervened` ⇒ `true`, `--no-intervened` ⇒ `false`, neither ⇒ field absent (unknown). Spread onto the `run` `ParsedCommand` only when one was supplied (`...(intervened !== undefined ? { intervened } : {})`).
2. **Dispatch** — `cli.ts` main (line 673) calls `runPlay(play, { epicPath, budget, skipGates, intervened })`.
3. **Route** — `dispatch.ts:runPlay` resolves the play by name from the `registry` and calls `assembleAndCast(play, opts)`.
4. **Assemble** — `decompose-epic.ts:assembleAndCast` (line 202) reads epic/charter/project via `assembleInputs`, then calls `castPlay(play, inputs, budget, { …, intervened: opts.intervened, … })`.
5. **Record** — `engine/cast.ts:castPlay` (line 229) spreads `...(opts.intervened !== undefined ? { intervened: opts.intervened } : {})` into the single `appendRunLog` call.
6. **Persist** — `log/run-log.ts:buildRunRecord` (line 262/277) normalizes via `normalizeIntervened` (a real boolean kept verbatim — **`false` is a value, only absence is unknown**) and writes the field to the JSONL line.

**Key structural fact:** the `appendRunLog` call in `castPlay` (line 214) sits *after* `classify` and runs for **every** terminal outcome — `success`, `gate-failed`, `budget-exhausted`, `timed-out`, `id-collision`. The `intervened` spread does not depend on `result`, the gate verdict, or the effect. So the bit is logged regardless of whether the cast materializes anything. (Confirmed: a `timed-out` run has `result === null` yet still spreads `intervened`.)

## The read-back path (`vend audit`)

`cli.ts` audit arm (line 650) → `loadRunLog()` → `walk-away.ts:auditWalkAway`:

- `intervention` block (line 166): `scope.filter((r) => r.intervened !== undefined)` — **any** record carrying the bit (any outcome) joins the self-report sample; `reported` / `intervened` / `rate` / `trend` are computed over it.
- `formatWalkAwayFindings` (line 194) renders the walk-away rate as `1 − intervention rate` with an honest "no self-reports yet" branch when nothing carried the bit.

So a record written with the bit by any cast outcome is read back by `vend audit`. The read tolerates mixed records (with and without the bit) — only carriers count.

## Current ledger state (`.vend/runs.jsonl`)

- 23 records; **15** already carry `intervened`. Those 15 are the **post-hoc attestation back-fill** (`attest-intervention.ts`) — they carry an `intervenedAttestation` marker (by/at/basis) distinguishing them from live captures. The attestation basis explicitly **excludes** synthetic/probe epics (`A1-A4`, `E-900/901`, `shelf-E-004`, `verify-*`).
- The most recent records (propose-epic / decompose-epic at ~05:04–05:24Z) are **live** casts with **no** `intervened` field — i.e. the live forward path has not yet been exercised with the flag. **This is exactly the gap T-026-01 must close: prove a live `vend run` with the flag writes the bit.**

## `vend run` reality (constraints for the smoke)

- `vend run` requires `--budget <ms>,<tokens>` (both positive integers; `budget.ts:assertPositiveInt`).
- `vend run <play>` routes by name through the registry; today the only registered play is `decompose-epic`, and `assembleAndCast` assembles **decompose** inputs regardless. So the real-session smoke is a `decompose-epic` cast.
- A cast spawns `claude` via the Agent SDK (`executor/claude.ts:dispense`) — real tokens, real wall-clock. The autonomous loop ran such casts earlier today (ledger 05:04–05:24Z), so the environment supports live casting.
- **Materialize side-effect:** on a `success`/ungated verdict, `decomposeEffect` writes story+ticket files to `docs/active/{stories,tickets}` (board pollution risk). `castPlay` only runs the effect when `verdict.materialize` is true — i.e. **not** on `budget-exhausted` / `timed-out` / `gate-failed`. So an andon'd cast logs the record (with the bit) but writes **nothing** to the board.
- Budget mechanics: `check()` compares total usage against the token ceiling *after* the LLM call returns; a token ceiling below real usage ⇒ `budget-exhausted` deterministically, with the effect skipped. `timeoutMsFor` is identity over `timeMs`.

## Assumptions & constraints

- **A1.** The two smoke casts are *instrument-readiness probes*, not real E1 walk-away data points — their job is to prove the wire, not to measure the rate (that is T-026-02+). They should be markable as `verify-*` so they stay excludable from the real E1 dataset.
- **A2.** Board pollution must be zero. Any verified-readiness smoke must avoid the materialize effect.
- **A3.** "Genuine record" / "real-session path" ⇒ an actual `vend run` invocation (the SDK call is intrinsic) — a unit test would not satisfy the AC.
- **A4.** Cost is intrinsic and bounded: two `decompose-epic` generations (~$0.5–0.7 each); the token ceiling does not reduce generation cost, only post-hoc classification.

## Open questions for Design

- How to force a deterministic, side-effect-free outcome (no materialize) while still exercising the full real-session path?
- What epic to point at so the record is clearly a `verify-*` probe (excludable) without adding a real epic to the board?
- How to verify both the write (bit present, correct value `true`/`false`) and the read (`vend audit` surfaces it)?
