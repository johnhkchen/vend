# T-012-01 — Progress

_Implementation log. What's done, what remains, deviations._

## Status: implementation complete, committing

## Steps executed

- [x] **Step 1 — widen constant + doc comment** (`src/ci/committed-core.ts`).
  Appended `".lisa/hooks/"` to `SOURCE_PREFIXES`; added a JSDoc paragraph explaining the self-exempt
  rationale and the `.lisa/hooks/`-only narrowness. `bun run build` (tsc) clean.
- [x] **Step 2 — contract canary** (`committed-core.test.ts`). Updated the R12 exact-array assertion
  to `["src/", "baml_src/", "ci/", ".lisa/hooks/"]`. Kept `toEqual` exact (not relaxed to `toContain`).
- [x] **Step 3 — dirty-hook positive fixture.** Added `classifyPorcelain("?? .lisa/hooks/on-stop.sh\n")`
  → `[".lisa/hooks/on-stop.sh"]`.
- [x] **Step 4 — non-hook negative fixture.** Added
  `classifyPorcelain(" M .lisa/signals/x.json\n M .lisa-layout.kdl\n")` → `[]`.
- [x] **Step 5 — suite + typecheck.** `bun test`: **342 pass / 0 fail** across 26 files (was 340; +2
  new fixtures). `committed-core.test.ts` alone: 18 pass (was 16). `bun run build`: clean. No `lint`
  script exists yet (CLAUDE.md notes commands are intended conventions, not all live); `check:typecheck`
  is the active gate and passes.
- [x] **Step 6 — live ANDON smoke.** Created throwaway `.lisa/hooks/__andon_probe.sh`; `bun run
  check:committed` exited **1** and listed `.lisa/hooks/__andon_probe.sh` as an offender — proving the
  impure entry inherited the widened scope with **no edit to `check-committed.ts`**. Removed the probe;
  the gate then flagged only my own uncommitted edits to `committed-core.ts` / `committed-core.test.ts`
  (expected — those commit in this step), which clears to exit 0 after commit.
- [ ] **Step 7 — commit** (in progress).

## Deviations from plan

1. **No `bun run lint` step.** The plan listed lint; the repo has no `lint` script (package.json
   exposes `check:typecheck`, `check:test`, `check`, `build`). CLAUDE.md explicitly frames the lint
   command as an intended convention that goes live with scaffolding. Substituted `bun run build`
   (tsc `--noEmit`) as the active static gate. Not a scope change — the AC names `check:committed` and
   `bun test`, both run and green.

2. **Step 6 exit-0 confirmation deferred to post-commit.** The plan's clean-tree exit-0 check is
   blocked only by this ticket's own uncommitted source (the two edited files), which is correct gate
   behaviour. It resolves to exit 0 once Step 7 commits. Documented rather than worked around — the
   widened-scope ANDON (exit 1 listing the probe) is the substantive proof and it passed.

## Files changed

- `src/ci/committed-core.ts` — constant widened, JSDoc extended.
- `src/ci/committed-core.test.ts` — canary updated, 2 fixtures added.
- `docs/active/work/T-012-01/*` — RDSPI artifacts (out of gate scope; swept per convention).
