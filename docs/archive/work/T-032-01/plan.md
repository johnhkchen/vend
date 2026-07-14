# T-032-01 — Plan

Ordered, independently-verifiable steps. Two commits: (1) the pure contract + resolver
(`play.ts` + `cast-core.ts` + their tests), (2) the seam-flag extension (`claude.ts` + its
tests). Each commit is green on its own (`bun run check`). The split mirrors the natural seam:
contract/decision vs the CLI argv emitter.

## Testing strategy

- **All three deliverables are pure** ⇒ all covered by **unit tests**. No integration test,
  no live `claude` spawn (the seam's untested `dispense` is out of scope and unchanged).
- **`resolveTools`** — unit-tested on all three required variants (declared+present,
  declared+missing, undeclared) plus the four edge cases from Structure §5. This is the AC's
  "unit-tested on all three".
- **`buildArgs`** — unit-tested for each new flag, the empty-array guard, full composition,
  and the byte-identity back-compat assertion. The existing 8 cases are the regression guard.
- **`Play.tools?`** — verified by `tsc` (the AC's "tsc green; cast/registry paths compile
  untouched"); optionality is proven by the six concrete plays still compiling without a
  `tools` field.
- **Verification gate**: `bun run check` = `baml:gen && check:typecheck && check:test`. Green
  before each commit. `check:committed` / `check:head` are the CI gates Lisa runs.

## Commit 1 — pure contract + resolver

**Goal.** `PlayTools` on the `Play` contract + the pure `resolveTools` decision, fully
unit-tested. No seam change yet (so this commit is conceptually "the decision layer").

### Step 1.1 — `PlayTools` interface + `tools?` field (`src/engine/play.ts`)
- Add the `PlayTools` interface (3 optional `readonly` string-array fields) before `Play`.
- Add `readonly tools?: PlayTools` to `Play<I, O>` beside `maxTurns?`, doc-commented.
- Verify: `tsc --noEmit` green; all six `src/play/*.ts` still compile (optional field).

### Step 1.2 — `ResolvedTools` + `resolveTools` (`src/engine/cast-core.ts`)
- Add `PlayTools` to the existing `type` import from `./play.ts`.
- Add the `ResolvedTools` tagged union (3 variants) and the pure `resolveTools(declared,
  available)` function per Design D3 (passthrough / strict / andon; fresh arrays; `skills`
  carried not emitted).
- Verify: `tsc --noEmit` green. `resolveTools`/`ResolvedTools` re-export through `cast.ts`'s
  `export *` automatically (no edit to `cast.ts`).

### Step 1.3 — `resolveTools` unit tests (`src/engine/cast-core.test.ts`)
- Add the test block: the 3 required variants + empty-declaration, allow-only, skills-carried,
  fresh-array cases (Structure §5).
- Verify: `bun test` green (new cases pass, nothing else regresses).

### Step 1.4 — gate + commit
- `bun run check` green.
- Commit: `feat(engine): PlayTools contract + pure resolveTools (T-032-01)`.

## Commit 2 — `buildArgs` tool-scoping flags

**Goal.** The seam emits `--mcp-config` / `--allowedTools` / `--strict-mcp-config`; the
no-tools argv stays byte-identical.

### Step 2.1 — extend `buildArgs` (`src/executor/claude.ts`)
- Widen the options object with `mcpConfig?`, `allowedTools?`, `strictMcp?`.
- Append the three guarded pushes after `--max-turns` (Design D2 / Structure §2).
- Update the doc-comment to list the new flags.
- Leave `dispense`'s call site and `DispenseOptions` untouched.
- Verify: `tsc --noEmit` green; `dispense` argv unchanged (same four keys passed).

### Step 2.2 — `buildArgs` tool-flag tests (`src/executor/claude.test.ts`)
- Add the cases from Structure §4: each flag alone, empty-array guard, full composition with
  ordering, and the byte-identity back-compat re-assertion.
- Verify: `bun test` green; the existing 8 `buildArgs` cases pass unchanged.

### Step 2.3 — gate + commit
- `bun run check` green.
- Commit: `feat(executor): buildArgs emits MCP/tool-scoping flags (T-032-01)`.

## Risk & mitigation

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Flag spelling wrong (external contract) | low — verified this session | spellings copied from `claude -p --help`; noted in research.md; a wrong one only mis-scopes T-032-02's live cast, never breaks the pure argv tests |
| `allowedTools` variadic swallows a later flag | low | comma-join into one argv element (Design D2); test asserts single-element value |
| An existing concrete play breaks on the new field | none | field is optional/readonly — `tsc` proves assignability; Step 1.1 verifies all six compile |
| Empty-array `allowedTools` emits a bare flag | low | explicit `length > 0` guard + a dedicated test |
| Purity regression (addon loads in a pure test) | none | both new types are string-array-only, type-only imports; `cast-core.test.ts`/`claude.test.ts` stay addon-free |

## Definition of done (maps to ACs)

- [ ] `Play.tools?: PlayTools` (`{ mcp?, allow?, skills? }`, all optional/readonly); undeclared
      ⇒ unchanged. `tsc` green; cast/registry compile untouched. → Steps 1.1–1.2.
- [ ] `buildArgs` accepts `mcpConfig?`/`allowedTools?`/`strictMcp?` and appends the verified
      flags; no-tools argv byte-identical; flag spelling confirmed against `claude -p --help`
      (noted in research.md). → Steps 2.1–2.2.
- [ ] Pure `resolveTools` returns resolved-flags / `{ok:false,missing}` / passthrough —
      unit-tested on all three. `bun run check:*` green. → Steps 1.2–1.3.

Two atomic commits, each independently green. No deviations anticipated; any will be logged in
`progress.md` before proceeding.
