# T-011-02 Review — propose-decompose-chain-and-gesture

Handoff for a human reviewer. What changed, how it's covered, what to watch. The E-011 capstone:
signal → epic → tickets in one gesture, over the T-011-01 `castChain` primitive.

## What changed

**Modified**
- `src/engine/chain.ts` — added `StepOptions = CastOptions | ((upstream) => CastOptions)`; widened
  `PlayStep.opts` from `CastOptions` to `StepOptions`; `castChain` resolves the function form
  against the same `upstream` the adapter sees. Backward-compatible — a static `CastOptions` is
  still valid, and `PlayStep` had no callers before this ticket. Engine stays acyclic (imports
  engine + `Budget` only).
- `src/cli.ts` — `USAGE` extended; `ParsedCommand` gains `chain`; `parseArgs` routes `chain` to the
  new pure `parseChainArgs`; a `chain` dispatch arm added to `import.meta.main` (lazy import).
- `src/cli.test.ts` — 5 `parseChainArgs` cases.
- `src/engine/chain-core.test.ts` — 1 case framing "ProposeEpic STOP halts before DecomposeEpic".

**Created**
- `src/play/chain-propose-decompose.ts` — `castProposeDecomposeChain(opts)` (the concrete chain)
  and the pure `epicSubjectFromPath`. The convergence node of E-011.
- `src/play/chain-propose-decompose.test.ts` — the offline AC#3 proof (3 cases, no model/addon).

**Not touched** — `propose-epic.ts`, `decompose-epic.ts`, `propose-effect.ts`,
`project-context.ts`, `materialize.ts`: reused as-is. The `produced` thread (T-011-01) and both
input assemblers (E-009 / E-002) already existed; the chain only wires them.

## How the ACs are met

1. **Chain defined via `castChain`, ProposeEpic `produced` → DecomposeEpic `epicPath`** —
   `castProposeDecomposeChain` builds two `PlayStep`s; step 2's `adapt` is
   `upstream → assembleInputs({ epicPath: upstream })`. The thread is ProposeEpic's minted epic
   path (`proposeEpicEffect.produced`) → DecomposeEpic's `epicPath`. ✅
2. **A gesture casts the whole chain; both artifacts, each gated + logged (two records); a STOP
   halts before decompose** — `vend chain <signal> [--budget …]`. On success both plays cast via
   `castPlay` (one `appendRunLog` each ⇒ two records, structural). A ProposeEpic gate STOP →
   `decideThread` returns no-proceed → `runChain` halts with `halted:true`, DecomposeEpic never
   casts (one record). The dispatch arm prints both runs, the halt reason, and maps to an exit
   code. ✅
3. **Fixture/canned-reply test proves signal → epic → tickets; threaded epic is the exact minted
   one** — `chain-propose-decompose.test.ts`: `proposeEpicEffect` writes `E-010.md` and returns it
   as `produced`; `assembleInputs` on that exact path reads back `inputs.epic === the file written`
   (byte-for-byte), containing the minted id + the card fields; `materialize(CANNED_PLAN)` writes
   the story/ticket files. ✅
4. **`bun run check:*` green** — `check` 340 pass / 0 fail, `tsc` clean, `check:committed` +
   `check:head` ok. The live signal-in/tickets-out cast is the human sweep. ✅

## Test coverage

| Concern | Proven | Where |
|--------|--------|-------|
| thread `produced` → next input (generic) | pure unit, fake casts | chain-core.test.ts (T-011-01) |
| STOP halts before downstream (named) | pure unit | chain-core.test.ts (new) |
| ProposeEpic surfaces the epic path | real-fs | propose-effect.test.ts + new |
| threaded epic == exact minted epic | real-fs reconstruction | chain-propose-decompose.test.ts |
| epic → tickets materialize | real-fs | chain-propose-decompose.test.ts |
| run-log subject derivation | inline unit | chain-propose-decompose.test.ts |
| gesture parses (signal/budget/errors) | pure unit | cli.test.ts |
| **end-to-end live** | **human sweep (AC#4)** | — |

**Gaps (by design, house pattern):** `castProposeDecomposeChain` itself and the cli `chain`
dispatch arm are the untested impure shells — they load the addon / spawn `claude`, so no
`bun test` imports them (the `castProposeEpic` / `dispatch.ts` / `press.ts` precedent). Their logic
is the tested `runChain` + the offline thread proof + the pure parser. This is the same coverage
shape every gesture in the repo has.

## Open concerns / watch-items

1. **`upstream as string` at the decompose adapter** — relies on the `runChain` invariant (a
   non-first step is only cast after a non-empty `produced`). Sound today; documented at the call
   site and in progress.md. If `castChain`'s halt logic ever changes, re-check this cast.
2. **Budget override applies to BOTH steps identically** — a single `--budget` caps each step at the
   same envelope, which can under-budget DecomposeEpic (default 2h/50k) relative to ProposeEpic
   (30m/16k). Acceptable for v1 (omitting `--budget` uses each play's warranted default); a
   per-step split is a noted future option (D5).
3. **Shelf integration not done** — the gesture is the CLI subcommand only (D4, PE-1). If a shelf
   "cast this chain" card is wanted later, it is a new demand signal, not a regression here.
4. **No `produced` net-output consumer yet** — `ChainResult.produced` is the decompose step's
   output (it has none set on `decomposeEffect`, so the chain's `produced` is `undefined`). That is
   fine: nothing chains off the decompose tickets today. If a third stage is ever added,
   `decomposeEffect` would need to set `produced`.

## Suggested human verification (the sweep)

Run `vend chain "<a real pulled demand signal>"` against the repo: confirm an `E-0XX.md` epic card
appears on the board AND its stories/tickets materialize, with two records in `.vend/runs.jsonl`
(propose/<signal>, decompose/<minted id>). Then run it on a signal that should fail the value/bounds
gate and confirm the chain halts after one record with `chain halted: …` and no decompose output.
