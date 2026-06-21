# T-052-02 — Progress (Implement)

_The work: cast the diamond LIVE through the wallet-threaded `castRealPlayGraph` and settle an honest
verdict. No `src/` change — the substrate shipped in T-052-01 (`a78ca6f`); this ticket exercises it
live and records the evidence._

## Steps executed (against plan.md)

| step | status | notes |
|---|---|---|
| 1 — baseline gate | ✅ | `tsc --noEmit` clean; `bun test` 1191 pass / 0 fail; `git status` clean for `src/`. Pre-cast `runs.jsonl` = 46 lines. |
| 2 — write runner `cast-live.ts` | ✅ | sandbox prep (copy `docs/` + `CLAUDE.md` into gitignored `.vend/live-proof/E052-<stamp>/`), `castRealPlayGraph({projectRoot, per-node budgets, macroBudget})`, dump `cast-result.json`, echo + exit-by-outcome. `bun build` resolves (47 modules incl. BAML addon). |
| 3 — pre-cast snapshot | ✅ | recorded `runs.jsonl` line counts before each run to slice that run's rows. |
| 4 — cast LIVE | ✅ (×4) | four metered runs E052-01…04; see below. |
| 5 — settle `graph-cast-log.md` | ✅ | 7-section honest verdict; join PROVEN LIVE on run 04; the 4-run budget journey recorded. |
| 6 — final gate + artifacts | ✅ | `check:precommit` → `ok — tests green`; progress + review written. |
| 7 — commit | ⏳ | work artifacts staged (sandbox excluded — gitignored); ticket frontmatter left to Lisa. |

## The four live runs (the honest journey)

| run | provisioned per-cast (survey/propose/note tok) | funded macro | spent | result |
|---|---|---|---|---|
| 01 | 300k / 150k / 8k (defaults), macro 2× tight | 1.216M | 594,635 | propose-2 budget-exhausted (323k/150k) → join **skipped**. **Shared wallet proven (no leak).** |
| 02 | 400k / 600k / 120k | 1.720M | 432,544 | both proposes ✓ (E-053+E-054); **capture-note CAST + received both** (`skipped:[]`); note budget-exhausted (161k/120k) → not materialized. **JOIN RAN.** |
| 03 | 400k / 600k / 400k | 2.000M | 975,544 | propose-2 budget-exhausted (697k/600k; `cache_read` 635k) → join skipped. (variance) |
| **04** | **600k / 1.5M / 600k** | **4.200M** | **473,338** | **all four ✓, note materialized → join end-to-end.** |

Total: **2,476,061 tokens**, ~14 real `claude -p` casts. All four sandboxes under gitignored
`.vend/live-proof/`; the tracked board was never touched.

## Deviation from plan (documented, per RDSPI)

- **Plan said "optionally re-cast once if the cause is transient."** The cause was **not** transient —
  it was a structural under-provisioning of the **per-cast** budget (a layer distinct from the macro
  wallet the plan/design focused on). Design D2 widened only `macroBudget`; run 01 proved that is the
  wrong lever for a per-cast andon. I therefore re-cast three more times, each time widening the
  per-cast budget the *previous* run identified as the limiter (propose → note → absorb-variance),
  reaching a clean run on 04. This is more than "once," and the rationale is recorded here and in the
  cast log's "budget story" — the deviation produced a genuine finding (the two-budget-layer
  distinction), not just a retry.
- **No `cwd` cast.** Design D1 chose a sandbox; honored — all mutation contained to `.vend/`.

## AC mapping (evidence)

| AC clause | met by | evidence |
|---|---|---|
| capture-note materialized (not skipped) | run 04 | `cast-result-04.json`: `capture-note` outcome `success`, `materialized:true`, `skipped:[]`, `halted:false` |
| 2-entry NodeUpstreams from both proposes' epic paths | run 04 | both proposes produced E-053/E-054; note titled "E-053 … + E-054 …" (consolidates both) |
| two propose casts overlapped | run 04 | `runs.jsonl`: both `startedAt 17:00:16.974`, shared `runId`, 63.8 s overlap |
| spend bounded by ONE shared wallet (no per-branch leak) | all runs | `walletRemaining` present; run 04 spent 473,338 = funded − remaining off one envelope |
| verdict labels live metered cast (≈4 real claude -p) vs free proof | cast log Read 4 | 4 casts/clean run; 2.48M tokens / 4 runs |

## Files produced (all under `docs/active/work/T-052-02/`)

`research.md` · `design.md` · `structure.md` · `plan.md` · `cast-live.ts` (runner) ·
`cast-result-0{1..4}.json` + `cast-result.json` (= run 04) · `cast-stdout-0{1..4}.log` +
`cast-stdout.log` · `graph-cast-log.md` (settlement) · `progress.md` · `review.md`. **No `src/`
change.** The `.vend/live-proof/E052-0{1..4}/` sandboxes are gitignored (not committed; their evidence
lives in the committed JSON + cast log).

## Gate

- `bun run check:precommit` → `precommit: ok — tests green`.
- `git status` outside `work/T-052-02/`: only the two ticket files (Lisa-owned `phase`); no `src/`,
  no tracked-board mutation.
