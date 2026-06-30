# T-062-03-02 — Progress

## Status: implementation complete, gate green

The graceful-degrade seam is **confirmed to already hold on the materialized kitchen seed**. As Design
anticipated, this was a **confirm-and-record** ticket — **no production code change** was needed.

## What was done (vs. the plan)

| Step | Plan | Outcome |
|---|---|---|
| 1 | Block 1 — scaffold-reality pin | ✅ `runInit(root,"kitchen")` ⇒ `readProjectMcpServers(root).available === []` (no `.mcp.json` shipped) |
| 2 | Block 2 — real-constant resolve + flags | ✅ `resolveTools(DECOMPOSE_TOOLS, [])` ⇒ strict, `mcp:[]`, read-only allow, `reducedGrounding:true`, `ok:true`; `toolFlags` ⇒ no `mcpConfig` |
| 3 | Block 3 — cast through the stub | ✅ `castPlay` on the scaffolded root ⇒ `outcome:"success"`, `materialized:true`, `runs.jsonl` `reducedGrounding:true`, survives `reviveRecord` |
| 4 | Full gate | ✅ `bun run check` — **1479 pass, 1 skip, 0 fail**; typecheck clean |
| 5 | Record artifact | ✅ `EXPECTED-OUTCOME.degrade.md` — free half captured, metered half pending T-062-03-03 |
| 6 | Commit | ✅ test + work artifacts committed |

## Files

- **CREATE** `src/kitchen/kitchen-degrade.test.ts` — 3 addon-free blocks (scaffold-reality, real
  `DECOMPOSE_TOOLS` resolve/flags, cast through the stub on the real seed). 19 `expect()` calls.
- **CREATE** `docs/active/work/T-062-03-02/EXPECTED-OUTCOME.degrade.md` — the pending-capture degrade
  gold-master (T-062-03-01 form).
- **CREATE** the six RDSPI artifacts under `docs/active/work/T-062-03-02/`.
- **MODIFY** none in `src/` production code (as anticipated).

## Deviations from plan

- **None of substance.** The optional `scaffoldKitchen()` helper (Plan Step 2 noted as optional) was
  factored — three blocks each scaffold a fresh root through it, keeping the guarded-live teardown in
  one `afterEach`. The "deliberately temp-break to confirm the pin bites" check (Step 2 verify) was
  done locally and reverted; not committed.
- The cast (Block 3) confirmed the seam emits the honest stdout line
  `· reduced grounding — optional codebase-memory MCP absent; proceeding (degraded, recorded)` —
  transcribed into the record artifact as observed behavior.

## Why no production change

- The kitchen overlay (`src/kitchen/kitchen-overlay.ts`) + base scaffold (`init-core.ts`) ship **no
  `.mcp.json`** — confirmed by Block 1. So a fresh cook repo's registry is genuinely empty.
- `decomposeEpicPlay` already declares `optionalMcp: ["codebase-memory-mcp"]` (E-060 #3,
  `DECOMPOSE_TOOLS`), so the absent server **degrades, never andons**.
- E-060 already built + tested the resolve/flags/cast/run-log mechanism. This ticket binds that
  mechanism to the **real seed + real constant** (closing the "spike/mirror" substitutions the prior
  tests left open) and **records** the gold-master.

## Open items handed forward

- **T-062-03-03** — the human-authorized metered `vend steer` → `vend work` drive that fills the
  `⟪…⟫` slots in `EXPECTED-OUTCOME.degrade.md` (the live `reducedGrounding:true` line + the
  zero-`missing-capability` assertion).
- **T-062-04-01** — rolls this degrade component into the full epic-level `EXPECTED-OUTCOME.md`.
