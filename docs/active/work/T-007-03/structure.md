# T-007-03 — Structure: register-decompose-epic-on-the-engine

The file-level blueprint. Seven files touched: two engine files get a small additive
enrichment (D3), `decompose-epic.ts` is rewritten around the registry entry, one new
`dispatch.ts` seam, and the two dispatch sites (`cli.ts`, `press.ts`) plus two test files.
Ordering is chosen so the build never goes red between commits.

## Changed: `src/engine/play.ts` (additive — D3)

`GateVerdict.clear` gains an OPTIONAL `cleared`:

```ts
export type GateVerdict =
  | { readonly status: "clear"; readonly cleared?: readonly string[] }
  | { readonly status: "stop"; readonly gate: string; readonly unit: string; readonly reason: string };
```

Update the doc-comment on `GateVerdict` to note `cleared` is the optional per-gate echo a
play MAY supply (DecomposeEpic does, via gates.ts's `GateClear.cleared`); absent ⇒ the loop
logs no per-gate rows. No other change. `register`/registry/Card/etc. untouched.

## Changed: `src/engine/cast-core.ts` (additive — D3)

`castGateRows` clear branch reads the optional names:

```ts
export function castGateRows(g: GateVerdict | null): readonly LogGate[] {
  if (g === null) return [];
  if (g.status === "stop") return [{ gate: g.gate, passed: false, detail: `${g.unit}: ${g.reason}` }];
  return (g.cleared ?? []).map((gate) => ({ gate, passed: true }));   // was: return []
}
```

Update its doc-comment: a CLEAR now echoes one passed row per name the play supplied in
`cleared`, or `[]` when opaque. `classify` is unchanged (it already delegates rows to
`castGateRows`). No signature changes anywhere.

## Rewritten: `src/play/decompose-epic.ts`

The orchestration body is removed; the module becomes **the registry entry + a thin
assembler**. Public surface (what other modules import) is preserved.

**Imports** (after): `type Play, type Card, type CastContext, type EffectResult, registry`
from `../engine/play.ts`; `castPlay, type RunSummary` from `../engine/cast.ts`; `b` +
`type WorkPlan` from baml_client; `extractPromptText` from `../baml/decompose-bridge.ts`;
`clear` from `../gate/gates.ts`; `assembleInputs, type DecomposeInputs` from
`./project-context.ts`; `materialize, IdCollisionError` from `./materialize.ts`; `join`
from `node:path`. **Removed** imports: `dispense`/`ClaudeTimeoutError`/`ResultMessage`,
`check`/`timeoutMsFor`/`Budget*`/`Usage`, `appendRunLog`/`RunOutcome`, `isStop`/`GateResult`,
`classify`/`makeStreamSink`/`resolveLoggedModel`, `appendFile`/`mkdir`. **Removed**:
`export * from "./decompose-epic-core.ts"` (the runner no longer uses the core; nothing
imports those names *through* this module — `decompose-epic.test.ts` imports the core
directly).

**Kept**: `PLAY = "decompose-epic"`, `RunOptions`, `lisaValidate` (+ `ValidateResult`),
`epicIdOf`. **Re-export** `RunSummary`: `export type { RunSummary } from "../engine/cast.ts";`
(replaces the local interface; `press-core.ts`/`press.ts` still resolve it here).

**Added** members, in order:

1. `decomposeEffect(plan, ctx): Promise<EffectResult>` — Design D4 (materialize +
   lisaValidate; `IdCollisionError` → relabel; else throw). Module-private const.
2. `export const decomposeEpicPlay: Play<DecomposeInputs, WorkPlan>` — Design "at a
   glance": render/parse/gates/effect=`decomposeEffect`/budget/card.
3. `registry.register(decomposeEpicPlay);` — top-level side-effect, immediately after (2).
4. `export async function assembleAndCast(play: AnyPlay, opts: RunOptions): Promise<RunSummary>`
   — the single assembly site: `assembleInputs` → `castPlay(play, {epic,charter,project},
   opts.budget, {subject: epicIdOf(...), projectRoot, model, runId, transcriptDir})`.
   (`AnyPlay` imported from `../engine/play.ts`.)
5. `export async function runDecomposeEpic(opts: RunOptions): Promise<RunSummary>` →
   `assembleAndCast(decomposeEpicPlay, opts)`.

`RunOptions` keeps `{epicPath, budget, projectRoot?, model?, runId?, transcriptDir?}` — the
shape `cli.ts`/`press.ts` already pass; `castPlay`'s `CastOptions` is a superset, so the
mapping is total.

## New: `src/play/dispatch.ts`

The by-name dispatch seam (Design D2). ~35 lines.

```ts
import { registry, type AnyPlay, PlayNotFoundError } from "../engine/play.ts";
import { type RunSummary } from "../engine/cast.ts";
import { assembleAndCast, type RunOptions } from "./decompose-epic.ts"; // ← also registers the play

export type DispatchResult =
  | { readonly kind: "no-play"; readonly error: PlayNotFoundError }
  | { readonly kind: "ran";     readonly summary: RunSummary };

export async function runPlay(name: string, opts: RunOptions): Promise<DispatchResult> {
  const lookup = registry.get(name);
  if (!lookup.found) return { kind: "no-play", error: lookup.error };
  return { kind: "ran", summary: await assembleAndCast(lookup.play, opts) };
}
```

Header comment: the impure dispatch verb — looks a play up by name in the singleton and
casts it through `assembleAndCast`. Imported only by impure shells (`cli.ts` lazily,
`press.ts`); value-imports `decompose-epic.ts` (BAML) which is why no test imports it
(proven by smoke, the press/runner precedent). `PlayNotFoundError`/`AnyPlay` value+type
imports; `RunSummary` type-only.

## Changed: `src/cli.ts` (Design D5)

- `USAGE` → `"usage: vend run <play> <epic.md> --budget <ms>,<tokens>"`.
- `ParsedCommand` run variant: `play: "decompose-epic"` → `play: string`.
- `parseRunArgs`: drop the `argv[1] !== "decompose-epic"` guard; read `play = argv[1]`,
  reject when missing/`--`-prefixed (`missing <play>`); rest unchanged; return `{cmd:"run",
  play, epicPath, budget}`.
- `import.meta.main` run arm (lines 183–186): replace the `runDecomposeEpic` lazy-import
  with `runPlay`:

```ts
const { runPlay } = await import("./play/dispatch.ts");
const res = await runPlay(parsed.play, { epicPath: parsed.epicPath, budget: parsed.budget });
if (res.kind === "no-play") { process.stderr.write(`${res.error.message}\n`); process.exit(2); }
const s = res.summary;
process.stdout.write(`run ${s.runId}: ${s.outcome} (materialized: ${s.materialized})\n`);
process.exit(s.outcome === "success" ? 0 : 1);
```

## Changed: `src/shelf/press.ts` (Design D6)

- Import: `import { runDecomposeEpic, type RunSummary }` → `import { runPlay } from
  "../play/dispatch.ts"; import type { RunSummary } from "../play/decompose-epic.ts";`.
- Loop body:

```ts
for (const run of planned) {
  const res = await runPlay("decompose-epic", { epicPath: run.epicPath, budget: run.budget, projectRoot: root });
  if (res.kind === "no-play") throw res.error; // the press's play must be registered (wiring bug)
  runs.push(res.summary);
}
```

- Update the header comment's "value-imports `runDecomposeEpic`" line to reference the
  by-name dispatch via `runPlay`. `press-core.ts` is **untouched**.

## Changed: `src/cli.test.ts` (new pure cases — AC#3 spirit)

Add to the `parseArgs` describe (existing cases unchanged):

```ts
test("run <play> captures any play name generically (validated at dispatch, not parse)", () => {
  expect(parseArgs(["run", "propose-epic", "e.md", "--budget", "1,2"]))
    .toEqual({ cmd: "run", play: "propose-epic", epicPath: "e.md", budget: { timeMs: 1, tokens: 2 } });
});
```

(The existing `run decompose-epic` happy path and `run summon → usage` cases already cover
the unchanged behaviour.)

## Changed: `src/engine/cast-core.test.ts` (new pure cases — D3)

Add a `cleared`-bearing fixture and two assertions (existing bare-clear cases unchanged):

```ts
const clearedNamed: GateVerdict = { status: "clear", cleared: ["value", "allocation", "bounds", "structural"] };
// castGateRows(clearedNamed) → four passed rows; classify({…, gateVerdict: clearedNamed}).gateLog === same.
```

## Ordering (red-free)

1. Engine enrichment (`play.ts`, `cast-core.ts`) + its test cases — pure, isolated, green.
2. `decompose-epic.ts` rewrite + `dispatch.ts` — compiles against the engine; play registers.
3. `cli.ts` + `cli.test.ts` + `press.ts` — dispatch sites routed by name.
4. Full `tsc` + `bun test` + registration smoke.

## Acyclicity check

`dispatch.ts → decompose-epic.ts → {engine, gate, baml, project-context, materialize}`.
`engine/* ↛ play/*` (unchanged). `decompose-epic.ts ↛ dispatch.ts`. `press.ts →
dispatch.ts → decompose-epic.ts` (press → play, the existing direction). No cycle.
