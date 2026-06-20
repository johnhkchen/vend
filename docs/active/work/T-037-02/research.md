# T-037-02 — Research

**The live, metered macro-wallet sweep.** Where T-037-01 proved *deterministically* that the bounded
run will clear, this ticket *performs* it: a watched `vend work --no-intervened --budget <bounded>`
that casts real `claude -p` chains, debits a real wallet, and mints real epics+tickets onto the
board. This research maps the seams the run drives end-to-end — board staging, the freshness gate,
the price path, the spend-down loop, the receipt, and the ledger append — and records the **live
environment state** at run time. Descriptive: what exists and how it connects, not what to change
(there is no `src/` change — the deliverable is the watched run + `sweep-log.md`).

## 1. The gesture spine — `castWork` drives Confirm→Run→Settle

`castWork` (`src/play/work.ts:147`, IMPURE, not unit-tested by design) is the whole `vend work` arm:

```
work.ts:150  readBoard(root, opts.boardPath)            → no-board if absent
work.ts:154  parseBoardSignals(board.md)                → ranked signals (empty-board if none)
work.ts:162  freshness gate (unless --stale-ok):
               boardMtimeMs = stat(board.path).mtimeMs
               liveMtimeMs  = newestActiveMtimeMs(root)  (newest docs/active/{epic,stories,tickets})
               isBoardStale(b,l) = b < l                 → stale-board if true
work.ts:170  funded = opts.budget ?? DEFAULT_MACRO_BUDGET; wallet = allocate(funded)
work.ts:177  { records } = loadRunLog()                  → the live .vend/runs.jsonl
work.ts:183  proposeEnvelope   = recalibrate("propose-epic",   records, "standard", prior).envelope
work.ts:184  decomposeEnvelope = recalibrate("decompose-epic", records, "standard", prior).envelope
work.ts:185  price = sumBudgets(propose, decompose)      → the per-chain authorization price
work.ts:187  session = spendDown({ wallet, candidates, priceOf:()=>price, castOne, labelOf, onStep })
```

The five terminal `WorkResult` kinds: `no-board`, `empty-board`, `stale-board` (all pre-funding
refusals), and the funded path returning the `spendDown` `SessionResult` (`ran`). The CLI renders
each (`src/cli.ts` work arm ~640-660); a refusal exits 1, a clean spend exits 0.

## 2. Board staging — `vend steer` / `vend survey` (themselves live casts)

`DEFAULT_BOARDS` (`work.ts:40`) still names `staged/steer.md` + `staged/survey-board.md`, but **both
files were removed 2026-06-20** — a bare `vend work` now hits `no-board`. So the run MUST stage one:

- `vend steer [--budget <ms>,<tokens>]` (`cli.ts:612`, dispatches `castSteer`/`steerProjectPlay`,
  `src/play/steer.ts`): reads the WHOLE project, stages `docs/active/pm/staged/steer.md` — a ranked
  demand board (`## Pull these` with `vend chain "<signal>"` lines) PLUS the real forks for human
  assent. It is itself a real cast, bounded by its own recalibrated envelope.
- `vend survey` (`cli.ts:599`): the survey-core equivalent staging `survey-board.md`.

Either writes a board file **now**, so its mtime is newer than every `docs/active/**` edit ⇒ it
clears the freshness gate (Claim 4 below). The staged board's `vend chain "…"` lines are parsed
verbatim by `parseBoardSignals` (`work-core.ts:65`, regex `^vend chain "(.*)"(?:\s+#.*)?$`) into the
ranked candidate list `spendDown` walks. Two existing staged files
(`graph-view-human-projection.md`, `recalibrate-…md`) are present but **stale** (mtimes Jun 19,
older than today's edits) — they are NOT `DEFAULT_BOARDS` and would trip the gate anyway.

## 3. The price path — `recalibrate` over the live ledger (auth==exec, E-025)

Identical to T-037-01's Claim 1 (the same pure functions). `price = sumBudgets(proposeEnvelope,
decomposeEnvelope)` at the `standard` tier (p90) over `loadRunLog()`. **Decisively**, the two
per-step envelopes are threaded back into the cast PER STEP — `castOne` passes
`proposeBudget: proposeEnvelope` / `decomposeBudget: decomposeEnvelope` into
`castProposeDecomposeChain` (`work.ts:195-196`). So the chain RUNS under exactly the budget it was
priced/authorized at: the E-024 no-op (authorized 227k, cast at the 150k static default →
budget-exhausted → cleared 0) **cannot recur** (E-025). T-037-01 computed today's price:
**propose `{72785 ms, 227390 tok}`, decompose `{160745 ms, 227464 tok}`, chain `{233530 ms, 454854
tok}` = 454.9k tok / ~3.9 min**, both `measured` (p90). This will recompute live at run time over
whatever the ledger holds then.

## 4. The spend-down loop — `spendDown` (`src/engine/spend.ts`)

The walk-away engine (IMPURE shell over the pure `spend-core.ts`; engine ⊥ play — the chain is
INJECTED as `castOne`). The loop (`spend.ts`):

```
for (;;):
  next = fitNext(wallet, board, priceOf)                  // highest-leverage AFFORDABLE candidate (P7)
  cont = shouldContinue(wallet, {remaining: board.length, fits: next!==null}, lastOutcome)
  if cont.action === "stop": return SessionResult{ steps, stop, stopDetail, remaining, cleared }
  onStep({phase:"start", candidate, remaining})           // IA-7 production line ▶
  result = await castOne(next)                            // the real propose→decompose chain
  wallet = debit(wallet, result.actuals)                  // DEBIT the ACTUALS (not the prediction)
  board  = board without next                             // drop the pulled candidate
  lastOutcome = result.outcome
  onStep({phase:"done", candidate, remaining})            // IA-7 ✓
