# T-011-01 Design — chain-primitive-and-output-threading

Decisions, with rationale grounded in the research. Each decision names the rejected
alternatives and why.

## The shape of the work

Two changes, in dependency order:

1. **Surface `produced`** — a single canonical reference off a play's effect, carried up
   through the cast into the `RunSummary`. (Enables threading.)
2. **The chain primitive** — `castChain(steps)` running plays in sequence, threading
   `produced → next`, halting on any non-success. Pure threading/halt core + impure shell.

---

## D1 — `produced` is a NEW explicit field, distinct from `artifacts`

**Decision:** Add `produced?: string` to `EffectResult`, separate from the existing
`artifacts?: readonly string[]`.

**Why.** `artifacts` and `produced` mean different things, and conflating them would mislead:
- `artifacts` = ALL files the effect wrote, for provenance / the run log. `decomposeEffect`
  writes a story + N tickets — many artifacts, no single "the output".
- `produced` = the ONE canonical handle the *next play* threads on. For ProposeEpic that is the
  minted epic path; the ticket cites exactly this ("the minted epic path").

**Rejected — derive `produced` from `artifacts[0]`.** Tempting (zero new field), but
`artifacts[0]` is an accident of write order, not a declared contract. `decomposeEffect`'s
`artifacts[0]` is a story path; a future chain threading off a different file would silently get
the wrong one. Making `produced` an *explicit, opt-in* declaration keeps threading intentional —
a play says what it offers downstream, rather than the chain guessing. Backward-compatible
because it is optional (an effect that offers nothing threadable omits it).

**Defensive fallback considered and rejected:** `produced = eff.produced ?? eff.artifacts?.[0]`
in castPlay. Rejected for the same reason — implicit threading is a footgun. castPlay reads
`eff.produced` only.

## D2 — Only a *materialized, ok* effect surfaces `produced`

**Decision:** In `castPlay`, set `produced = eff.ok ? eff.produced : undefined`, only inside the
existing `verdict.materialize && output !== null` branch.

**Why.** `produced` is meaningful only when the effect actually landed. A STOP never runs the
effect (produced stays undefined). A materialized-but-failed effect (e.g. `id-collision`,
`ok:false`) relabels the outcome to non-success, which the chain halts on anyway — but guarding
on `eff.ok` makes the absence explicit rather than incidental. This keeps `RunSummary.produced`
honest: present ⇒ a real artifact a downstream play can consume.

## D3 — `produced` on `RunSummary` is optional and additive

**Decision:** `RunSummary` gains `readonly produced?: string`. Existing callers
(`castProposeEpic`, `castCaptureNote`, `runDecomposeEpic`, and whoever maps outcome → exit code)
read `.outcome`/`.materialized` and are untouched. Optional ⇒ `bun run check:*` stays green
(AC#4).

## D4 — Split: pure `chain-core.ts` + impure `chain.ts` (the cast-core/cast mirror)

**Decision:** The threading + halt JUDGMENT lives in `src/engine/chain-core.ts` (PURE,
type-only imports). The impure adapter that calls `castPlay` lives in `src/engine/chain.ts`,
which re-exports the core (`export * from "./chain-core.ts"`).

**Why.** AC#3 requires the threading + halt logic to be *pure and unit-tested*. The house
pattern is absolute: judgment is pure and tested in `*-core.ts`; the impure shell is the single
untested verb. `chain.ts` must import `castPlay` (which value-imports the executor seam), so a
test importing `chain.ts` would pull the seam into the test process. Keeping the sequencing /
threading / halt decision in a core whose every import is `import type` (erased under
`verbatimModuleSyntax`) lets `chain-core.test.ts` exercise it as an ordinary pure test that
spawns nothing — the `cast-core.test.ts` discipline.

**Rejected — one file with an exported pure `runChain`.** `chain.ts` importing `castPlay`
runtime-loads cast.ts; even a type-only `RunSummary` import is fine, but the *test* importing the
file that also imports castPlay defeats the no-spawn guarantee. The split is the established way.

## D5 — Purity via dependency injection: `runChain` takes injected `cast` thunks

**Decision:** The pure core's unit is `runChain(steps: ChainStep[])`, where a `ChainStep` is
`{ cast: (upstream: string | undefined) => Promise<RunSummary> }`. `runChain` owns the loop,
the threading (`upstream = summary.produced`), and the halt decision — but spawns nothing; the
`cast` thunks are injected. The impure `chain.ts` builds real thunks (`adapt → castPlay`); the
test injects fakes returning canned `RunSummary`s.

**Why.** This is exactly how `makeStreamSink` stays pure (a closure over injected `write`/`sink`).
`runChain` is "pure given its injected edges": its own body has no fs/clock/network/process. The
AC#3 fixtures fall straight out — a fake step-2 records the `upstream` it received (proving
step-1 `produced` → step-2 input); a fake step-1 returning a `gate-failed` summary proves step-2
never runs.

