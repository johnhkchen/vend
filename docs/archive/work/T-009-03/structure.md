# T-009-03 — Structure: register-and-cast-propose-epic

The blueprint — files, boundaries, signatures, import directions. No code, the shape of it.
Purely additive: three new source files + one test. No existing source is modified (the engine,
`propose-core.ts`, `note.ts`, `dispatch.ts`, the CLI all stay untouched), mirroring T-007-04.

## Files

| File | Status | Addon? | Tested by |
|---|---|---|---|
| `src/play/propose-effect.ts` | **create** | addon-free (impure: fs) | `propose-effect.test.ts` |
| `src/play/propose-effect.test.ts` | **create** | addon-free | itself |
| `src/play/propose-epic.ts` | **create** | loads `b` (BAML) | none (house rule) |
| `docs/active/work/T-009-03/*.md` | **create** | — | — |

## `src/play/propose-effect.ts` — the impure effect + shared types

Addon-free (BAML/engine imports TYPE-ONLY), impure (one fs verb). The testable world-touch.

Imports:
- `node:fs/promises` → `mkdir`, `writeFile`; `node:path` → `join`.
- `type { EpicCard }` from `../../baml_client/index.ts` (TYPE-ONLY).
- `type { CastContext, EffectResult }` from `../engine/play.ts` (TYPE-ONLY).
- `{ renderCard, nextEpicId }` from `./propose-core.ts` (runtime, addon-free pure).
- `{ detectCollisions }` from `./id-guard.ts` (runtime, pure).
- `{ listIdsIn }` from `./project-context.ts` (runtime, addon-free).

Exports:
- `const EPIC_DIR = "docs/active/epic"` — where minted cards land, relative to projectRoot.
- `interface ProposeEpicInputs { readonly signal: string; readonly charter: string;
  readonly project: string; readonly existingEpicIds: readonly string[] }` — the play's `I`.
- `async function proposeEpicEffect(card: EpicCard, ctx: CastContext<ProposeEpicInputs>):
  Promise<EffectResult>` — the effect (D2):
  1. `dir = join(ctx.projectRoot, EPIC_DIR)`; `live = await listIdsIn(dir)` (live board).
  2. `minted = nextEpicId(live)`.
  3. `collisions = detectCollisions([minted], live)`; if non-empty → return
     `{ ok:false, outcome:"id-collision", detail }` (the decompose relabel; never clobbers).
  4. `body = renderCard({ ...card, id: minted })`; `path = join(dir, ` `${minted}.md` `)`.
  5. `await mkdir(dir, { recursive:true }); await writeFile(path, body, "utf8")`.
  6. return `{ ok:true, detail: ` `minted ${minted} → ${path}` `, artifacts:[path] }`.
  A genuine fs throw propagates (not a clean outcome — the `captureNoteEffect` rule).

Boundary: pure judgment (renderCard/nextEpicId/detectCollisions) is composed here with the only
fs touch; no BAML, no spawn → offline-testable.

## `src/play/propose-epic.ts` — the impure shell (mirrors `note.ts`)

Loads the BAML addon (render/parse call `b` in-process). **No bun-test value-imports it.**

Imports:
- `{ b }` from `../../baml_client/sync_client.ts`; `type { EpicCard }` from `../../baml_client/index.ts`.
- `{ extractPromptText }` from `../baml/decompose-bridge.ts`.
- `{ registry, type Card, type Play }` from `../engine/play.ts`.
- `{ castPlay }` from `../engine/cast.ts`; `type { RunSummary }` from `../engine/cast.ts` (re-export).
- `type { Budget }` from `../budget/budget.ts`.
- `{ clear }` from `./propose-core.ts`.
- `{ buildProjectSnapshot, listIdsIn, CHARTER_PATH }` from `./project-context.ts`.
- `{ proposeEpicEffect, EPIC_DIR, type ProposeEpicInputs }` from `./propose-effect.ts`.
- `node:fs/promises` → `readFile`; `node:path` → `join`.

Exports:
- `const PLAY = "propose-epic"`.
- `type { RunSummary }` re-export (the `note.ts`/`decompose-epic.ts` convention).
- `function parseProposeEpic(text: string): EpicCard` — `try b.parse.ProposeEpic(text) catch →
  EMPTY_CARD` (D4). Private `EMPTY_CARD` const (blank scalars, empty arrays).