```

Three clean stops in precedence (`shouldContinue`, `spend-core.ts:116`): **andon** (last cast
non-success — amber, IA-9) › **board-cleared** (`remaining === 0`) › **wallet-exhausted** (no
affordable candidate fits). P7: the only cast authorized is a `fitNext` result, so the loop never
authorizes a cast the wallet can't afford; an andon'd cast still burned cost, so it is debited too.
`onStep` emits drive the live `formatStepSignal` meter (`work-core.ts:91`) — the two-denomination
wallet readout the operator watches.

## 5. The receipt — `renderReceipt` (`work-core.ts:151`)

The Settle close-out (PURE). Header `═ vend work — receipt ═`, then either "No cast ran…" (0 steps)
or `Cast N, cleared M:` with one line per cast (`✓ <candidate> ◇<tok> ⏱<dur>` cleared, or amber
`⚠ <candidate> andon: <outcome>` refused), then `wallet: <formatWallet>` (funded vs remaining, both
denominations, IA-8), then `stopped: <head> — <detail>` (amber iff andon). `STOP_HEAD`:
`board-cleared`→"board cleared", `wallet-exhausted`→"wallet exhausted", `andon`→"andon — refused".
**This verbatim text is the core evidence `sweep-log.md` captures.**

## 6. The `--no-intervened` forward-E1 thread

Per T-037-01 Claim 3 (every edge confirmed): `cli.ts:412` `--no-intervened` ⇒ `intervened=false` →
`castWork` → `castProposeDecomposeChain({…, intervened})` → each cleared step appends **one**
run-log record with `intervened:false`; `reviveRecord` keeps `false`, no `intervenedAttestation`
marker ⇒ `intervenedAttested=undefined` ⇒ classified **forward (live)** by `auditWalkAway`
(`walk-away.ts:206`). **Each cleared CHAIN appends TWO records** (propose + decompose) — so a clean
N-chain sweep adds `2N` forward "untouched" records to `.vend/runs.jsonl`. This is the live
forward-E1 evidence the watched run produces (it does NOT meet the ≥10 bar in one session — T-037-03).

## 7. Live environment state (read 2026-06-20 ~15:48)

- `claude` CLI **2.1.185** present (`/Users/johnchen/.local/bin/claude`); `bun 1.3.9`; `baml_client/`
  generated (the native-addon path the chain value-imports). **The live executor is runnable here.**
- `.vend/runs.jsonl`: **25 records**. Last two are both `decompose-epic budget-exhausted` — one
  `intervened:true` (attested=false), one `intervened:false` — i.e. recent forward casts that
  *censored* at their envelope (an honest P7 andon, not a price-mismatch).
- Staged boards present but **stale** (Jun 19): `graph-view-human-projection.md`,
  `recalibrate-…md`. Newest `docs/active/**` md is today's T-037-01 work (~15:46). ⇒ any pre-existing
  board is stale; a fresh stage at run time is mandatory.

## 8. Constraints & assumptions

- The deliverable is a **real spend** — verbatim terminal output, not paraphrase (AC). It cannot be
  fabricated; it must be cast or honestly recorded as not-cast.
- mtime is a heuristic (`--stale-ok` exists) but a fresh stage makes the gate pass cleanly.
- The price predicts; the wallet debits **actuals**. A per-cast `budget-exhausted` at the (correct)
  p90 envelope is an honest P7 andon, distinct from the E-024 no-op T-037-01 ruled out.
- Minting epics+tickets MUTATES `docs/active/**` (real board state other agents act on) and SPENDS
  real tokens — the run is the "human funds the budget at the counter and walks away" gesture (P2/P7).
- `lisa validate` must be green on the minted ids (AC) — the minted markdown must be well-formed.
