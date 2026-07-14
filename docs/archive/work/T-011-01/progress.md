# T-011-01 Progress — chain-primitive-and-output-threading

Implementation log. All eight planned steps executed in order; zero deviations from plan.md.

## Completed

| Step | What | Status |
|------|------|--------|
| 1 | `EffectResult.produced?: string` (play.ts) — distinct from `artifacts`, doc-commented | ✅ |
| 2 | `RunSummary.produced?: string` + lift `eff.ok ? eff.produced : undefined` in `castPlay` (cast.ts) | ✅ |
| 3 | `proposeEpicEffect` sets `produced: path` (minted epic path); `captureNoteEffect` sets `produced: path` | ✅ |
| 4 | `propose-effect.test.ts`: assert `res.produced === expected === artifacts[0]` | ✅ |
| 5 | `src/engine/chain-core.ts` — PURE `runChain` / `decideThread` / `ChainStep` / `ChainResult` / `ThreadDecision` | ✅ |
| 6 | `src/engine/chain-core.test.ts` — the AC#3 proof (12 cases), imports only `./chain-core.ts` | ✅ |
| 7 | `src/engine/chain.ts` — IMPURE shell `PlayStep` + `castChain`, re-exports the core | ✅ |
| 8 | Full gate + commit | ✅ |

## Verification

- `bun run check` (baml:gen + typecheck + test): **331 pass, 0 fail**, 686 expect() calls,
  25 files. (Was 319 before — +12 from chain-core.test.ts and the propose `produced` assertion.)
- `bun run check:head`: `ok — committed HEAD builds`.
- `bun run check:committed`: `ok — all source committed`.
- `tsc --noEmit`: clean.
- Committed: `d475851` — `T-011-01: castChain primitive + thread \`produced\` (E-011)`.

## Deviation — one, minor (noUncheckedIndexedAccess)

The plan's `runChain` loop indexed `steps[i].cast(...)` directly. The project compiles with
`noUncheckedIndexedAccess`, so `steps[i]` is `ChainStep | undefined`. Fixed by binding
`const step = steps[i]; if (step === undefined) break;` before the cast — unreachable in
practice (`i < steps.length`) but it satisfies the type checker honestly rather than with a
non-null assertion. No behavior change; the loop is otherwise exactly as planned.

## What was deliberately NOT done (T-011-02 boundary)

Per design.md's "What stays OUT" and the sibling ticket's cites:
- The concrete propose→decompose `PlayStep`s and the epic-path → `epicPath` adapter.
- The `vend chain <signal>` gesture (cli.ts / shelf).
- A live/fixture end-to-end propose→decompose test (T-011-01's proof is the synthetic two-step
  pure fixture).
- `produced` on `decomposeEffect` (nothing chains off decompose yet).

These all depend on the primitive shipped here; they are T-011-02's scope (`depends_on:
[T-011-01]`).

## Notes for review

- `castPlay` stays the single UNTESTED impure verb (its logic is cast-core.ts); the `produced`
  lift is one type-checked line covered at the boundaries by the propose-effect assertion and the
  chain-core fixtures.
- `castChain` is likewise the impure shell, untested by design — its logic is the pure
  `runChain`, which the 12-case suite exercises with injected fake casts (no addon, no spawn).
