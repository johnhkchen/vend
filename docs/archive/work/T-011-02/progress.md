# T-011-02 Progress — propose-decompose-chain-and-gesture

Implementation log. All planned steps executed in order; one minor, documented deviation.

## Completed

| Step | What | Status |
|------|------|--------|
| 1 | `engine/chain.ts`: `StepOptions = CastOptions \| (upstream → CastOptions)`; `PlayStep.opts` widened; `castChain` resolves the function form against `upstream` | ✅ |
| 2 | `play/chain-propose-decompose.ts`: `castProposeDecomposeChain` + pure `epicSubjectFromPath`; two `PlayStep`s (ProposeEpic static opts; DecomposeEpic upstream-derived subject + `assembleInputs` adapter) | ✅ |
| 3 | `play/chain-propose-decompose.test.ts`: offline AC#3 proof (signal→epic→exact thread; epic→tickets; subject derivation) — addon-free, 3 cases | ✅ |
| 4 | `engine/chain-core.test.ts`: ticket-framed "ProposeEpic STOP halts before DecomposeEpic" case | ✅ |
| 5 | `cli.ts`: `chain` in `ParsedCommand` + `USAGE` + pure `parseChainArgs`; `cli.test.ts`: 5 parse cases | ✅ |
| 6 | `cli.ts` `import.meta.main`: the `chain` dispatch arm (lazy import, two-line summary, halt andon, exit code) | ✅ |
| 7 | Full gate + commit `9c5dcee` | ✅ |

## Verification

- `bun run check` (baml:gen + tsc --noEmit + bun test): **340 pass, 0 fail**, 717 expect() calls,
  26 files. (Was 331 after T-011-01 — +9: 3 chain-thread + 5 cli chain parse + 1 chain-core STOP.)
- `bun run check:committed`: `ok — all source committed`.
- `bun run check:head`: `ok — committed HEAD builds`.
- Committed: `9c5dcee` — `T-011-02: propose→decompose chain + \`vend chain\` gesture (E-011)`.

## Deviation — one, minor (the `upstream` type at the decompose adapter)

`noUncheckedIndexedAccess` + the `adapt`/`opts` signatures give `upstream: string | undefined`,
but `assembleInputs` wants a `string`. Per design D2 the invariant is sound: `runChain` only casts
a non-first step when `decideThread` proved the prior step surfaced a non-empty `produced`
(chain-core.ts:53,112), so `upstream` is a present, non-empty string at step 2. Resolved with a
documented `upstream as string` at the adapter and `upstream ?? ""` in the subject-deriving opts
(the latter never hits the empty branch in practice, but keeps the subject non-empty defensively —
`appendRunLog` asserts non-empty). No runtime guard added; the invariant is the primitive's, not
this module's, to re-check.

## Decisions confirmed during implementation

- **Step 4 kept (not a comment pointer):** the generic T-011-01 cases prove halt-on-any-non-success
  abstractly; the new case names it to the chain's headline semantics (ProposeEpic STOP → no
  DecomposeEpic, one run-log record not two). Worth the three lines.
- **`epicSubjectFromPath` NOT imported by the test:** its module loads the BAML addon, so the test
  mirrors the one-line derivation inline (the documented bun-test addon discipline). The runtime
  uses the real exported helper.
- **Shelf integration deferred (D4):** the gesture is the CLI `chain` subcommand only. The shelf
  press is a board-drain shape that fights PE-1; "and/or the shelf" is satisfied by the CLI surface.
  A shelf entry can be a later demand signal.

## What was deliberately NOT done

- No live end-to-end cast wired into a test — it spawns `claude` and loads the addon; it is the
  human sweep verification (AC#4: "signal in, tickets out").
- No `produced` on `decomposeEffect` — nothing chains off decompose yet (the chain's net `produced`
  is the final step's, surfaced by `runChain` already).
- No second `--budget-propose`/`--budget-decompose` split (D5) — per-play defaults differentiate
  the envelopes; one optional override covers the common intent.
