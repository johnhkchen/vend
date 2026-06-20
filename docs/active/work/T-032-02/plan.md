# T-032-02 — Plan

Three atomic commits, each compiling + full-suite green before the next. Mirrors T-032-01's
"pure foundation first, wire last" sequencing, adapted to this ticket's impure half.

## Testing strategy

- **Pure, unit-tested:** `parseMcpServerIds` (mcp-registry.test.ts), `toolFlags` + the decompose
  live-proof + andon-proof (cast-core.test.ts). These carry the ACs that can be proven without a
  cast.
- **Impure, NOT unit-tested (house pattern):** `readProjectMcpServers` (fs read), the `castPlay`
  resolve/andon/thread block, `dispense` forwarding. Their *logic* is the pure helpers above;
  their *wiring* is proven by the live-proof argv test + `tsc` + the green full suite.
- **Regression guard:** the passthrough argv test (undeclared play emits no tool flags) + the
  existing `buildArgs`/`cast-core` suites staying green = back-compat byte-identity.
- **Live proof (AC #5, free, no cast):** a `bun run` one-liner importing `decomposeEpicPlay` and
  printing `buildArgs(toolFlags(resolveTools(play.tools, available), path))` for three cases
  (declared / undeclared / absent-MCP), captured in `progress.md`. The pure test covers the same
  via `DECOMPOSE_TOOLS`; the script proves the real play hangs it on the contract.
- Gate per commit: `bun run check:typecheck && bun test` green (the `check:*` AC).

## Commit 1 — registry source + pure helpers + outcome vocab

**Files:** `.mcp.json` (new), `src/engine/mcp-registry.ts` (new),
`src/engine/mcp-registry.test.ts` (new), `src/engine/cast-core.ts` (+`ToolFlags`/`toolFlags`),
`src/engine/cast-core.test.ts` (+`toolFlags` cases), `src/log/run-log.ts` (+`missing-capability`).

**Steps:**
1. Write `.mcp.json` (portable, codebase-memory-mcp via `${VAR:-default}`).
2. Write `mcp-registry.ts` — `parseMcpServerIds` (pure) + `readProjectMcpServers` (impure).
3. Write `mcp-registry.test.ts` — 5 parse cases (full / missing key / malformed / empty / order).
4. Add `ToolFlags` + `toolFlags` to `cast-core.ts` (re-exported via `cast.ts`).
5. Add `toolFlags` unit cases to `cast-core.test.ts` (passthrough/!ok/strict+mcp/strict-allow-only/empty).
6. Append `"missing-capability"` to `RUN_OUTCOMES`; update its doc-comment.

**Verify:** `tsc --noEmit` clean; `bun test` green (new tests pass; `walk-away`/`recalibrate`
suites still green with the new outcome key — confirms low ripple). Nothing wired into the live
path yet, so existing behavior is unchanged.

**Why this is atomic:** pure additions + a config file + a vocabulary entry. No call site
consumes them yet; the suite proves they're self-consistent.

## Commit 2 — thread the conduit + wire the cast path

**Files:** `src/executor/claude.ts` (`DispenseOptions` + `dispense` forwarding),
`src/engine/cast.ts` (resolve at top, andon on `!ok`, thread `tflags` into `dispense`).

**Steps:**
1. `claude.ts`: add `mcpConfig?`/`allowedTools?`/`strictMcp?` to `DispenseOptions`; forward them
   in `dispense`'s `buildArgs` call.
2. `cast.ts`: import `readProjectMcpServers`; extend the `cast-core.ts` named import with
   `resolveTools`, `toolFlags`.
3. `cast.ts`: after `runId`, before `render`: read registry, `resolveTools(play.tools, available)`;
   on `!ok` print the amber andon line, `appendRunLog` the `missing-capability` record, return.
4. `cast.ts`: compute `tflags = toolFlags(resolved, mcpConfigPath)`; spread into the `dispense` call.

**Verify:** `tsc` clean; `bun test` green. **Critically:** no play declares `tools` yet at this
commit (decompose still undeclared), so every cast resolves passthrough ⇒ `tflags = {}` ⇒ argv
byte-identical ⇒ all existing tests green. The live path is wired but dormant — back-compat
proven before any play opts in.

**Why this is atomic:** the engine can now scope + andon, but with no declaring play the behavior
is identical to today. A clean "capability added, dormant" commit (the T-032-01 review's own
pattern).

## Commit 3 — the proof play declares its tools

**Files:** `src/play/decompose-epic-core.ts` (+`DECOMPOSE_TOOLS`),
`src/play/decompose-epic.ts` (`tools: DECOMPOSE_TOOLS`),
`src/engine/cast-core.test.ts` (+ live-proof argv test + andon-proof, via `DECOMPOSE_TOOLS`).

**Steps:**
1. `decompose-epic-core.ts`: export `DECOMPOSE_TOOLS: PlayTools = { mcp: ["codebase-memory-mcp"],
   allow: ["Read","Grep","Glob"] }` with doc-comment.
2. `decompose-epic.ts`: import `DECOMPOSE_TOOLS`, add `tools: DECOMPOSE_TOOLS` to the play literal.
3. `cast-core.test.ts`: import `DECOMPOSE_TOOLS` from the core; assert the built argv (declared
   shows all three flags incl. `mcp__codebase-memory-mcp`; passthrough shows none; absent-MCP →
   `{ ok:false }`).

**Verify:** `tsc` clean; `bun test` green. Then the **live-proof script** (`bun run` importing
the real `decomposeEpicPlay`) to confirm the play — not just the core constant — produces the
scoping argv, and an absent registry produces the andon. Capture output in `progress.md`.

**Why this is atomic + last:** the proof play opting in is the visible behavior change; isolating
it last means a bisect pinpoints any decompose-specific regression to this one commit, and the
prior two commits are reusable infrastructure independent of this play.

## Risks / mitigations

- **New `RunOutcome` ripple.** Mitigated: surveyed in Research — `OutcomeMix` auto-seeds the key,
  `recalibrate` correctly excludes it from `CENSORED_OUTCOMES`, no exhaustive switch exists.
  Commit 1's green suite confirms.
- **`--allowedTools` over-restriction.** If the `mcp__<id>` wildcard form is wrong, the agent
  would be denied its MCP tools at a real cast. Mitigated at the argv level by the live proof;
  the actual tool-permission semantics are a `claude -p` contract verified in T-032-01's flag
  research. (A real cast is out of scope per AC #5 "no live LLM cast.")
- **Portability of `.mcp.json`.** `${VAR:-default}` is Claude Code's documented expansion; the
  bare-name default keeps it working on any machine with the binary on PATH. No secret committed.
- **Andon double-logging.** The early-return guarantees the andon's `appendRunLog` is the *only*
  log call on that path (the main append is past the return). No duplicate record.
</content>
