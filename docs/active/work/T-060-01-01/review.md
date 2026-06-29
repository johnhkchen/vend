# Review — T-060-01-01: graceful-degrade on absent codebase-memory-mcp

## What changed

Reclassified `codebase-memory-mcp` from a **required-STOP** MCP into an **optional grounding**
capability so a fresh seed without the MCP clears with reduced grounding instead of firing the
missing-capability andon. The flag rides the resolution result for the sibling ticket to
thread onto the run record.

### Files modified (5 source + artifacts), committed as `16c25e0`

| File | Change |
|------|--------|
| `src/engine/play.ts` | Added `optionalMcp?: readonly string[]` to `PlayTools` + doc. |
| `src/engine/cast-core.ts` | Added `reducedGrounding: boolean` to the strict `ResolvedTools` variant; `resolveTools` splits required vs optional, drops absent optionals, computes `reducedGrounding`; both doc-blocks updated. `toolFlags` unchanged. |
| `src/play/decompose-epic-core.ts` | `DECOMPOSE_TOOLS`: `mcp` → `optionalMcp` for `codebase-memory-mcp`; doc-block rationale (E-060 #3). |
| `src/play/decompose-epic.ts` | Comment at the `tools:` declaration updated from "andons before dispense" to the degrade truth. Comment-only. |
| `src/engine/cast-core.test.ts` | 3 strict `toEqual`s gained `reducedGrounding: false`; the `ABSENT MCP` live-proof **rewritten** as the AC test; +6 new tests (5 `resolveTools`, 1 `toolFlags`). |

No files created or deleted (besides the work artifacts). The run-log record shape was **not**
touched — that is T-060-01-02's surface.

## Acceptance criteria — met

> A test casts decompose with codebase-memory-mcp absent from the registry and asserts it
> completes with the reduced-grounding tools (read-only built-ins) instead of throwing the
> missing-capability andon at decompose-epic.ts:202-204; the absent case returns a
> reduced-grounding flag rather than halting.

✅ `cast-core.test.ts` — the rewritten *"ABSENT optional MCP … ⇒ DEGRADE w/ reduced grounding,
NOT andon"* test: `resolveTools(DECOMPOSE_TOOLS, [])` returns `{ ok:true, mcp:[],
allowedTools:["Read","Grep","Glob"], deny:["AskUserQuestion"], strict:true,
reducedGrounding:true }` (the **reduced-grounding flag**, not the `{ok:false}` andon), and the
projected argv carries the read-only built-ins + `--strict-mcp-config` with **no** `--mcp-config`
and **no** `mcp__codebase-memory-mcp` wildcard — it *completes with the reduced-grounding tools*.

## Test coverage

- **AC test**: the rewritten live-proof (resolution object + projected argv, both asserted).
- **Optional-MCP units** (new): present⇒scoped/false; absent⇒dropped/true; mix
  (required present + optional absent)⇒true; optional-only opts into strict (present &
  absent).
- **Regression guard** (new): `resolveTools({ mcp:["z"], optionalMcp:["a"] }, ["a"])` still
  returns `{ ok:false, missing:["z"] }` — reclassification did **not** erase the required-STOP
  capability (IA-17).
- **Back-compat**: present-case argv live-proof and the WIRING GUARD (deny → AskUserQuestion)
  stayed green unchanged; the 3 updated strict `toEqual`s prove the only behavioral delta is the
  added `reducedGrounding: false`.
- **Gate**: `tsc --noEmit` clean; `bun test` full suite **1333 pass / 0 fail** (81 files);
  `cast-core.test.ts` 51 pass / 0 fail.

### Coverage gaps (acknowledged, intentional)

- `castPlay` (impure orchestrator) is **not** unit-tested by design — its branching is
  unchanged (`resolved.ok` stays `true` on the degrade path, so the existing `if (!resolved.ok)`
  andon is simply skipped). The pure `resolveTools`/`toolFlags`/`buildArgs` chain fully covers
  the behavioral delta at the argv boundary. No new impure path was introduced, so no
  integration test is warranted (consistent with the E-007 pure-core discipline).
- No live cast against a real fresh seed in this ticket — that is the epic's closing LIVE
  re-drive (S-060-03), explicitly downstream.

## Open concerns / handoff notes

1. **T-060-01-02 depends on this and is now unblocked.** The `reducedGrounding: boolean` flag is
   surfaced on the strict `ResolvedTools` result. The sibling threads it from `castPlay`'s
   `resolved` onto the `runs.jsonl` record (and the revive/normalize boundary). This ticket
   deliberately did **not** add a run-log field nor a stdout note, to keep the record-shape
   change wholly in T-060-01-02. The flag is `false` on every fully-grounded strict result, so
   the sibling's "fully-grounded run does NOT write the marker" assertion holds.
2. **The honest live note** (epic: "log an honest reduced-grounding note") is not yet emitted to
   stdout. It naturally pairs with the run-record marker in T-060-01-02; flagged so it is not
   lost. If reviewers prefer it here, it is a one-line `process.stdout.write` in `castPlay`
   gated on `resolved.strict && resolved.reducedGrounding` — low risk, but it touches the impure
   shell, so it was left for the marker ticket.
3. **`scopes` now includes `optionalMcp`.** A play declaring *only* `optionalMcp` (no `mcp`/
   `allow`) opts into strict scoping — present⇒scoped, absent⇒strict-empty+reducedGrounding.
   This is the deliberate, consistent intent ("declaring any tool scoping closes the
   firehose"), pinned by a test. Decompose always declares `allow` too, so this edge does not
   affect it today; noted for any future optional-only play.

## Critical issues

None. The change is additive (optional interface field), behind a per-server reclassification,
with the required-STOP path preserved and proven by a regression test. Full gate green.
