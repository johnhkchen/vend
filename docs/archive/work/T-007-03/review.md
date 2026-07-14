# T-007-03 — Review: register-decompose-epic-on-the-engine

The handoff document. DecomposeEpic is now the first registry entry of the casting engine;
`runDecomposeEpic` is `castPlay` over that entry; the CLI run path and the shelf press both
dispatch by name through the registry. Behaviour is preserved, including the run-log's
per-gate success rows. `tsc` clean; full suite **252 pass / 0 fail**.

## What changed

### New files
- **`src/play/dispatch.ts`** (~35 lines) — `runPlay(name, opts): DispatchResult` —
  `registry.get(name)` → `assembleAndCast` on a hit, `{kind:"no-play", error}` on a miss.
  The single by-name dispatch seam both shells share.

### Modified — engine (additive, behaviour-neutral)
- **`src/engine/play.ts`** — `GateVerdict.clear` gains optional `cleared?: readonly
  string[]`. Keeps `GateResult → GateVerdict` structural assignability; opaque-by-default.
- **`src/engine/cast-core.ts`** — `castGateRows` clear branch emits one passed row per
  `cleared` name (or `[]` when absent). `classify` unchanged (delegates to `castGateRows`).
- **`src/engine/cast-core.test.ts`** — +`clearedNamed` fixture, +2 assertions for the
  enriched path; bare-clear cases retained.

### Modified — play layer
- **`src/play/decompose-epic.ts`** — rewritten from a welded runner into a registry entry +
  thin assembler: `decomposeEpicPlay` (the six variation points), `registry.register(...)`,
  `decomposeEffect`, `assembleAndCast`, `runDecomposeEpic = assembleAndCast(decomposeEpicPlay,
  …)`. Kept `PLAY`, `RunOptions`, `lisaValidate`, `epicIdOf`; re-exports `RunSummary` from
  the engine. Removed the orchestration body, `stopReason`, the dead core re-export.

### Modified — dispatch sites
- **`src/cli.ts`** — generic `run <play>` parsing (`play: string`), updated `USAGE`,
  registry-routed run arm with a `no-play → exit 2` andon.
- **`src/cli.test.ts`** — +generic-play-name and `missing <play>` cases; `run summon`
  tightened to `missing <epic.md>`.
- **`src/shelf/press.ts`** — dispatches the constant `"decompose-epic"` through `runPlay`;
  header refreshed. `press-core.ts` untouched.

## Acceptance criteria — status

1. **DecomposeEpic registered as a `Play`** ✓ — render/parse/gates/effect/budget/card all
   wired from existing code; verified live by the registration smoke (name, card, budget).
2. **`runDecomposeEpic` is `castPlay` over the entry, no behaviour change** ✓ — it is now
   `assembleAndCast(decomposeEpicPlay, opts)`; all play-specific logic lives on the entry.
   Behaviour parity audited below.
3. **`vend run <play>` + press dispatch by name through registry + castPlay** ✓ — no
   hardcoded `decompose-epic` branch remains; CLI resolves `parsed.play`, press resolves the
   constant name, both via `runPlay` → `registry.get` → `castPlay`. Unknown name → typed
   `PlayNotFoundError` (CLI exit 2).
4. **All existing tests pass unchanged; pipeline behaves as before** ✓ — 248 prior tests
   green; the 4 new tests are additive. Run-log success rows preserved (see below).

## Behaviour-parity audit (vs. the welded runner)

Walked the cast path against `runDecomposeEpic`'s old body and confirmed each invariant:

- **render / parse** — identical `b.request.DecomposeEpic` → `extractPromptText` and
  `b.parse.DecomposeEpic`, now inside the play's closures.
- **gates** — `clear(plan, {epic, charter})` verbatim; `GateResult` assigns into
  `GateVerdict`. A STOP → `gate-failed` + the named failed row.
