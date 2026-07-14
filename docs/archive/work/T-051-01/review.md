# T-051-01 — Review

Handoff for a human reviewer. The change adds a symmetric `disallowedTools` denylist
option to the `claude -p` headless seam, mirroring the E-032 `allowedTools`
allowlist. Small, additive, fully unit-tested, zero behavior change on the existing
no-tools path.

## What changed

**Commit:** `66fc58e` — `feat(executor): disallowedTools → --disallowedTools symmetric denylist (T-051-01)`

| File | Change |
|------|--------|
| `src/executor/claude.ts` | Added `disallowedTools?: readonly string[]` to `DispenseOptions`; added it to `buildArgs`' destructure + inline param type + emission guard; forwarded it through `dispense`; extended the `buildArgs` doc comment. |
| `src/executor/claude.test.ts` | 3 new `buildArgs` cases; amended the composition test and the byte-identical back-compat test. |
| `docs/active/work/T-051-01/*.md` | RDSPI artifacts (research, design, structure, plan, progress, review). |

No files created or deleted in `src/`. No new exports. No changes outside the seam.

### The load-bearing line

```ts
if (disallowedTools && disallowedTools.length > 0) args.push("--disallowedTools", disallowedTools.join(","));
```

Placed immediately after the `--allowedTools` push and before `--strict-mcp-config`.
Two-part guard (present AND non-empty) → both `undefined` and `[]` emit nothing.
Comma-joined into ONE argv element because the CLI flag is variadic (`<tools...>`),
verified against `claude -p --help` and noted in-code.

## Test coverage

- **`bun test src/executor/claude.test.ts`:** 41 pass / 0 fail / 77 expect()s.
- **Full suite:** 1179 pass / 0 fail / 77 files.
- **Typecheck (`tsc --noEmit`):** clean.
- **`check:precommit`:** green (also re-ran as the commit hook).

New/changed assertions, mapped to AC:

| AC clause | Test |
|-----------|------|
| flag with comma-joined value as ONE element | `disallowedTools comma-joins into ONE argv element` |
| `{}` / `{disallowedTools:[]}` byte-identical | `empty disallowedTools array emits no flag` + amended `no tool options ⇒ byte-identical` |
| ordering / composition pinned | amended `all tool flags compose ... in order` + new `allow before deny` |
| spelling confirmed against `--help`, noted in-code | in-code comment at the guard |
| full `claude.test.ts` green | 41/41 |

**Coverage gaps (intentional):** `dispense` is not unit-tested — it is the module's
single impure, deliberately-untested function. The new option's *forwarding* through
`dispense` is covered only by the typecheck (the destructure + `buildArgs({...})`
call compile), not by a runtime assertion, consistent with the seam's standing test
rule. The pure logic it relies on (`buildArgs`) is exhaustively tested.

## Open concerns / notes for the reviewer

1. **`dispense` forwarding is type-checked, not test-asserted.** Same posture as
   every other agentic option (`allowedTools`, `mcpConfig`, …). If a reviewer wants
   belt-and-suspenders, a single test spying on the spawned argv would close it — but
   that would break the "no live spawn / dispense untested" convention, so it was not
   added. Flagging, not recommending.

2. **Four-edit-point duplication persists.** `buildArgs` declares its param shape
   inline rather than reusing `DispenseOptions`, so each new option must be added in
   four places. This is a pre-existing smell (E-032 has it too); Design Option B
   (extract a shared `toolList` helper) was considered and rejected as premature for
   a two-call-site, two-line guard. Worth a future cleanup ticket if a third
   tool-list flag ever appears.

3. **Pre-existing background-test noise.** The full-suite run printed
   `· andon: timed-out` while still reporting 0 failures. This is unrelated to this
   change (it touches only the executor argv builder) and pre-dates it; noted so it
   isn't mistaken for a regression.

4. **No caller yet — by design.** This ticket delivers only the capability. Nothing
   in the tree passes `disallowedTools` until **T-051-02** routes
   `["AskUserQuestion"]` through the autonomous plays (propose-epic, decompose-epic,
   work). Until then the flag is dormant and the argv is byte-identical to before,
   which the back-compat tests guarantee. T-051-02 is the integration that actually
   closes the `AskUserQuestion`-hang failure mode E-051 targets.

## Verdict

Ready for review. Plumbing complete, symmetric with the precedent it mirrors, green
across all gates, and scoped cleanly so T-051-02 can wire the caller without touching
this seam again.
