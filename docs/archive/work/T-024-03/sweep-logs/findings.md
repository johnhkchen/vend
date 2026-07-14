# Live sweep — `vend work` bounded spend (2026-06-19)

`bun run src/cli.ts work --budget 1200000,500000` against `steer.md` — the first real autonomous
multi-cast spend. Wallet sized to afford ~1 chain (predicted 455k) then stop. Full log: `vend-work.log`.

## Result — 3 of 4, the miss precisely diagnosed

| # | Check | Result |
|---|---|---|
| 1 | Production line streamed (IA-7/8), not the raw executor stream | ✅ — `▶ casting <signal>` + `◇ tokens / ⏱ time` meter, node progress |
| 2 | ≥1 cast cleared (epic + tickets materialized) | ❌ **cleared 0** — the budget-threading gap below |
| 3 | Hard-stop held (P7) | ✅✅ andon fired, **nothing partial materialized** (board verified clean, no E-025, no untracked files), wallet debited the **actual** 175k truthfully (324.9k left), session settled, **exit 0**, amber |
| 4 | Settle receipt truthful (IA-6/9) | ✅ — "Cast 1, cleared 0", andon amber, both denominations, honest stop reason |

**The safety story is the strongest possible:** the *first* autonomous spend hit a real failure, and
the hard-stops contained it flawlessly — no half-output, a truthful receipt, a clean
successful-refusal exit. P7 proved itself under genuine adverse conditions, not a happy path.

## The bug — authorization and execution use different budgets

`vend work` pulled the #1 signal (the E1 measurement sprint), the wallet predicted the chain at
**455k** (propose 227k + decompose 227k, recalibrated) and reserved it. But:

```
src/play/work.ts:130
castOne: (signal) => castProposeDecomposeChain({ signal, projectRoot: root, ...model })
                                            // ^ NO budget passed
```

`castProposeDecomposeChain` therefore casts each step under the **play's own static default**
(propose-epic 150k), **not** the price the wallet reserved (227k). This signal's propose step needed
**175k** — more than the 150k default, less than the 227k the wallet authorized — so it
`budget-exhausted` andon'd and the chain halted before staging anything.

**The wallet knew propose needed 227k, authorized on that, then cast it under 150k.** The measured
price that gates `canAfford` is disconnected from the budget the cast actually runs under — so the
macro-wallet's whole premise ("fit each cast into the wallet at its *measured* price") is only
half-wired: it fits, but it doesn't *spend at* the fitted price.

## The fix (a downstream pull — kaizen)

Thread the wallet-reserved price into the cast: `castProposeDecomposeChain` accepts a budget (per
step, or a total it splits propose/decompose), and `castWork` passes the **same recalibrated
prediction** it authorized on (propose 227k / decompose 227k). Then authorization and execution agree
— the cast runs under exactly what the wallet reserved, and a pull that the wallet says it can afford
actually clears. Small, well-scoped; it's the one wire between T-024-02's pricing and the cast.

(Note: bumping propose-epic's static 150k default is *not* the fix — the point is `vend work` already
has the better, measured number and must use it; the static default is the cold-start fallback.)
