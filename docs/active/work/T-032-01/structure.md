# T-032-01 — Structure

The file-level blueprint. Three source files modified, two test files extended. No files
created, none deleted. Ordering matters only in that `PlayTools` (in `play.ts`) must exist
before `cast-core.ts` imports it — but a single typecheck pass covers all edits together.

## Changeset overview

| File | Change | Why |
|------|--------|-----|
| `src/engine/play.ts` | **modify** — add `PlayTools` interface + `tools?` field on `Play` | the contract declaration (D1) |
| `src/executor/claude.ts` | **modify** — widen `buildArgs` options + 3 guarded pushes | the seam flags (D2) |
| `src/engine/cast-core.ts` | **modify** — import `PlayTools`, add `ResolvedTools` + `resolveTools` | the pure resolver (D3) |
| `src/executor/claude.test.ts` | **modify** — add tool-flag `buildArgs` cases | seam unit tests |
| `src/engine/cast-core.test.ts` | **modify** — add `resolveTools` three-variant cases | resolver unit tests |

No change to: `src/engine/cast.ts` (the impure orchestrator — re-exports `cast-core` via
`export *`, so `resolveTools`/`ResolvedTools` surface automatically; no edit needed), the six
concrete plays (`src/play/*.ts` — `tools?` is optional, they stay assignable), `dispense`/
`DispenseOptions` (T-032-02).

## File 1 — `src/engine/play.ts`

**Add** a `PlayTools` interface in the contract section. Placement: a new doc-commented block
immediately before the `Play` interface (after the `EffectResult` block, ~line 113), so the
type is defined before the field that uses it.

```ts
// ── Per-play tool provisioning (E-032) ───────────────────────────────────────
export interface PlayTools {
  readonly mcp?: readonly string[];
  readonly allow?: readonly string[];
  readonly skills?: readonly string[];
}
```

Doc-comment states: `mcp` = required server ids (absent at cast ⇒ andon, T-032-02); `allow` =
built-in tool allowlist; `skills` = forward-compatible, wiring deferred this slice.

**Add** the field on `Play<I, O>` — a new `readonly tools?: PlayTools;` member inside the
interface, documented in the same style as `maxTurns?` (a per-play sibling resolved at cast,
threaded to the seam; omitted ⇒ passthrough/unchanged). Placed adjacent to `maxTurns?` (after
line 157, before `card`).

**No import changes** — `PlayTools` is self-contained (string arrays). Purity preserved.

## File 2 — `src/executor/claude.ts`

**Modify** `buildArgs` (lines 115–124) only:
- Destructure three new optional keys: `mcpConfig?: string`, `allowedTools?: readonly string[]`,
  `strictMcp?: boolean`, added to the inline options type.
- Append three guarded pushes **after** the `--max-turns` line (122), before `return`:
  - `if (mcpConfig) args.push("--mcp-config", mcpConfig);`
  - `if (allowedTools && allowedTools.length > 0) args.push("--allowedTools", allowedTools.join(","));`
  - `if (strictMcp) args.push("--strict-mcp-config");`
- Update the function's doc-comment to name the three new flags alongside the existing list.

**No change** to `dispense` (259) — its `buildArgs({ model, effort, system, maxTurns })` call
stays exactly as-is; the new keys default to `undefined`, so its argv is byte-identical.
`DispenseOptions` untouched.

## File 3 — `src/engine/cast-core.ts`

**Modify** the import on line 25: `import type { GateVerdict, PlayTools } from "./play.ts";`
(add `PlayTools` — still a type-only import, purity preserved).

**Add** after `resolveMaxTurns` (line 56), before `resolveTurnsUsed`:
- The `ResolvedTools` tagged-union type (3 variants — see Design D3).
- The `resolveTools(declared, available)` function (pure, per Design D3), fully doc-commented:
  passthrough on undeclared, andon on missing required `mcp`, strict result otherwise; empty
  declaration ⇒ strict-empty; `skills` carried but not emitted; fresh arrays returned.

**Re-export** is automatic: `cast.ts` line 31 does `export * from "./cast-core.ts"`, so
`resolveTools` and `ResolvedTools` become available to T-032-02's cast path with no extra edit.

## File 4 — `src/executor/claude.test.ts`

**Extend** the `buildArgs` test block (after line 73). New cases:
1. `mcpConfig` alone → appends `--mcp-config <path>`.
2. `allowedTools: ["Read","Grep"]` → appends `--allowedTools Read,Grep` (comma-joined).
3. `allowedTools: []` → **no** `--allowedTools` flag (empty-array guard).
4. `strictMcp: true` → appends `--strict-mcp-config`; `strictMcp: false` ⇒ absent.
5. All tool flags together, composed after `--max-turns` and the model/effort/system flags
   (asserts ordering + full composition).
6. Back-compat: with none of the three supplied, argv is byte-identical to today (re-assert
   `not.toContain` for each new flag) — the guard the existing 8 cases already protect, made
   explicit for the tool flags.

The existing 8 cases (lines 21–73) are **not modified** — they are the byte-identity guard.

## File 5 — `src/engine/cast-core.test.ts`

**Add** a `resolveTools` describe/test block. The three required variants plus edge cases:
1. **Undeclared** — `resolveTools(undefined, [...])` → `{ ok: true, passthrough: true }`.
2. **Declared + present** — `resolveTools({ mcp: ["a"], allow: ["Read"] }, ["a","b"])` →
   `{ ok: true, mcp: ["a"], allowedTools: ["Read"], strict: true }`.
3. **Declared + missing** — `resolveTools({ mcp: ["a","z"] }, ["a"])` →
   `{ ok: false, missing: ["z"] }` (only the absent ids, in declared order).
4. **Empty declaration** — `resolveTools({}, [...])` → strict result with `mcp: []`,
   `allowedTools: []`, `strict: true` (declared ≠ passthrough).
5. **`allow` only, no `mcp`** — `resolveTools({ allow: ["Read"] }, [])` → strict, no missing.
6. **`skills` carried, not emitted** — `resolveTools({ skills: ["x"] }, [])` → strict-empty
   result (no `--tools`/skills surfaced; `allowedTools: []`).
7. **Returned arrays are fresh** — mutating the input `allow`/`mcp` (or the result) does not
   alias (defensive; asserts the spread copies).

## Ordering of edits (for the implementer)

1. `play.ts` — add `PlayTools` + field (no dependency).
2. `cast-core.ts` — import `PlayTools`, add `ResolvedTools` + `resolveTools` (depends on 1).
3. `claude.ts` — extend `buildArgs` (independent of 1–2).
4. Tests for `buildArgs` (`claude.test.ts`) and `resolveTools` (`cast-core.test.ts`).
5. `bun run check` (typecheck + full suite) — one green gate over the whole changeset.

This is purely additive: every existing type, call site, and test remains valid. The blueprint
introduces one contract field, one seam-flag extension, and one pure resolver — nothing else.
