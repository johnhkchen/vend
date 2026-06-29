# Plan — T-060-01-01: ordered implementation steps

Five steps, each independently verifiable, ordered type-before-use so `bun run check` stays
green at every commit. The AC test lands in Step 5. One logical commit recommended (the
change is small and cohesive); the steps below are the internal sequence.

## Step 1 — extend `PlayTools` with `optionalMcp`

**File**: `src/engine/play.ts` (interface at ~135-140).
- Add `readonly optionalMcp?: readonly string[];` between `mcp` and `allow`.
- Doc-comment it in the established voice: optional servers; present ⇒ scoped like a required
  MCP; absent ⇒ degrade (reducedGrounding), not andon; declaring it opts into strict scoping.
- Also annotate `mcp` as the REQUIRED list (absent ⇒ andon) for contrast.

**Verify**: `bun run check` (typecheck) — additive optional field, nothing else compiles
differently. No test asserts on the interface directly.

## Step 2 — extend `ResolvedTools` + `resolveTools`

**File**: `src/engine/cast-core.ts`.
- Add `reducedGrounding: boolean` to the strict success variant (~75-78).
- Update the `ResolvedTools` doc-block (~59-74) describing the new field.
- Rewrite `resolveTools` body (~95-108):
  - `required = declared.mcp ?? []`; required-missing ⇒ `{ ok:false, missing }` (unchanged).
  - compute `optional`, `presentOptional`, `absentOptional`,
    `reducedGrounding = absentOptional.length > 0`.
  - `scopes` now also true when `declared.optionalMcp !== undefined`.
  - strict result: `mcp: [...required, ...presentOptional]`, `reducedGrounding`.
  - passthrough branch unchanged.
- Update the `resolveTools` doc-block (~80-94) with the optional-MCP outcome.
- Confirm `toolFlags` needs no edit (reads `resolved.mcp`, ignores the new field).

**Verify**: `bun run check`. Existing `resolveTools` strict tests will FAIL here (missing
`reducedGrounding`) — expected; fixed in Step 5. Run targeted check after Step 5.

## Step 3 — reclassify `DECOMPOSE_TOOLS`

**File**: `src/play/decompose-epic-core.ts` (~68-72).
- `mcp: ["codebase-memory-mcp"]` → `optionalMcp: ["codebase-memory-mcp"]`.
- Update the doc-block (~51-67): the bullet becomes `optionalMcp:` with the degrade rationale
  (E-060 #3; P2/P5 onboarding friction; the steer→board path never needs the MCP).

**Verify**: `bun run check`. The argv present-case live-proof (cast-core.test.ts:301-310)
asserts membership, not object shape — stays green (codebase-memory-mcp present ⇒ still
scoped). The WIRING GUARD (366-373) reads `DECOMPOSE_TOOLS.deny` — unaffected.

## Step 4 — update the inline comment in `decompose-epic.ts`

**File**: `src/play/decompose-epic.ts` (~202-204).
- Replace the "andons before dispense" sentence with the degrade truth: optional grounding
  server, present ⇒ scoped, absent ⇒ reduced-grounding clear (not andon). Comment-only.

**Verify**: `bun run check` (no behavioral change).

## Step 5 — tests (the AC + regression guards)

**File**: `src/engine/cast-core.test.ts`.

5a. **Update three strict `toEqual`s** (lines ~163-172, ~185-193, ~210-218) to include
`reducedGrounding: false`. The fresh-array test (~220-228) is unaffected.

5b. **Rewrite the `ABSENT MCP` test** (~317-322) — the AC assertion:
```ts
test("ABSENT optional MCP (registry lacks codebase-memory) ⇒ degraded strict result, reducedGrounding, NO andon", () => {
  const resolved = resolveTools(DECOMPOSE_TOOLS, []); // fresh seed, no .mcp.json
  expect(resolved).toEqual({
    ok: true,
    mcp: [],
    allowedTools: ["Read", "Grep", "Glob"],
    deny: ["AskUserQuestion"],
    strict: true,
    reducedGrounding: true,
  });
  const argv = buildArgs(toolFlags(resolved, PATH));
  expect(argv).toContain("--allowedTools");
  expect(argv[argv.indexOf("--allowedTools") + 1]).toBe("Read,Grep,Glob");
  expect(argv).toContain("--strict-mcp-config");
  expect(argv).not.toContain("--mcp-config");
  expect(argv.join(",")).not.toContain("mcp__codebase-memory-mcp");
});
```

5c. **Add optional-MCP unit tests** in the `resolveTools` suite:
- optional present ⇒ scoped, `reducedGrounding:false`:
  `resolveTools({ optionalMcp:["a"], allow:["Read"] }, ["a"])` ⇒
  `{ ok:true, mcp:["a"], allowedTools:["Read"], deny:[], strict:true, reducedGrounding:false }`.
- optional absent ⇒ dropped + flag:
  `resolveTools({ optionalMcp:["a"], allow:["Read"] }, [])` ⇒
  `{ ok:true, mcp:[], allowedTools:["Read"], deny:[], strict:true, reducedGrounding:true }`.
- mix: one required present, one optional absent ⇒ strict, mcp=[req], reducedGrounding true.
- **required absent still andons** (regression):
  `resolveTools({ mcp:["z"], optionalMcp:["a"] }, ["a"])` ⇒ `{ ok:false, missing:["z"] }`.
- optional-only present ⇒ strict (opts into scoping):
  `resolveTools({ optionalMcp:["a"] }, ["a"])` ⇒ strict, mcp=["a"], allowedTools=[], reducedGrounding false.

5d. **Add a `toolFlags` test** for the degraded shape (no mcpConfig):
`toolFlags(resolveTools({ optionalMcp:["a"], allow:["Read"] }, []), PATH)` ⇒
`{ allowedTools:["Read"], strictMcp:true }` (no `mcpConfig`).

**Verify**: `bun test src/engine/cast-core.test.ts` green; then full `bun run check`.

## Testing strategy

- **Unit (pure)**: all behavior lands on `resolveTools`/`toolFlags` in `cast-core.test.ts` —
  no BAML addon, no fs, no spawn. This is the AC's required surface.
- **Live-proof (pure argv)**: `buildArgs(toolFlags(...))` asserts the real decompose argv in
  both present and absent cases — proves the degrade end-to-end at the argv boundary without
  casting.
- **Regression**: the required-absent-still-andons test guards that reclassification did NOT
  erase the STOP capability (IA-17).
- **No integration test needed**: `castPlay` is impure and explicitly not unit-tested; its
  branching is unchanged (`resolved.ok` stays true), so the pure tests fully cover the AC.

## Verification criteria (done)

1. `resolveTools(DECOMPOSE_TOOLS, [])` returns a degraded strict result with
   `reducedGrounding: true` — NOT `{ ok:false }`. ✔ AC.
2. The projected argv carries read-only built-ins + strict, omits `--mcp-config` and the
   `mcp__` wildcard. ✔ AC ("completes with reduced-grounding tools").
3. Present case (`available` includes codebase-memory-mcp) is byte-identical to today
   (`reducedGrounding:false`, full argv). ✔ back-compat.
4. A genuinely required missing MCP still andons. ✔ IA-17 preserved.
5. `bun run check` green (typecheck + lint + full test). ✔ the real gate.

## Out of scope (carried to siblings)

- Writing the marker onto the runs.jsonl record + the revive/normalize boundary →
  **T-060-01-02** (depends on this). This ticket only surfaces `reducedGrounding` on the
  resolution result; it does not touch `appendRunLog`.
- The cold-start budget calibration → S-060-02. The live re-drive + gold-master flip → S-060-03.
