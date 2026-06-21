# T-051-02 — Structure

File-level blueprint. Not code — the shape, the edit points, the public surface, the ordering. Five
source files (one new) + two test files.

## Files

| File | Change | What |
| --- | --- | --- |
| `src/play/autonomous-deny.ts` | **new** | The `AUTONOMOUS_DENY` constant (single source of truth). |
| `src/engine/play.ts` | modify | `PlayTools` gains `deny?: readonly string[]`. |
| `src/engine/cast-core.ts` | modify | `ResolvedTools` + `resolveTools` carry `deny`; discriminator change; `ToolFlags` + `toolFlags` emit `disallowedTools`. |
| `src/play/decompose-epic-core.ts` | modify | `DECOMPOSE_TOOLS` gains `deny: AUTONOMOUS_DENY`. |
| `src/play/propose-epic.ts` | modify | `proposeEpicPlay` gains `tools: { deny: AUTONOMOUS_DENY }`. |
| `src/engine/cast-core.test.ts` | modify | Update `{}`/skills-only cases; add deny resolution + live-proof argv cases (the AC oracle). |
| `src/play/decompose-epic.test.ts` *(or core test)* | modify (if present) | Assert `DECOMPOSE_TOOLS.deny` carries `AskUserQuestion`. |

No change to `src/engine/cast.ts`, `src/executor/claude.ts`, `src/play/work.ts`,
`src/play/chain-propose-decompose.ts` — they already plumb/forward `disallowedTools` and inherit the
plays' declarations (see research).

## 1. `src/play/autonomous-deny.ts` (new)

Addon-free module, one export:

```ts
/**
 * The interactive built-in tools made UNAVAILABLE on an AUTONOMOUS (headless `claude -p`) cast
 * (E-051). A piped agent has no answerer for AskUserQuestion, so an attempted call hangs the cast
 * until it resolves empty or the wall-clock latch kills the pane (E-049's stalled decompose). Denying
 * it via `--disallowedTools` makes the tool cleanly UNAVAILABLE so the agent proceeds autonomously.
 * Declared on the autonomous plays (propose-epic, decompose-epic); inherited by `vend work`/`vend
 * chain` because they cast those plays. Interactive/TUI plays do NOT declare it.
 */
export const AUTONOMOUS_DENY = ["AskUserQuestion"] as const;
```

Why a dedicated module: shared by propose-epic (impure) and decompose-epic-core (pure); a neutral
home avoids cross-play coupling and keeps the value off the generic engine.

## 2. `src/engine/play.ts` — `PlayTools`

Add to the interface (after `allow`, before/after `skills`):

```ts
/**
 * Built-in tools to make UNAVAILABLE → `--disallowedTools` (E-051). ORTHOGONAL to `allow`/`mcp`: a
 * subtractive filter that needs no allowlist and does NOT opt the cast into strict scoping — a
 * deny-only declaration stays passthrough. Empty/omitted ⇒ no flag. Set on the autonomous plays to
 * deny AskUserQuestion (no answerer on a piped cast). See AUTONOMOUS_DENY.
 */
readonly deny?: readonly string[];
```

Update the `PlayTools` doc-block to note `deny` is the subtractive sibling and does not imply strict.

## 3. `src/engine/cast-core.ts` — the resolution core

**`ResolvedTools`** (cast-core.ts:71) — add `deny: readonly string[]` to BOTH ok-variants:

```ts
export type ResolvedTools =
  | { readonly ok: true; readonly passthrough: true; readonly deny: readonly string[] }
  | { readonly ok: true; readonly mcp: …; readonly allowedTools: …; readonly deny: readonly string[]; readonly strict: true }
  | { readonly ok: false; readonly missing: readonly string[] };
```

`deny` is always present on a success (possibly `[]`), so downstream never branches on its existence.

**`resolveTools`** (cast-core.ts:87) — new body shape:

- `declared === undefined` → `{ ok:true, passthrough:true, deny: [] }`.
- else compute `deny = [...(declared.deny ?? [])]`; `required = declared.mcp ?? []`; `missing`.
- `missing.length` → `{ ok:false, missing }` (deny irrelevant on an andon).
- **strict iff `declared.mcp !== undefined || declared.allow !== undefined`** → strict result with
  `deny`. Otherwise → `{ ok:true, passthrough:true, deny }`.

Update the `ResolvedTools` doc-comment: the passthrough variant now also fires for a declaration that
scopes nothing (only `deny`/`skills`/`{}`), carrying any `deny`; "declared ≠ passthrough" is sharpened
to "scopes mcp/allow ⇒ strict."

**`ToolFlags`** (cast-core.ts:99) — add `readonly disallowedTools?: readonly string[]`.

**`toolFlags`** (cast-core.ts:124) — new shape:

