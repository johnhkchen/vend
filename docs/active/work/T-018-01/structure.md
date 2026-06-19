# T-018-01 — Structure: steer-pure-core

The blueprint — file-level changes, public interfaces, internal organization, ordering. Five
files created, plus the regenerated (gitignored) `baml_client/`. No files modified or deleted.

## Files

| Path | Status | Role |
|---|---|---|
| `baml_src/steer.baml` | **create** | `Fork` + `Steer` classes, `SteerProject` function |
| `src/play/steer-core.ts` | **create** | pure gates (`clear`) + fork renderer |
| `src/play/steer-core.test.ts` | **create** | pure unit tests (gates + renderer) |
| `src/baml/steer-bridge.ts` | **create** | offline render/parse bridge (child process) |
| `src/baml/steer.test.ts` | **create** | offline BAML pins (parse / degrade / render) |
| `baml_client/*` | regenerate | `bun run baml:gen` adds `Fork`/`Steer` to `types.ts` |

## 1. `baml_src/steer.baml`

Header comment (mirroring survey.baml): the demand-extractor that adds FORKS over Survey's
board; authoring-only; reuses E-016's `Signal`; SAP behavior = WorkPlan-style two-array
degrade (note it as the predicted/observed honest-empty handle). Then:

```baml
class Fork {
  question        string @description("the genuine decision the human must make — one line; the andon pull. Surface NO fork (empty list) when the path is clear; never manufacture a decision.")
  options         string[] @description("2–4 mutually-exclusive, real paths; each distinct. Fewer than 2 is not a choice; more than 4 is an un-narrowed menu.")
  whyItMatters    string @description("the stakes — why this fork is load-bearing, what each path commits to. Blank ⇒ an inconsequential fork.")
  recommendation  string @description("Vend's recommended option + one-line rationale; the human assents or overrides (recommendation-first).")
}

class Steer {
  signals  Signal[] @description("the ranked demand board — highest-leverage first; REUSES the demand.md Signal shape. EMPTY when the project grounds no demand gradient (honest-empty, IA-4).")
  forks    Fork[]   @description("the genuine decisions only the human can make. EMPTY when the path is clear — never manufacture a fork to seem useful (the fork-side sibling of honest-empty).")
}

function SteerProject(project: string, charter: string) -> Steer {
  client ClaudeStub
  prompt #"… demand-surveyor + fork-surfacer framing …"#
}
```

The prompt: Survey's board framing (read-never-invent, honest-empty, leverage-order) PLUS a
forks section — surface only genuine forks (2–4 real options, why it matters, recommendation),
abstain when the path is clear. Inputs `{ project }` / `{ charter }` + `{ ctx.output_format }`.

## 2. `src/play/steer-core.ts`

Module header: the Steer pure core; mirror of survey-core ONE STEP UP (board + forks);
purity discipline (type-only BAML; runtime imports `renderSignalRow` from expand-core +
`TIER_RANK` from survey-core, both pure); STOP = returned data, drift = `RangeError`.

**Imports**
```ts
import type { Signal, Fork, Steer } from "../../baml_client/index.ts"; // type-only
import type { GateVerdict } from "../engine/play.ts";
import { renderSignalRow } from "./expand-core.ts";   // shared row contract
import { TIER_RANK } from "./survey-core.ts";          // single leverage ordering
```

**Public surface**
```ts
export const STEER_GATE_NAMES = ["read-never-invent", "fork-genuineness", "leverage-rank"] as const;
export type SteerGateName = (typeof STEER_GATE_NAMES)[number];
export const MIN_FORK_OPTIONS = 2;
export const MAX_FORK_OPTIONS = 4;
export function clear(steer: Steer): GateVerdict;
export function renderFork(fork: Fork): string;
export function renderForks(forks: readonly Fork[]): string;
```

**Internal**
```ts
function nonEmpty(s: unknown): boolean;            // copied predicate idiom
function tierRank(member: string): number;          // TIER_RANK lookup; throws RangeError on drift
interface Offense { unit: string; reason: string }
function readNeverInventGate(steer: Steer): Offense | null;
function forkGenuinenessGate(steer: Steer): Offense | null;
function leverageRankGate(steer: Steer): Offense | null;
const GATES: ReadonlyArray<readonly [SteerGateName, (s: Steer) => Offense | null]>;
```

