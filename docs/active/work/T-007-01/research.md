# T-007-01 — Research: play-registry-and-interface

Map the codebase that the `Play` contract must abstract. This ticket is the
**shared-contract-first** root (R12) of S-007-01: it extracts the per-play
variation currently *welded* into `src/play/decompose-epic.ts` into a typed
`Play<I, O>` interface plus a `name → Play` registry. Pure types + a map — no
orchestration, no fs. Descriptive only; options/decisions live in `design.md`.

## The seed: what is welded into `runDecomposeEpic`

`src/play/decompose-epic.ts` is E-001's hardcoded runner. Reading it end to end
(lines 106–208), the orchestration is a fixed pipeline with exactly six points
where it names **DecomposeEpic-specific** things. Those six points are the
per-play variation the contract must capture:

| # | Welded call in `runDecomposeEpic` | What varies per play |
|---|---|---|
| 1 | `b.request.DecomposeEpic(epic, charter, project)` → `extractPromptText(req)` (L115–118) | **render**: typed inputs → the prompt string |
| 2 | `b.parse.DecomposeEpic(result.result ?? "")` (L151) | **parse**: model reply text → a typed output `O` |
| 3 | `clear(plan, { epic, charter })` (L152) | **gates**: the output's clearing verdict |
| 4 | `materialize(plan, {storiesDir, ticketsDir})` + `lisaValidate(root)` (L168–173) | **effect**: what landing the output does to the world |
| 5 | `opts.budget` (passed by caller; warranted envelope) | **default budget** (mana cost) |
| 6 | `PLAY = "decompose-epic"` (L41), stamped on every run-log record | **name** + (new) **card** metadata |

Everything *between* those points — assemble inputs, dispense under budget,
`check` tokens, `classify` the verdict, fan the stream to two surfaces, append
exactly one run-log record — is **play-agnostic orchestration**. That generic
loop is **T-007-02's** job; this ticket only defines the contract it will call.

## The five contracts a Play hangs on (all already pure, all addon-free at the type level)

The variation above plugs into modules that are already split pure-core /
impure-verb. The contract reuses their **types**, importing no native addon:

- **Budget** — `src/budget/budget.ts`. `interface Budget { timeMs; tokens }`.
  Pure, leaf module (imports nothing from the app). This is the play's default
  mana cost. `check(budget, usage)` and `timeoutMsFor(budget)` stay in the cast
  loop, not the contract.
- **Gate verdict** — `src/gate/gates.ts`. `type GateResult = GateClear | GateStop`
  (the *whole-plan* clearing verdict). `GateStop` carries `gate: GateName`,
  `unit`, `reason`; `GateClear` carries `cleared: GateName[]`. **Caveat:**
  `GateName` is the four DecomposeEpic-specific names
  (`value|allocation|bounds|structural`) — narrow for a play-agnostic contract
  (see design D2). The baml `WorkPlan` import there is **type-only**, so gates.ts
  loads no addon.
- **Clearing context** — `gates.ts` `interface ClearContext { epic; charter }`.
  These two strings are *two of DecomposeEpic's three inputs* — the gate context
  is derived from the play's inputs, not stored separately.
- **Effect** — `src/play/materialize.ts`. `materialize(plan, {storiesDir,
  ticketsDir}) -> Promise<MaterializeResult { storyFiles; ticketFiles }>`; throws
  `IdCollisionError { collisions }` (an *expected*, caught refusal that relabels
  the outcome to `id-collision`). `lisaValidate(root) -> { ok; output }`. The
  effect for DecomposeEpic is the pair: materialize then validate.
- **Outcome vocabulary** — `src/log/run-log.ts`. `type RunOutcome =
  "success"|"gate-failed"|"timed-out"|"budget-exhausted"|"id-collision"`. The
  effect can *relabel* an outcome (id-collision), so the contract's effect result
  may carry an optional `RunOutcome`. run-log imports nothing from the seam or
  budget — a pure type import.

