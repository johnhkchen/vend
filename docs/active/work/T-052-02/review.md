# T-052-02 — Review

_Handoff: cast the `survey → [propose ×2] → capture-note` diamond LIVE through the wallet-threaded
`castRealPlayGraph` (T-052-01) and settle an honest verdict. **The 2-upstream JOIN is now proven
LIVE** — the last stub-only property of the E-046/E-047/E-048 substrate is closed._

## What changed

**No `src/` change.** This is a settlement ticket: the code path shipped in T-052-01 (`a78ca6f`). The
work is a live metered cast + the artifacts that read its evidence.

| file | kind | role |
|------|------|------|
| `cast-live.ts` | runner (under `work/`, run directly, never imported) | casts `castRealPlayGraph` against a fresh gitignored sandbox with provisioned per-cast + macro budgets; dumps the `GraphResult` as JSON |
| `cast-result-0{1..4}.json`, `cast-result.json` | evidence | the dumped `GraphResult` per run (`cast-result.json` ≡ run 04) |
| `cast-stdout-0{1..4}.log`, `cast-stdout.log` | evidence | raw run output |
| `graph-cast-log.md` | **the settlement** | 7-section honest verdict; join PROVEN LIVE |
| `research/design/structure/plan/progress/review.md` | RDSPI artifacts | |

Plus the **four gitignored sandboxes** `.vend/live-proof/E052-0{1..4}/` (NOT committed — their evidence
is the committed JSON + cast log).

## The result (run 04, the clean proof)

All four nodes `success`, `skipped: []`, `halted: false`, note materialized:
- survey → board; propose-1 → `E-054`; propose-2 → `E-053` (concurrent, 63.8 s overlap, shared `runId`);
- **`capture-note` cast (not skipped), received BOTH epic paths, materialized** a note consolidating
  E-053 + E-054;
- one shared wallet: funded `4.2M tok`, **spent `473,338 tok`** = funded − remaining off ONE envelope,
  no per-branch leak.

Every AC clause maps to quoted evidence (progress.md table; cast log AC checklist).

## Test coverage

- **No new unit tests** — deliberate, and correct: this ticket adds **zero `src/` surface**. The pure
  wiring it exercises (`realPlayMacro` sizing + the wallet-threaded dispatcher) is already pinned by
  `graph-real-play-core.test.ts` (T-052-01: 3 new + 6 existing, all green). Re-testing here would
  duplicate that.
- **The verification IS the live cast.** AC is a behavioral claim about a metered run, satisfied by the
  `GraphResult` evidence in `cast-result-04.json`, read into `graph-cast-log.md`. The runner is an
  evidence artifact (run directly, never imported), so by house discipline it is not unit-tested.
- **Baseline gate green, unchanged:** `tsc --noEmit` clean; `bun test` 1191 pass / 0 fail;
  `bun run check:precommit` → `ok — tests green`. No `src/` regression (nothing in `src/` moved).

### Coverage gaps (by design)
- The live join's correctness is proven by **observation** (one clean run + three honest degrades), not
  by a repeatable automated test — inherently so, since it spends real money and depends on live model
  behavior. The repeatable proof of the *wiring* is the pure T-052-01 test; this ticket is its live
  counterpart, exactly as `castGraph`/`castChain` are proven live downstream of their pure cores.

## Open concerns & notes for the reviewer

1. **The real finding — two budget layers (carry forward).** E-052's shared wallet is the
   **wave-level** envelope; it is orthogonal to each node's **per-cast** `budget` (the in-flight andon
   ceiling). Widening the macro does NOT widen a per-cast ceiling. Run 01 proved the wallet works yet
   the join still skipped, because propose-2 hit its per-cast 150k. Reaching the live join required
   provisioning BOTH. Most acute: **`captureNotePlay.budget` is 8k tokens** (note.ts:77) — far too
   small to fund a real note cast (run 02 burned ~161k; run 04 247k). The per-node defaults are honest
   *predictions* but are **stale vs observed burn** for propose (cache_read swings 42k→635k) and note.
   **Recommendation:** a downstream calibration ticket to recalibrate these p90 envelopes (or a
   policy that the real-play runner sizes per-cast budgets from observed burn). Not a defect in
   E-052's scope.
2. **It took four metered runs (~2.48M tokens, ~14 casts).** More than the plan's "optionally re-cast
   once." Justified: each re-cast widened the *specific* limiter the prior run identified, and the
   sequence produced the finding above. The spend was authorized (the ticket/epic/`next-signal` frame
   this as the human-authorized live spend). If re-running for verification, run 04's budgets
   (survey 600k / propose 1.5M / note 600k) are the provisioning that absorbs the variance.
3. **Containment.** All mutation landed in gitignored `.vend/live-proof/` sandboxes via
   `projectRoot`; the tracked board (`docs/active/epic`, `docs/active/notes`) was never touched.
   Confirmed: `git status` outside `work/T-052-02/` shows only the Lisa-owned ticket files. The minted
   E-053/E-054 are **sandbox proposals, not real demand** — the note itself says so. They should NOT
   be pulled into the real tree from this proof.
4. **ID instability across runs (expected).** The proposer reused E-053/E-054 for *different* epics
   across the four runs (the survey re-ranks signals each time). This is correct behavior for a fresh
   survey, not a bug; the cast log notes it.
5. **Lisa owns the ticket frontmatter.** `phase`/`status` advanced as artifacts landed; not touched,
   left unstaged.

## Recommendation

**Done — AC fully met.** The 2-upstream JOIN is proven LIVE end-to-end under one shared wallet, with
concurrency held and spend bounded; the honest verdict + cast log record it (and the per-cast-budget
finding) without over-claim. E-052's goal — close the substrate's last stub-only property — is
achieved. The one follow-on worth filing is the per-cast budget recalibration (concern #1).
