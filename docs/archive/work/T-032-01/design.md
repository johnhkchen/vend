# T-032-01 — Design

Three decisions, each with the alternatives weighed against the Research map. The throughline:
mirror the `maxTurns` precedent exactly, keep the no-tools path byte-identical, defer every
impure concern to T-032-02.

## D1 — `PlayTools` shape and placement

**Decision.** Define on `src/engine/play.ts` next to the `Play` interface:

```ts
export interface PlayTools {
  readonly mcp?: readonly string[];    // server ids the play REQUIRES (absent ⇒ andon)
  readonly allow?: readonly string[];  // built-in tool allowlist (e.g. "Read", "Grep")
  readonly skills?: readonly string[]; // forward-compatible; wiring DEFERRED this slice
}
```

and add `readonly tools?: PlayTools` to `Play<I, O>` in the same doc block as `maxTurns?`
(~line 157), documented as a per-play sibling resolved at cast and threaded to the seam.

**Why an `interface`, not an inline type.** The ticket and T-032-02 both name `PlayTools` as a
shared type the cast path imports. A named `interface` is the house pattern for a contract type
(cf. `Card`, `CastContext`, `EffectResult`). All fields `readonly` + optional, matching the
contract's immutability discipline.

**Rejected — a `type` alias with required `mcp`.** Making `mcp` required would force every
tool-declaring play to list servers even when it only wants a built-in allowlist (`allow`
without `mcp`). All-optional keeps `{ allow: ["Read"] }` valid (strict, no MCP).

**Rejected — putting `PlayTools` in a new `src/engine/tools.ts`.** `maxTurns` lives on
`play.ts` as a bare field; a sibling field's type belongs beside it. A new module adds an import
edge for one interface with no behavior. Co-location keeps the contract in one file.

## D2 — `buildArgs` extension

**Decision.** Widen the options object with three optional keys, appended **after**
`--max-turns`, each guarded so absence ⇒ no flag:

```ts
export function buildArgs(
  { model, effort, system, maxTurns, mcpConfig, allowedTools, strictMcp }:
    { model?: string; effort?: string; system?: string; maxTurns?: number;
      mcpConfig?: string; allowedTools?: readonly string[]; strictMcp?: boolean } = {},
): string[] {
  const args = ["-p", "--output-format", "stream-json", "--verbose"];
  if (model) args.push("--model", model);
  if (effort) args.push("--effort", String(effort));
  if (system) args.push("--system-prompt", system);
  if (maxTurns) args.push("--max-turns", String(maxTurns));
  if (mcpConfig) args.push("--mcp-config", mcpConfig);
  if (allowedTools && allowedTools.length > 0) args.push("--allowedTools", allowedTools.join(","));
  if (strictMcp) args.push("--strict-mcp-config");
  return args;
}
```

**Flag spellings** are the verified ones from `claude -p --help` (Research table):
`--mcp-config`, `--allowedTools`, `--strict-mcp-config`.

**Why comma-join for `allowedTools`.** Help says comma-or-space. `dispense` spawns with no
shell, so each argv element is literal. A single comma-joined element (`"Read,Grep"`) is
parsed by commander as one variadic list and cannot accidentally swallow a following flag,
which a space-separated multi-arg push (`"Read", "Grep"`) risks if it were the last flag and
more were appended later. Comma-join is the robust, future-proof choice.

**Why the `length > 0` guard on `allowedTools`.** An empty array must not emit a bare
`--allowedTools` with no value (the CLI would consume the next token). Mirrors the `maxTurns`
truthy guard (a `0` / empty is "absent"). `mcpConfig` is a truthy-string guard; `strictMcp` is
a plain boolean guard.

**Why append after `--max-turns`, in this order.** Keeps the existing prefix untouched, so the
no-tools argv is **byte-identical** — the existing 8 `buildArgs` tests pass unchanged. Order
among the three new flags is cosmetic (the CLI is order-insensitive); the chosen order matches
the ticket's param listing.

**Rejected — a separate `buildToolArgs` helper.** A second builder would split the argv across
two functions and break the single byte-identity guarantee. One builder, additive guards.

