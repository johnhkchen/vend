# T-047-02 — Review

**Settle the live `survey → [propose ×2] → capture-note` cast and read the first composition honestly.**
Analysis ticket: no `src/` changes — judgment + one board edit. All four ACs met; `check:*` green.

## What changed

**Created (`docs/active/work/T-047-02/`):**
- `structure.md`, `plan.md`, `progress.md`, `review.md` — RDSPI artifacts.
- **`graph-cast-log.md`** — the load-bearing deliverable: the four reads, each backed by verbatim
  `.vend/runs.jsonl` evidence. (This is the cast-log T-047-01 never wrote.)

**Modified (one file):**
- `docs/active/demand.md` — Frontier 3 crystallized: the "In flight" E-047 row → **settled** with the
  honest verdict; the Frontier 3 section → **done → E-047** + `cross-branch budget accounting` →
  **minted → E-048**; noted conditional edges (signal #1) stays open.

**Not touched:** any `src/`, any test, the ticket frontmatter (Lisa advances `phase`).

## The verdict (the four reads)

1. **Concurrency — PROVEN live.** The two proposes share `startedAt 03:55:54.569Z` (to the ms) and
   overlap **68.97 s** (`propose-1 03:55:54.569→03:57:03.539`; `propose-2 …→03:58:07.532`). Two real
   `claude -p` casts ran at once under `castGraph`'s wave dispatcher — the thing `runChain` and the stub
   diamond structurally cannot show. **The headline holds.**
2. **Join — NOT proven live (honest).** propose-1 was `budget-exhausted`, so `runGraph` correctly
   **skipped** `capture-note` (no record, no note; `blockedBy: [propose-1]`, `halted: true`). The live
   multi-upstream join is **unproven** by this run; it stands proven only in the stub test
   (`graph-real-play-core.test.ts`). The halt/skip *semantics*, however, were live-correct.
3. **Minted epic — E-048, sound, kept.** One epic minted (propose-2/signal #2): `cross-branch-budget-
   wallet`, a real P7 gap (no shared wallet across the concurrent wave). `lisa validate` clean (no
   orphan; E-043 partial-chain pattern). Minted-only → **keep**, decompose when pulled. The cast minted
   the demand for its own failure mode (propose-1's budget-exhaustion *is* that gap, live).
4. **P7 + first composition.** P7 held per-node — the andon fired exactly (`spent 180315/150000`); total
   $2.06, bounded. The cross-branch envelope is the gap (→ E-048). The composition is **modest** but
   **real**: substrate proven live (concurrency + halt/skip + a real mint); the plays don't compose
   richly yet. **No over-claim** (not a profound playbook; join unproven; degraded run). **No
   under-claim** (real concurrency live; a real P7 gap surfaced).

## Test coverage

No tests added — correct for an analysis ticket (it writes judgment + a doc edit, changes no behavior).
The cast's **wiring** is already unit-proven by T-047-01's `src/play/graph-real-play-core.test.ts` (6
tests, fan-out + multi-upstream join via pure `runGraph`). The cast's **liveness** is what this ticket
reads from the run-log. The only executable gate is the regression guard:

- `bun run check:typecheck` → EXIT 0.
- `bun run check:test` → **1127 pass / 0 fail** (unchanged from baseline; no `src/` touched).

**Gap (named, not closed):** the live multi-upstream join has **no green live evidence** — only the
stub test. Closing it needs a re-cast where **both** proposes succeed (so `capture-note` actually
consumes two epic paths). That is downstream work, not this ticket (which settles the run that happened).

## Open concerns / handoff

- **Live join still owed.** A future clean cast (both proposes within budget) would prove the live join.
  Worth pairing with E-048 (a shared wave wallet makes a clean two-branch run more likely) — or simply
  giving the proposes a fatter envelope. **Not blocking**; the substrate is proven, the join wiring is
  stub-proven.
- **E-048 awaits a decompose decision.** Sound, minted-only. Recommend keep + decompose when pulled;
  it directly serves P7 and is the natural Frontier 3 successor now that concurrency is live.
- **Conditional edges (signal #1) is still open demand.** It was the keystone signal this cast tried
  first; propose-1's budget-exhaustion starved it before it minted. Remains on Frontier 3, unminted.
- **T-047-01 left no review.md / cast-log.** This ticket wrote the cast-log; T-047-01's own Review never
  ran (budget). If Lisa expects a T-047-01 review.md, that is a separate gap — flagged for human notice.
- **Nothing running.** No live processes; `runs.jsonl` frozen at `20:58:07`. The cast is fully settled.

## AC checklist

- [x] Concurrency proof (overlap shown) — or honest sequential record → **PROVEN** (68.97 s overlap).
- [x] Join confirmed — or honest record → **honest: not proven live** (propose-1 failed → join skipped).
- [x] Minted-epic quality + decompose status; P7 bounded + clean → E-048 sound, minted-only, keep; P7
      held per-node (andon fired); cross-branch gap noted.
- [x] Honest first-composition verdict; `demand.md` Frontier 3 updated → done (no over/under-claim).
- [x] `bun run check:*` green → typecheck EXIT 0; 1127 pass / 0 fail.
