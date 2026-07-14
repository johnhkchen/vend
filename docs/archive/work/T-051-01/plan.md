# T-051-01 — Plan

Ordered, verifiable steps. The change is small and cohesive, so it lands as a single
atomic commit (the type, guard, and forward are interdependent — a partial edit fails
typecheck). Tests are written alongside the source edit and must be green before commit.

## Testing strategy

- **Unit only.** The entire feature lives in `buildArgs`, which is PURE. It is fully
  exercised with sample inputs in `claude.test.ts` — no live `claude` spawn, no
  integration test, consistent with the seam's standing test rule (claude.test.ts:14–17).
- **`dispense` stays untested** by the module's convention (the single impure
  function). The new option's forwarding is covered indirectly: the destructure +
  `buildArgs` call are type-checked, and `buildArgs` itself is the unit under test.
- **Verification gates:** `bun test src/executor/claude.test.ts` green (all cases,
  new and existing), `bun run build` (typecheck) clean, `bun run lint` clean.
- **Oracle for back-compat:** the existing "byte-identical to today" tests must pass
  unchanged except for the additive `not.toContain("--disallowedTools")` assertion.

## Steps

### Step 1 — Source: widen `buildArgs` + `DispenseOptions` + `dispense` (one atomic edit)

Edit `src/executor/claude.ts` at the four points from Structure:

1. `DispenseOptions.disallowedTools?: readonly string[]` with doc comment (after
   `allowedTools`, ~:90).
2. `buildArgs` destructure: add `disallowedTools` after `allowedTools` (~:146).
3. `buildArgs` inline param type: add `disallowedTools?: readonly string[]` (~:154).
4. `buildArgs` emission guard after the `allowedTools` push (~:164):
   ```ts
   if (disallowedTools && disallowedTools.length > 0) args.push("--disallowedTools", disallowedTools.join(","));
   ```
   with the `--help`-provenance comment.
5. `dispense` destructure + `buildArgs({...})` forward: add `disallowedTools` (~:302–303).
6. Extend the `buildArgs` block doc comment with one clause on `disallowedTools`.

**Verify:** `bun run build` — typecheck passes (additive optional field; no caller breaks).

### Step 2 — Tests: mirror the `allowedTools` cases

Edit `src/executor/claude.test.ts`, in the "buildArgs tool scoping" block:

1. New: `disallowedTools comma-joins into ONE argv element`.
2. New: `empty disallowedTools array emits no flag (length guard)`.
3. New: `allowedTools and disallowedTools compose together, allow before deny`.
4. Extend the existing `all tool flags compose ... in order` test: add
   `disallowedTools: ["AskUserQuestion"]` to the input and the
   `"--disallowedTools", "AskUserQuestion"` pair to the expected argv, between
   `--allowedTools` and `--strict-mcp-config` (pins ordering).
5. Extend the existing `no tool options ⇒ byte-identical` test: add
   `expect(base).not.toContain("--disallowedTools");`.

**Verify:** `bun test src/executor/claude.test.ts` — full file green, including the
amended existing cases.

### Step 3 — Full gate + commit

- `bun test` (whole suite) — confirm no collateral breakage anywhere.
- `bun run build` and `bun run lint` — typecheck + format/lint clean.
- Commit both files together:
  `feat(executor): disallowedTools → --disallowedTools symmetric denylist (T-051-01)`

## Step independence & rollback

Steps 1 and 2 are written together but Step 1 is independently typecheck-verifiable
and Step 2 is independently test-verifiable. If a test reveals a wrong expectation
(e.g. ordering), only Step 2's expected-argv literal changes. Rollback is a single
-revert of one commit touching two files; nothing else in the tree depends on the new
option until T-051-02 wires a caller.

## Acceptance-criteria trace

| AC clause | Covered by |
|-----------|-----------|
| `buildArgs({disallowedTools:["AskUserQuestion"]})` yields the flag with comma-joined value as ONE element | Step 2.1 |
| `buildArgs({})` and `buildArgs({disallowedTools:[]})` byte-identical to pre-change argv | Step 2.2 + amended Step 2.5 |
| exact flag spelling confirmed against `claude -p --help` and noted in-code | Research verification + Step 1.4 in-code comment |
| Full `claude.test.ts` green | Step 2 verify + Step 3 full gate |

## Out of scope (explicit)

No cast/play routing, no choice of which plays receive the denylist, no new MCP
config. T-051-02 owns wiring `disallowedTools: ["AskUserQuestion"]` into autonomous
plays. This ticket stops at the seam being *able* to emit the flag.