- **budget priority (P7)** — `classify` (engine) unchanged: timeout and budget-exhaustion
  still outrank a clear gate; no materialize on either.
- **success gate rows** — preserved: DecomposeEpic's `clear()` returns `cleared:[value,
  allocation, bounds, structural]`, and the D3 enrichment logs the four passed rows the
  welded runner wrote (the one delta a naïve wiring would have introduced — closed here).
- **id-collision** — `materialize`'s guard still throws before any write; `decomposeEffect`
  catches `IdCollisionError` and relabels the outcome `id-collision` as data.
- **lisa validate** — runs after materialize; a failure leaves outcome `success` with
  `materialized:false` (effect `ok:false`, no relabel) — exactly as before.
- **run log** — one `appendRunLog` per cast (inside `castPlay`) with `play:"decompose-epic"`
  and `epic: epicIdOf(...)` (via `opts.subject`); usage/cost/model resolution unchanged.

## Test coverage and gaps

- **New pure tests** (addon-free, the only kind the bun-test runner tolerates here):
  cast-core gate-row enrichment (2) and CLI generic-play parsing (2).
- **Regression**: the full suite (cli, press-core, cast-core, play, decompose-epic, gather,
  …) is green unchanged — the AC#4 guarantee.
- **Deliberately untested** (house pattern; T-007-02 D7): the impure verbs — `runPlay`,
  `runDecomposeEpic`, `assembleAndCast`, `decomposeEffect`, `castPlay`. They spawn `claude` /
  `lisa`, touch fs, and load BAML, so they are proven by `tsc` + the registration smoke now,
  and go fully live in **T-007-04** (the second play exercises the generic dispatch end to
  end). A real end-to-end `vend run` against a model was NOT executed this session (no model
  call available); the welded path it replaces was itself proven live in T-002-04, and the
  spine is unchanged.

## Open concerns / flags for a human reviewer

1. **Cosmetic stdout delta** (low): the cast loop prints `· effect ✓ lisa validate ✓` /
   `· effect ✗ id-collision — …` where the welded runner printed `· lisa validate ✓` /
   `· andon: id-collision — …`. Same information (carried in `EffectResult.detail`), same
   run-log record. The `· effect` prefix is owned by `castPlay` (T-007-02); unifying the
   wording would mean editing the engine's stdout, deferred as not worth the churn.
2. **Input assembly is still DecomposeEpic-specific** (by design): `assembleAndCast` takes
   `AnyPlay` but assembles `{epic, charter, project}` — the one input shape today. This is
   the deliberate boundary of the first-play ticket; **T-007-04 reveals the seam and
   generalizes per-play assembly**. Not a defect — the documented next step.
3. **The press's play name is a constant** (`"decompose-epic"`): every board epic action
   maps to that play, and `MenuCache.Action` carries no per-action play. Generalizing the
   menu to carry a play name (and bumping `MENU_CACHE_VERSION`) is future work; doing it here
   would have broken `gather.test.ts` (AC#4).
4. **The card's `rarity` is not consumed by the shelf** yet: the shelf still ranks by
   demand-tier (`gather.ts`). Wiring `Rarity → ValueTier` would change menu output (AC#4),
   so the card is registered as metadata only — consumption is a later ticket.
5. **Engine files touched** (`play.ts`, `cast-core.ts`): the D3 enrichment edits T-007-01/02
   territory. The change is additive (optional field) and pre-authorized by T-007-02's own
   design note; existing engine tests stay green on bare-clear fixtures.
6. **No `lint` gate**: `package.json` has no `lint` script (a CLAUDE.md *intended*
   convention). `bun run check` (baml:gen + typecheck + test) is the live gate and is green.

## Critical issues

None. The change is behaviour-preserving, the suite is green, the dependency graph stays
acyclic (`dispatch → decompose-epic → engine`; engine never imports `src/play/`), and the
generalization the epic is built on is now proven for the first play — ready for T-007-04 to
prove it for a second.
