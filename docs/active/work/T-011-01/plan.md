# T-011-01 Plan — chain-primitive-and-output-threading

Ordered, independently-verifiable steps. Each is small enough to commit atomically. Testing
strategy + verification criteria below.

## Testing strategy

- **Pure unit (the AC#3 proof):** `chain-core.test.ts` imports ONLY `./chain-core.ts`, injects
  fake `cast` thunks returning canned `RunSummary`s — spawns nothing, loads no addon. Covers:
  (a) `decideThread` branches; (b) two-step threading (step-1 `produced` → step-2's `upstream`);
  (c) step-1 STOP → step-2 never runs; (d) empty / single-step chains; (e) success-without-
  produced halts with the distinct reason.
- **Effect unit:** extend `propose-effect.test.ts` to assert `produced` = the minted path.
- **No new integration test here.** The live propose→decompose end-to-end is T-011-02. `castPlay`
  remains the single untested verb (its logic is cast-core.ts); the `produced` lift is a
  one-line, type-checked carry that the `propose-effect.test.ts` assertion + chain-core fixtures
  cover at the boundaries.
- **Gate:** `bun run check` (= `baml:gen && check:typecheck && check:test`) green; `check:head`
  builds clean (the committed-HEAD gate). Existing 319 tests must still pass (AC#4).

## Steps

### Step 1 — `EffectResult.produced` (leaf type)

`src/engine/play.ts`: add `readonly produced?: string` to `EffectResult` with the doc-comment
distinguishing it from `artifacts`.

*Verify:* `bun run check:typecheck` green (additive optional field; nothing else changes).

### Step 2 — `RunSummary.produced` + the cast threading

`src/engine/cast.ts`:
- Add `readonly produced?: string` to `RunSummary` (doc-comment).
- In `castPlay`, declare `let produced: string | undefined;`. Inside the existing
  `if (verdict.materialize && output !== null)` branch set `produced = eff.ok ? eff.produced :
  undefined;`. Add `produced` to the returned object.

*Verify:* `bun run check:typecheck` green. `bun test` green (no behavior change — `produced` is
undefined for every existing effect until Step 3).

### Step 3 — effects set `produced`

- `src/play/propose-effect.ts`: success return becomes
  `{ ok: true, detail: ..., artifacts: [path], produced: path }`.
- `src/play/note-core.ts`: `captureNoteEffect` return becomes
  `{ ok: true, detail: ..., artifacts: [path], produced: path }`.

*Verify:* `bun run check:typecheck` green.

### Step 4 — `propose-effect.test.ts` assertion

Add to the existing "effect mints + writes" test (or a focused sibling): after a successful
`proposeEpicEffect`, assert `result.produced === path` (the minted `E-0XX.md` path) and that it
equals `result.artifacts?.[0]`.

*Verify:* `bun test src/play/propose-effect.test.ts` green; the new assertion passes.

### Step 5 — `chain-core.ts` (the pure core)

Create `src/engine/chain-core.ts` per structure.md: `ChainStep`, `ThreadDecision`,
`decideThread`, `ChainResult`, `runChain`. Type-only imports of `RunSummary` (cast.ts) +
`RunOutcome` (run-log.ts). House-style module header explaining the pure/impure split and the
injected-cast purity seam.

*Verify:* `bun run check:typecheck` green.

### Step 6 — `chain-core.test.ts` (the AC#3 proof)

Create `src/engine/chain-core.test.ts`, importing ONLY `./chain-core.ts`. Helpers: a
`summary(outcome, produced?)` factory; a `recordingStep(summary)` that captures the `upstream`
it was called with. Tests:

1. **two-step thread:** step-1 returns `success` + `produced:"docs/active/epic/E-042.md"`;
   step-2 records its `upstream`. Assert step-2's recorded `upstream === "docs/active/epic/E-042.md"`;
   `result.steps.length === 2`; `result.outcome === "success"`; `result.halted === false`;
   `result.produced ===` step-2's produced.
2. **step-1 STOP halts:** step-1 returns `gate-failed`; step-2 is a spy that throws if called.
   Assert step-2 never ran; `result.steps.length === 1`; `result.outcome === "gate-failed"`;
   `result.halted === true`; `result.haltReason` mentions the non-success outcome.
3. **success-without-produced halts:** step-1 `success`, no `produced`; step-2 spy. Assert
   step-2 never ran; `halted === true`; `haltReason` names "no produced reference".
4. **first step gets `undefined` upstream:** single recording step; assert recorded upstream is
   `undefined`.
5. **empty chain:** `runChain([])` → `{ steps: [], outcome: "success", halted: false }`,
   `produced` undefined.
6. **single successful step:** `result.outcome` reflects it, `halted === false`, `produced`
   carried.
7. **`decideThread` unit table:** success+produced → proceed; success+empty/absent produced →
   no, reason names produced; each non-success outcome → no, reason names the outcome.

*Verify:* `bun test src/engine/chain-core.test.ts` green; no addon loaded, nothing spawned.

### Step 7 — `chain.ts` (the impure shell)

Create `src/engine/chain.ts` per structure.md: `PlayStep<I,O>`, `castChain`, re-export the core.
House-style header (acyclic direction; impure shell over the pure core).

*Verify:* `bun run check:typecheck` green (the `PlayStep<any,any>[]` → `ChainStep[]` map
type-checks; `adapt`'s `I | Promise<I>` awaited before `castPlay`).

### Step 8 — full gate + commit

Run `bun run check` (baml:gen + typecheck + test) and `bun run check:head`. All green, all
existing tests still pass. Commit.

*Verify:* `bun run check:*` green (AC#4). `git status` clean after commit (excluding the work
artifacts, which Lisa handles).

## AC traceability

| AC | Covered by |
|----|-----------|
| `castChain(steps)` runs plays via `castPlay`, threads produced → next via an adapter, halts on STOP, one run-log record per step | Steps 5 (runChain), 7 (castChain + `adapt`); one-record-per-step is structural (castPlay) |
| effect result + RunSummary surface `produced` (minimal, backward-compatible) | Steps 1, 2, 3 (optional fields, additive) |
| threading + halt is pure + unit-tested: two-step fixture; step-1 STOP → step-2 never runs | Steps 5, 6 (chain-core + chain-core.test) |
| `bun run check:*` green; existing single-play casts unaffected | Step 8; additive-only design |

## Risks / watch-points

- **Erasure assumption:** if `import type { RunSummary } from "./cast.ts"` were NOT fully erased,
  chain-core.test.ts would pull the seam. Mitigated by `verbatimModuleSyntax` (on) + `import
  type`. Verify the test spawns nothing (it has no fs/spawn imports).
- **`any` lint:** `PlayStep<any, any>[]` mirrors `AnyPlay`'s documented exception. Add the same
  justifying comment so lint/review accept it.
- **Last-step semantics:** ensure `decideThread` is NOT evaluated after the final step (D6) —
  guard with the `isLast` break so a completed chain never reports a `haltReason`.
