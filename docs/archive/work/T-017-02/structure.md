# T-017-02 Structure — register-survey-and-gesture

The file-level blueprint. Three new files, two edited; no deletions. Ordering matters:
`survey-effect.ts` has no intra-ticket deps and must land first; `survey.ts` imports it; the
CLI edits import `survey.ts` lazily; the tests pin each.

## Files

### CREATE `src/play/survey-effect.ts` (~110 lines, addon-free, impure fs)

The board-staging effect + its typed inputs + the pure board renderer. Mirrors `expand-effect.ts`,
lifted from one signal to a board.

- **Imports:** `mkdir, writeFile` (`node:fs/promises`), `join` (`node:path`); type-only `Board` from
  `baml_client/index.ts`, type-only `CastContext, EffectResult` from `../engine/play.ts`;
  `renderBoard` from `./survey-core.ts`, and **reuse** `STAGING_DIR` from `./expand-effect.ts` (the
  contract is identical — import it, do not re-declare; this is a genuine shared constant, not the
  no-shared-util case, and `expand-effect.ts` is addon-free so the import keeps this module addon-free).
- **`export interface SurveyInputs { readonly project: string; readonly charter: string }`** — the
  two strings `b.request.Survey` renders; threaded to render + the gate/effect ctx. (No `fragment`; no
  `existingEpicIds`.)
- **`export const BOARD_STEM = "survey-board"`** — the fixed filename stem (D4: idempotent overwrite).
- **`export function renderStagedBoard(board: Board): string`** — PURE. Branches (D5):
  - empty board → `# Survey — no demand staged` heading + an honest-abstention paragraph
    (IA-4 language) + origin trailer.
  - non-empty → `# Survey — staged demand board` heading + the demand table header
    (`| Signal | Value | Budget (envelope) | Status |` + separator) + `renderBoard(board)` (the rows)
    + a `## Pull these` block: a fenced list of `vend chain "<what> — <why>"`, one per signal,
    top-ranked first, the first annotated as the recommended next pull + origin trailer
    (`_Staged by Vend's \`survey\` play — not promoted; pull to clear._`).
- **`export async function surveyBoardEffect(board, ctx): Promise<EffectResult>`** — `dir = join(ctx.projectRoot, STAGING_DIR)`,
  `path = join(dir, \`${BOARD_STEM}.md\`)`; `mkdir(dir, {recursive:true})`, `writeFile(path, renderStagedBoard(board))`;
  return `{ ok: true, detail: \`staged ${path}\`, artifacts: [path], produced: path }`. A genuine fs
  failure throws (the house rule); no `outcome` relabel (no id-collision branch — staging overwrites).

### CREATE `src/play/survey.ts` (~95 lines, value-imports the BAML addon, impure)

The registered play shell. Mirrors `expand-fragment.ts`.

- **Imports:** `readFile` (`node:fs/promises`), `join` (`node:path`); `b` from
  `baml_client/sync_client.ts`; type-only `Board` from `baml_client/index.ts`; `extractPromptText`
  from `../baml/decompose-bridge.ts`; `registry, type Card, type Play` from `../engine/play.ts`;
  `castPlay` from `../engine/cast.ts`; type-only `Budget`; `clear` from `./survey-core.ts`;
  `buildProjectSnapshot, listIdsIn, CHARTER_PATH` from `./project-context.ts`;
  `surveyBoardEffect, type SurveyInputs` from `./survey-effect.ts`; `basename` from `node:path`.
- **`export const PLAY = "survey"`** — registry key + run-log stamp.
- **`export type { RunSummary } from "../engine/cast.ts"`** + a value re-export import (the
  expand-fragment idiom for callers).
- **`const EMPTY_BOARD: Board = { signals: [] }`** — the catch target (D3).
- **`export function parseSurvey(text: string): Board`** — `try { b.parse.Survey(text) } catch { EMPTY_BOARD }`.
- **`export const surveyPlay: Play<SurveyInputs, Board>`** — the six variation points:
  - `render: (i) => extractPromptText(b.request.Survey(i.project, i.charter) as unknown as {...})`
  - `parse: parseSurvey`
  - `gates: (board) => clear(board)` (D2 — ignores ctx)
  - `effect: surveyBoardEffect`
  - `budget: { timeMs: 1_800_000, tokens: 300_000 }` with the D7 recalibration comment.
  - `card: { color: ["blue","green"], type: "permanent", rarity: "rare" } satisfies Card`
