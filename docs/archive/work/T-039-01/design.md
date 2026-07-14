# T-039-01 — Design (how to run the live re-sweep)

The decision is **operational**, not architectural: there is no code to write. Design here means
choosing *how to execute and observe* the metered sweep so the result is a valid, honest clear-test
of the E-038 fix. The seams are fixed (Research); the choices are about sequencing, the board, the
budget, and the honesty bar.

## Decision 1 — Gate the whole run on the free deterministic pre-check (DONE)

**Chosen:** run the pre-check before spending a single token, and treat it as a hard go/no-go.
- `timeoutMsFor({timeMs:72785}) = 145570` ✓ (E-038 live — the kill-switch doubled the 72,785 ms wall).
- `steer.md` @ 16:02:44 < live 17:01:23 ✓ (stale — a fresh board is genuinely needed).

**Why:** the pre-check is free and is the cheapest possible falsification. If `timeoutMsFor` still
returned `T×1`, the re-sweep would be pointless (E-038 not live) — abort before spending. If the
staged board were *fresh*, the staleness premise would be wrong and `vend work` would happily spend a
stale board. Both passed, so the run is warranted. **Rejected:** skipping straight to the cast — it
would burn real tokens to discover a precondition a 50 ms `bun -e` reveals for free.

## Decision 2 — Stage a FRESH board, then inspect #1 before spending

**Chosen:** `bun run src/cli.ts steer` to mint a fresh `staged/steer.md`, then **read #1 by eye**
before any `vend work`. Branch on what #1 is:
- **#1 is concrete product demand** (decomposable — e.g. Frontier 7 `vend init`, a real feature) →
  proceed: this is a valid clear-test.
- **#1 is self-referential/meta** (the E-037 degenerate "run the sweep" case) → **record it as a
  finding** and point the sweep at the top *concrete* signal instead (re-rank / select a board whose
  #1 is real demand). A meta-target clearing proves nothing about clearing real work.

**Why:** the ticket's whole thesis is "clears *real* product work." E-037's headline failure had two
compounding causes — a tight timeout (E-038 fixes) **and** a degenerate #1 (a recursive target that
invites unbounded model thinking). Fixing only the timeout and re-pointing at the same meta-#1 would
risk re-censoring on a target that *should not* be the test. The board now carries real demand
(Frontier 7, the frontiers), so a fresh steer is likely to rank a concrete #1 — but it must be
*verified*, not assumed. **Rejected:** reusing the stale board with `--stale-ok` — it would defeat the
freshness gate (the very E-027 mechanism under test) and re-point at the known-degenerate #1.

## Decision 3 — Budget: replicate E-037 exactly (`3600000,1000000`)

**Chosen:** `--budget 3600000,1000000` (~1h / ~1M tokens), byte-identical to E-037.

**Why:** comparability. The only intended variable between E-037 (0-clear, censored) and this run is
the E-038 headroom. Holding the wallet constant makes any cleared-vs-censored delta attributable to
the fix, not to a bigger budget. The 1h wallet was never E-037's binding limit (it spent ~73 s and
0 tokens before the time-andon) — the *per-step* envelope was, and that is exactly what E-038
widened. **Rejected:** a larger wallet — it would confound the comparison and isn't the lever.
**Rejected:** a tiny smoke budget — it wouldn't reach a clear and wouldn't be comparable.

## Decision 4 — Walk-away (`--no-intervened`), let it run to a clean P7 stop

**Chosen:** `--no-intervened`, no mid-run steering, let `spendDown` reach one of its three clean
stops (`board-cleared` / `wallet-exhausted` / `andon`).

**Why:** `--no-intervened` threads `intervened:false` into every cast (`work.ts:200`), which is what
makes the records **forward-E1 evidence** (`auditWalkAway` reads the bit). The walk-away *is* the
test — the headline mechanic is "fund once, walk away." Stepping in would both invalidate the forward
classification and contaminate the trust signal. **Rejected:** `--intervened` (would mark the records
author-touched) and omitting the flag (would leave the bit unknown — never fabricate a walk-away).

## Decision 5 — Capture verbatim; honesty bar = E-037's standard

**Chosen:** capture the receipt **verbatim** into `sweep-log.md`, plus: whether propose **FINISHES**
(no `andon: timed-out` at ~72.8 s — E-038 working live), the cleared pull id(s) (run `lisa validate`,
confirm green, confirm auth==exec), and the **first cleared forward-E1 record** in `.vend/runs.jsonl`
(`intervened:false` + `success`). If it still 0-clears, record **exactly where it stopped** and name
the moved bottleneck (e.g. "propose finished in ~90 s ✓ but decompose censored" — still confirms
E-038 worked).

**Why:** the E-037 sweep-log set the bar — a clean 0-clear with a named cause is an honest result,
not a failure to hide. The outcome range is genuinely open (best: 4/10→5/10 cleared forward records,
cadence begins; worst: honest 0-clear naming the new bottleneck). **Critically: never fabricate
output.** If the live cast cannot run or produces no clear, the log says so plainly. Over-claiming a
clear that didn't happen would violate IA-8 (the meter must not lie) and the whole trust thesis.

## Decision 6 — Run the sweep observably, not blindly foreground-blocked

**Chosen:** run `vend work` capturing combined stdout/stderr to a raw file (`_sweep-raw.txt`) so the
verbatim receipt is preserved exactly (including ANSI), and surface the rendered receipt + ledger
delta into `sweep-log.md`. Because a full clear chain can run minutes, run it so output is captured
even if it spans a while; read the ledger tail and `lisa validate` after it returns.

**Why:** the receipt and the ledger are the two sources of truth; preserving them verbatim is what
makes the verdict auditable. **Rejected:** transcribing from memory — non-reproducible, and the exact
ms-left / token figures are the evidence that auth==exec held.

## Outcome contract (what "done" means)

A clean P7 stop with a **verbatim** sweep-log that honestly states either (a) ≥1 real pull cleared
(epic+tickets, `lisa validate` green, first cleared forward-E1 record) **or** (b) where it stopped
and the named bottleneck. Either is acceptable; **fabrication is not**. P7 holds throughout — real
actuals debited, clean stop, zero partial state.
