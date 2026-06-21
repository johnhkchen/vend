# T-058-05 — Progress: the live drive, as run

The drive was run end-to-end against a throwaway sandbox copy of the seed. Honest-on-outcome: the
real outcomes are recorded, including three places the shipped flow falls short. The committed
template was not mutated (only `EXPECTED-OUTCOME.md` was written back).

**Sandbox:** `/var/folders/8w/…/T/vend-seed-drive-dnex` (host: darwin; executor: `claude`, model
`claude-opus-4-8`). **Total real spend: $0.91** (4 metered casts; free steps $0).

## Steps executed (vs the plan)

| Step | Result |
| --- | --- |
| 1 — sandbox copy | ✅ seed copied; `node_modules/.astro/.vend` excluded; `SEED.md` = team-finder. |
| 2 — `lisa init` | ✅ ran **non-interactively** (exit 0); minted `CLAUDE.md` + `.lisa.toml` + the `docs/` tree. |
| 3 — `vend init --template hackathon` | ✅ exit 0; **11 created / 7 skipped**; `SEED.md` **skipped** (no-clobber held — the rich seed survived); `demand.md` has **0 demand rows** (honest-empty held). |
| 4 — `vend doctor` | ✅ **green, 4/4** (lisa, claude, BAML addon, executor:claude). |
| 5 — `vend svg` (empty) | ✅ wrote a valid honest-empty `.vend/work-graph.svg` (0 cards). AC3 pre-drive confirmed. |
| 6 — `vend steer` (shipped) | ⚠️ **success but honest-empty steer** — no board, no forks. All 3 gates passed. $0.177, 1 turn. **A3 risk materialized.** |
| 6′ — `vend steer` (diagnostic) | ✅ intent wired into `docs/knowledge/charter.md` → **coherent 4-signal board + 2 genuine forks**. $0.339, 1 turn. Machinery sound. |
| 7 — `vend svg` (populated) | ⚠️ renders correctly but **0 cards** — no decomposed slices to draw (see Step 8′). |
| 8 — `vend work` (tight budget) | ⚠️ **cleared 0 — "wallet funded nothing"**: 20 min time budget < the 120 min chain price (denomination-separate wallet, IA-8). |
| 8′ — `vend work` (corrected budget) | ⚠️ chain cast: **propose-epic cleared → minted E-001**; **decompose-epic andon: `missing-capability: codebase-memory-mcp`**. Cleared 0 full slices; **forward-E1 records accrued** (`intervened:false`). |
| 9 — capture | ✅ `EXPECTED-OUTCOME.md` filled from the real run + verdict + re-run block. |
| 10 — vend gate | ✅ unchanged (see Review). |

## The run-log records (`.vend/runs.jsonl`, 4 records)

1. `steer` — success, honest-empty, $0.1771, gates ✓✓✓.
2. `steer` (diagnostic) — success, coherent board, $0.3393, gates ✓✓✓.
3. `propose-epic` — **success**, minted E-001, $0.3928, 3 turns, gates value/bounds/structural ✓,
   **`intervened: false`** (forward-E1).
4. `decompose-epic` — **missing-capability**, $0, **`intervened: false`** (forward-E1), halted on the
   absent MCP.

## Deviations from the plan (documented)

- **Added a diagnostic re-steer (Step 6′).** The plan anticipated a possible weak board; when the
  shipped steer abstained, a single labeled diagnostic (place the seed intent where steer reads it)
  was run to isolate "empty because of input wiring" from "engine broken." It proved the latter is
  fine — a high-value addition to the gold master, not scope creep. ~$0.34.
- **Corrected the `work` budget (Step 8 → 8′).** The first `work` funded 20 min of time; the
  cold-start chain prices at 120 min, so the wallet (denomination-separate) funded nothing — a real
  finding, kept in the record. The corrected run funded 122 min so a pull could be authorized.
- **`--stale-ok` on the corrected `work`.** The diagnostic re-steer touched `docs/knowledge/`, making
  the staged board's freshness ambiguous vs the live state; `--stale-ok` (IA-5) bypassed the gate so
  the cast could proceed. Honest to note: a real user would re-steer, not override.

## Findings (carried into the verdict + EXPECTED-OUTCOME)

1. **A3 / input wiring:** `vend init --template hackathon` writes the seed intent nowhere `steer`
   reads it (`assembleSteerInputs` reads `docs/knowledge/charter.md` + the board snapshot, never
   `SEED.md`). Shipped flow ⇒ honest-empty steer. **The make-or-break finding.**
2. **Budget shape:** the cold-start chain price is ~120 min on the time axis; a tight time budget
   funds nothing (IA-8 denomination-separate wallet).
3. **MCP capability:** the clearing chain requires `codebase-memory-mcp`, absent in a fresh
   seed/lisa-init project ⇒ propose clears, decompose refuses.

All three are **seed/seam** issues, not engine bugs — recorded for follow-up tickets; **no `src/`
change is made by this ticket** (it measures the shipped artifact, it does not change it).

## Not done (honestly)

- A **full** slice (epic→stories→tickets) did not clear end-to-end on any path — blocked by finding
  #3. ≥1 *cast* cleared (propose-epic/E-001) with a forward-E1 record, but the AC's "clears ≥1 slice"
  is only partially met; recorded as such, not papered over.
- The shipped-flow board is empty by design of the current wiring; the coherent board exists only
  under the diagnostic condition. This is the verdict, captured verbatim in the gold master.
