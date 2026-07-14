# Structure — T-060-01-01: file-level blueprint

Four source files modified, one test file modified. No files created or deleted. The change
is small and confined to the tool-resolution pipeline; ordering matters only so the type/data
land before the tests assert them.

## 1. `src/engine/play.ts` — extend the `PlayTools` contract

**Modify** the `PlayTools` interface (currently `play.ts:135-140`). Add one field, with a
doc-comment in the established voice:

```ts
export interface PlayTools {
  readonly mcp?: readonly string[];          // REQUIRED servers — absent ⇒ missing-capability andon
  readonly optionalMcp?: readonly string[];  // OPTIONAL servers — absent ⇒ degrade w/ reducedGrounding, not andon
  readonly allow?: readonly string[];
  readonly deny?: readonly string[];
  readonly skills?: readonly string[];
}
```

Comment must state: declaring `optionalMcp` opts the cast into strict scoping (same as `mcp`/
`allow`); a present optional server is scoped exactly like a required one; an absent optional
server is dropped from the scoped set and flips the resolution's `reducedGrounding` flag —
the make-or-break path proceeds with reduced grounding rather than halting (E-060 finding #3,
P2/P5). No behavior change for plays that don't declare it.

Public interface change only — additive, backward-compatible (optional field).

## 2. `src/engine/cast-core.ts` — the resolution + result type

**Modify** the `ResolvedTools` strict variant (`cast-core.ts:75-78`). Add
`reducedGrounding: boolean` to the strict success member only:

```ts
| { readonly ok: true; readonly mcp: readonly string[]; readonly allowedTools: readonly string[];
    readonly deny: readonly string[]; readonly strict: true; readonly reducedGrounding: boolean }
```
The `passthrough` and `{ ok:false }` variants are unchanged. Update the `ResolvedTools`
doc-block (`cast-core.ts:59-74`) to describe `reducedGrounding`.

**Modify** `resolveTools` (`cast-core.ts:95-108`). New internal logic, same signature:
- `required = declared.mcp ?? []`; `missing = required.filter(absent)`; if non-empty ⇒
  `{ ok:false, missing }` (UNCHANGED — required andon preserved).
- `optional = declared.optionalMcp ?? []`; `presentOptional = optional.filter(present)`;
  `absentOptional = optional.filter(absent)`; `reducedGrounding = absentOptional.length > 0`.
- `scopes = declared.mcp !== undefined || declared.allow !== undefined ||
  declared.optionalMcp !== undefined`.
- not scopes ⇒ `{ ok:true, passthrough:true, deny }` (UNCHANGED for `{}`/`{skills}`/`{deny}`).
- scopes ⇒ `{ ok:true, mcp:[...required, ...presentOptional], allowedTools:[...allow],
  deny, strict:true, reducedGrounding }`. Fresh arrays (no aliasing the frozen literals) —
  the existing discipline; `[...required, ...presentOptional]` is already a fresh array.

Update the `resolveTools` doc-block (`cast-core.ts:80-94`) to add the optional-MCP outcome.

**`toolFlags` (`cast-core.ts:145-156`) — NO change.** It reads `resolved.mcp` (which now
excludes absent optionals) and ignores the new `reducedGrounding` field. The `mcpConfig`
guard `resolved.mcp.length > 0` already omits `--mcp-config` when the scoped set is empty —
exactly the degraded shape. Verified by inspection; pinned by a new test, not a code edit.

## 3. `src/play/decompose-epic-core.ts` — reclassify the declaration

**Modify** `DECOMPOSE_TOOLS` (`decompose-epic-core.ts:68-72`): move `codebase-memory-mcp`
from `mcp` to `optionalMcp`. Update the doc-block (`decompose-epic-core.ts:51-67`) so the
`mcp:` bullet becomes an `optionalMcp:` bullet, stating the reclassification: present ⇒
scoped in; **absent ⇒ degrade with reduced grounding, NOT andon** (E-060 #3). Keep `allow`
and `deny` bullets as-is.

```ts
export const DECOMPOSE_TOOLS: PlayTools = {
  optionalMcp: ["codebase-memory-mcp"],
  allow: ["Read", "Grep", "Glob"],
  deny: AUTONOMOUS_DENY,
};
```

## 4. `src/play/decompose-epic.ts` — update the inline comment

**Modify** the comment at `decompose-epic.ts:202-204` (the line the ticket names). Replace
*"a project registry missing codebase-memory-mcp andons before dispense"* with the new truth:
codebase-memory-mcp is now an OPTIONAL grounding server — present ⇒ scoped in; absent ⇒ the
cast proceeds with reduced grounding (read-only built-ins) and flags it, NOT an andon. No code
change here (`tools: DECOMPOSE_TOOLS` is unchanged) — comment-only, to keep the source honest.

## 5. `src/engine/cast-core.test.ts` — the AC test + expectation updates

**Modify** three existing strict-result `toEqual`s to add `reducedGrounding: false`:
- line 163-172 (`declared + all required mcp present`),
- line 185-193 (`allow only, no mcp`),
- line 210-218 (`mcp + allow + deny`).
The fresh-array test (220-228) needs the `"strict" in r` guard to still hold — unaffected.

**Rewrite** the `ABSENT MCP` live-proof test (`cast-core.test.ts:317-322`) — this is the
**AC test**. New assertions:
- `resolveTools(DECOMPOSE_TOOLS, [])` returns
  `{ ok:true, mcp:[], allowedTools:["Read","Grep","Glob"], deny:["AskUserQuestion"],
     strict:true, reducedGrounding:true }` — i.e. a degraded strict result, **not** an andon.
- `buildArgs(toolFlags(resolved, PATH))` carries `--allowedTools Read,Grep,Glob`,
  `--disallowedTools AskUserQuestion`, `--strict-mcp-config`, and does **NOT** contain
  `--mcp-config` nor `mcp__codebase-memory-mcp`.

**Add** focused `resolveTools`/`toolFlags` tests for the optional-MCP concept:
- optional present ⇒ scoped in `mcp`, `reducedGrounding:false`;
- optional absent ⇒ dropped, `reducedGrounding:true`;
- required absent still andons (`{ ok:false, missing }`) — a regression guard that the
  required path survives;
- optional-only declaration (no `allow`/`mcp`) present ⇒ strict; absent ⇒ strict, mcp `[]`,
  reducedGrounding true (opts into strict either way).

**Update** the present-case live-proof (`cast-core.test.ts:301-310`) only if its `toEqual`
shape changed — it asserts argv membership (`toContain`/index), not the resolution object, so
it stays green with `optionalMcp` (codebase-memory-mcp present ⇒ still scoped). Verify, don't
pre-edit.

## Ordering of changes

1. `play.ts` (the type) → 2. `cast-core.ts` (the result type + resolver) →
3. `decompose-epic-core.ts` (the declaration) → 4. `decompose-epic.ts` (comment) →
5. tests. Type-before-use so `tsc` stays green at each step; tests last so they assert the
final shape.

## Module boundaries preserved

- Engine ⊥ play: all engine edits are in `src/engine/`; the declaration edit is in
  `src/play/`. No new edge.
- Pure/impure split: every behavioral edit is in a PURE module (`play.ts` type,
  `cast-core.ts`, `decompose-epic-core.ts`); `castPlay` (impure) is untouched by the AC.
- The run-log record shape is NOT touched — that is T-060-01-02's surface.
