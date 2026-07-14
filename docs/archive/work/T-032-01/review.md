# T-032-01 — Review

The pure foundation for per-play tool/MCP provisioning is complete: a `tools?` declaration on
the `Play` contract, a `buildArgs` extension that emits the verified CLI scoping flags, and a
pure `resolveTools` decision function — all unit-tested, no I/O. Two atomic commits, both green.
This is the handoff doc: what changed, how it's covered, and what's deliberately left to T-032-02.

## What changed

### Source (3 files)
- **`src/engine/play.ts`** — added the `PlayTools` interface (`{ mcp?, allow?, skills? }`, all
  `readonly`/optional) and `readonly tools?: PlayTools` on `Play<I, O>`, beside `maxTurns?`.
  Purely additive; no import change (string-array-only); purity (type-only imports) preserved.
- **`src/engine/cast-core.ts`** — added `PlayTools` to the existing `type` import; added the
  `ResolvedTools` tagged union (passthrough / strict-flags / andon) and the pure
  `resolveTools(declared, available)`. Sits beside `resolveMaxTurns`; re-exported via `cast.ts`.
- **`src/executor/claude.ts`** — widened `buildArgs` with `mcpConfig?`/`allowedTools?`/
  `strictMcp?` and three guarded pushes after `--max-turns`. `dispense`/`DispenseOptions`
  untouched.

### Tests (2 files)
- **`src/engine/cast-core.test.ts`** — a 7-case `resolveTools` block.
- **`src/executor/claude.test.ts`** — 6 new `buildArgs` tool-flag cases.

### Commits
- `d67263f` — `feat(engine): PlayTools contract + pure resolveTools (T-032-01)`
- `7aa385a` — `feat(executor): buildArgs emits MCP/tool-scoping flags (T-032-01)`

No files created or deleted. No behavior change to any existing call path.

## Acceptance criteria — all met

- ✅ **`Play` gains `readonly tools?: PlayTools`** (`{ mcp?, allow?, skills? }`, all
  optional/readonly); undeclared ⇒ unchanged. `tsc` clean; cast/registry/the six concrete
  plays compile untouched (optional field).
- ✅ **`buildArgs` accepts `mcpConfig?`/`allowedTools?`/`strictMcp?`** and appends the verified
  flags; the no-tools argv is **byte-identical** to today (the existing 8 `buildArgs` cases pass
  unchanged). Flag spellings confirmed against `claude -p --help` (recorded in research.md).
- ✅ **Pure `resolveTools`** returns the strict-flags result / `{ ok:false, missing }` /
  passthrough — unit-tested on all three required variants plus four edges. `bun test` 896/0.

## Test coverage

| Unit | Cases | Notes |
|------|-------|-------|
| `resolveTools` | 7 | undeclared→passthrough; declared+present→strict; declared+missing→andon (order preserved); empty-decl→strict-empty; allow-only; skills-carried-not-emitted; fresh-array (no aliasing) |
| `buildArgs` tool flags | 6 | each flag alone; empty-array guard; full composition + ordering; byte-identity back-compat |
| `buildArgs` (pre-existing) | 8 | unchanged — the regression guard for the no-tools argv |
| `Play.tools?` | via `tsc` | optionality proven by all six concrete plays compiling without the field |

Full suite: **896 pass / 0 fail across 58 files**; `tsc --noEmit` clean.

Coverage is complete for the slice: every deliverable is pure, so every deliverable is unit-
tested. No integration test is warranted — `dispense` (the one impure, process-spawning verb)
is unchanged and remains intentionally untested per the house rule.

## Verified external contract

`claude -p --help` was run this session; spellings/syntax are NOT assumed:
- `--mcp-config <configs...>` (path/string), `--allowedTools <tools...>` ("comma or
  space-separated"), `--strict-mcp-config` (boolean). Comma-join chosen for `allowedTools` so
  the variadic flag yields one unambiguous argv element. Details in research.md.

## Open concerns / limitations

1. **The flags are emitted but not yet threaded.** `buildArgs` can produce them, but nothing
   passes them in yet — `dispense`'s call site is unchanged. The live wiring (cast-time
   `resolveTools` call, `.mcp.json` read, andon, threading through `dispense`) is **T-032-02**,
   by design. Until then the new capability is dormant and the live path is byte-identical.
2. **`skills` is carried but inert.** The field exists on `PlayTools` and survives
   `resolveTools`, but nothing emits a skills flag (E-032 scope cut). A future slice wires it.
3. **Empty-declaration semantics (`tools: {}`)** mean strict-with-nothing, distinct from
   undeclared passthrough. This is intentional and tested, but it is a sharp edge an author
   could trip on (declaring `tools` at all opts into strict least-privilege). Worth a line in
   the authoring docs when T-032-02 surfaces the feature.
4. **`available` correctness is downstream.** `resolveTools` is only as correct as the server-id
   set passed in; producing that set faithfully from the project's MCP config is T-032-02's
   responsibility and its own test surface.

## Risk assessment

**Low.** The change is additive and fully back-compatible: one optional contract field, one
widened pure signature, one new pure function. The only external dependency (CLI flag spelling)
is verified and only affects T-032-02's live cast — a wrong spelling could never break the pure
argv tests here. No existing call path changed; the no-tools argv is byte-identical. Ready for
review and to unblock T-032-02.
