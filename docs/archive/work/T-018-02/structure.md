# T-018-02 Structure — register-steer-and-gesture

The blueprint: file-level changes, public interfaces, and ordering. Not code — the shape of it.
Two new source modules, one new test, two edits to shared files. Every interface mirrors a proven
Survey counterpart; the new surface is the fork-aware staged artifact.

## Files at a glance

| File | Action | What |
|---|---|---|
| `src/play/steer-effect.ts` | **create** | `SteerInputs`, `STEER_STEM`, `renderStagedSteer`, `steerEffect` (addon-free) |
| `src/play/steer-effect.test.ts` | **create** | AC#3 offline proof — stages board+forks under PM desk, never the live board |
| `src/play/steer.ts` | **create** | `PLAY`, `parseSteer`, `steerProjectPlay` (registered), `SteerOptions`, `assembleSteerInputs`, `castSteer` |
| `src/cli.ts` | **modify** | `USAGE` line, `ParsedCommand` arm, `parseArgs` route, `parseSteerArgs`, dispatch arm |
| `src/cli.test.ts` | **modify** | steer parse tests (mirror the survey block) |

No deletions. No engine changes (the seam is consumed as-is). No BAML changes (T-018-01 shipped
`steer.baml` + the generated `Steer`/`Fork`).

## 1. `src/play/steer-effect.ts` (new — addon-free, IMPURE effect)

Mirrors `survey-effect.ts`, extended to render the fork half.

```ts
// imports: mkdir, writeFile (node:fs/promises); join (node:path)
// type-only: Steer, Fork (baml_client); CastContext, EffectResult (engine/play)
// value: renderBoard (survey-core); renderForks (steer-core); STAGING_DIR (expand-effect)

export interface SteerInputs {
  readonly project: string;
  readonly charter: string;
}

export const STEER_STEM = "steer";              // → docs/active/pm/staged/steer.md (D4)

export function renderStagedSteer(steer: Steer): string;  // PURE — the three branches (D3)
export async function steerEffect(steer: Steer, ctx: CastContext<SteerInputs>): Promise<EffectResult>;
```

- `renderStagedSteer` branches (D3):
  - fully empty (`!signals.length && !forks.length`) → `# Steer — nothing to stage` abstention note
    (both-sides honest-empty language), trailer. No table, no forks section.
  - non-empty → `# Steer — staged board + forks` heading, intro line, the demand table header +
    `renderBoard({ signals: steer.signals })`, a `## Pull these` block (one `vend chain "<what> —
    <why>"` per signal, top-ranked marked recommended — the survey-effect pulls list), then either
    `## Forks` + `renderForks(steer.forks)` when forks exist, or a one-line "_No forks — the path is
    clear (nothing to decide)._" note when `forks` is empty. Origin trailer
    (`_Staged by Vend's \`steer\` play — not promoted; assent to a fork / pull a signal._`).
- `steerEffect` — `mkdir -p` `<root>/docs/active/pm/staged/`, write `renderStagedSteer(steer)` to
  `steer.md`, return `{ ok: true, detail: \`staged <path>\`, artifacts: [path], produced: path }`.
  A genuine fs failure THROWS (the survey/expand effect rule); no `outcome` relabel (no id).

## 2. `src/play/steer.ts` (new — BAML-loading shell, IMPURE)

Mirrors `survey.ts`.

```ts
// imports: readFile (node:fs/promises); basename, join (node:path)
// value: b (baml_client/sync_client); extractPromptText (decompose-bridge);
//        registry, castPlay; clear (steer-core); buildProjectSnapshot, listIdsIn, CHARTER_PATH
//        (project-context); steerEffect, SteerInputs (steer-effect)
// type-only: Steer (baml_client); Card, Play (engine/play); Budget; RunSummary (engine/cast)

export const PLAY = "steer";
export type { RunSummary } from "../engine/cast.ts";

export function parseSteer(text: string): Steer;          // b.parse.SteerProject — NO try/catch (D2)

export const steerProjectPlay: Play<SteerInputs, Steer> = {
  name: PLAY,
  render: (i) => extractPromptText(b.request.SteerProject(i.project, i.charter) as …),
  parse: parseSteer,
  gates: (steer) => clear(steer),                          // steer-core; no ctx needed
  effect: steerEffect,
  budget: { timeMs: 2_400_000, tokens: 400_000 },          // D6 — recalibrate from the log (E-013)
  card: { color: ["blue", "green"], type: "permanent", rarity: "rare" } satisfies Card,
};
registry.register(steerProjectPlay);                       // self-register at module load

export interface SteerOptions {
  readonly budget: Budget;
  readonly projectRoot?: string;
  readonly model?: string;
  readonly runId?: string;
  readonly transcriptDir?: string;
}

export async function assembleSteerInputs(opts: SteerOptions): Promise<SteerInputs>;  // D5
export async function castSteer(opts: SteerOptions): Promise<RunSummary>;             // subject `steer of <root>`
```

