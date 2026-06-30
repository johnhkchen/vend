# T-062-03-02 — Structure

The blueprint. One new test file, one new record artifact, **no production-code change** anticipated.
Component boundaries, public interfaces touched (all imports — nothing exported is added), and the
ordering of changes.

## Files

### CREATE — `src/kitchen/kitchen-degrade.test.ts` (the confirm)

A new, addon-free test file dedicated to the graceful-degrade seam on the materialized kitchen seed.
Three `describe` blocks, each a layer of the AC, mirroring `init-kitchen.test.ts` + `cast.test.ts`.

**Imports (all addon-free):**
```ts
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../init/init-effect.ts";
import { readProjectMcpServers } from "../engine/mcp-registry.ts";
import { resolveTools, toolFlags } from "../engine/cast-core.ts";
import { castPlay } from "../engine/cast.ts";
import { DECOMPOSE_TOOLS } from "../play/decompose-epic-core.ts";
import { AUTONOMOUS_DENY } from "../play/autonomous-deny.ts";
import { reviveRecord } from "../log/run-log.ts";
import type { Play } from "../engine/play.ts";
import type { Budget } from "../budget/budget.ts";
import type { DispenseOptions, Executor, ResultMessage, StreamMessage } from "../executor/executor.ts";
```
(Confirm the exact `Executor`/`ResultMessage`/`StreamMessage`/`DispenseOptions` export surface from
`src/executor/executor.ts` during Implement — `cast.test.ts:9` is the reference import line.)

**Shared fixtures (file-local, the no-shared-util idiom):**
- `tmps: string[]` + `afterEach` cleanup + `async function tmp()` — the `cast.test.ts:16-24` pattern.
- `const CMM = "codebase-memory-mcp"` — the id under test, named once.
- `const BIG_BUDGET: Budget = { timeMs: 60_000, tokens: 1_000_000 }` — clears on the gate, not budget.
- `stubExecutor()` + `SAMPLE_STREAM` — copied thin from `cast.test.ts:56-81` (system/assistant/result).
- `degradeProbePlay(effectLog)` — a thin echo play (`render`/`parse`/`gates:clear`/`effect:noop`)
  whose ONLY real ingredient is `tools: DECOMPOSE_TOOLS`. NOT the real `decomposeEpicPlay` (addon).

**Block 1 — `the materialized kitchen seed ships no MCP registry (cold-start state is real)`:**
- scaffold: `await runInit(root, "kitchen")` into a fresh `tmp()`.
- `const { available } = await readProjectMcpServers(root)`.
- `expect(available).not.toContain(CMM)` and `expect(available).toEqual([])` (no `.mcp.json` at all).
- This is the load-bearing "on the real seed" pin: the scaffold is what produces the empty registry.

**Block 2 — `DECOMPOSE_TOOLS degrades against the scaffolded registry (no andon, read-only)`:**
- reuse a scaffolded root (re-scaffold in this block, or factor a `scaffoldKitchen()` helper).
- `const { available, path } = await readProjectMcpServers(root)`.
- `const resolved = resolveTools(DECOMPOSE_TOOLS, available)`.
- assert the **full degraded shape** (loud on regression):
  `expect(resolved).toEqual({ ok:true, strict:true, mcp:[], allowedTools:["Read","Grep","Glob"],
   deny:[...AUTONOMOUS_DENY], reducedGrounding:true })`.
- assert **no andon:** `expect(resolved.ok).toBe(true)` (the `ok:false` branch is the andon).
- assert the **read-only argv:** `const flags = toolFlags(resolved, path)`;
  `expect(flags.allowedTools).toEqual(["Read","Grep","Glob"])`, `expect(flags.strictMcp).toBe(true)`,
  `expect("mcpConfig" in flags).toBe(false)` (no server ⇒ no `--mcp-config`),
  `expect(flags.disallowedTools).toEqual([...AUTONOMOUS_DENY])`.

