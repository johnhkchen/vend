# T-015-01 Plan — ordered implementation steps

Three small steps, each independently verifiable. Total surface: two source files +
one test file. Following the structure.md blueprint.

## Step 1 — the seam mechanism (`src/executor/claude.ts`)

Three local edits in one file:
1. `buildArgs` — extend inline param type with `maxTurns?: number`; add
   `if (maxTurns) args.push("--max-turns", String(maxTurns));` as the **last** guarded
   push.
2. `DispenseOptions` — add `maxTurns?: number` with a "Omitted ⇒ no flag" doc comment,
   clustered with the other flag options.
3. `dispense` — add `maxTurns` to the destructure and to the `buildArgs({…})` call.

**Verify:** `bun run check:typecheck` compiles. (Behaviour locked by Step 2 tests.)

## Step 2 — unit tests (`src/executor/claude.test.ts`)

Extend the `buildArgs` block. Add these tests (matching the existing `test(...)` +
`expect(...).toEqual(...)` style):

1. **"buildArgs: appends max-turns when supplied, composes with all flags"** —
   `buildArgs({ model: "m", effort: "low", system: "s", maxTurns: 5 })` →
   `["-p","--output-format","stream-json","--verbose","--model","m","--effort","low","--system-prompt","s","--max-turns","5"]`.
   Locks composition + ordering (max-turns last) + stringification in one assertion.
2. **"buildArgs: max-turns alone"** — `buildArgs({ maxTurns: 3 })` →
   `["-p","--output-format","stream-json","--verbose","--max-turns","3"]`. Mirrors the
   existing "omits each flag independently" style.
3. **"buildArgs: max-turns absent ⇒ no flag"** — assert `buildArgs()` and
   `buildArgs({ model: "m" })` contain no `"--max-turns"` (e.g. via
   `.not.toContain("--max-turns")` and/or the existing base-argv `toEqual`). Locks AC #1
   byte-for-byte invariance.
4. **"buildArgs: max-turns 0 is treated as absent (falsy guard)"** —
   `buildArgs({ maxTurns: 0 })` `toEqual` the base argv. Locks design §Guard option A
   against regression.

**Why these and not a dispense test:** `dispense` spawns a process and is intentionally
not unit-tested (file header, test lines 14–17). All new behaviour is in the pure
`buildArgs`, so coverage lands entirely there. This is the same coverage shape used for
`model`/`effort`/`system`.

**Verify:** `bun test src/executor/claude.test.ts` green; the four new tests plus all
existing `buildArgs` tests pass (the existing 3-flag golden array is untouched).

## Step 3 — thread through the cast (`src/engine/cast.ts`)

Two edits:
1. `CastOptions` — add `readonly maxTurns?: number` after `model?`, with the IA-8 doc
   comment from structure.md.
2. The `dispense({…})` call inside `castPlay` — add
   `maxTurns: opts.maxTurns, // undefined ⇒ no --max-turns flag ⇒ unbounded turns`.

**Verify:** `bun run check:typecheck` compiles; existing `cast-core.test.ts` still
green (the pure core is untouched — this is a pass-through field).

**Why no cast-level unit test:** `castPlay` is the single untested impure shell (its
judgment lives in the pure `cast-core.ts`, which this change does not touch). `maxTurns`
is pure pass-through data, exactly like `project`/`intervened`/`skipGates` — added the
same way, type-checked, and exercised on the live cast path. Adding a spawn-based test
here would contradict the module's stated test rule.

## Step 4 — full gate

Run `bun run check` (baml:gen + typecheck + full `bun test`). All green is the AC #4
bar. Confirm:
- The full suite passes (no regression in cast-core, chain, play, or seam tests).
- typecheck clean (the two additive optional fields compile for all existing callers).

## Testing strategy summary

| What | Test type | Where |
|------|-----------|-------|
| `buildArgs` emits `--max-turns` when set | unit | claude.test.ts |
| `buildArgs` omits flag when absent (byte-for-byte) | unit | claude.test.ts |
| `buildArgs` falsy-0 guard | unit | claude.test.ts |
| `buildArgs` composes with model/effort/system | unit | claude.test.ts |
| `maxTurns` number stringified in argv | unit | claude.test.ts |
| `CastOptions.maxTurns` threads to dispense | typecheck + live path | (no unit) |
| stream-parse / budget / gate unaffected | existing suite (regression) | full `bun test` |

## Commit plan

- **Commit 1:** Steps 1+2 — seam mechanism + its unit tests (self-contained, green).
- **Commit 2:** Step 3 — thread `maxTurns` through `CastOptions` → `dispense`.

Two atomic commits keep the pure mechanism and the wiring separable in history. Could
collapse to one given the small surface; will use two for a clean diff boundary between
"the flag exists" and "the cast can set it."

## Risk / rollback

- Risk is near-zero: additive optional fields + one guarded push, all behind
  truthiness so absent ⇒ identical behaviour. The byte-for-byte AC is directly tested.
- Rollback = revert the two commits; no data/schema/migration involved.
- No new dependency, no config change, no `.vend/` format change.
