# Structure — T-060-01-02: thread-reduced-grounding-marker-onto-run-record

## File-level change map

| File | Change | Kind |
|---|---|---|
| `src/log/run-log.ts` | Add `reducedGrounding` to input + record contracts, a normalizer, and the build + revive spreads | modify (source) |
| `src/engine/cast.ts` | Read `reducedGrounding` off `resolved`, spread it into the end-of-cast `appendRunLog`; one honest stdout note | modify (source) |
| `src/log/run-log.test.ts` | New `describe` block: round-trip / absence / one-way / malformed / legacy | modify (test) |
| `src/engine/cast.test.ts` | Two integration tests: degraded cast writes the marker, grounded cast does not | modify (test) |

No files created or deleted (besides work artifacts). No schema-version bump.

## `src/log/run-log.ts` — the record-shape change (this ticket's core surface)

Five edits, each mirroring the `intervenedAttested` (T-028-01) one-way precedent exactly:

1. **`RunRecordInput`** (after `turnsUsed`, ~line 136) — add:
   ```ts
   /** One-way honest marker (T-060-01-02, E-060 #3): `true` ⇒ this cast ran with REDUCED
    *  grounding — a declared `optionalMcp` server was absent and dropped from the scoped set
    *  (resolveTools' `reducedGrounding`). Absent ⇒ fully grounded (the default) / unknown.
    *  Only `true` is meaningful, so this is a one-way flag exactly like {@link intervenedAttested}:
    *  `false`/absent are identical (both not-degraded) and `false` is never written, keeping a
    *  fully-grounded record byte-identical to a pre-T-060-01-02 one. The signal that makes a
    *  degraded clear COUNTABLE (a degraded run = a record carrying this marker). */
   readonly reducedGrounding?: boolean;
   ```

2. **`RunRecord`** (after `turnsUsed`, ~line 175) — add the matching documented optional field:
   ```ts
   /** Present ONLY when `true` (T-060-01-02) — this cast ran with reduced grounding. A one-way
    *  marker like {@link intervenedAttested}: `false` is never written, so a fully-grounded
    *  record stays byte-identical to a pre-T-060-01-02 one. {@link reviveRecord} preserves it
    *  across the read boundary, so a degraded clear stays countable after a ledger round-trip. */
   readonly reducedGrounding?: true;
   ```

3. **Normalizer** (next to `normalizeIntervenedAttested`, ~line 249) — the one-way coercion:
   ```ts
   /** Normalize the reduced-grounding marker (T-060-01-02): a ONE-WAY flag — only `true` is
    *  meaningful (this cast ran with reduced grounding). Anything else (`false`, absent, or a
    *  non-boolean from a torn caller) ⇒ `undefined`, so the field is omitted and a fully-grounded
    *  record stays byte-identical to a pre-T-060-01-02 one. Mirrors {@link normalizeIntervenedAttested}. */
   function normalizeReducedGrounding(v: boolean | undefined): true | undefined {
     return v === true ? true : undefined;
   }
   ```

4. **`buildRunRecord`** — derive (~after the `turnsUsed` derivation, ~line 289) and spread
   (~after the `turnsUsed` spread, ~line 305):
   ```ts
   const reducedGrounding = normalizeReducedGrounding(input.reducedGrounding);
   // …
   ...(reducedGrounding ? { reducedGrounding } : {}),
   ```

5. **`reviveRecord`** — derive on read (~after the `turnsUsed` revive derivation, ~line 410)
   and spread (~after the `turnsUsed` spread, ~line 426). The read boundary re-runs the same
   one-way normalizer, so a malformed value drops and a legacy line parses with the field absent:
   ```ts
   const reducedGrounding = normalizeReducedGrounding(typeof r.reducedGrounding === "boolean" ? r.reducedGrounding : undefined);
   // …
   ...(reducedGrounding ? { reducedGrounding } : {}),
   ```

