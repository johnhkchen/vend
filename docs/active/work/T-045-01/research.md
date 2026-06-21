# T-045-01 — Research: the live cadence sweep

Descriptive map of the spend path, the two hardening seams to confirm live, the freshness gate,
and the forward-E1 ledger. No solutions here — that is Design.

## 1. What this ticket actually is

This ticket's operative work is **not a code change**. Every step is a *live, metered `claude -p`
cast* against the real Anthropic API:

- **Step 1** (`vend steer`/`survey`) fires a real cast that re-reads the project and writes a fresh
  `staged/steer.md`. The ledger shows a `steer` play cast costs ~$0.76 / ~26k output tokens
  (`.vend/runs.jsonl`, `run-2026-06-21T00-05-46-640Z`).
- **Step 2** (`vend work --no-intervened --budget 3600000,1000000`) funds a ~1h/~1M wallet and
  *spends it down*: per ranked signal it casts the propose→decompose **chain** (two casts), debiting
  the wallet by real actuals until a clean P7 stop. Ledger shows propose/decompose casts at
  ~$0.6–0.94 each. A ~1M-token sweep is therefore **several dollars and up to ~1 hour of real spend
  that mints real epics** into `docs/active/epic/` and appends real records to `.vend/runs.jsonl`.

This is irreversible (real money, minted board artifacts, ledger appends) and outward-facing (it
spawns subprocesses that call the API). The ticket flags this explicitly: *"This ticket performs a
LIVE, METERED spend … NOT a free proof."* Authorization is asserted to come from the human running
`lisa loop`; the budget bounds it (P7).

## 2. The spend path (the cast spine)

`castWork` — `src/play/work.ts:155` — is the composition layer (ENGINE ⊥ PLAY, E-007). Sequence:

1. `castPreflight()` (`work.ts:162`) — doctor gate (T-042-04). A broken env returns `unfit-env`
   (clean refusal) *before* any token is metered.
2. `readBoard` (`work.ts:106`) — tries `--board`, else the steer→survey fallback
   `DEFAULT_BOARDS = ["docs/active/pm/staged/steer.md", "docs/active/pm/staged/survey-board.md"]`
   (`work.ts:42`). Missing → `no-board`; empty signals → `empty-board`.
3. **Freshness gate** (`work.ts:177`) — unless `--stale-ok`, stats the board mtime and the newest
   `docs/active/{epic,stories,tickets}` mtime; if `isBoardStale` (board < live, `work-core.ts:105`)
   returns `stale-board` (clean amber refusal).
4. `allocate(funded)` (`work.ts:186`) — fund the macro wallet.
5. Price once from the ledger: `recalibrate(proposeEpicPlay.name …)` + `recalibrate(decompose…)`
   summed (`work.ts:198–200`). This gates P7 `canAfford`; the wallet debits *actuals*, not the price.
   (E-025 fix: authorize == execute — cast runs under exactly the envelope authorized.)
6. `spendDown<string>` (`engine/spend.ts`) — pull highest-leverage affordable signal, `castOne` =
   `castProposeDecomposeChain` threading `intervened` (the E1 self-report), debit by actuals, repeat
   until clean stop. Returns `SessionResult`.
7. Returns `WorkResult` union (`work.ts:82`): `unfit-env | no-board | empty-board | stale-board |
   spent`. CLI (`src/cli.ts`, `work` arm ~line 660–700) renders via `work-core.renderReceipt`.

CLI flag parsing (`cli.ts:427–467`): `--stale-ok` → `staleOk`; `--no-intervened` → `intervened=false`;
`--budget <ms>,<tokens>` → `budget`. Confirmed `--no-intervened` and `--budget` both reach `castWork`.

## 3. Seam A — E-043 idempotent mint (confirm NO orphan)

`proposeEpicEffect` — `src/play/propose-effect.ts:75`. Before minting, it now **adopts** an existing
same-title epic:

