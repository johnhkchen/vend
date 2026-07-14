# T-052-02 — Design

_Three decisions, each grounded in Research: (1) cast target, (2) envelope size, (3) runner shape.
Plus the honest-degrade fallback. No `src/` change — the substrate is complete; this ticket casts it._

## Decision 1 — Cast target: a sandbox copy of the vend board under `.vend/`

**Options**

| | A. cast `cwd` (the vend repo) | B. thin sandbox `.vend/live-proof/A1` | C. **fresh sandbox = copy of vend's `docs/` board under `.vend/`** |
|---|---|---|---|
| signal yield | rich, reliable ≥2 | uncertain (8 tickets, never proven to yield 2 signals) | rich, reliable ≥2 (same board as A) |
| blast radius | **mints into git-TRACKED** `docs/active/epic` + `docs/active/notes` mid-loop | git-clean (`.vend` ignored) | git-clean (`.vend` ignored) |
| reversibility | a `git` cleanup mid-RDSPI; risks confusing Lisa's board | `rm -rf` the sandbox | `rm -rf` the sandbox |

**Chosen: C.** Copy the vend repo's `docs/` board (+ `CLAUDE.md`) into a fresh, gitignored sandbox
`.vend/live-proof/E052-<run>/` and cast with `projectRoot` pointed at it. Research §"evidence trail"
confirmed every play resolves `root = opts.projectRoot ?? cwd` and reads/writes under
`<root>/docs/active/...`, so a non-cwd root **redirects ALL mutation** (board, 2 epics, note) into the
sandbox. This gets A's signal richness (the real, ranked board → the survey reliably stages ≥2
`vend chain` signals) **with** B's clean blast radius (everything lands under gitignored `.vend/`).

**Why not A:** Research §constraint 3 — minting tracked epic/note files into the live board *during* an
active Lisa loop pollutes the working tree and can collide with board state Lisa is reasoning about.
E-047 did cast `cwd` and minted `E-048` (kept as real demand), but E-047 was a deliberate
"mint-real-demand" run; T-052-02 is a **proof** run — its mints are evidence, not demand to keep, so
they belong in a sandbox. **Why not B:** Research §constraint 5 — a thin sandbox's signal yield is
unproven; < 2 signals degrades both proposes and skips the join, failing the AC for a reason unrelated
to the wallet (a false negative). C removes that variable by reusing the proven-rich board.

## Decision 2 — Envelope: a widened `macroBudget` override, not the tight `realPlayMacro`

**The risk (Research §constraint 4):** `realPlayMacro` = 608k tokens / 4.2M ms, the *honest p90*
drawn to exactly `{0,0}` on stubs. Live, **E-047 saw one propose burn ~180k tokens**. A live wave of
survey + 2 proposes can plausibly consume ≳600k actuals, leaving `< 8k` for the note → `authorizeWave`
budget-STOPS `capture-note` → the JOIN skips. That would be the cross-branch leak *re-appearing as a
note starvation*, and it would fail AC#1 ("capture-note materialized, not skipped").

**What the AC actually asks:** prove the join RUNS under **ONE shared wallet** (one envelope bounds
total spend, not a per-branch leak). It does **not** ask to prove the *tight p90* envelope is exactly
right — that is a separate calibration question. So widening the envelope is legitimate and on-point.

**Chosen:** pass an explicit `macroBudget` with generous headroom over the measured floor — **2×
`realPlayMacro`**: `{ tokens: 1_216_000, timeMs: 8_400_000 }`. Rationale:
- It guarantees every wave authorizes (survey + 2-propose wave + note all fit), so the **join runs** —
  the AC headline — regardless of cache-heavy actuals.
- It is still **ONE shared envelope** threaded as `castGraph`'s third arg — the AC's "single shared
  wallet, not per-branch" is about *topology* (one wallet across the wave), which holds at any size.
  `walletRemaining = funded − total-spend` still reads the **collective** draw off the one envelope.
