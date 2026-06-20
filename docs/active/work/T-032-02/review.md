# T-032-02 — Review

Handoff for a human reviewer: what changed, how it's covered, what to watch. The ticket binds
per-play tool declarations to a **project** MCP registry, scopes them through the cast at least
privilege, andons honestly when a required capability is absent, and proves it on `decompose-epic`.

## What changed

**Created**
- `.mcp.json` (repo root) — the committed, portable project MCP registry. One server,
  `codebase-memory-mcp`, via `${CODEBASE_MEMORY_MCP_BIN:-codebase-memory-mcp}` (no secret, no
  absolute machine path; bare name on PATH is the default). The binding is now **project-based**,
  not the global `~/.claude.json`.
- `src/engine/mcp-registry.ts` — `parseMcpServerIds` (pure, total, tolerant) +
  `readProjectMcpServers(root)` (the one impure fs read). Absent/malformed ⇒ `[]` (the safe
  direction: declared plays then andon, undeclared pass through).
- `src/engine/mcp-registry.test.ts` — 6 parse cases.

**Modified**
- `src/engine/cast-core.ts` — `ToolFlags` + pure `toolFlags(resolved, path)`: the `ResolvedTools`
  → argv-flags projection (the live-proof's testable seam).
- `src/log/run-log.ts` — `RUN_OUTCOMES` gains `"missing-capability"`.
- `src/executor/claude.ts` — `DispenseOptions` gains `mcpConfig`/`allowedTools`/`strictMcp`;
  `dispense` forwards them to `buildArgs` (the conduit T-032-01 deliberately left closed).
- `src/engine/cast.ts` — `castPlay` resolves `play.tools` against the project registry **before**
  render/dispense; andons on `!ok`; spreads the resolved flags into `dispense`.
- `src/play/decompose-epic-core.ts` — `DECOMPOSE_TOOLS` (addon-free, the `DECOMPOSE_MAX_TURNS`
  precedent).
- `src/play/decompose-epic.ts` — `decomposeEpicPlay.tools = DECOMPOSE_TOOLS`.
- `src/engine/cast-core.test.ts` — `toolFlags` cases + the decompose live-proof argv block.

Commits: `68f8486` (foundation) → `63869c5` (wiring, dormant) → `bbb0740` (proof play).

## Acceptance criteria — status

| AC | Status | Evidence |
| --- | --- | --- |
| Portable project `.mcp.json` (incl. codebase-memory-mcp) + a reader for the `available` set; project-based not global | ✅ | `.mcp.json` + `mcp-registry.ts`; `${VAR:-default}` indirection; `~/.claude.json` project entry was `{}` |
| Cast resolves `tools` + threads flags; declared → scoped to only its servers; undeclared → byte-identical | ✅ | `cast.ts` resolve+thread; live proof [1]/[2]; full suite byte-identical at commit 2 (909 green, no opt-in yet) |
| Absent required MCP → amber missing-capability andon before dispense, nothing cast/materialized; surfaced like other refusals | ✅ | `cast.ts` `!ok` early-return; `missing-capability` outcome logged like `gate-failed`; live proof [3] |
| `decompose-epic` declares `tools: { mcp:[codebase-memory-mcp], allow:[…] }` | ✅ | `DECOMPOSE_TOOLS` + `decomposeEpicPlay.tools` |
| Live proof via argv inspection (no live cast); `bun run check:*` green | ✅ | `bun run` argv dump (progress.md); `tsc` clean, 912 pass / 0 fail |

## Test coverage

- **Pure, fully covered:** `parseMcpServerIds` (6 cases), `toolFlags` (6 cases), the decompose
  live-proof (3 cases — declared/passthrough/absent). These carry every AC provable without a cast.
- **Impure, NOT unit-tested (house pattern, by design):** `readProjectMcpServers` (its logic is
  the tested `parseMcpServerIds`), the `castPlay` resolve/andon/thread block, and `dispense`'s
  forwarding. Proven by `tsc`, the green full suite, and the live `bun run` over the real play.
- **Regression guard:** commit 2 landed the live path with no play declaring `tools`, so the
  entire suite ran the passthrough path and stayed byte-identical (909 green) — back-compat
  proven independently of the opt-in.
- Final suite: **912 pass / 0 fail**, `tsc --noEmit` clean.

### Gaps / what's not covered by an automated test
- **The `castPlay` andon branch end-to-end** (stdout line + the `appendRunLog` refusal record) is
  not unit-tested — `castPlay` is the untested impure shell. Its *decision* (`resolveTools`
  `{ok:false}`) and its *projection* (`toolFlags` → `{}`) are both tested; only the orchestration
  glue (print + log + early-return) is proven by inspection, consistent with how the existing
  budget/gate andons in `castPlay` are treated.
- **No live LLM cast** was run (AC #5 forbids it). Whether `--allowedTools mcp__codebase-memory-mcp`
  actually admits the server's tools at runtime rests on the `claude -p` flag contract verified in
  T-032-01's research, not on an executed cast here.

## Open concerns / notes for the reviewer

1. **`mcp__<id>` allowlist semantics (highest-value check).** The scoping correctness hinges on
   `--allowedTools mcp__codebase-memory-mcp` being the right wildcard to permit that server's tools
   under `--strict-mcp-config`. This is the one behavior a real cast (out of scope here) would
   confirm. If the CLI expects a different form (e.g. `mcp__server__tool` per-tool, or a different
   wildcard), only `toolFlags` (one pure line) and its tests change.
2. **Empty-declaration edge (`tools: {}`).** Resolves to strict with empty arrays ⇒
   `--strict-mcp-config` + empty `--allowedTools` (no flag) + no `--mcp-config`. Effect: the global
   firehose is closed and the agent gets default built-ins but no MCP. Deliberate (declaring `tools`
   opts into least privilege), documented, and not exercised by any current play.
3. **New `RunOutcome` ripple — verified nil.** `OutcomeMix` auto-seeds the key; `recalibrate`'s
   `CENSORED_OUTCOMES` correctly excludes it (a missing-cap refusal is not a finishing cost, like
   `gate-failed`); no exhaustive `switch` over `RunOutcome` exists. The present/ledger layers render
   it generically. A future kaizen could give it a dedicated glyph in the walk-away summary line.
4. **Portability assumption.** `${VAR:-default}` is Claude Code's documented `.mcp.json` expansion.
   On a machine where `codebase-memory-mcp` is not on PATH and `$CODEBASE_MEMORY_MCP_BIN` is unset,
   the server fails to launch at a real cast — but that is a runtime/env concern, not a committed-file
   portability defect (the file itself carries no machine-specific path).
5. **Scope cuts honored:** no `.vend/menu.json`/press changes, no skills injection
   (`PlayTools.skills` carried, never emitted), strict never flipped on for undeclared plays.

## Critical issues

None. No behavior regressions (back-compat byte-identical), no failing gates, the proof play casts
with exactly the declared scope, and an absent capability halts honestly before any spend.
</content>
