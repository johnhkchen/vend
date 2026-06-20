# T-032-02 — Progress

Status: **complete**. Three commits, all gates green, live proof captured. Zero deviations from
the plan.

## Commits

| # | SHA | Title | Files |
| --- | --- | --- | --- |
| 1 | `68f8486` | project .mcp.json reader + toolFlags + missing-capability outcome | `.mcp.json`, `mcp-registry.ts`(+test), `cast-core.ts`(+test), `run-log.ts` |
| 2 | `63869c5` | cast-time tool resolution, andon, and seam threading | `claude.ts`, `cast.ts` |
| 3 | `bbb0740` | decompose-epic declares its tools — the proof play | `decompose-epic-core.ts`, `decompose-epic.ts`, `cast-core.test.ts` |

## What landed, per plan step

**Commit 1 (pure foundation + registry source):**
- `.mcp.json` at repo root — `codebase-memory-mcp` via `${CODEBASE_MEMORY_MCP_BIN:-codebase-memory-mcp}`
  (portable: no secret, no absolute machine path; bare-name default on PATH).
- `src/engine/mcp-registry.ts` — `parseMcpServerIds` (pure, tolerant: bad/absent ⇒ `[]`) +
  `readProjectMcpServers(root)` (impure; ENOENT ⇒ `{ available: [], path }`).
- `src/engine/mcp-registry.test.ts` — 6 parse cases (full / committed-shape / missing key /
  empty / malformed / non-object).
- `src/engine/cast-core.ts` — `ToolFlags` + pure `toolFlags(resolved, path)` (folds `mcp__<id>`
  into `allowedTools`; `--mcp-config` only when `mcp.length>0`).
- `cast-core.test.ts` — 6 `toolFlags` cases.
- `run-log.ts` — `RUN_OUTCOMES` gains `"missing-capability"` + doc.
- Gate: `tsc` clean, **909 pass / 0 fail**.

**Commit 2 (wire the live path, dormant):**
- `claude.ts` — `DispenseOptions` gains `mcpConfig?`/`allowedTools?`/`strictMcp?`; `dispense`
  forwards them into `buildArgs`.
- `cast.ts` — at the top of `castPlay` (before render/dispense): `readProjectMcpServers(root)` →
  `resolveTools(play.tools, available)`. On `!ok`: print the amber `· andon: missing-capability …`
  line, `appendRunLog` the refusal record (usage `{}`, cost 0, gates `[]`), early-return a
  `missing-capability` `RunSummary`. Else: `tflags = toolFlags(resolved, path)` spread into the
  `dispense` call.
- Gate: `tsc` clean, **909 pass / 0 fail** — no play declared `tools` at this commit, so every
  cast resolved passthrough ⇒ argv byte-identical (back-compat proven before any opt-in).

**Commit 3 (the proof play):**
- `decompose-epic-core.ts` — `DECOMPOSE_TOOLS: PlayTools = { mcp: ["codebase-memory-mcp"],
  allow: ["Read","Grep","Glob"] }` (addon-free home).
- `decompose-epic.ts` — `decomposeEpicPlay.tools = DECOMPOSE_TOOLS`.
- `cast-core.test.ts` — live-proof argv block (declared / passthrough / absent-MCP), importing
  `DECOMPOSE_TOOLS` from the addon-free core (no BAML in the test process).
- Gate: `tsc` clean, **912 pass / 0 fail**.

## Live proof (AC #5 — free, no LLM cast)

`bun run` over the REAL `decomposeEpicPlay` (plain bun process, BAML loads fine):

```
project .mcp.json available: [ "codebase-memory-mcp" ]
[1] DECLARED decompose-epic argv:
    -p --output-format stream-json --verbose --mcp-config /Volumes/ext1/swe/repos/vend/.mcp.json \
       --allowedTools Read,Grep,Glob,mcp__codebase-memory-mcp --strict-mcp-config
[2] PASSTHROUGH (undeclared) argv:
    -p --output-format stream-json --verbose
[3] ABSENT-registry ANDON: {"ok":false,"missing":["codebase-memory-mcp"]}
```

- [1] declared → all three scoping flags, `mcp__codebase-memory-mcp` in the allowlist ✓
- [2] undeclared → base argv, byte-identical to today ✓
- [3] absent registry → `{ ok:false, missing }` → `castPlay` andons before dispense ✓

The scratch script (`_proof.ts`) was run from the repo root and deleted; not committed.

## Deviations

None. The implementation followed structure.md / plan.md exactly. The only judgment call left
open at design time — whether to *log* the missing-capability andon — was resolved as designed
(D3: log it, for IA-10 ledger countability and parity with the other honest refusals), and the
new outcome's downstream ripple was confirmed nil (the `walk-away`/`recalibrate` suites stayed
green across all three commits).

## Note on ticket/work files

Per the RDSPI rules, the ticket's `phase`/`status` frontmatter was NOT touched — Lisa detects
these artifacts and advances the ticket. The `docs/active/work/T-032-02/` artifacts and the
ticket markdown are intentionally left uncommitted for Lisa to handle.
</content>
