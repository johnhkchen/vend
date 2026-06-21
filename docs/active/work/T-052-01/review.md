# T-052-01 — Review

_Handoff: thread ONE shared wallet (E-048) through `castRealPlayGraph`. Pure wiring half of E-052 —
no live spend. Committed `a78ca6f`._

## What changed

Three source files, one commit. No files created or deleted; every change additive.

| file | change |
|------|--------|
| `src/play/graph-real-play-core.ts` | +type-only `Budget` import; +exported pure `realPlayMacro(survey, propose, note): Budget` (the wave-schedule envelope sizing). |
| `src/play/graph-real-play.ts` | +`import { allocate }`, +`realPlayMacro` import; +`macroBudget?: Budget` on `GraphRealPlayOptions`; `castRealPlayGraph` body now `allocate`s ONE wallet and passes it as `castGraph`'s 3rd arg; JSDoc documents the E-052 threading. |
| `src/play/graph-real-play-core.test.ts` | +`runGraphConcurrent`/`allocate`/`Budget`/`DagNode` imports, +`realPlayMacro` import; +`costedStub`/`costedDiamond` fixtures + four node prices; +`describe("realPlayMacro …")` with 3 tests. |

Plus the five RDSPI artifacts under `docs/active/work/T-052-01/`.

## The core decision

`castRealPlayGraph` now funds ONE shared envelope sized to the diamond's wave schedule, per
denomination (the IA-8 concurrency divergence):

- **tokens** = survey + **2×**propose + note = **608_000** (both fan-out proposes burn real tokens);
- **timeMs** = survey + **1×**propose + note = **4_200_000** (the two proposes overlap → MAX, not sum).

The sizing is a PURE function in `graph-real-play-core.ts` so the addon-free test pins it without
importing the impure shell — the same testability split as `pickSignal`/`buildConsolidationTopic`. A
per-node-sized envelope (one propose's tokens) budget-stops propose-2 and skips the join — the
cross-branch leak E-052 closes — and the test proves exactly that contrast.

## Test coverage

`graph-real-play-core.test.ts` — 9 pass (3 new + 6 existing). All pure: import the core +
`runGraphConcurrent` + `allocate`; never `graph-real-play.ts`, never `graph.ts`. No addon, no spawn,
no live model.

1. **Arithmetic pin** — `realPlayMacro(...)` `toEqual({tokens: 608_000, timeMs: 4_200_000})`. A
   regression that dropped the second propose, or summed wall-clock, fails here.
2. **Covers all four nodes** — the REAL `REAL_PLAY_EDGES` diamond, costed at the real budgets, run
   through the pure budgeted dispatcher under `allocate(realPlayMacro(...))`: all four nodes cast,
   `skipped` empty, not halted, `walletRemaining` exactly `{0,0}` (the tight envelope fully+exactly
   drawn). This is the live cast's behavior, proven deterministically — the wiring half of E-052's
   "Done looks like" #1/#4.
3. **Not-per-node** — a one-propose token wallet → propose-2 in `skipped` with `/budget-stopped/`,
   `capture-note` never runs. Pins why both proposes must be counted.

**Coverage of the AC:** complete. Every clause maps to a test or a typecheck (see progress.md table).

### Coverage gaps (by design, not omission)

- **The impure `castRealPlayGraph` body is not unit-tested** — it value-imports the addon-loading
  plays + spawning `castGraph`, so by the module's stated discipline (graph-real-play.ts:22–27) no
  `bun test` may import it. Its wiring judgment (the macro sizing) IS unit-tested via the pure core;
  its live behavior is T-052-02's metered cast. This is the house pattern, not a gap to fill here.
- **No live cast in this ticket** — deliberate. E-052's "Done looks like" (the join running on REAL
  upstreams under the shared wallet, ~4 real `claude -p`) is T-052-02. T-052-01's contract is the
  pure wiring + green gate, and that is met.

## Verification (all green)

- `bun test` (full) → **1191 pass, 0 fail**, 77 files.
- `bun run build` (tsc --noEmit) → clean.
- `bun run check:precommit` → `precommit: ok — tests green` (also ran on the commit hook).

## Open concerns & notes for the reviewer

- **Back-compat / behavior change (intended):** `castRealPlayGraph` moves from the legacy no-wallet
  path to the budgeted path. The only two callers are the `import.meta.main` live entry and T-052-02 —
  both WANT the budgeted path. This is the point of E-052, documented in the JSDoc. Nothing else
  imports the function (it value-imports the addon, so nothing safely can in tests).
- **Minor duplication:** `castRealPlayGraph` re-resolves the three `?? play.budget` fallbacks that
  `buildRealPlayGraph` also computes (graph-real-play.ts:88–90). Three trivial `??` lines, chosen over
  refactoring `buildRealPlayGraph`'s return shape (design.md rejects that — it is the "inspect the
  spec" builder, not a wallet source). Low risk; flagged for awareness.
- **Envelope is the TIGHT honest size, not a safety-padded one.** It draws to exactly `{0,0}` on the
  costed stubs. In the LIVE cast, actual burn varies (recalibrated p90 envelopes), and `debitWave`
  floors at zero + surfaces overshoot (IA-8) — so a node overrunning its predicted price is detected,
  not silently negative. If T-052-02's live run shows the tight envelope budget-stops a real wave,
  the `macroBudget` override exists precisely to widen it without code change. Worth watching in
  T-052-02; not a defect here (the predicted-price math is exactly right).
- **Lisa owns the ticket frontmatter.** The `phase` field advanced (research→…→implement) as artifacts
  landed; I did not touch it and deliberately left it unstaged out of this commit.

## Recommendation

Ready. The pure wiring is correct, proven, and gate-green; the only remaining E-052 work is the
authorized live metered re-cast in T-052-02.
