# T-011-01 Review — chain-primitive-and-output-threading

Self-assessment + handoff. What changed, test coverage, open concerns.

## Summary

Shipped the engine's first **composition primitive**: `castChain(steps)` runs a sequence of
plays through the same generic `castPlay`, threading each step's `produced` output into the next
step's input, and halting on any non-success. The enabler — a play's effect now *surfaces what
it produced* — was added as an optional, backward-compatible field on both `EffectResult` and
`RunSummary`. The threading + halt judgment is a pure core (`runChain`/`decideThread`), unit-
tested with injected fake casts. Committed as `d475851`. All `check:*` green.

## Files changed

**Created**
- `src/engine/chain-core.ts` — PURE core. `ChainStep` (a cast thunk abstracted over the play),
  `decideThread` (the per-step halt gate), `ChainResult`, `runChain` (sequence + thread + halt;
  pure given injected casts). Type-only imports → no runtime edge to the executor seam.
- `src/engine/chain.ts` — IMPURE shell. `PlayStep<I,O>` ({play, budget, opts, adapt}) and
  `castChain` (builds each step's `adapt → castPlay` thunk, delegates to `runChain`). Re-exports
  the core. Imports only the engine — never `src/play/` (acyclic, E-007 keystone).
- `src/engine/chain-core.test.ts` — 12-case pure proof (see coverage below).

**Modified**
- `src/engine/play.ts` — `EffectResult` gains `produced?: string` (distinct from `artifacts`).
- `src/engine/cast.ts` — `RunSummary` gains `produced?: string`; `castPlay` lifts
  `eff.ok ? eff.produced : undefined` into the returned summary.
- `src/play/propose-effect.ts` — `proposeEpicEffect` surfaces `produced` = the minted epic path.
- `src/play/note-core.ts` — `captureNoteEffect` surfaces `produced` = the written note path.
- `src/play/propose-effect.test.ts` — asserts `produced` == minted path == `artifacts[0]`.

## Acceptance criteria

| AC | Status | Evidence |
|----|--------|----------|
| `castChain(steps)` runs plays via `castPlay`, threads `produced` → next via an adapter, halts on STOP, one run-log record per step | ✅ | `chain.ts` `castChain` (adapt → castPlay) over `runChain`; halt = `decideThread`; one record/step is structural (castPlay logs per cast) |
| effect result + `RunSummary` surface `produced` (minimal, backward-compatible) | ✅ | optional fields on `EffectResult`/`RunSummary`; set by `proposeEpicEffect`/`captureNoteEffect`; existing casts untouched |
| threading + halt is PURE + unit-tested: two-step fixture (step-1 produced → step-2 input); step-1 STOP → step-2 never runs | ✅ | `chain-core.test.ts`: "step-2 received EXACTLY step-1's produced"; "step-1 gate STOP → step-2 never runs" (a throwing `neverStep`) |
| `bun run check:*` green; existing single-play casts unaffected | ✅ | 331 pass / 0 fail; typecheck clean; `check:head` + `check:committed` ok; additive-only changes |

## Test coverage

**`chain-core.test.ts` (pure — imports only `./chain-core.ts`, no addon, no spawn):**
- Threading: step-1 `produced` is the exact `upstream` step-2 is cast with; first step gets
  `undefined` upstream; final `produced` is the last step's.
- Halt (AC#3): step-1 gate STOP → step-2 (a throwing spy) never runs, `halted`, outcome carried,
  one summary; every non-success outcome (`timed-out`/`budget-exhausted`/`id-collision`) halts;
  a SUCCESS with no `produced` halts with the distinct "no produced" andon.
- Edges: empty chain → success no-op; single success → carried; single failure → outcome carried
  but `halted: false` (nothing downstream skipped).
- `decideThread` table: success+produced → proceed; success+absent/empty produced → no (reason
  names produced); each non-success → no (reason names the outcome).

**`propose-effect.test.ts`:** the effect surfaces `produced` = the minted `E-0XX.md` path,
equal to `artifacts[0]`.

**Coverage gaps (intentional, documented):**
- `castChain` (the impure shell) has no direct test — by house design it is the untested verb;
  its logic is the pure `runChain`. It is proven live when T-011-02 casts the real
  propose→decompose chain (the sibling ticket's fixture + sweep verification).
- `castPlay`'s one-line `produced` lift is not directly unit-tested (castPlay is the single
  untested impure verb); it is covered at the boundaries by the propose-effect assertion (effect
  side) and the chain-core fixtures (consumer side).

## Open concerns / notes for the human reviewer

1. **`PlayStep<any, any>[]` in `castChain`.** The same documented, unavoidable type-erasure as
   `AnyPlay = Play<any, any>`: a chain is heterogeneous. Type safety lives at each `PlayStep`'s
   construction (T-011-02, with concrete types) and the `adapt` boundary. Flagged so review
   accepts the `any` deliberately rather than as a smell.

2. **`produced` is explicit, not derived from `artifacts[0]`** (design D1). A deliberate choice:
   threading should be an intentional contract, not an accident of write order. The cost is that
   each play wanting to be chained-from must opt in by setting `produced` (propose + note do;
   decompose does not yet, since nothing chains off it).

3. **Halt semantics** (design D6): `halted` means "a non-success step SKIPPED downstream casts".
   A failing *final* step reports its outcome in `ChainResult.outcome` but `halted: false`
   (nothing was skipped). A caller maps `outcome !== "success"` → non-zero exit regardless, so
   this distinction is informational, not a correctness hazard — but worth knowing when reading
   a `ChainResult`.

4. **One deviation** (noUncheckedIndexedAccess): bound `steps[i]` to a local with an unreachable
   `undefined` break to satisfy the checker honestly (no non-null assertion). progress.md has the
   detail.

## Handoff

T-011-02 (`depends_on: [T-011-01]`) consumes this: it builds the concrete propose→decompose
`PlayStep`s (epic path → `epicPath` adapter), wires a `vend chain <signal>` gesture, and adds the
end-to-end fixture/live proof. Everything it needs — `castChain`, `PlayStep`, `ChainResult`, and
ProposeEpic's surfaced `produced` path — is shipped and green here.
