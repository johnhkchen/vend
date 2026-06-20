# T-037-02 — Design

## The decision

T-037-02 is **not a code change** — it is an *operation*: the watched, metered macro-wallet spend
the project has deferred since T-024-03. The deliverable is `sweep-log.md` carrying the **verbatim**
output of a real `vend work --no-intervened --budget <bounded>` run: the production-line steps, the
receipt, the cleared pull(s), and the forward-E1 records appended to `.vend/runs.jsonl`. The design
question is therefore not *what to build* but **how to run it correctly, safely, and honestly** — how
to stage, bound, cast, capture, and verify so the result is trustworthy whatever it turns out to be.

T-037-01 already settled the hard analytical question (GO: auth==exec holds, ~2 chains affordable at
the live price). This design inherits that GO and focuses on the run's *mechanics and discipline*.

## The authorization boundary (the one genuine decision)

This run **spends real tokens** (~1M budget across ~2 real `claude -p` chains, plus the staging cast)
and **mints real epics+tickets** onto `docs/active/**` — board state other PM/agents subsequently act
on. The ticket frames this precisely: *"The human running `lisa loop` authorizes the spend; the
budget bounds it."* The spend authorization is a deliberate human gesture at the counter (P2), not an
assumption an upstream step inherits. So the design's first move at Implement is to **surface the
go/no-go to the operator** (recommended budget, expected cost, what gets minted) and proceed only on
an explicit go. This is the honest reading of "the human funds the budget and walks away" — and it
honors the operating rule that a costly, hard-to-reverse, outward-facing action is confirmed, not
silently performed. The planning artifacts (R/D/S/P) are produced unconditionally (free); the live
cast is gated on the counter gesture.

## Options considered — the run method

### Option A — Cast directly, capture stdout, write the log (no human gate)
Run `vend steer` then `vend work …` straight through, pipe to `sweep-log.md`.
- **Pro:** matches "without stopping"; fully autonomous; one continuous transcript.
- **Con:** burns ~1M+ real tokens and mutates the live board with **no operator confirmation** of the
  spend — exactly the deliberate-authorization gesture the ticket vests in the human at the counter.
  "Approval to write the artifacts" ≠ "approval to spend a real metered budget and mint real epics."
- **Rejected as the default** — the spend is real and irreversible; it needs an explicit go.

### Option B — Confirm at the Implement boundary, then cast and capture (CHOSEN)
Produce R/D/S/P (free). At Implement, present the bounded run for an explicit go: on **go**, stage a
fresh board, run the metered sweep with full output capture, write `sweep-log.md`, run
`lisa validate`, then Review. On **no-go/defer**, record the honest "prepared, not cast — awaiting the
counter gesture" outcome in `progress.md`/`review.md` with the exact one-command run staged.
- **Pro:** honors P2/P7 (the human authorizes the spend); never fabricates output; the artifact is
  trustworthy either way; the run is fully prepared so the go is a single gesture.
- **Con:** a pause at the Implement boundary (a deliberate deviation from "don't stop between
  phases"). Justified: the rhythm rule is about doc cadence; this is a real-money/real-board gate.
- **Chosen.** It is the only method that produces a *truthful* deliverable for a live-spend ticket.

### Option C — Simulate / dry-run, write a synthetic log
Stub the executor, produce a plausible transcript.
- **Pro:** zero spend.
- **Con:** the AC demands *verbatim* real output and real minted ids with `lisa validate` green — a
  synthetic log is a fabrication, the exact dishonesty the epic ("live-proof") exists to refute.
- **Rejected.** Fabrication is disqualifying.

## Why B is sound (grounded in Research)

The run is fully de-risked by T-037-01: auth==exec (E-025) means the chain runs under the same p90
envelopes it was priced at, so it clears rather than no-ops; the bounded 1h/1M budget affords ~2
chains; a fresh stage clears the freshness gate; `--no-intervened` threads forward-E1 end-to-end. The
only thing T-037-01 could not do is *spend* — which is B's whole content. Nothing in B requires new
code: `castWork`, `spendDown`, `renderReceipt`, `castSteer` all exist and are wired through the CLI.

## The run shape (the design's operational contract)

1. **Stage fresh.** `bun run src/cli.ts steer` → `docs/active/pm/staged/steer.md`, newer than all
   `docs/active/**` ⇒ clears the E-027 gate. Confirm it carries **≥2** ranked `vend chain "…"` lines
   (the precondition for a 2-chain spend-down; ≥1 still clears the floor).
2. **Fund bounded + walk away.** `bun run src/cli.ts work --no-intervened --budget 3600000,1000000`
   (1h / 1M tokens — a real but contained spend, ≈2 chains, NOT the 2M default). `--no-intervened`
   is the walk-away self-report (forward E1). Capture **all** stdout/stderr verbatim.
3. **Let it reach a clean P7 stop** — `board-cleared` or `wallet-exhausted` (or an honest `andon`).
   Nothing partial; the receipt is the truth.
4. **Capture** to `sweep-log.md`: the `onStep` production line, the `renderReceipt` receipt (funded
   vs spent per denomination + stop reason), the cleared epic id(s)+tickets, and the `2N` forward
   `intervened:false` records appended to `.vend/runs.jsonl`.
5. **Verify** `lisa validate` green on the minted ids; auth==exec held (cast ran under the authorized
   price). Record honestly — including a clean 0-clear with its reason, if that is what happened.

## Honest-outcome matrix (every result is recordable, none hidden)

| Outcome | Meaning | Recorded as |
|---------|---------|-------------|
| ≥1 chain cleared, clean stop | The proof — watched metered spend-down | ✅ AC met; ids + receipt + ledger delta |
| `wallet-exhausted` after ≥1 clear | Bounded budget spent down as designed | ✅ the headline gesture |
| `board-cleared` | Fewer signals than the budget afforded | ✅ honest; note board size |
| per-cast `andon` (budget-exhausted at p90) | Honest P7 stop, NOT the E-024 no-op | ⚠ recorded truthfully with the envelope |
| 0 cleared (price>funded / gate andon) | Honest no-op | ⚠ recorded with the reason (T-037-01 GO should preclude price-mismatch) |
| operator declines the spend | Authorization withheld at the counter | ⏸ prepared-not-cast; one-command run staged |

## Non-goals (deferred)

Meeting the ≥10-genuine-forward bar (T-037-03 — one session only moves the count). The trust verdict
(T-037-03). Any `src/` change (the seams exist and are tested). Re-deciding the GO (T-037-01 owns it).

## Verification criteria

`sweep-log.md` carries verbatim output (steps + receipt + cleared ids + ledger delta); ≥1 real pull
cleared end-to-end with `lisa validate` green (or an honest 0-clear with its reason); forward-E1
records appended carrying `intervened:false`; the spend was operator-authorized at the counter.
