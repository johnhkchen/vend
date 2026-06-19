# T-007-03 — Design: register-decompose-epic-on-the-engine

Decide how DecomposeEpic becomes a registry entry and how the runner + both dispatch
sites route through `castPlay`, **preserving behaviour exactly**. Research showed the
welded runner's seven steps map 1:1 onto `castPlay`'s spine + the six `Play` variation
points; the only friction is the success-path gate rows (D3). Every decision is grounded
in two hard facts: (a) engine must not import `src/play/` (acyclicity), and (b) input
assembly lives outside the `Play` (T-007-01), so something play-aware must still assemble.

## The play at a glance

```ts
// src/play/decompose-epic.ts
export const decomposeEpicPlay: Play<DecomposeInputs, WorkPlan> = {
  name: PLAY,                                                  // "decompose-epic"
  render: (i) => extractPromptText(b.request.DecomposeEpic(i.epic, i.charter, i.project)),
  parse:  (text) => b.parse.DecomposeEpic(text),
  gates:  (plan, ctx) => clear(plan, { epic: ctx.inputs.epic, charter: ctx.inputs.charter }),
  effect: decomposeEffect,                                     // materialize + lisaValidate
  budget: { timeMs: 7_200_000, tokens: 50_000 },              // high-tier warranted default
  card:   { color: ["blue", "white"], type: "permanent", rarity: "mythic" },
};
registry.register(decomposeEpicPlay);                          // self-register at module load
```

## Decision 1 — The play self-registers; `runDecomposeEpic` becomes `castPlay` over it

`decompose-epic.ts` constructs `decomposeEpicPlay` and calls `registry.register(...)` at
module load. Registration is a value side-effect, so any module that *value-imports*
`decompose-epic.ts` populates the singleton; pure tests that import `decompose-epic-core.ts`
never trigger it (they never load this module), so `play.test.ts`/`cast-core.test.ts` keep
their empty-singleton assumptions. The closures reference `b.request`/`b.parse` but only
*call* them when cast, so registration itself loads the addon exactly as the module's
top-level `import { b }` already does — no new test hazard.

`runDecomposeEpic(opts)` is reimplemented as the assembler + `castPlay` over the entry
(AC#2 — "castPlay over that entry; the play-specific logic now lives in the registry
entry, not the runner"):

```ts
export async function runDecomposeEpic(opts: RunOptions): Promise<RunSummary> {
  return assembleAndCast(decomposeEpicPlay, opts);
}
```

**Rejected** — deleting `runDecomposeEpic` entirely: AC#2 names it as the thing that
"is castPlay over that entry," and smoke/back-compat callers read it. It stays as the
canonical *direct* cast of the entry.

## Decision 2 — A `dispatch.ts` seam routes by name; assembly is shared, not duplicated

AC#3 wants CLI + press to "dispatch by name through the registry + castPlay (no hardcoded
`decompose-epic` branch)." New `src/play/dispatch.ts`:

```ts
import { registry } from "../engine/play.ts";
import { assembleAndCast, type RunOptions } from "./decompose-epic.ts"; // also runs registration
export type DispatchResult =
  | { kind: "no-play"; error: PlayNotFoundError }
  | { kind: "ran";     summary: RunSummary };

export async function runPlay(name: string, opts: RunOptions): Promise<DispatchResult> {
  const lookup = registry.get(name);
  if (!lookup.found) return { kind: "no-play", error: lookup.error };
  return { kind: "ran", summary: await assembleAndCast(lookup.play, opts) };
}
```

`assembleAndCast(play, opts)` (exported from `decompose-epic.ts`) is the **single** site
of the DecomposeEpic input assembly — `assembleInputs` + `epicIdOf` → `castPlay`. Both
`runDecomposeEpic` (passes the entry directly) and `runPlay` (passes the registry-resolved
play) call it, so there is one assembly path, not two. Dependency edges stay acyclic:
`dispatch.ts → decompose-epic.ts → engine`; `decompose-epic.ts` never imports `dispatch.ts`.