- It stays honest: the verdict reports both the **funded** size (widened, with the reason) and the
  **actual** spend (`funded − walletRemaining`), so the reader sees the true burn, not a padded one.
- The override is exactly the lever T-052-01's review.md flagged for this case ("the `macroBudget`
  override exists precisely to widen it without code change").

**Rejected:** the tight `realPlayMacro` default. It is the right *default* (honest prediction) but the
wrong choice for a run whose goal is to *demonstrate the join completing* — a budget-stop here proves
nothing about the wallet topology, only that the p90 was tight. If the widened run completes well under
608k actuals, the verdict notes the tight envelope would have sufficed (a bonus finding); if it runs
hot, the headroom is what let the join close.

## Decision 3 — Runner: a dedicated evidence-dumping script under `work/T-052-02/`

**Options:** reuse `import.meta.main` (casts `cwd`, prints human lines) vs a dedicated runner.

**Chosen:** a small runner `docs/active/work/T-052-02/cast-live.ts` that:
1. resolves the sandbox root (Decision 1), copying the board if absent;
2. calls `castRealPlayGraph({ projectRoot: sandbox, macroBudget: <2× macro> })`;
3. serializes the full `GraphResult` to `cast-result.json` (nodes→{outcome, produced, actuals},
   skipped, halted, haltReason, produced sinks, **walletRemaining**) and echoes `formatWallet`;
4. exits non-zero on halt/fail (the `import.meta.main` contract) so a degrade is loud.

**Why not reuse `import.meta.main`:** it pins `cwd` (Decision 1 rejects that) and prints prose, not
the machine-readable `GraphResult` the settlement quotes. The runner is an *artifact of this ticket*
(lives under `work/T-052-02/`, not `src/`), so it adds no product surface and is not subject to the
"no `bun test` imports the impure shell" rule (it is never imported by a test; it is run directly).

## The honest-degrade fallback (the house contract — Research §constraint 6)

The live cast can still degrade despite C + widened envelope (a propose value-gate STOP on a thin
signal, a model error, an andon). The settlement is written **from whatever the cast actually
produced**, mirroring T-047-02's honest record:
- **Join ran (target):** `cast-result.json` shows `capture-note` in `nodes`, `skipped` empty, both
  proposes produced epic paths, `walletRemaining` present. Verdict: AC met, join PROVEN LIVE.
- **Join skipped (degrade):** record the cause verbatim (which propose/why, or note budget-stop),
  mark AC#1 honestly **not** met live, and surface the gap — never claim the join ran. A second cast
  attempt is acceptable (idempotent: fresh sandbox each run) but not required by this artifact.

This is non-negotiable: the deliverable is an **honest** verdict + cast log, not a green checkbox.

## Cast-evidence → AC mapping (what the settlement must show)

| AC clause | evidence (from `cast-result.json` + `.vend/runs.jsonl`) |
|---|---|
| capture-note materialized (not skipped) | `nodes` has `capture-note`; `skipped` lacks it; `halted=false` |
| 2-entry NodeUpstreams from BOTH proposes' produced epic paths | both `propose-1`/`propose-2` in `produced` with epic paths; `capture-note` subject `consolidate <id1> + <id2>` (two ids) |
| two propose casts overlapped in time | `runs.jsonl` two propose rows with overlapping `startedAt`/`endedAt` (shared `runId`) |
| total spend bounded by ONE shared wallet (not per-branch leak) | `walletRemaining` present; `funded − remaining` = collective draw off one envelope |
| verdict labels it a live metered cast (≈4 real `claude -p`), distinct from a free proof | the prose verdict + the run-log cost rows |

## Artifacts this ticket writes (all under `docs/active/work/T-052-02/`)

`research.md` · `design.md` · `structure.md` · `plan.md` · `cast-live.ts` (runner) ·
`cast-result.json` (machine evidence) · `cast-stdout.log` (raw run output) · `graph-cast-log.md` (the
settlement / honest verdict) · `progress.md` · `review.md`. **No `src/` change.**
