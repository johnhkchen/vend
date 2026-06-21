# T-052-02 — Structure

_The blueprint. No `src/` change (the substrate is complete — Design). All files live under
`docs/active/work/T-052-02/`. The one piece of code is the live-cast runner; the rest are evidence +
prose artifacts it produces._

## File inventory

| file | kind | created/modified | role |
|---|---|---|---|
| `research.md` | artifact | created | substrate map (done) |
| `design.md` | artifact | created | 3 decisions (done) |
| `structure.md` | artifact | created | this blueprint |
| `plan.md` | artifact | created | ordered steps |
| `cast-live.ts` | **code (runner)** | created | the live metered cast + evidence dump |
| `cast-result.json` | evidence | produced by runner | machine-readable `GraphResult` |
| `cast-stdout.log` | evidence | produced by runner | raw stdout/stderr of the cast |
| `graph-cast-log.md` | artifact | created | the settlement / honest verdict |
| `progress.md` | artifact | created | implement-phase log |
| `review.md` | artifact | created | handoff |

**`src/` files touched: none.** `git status` for `src/` stays clean. Confirmed by Research: the wiring
(`castRealPlayGraph` → `castGraph(nodes, edges, allocate(macro))`) shipped in T-052-01 (`a78ca6f`).

## `cast-live.ts` — module shape

A standalone Bun script, **run directly** (`bun run docs/active/work/T-052-02/cast-live.ts`), never
imported. It is the impure shell's *caller*, so it value-imports `castRealPlayGraph` (which loads the
BAML addon + spawns) — which is exactly why it is NOT under `src/` and NOT touched by any `bun test`
(the house "no test imports the impure shell" discipline; this file is never imported at all).

### Imports
- `node:fs` (`cpSync`, `existsSync`, `mkdirSync`, `writeFileSync`) — sandbox prep + evidence dump.
- `node:path` (`join`, `dirname`, `resolve`) — path building.
- `castRealPlayGraph`, type `GraphRealPlayOptions` from `../../../../src/play/graph-real-play.ts`
  (relative from `work/T-052-02/`). Type `GraphResult` from `../../../../src/engine/graph-core.ts`.
- `realPlayMacro` + the four node-id constants (`SURVEY_NODE`, `PROPOSE_1_NODE`, `PROPOSE_2_NODE`,
  `NOTE_NODE`) from `../../../../src/play/graph-real-play-core.ts` — to size the widened envelope and
  label the evidence dump.
- The three plays' budgets are read **via `realPlayMacro` only** — the script does not need to import
  the plays themselves (the macro takes plain `Budget` values; pass the same defaults the shell uses).
  To keep the script honest about the *defaults*, import `surveyPlay`/`proposeEpicPlay`/`captureNotePlay`
  budgets — BUT that value-imports the addon. Cheaper + addon-free: read the three `Budget` literals as
  constants mirrored in the script with a comment citing their source lines (survey.ts:88,
  propose-epic.ts:107, note.ts:77). **Chosen:** mirror the literals (addon-free, the script stays a
  thin caller); a divergence is caught by the cast itself authorizing.

### Constants
```
const REPO   = resolve(import.meta.dir, "../../../..");        // vend repo root
const SANDBOX = join(REPO, ".vend/live-proof", `E052-${stamp}`); // gitignored cast target
const SURVEY_B = { tokens: 300_000, timeMs: 1_800_000 };  // survey.ts:88
const PROPOSE_B = { tokens: 150_000, timeMs: 1_800_000 }; // propose-epic.ts:107
const NOTE_B    = { tokens:   8_000, timeMs:   600_000 }; // note.ts:77
const TIGHT  = realPlayMacro(SURVEY_B, PROPOSE_B, NOTE_B);  // {608_000, 4_200_000}
const MACRO  = { tokens: TIGHT.tokens * 2, timeMs: TIGHT.timeMs * 2 }; // widened (Design D2)
```
`stamp` is passed in or derived from `process.argv` (NOT `Date.now()` in the deterministic-test sense —
this is a one-shot script, a timestamp arg is fine; default to a fixed label `E052` if none).