**Honest scope:** `assembleAndCast` takes `play: AnyPlay` but assembles DecomposeEpic's
`{epic, charter, project}` — the one input shape that exists. That is not premature
generality: there is exactly one assembly today, so abstracting the assembly seam now would
be speculative (the value gate's own lesson). **T-007-04's second play reveals the right
seam** and generalizes assembly. This ticket proves render/parse/gates/effect/budget/card
generalize through the registry + `castPlay`; assembly generalizes next.

**Rejected** — putting `runPlay` in `decompose-epic.ts`: a generic by-name dispatcher
reads wrong inside a specific play's file, and a dedicated seam is what AC#3 describes.
**Rejected** — a name→assembler registry now: no second assembler exists to motivate it.

## Decision 3 — Enrich `GateVerdict.clear` with an OPTIONAL `cleared`, preserving the four rows

The only behaviour delta (research): a successful cast would log `gateResults: []` instead
of the welded runner's four passed rows. To honour AC#2 ("no behaviour change") and AC#4
("exactly as before") for the keystone run-log artifact, take T-007-02 D3's pre-authorized
fix:

```ts
// engine/play.ts
export type GateVerdict =
  | { readonly status: "clear"; readonly cleared?: readonly string[] }   // +optional
  | { readonly status: "stop"; readonly gate: string; readonly unit: string; readonly reason: string };

// engine/cast-core.ts — castGateRows clear branch
if (g.status === "clear") return (g.cleared ?? []).map((gate) => ({ gate, passed: true }));
```

`gates.ts` `GateClear` already carries `cleared: readonly GateName[]`, and DecomposeEpic's
`gates` returns `clear(...)` verbatim, so at runtime the four names flow through → four
passed rows, **byte-identical to the welded runner**. The field is OPTIONAL, so:

- `GateResult` stays structurally assignable to `GateVerdict` (`readonly GateName[]` →
  `cleared?: readonly string[]`, required→optional both fine).
- The existing `cast-core.test.ts` / `play.test.ts` fixtures (`{status:"clear"}`, no
  `cleared`) still yield `[]` — green unchanged (AC#4).
- A play that returns a bare clear still logs `[]` — the opaque-on-clear default is intact;
  the enrichment only *adds* the ability to carry names when a play already has them.

This touches two engine files (T-007-01/02 territory) but the edit is additive and
pre-blessed by T-007-02's own design note. **Rejected** — accept `[]`: weakens the "you got
what you paid for is demonstrable" ledger and leaves a visible diff for every success run,
when the fix is two additive lines. **Rejected** — make `cleared` required: breaks the
existing bare-`{status:"clear"}` fixtures and every other play's `gates`.

## Decision 4 — `decomposeEffect`: a faithful re-encoding of the materialize/validate/relabel block

```ts
const decomposeEffect = async (plan: WorkPlan, ctx: CastContext<DecomposeInputs>): Promise<EffectResult> => {
  const root = ctx.projectRoot;
  try {
    const { storyFiles, ticketFiles } = await materialize(plan, {
      storiesDir: join(root, "docs", "active", "stories"),
      ticketsDir: join(root, "docs", "active", "tickets"),
    });
    const validated = await lisaValidate(root);
    return {
      ok: validated.ok,
      detail: validated.ok ? "lisa validate ✓" : `lisa validate ✗\n${validated.output}`,
      artifacts: [...storyFiles, ...ticketFiles],
    };
  } catch (e) {
    if (e instanceof IdCollisionError)
      return { ok: false, outcome: "id-collision", detail: `id-collision — reused board id(s): ${e.collisions.join(", ")}` };
    throw e; // a genuine fs failure is not a clean outcome — propagate (matches `else throw e`)
  }
};
```

Preserves exactly: collision guard refuses before any write; `lisaValidate` failure leaves
`outcome` `success` but `materialized=false` (effect returns `ok:false`, no relabel); only
`IdCollisionError` relabels; any other throw propagates. The cast loop owns the `· effect …`
stdout line, so the surfaced prefix differs cosmetically from the runner's `· lisa validate
…` / `· andon: id-collision …` — the `detail` carries the same information; flagged in
Review as a cosmetic-only change. The materialized **meaning** is identical (`= validated.ok`).

## Decision 5 — Generalize CLI play-name parsing; reject unknown names at dispatch, not parse

`parseRunArgs` drops the `argv[1] !== "decompose-epic"` check and captures `play: string`
generically; `ParsedCommand.run.play` widens from the literal to `string`. The PURE parser
must NOT validate against the registry (that would import `decompose-epic.ts` → BAML into
`cli.test.ts`). An unknown name parses to a `run` command and is rejected at the impure
dispatch by `runPlay` returning `no-play` → stderr `PlayNotFoundError.message` + exit 2.

Verified against every existing `cli.test.ts` assertion (AC#4): the happy path still yields
`play:"decompose-epic"`; `run summon` → `missing <epic.md>` (still `cmd:"usage"`); the
missing-epic/missing-budget/malformed-budget cases are unchanged because they trip on
`argv[2]`/`--budget`, not the play name. `USAGE` updates to `vend run <play> <epic.md>
--budget <ms>,<tokens>` (no test pins the literal).

## Decision 6 — Press dispatches the constant name through `runPlay`

`press.ts` swaps `import { runDecomposeEpic }` for `import { runPlay }` and the loop body
becomes `registry`-routed:

```ts
const res = await runPlay("decompose-epic", { epicPath: run.epicPath, budget: run.budget, projectRoot: root });
if (res.kind === "no-play") throw res.error; // the press's play MUST be registered — a wiring bug, not a user error
runs.push(res.summary);
```

The name is a **constant**, not a `switch` — every board epic action maps to decompose-epic
today, and the `MenuCache` schema carries no per-action play (changing it bumps the cache
version and breaks `gather.test.ts`, AC#4). This is "dispatch by name through the registry,"
not "a hardcoded branch." `press-core.ts` (pure planner) is untouched; it keeps importing
`type RunSummary` from `decompose-epic.ts`, which re-exports it from `engine/cast.ts` so the
type still resolves there (identical `{runId, outcome, materialized}` shape).

## Testing strategy (AC#3 spirit + AC#4)

Two NEW pure tests, both addon-free, covering the two behavioural changes I introduce:

- `cast-core.test.ts` (+cases): `castGateRows({status:"clear", cleared:["value",...]})` →
  four passed rows; `classify` with a `cleared` verdict → those rows in `gateLog`. Pins the
  D3 enrichment. Existing bare-clear cases stay (prove `[]` default).
- `cli.test.ts` (+cases): `run <other-play>` parses to `{cmd:"run", play:"<other>", …}`
  generically; the existing decompose-epic happy path still passes.

The live wiring (`runPlay` / `runDecomposeEpic` / `decomposeEffect`) is the impure verb —
NOT unit-tested (house pattern; T-007-02 D7), proven by `tsc` + a plain-`bun` registration
smoke (no addon limit) that prints `registry.names()` and confirms the play is wired.

## What stays out

- No menu-schema play field, no second play, no assembly-seam abstraction — T-007-04.
- No `Rarity → ValueTier` ranking wired into the shelf: the shelf still ranks by demand
  tier (`gather.ts`); consuming the card's rarity would change menu output (breaks AC#4).
  The card is registered as metadata; its consumption is a later ticket.
- No DRY of the engine/runner duplicated stream helpers — the kaizen T-007-02 flagged.
