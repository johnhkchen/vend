# T-015-01 Structure — file-level blueprint

The shape of the change. Two source files modified, one test file extended. No files
created or deleted. No new imports, no new modules.

## Files modified

### 1. `src/executor/claude.ts`

Two edits, both small and local.

**Edit 1a — `DispenseOptions` (interface, ~line 65).** Add one optional field after
`system?`:

```ts
  /** Optional agentic turn cap → `--max-turns <n>`. Omitted ⇒ no flag. */
  maxTurns?: number;
```

Placed adjacent to the other CLI-flag options (`model`/`effort`/`system`), before the
behavioural options (`onMessage`/`timeoutMs`), so the "flag options" cluster reads as a
group.

**Edit 1b — `buildArgs` (function, ~line 107).** Extend the inline parameter type and
add the guarded push:

```ts
export function buildArgs(
  { model, effort, system, maxTurns }:
    { model?: string; effort?: string; system?: string; maxTurns?: number } = {},
): string[] {
  const args = ["-p", "--output-format", "stream-json", "--verbose"];
  if (model) args.push("--model", model);
  if (effort) args.push("--effort", String(effort));
  if (system) args.push("--system-prompt", system);
  if (maxTurns) args.push("--max-turns", String(maxTurns));
  return args;
}
```

The new line lands **last** so the existing-flags ordering is untouched. `String(...)`
coercion mirrors `effort`.

**Edit 1c — `dispense` (function, ~line 248).** Destructure `maxTurns` and forward it
into `buildArgs`:

```ts
export async function dispense(
  { prompt, model, effort, system, maxTurns, onMessage, timeoutMs }: DispenseOptions,
): Promise<ResultMessage> {
  const args = buildArgs({ model, effort, system, maxTurns });
  ...
```

Only two tokens change: the destructure adds `maxTurns`, and the `buildArgs({…})` call
gains `maxTurns`. Everything downstream of `const args` is untouched.

### 2. `src/engine/cast.ts`

Two edits.

**Edit 2a — `CastOptions` (interface, ~line 34).** Add one `readonly` field. Placed
after `model?` (the analogue it copies) and before `runId?`:

```ts
  /** Optional agentic turn cap (IA-8, the mid-flight bound) → threaded to the seam as
   *  `--max-turns`. Omitted ⇒ no flag ⇒ a run bounded only by wall-clock + budget. */
  readonly maxTurns?: number;
```

**Edit 2b — the `dispense({…})` call (inside `castPlay`, ~line 120).** Add one line to
the call, mirroring the `model` pass-through:

```ts
    result = await dispense({
      prompt,
      model: opts.model, // undefined ⇒ no --model flag ⇒ CLI default
      maxTurns: opts.maxTurns, // undefined ⇒ no --max-turns flag ⇒ unbounded turns
      onMessage,
      timeoutMs: timeoutMsFor(budget),
    });
```

## Files extended (tests)

### 3. `src/executor/claude.test.ts`

Extend the existing `buildArgs` block (lines 19–51). No new test file. Add/adjust:

- **Extend "appends model/effort/system when supplied"** OR add a focused
  "appends max-turns when supplied" test asserting `--max-turns` + stringified value
  appear, and that it composes with `model`/`effort`/`system` (all four flags, in
  order). Decision in plan.md: add a dedicated composition test so the existing test's
  golden array stays a stable 3-flag reference and a new test owns the 4-flag case.
- **Add "max-turns: omitted ⇒ no flag"** — `buildArgs({ model: "m" })` (and
  `buildArgs()`) contain no `--max-turns`. Reinforces the byte-for-byte AC.
- **Add "max-turns: falsy 0 is treated as absent"** — `buildArgs({ maxTurns: 0 })`
  equals the base argv, locking the guard decision (design §Guard option A) against
  regression.
- **Add "max-turns: number is stringified in argv"** — `buildArgs({ maxTurns: 5 })`
  yields `[..., "--max-turns", "5"]` (string `"5"`, not number `5`).

## Module boundaries — unchanged

- `claude.ts` stays the pure-argv + thin-spawn seam. `buildArgs` remains pure; the new
  guard adds no I/O, no validation, no new dependency.
- `cast.ts` stays the play-agnostic impure spine. The new field is pure pass-through
  data (like `project`/`intervened`), threaded to exactly one call site.
- No import edges added in either direction. `cast.ts` already imports `dispense` from
  `claude.ts`; the inline `buildArgs` param type stays inline (not `DispenseOptions`),
  so the pure builder gains no coupling.

## Ordering of changes

The edits are independent at the type level but have a natural commit order:
1. `claude.ts` (buildArgs + DispenseOptions + dispense) — the mechanism.
2. `claude.test.ts` — lock the mechanism with unit tests (green before proceeding).
3. `cast.ts` (CastOptions + call site) — the threading.

Steps 1–2 are self-contained and verifiable (`bun test`). Step 3 is type-checked and
relies on the already-proven live cast path. Could be one commit (small surface) or two
(seam, then thread); plan.md sequences this.

## Public interface deltas

- `DispenseOptions` gains optional `maxTurns?: number` — additive, backward-compatible.
- `CastOptions` gains optional `readonly maxTurns?: number` — additive,
  backward-compatible.
- `buildArgs`'s parameter type gains optional `maxTurns?` — additive; existing callers
  (`buildArgs()`, `buildArgs({ model })`, etc.) compile and behave unchanged.

No removals, no signature breaks, no renames.