- `const proposeEpicPlay: Play<ProposeEpicInputs, EpicCard>` — the six members:
  - `name: PLAY`
  - `render: (i) => extractPromptText(b.request.ProposeEpic(i.signal, i.charter, i.project) as …)`
  - `parse: parseProposeEpic`
  - `gates: (card, ctx) => clear(card, { charter: ctx.inputs.charter,
    existingEpicIds: ctx.inputs.existingEpicIds })`
  - `effect: proposeEpicEffect`
  - `budget: { timeMs: 1_800_000, tokens: 16_000 }` (D5, inlined)
  - `card: { color: ["blue"], type: "permanent", rarity: "rare" } satisfies Card`
- `registry.register(proposeEpicPlay)` — self-register at module load.
- `interface ProposeEpicOptions { readonly signal: string; readonly budget: Budget;
  readonly projectRoot?: string; readonly model?: string; readonly runId?: string;
  readonly transcriptDir?: string }`.
- `async function assembleProposeEpicInputs(opts): Promise<ProposeEpicInputs>` — the IMPURE verb:
  - `root = opts.projectRoot ?? process.cwd()`.
  - `charter = await readFile(join(root, CHARTER_PATH), "utf8")`.
  - `[stories, tickets, epics] = await Promise.all([ listIdsIn(.../stories),
    listIdsIn(.../tickets), listIdsIn(join(root, EPIC_DIR)) ])`.
  - `project = buildProjectSnapshot({ root, srcFiles: [], stories, tickets })` (mirrors
    `assembleNoteInputs`).
  - return `{ signal: opts.signal, charter, project, existingEpicIds: epics }`.
- `async function castProposeEpic(opts): Promise<RunSummary>` — PE-1 pull-discipline (D6):
  assemble inputs for ONE signal, then `castPlay(proposeEpicPlay, inputs, opts.budget,
  { subject: opts.signal, projectRoot: root, model, runId, transcriptDir })`. No board drain.

## `src/play/propose-effect.test.ts` — the offline cast demonstration (AC#3)

Addon-free. Imports `{ proposeEpicEffect, EPIC_DIR }` (runtime), `clear`/`nextEpicId` from
propose-core, `{ classify }` from `../engine/cast-core.ts`, `type` EpicCard + enums (TYPE-ONLY,
string-literal member casts — the propose-core.test.ts discipline), node `fs`/`os`/`path` for a
temp projectRoot. A `FULL_CARD` fixture (clearing) reused from the 02 test shape.

Test groups:
1. **effect writes the minted card** — temp root with `docs/active/epic/E-001…E-009.md` seeded;
   `proposeEpicEffect(FULL_CARD, { inputs, projectRoot })` → `ok:true`; `E-010.md` exists; its
   body round-trips title/serves/intent/value and carries `id: E-010` (the MINTED id, even when
   `FULL_CARD.id` differs — proves D2 re-mint); `artifacts` names the path.
2. **mint is disjoint on an empty board** — no epic dir → writes `E-001.md`.
3. **classify wiring** — `clear(FULL_CARD, ctx)` → `classify(...)` → `success`+`materialize:true`,
   gateLog three passed rows; a `bounds`/`value`/`structural` STOP → `gate-failed`+`materialize:false`
   (the andon — nothing written).

## Import-direction / acyclicity check

`propose-epic.ts` → engine (`castPlay`, `Play`, `registry`) + `propose-core.ts` +
`propose-effect.ts` + `project-context.ts` + baml. `propose-effect.ts` → `propose-core.ts` +
`id-guard.ts` + `project-context.ts` + node. `propose-core.ts` → `id-guard.ts` only. The engine
imports NONE of these. No cycle; budget inlined so no UP edge onto the shelf.

## Verification points

- `bun run check` (baml:gen → tsc → bun test) green; suite grows by the propose-effect pins, no
  regressions.
- `bun -e` smoke: three plays registered on one engine.
- Manual: no live board mutation committed (`baml_client/` gitignored; no real `E-010.md` written
  by tests — they use temp roots; the dirty Lisa ticket files left untouched).
</content>