**Block 3 — `casting DECOMPOSE_TOOLS on the scaffolded seed clears with the reduced-grounding flag`:**
- scaffold a root; `const runLogPath = join(root, "runs.jsonl")`.
- `const summary = await castPlay(degradeProbePlay([]), { topic:"kitchen" }, BIG_BUDGET, {
   subject:"T-062-03-02-degrade", projectRoot: root, transcriptDir: root, runLogPath,
   executor: stubExecutor([]) })`.
- assert **completes, no andon:** `expect(summary.outcome).toBe("success")` (≠ `"missing-capability"`),
  `expect(summary.materialized).toBe(true)`.
- assert **flag set + survives revive:** read the single `runs.jsonl` line, `JSON.parse`, then
  `expect(rec.reducedGrounding).toBe(true)`; `expect(reviveRecord(rec)!.reducedGrounding).toBe(true)`.
- (optional) assert **no `missing-capability` record was written** anywhere in the log.

### CREATE — `docs/active/work/T-062-03-02/EXPECTED-OUTCOME.degrade.md` (the record)

The pending-capture degrade gold-master (T-062-03-01 form). Sections:
- **Banner:** `⚠️ NOT YET CAPTURED — PENDING THE HUMAN-AUTHORIZED METERED DRIVE (T-062-03-03)`.
- **The deterministic half (captured now, for free):** the resolved degrade shape from Block 2,
  transcribed as a proof block (scaffold ⇒ `available:[]` ⇒ `resolveTools(DECOMPOSE_TOOLS,[])` ⇒ strict
  read-only, `reducedGrounding:true`, no andon).
- **`What | Target | Actual (live)` table** with `⟪…⟫` slots: the live decompose `outcome`, the
  `runs.jsonl` `reducedGrounding:true` marker, and the asserted absence of any `missing-capability` row.
- **Re-run block:** the exact `vend init --template kitchen` → `vend steer` → `vend work` gestures
  T-062-03-03 will meter, with the env note that the cook repo has no codebase-memory-mcp installed.
- **Honest-on-outcome footer:** this records a *confirm* (the seam already degrades); the live half is
  an explicit pending slot, never a fabricated Actual.

### MODIFY — none anticipated

No `src` production change. The seam (`resolveTools`/`toolFlags`/`cast`/`run-log`) already implements
the degrade; the kitchen overlay (`kitchen-overlay.ts`) correctly ships no `.mcp.json`;
`DECOMPOSE_TOOLS` already declares `optionalMcp`. If Block 1/2/3 fail (they should not), that surfaces a
real gap and the structure flips to a fix — documented as a deviation in `progress.md`, not pre-planned.

## Module boundaries respected

- **Addon-free test:** every value import resolves to a pure or impure-but-addon-free module
  (`decompose-epic-core.ts`, `autonomous-deny.ts`, `cast-core.ts`, `cast.ts`, `mcp-registry.ts`,
  `init-effect.ts`, `run-log.ts`). The real `decomposeEpicPlay` (BAML addon) is **never** imported —
  only its tool contract (`DECOMPOSE_TOOLS`).
- **Engine ⊥ play:** the test injects the stub executor through `castPlay`'s existing seam; it adds no
  engine logic and no new export.
- **Record ownership:** the artifact is a degrade-only **component** under this ticket's work dir; it
  does not write into `examples/templates/kitchen-seed/` (the live capture and the epic-level
  `EXPECTED-OUTCOME.md` are T-062-03-03 / T-062-04-01).

## Ordering of changes

1. `kitchen-degrade.test.ts` Block 1 (scaffold-reality) — smallest, confirms the premise.
2. Block 2 (real-constant resolve/flags) — the pure degrade shape.
3. Block 3 (cast through stub) — the end-to-end marker.
4. `EXPECTED-OUTCOME.degrade.md` — transcribe Block 2's proven shape into the record.
5. `bun run check` green; commit.

Each step is independently verifiable; Blocks 1–3 are one file but commit as one atomic test addition.