- **`registry.register(surveyPlay)`** at module load (self-register).
- **`export interface SurveyOptions`** — `{ budget: Budget; projectRoot?; model?; runId?; transcriptDir? }`
  (no `fragment`/`subject` — survey has no positional subject).
- **`export async function assembleSurveyInputs(opts): Promise<SurveyInputs>`** — IMPURE. Reads the
  REAL charter + lists story/ticket ids, builds the snapshot via `buildProjectSnapshot` (srcFiles:[]
  — an articulation/survey needs the board state, not the src tree, like expand). Returns
  `{ project, charter }`.
- **`export async function castSurvey(opts): Promise<RunSummary>`** — assemble inputs, then
  `castPlay(surveyPlay, inputs, opts.budget, { subject: \`survey of ${basename(root)}\`, projectRoot, model, runId, transcriptDir })`.

### CREATE `src/play/survey-effect.test.ts` (~120 lines, the AC#3 offline proof)

Mirrors `expand-effect.test.ts`. Every BAML import type-only; builds `Board` directly (no model).

- **`surveyBoardEffect` — stages under the PM desk, never the board:**
  - writes `docs/active/pm/staged/survey-board.md` carrying the demand table header + a `renderBoard`
    row per signal + a `vend chain "<what> — <why>"` pull line per signal + the origin trailer;
    `artifacts == [expected]`, `produced == expected`.
  - writes ONLY under `docs/active/pm/` — asserts `demand.md`, `epic`, `stories`, `tickets` do NOT
    exist under the temp root; `STAGING_DIR` does (the staging contract).
  - an EMPTY board → still `ok`, writes the abstention note (no table rows, the IA-4 language).
- **`clear → classify` wiring** (the project→staged-board path without a live model): a ranked
  grounded board → `success` + `materialize` + three passed gate rows; an empty board → `success` +
  `materialize` (the honest abstention clears); a padded blank-filler board → `gate-failed` +
  no-materialize (honest-empty andon); an ungrounded board → `gate-failed` (read-never-invent).
- **`renderStagedBoard`** — pure: non-empty embeds every signal's row + a pull line; empty renders the
  abstention note and no table header.

### EDIT `src/cli.ts` (~+45 lines)

- `USAGE`: add a `       vend survey [--budget <ms>,<tokens>]` line.
- `ParsedCommand`: add `| { readonly cmd: "survey"; readonly budget?: Budget }`.
- `parseArgs`: add `if (argv[0] === "survey") return parseSurveyArgs(argv);` (before the select tail).
- **`function parseSurveyArgs(argv): ParsedCommand`** — flags-only (D6): walk argv from index 1;
  `--budget` consumes the next token (malformed → usage; dangling → "missing --budget …"); any other
  token → `usage` (`unexpected survey argument: <a>`). Return `budget ? {cmd:"survey",budget} : {cmd:"survey"}`.
- **dispatch arm** (mirror the `expand` arm): `if (parsed.cmd === "survey") { const { castSurvey, surveyPlay } = await import("./play/survey.ts"); const budget = parsed.budget ?? surveyPlay.budget; const summary = await castSurvey({ budget }); print; exit 0/1; }`.

### EDIT `src/cli.test.ts` (~+25 lines)

Add a `survey` parse block mirroring the expand block: `survey` (no budget) → `{cmd:"survey"}`;
`survey --budget 100,200` → carries the budget; `survey --budget nope` → usage;
`survey --budget` (dangling) → "missing --budget …"; `survey junk` → usage (unexpected argument).

## Module boundary / dependency direction (unchanged, acyclic)

`survey.ts` (shell) → `survey-effect.ts` + `survey-core.ts` + engine (`castPlay`, `Play`, `registry`)
+ `project-context.ts`. `survey-effect.ts` → `survey-core.ts` + `expand-effect.ts` (for `STAGING_DIR`)
+ engine types. Both depend UP onto the engine; the engine imports neither (the E-007 keystone).
`cli.ts` lazy-imports `survey.ts` only in the dispatch shell (keeps the addon off the pure-parse path).

## Ordering

1. `survey-effect.ts` (no intra-ticket deps).
2. `survey-effect.test.ts` (pins #1) — green before the shell.
3. `survey.ts` (imports #1).
4. `cli.ts` parse + dispatch; `cli.test.ts` parse pins.
5. `bun run check` — full green; then the live `vend survey` is the human sweep step.