## D3 — `resolveTools` location and return shape

**Decision.** Pure function in `src/engine/cast-core.ts`, beside `resolveMaxTurns`, with a
three-variant tagged union:

```ts
export type ResolvedTools =
  | { readonly ok: true; readonly passthrough: true }
  | { readonly ok: true; readonly mcp: readonly string[];
      readonly allowedTools: readonly string[]; readonly strict: true }
  | { readonly ok: false; readonly missing: readonly string[] };

export function resolveTools(
  declared: PlayTools | undefined,
  available: readonly string[],
): ResolvedTools {
  if (declared === undefined) return { ok: true, passthrough: true };
  const required = declared.mcp ?? [];
  const have = new Set(available);
  const missing = required.filter((id) => !have.has(id));
  if (missing.length > 0) return { ok: false, missing };
  return { ok: true, mcp: [...required], allowedTools: [...(declared.allow ?? [])], strict: true };
}
```

**Why three variants, discriminated by `ok` then `passthrough`/`strict`.** The consumer
(T-032-02) branches: `!ok` → raise the missing-MCP andon; `passthrough` → wire no flags
(inherit global); else → emit the flags from `mcp`/`allowedTools` with `strict: true`. `ok`
alone can't separate passthrough from strict (both succeed), so the second discriminant
(`passthrough: true` vs `strict: true`) is load-bearing — a consumer uses `"passthrough" in r`
or `r.strict` to tell them apart. This matches the ticket's three named results verbatim.

**Why `available` is a parameter, not read here.** Purity. The set of project-provided server
ids comes from T-032-02's `.mcp.json` read; passing it in keeps `resolveTools` a pure,
fully-tested decision with no fs. This is the same shape as `resolveMaxTurns` taking its two
numbers rather than reaching for config.

**Semantics of an empty declaration (`tools: {}`).** `declared !== undefined` but `mcp`
absent ⇒ `required = []` ⇒ `missing = []` ⇒ strict result with `mcp: []`, `allowedTools: []`,
`strict: true`. This is **deliberate**: declaring `tools` at all opts into strict least-
privilege (no inherited MCP, an empty allowlist) — distinct from undeclared passthrough. The
boundary is "declared the field or not", which is crisp and easy to reason about. Documented in
the doc-comment and pinned by a unit test.

**`skills` carried, not emitted.** `resolveTools` ignores `declared.skills` (scope cut). It
stays on `PlayTools` for T-032-02+/forward use; no `--tools`/skills flag is produced. A test
asserts a `skills`-only declaration still produces a strict result with an empty `allowedTools`
and emits nothing for skills.

**Why `[...required]` / `[...(declared.allow ?? [])]` (fresh arrays).** Returns owned mutable-
free copies typed `readonly string[]`, decoupling the result from the play's frozen literals —
the house "return data, not aliases" hygiene. Cheap; arrays are tiny.

**Rejected — returning `null`/`undefined` for passthrough.** A bare nullish loses the
three-way distinction and forces the consumer to re-derive "undeclared vs declared-empty".
The tagged union makes every state explicit (the `PlayLookup` discriminated-union house
pattern in `play.ts`).

**Rejected — placing `resolveTools` in `play.ts`.** `play.ts` is the contract (types + the
registry Map); the cast-time resolvers all live in `cast-core.ts` (`resolveMaxTurns`,
`resolveLoggedModel`). `resolveTools` is a resolver, so it belongs with its siblings and is
re-exported through `cast.ts`'s `export *`.

## What this design explicitly does NOT do (T-032-02)

- No `.mcp.json` read, no construction of the mcp-config file/path.
- No change to `DispenseOptions`, `dispense`, or `castPlay` behavior — only `buildArgs`'s
  signature widens; its single caller passes the same keys.
- No andon emission on stdout, no cast-time threading of resolved flags into `dispense`.
- No skills injection.

The result is a fully pure, fully unit-tested foundation: a contract field, a seam flag
extension, and a decision function — the three pieces T-032-02 composes into the live path.
