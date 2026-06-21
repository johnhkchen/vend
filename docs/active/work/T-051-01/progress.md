# T-051-01 — Progress

Implementation of the plan. Status: **complete**. Landed as a single atomic change
to two files, exactly as planned. Zero deviations.

## Steps completed

### Step 1 — Source: widen `buildArgs` + `DispenseOptions` + `dispense` ✅

`src/executor/claude.ts`, all four edit points from Structure:

1. `DispenseOptions.disallowedTools?: readonly string[]` added after `allowedTools`,
   doc-commented `→ --disallowedTools (E-051). Empty/omitted ⇒ no flag.`
2. `buildArgs` destructure gained `disallowedTools` (after `allowedTools`).
3. `buildArgs` inline param type gained `disallowedTools?: readonly string[]`.
4. Emission guard added after the `--allowedTools` push:
   ```ts
   if (disallowedTools && disallowedTools.length > 0) args.push("--disallowedTools", disallowedTools.join(","));
   ```
   with a 3-line comment recording the `claude -p --help` flag-spelling provenance
   and the comma-join-into-one-element rationale (variadic flag).
5. `dispense` destructure + `buildArgs({...})` forward gained `disallowedTools`.
6. `buildArgs` block doc comment extended with the `disallowedTools` clause.

Append order after `--max-turns` is now: `--mcp-config`, `--allowedTools`,
`--disallowedTools`, `--strict-mcp-config` — the allow→deny→strict progression from
Design.

**Verify:** `bun run build` (tsc --noEmit) clean.

### Step 2 — Tests ✅

`src/executor/claude.test.ts`, in the "buildArgs tool scoping" block:

- New `disallowedTools comma-joins into ONE argv element`.
- New `empty disallowedTools array emits no flag (length guard)`.
- New `allowedTools and disallowedTools compose together, allow before deny`.
- Amended `all tool flags compose ... in order`: added `disallowedTools:
  ["AskUserQuestion"]` to input and `"--disallowedTools", "AskUserQuestion"` to the
  expected argv between `--allowedTools` and `--strict-mcp-config` (pins ordering).
- Amended `no tool options ⇒ byte-identical`: added
  `expect(base).not.toContain("--disallowedTools");`.

**Verify:** `bun test src/executor/claude.test.ts` → 41 pass, 0 fail, 77 expect()s.

### Step 3 — Full gate ✅

- `bun test` (whole suite): **1179 pass, 0 fail**, 77 files. (One unrelated note: a
  background `andon` test logged a `timed-out` line but the suite reports 0 fail —
  pre-existing, not introduced by this change; confirmed by it being absent from the
  failure count.)
- `bun run build` (tsc --noEmit): clean.
- `bun run check:precommit`: `precommit: ok — tests green`.
- No `lint` script exists in this repo; the gate is `check` (typecheck + test), both
  green. (Plan said `bun run lint` — corrected to the repo's actual gate.)

## Deviations from plan

- **Lint command name.** Plan referenced `bun run lint`; the repo has no such script.
  Used the actual gates (`check:typecheck`, `check:test`, `check:precommit`). No
  behavioral impact — purely the verification command name.
- Otherwise none. Source and test edits matched Structure/Plan exactly.

## Acceptance criteria — status

- [x] `buildArgs({disallowedTools:["AskUserQuestion"]})` yields the flag with the
  comma-joined value as ONE element — test green.
- [x] `buildArgs({})` and `buildArgs({disallowedTools:[]})` byte-identical to the
  pre-change argv — empty-array test + amended back-compat test green.
- [x] Exact flag spelling confirmed against `claude -p --help`
  (`--disallowedTools <tools...>`) and noted in-code, as E-032 did.
- [x] Full `claude.test.ts` green (41 pass).
