# T-026-03 — Structure: the shape of a read-only ticket

## This ticket creates NO source files

Stated plainly so the blueprint is honest: T-026-03 is an N2 measurement/reporting ticket. It
**creates, modifies, and deletes zero files under `src/`**. There is no module boundary to
define, no public interface to declare, no ordering of code changes. The "structure" is the
artifact set and the command-to-number mapping. Pretending otherwise would manufacture
architecture where the ticket asks for a reading.

## Files touched (all under `docs/active/work/T-026-03/`)

| File | Status | Role |
|---|---|---|
| `audit-output.txt` | created | The captured verbatim `vend audit` stdout + ledger provenance. The literal AC artifact ("`vend audit` output … captured"). |
| `research.md` | created | Maps the instrument, the two-denominator subtlety, the ledger state. |
| `design.md` | created | The six read/report decisions. |
| `structure.md` | created | This file. |
| `plan.md` | created | The ordered read→capture→verify→write steps. |
| `findings.md` | created (Implement) | The headline write-up: the one number, trend, andon-vs-budget, sample trace. The human-facing report. |
| `progress.md` | created (Implement) | What was run, what was captured. |
| `review.md` | created (Review) | Handoff: AC satisfaction + open concerns. |

**No `src/` changes. No `.vend/runs.jsonl` writes. No board (`docs/active/{epic,stories,
tickets}/`) changes** beyond Lisa's automatic phase advance on this ticket.

## The command → number mapping (the "interface" of this read)

The reproducible contract — each command and the number it yields (verbatim, 22:54 PDT):

```
bun run src/cli.ts audit                  → all plays / standard: walk-away 93% (14/15),
                                            trend 100%→88%, andon 40% vs 10% (⚠ over)
bun run src/cli.ts audit --tier keystone  → same slice, andon 40% vs 5% (⚠ over)
bun run src/cli.ts audit decompose-epic   → forward arm: walk-away 83% (5/6), andon 50% vs 10%
bun run src/cli.ts audit propose-epic     → other arm: walk-away 100% (4/4), andon 29% vs 10%
```

Provenance cross-check (not the reported number — the audit is — just the trace):

```
jq -s '[.[] | select(.intervened != null)] | length' .vend/runs.jsonl   → 15
wc -l < .vend/runs.jsonl                                                 → 25
```

## Ordering that matters

Only one ordering constraint: **capture the audit output (`audit-output.txt`) before writing
`findings.md`**, so the write-up quotes captured evidence rather than remembered numbers. The
RDSPI docs otherwise follow their phase order. Because the ticket writes nothing to the
ledger, the read is **idempotent** — re-running any command yields the same numbers as long as
no new cast lands, so there is no read/write race to sequence.

## Boundaries preserved

- **Instrument boundary:** the reported numbers come only from `formatWalkAwayFindings`
  (`src/ledger/walk-away.ts`). `jq` is used solely for provenance counting, never to compute a
  reported rate — so the canonical instrument stays the single source of the number.
- **Purity:** nothing here mutates state. `vend audit` exits 0 (read-only) by construction.
- **N2:** no instrument, no dashboard, no helper script enters `src/`.
