# T-051-01 — Structure

The blueprint: exact file-level changes, the four edit points, and the test cases.
No code bodies beyond the one load-bearing guard line. Two files change; nothing is
created or deleted.

## Files touched

| File | Change | Why |
|------|--------|-----|
| `src/executor/claude.ts` | modified | Add `disallowedTools` to `DispenseOptions`, `buildArgs` (destructure + inline type + emission guard), and the `dispense` forward. |
| `src/executor/claude.test.ts` | modified | Add `buildArgs` cases for the new flag, mirroring the `allowedTools` block. |

No new files. No deletions. No changes to `executor.ts`, `select.ts`, or any
cast/play module (that is T-051-02).

## `src/executor/claude.ts` — four edit points

### 1. `DispenseOptions` (after the `allowedTools` field, ~claude.ts:90)

Add, immediately below `allowedTools`:

```ts
/** Per-play tool denylist → `--disallowedTools` (E-051). Empty/omitted ⇒ no flag. */
disallowedTools?: readonly string[];
```

Placed between `allowedTools` and `strictMcp` so the field order matches the argv
emission order.

### 2. `buildArgs` destructure (~claude.ts:146)

Add `disallowedTools` to the destructured parameter, right after `allowedTools`:

```ts
{ model, effort, system, maxTurns, mcpConfig, allowedTools, disallowedTools, strictMcp }
```

### 3. `buildArgs` inline param type (~claude.ts:154)

Add to the inline type literal, right after `allowedTools?: readonly string[];`:

```ts
disallowedTools?: readonly string[];
```

(Reminder from Research: `buildArgs` declares its own inline param shape; it does not
reuse `DispenseOptions`, so both must be edited.)

### 4. `buildArgs` emission guard (~claude.ts:164, right after the `allowedTools` push)

```ts
// `--disallowedTools` mirrors `--allowedTools` (E-051): flag spelling verified
// against `claude -p --help` (`--disallowedTools <tools...>`, variadic), so comma-
// join into ONE argv element to stop the variadic flag swallowing the next flag.
if (disallowedTools && disallowedTools.length > 0) args.push("--disallowedTools", disallowedTools.join(","));
```

Resulting append order after `--max-turns`: `--mcp-config`, `--allowedTools`,
**`--disallowedTools`**, `--strict-mcp-config`.

### 5. `dispense` forward (~claude.ts:302–303)

Add `disallowedTools` to BOTH the destructure of `DispenseOptions` and the
`buildArgs({ ... })` argument object:

```ts
export async function dispense({ prompt, model, effort, system, maxTurns, mcpConfig, allowedTools, disallowedTools, strictMcp, onMessage, timeoutMs }: DispenseOptions): Promise<ResultMessage> {
  const args = buildArgs({ model, effort, system, maxTurns, mcpConfig, allowedTools, disallowedTools, strictMcp });
```

Without this, an option set on `DispenseOptions` would be silently dropped before
reaching the argv (the failure mode the Research flagged).

### `buildArgs` / `dispense` doc comments

Extend the existing block comment on `buildArgs` (claude.ts:125–138) with one clause
noting `disallowedTools → --disallowedTools` alongside the existing `allowedTools`
description, and the empty-array-emits-nothing rule. Keep it terse; the in-code guard
comment carries the `--help` provenance.

## `src/executor/claude.test.ts` — new cases

Append to the "buildArgs tool scoping" block (after the `allowedTools`/`strictMcp`
cases, ~line 99) the following, mirroring the `allowedTools` tests one-for-one:

1. **`disallowedTools comma-joins into ONE argv element`**
   ```ts
   expect(buildArgs({ disallowedTools: ["AskUserQuestion", "WebSearch"] })).toEqual([
     "-p", "--output-format", "stream-json", "--verbose", "--disallowedTools", "AskUserQuestion,WebSearch",
   ]);
   ```

2. **`empty disallowedTools array emits no flag (length guard)`**
   ```ts
   expect(buildArgs({ disallowedTools: [] })).toEqual(["-p", "--output-format", "stream-json", "--verbose"]);
   expect(buildArgs({ disallowedTools: [] })).not.toContain("--disallowedTools");
   ```

3. **Extend the composition test (line 101) and back-compat test (line 119):**
   - Add `disallowedTools: ["AskUserQuestion"]` to the all-flags `buildArgs({...})`
     input and insert `"--disallowedTools", "AskUserQuestion"` between the
     `--allowedTools` pair and `--strict-mcp-config` in the expected argv — pinning
     the ordering decision.
   - Add `expect(base).not.toContain("--disallowedTools");` to the byte-identical
     back-compat test.

4. **`allowedTools and disallowedTools compose together, allow before deny`** (new,
   pins the adjacency decision):
   ```ts
   expect(buildArgs({ allowedTools: ["Read"], disallowedTools: ["AskUserQuestion"] })).toEqual([
     "-p", "--output-format", "stream-json", "--verbose",
     "--allowedTools", "Read", "--disallowedTools", "AskUserQuestion",
   ]);
   ```

## Public interface delta

- `DispenseOptions` gains one optional readonly-array field. Purely additive; every
  existing caller compiles unchanged.
- `buildArgs`' inline param type gains the same field. Additive.
- `dispense` / `ClaudeExecutor` signatures are unchanged in shape (they consume
  `DispenseOptions`), and now forward one more option.

No breaking change. No new exports.

## Ordering of edits (matters for a clean typecheck)

Type + destructure + inline-type + guard + forward can land as ONE atomic edit to
`claude.ts` (they are interdependent — a half-edit fails typecheck). Tests land with
or right after. A single commit is appropriate for a change this small and cohesive.