```ts
if (!resolved.ok) return {};                       // andon (handled upstream) — defensive {}
const denyFlag = resolved.deny.length > 0 ? { disallowedTools: resolved.deny } : {};
if ("passthrough" in resolved) return { ...denyFlag };   // passthrough: deny only (or {} if none)
const allowedTools = [...resolved.allowedTools, ...resolved.mcp.map((id) => `mcp__${id}`)];
return {
  ...(resolved.mcp.length > 0 ? { mcpConfig: mcpConfigPath } : {}),
  allowedTools,
  strictMcp: true,
  ...denyFlag,
};
```

Doc-comment: passthrough now emits `disallowedTools` when the play declared `deny` (else `{}`);
strict appends `disallowedTools` after the allow/strict flags. Ordering into the argv is `buildArgs`'
concern (deny after allow, before strict — already pinned by T-051-01).

## 4. `src/play/decompose-epic-core.ts` — `DECOMPOSE_TOOLS`

Import `AUTONOMOUS_DENY`; add `deny: AUTONOMOUS_DENY` to the literal:

```ts
export const DECOMPOSE_TOOLS: PlayTools = {
  mcp: ["codebase-memory-mcp"],
  allow: ["Read", "Grep", "Glob"],
  deny: AUTONOMOUS_DENY,   // E-051: AskUserQuestion has no answerer on a piped cast
};
```

Extend the doc-comment with a `deny` bullet.

## 5. `src/play/propose-epic.ts` — `proposeEpicPlay`

Import `AUTONOMOUS_DENY`; add a `tools` field to the play literal (it had none):

```ts
// E-051: deny AskUserQuestion on this autonomous cast. deny-only ⇒ stays scoping-passthrough
// (no --allowedTools/--strict-mcp-config), so propose-epic keeps its global MCP set; it only
// makes the unanswerable interactive tool unavailable.
tools: { deny: AUTONOMOUS_DENY },
```

Place beside `budget`/`card`, mirroring decompose-epic's `tools:` placement.

## 6. Tests

**`src/engine/cast-core.test.ts`:**

- Update `resolveTools({}, …)` and `resolveTools({skills:[…]}, …)` expectations: now passthrough with
  `deny: []` (were strict-empty). Add the rationale in the test name/comment.
- Update existing strict-result expectations to include `deny: []` (every ok result now carries it).
- Update `toolFlags(resolveTools({}, …))` / skills-only expectations: now `{}` (passthrough, no deny).
- **New — deny resolution:** `resolveTools({deny:["AskUserQuestion"]}, avail)` ⇒
  `{ ok:true, passthrough:true, deny:["AskUserQuestion"] }`; with mcp+allow+deny ⇒ strict carrying deny.
- **New — deny projection:** `toolFlags` of a deny-only passthrough ⇒ `{ disallowedTools:["AskUserQuestion"] }`;
  of strict+deny ⇒ the strict flags PLUS `disallowedTools`.
- **New — the AC live-proof argv test (PURE):**
  - autonomous strict: `buildArgs(toolFlags(resolveTools(DECOMPOSE_TOOLS, AVAILABLE), PATH))` CONTAINS
    `--disallowedTools` followed by `AskUserQuestion`.
  - autonomous passthrough: `buildArgs(toolFlags(resolveTools({deny:AUTONOMOUS_DENY}, AVAILABLE), PATH))`
    CONTAINS `--disallowedTools AskUserQuestion` and NOT `--allowedTools`/`--strict-mcp-config`.
  - interactive: `buildArgs(toolFlags(resolveTools(undefined, AVAILABLE), PATH))` does NOT contain
    `--disallowedTools` and equals the base argv (byte-identical).

**Play-declaration assertion (decompose-epic.test.ts or decompose-epic-core via cast-core.test.ts):**
assert `DECOMPOSE_TOOLS.deny` includes `"AskUserQuestion"` and `proposeEpicPlay`-shaped `{deny:…}`
carries it — guards the wiring so a future edit can't silently drop the denylist. (propose-epic's play
object loads BAML; assert the shape via `AUTONOMOUS_DENY` + the resolution test rather than importing
the impure module into a bun-test process.)

## Ordering of changes (atomic-commit boundaries)

1. **Pure plumbing:** new `autonomous-deny.ts` + `PlayTools.deny` + `cast-core.ts`
   (`ResolvedTools`/`resolveTools`/`ToolFlags`/`toolFlags`) + cast-core.test.ts updates & new pure
   cases. Self-contained, fully unit-tested, no behavior change for any existing play yet.
2. **Wire the autonomous plays:** `DECOMPOSE_TOOLS.deny` + `proposeEpicPlay.tools` + the
   declaration-assertion test. This is the slice that flips the autonomous casts' argv.

Each step keeps the suite green; the gate (`bun test`, `bun run build`) runs after each.