## The card model (the metadata the contract adds)

`docs/knowledge/card-model.md` gives the metadata shape:
`card = { name, manaCost(budget), color(discipline), typeLine(sorcery|permanent),
text(effect+gates), rarity(value tier) }`. The ticket AC asks the contract to
carry **color / type / rarity**:

- **color** — the WUBRG discipline pie (White=gates, Blue=planning, Black=power,
  Red=speed, Green=ramp). Multi-color is normal (DecomposeEpic = Azorius WU).
- **type** (typeLine) — the single-use/reusable axis: `sorcery` (cast once) vs
  `permanent` (reusable), plus `instant` (reactive one-shot).
- **rarity** — value tier. `card-model.md` equates rarity (common→mythic) with
  demand.md's **ValueTier** (leaf→keystone). `src/shelf/menu.ts` already defines
  `type ValueTier = "keystone"|"high"|"standard"|"leaf"` and ranks the shelf on
  it; `Action.budget: Budget` and `Action.tier: ValueTier` are how a card already
  reaches the menu. The contract's rarity must eventually feed `Action.tier`
  (wired in T-007-03, not here).

## The house patterns this contract must obey

- **Pure core / impure verb** (cf. `gates.ts`, `budget.ts`, `id-guard.ts`,
  `materialize.ts`, `decompose-epic-core.ts`). A concrete play's `render`/`parse`
  *do* load the BAML addon (`b.request`/`b.parse`), but the **interface file**
  must stay addon-free so its test is an ordinary pure-function test (the
  discipline that keeps `gates.test.ts` etc. off the bun-test/BAML one-call
  limit, memories 20213/20275).
- **Returned andon, not exception** (`budget.ts` / `gates.ts` house rule): a
  *programmer* error throws; an *expected* miss is returned data. An unknown play
  name on lookup is the registry analogue — AC#2 says it "returns a typed error,
  never undefined-deref."
- **Typed error classes carrying their evidence** — `IdCollisionError
  { collisions }` is the template for a registry `PlayNotFoundError`.
- **Heterogeneous map** — a `name → Play` registry stores plays with *different*
  `I`/`O`; the map is necessarily type-erased at storage. The type safety lives
  at registration and at each call site that re-narrows.

## Module layout & conventions

- New module home: `src/engine/` (does not exist yet — every existing module
  sits under its own `src/<area>/` dir: `budget`, `gate`, `log`, `executor`,
  `play`, `shelf`). The story DAG and ticket both name `src/engine/play.ts`.
- TS config (`tsconfig.json`): `strict`, `noUncheckedIndexedAccess`,
  `verbatimModuleSyntax: true` (so type-only imports **must** be `import type`),
  `allowImportingTsExtensions` (imports carry the `.ts` suffix).
- Scripts (`package.json`): `check:typecheck` = `tsc --noEmit`; `check:test` =
  `bun test`. AC#4 requires both green. `baml:gen` is **not** needed — the
  contract imports no generated baml values.
- Test style (`id-guard.test.ts`): `bun:test` `describe/test/expect`, `toEqual`
  for exact pins, a header comment stating the module's purity.

## Constraints & assumptions

- **No orchestration here.** No `dispense`, no `classify`, no fs. The cast loop
  (T-007-02) consumes this contract; building any of it now violates the slice.
- **File ownership (R4).** This ticket *creates* `src/engine/play.ts` +
  its test and touches nothing else. T-007-03 will edit `decompose-epic.ts` to
  *register* DecomposeEpic — that edge is already in the DAG (`depends_on`).
- **`Play<I, O>` is the headline signature** (AC#1). The gate/effect context is a
  shared shape derived from `I`; whether it becomes a third type parameter or a
  concrete `CastContext<I>` is a design question (D3).
- **Assumption:** the run-log's `RunOutcome` is the right vocabulary for an
  effect to relabel into; confirmed by `materialize`'s existing id-collision →
  `id-collision` relabel in the welded runner (L178–181).
