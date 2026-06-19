# T-007-02 — Plan: generic-cast-loop

Ordered, independently-verifiable steps. The pure core lands and is proven first
(self-contained); the impure verb follows; each step typechecks + tests green before the
next. Commit after each meaningful unit.

## Verification criteria (the definition of done)

- `bun run check:typecheck` (`tsc --noEmit`) exits 0.
- `bun run check:test` (`bun test`) green; the new cast-core tests pass; the prior 236
  still pass (no regression); no BAML addon loaded into the cast-core test process.
- `src/engine/cast.ts` exports `castPlay(play, inputs, budget, opts): Promise<RunSummary>`
  — the render→dispense→meter→parse→gate→classify→effect→log loop, branching on the pure
  `classify`, streaming to both surfaces, one `appendRunLog` per cast (AC#1).
- `cast.ts` imports nothing from `src/play/`, gates.ts, or BAML — play-agnostic (AC#2).
- The decision core is pure + tested; `castPlay` is the single untested verb (AC#3).

## Step 1 — `src/engine/cast-core.ts` (the pure core)

Write the addon-free decision core (Structure §cast-core):
- `DEFAULT_MODEL`, `resolveLoggedModel`.
- `ClassifyInput`, `Verdict`, `castGateRows`, `classify` (generic over `GateVerdict`;
  first-match priority timeout → budget → gate-stop → success; clear → `[]` gate rows).
- `formatMessage`, `makeStreamSink` (re-implemented identical to decompose-epic-core).
- All imports `import type`. Doc-comment the module's purity + the deliberate duplication
  of the stream/model helpers (Design D1) and the clear-→-`[]` choice (Design D3).

**Verify:** `tsc --noEmit` clean (file compiles against `GateVerdict`/`BudgetOutcome`/
run-log types). No runtime behavior yet to test — Step 2 covers it.

## Step 2 — `src/engine/cast-core.test.ts` (prove the core)

The pure-function test (Structure §test plan): `classify` ×4, `castGateRows` ×3,
`formatMessage`, `makeStreamSink`, `resolveLoggedModel`. Import ONLY `./cast-core.ts`
(no baml, no `./cast.ts`). Use fabricated `BudgetOutcome`/`GateVerdict`/`StreamMessage`
literals (mirror decompose-epic.test.ts's fixtures), `toBe`/`toEqual` exact pins.

**Verify:** `bun test src/engine/cast-core.test.ts` green; full `bun test` still green
(236 + new). The test file loads no native addon (it imports only the pure core).

**Commit:** `T-007-02: cast-core — the generic pure decision core (classify, gate-rows, stream)`.

## Step 3 — `src/engine/cast.ts` (the impure orchestrator)

Write `CastOptions`, `RunSummary`, and `castPlay<I, O>` (Structure §cast.ts sequence):
- render → transcript sink → dispense (timeout latch) → meter → parse → gates → classify
  → effect (read `EffectResult.ok`/`.outcome` as data, no try/catch) → resolve model →
  one `appendRunLog` → return summary.
- Private `stopReason(gate, budget)` for the andon stdout line.
- Doc-comment: the impure verb (untested, mirrors `runDecomposeEpic`); play-agnostic
  (touches the `Play` interface only); one countable record per cast.

**Verify:** `tsc --noEmit` clean — crucially proves the play-agnostic compile: `castPlay`
typechecks against the generic `Play<I, O>` with zero `src/play/`/gates/BAML import. Grep
the import block to confirm (no `../play/`, no `../gate/`, no `baml_client`).

**Commit:** `T-007-02: castPlay — the generic, play-agnostic cast loop`.

## Step 4 — Full gate sweep + progress

Run `bun run check:typecheck` and `bun run check:test` together; confirm 0 type errors and
the full suite green with the new tests counted. Record the final counts + any deviation
in `progress.md`.

**Commit (if any residual):** folded into Step 3's commit if nothing changed.

## Testing strategy summary

- **Unit-tested (pure):** the entire decision core — `classify`, `castGateRows`,
  `formatMessage`, `makeStreamSink`, `resolveLoggedModel`. This is where the loop's
  *judgment* lives, so this is where the coverage is (AC#3).
- **Not unit-tested (by design):** `castPlay` — it spawns `claude` and writes fs, exactly
  the untested-verb category of `runDecomposeEpic`/`dispense`/`appendRunLog`/`materialize`.
  Its correctness rests on `tsc` (play-agnostic compile) + the cast-core tests; it goes
  LIVE in T-007-03 (DecomposeEpic registered + cast) — the analogue of T-002-04.
- **No new live/integration run here** — T-007-02 ships the generic mechanism; T-007-03
  exercises it end-to-end against a real registered play.

## Risk flags

- **R1 — `GateVerdict` ↔ classify type fit.** The generic `classify` reads
  `gateVerdict.status`/`.gate`/`.unit`/`.reason` straight off the interface union — no
  cast. Low risk; `tsc` is the proof. (The *other* direction — gates.ts `GateResult` →
  `Play.gates` return — is T-007-03's concern, T-007-01 review concern #1.)
- **R2 — duplicated stream/model helpers drift from decompose-epic-core.** Mitigated:
  they are tested independently here and the originals stay put; a kaizen DRY ticket
  reconciles once T-007-03 reverses the dep direction. Flagged in Review.
- **R3 — successful DecomposeEpic runs will log `gateResults: []` once wired (D3).** Not a
  T-007-02 defect (the generic contract has no per-gate names on clear); called out for
  the T-007-03 author to accept or enrich `GateVerdict.clear`. Flagged in Review.
- **R4 — `opts.subject` empty.** `appendRunLog`'s `assertNonEmpty` throws — a caller
  (T-007-03) wiring bug surfaced loudly, consistent with the house rule. Documented on
  the field.
