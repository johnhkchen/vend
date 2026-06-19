# T-012-01 — Review

_Handoff document. What changed, test coverage, open concerns._

## Summary

Closed the `check:committed` gate's self-exempt blind spot (E-012): the `.lisa/hooks/` shell scripts
that *fire* the gate were outside its policed scope. Widened the R12 `SOURCE_PREFIXES` contract by one
element so a dirty/untracked hook now ANDONs like any other uncommitted source. The classifier logic
and the impure entry were not touched — they inherit the wider scope through the single-source
constant, exactly as the R12 contract intends. Committed clean; gate now exits 0.

## Files changed

| File | Change |
|------|--------|
| `src/ci/committed-core.ts` | `SOURCE_PREFIXES` widened `["src/","baml_src/","ci/"]` → `[…, ".lisa/hooks/"]`; JSDoc extended with the self-exempt rationale and the `.lisa/hooks/`-only narrowness note. |
| `src/ci/committed-core.test.ts` | R12 contract canary updated to the widened exact array; +1 positive fixture (dirty hook flagged), +1 negative fixture (non-hook `.lisa/` stays clean). |
| `docs/active/work/T-012-01/{research,design,structure,plan,progress,review}.md` | RDSPI artifacts. |

No consumer file changed (`check-committed.ts`, `package.json`, hook scripts, `.gitignore`s all
untouched) — confirming the AC clause "no consumer re-lists scope."

## Acceptance-criteria verdict — all met

- **Dirty hook → exit 1, path listed:** live smoke with `.lisa/hooks/__andon_probe.sh` exited 1 and
  listed the path. ✓
- **Clean tree → exit 0:** post-commit `bun run check:committed` → "ok — all source committed", exit 0. ✓
- **One-line edit to `SOURCE_PREFIXES`, no consumer re-lists scope:** the constant is the only logic
  change; `classifyPorcelain` and `check-committed.ts` are byte-for-byte unchanged. ✓
- **Passing dirty-hook `classifyPorcelain` case:** `"?? .lisa/hooks/on-stop.sh\n"` → `[".lisa/hooks/on-stop.sh"]`. ✓
- **Not flagging non-hook `.lisa/` paths:** `" M .lisa/signals/x.json\n M .lisa-layout.kdl\n"` → `[]`. ✓

## Test coverage

- `bun test`: **342 pass / 0 fail** across 26 files (was 340 — net +2 from the new fixtures).
- `committed-core.test.ts`: 18 pass (was 16).
- `bun run build` (tsc `--noEmit`): clean — `as const` tuple still well-typed.
- The negative fixture is a permanent guard: any future broadening to `.lisa/` would turn it red.
- The contract canary (exact-array `toEqual`) remains an armed tripwire for the next scope change.

**Gap:** the live ANDON (exit 1) behaviour of the impure `check-committed.ts` entry is smoke-only, not
in the committed suite — consistent with that file's own "smoke-only, not unit-tested" design. The pure
fixtures are the durable regression guard; the impure shell has no logic of its own to regress.

## Open concerns / notes for the reviewer

1. **Prefix is literal `startsWith` with trailing slash.** `.lisa/hooks/` matches
   `.lisa/hooks/on-stop.sh` but not a sibling like `.lisa/hooksZZZ` — intended and consistent with
   `src/`, `ci/`. No globbing.
2. **`.lisa/signals/` reliance on ignore layers.** The negative fixture documents intent, but in
   practice `.lisa/signals/` never reaches porcelain because `.lisa/.gitignore` ignores `signals/`.
   The scope cut (`hooks/` not `.lisa/`) means even an accidentally-un-ignored `.lisa/` state dir would
   stay out of the gate — defensive by design.
3. **Branch:** committed directly to `main`, consistent with the established lisa/RDSPI workflow (the
   E-011 chain and prior tickets committed to `main` the same way). Flagging for visibility since `main`
   is the default branch.
4. **No `lint` script exists** in the repo yet; `check:typecheck` is the active static gate and passes.
   Not a regression — CLAUDE.md frames `bun run lint` as a not-yet-live convention.

## Risk

Minimal. Additive change to a pure constant, fully covered on both the positive and negative edge,
single-commit revertible, no state/migration/data. The self-referential fix is verified end-to-end:
the gate now polices the hooks that fire it.
