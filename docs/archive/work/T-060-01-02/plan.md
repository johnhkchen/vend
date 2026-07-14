# Plan — T-060-01-02: thread-reduced-grounding-marker-onto-run-record

Four ordered, independently-verifiable steps. Each leaves the gate
(`tsc --noEmit` + `bun test`) green and is committable atomically.

## Step 1 — run-log.ts: add the one-way `reducedGrounding` record field

**Edits** (`src/log/run-log.ts`):
1. `RunRecordInput`: add `readonly reducedGrounding?: boolean;` with doc (after `turnsUsed`).
2. `RunRecord`: add `readonly reducedGrounding?: true;` with doc (after `turnsUsed`).
3. Add `normalizeReducedGrounding(v): true | undefined` (after `normalizeIntervenedAttested`).
4. `buildRunRecord`: derive `const reducedGrounding = normalizeReducedGrounding(input.reducedGrounding);`
   and spread `...(reducedGrounding ? { reducedGrounding } : {})` in the frozen object.
5. `reviveRecord`: derive from `r.reducedGrounding` (boolean-guarded) and spread identically.

**Verify:** `bun x tsc --noEmit` clean (additive optional field, no break). `bun test
src/log/run-log.test.ts` still green (no behavior change to existing records — the field is
absent everywhere so every existing assertion holds byte-for-byte).

**Commit:** `feat(run-log): one-way reduced-grounding marker on the run record (T-060-01-02)`

## Step 2 — run-log.test.ts: prove the read boundary

**Edit** (`src/log/run-log.test.ts`): add a `describe("reducedGrounding marker … (T-060-01-02 AC)")`
block after the `turnsUsed` block, with five tests (modeled on the `turnsUsed` /
`intervenedAttested` blocks):

- `reducedGrounding: true` round-trips build → serialize → revive (`revived!.reducedGrounding === true`).
- absent ⇒ `"reducedGrounding" in rec === false` AND the serialized line excludes the substring.
- one-way: `buildRunRecord(baseInput({ reducedGrounding: false }))` omits the field.
- malformed-on-revive: `reviveRecord({ …validLine, reducedGrounding: "yes" })` keeps the record
  (`runId` intact) with `reducedGrounding === undefined`.
- legacy line (a literal JSONL string with no field) → `readRuns` skipped 0, field undefined.

**Verify:** `bun test src/log/run-log.test.ts` — all green, the new block included. This is
the AC's **"marker survives the revive/normalize read boundary"** proof at the pure layer.

**Commit:** `test(run-log): round-trip + read-boundary coverage for reduced-grounding marker (T-060-01-02)`

## Step 3 — cast.ts: thread the marker (and the honest stdout note)

**Edits** (`src/engine/cast.ts`, inside `castPlay`, all AFTER the `!resolved.ok` early-return):
1. After the `· turns:` stdout write: read the flag with the union-narrowing discriminant
   `const reducedGrounding = "reducedGrounding" in resolved && resolved.reducedGrounding;`
   and emit the one-line honest note when `true`.
2. In the end-of-cast `appendRunLog` input, add `...(reducedGrounding ? { reducedGrounding: true } : {})`
   alongside the existing `intervened` / `turnsUsed` conditional spreads.

The andon early-return `appendRunLog` is **not** touched (different condition; no marker).

**Verify:** `bun x tsc --noEmit` clean (the `in` narrowing typechecks against the
`ResolvedTools` union). `bun test src/engine/cast.test.ts` still green (existing tests use a
play with no `optionalMcp` ⇒ passthrough/strict-grounded ⇒ no marker ⇒ unchanged records).

**Commit:** `feat(cast): record the reduced-grounding marker + honest cast-time note (T-060-01-02)`

## Step 4 — cast.test.ts: the AC integration proof

**Edit** (`src/engine/cast.test.ts`): add a play fixture that declares
`tools: { optionalMcp: ["codebase-memory-mcp"], allow: ["Read","Grep","Glob"] }` (a small
`groundedEchoPlay` variant of the existing `echoPlay`), and two tests on the existing
tmp/stub/BIG_BUDGET harness:

1. **degraded** — tmp root with NO `.mcp.json`. Cast. Read `runs.jsonl`; assert the parsed
   line's `reducedGrounding === true`; assert `reviveRecord(JSON.parse(line)).reducedGrounding
   === true` (the end-to-end read-boundary close). Sanity: `outcome === "success"`.
2. **grounded** — write `<root>/.mcp.json` = `{"mcpServers":{"codebase-memory-mcp":{"command":"x"}}}`.
   Cast. Assert the parsed line has NO marker (`"reducedGrounding" in rec === false`).

**Verify:** `bun test src/engine/cast.test.ts` — both new tests green. This is the AC's
**"a decompose run executed without codebase-memory-mcp writes the marker (and a fully-grounded
run does not)"** proof through the real `resolveTools → castPlay → appendRunLog` chain.

**Commit:** `test(cast): degraded cast records the reduced-grounding marker, grounded does not (T-060-01-02)`

## Testing strategy summary

| AC clause | Proven by | Layer |
|---|---|---|
| degraded run writes the marker into runs.jsonl | cast.test.ts degraded test | integration (real chain) |
| fully-grounded run does not | cast.test.ts grounded test | integration |
| marker survives revive/normalize read boundary | run-log.test.ts round-trip + malformed + legacy; cast.test.ts `reviveRecord` close | pure + integration |
| one-way (`false` never written) | run-log.test.ts one-way test | pure |
| back-compat (legacy line, byte-identical grounded record) | run-log.test.ts absence + legacy tests | pure |

## Final gate

`bun run check` (the real gate — `tsc --noEmit` + full `bun test` + lint). Expect the full
suite green with +~7 new tests and the prior 1333 still passing. Record exact counts in
`review.md`.

## Risks / mitigations

- **Union narrowing on `resolved`**: `"reducedGrounding" in resolved` must narrow the
  `ResolvedTools` union to the strict variant. If TS does not narrow on the `in` operator for
  this union, fall back to `resolved.ok && "strict" in resolved && resolved.reducedGrounding`
  (the `ok` + `strict` discriminants are explicit literal fields). Verified at Step 3's typecheck.
- **`.mcp.json` shape in the grounded test**: must match `parseMcpServerIds`' expected
  `{ mcpServers: { … } }` shape, else `available` stays `[]` and the test mis-asserts. Mitigation:
  the structure.md/plan spell the exact literal; the grounded test's assertion (no marker) would
  fail loudly if the shape were wrong, so the test is self-checking.
