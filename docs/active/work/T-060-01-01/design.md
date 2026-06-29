# Design — T-060-01-01: graceful-degrade on absent codebase-memory-mcp

## Decision

Introduce an **optional-MCP** concept in tool resolution. Add `optionalMcp?: readonly
string[]` to `PlayTools`. Move `codebase-memory-mcp` from `DECOMPOSE_TOOLS.mcp` (required)
to `DECOMPOSE_TOOLS.optionalMcp`. Extend `resolveTools` so an **absent optional** MCP does
NOT andon: it is dropped from the scoped set and the strict result carries a
`reducedGrounding: boolean` flag. A **present** optional MCP is scoped exactly as a required
one is today (byte-identical argv). A missing *required* MCP still andons (unchanged).

## Why this, evaluated against the codebase

The ticket and epic pin three hard constraints the choice must satisfy:
1. the degrade stays *"a missing-optional-capability branch where tool-resolution already
   lives — not a new andon path"* (epic);
2. the signal must be *"countable, not invisible"* — a flag the sibling ticket (T-060-01-02)
   threads onto the run record;
3. engine ⊥ play, pure-core discipline, and present-case byte-identical back-compat.

`resolveTools` (`cast-core.ts:95-108`) is the single pure place required + available are
already reconciled. Adding the optional split there keeps the decision in one tested function
and keeps `castPlay` (impure) untouched in its branching — `resolved.ok` simply stays `true`
on the absent-optional path, so the existing `if (!resolved.ok)` andon (`cast.ts:148`) is
naturally skipped. No new code path in the orchestrator.

## Options considered

### Option A — `optionalMcp` field + `reducedGrounding` flag on the strict result *(CHOSEN)*

Resolution becomes:
```
required  = declared.mcp ?? []
missingReq = required - available        → if non-empty ⇒ { ok:false, missing } (andon, unchanged)
optional  = declared.optionalMcp ?? []
presentOpt = optional ∩ available
absentOpt  = optional - available
scopes    = mcp || allow || optionalMcp declared
strict result:
  mcp = [...required, ...presentOpt]      // only servers actually available are scoped
  reducedGrounding = absentOpt.length > 0
```
- **Pros**: the optional/required distinction is explicit and reusable by any future play;
  present-case argv is byte-identical (codebase-memory-mcp present ⇒ still in `mcp`, still
  emits `--mcp-config` + the `mcp__` wildcard); the flag is a clean boolean the sibling
  threads; lives entirely in the pure core; no andon-path change.
- **Cons**: touches the `ResolvedTools` strict variant shape ⇒ existing strict `toEqual`
  tests must add `reducedGrounding: false`. Acceptable: deliberate, mechanical, and the
  house already carries `deny: []` explicitly (same "always-present field" discipline).
- **Risk**: low. The `mcp` field on the strict result already drives `toolFlags`; excluding
  absent optionals from it means `toolFlags` needs **no change** — it reads `resolved.mcp`,
  which now simply omits the absent server.

### Option B — keep `mcp` required, add a per-cast `--degrade`/override flag

Resolve as today (andon), but let the caller pass an override that downgrades the andon to a
degraded run.
- **Rejected**: the epic explicitly defers a "decompose-time override" as a *future* revisit
  and chose graceful-degrade as the default. An override still andons by default, so a fresh
  seed *still* halts unless the user knows the flag — fails the P2/P5 onboarding goal. Also
  pushes logic into the impure caller, away from the tested pure core.

### Option C — overload `mcp` semantics (treat any absent declared MCP as optional)

Drop the andon entirely: any missing declared MCP degrades.
- **Rejected**: erases the *required-STOP* capability the andon exists for (IA-17: "a
  required capability absent is a STOP, not a silent blind run on the wrong tool set"). A
  future play that genuinely needs an MCP would silently run wrong. The required/optional
  distinction must remain expressible. Reclassification must be **per-server intent**, not a
  global policy flip.

### Option D — boolean `reducedGrounding` omitted-when-false (vs always-present)

A sub-decision within Option A: should the strict result carry `reducedGrounding: false`
explicitly, or omit it when false?
- **Chosen: always-present `reducedGrounding: boolean`.** Mirrors the existing `deny: []`
  always-present discipline on the same variant, and gives the sibling ticket a total field
  to read without an `in` check. The cost (updating ~3 existing strict `toEqual`s) is small
  and mechanical. Omitting-when-false would keep those tests green but make the field a
  partial the consumer must probe — worse for the downstream record marker.

## Shape of the chosen change

`PlayTools` (`play.ts`):
```ts
readonly optionalMcp?: readonly string[];   // present ⇒ scoped; absent ⇒ degrade, not andon
```

`ResolvedTools` strict variant (`cast-core.ts`):
```ts
{ ok: true; mcp; allowedTools; deny; strict: true; reducedGrounding: boolean }
```
`passthrough` variant is unchanged (an undeclared/scopes-nothing play is never reduced — it
inherits the global firehose, which already includes whatever MCP exists). Only the strict
result carries the flag.

`resolveTools` gains the optional split (above). `scopes` includes `optionalMcp !== undefined`
so a play declaring only an optional MCP still opts into strict (consistent intent: declaring
any tool scoping closes the firehose). `reducedGrounding` is `false` whenever there are no
absent optionals — including the no-optional-declared case, so every present strict result
reads `false`.

`DECOMPOSE_TOOLS` (`decompose-epic-core.ts`):
```ts
export const DECOMPOSE_TOOLS: PlayTools = {
  optionalMcp: ["codebase-memory-mcp"],   // was: mcp
  allow: ["Read", "Grep", "Glob"],
  deny: AUTONOMOUS_DENY,
};
```

## Behavior matrix (the contract the tests pin)

| `available`                 | resolution                                                                 | argv                                                           |
|-----------------------------|----------------------------------------------------------------------------|----------------------------------------------------------------|
| `["codebase-memory-mcp"]`   | strict, mcp=`["codebase-memory-mcp"]`, reducedGrounding **false**           | `--mcp-config … --allowedTools Read,Grep,Glob,mcp__codebase-memory-mcp --disallowedTools AskUserQuestion --strict-mcp-config` (byte-identical to today) |
| `[]` (fresh seed)           | strict, mcp=`[]`, allowedTools=`["Read","Grep","Glob"]`, reducedGrounding **true** | `--allowedTools Read,Grep,Glob --disallowedTools AskUserQuestion --strict-mcp-config` (no `--mcp-config`, no `mcp__` wildcard) |
| required MCP absent (other play) | `{ ok:false, missing }` (andon, **unchanged**)                       | base argv (defensive `{}`)                                     |

## castPlay (impure) — minimal honest surface

`resolved.ok` is `true` on the degrade path, so `castPlay` proceeds to dispense with the
reduced flags automatically — no orchestration change required by the AC. Optionally emit one
honest stdout note when `resolved.strict && resolved.reducedGrounding` (mirroring the andon's
stdout line) so the degrade is visible live. The **run-log record field is deferred to
T-060-01-02** — this ticket does not touch `appendRunLog`'s payload.

## What the AC test asserts

`resolveTools(DECOMPOSE_TOOLS, [])` returns a strict result with `reducedGrounding: true` and
`allowedTools: ["Read","Grep","Glob"]` (no `mcp`), and the projected argv carries the
read-only built-ins + `--strict-mcp-config` but NO `--mcp-config` and NO andon — i.e. it
*completes with reduced grounding* instead of halting. The present case stays byte-identical.
