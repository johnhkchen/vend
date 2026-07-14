# Live re-sweep — E-025 verified, `vend work` clears (2026-06-19)

Re-ran the **exact** sweep that cleared 0 under E-024 (`--budget 1200000,500000` vs `steer.md`); the
only change is E-025's per-step budget wire. Clean A/B. Full log: `vend-work-resweep.log`.

## The A/B — the fix works

| | E-024 (before) | E-025 (after) |
|---|---|---|
| #1 pull's propose cast under | 150k static default | **227k wallet reservation** |
| propose outcome | budget-exhausted andon (needed 175k) | **success → `✓ minted E-026`** |
| decompose | (never reached) | **success → `✓ lisa validate ✓`** |
| **cleared** | **0** | **1** |
| stop reason | andon (budget-exhausted) | **wallet-exhausted** (8 candidates left, 222.9k < 455k price) |
| spent / exit | 175k / 0 | 277.1k / 0 |

All four verification points now pass: production line streamed (IA-7/8); **≥1 cleared** (the AC
E-024 deferred); hard-stop held (P7 — stopped after exactly one chain, did *not* spend the other 8);
Settle receipt truthful ("Cast 1, cleared 1", honest stop reason). Authorization == execution: the
pull the wallet authorized at 227k actually cast at 227k and cleared.

## Two findings from the cleared output

1. **The autonomous spend produced quality work.** `E-026` (e1-walkaway-measurement-sprint) is a
   coherent, structurally-valid (DAG valid), well-grounded epic + 2 stories + 4 tickets — it even read
   E-024/E-025's *current* state ("830/0 gate", "casts at wallet-reserved price") accurately, framed
   itself measure-not-build, warned against synthetic samples, named prerequisites, right-sized. Real
   proof that `vend work` can clear a pull into shippable-quality board work.

2. **But it spent against a STALE board (kaizen).** `steer.md` is ~10h old (11:54), predating this
   session's measurement sprint + the E-024/E-025 builds. So the #1 signal it cleared — "run the E1
   measurement sprint" — reads as if E-014 is still **HOLD**, when we flipped it to **go** hours ago.
   E-026's *substance* is right (≥10 real forward `vend run` sessions = the variance-bearing E1 the
   back-fill couldn't be — the stronger collection I flagged), but its *premise* ("open the gate") is
   stale. **`vend work` should freshness-check / re-survey the board before spending** — spending a
   wallet down a 10h-old board risks clearing already-done or superseded work. Logged as a signal.

(Side note: the cleared cast appended 2 real records to the ledger — genuine autonomous walk-aways,
the first forward E1 data.)