**Rejected — `runChain` takes plays + a real cast function as a param.** More machinery; the
thunk already closes over play/budget/opts/adapt. The injected-thunk seam is the minimal pure
surface.

## D6 — Halt = a non-success step SKIPS downstream casts; the last step never "halts"

**Decision:** The thread/halt decision (`decideThread`) gates only the cast of a *downstream*
step. After casting a step, if it is not the last and it did not succeed-with-`produced`, return
early with `halted: true`. The final step's outcome is reported in `ChainResult.outcome` but
`halted` stays `false` (nothing downstream was skipped).

`decideThread(summary)` proceeds iff `outcome === "success"` AND `produced` is a non-empty
string. Two distinct non-proceed reasons:
- non-success outcome (gate STOP, timeout, budget, id-collision) — the AC's "halts on any STOP",
- success but no `produced` — nothing to thread (a wiring gap surfaced, not a silent stall).

**Why split the two reasons.** A successful step that surfaces nothing threadable cannot feed the
next play. Halting with a *distinct, named* reason ("succeeded but surfaced no produced
reference") makes that wiring error loud instead of passing `undefined` into the next adapter and
failing obscurely downstream. This is the andon discipline applied to composition.

**Why the last step is special-cased.** Evaluating `decideThread` after the last step would
report a misleading `haltReason` for a chain that actually completed every step. "Halt" must mean
"a downstream cast was skipped" — so it is only meaningful when a next step exists.

## D7 — `ChainResult` shape

`{ steps: readonly RunSummary[]; outcome: RunOutcome; halted: boolean; produced?: string;
haltReason?: string }`.

- `steps` — one `RunSummary` per cast step (so callers see every run-log record's summary).
- `outcome` — the LAST cast step's outcome (the chain's terminal outcome; a caller maps
  non-success → non-zero exit, mirroring single-play casts).
- `halted` — did a non-success step skip downstream casts.
- `produced` — the final cast step's `produced` (the chain's net output; for T-011-02's gesture).
- `haltReason` — why it halted, when it did (the andon string).

Empty chain → `{ steps: [], outcome: "success", halted: false }` (a vacuous no-op; documented).

## D8 — `castChain` steps are `PlayStep<any, any>[]` with an `adapt`

**Decision:** `chain.ts` exposes `PlayStep<I, O> = { play, budget, opts, adapt }` where
`adapt: (upstream: string | undefined) => I | Promise<I>` builds the step's typed inputs from
the upstream `produced`. `castChain` takes `readonly PlayStep<any, any>[]` (heterogeneous).

**Why `any`.** A chain holds plays with different `I`/`O`; a single array cannot preserve each
step's type parameters — the identical, documented reality of `AnyPlay = Play<any, any>` in the
registry. Type safety lives at each `PlayStep`'s internally-consistent construction (T-011-02
builds the concrete propose/decompose steps with real types) and at the `adapt` boundary. The
first step's `adapt` ignores `upstream`; each later step adapts the previous `produced`.

**Why `adapt` returns `I | Promise<I>`.** ProposeEpic/Decompose assemble inputs asynchronously
(`assembleProposeEpicInputs` reads fs). The adapter must be allowed to await; `castChain` awaits
it before `castPlay`.

## What stays OUT (T-011-02)

- The concrete propose→decompose `PlayStep`s and the path→`epicPath` adapter.
- The `vend chain <signal>` gesture (cli.ts / shelf).
- The live/fixture end-to-end propose→decompose test.
- Setting `produced` on `decomposeEffect` (nothing chains off decompose yet).

T-011-01 proves the primitive with a synthetic two-step fixture and surfaces `produced` from
`proposeEpicEffect` (so T-011-02 has the path to adapt).