- `parseSteer` carries a doc-comment stating WHY no catch: Steer is two-array → SAP degrades both
  garbage shapes to an empty steer, never throws (the steer.test.ts pin; divergence from `parseSurvey`).
- `assembleSteerInputs` — `Promise.all([readFile(charter), listIdsIn(stories), listIdsIn(tickets)])`,
  then `buildProjectSnapshot({ root, srcFiles: [], stories, tickets })`. Identical to survey's.
- `castSteer` — `castPlay(steerProjectPlay, inputs, opts.budget, { subject: \`steer of
  ${basename(root)}\`, projectRoot: root, model, runId, transcriptDir })`.

## 3. `src/play/steer-effect.test.ts` (new — AC#3 proof)

Mirrors `survey-effect.test.ts`. All BAML imports type-only; tier as string-literal cast; no addon.

- `mkSignal(tier, over)` / `mkFork(over)` / `mkSteer(signals, forks)` helpers (lift from the
  steer-core test fixtures).
- `RANKED` = keystone→high→standard grounded board + one genuine fork.
- `ctxFor(root): CastContext<SteerInputs>`, `seedRoot()` (mkdtemp), `exists(path)`.
- Tests:
  - `steerEffect` writes `docs/active/pm/staged/steer.md` with the demand rows
    (`renderBoard({signals})`), the table header, a `vend chain` pull line per signal, **and** the
    fork block (`renderFork` content — question, options, recommendation). `artifacts`/`produced`
    point at the staged path.
  - writes ONLY under `docs/active/pm/` — never `demand.md`/`epic`/`stories`/`tickets`.
  - a **board with no forks** stages the board + a "no forks — the path is clear" note (no `## Forks`
    blocks).
  - a **fully empty steer** stages the abstention note, no table, no forks.
  - clear→classify wiring (`classify` from cast-core): a grounded board+fork → success+materialize,
    gate rows = `STEER_GATE_NAMES` passed; an ungrounded signal → `read-never-invent` gate-failed, no
    materialize; a manufactured fork (1 option) → `fork-genuineness` gate-failed, no materialize.
  - `renderStagedSteer` pure-helper assertions (the three branches).

## 4. `src/cli.ts` (modify)

- `USAGE` — add after the survey line:
  `"       vend steer [--budget <ms>,<tokens>]\n"`.
- `ParsedCommand` — add arm `| { readonly cmd: "steer"; readonly budget?: Budget }` (after `survey`).
- `parseArgs` — add `if (argv[0] === "steer") return parseSteerArgs(argv);` (after the survey route).
- `parseSteerArgs(argv)` — a copy of `parseSurveyArgs` (flags-only; `--budget` optional; any
  positional → `unexpected steer argument: <tok>`; dangling/malformed `--budget` → usage). Returns
  `{cmd:"steer", budget?}`.
- dispatch arm (in `import.meta.main`, after the survey arm) — D8:
  ```ts
  if (parsed.cmd === "steer") {
    const { castSteer, steerProjectPlay } = await import("./play/steer.ts");
    const budget = parsed.budget ?? steerProjectPlay.budget;
    const summary = await castSteer({ budget });
    process.stdout.write(`run ${summary.runId}: ${summary.outcome} (materialized: ${summary.materialized})\n`);
    process.exit(summary.outcome === "success" ? 0 : 1);
  }
  ```

## 5. `src/cli.test.ts` (modify)

Add a steer block after the survey block (lines 174–190), mirroring it: no-budget → `{cmd:"steer"}`;
`--budget` carries the override; a positional → `unexpected steer argument: junk`; malformed/dangling
`--budget` → usage.

## Module boundaries & dependency direction (unchanged invariants)

- Dependency points UP: `steer.ts` / `steer-effect.ts` → engine (`castPlay`, `Play`, `CastContext`);
  the engine never imports `src/play/`. Acyclic.
- Addon containment: only `steer.ts` value-imports `b`. `steer-effect.ts` is addon-free (type-only
  BAML + pure render reuse), so its test loads no addon. No bun-test value-imports `steer.ts`.
- Shared contracts reused (not re-implemented): `renderBoard`/`renderSignalRow` (the demand.md row),
  `renderForks` (the fork block), `STAGING_DIR` (the PM inbox), `buildProjectSnapshot`/`listIdsIn`
  (the snapshot).

## Ordering of changes

1. `steer-effect.ts` (the effect + `SteerInputs` the shell imports).
2. `steer-effect.test.ts` (prove the effect offline before wiring the shell).
3. `steer.ts` (the registered play + cast verbs).
4. `src/cli.ts` (gesture parse + dispatch).
5. `src/cli.test.ts` (parse tests).
6. `bun run check:*` green.