**Boundary contracts preserved:** write face still asserts loudly on required strings (no new
assert — the marker is optional, coerce-don't-throw like its siblings); read face still degrades
quietly (malformed marker dropped, never rejects the record). Zero new imports — `boolean` is a
local primitive, the zero-coupling invariant holds.

## `src/engine/cast.ts` — the wiring

Two edits in `castPlay`, both AFTER the `!resolved.ok` early-return (so the andon record is
untouched):

1. **Read the flag + honest stdout note** — near the other post-resolve stdout lines (after
   the `· turns:` write, ~line 277), before the end-of-cast `appendRunLog`:
   ```ts
   // The honest reduced-grounding signal (E-060 #3, T-060-01-02): `resolved.reducedGrounding`
   // exists only on the strict variant; the `in` check narrows the union, the `&&` collapses
   // the strict-but-grounded case to false. One-way: only a degrade is surfaced/recorded.
   const reducedGrounding = "reducedGrounding" in resolved && resolved.reducedGrounding;
   if (reducedGrounding) process.stdout.write("· reduced grounding — optional codebase-memory MCP absent; proceeding (degraded, recorded)\n");
   ```

2. **Spread into the end-of-cast `appendRunLog`** — alongside the existing conditional spreads
   (`intervened`, `turnsUsed`), ~line 300:
   ```ts
   // The reduced-grounding marker (T-060-01-02) — one-way, spread only when degraded so a
   // fully-grounded cast (and every pre-T-060-01-02 record) leaves the field off, byte-identical.
   ...(reducedGrounding ? { reducedGrounding: true } : {}),
   ```

`castPlay` stays the single untested impure verb (house rule); the new line is pure
pass-through data, exactly like `intervened`/`turnsUsed` before it.

## `src/log/run-log.test.ts` — pure read-boundary coverage

New `describe("reducedGrounding marker — round-trip, absence, one-way, malformed, legacy (T-060-01-02 AC)")`
after the `turnsUsed` block (~line 508), modeled on it + the `intervenedAttested` block:

- `reducedGrounding: true` round-trips build → serialize → revive (`=== true`).
- absent ⇒ field omitted, `serializeRunRecord` line contains no `reducedGrounding` (back-compat).
- one-way: `buildRunRecord({ reducedGrounding: false })` omits the field (never written).
- malformed-on-revive: a junk `reducedGrounding` value drops, the record stays valid (runId intact).
- legacy line (no field) parses with `reducedGrounding === undefined`, `skipped: 0`.

Add `reducedGrounding` is reachable via the existing `RunRecordInput` import — no new test import.

## `src/engine/cast.test.ts` — the AC integration proof

A play fixture declaring the optional MCP (extend the existing `echoPlay`, or a small sibling
`groundedEchoPlay` that adds `tools: { optionalMcp: ["codebase-memory-mcp"], allow: ["Read","Grep","Glob"] }`).
Two tests:

1. **degraded** — cast under a tmp root with NO `.mcp.json` ⇒ `available: []` ⇒
   `reducedGrounding:true`. Read `runs.jsonl`, assert the parsed line has
   `reducedGrounding === true`, and `reviveRecord(JSON.parse(line)).reducedGrounding === true`
   (the read-boundary half, end-to-end).
2. **grounded** — write a `.mcp.json` declaring `codebase-memory-mcp` under the tmp root, cast,
   assert the line has NO `reducedGrounding` field (`"reducedGrounding" in rec === false`).

Both reuse the existing `tmp()` / `stubExecutor` / `BIG_BUDGET` harness; only the play's
`tools` and the per-test `.mcp.json` differ.

## Ordering of changes (matters for a green gate at each step)

1. run-log.ts contract + normalizer + build/revive (compiles standalone; field is additive).
2. run-log.test.ts block (proves the pure pair; green without touching cast).
3. cast.ts wiring (depends on #1's input field existing).
4. cast.test.ts integration (depends on #1 + #3).

Each step leaves `tsc --noEmit` and `bun test` green, so commits are atomic and bisectable.