`clear` iterates `GATES`, returns first `{status:"stop", gate, unit, reason}` or
`{status:"clear", cleared:[...STEER_GATE_NAMES]}`.

`forkGenuinenessGate` internal logic per fork (first failure wins):
1. `nonEmpty(question)` and `nonEmpty(whyItMatters)` — else "inconsequential" stop.
2. distinct non-blank options `D = unique(trim·lower of nonEmpty options)`; `D.size <
   MIN_FORK_OPTIONS` → "not a real trade-off" stop.
3. `options.length > MAX_FORK_OPTIONS` → "over-framed" stop.
4. `nonEmpty(recommendation)` — else "no recommendation" stop.

`renderFork` → a markdown block:
```
### Fork — <question>
- **Why it matters:** <whyItMatters>
- **Options:**
  1. <opt1>
  2. <opt2>
- **Vend recommends:** <recommendation>
```
`renderForks` → joins blocks with a blank line; empty list → `""`.

## 3. `src/play/steer-core.test.ts`

Imports `clear, renderFork, renderForks, STEER_GATE_NAMES, MIN/MAX_FORK_OPTIONS` + type-only
`Signal, Fork, Steer, SignalTier`. Helpers `mkSignal(tier, over)`, `mkFork(over)`,
`mkSteer(signals, forks)`. Describe blocks:
- **clear — grounded, leverage-ordered, genuine** → clear echoing all three names; empty
  steer → clear; board with no forks → clear.
- **read-never-invent** → blank-grounding signal → stop (gate name + "speculative").
- **fork-genuineness** → one-option / duplicate-options / blank-whyItMatters / blank-question
  / over-4-options / blank-recommendation each → stop (gate "fork-genuineness"); an EMPTY
  `forks[]` → clear (the abstention proof); a genuine 2-option fork → clear.
- **leverage-rank** → inversion → stop; drift member → `RangeError`.
- **renderFork/renderForks** → block carries question/options/recommendation; empty list → `""`.

## 4. `src/baml/steer-bridge.ts`

Mirror of survey-bridge.ts. `SteerBridgeOp = {mode:"render", project, charter} |
{mode:"parse", text}`. `SteerBridgeResult = {ok:true,mode:"render",prompt} |
{ok:true,mode:"parse",steer:Steer} | {ok:false,error}`. `runOp` calls `b.parse.SteerProject` /
`b.request.SteerProject` (+ imported `extractPromptText` from `decompose-bridge.ts`).
`import.meta.main` block reads stdin ops, writes `{results}`.

## 5. `src/baml/steer.test.ts`

Mirror of survey.test.ts. `runBridge(ops)` spawns the child. Canned reply = a steer with a
2-signal ranked board + 1 genuine fork. Ops: parse(canned), parse(object-no-fields),
parse(bare string), render(project, charter). Assert: canned → typed Steer (signals tiers
`Keystone`/`High`, fork question/options round-trip); the two garbage probes pin the REAL
degrade (expected: both DEGRADE to `{signals:[], forks:[]}` — two-array WorkPlan behavior; pin
whatever is observed); render → prompt contains project + charter sentinels + the surveyor/fork
framing.

## Ordering of changes

1. `baml_src/steer.baml` → `bun run baml:gen` (generates `Fork`/`Steer` in `baml_client`).
2. `src/play/steer-core.ts` (depends on generated types).
3. `src/play/steer-core.test.ts` (pure — runs without the addon).
4. `src/baml/steer-bridge.ts` then `src/baml/steer.test.ts` (the bridge test probes real SAP
   behavior; adjust the degrade assertion to observed reality).
5. `bun run check` (baml:gen → typecheck → test) green.

## Out of scope (T-018-02)

`src/play/steer.ts` (register `steerProjectPlay` + `castSteer`), `src/play/steer-effect.ts`
(staging the steer), `src/cli.ts` (`vend steer` gesture). No edits to those files here.