### Flow (top-level `await`, `import.meta.main` not needed — script is run directly)
1. **Prep sandbox** — if `!existsSync(SANDBOX)`: `mkdirSync(recursive)`, `cpSync(REPO/docs, SANDBOX/docs,
   {recursive})` and `cpSync(REPO/CLAUDE.md, SANDBOX/CLAUDE.md)`. (Copies the rich, ranked board so the
   survey reliably stages ≥2 signals — Design D1.) Skip copying `.vend`, `node_modules`, `.git`.
2. **Cast** — `const result = await castRealPlayGraph({ projectRoot: SANDBOX, macroBudget: MACRO });`
3. **Dump evidence** — build a plain JSON view of `result`:
   ```
   { funded: MACRO, walletRemaining: result.walletRemaining,
     spent: { tokens: MACRO.tokens - rem.tokens, timeMs: MACRO.timeMs - rem.timeMs },
     halted: result.halted, haltReason: result.haltReason, outcome: result.outcome,
     nodes: [...result.nodes].map(([id,s]) => ({ id, outcome: s.outcome, produced: s.produced,
              actuals: s.actuals })),
     skipped: result.skipped, produced: [...result.produced] }
   ```
   `writeFileSync(work/T-052-02/cast-result.json, JSON.stringify(view, null, 2))`.
4. **Echo** — print each node line + `formatWallet`-style readout to stdout (tee'd to
   `cast-stdout.log` by the invoking shell `2>&1 | tee`).
5. **Exit** — `process.exit(result.outcome === "success" && !result.halted ? 0 : 1)`.

### Boundaries / what it must NOT do
- No mutation of the real repo board (everything via `projectRoot: SANDBOX`).
- No `src/` edits, no test edits.
- Pure-caller only: it owns I/O (copy, write, spawn-via-cast); it reuses the engine's evidence, never
  recomputes wallet math (reads `result.walletRemaining` straight).

## `cast-result.json` — schema (the settlement's source of truth)

```jsonc
{
  "funded":          { "tokens": 1216000, "timeMs": 8400000 },
  "walletRemaining": { "tokens": <int>,   "timeMs": <int> },   // present ⇒ wallet path taken
  "spent":           { "tokens": <int>,   "timeMs": <int> },   // funded − remaining (collective draw)
  "outcome": "success" | "...",
  "halted":  false,
  "haltReason": <string?>,
  "nodes": [ { "id": "survey", "outcome": "success", "produced": "<board path>", "actuals": {...} },
             { "id": "propose-1", ... }, { "id": "propose-2", ... },
             { "id": "capture-note", "outcome": "success", "produced": "<note path>", "actuals": {...} } ],
  "skipped": [],            // empty ⇒ join not skipped (AC#1)
  "produced": [ ["capture-note", "<note path>"] ]   // the sink
}
```

## `graph-cast-log.md` — section blueprint (mirrors T-047-02, opposite Read-2 outcome)

1. **Header** — what was cast, against which sandbox, with which (widened) envelope + why.
2. **Raw run-log records** — verbatim table from `.vend/runs.jsonl` (the run's rows): survey + 2
   proposes + **capture-note** (the row E-047 never had), with `startedAt`/`endedAt`/`outcome`/cost.
3. **Read 1 — Concurrency held** — the two proposes' overlapping intervals (the E-047 headline,
   re-confirmed under the shared wallet).
4. **Read 2 — The JOIN ran (THE NEW HEADLINE)** — `capture-note` cast + materialized; received the
   2-entry upstreams (subject names both epics; both proposes in `produced`); not skipped. The exact
   inversion of T-047-02 Read 2.
5. **Read 3 — One envelope bounded the spend** — `funded`/`walletRemaining`/`spent` from
   `cast-result.json`; the collective draw off ONE wallet, not a per-branch tally; whether the tight
   608k would have sufficed (bonus calibration finding).
6. **Read 4 — Verdict** — labels it a LIVE METERED cast (≈4 real `claude -p`, ~$X actual), distinct
   from a free deterministic proof; no over/under-claim.
7. **AC checklist** — each clause ticked against evidence (or honestly marked if degraded).

## Ordering that matters

`cast-live.ts` must exist and the cast must run **before** `graph-cast-log.md` can be written truthfully
(the settlement quotes real evidence). `progress.md`/`review.md` last. Research/Design/Structure/Plan
precede the cast (they decide how to run it). This is the RDSPI order; the only intra-Implement ordering
is **runner → cast → settle**.
