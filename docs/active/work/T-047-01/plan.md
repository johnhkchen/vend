# T-047-01 — Plan: ordered implementation steps

Each step is independently verifiable and commits atomically. Tests precede the shell so the wiring
judgment is proven addon-free before the spawning shell exists.

## Step 1 — Pure core `graph-real-play-core.ts`

Write File 1 (structure.md). Implement:
- `SURVEY_NODE`/`PROPOSE_1_NODE`/`PROPOSE_2_NODE`/`NOTE_NODE` constants; `REAL_PLAY_EDGES: DagEdge[]`.
- `pickSignal(md, index)` — `const s = parseBoardSignals(md); return index < s.length ? {ok:true,
  signal:s[index]!} : {ok:false, reason:\`board has ${s.length} signal(s); need ≥ ${index+1}\`}`.
- `epicIdFromPath(p)` — `(p.split("/").pop() ?? p).replace(/\.md$/,"") || p`.
- `buildConsolidationTopic(paths)` — derive ids, return a topic string naming both (and degrading
  legibly if `paths.length < 2`, e.g. naming the one it has).
- `subjectForProposeSignal(signal)` — non-empty (`signal.trim() || "propose (degraded — no signal)"`).
- `subjectForJoin(paths)` — `\`consolidate ${ids.join(" + ")}\`` (non-empty fallback).

**Verify:** `tsc --noEmit` clean (run after Step 2's test exists too). No fs/addon imports.

## Step 2 — Unit test `graph-real-play-core.test.ts`

Write File 3 (structure.md §Tests 1–4). The stub-node proof reuses the `graph-example.ts`
`recordingStub` shape but with the REAL adapters:

```ts
function summary(outcome, produced?) { return { runId:`run-${outcome}`, outcome,
  materialized: outcome==="success", produced }; }
// survey stub: cast: async () => summary("success", boardFixturePath)
// propose stub(index, epicPath): cast: async (u) => {
//   const md = await readFile(u.get(SURVEY_NODE)!, "utf8");
//   const sel = pickSignal(md, index); seen[id] = sel; return summary("success", epicPath); }
// note stub: cast: async (u) => {
//   const paths = [u.get(PROPOSE_1_NODE)!, u.get(PROPOSE_2_NODE)!];
//   seenTopic = buildConsolidationTopic(paths); seenJoin = Object.fromEntries(u);
//   return summary("success", notePath); }
// drive: await runGraph({ nodes:[...], edges: REAL_PLAY_EDGES });
```

Assertions: `seen[PROPOSE_1].signal === fixtureSignal1`; `seen[PROPOSE_2].signal === fixtureSignal2`;
`seenJoin === { "propose-1": epicA, "propose-2": epicB }`; `seenTopic` contains both epic ids;
`result.halted === false`; `Object.fromEntries(result.produced) === { "capture-note": notePath }`.
Plus the direct `pickSignal`/`buildConsolidationTopic`/`epicIdFromPath` cases (incl. the `< 2`
degrade). Fixture board = a minimal `survey-board.md` body with a `## Pull these` ```` ``` ```` block
of two `vend chain "..."` lines, written to a `mkdtemp` dir; `rm` in `finally`.

**Verify:** `bun test src/play/graph-real-play-core.test.ts` green; full `bun test` green; `tsc
--noEmit` clean. **Commit 1** (`feat(play): real-play graph pure core + deterministic wiring proof`).

## Step 3 — Impure shell `graph-real-play.ts`

Write File 2 (structure.md). `buildRealPlayGraph` builds the four `PlayNode`s + `REAL_PLAY_EDGES`;
`castRealPlayGraph` resolves budgets (`override ?? play.budget`) and returns `castGraph(nodes,
edges)`. The `import.meta.main` block casts against `process.cwd()` and prints the result + exit code.

**Verify:** `tsc --noEmit` clean (the shell is typechecked, not unit-tested — the `chain.ts`
discipline). Confirm no `bun test` file value-imports it (grep). Full `bun test` still green (the new
shell is not imported by any test). **Commit 2** (`feat(play): castRealPlayGraph shell + live entry`).

## Step 4 — Live metered cast + capture (the headline)

Run `bun run src/play/graph-real-play.ts` against the repo root (the authorized P7 spend). Capture
**verbatim** to `docs/active/work/T-047-01/graph-cast-log.md`:
- the command + full stdout (the wave order, per-node casts).
- **concurrency evidence**: the two propose records' `startedAt`/`endedAt` from `.vend/runs.jsonl`
  (extract the propose-1/propose-2 rows) showing **overlapping** intervals — the two real casts ran
  concurrently. (Plus the structural fact: `runGraphConcurrent` dispatches the survey-ready wave
  `[propose-1, propose-2]` via one `Promise.all`.)
- the JOIN note content (it references BOTH minted epics) + the minted epic ids + the note path.
- `lisa validate` output after (clean — E-043: no orphan; a retry adopts by title).

**If the live executor is unavailable in-environment** (no `claude` auth / addon), record the HONEST
degraded run with the cause (the explicitly permitted AC#3 outcome): what was attempted, the exact
failure, and the deterministic proof (Step 2) that stands in for the wiring. Do NOT fabricate a run.

**Verify:** `graph-cast-log.md` written. If a real run mutated the board, `lisa validate` clean.
**Commit 3** (`docs(T-047-01): live real-play graph cast log` — or the degraded record).

## Testing strategy summary

| Surface | How proven |
|---|---|
| `pickSignal` (fan-out #1/#2 + degrade) | unit (Step 2 direct cases) |
| `buildConsolidationTopic` / `epicIdFromPath` (join text) | unit (Step 2) |
| fan-out delivers board to both proposes; JOIN delivers both epics | unit via `runGraph` stub-node proof (Step 2) |
| `castRealPlayGraph` shell (spawn + concurrency) | `tsc` + LIVE cast (Step 4) — the `castGraph` discipline |
| concurrency (2 real casts overlap) + real `produced` threading + no orphan | live cast log + `lisa validate` (Step 4) |

## Risks & mitigations

- **Degraded propose spends a gate-stopped cast** — defensive only; real board has ≥2 signals.
  Documented in the cast log if it fires.
- **Live cast cost/time** — bounded by per-node budgets (P7); the `import.meta.main` uses play
  defaults. The human running `lisa loop` authorizes.
- **Board mutation** — minted epics + note are the authorized artifacts; `lisa validate` confirms no
  orphan; E-043 idempotency means a re-run adopts rather than double-mints.