- `listEpicIdTitlesIn(dir)` reads `{id,title}` for every `docs/active/epic/*.md`.
- `findExistingByTitle(card.title, liveEpics)` (`id-guard.ts:66`, pure, normalizes trim+lowercase) —
  if a same-title epic exists, return `ok` with its path, **mint nothing** (`propose-effect.ts:85–94`).
- Only a genuinely new title mints `nextEpicId` (`propose-effect.ts:96–116`).

This closes the E-041/E-042 double-mint (a retried chain re-mints a fresh max+1 id → two cards, same
title → an **orphan**: a childless duplicate). **Live confirmation after the sweep:** no two epic
cards share a title; every minted epic has children (decompose ran). `detectCollisions` (id REUSE) is
unchanged and orthogonal.

## 4. Seam B — E-044 concrete-demand ranker (confirm #1 is concrete)

E-044 added a **CONCRETE DEMAND ONLY** bullet to both rankers:
- `baml_src/steer.baml:79–85`
- `baml_src/survey.baml:76–82`

Text: *"a board signal must be concrete product demand … a self-referential / operational meta-task is
NOT a demand signal — running Vend on itself, 'run the sweep' … is operating the machine, not product
demand. DEMOTE such meta-tasks beneath ALL concrete demand."*

This is a **prompt-only** change (E-020 shape: a semantic defect fixed in the prompt, not a structural
gate). There is no code-level guarantee — confirmation is empirical: the fresh board's #1 must be
concrete product demand, not "run the sweep."

## 5. Current board state (the pre-E-044 board)

`docs/active/pm/staged/steer.md` mtime **17:07** (E-044 shipped ~17:20). Its **#1 signal is**:

> *"Re-run the bounded metered sweep again after E-039 settles to accrue CLEARED forward-E1 records
> toward the ≥10 bar."*

That is **precisely the self-referential 'run the sweep' meta-task E-044 demotes**. Two consequences:

1. **The board is stale** — 17:07 < the 19:28 ticket files (`T-045-01.md`, `T-045-02.md`,
   `S-045-01.md`). `castWork` would return `stale-board` and refuse it. A fresh `steer` cast is
   genuinely required (the ticket's claim holds).
2. **The fresh re-stage is the actual E-044 test.** If the new #1 is concrete demand (e.g. `vend
   init`, the hackathon `examples/` template, the multi-node DAG — all already ranked #2–#5 on the
   stale board), E-044 took. If #1 is *still* "re-run the sweep," E-044 didn't take → a **finding**.

## 6. Deep irony / risk to flag

**This ticket (T-045-01 "the-live-cadence-sweep") is itself the self-referential meta-task.** The
demand signal that birthed it is the stale board's #1 "re-run the sweep." E-044's entire purpose is to
demote exactly this from future boards. So the sweep is, in part, testing whether the machine would
still recommend the very task that scheduled it. This is worth stating plainly in Design — it bears on
whether "run another sweep" is the right next pull at all, vs. the concrete Frontier-7 demand.

## 7. Forward-E1 ledger (the count to move)

`.vend/runs.jsonl` (33 records). Forward records carry `intervened:false`. Current counts:
- `intervened:false`: **20**; of those `outcome:success`: **13**.

The ticket's framing ("forward-E1 now 8/10") refers to the E-039 baseline verdict (`work/T-039-02/
verdict.md`); the exact denominator is the auditor's (`auditWalkAway`, `src/ledger/walk-away.ts:160`,
which splits forward vs. attested via `intervenedAttested`). The sweep appends NEW `intervened:false`
records — each successful chain clear is forward-E1 evidence. Goal: move the forward count up (8 → ≥10).

## 8. Constraints & assumptions

- `vend work`/`steer` value-import the BAML native addon → not unit-tested; proven only LIVE.
- Cost/duration are real and unbounded-by-tests; only the `--budget` wallet bounds them (P7).
- mtime freshness is a heuristic (git checkout resets it) — hence `--stale-ok` exists; not used here.
- `survey-board.md` does not exist in `staged/`; steer is the board that gets cast/read.
- Whether nested `claude -p` casts succeed in *this* session's environment is unverified (preflight
  would catch a broken env, but a fresh full sweep has never run from this exact invocation).
