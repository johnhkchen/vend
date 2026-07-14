# T-045-02 — Review: settle the cadence and the ≥10-bar verdict

Handoff for a human reviewer. This was a **settle/read** ticket (E-014/E-026 shape): judge the
T-045-01 metered sweep against the pre-wired ≥10 forward-E1 bar, neither over- nor under-claiming,
and crystallize the verdict to the board. **No source code changed.**

## The verdict (the load-bearing call)

**The ≥10 forward-E1 sample bar is MET — at exactly 10.** Forward (live) self-reports went **8 → 10**
on the E-045 sweep. The pre-wired E-014/E-026 rule (≥10 forward self-reports) is **met; say so
plainly** — no under-claim: the bar the project set, once reached, is reached.

**With the composition caveat (no over-claim):** forward-10 = **5 cleared / 5 censored / 1 genuine
`--intervened`**. 9 of 10 forward runs ran *untouched*; only **one** was a genuine intervention. So
the evidence is **"didn't-break," not "stress-tested."** The go upgrades **provisional → bar-met** —
**not** "bulletproof" / "forward-confirmed-robust" (the E-026/T-026-04 over-claim trap). The thin
signal is **genuine-intervention depth (1)**; that, not more walk-aways, is what the cadence targets
next.

All numbers are **forward-only**. The 23-report combined pool (96% walk-away) is cited in the
artifacts solely to mark it as *not* the verdict basis (the T-026-04 trap).

## What changed

| File | Change |
|---|---|
| `docs/active/demand.md` | Frontier 1 `In flight` row → **settled** (≥10 bar met + composition + E-043/E-044 live + E-046 partial-chain caveat). Frontier 1 `Accrue forward-E1` bullet → bar-met verdict, didn't-break caveat, next cadence target = intervention depth. Frontier 3 `Multi-node DAG` signal → notes **E-046** minted-but-un-decomposed. |
| `docs/active/work/T-045-02/{research-less}` | `structure.md`, `plan.md`, `progress.md`, `review.md` created. (Ticket entered at `phase: structure`; the Research/Design substance is folded into structure.md as the empirical reads.) |

No `src/**`, no tests, no config changed.

## How the numbers were obtained (and a methodology note for the reviewer)

- `bun run src/cli.ts audit` → forward (live) **10**, 9/10 untouched, andon 36% vs 10% (over budget,
  but "gates working, not defects" — IA-10/12, expected; the censored sweep tail raises it).
- **Forward outcome composition via the real revive path** (`readRuns` → `reviveRecord`,
  `src/log/run-log.ts:351`), **not** raw `grep` over `.vend/runs.jsonl`. This matters: the
  attestation marker is a raw `intervenedAttestation` object that `reviveRecord` maps to
  `intervenedAttested`; a raw grep on `intervenedAttested` miscounts forward as **23** (it sees the
  marker on none of them) instead of the true **10**. Anyone re-deriving these numbers must revive,
  not grep.

## E-043 / E-044 — live confirmations (the deferred closures)

- **E-044 (steer ranker demotes self-referential targets) — LIVE.** Fresh board #1 = "Build the
  typed multi-node DAG" (concrete); the "run the sweep" meta-task was absent from the *entire* fresh
  board; no manual re-point. Strongest possible confirmation: the concrete #1 was *cleared into a
  real epic* (E-046).
- **E-043 (idempotent mint — no orphan) — LIVE.** The sweep minted exactly one card (epic files
  45→46); no two epics share a `title:` (`uniq -d` empty). The adopt-before-mint guard held.

## Open concerns / TODO (flag for the human)

1. **E-046 is a partial chain.** Its `propose-epic` cleared (success) but `decompose-epic` hit
   `budget-exhausted` (clean P7 stop) — so E-046 exists with **no stories/tickets yet**. This is
   *not* an E-043 orphan (it's a single clean card, not a duplicate) and *not* a DAG break
   (`lisa validate` green, 109 tickets). It is an **un-decomposed epic awaiting a resume pull** of
   `decompose-epic`. Recorded on the board (Frontier 3). **Action:** a future cadence pull should
   finish E-046's decompose.
2. **Stress evidence is thin (depth = 1).** The ≥10 *sample* bar is met, but only one forward record
   is a genuine intervention. The honest residual risk: walk-away trust rests largely on runs that
   *didn't need* intervention. The next cadence step should value a run that surfaces a real
   intervention over another clean walk-away.
3. **andon rate 36% > 10% budget.** Read, not red-flagged (IA-12: an at/over-budget andon rate from
   censored sweep runs is the gates working). No action; noted for completeness.

## Verification

- `bun run check` → **1087 pass / 0 fail** at baseline AND after the doc edit (doc-only change; no
  regression). `lisa validate` → green (109 tickets, 1 ready, DAG valid).
- auth==exec (E-025) held: funded `--budget 3600000,1000000` == executed envelope; the
  `budget-exhausted` receipt is the truthful clean P7 stop.

## Bottom line

The sweep did its job: it crossed the ≥10 forward sample bar **and** live-confirmed both deferred
hardening seams (E-043, E-044). The verdict is **bar-met, honestly caveated** — provisional→bar-met,
not bulletproof. Two things stay open and are recorded, not hidden: E-046 needs a decompose resume,
and genuine-intervention depth (1) is the next real target. The frontier remains a **cadence**.
