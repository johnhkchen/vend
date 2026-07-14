# T-015-02 Structure — file-level blueprint

The shape of the change. Five source files modified, two test files extended. No files
created or deleted. No new modules, no new import edges (all edits ride existing imports).

## Files modified (source)

### 1. `src/executor/claude.ts` — type `num_turns`

One edit. `ResultMessage` (≈ line 34) gains one optional field after `total_cost_usd?`:

```ts
  /** Agentic turns the run took, off the terminal result. Surfaced/logged for cap
   *  calibration (T-015-02). Absent when the stream named none. */
  num_turns?: number;
```

Additive to an open record type — every existing field/use unchanged. Lets cast.ts read
`result.num_turns` as `number | undefined` instead of `unknown`.

### 2. `src/engine/play.ts` — the warranted-default field on the contract

One edit. `Play<I,O>` (≈ line 138) gains one optional field after `budget`:

```ts
  /** The warranted default agentic turn cap (the mid-flight bound, IA-8) — overridable
   *  per cast via `CastOptions.maxTurns`. Omitted ⇒ no default ⇒ turns bounded only by
   *  the wall-clock latch + the token budget. The per-play sibling of `budget`. */
  readonly maxTurns?: number;
```

Optional ⇒ every existing `Play` literal (ProposeEpic, note, etc.) still satisfies the
contract unchanged. No import change (`maxTurns` is a primitive).

### 3. `src/engine/cast-core.ts` — two pure resolvers (the testable hearts)

Two additions (pure, addon-free, unit-tested):

```ts
/** Resolve the effective turn cap: the per-cast override wins, else the play's warranted
 *  default, else undefined (no cap). PURE — pins the AC1 precedence contract. */
export function resolveMaxTurns(override: number | undefined, dflt: number | undefined): number | undefined {
  return override ?? dflt;
}

/** Harvest turns-used off the terminal result's `num_turns`. PURE & TOTAL — keep only a
 *  finite, non-negative integer; anything else (absent / NaN / negative / non-number) ⇒
 *  undefined, so the run-log field is omitted (reads as unknown), never a lie. */
export function resolveTurnsUsed(numTurns: unknown): number | undefined {
  return typeof numTurns === "number" && Number.isInteger(numTurns) && numTurns >= 0 ? numTurns : undefined;
}
```

Mirror `resolveLoggedModel`'s placement/role. `cast.ts` already re-exports `*` from
cast-core, so callers reach them through the engine entry.

### 4. `src/engine/cast.ts` — resolve the cap, harvest + log + surface the turns

Three edits inside `castPlay`, all using values already in scope:

- **4a — resolve the cap before dispense** (replacing the bare `opts.maxTurns` pass at
  ≈ line 126):

```ts
  const maxTurns = resolveMaxTurns(opts.maxTurns, play.maxTurns);
  …
  result = await dispense({
    prompt,
    model: opts.model,
    maxTurns,                // override ?? play default ?? undefined (no flag)
    onMessage,
    timeoutMs: timeoutMsFor(budget),
  });
```

  `resolveMaxTurns` comes via the existing `export * from "./cast-core.ts"` (it is imported
  into scope already through `import { classify, makeStreamSink, resolveLoggedModel }` —
  add `resolveMaxTurns, resolveTurnsUsed` to that import list).

- **4b — harvest turns after the seam** (near the `loggedModel` resolution, ≈ line 180):

```ts
  const turnsUsed = resolveTurnsUsed(result?.num_turns);
```

- **4c — log it + surface it.** Spread into the `appendRunLog` input alongside
  `intervened` (≈ line 197), and add a stdout line near the effect/andon writes:

```ts
      ...(turnsUsed !== undefined ? { turnsUsed } : {}),
```

```ts
  if (turnsUsed !== undefined) process.stdout.write(`· turns: ${turnsUsed}\n`);
```

  (The stdout line goes after the effect/andon block so it reads as a run-summary footer.)

### 5. `src/log/run-log.ts` — the `turnsUsed?` field (write + read)

Follows the `intervened` pattern exactly. Five small edits:

- **5a — `RunRecordInput`** (≈ line 121, after `intervened?`):

```ts
  /** Agentic turns the cast took (T-015-02), harvested off the seam's `result.num_turns`.
   *  Absent ⇒ field omitted (unknown) — back-compat, like `intervened`. The signal the
   *  turn cap is calibrated from. */
  readonly turnsUsed?: number;
```

- **5b — `RunRecord`** (≈ line 149, after `intervened?`): same field + "Present ONLY when
  the cast supplied one — absence is meaningful (unknown)" doc, mirroring siblings.

- **5c — `normalizeTurnsUsed`** (a helper beside `normalizeIntervened`, ≈ line 215):

```ts
/** Normalize turns-used (T-015-02): a finite non-negative integer is taken verbatim;
 *  anything else (absent / non-finite / negative / non-integer) ⇒ undefined ⇒ field
 *  omitted (reads unknown). Absence is LEGAL back-compat — coerce, don't assert. */
function normalizeTurnsUsed(v: number | undefined): number | undefined {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : undefined;
}
```

- **5d — `buildRunRecord`** (≈ line 245): `const turnsUsed = normalizeTurnsUsed(input.turnsUsed);`
  and spread `...(turnsUsed !== undefined ? { turnsUsed } : {})` in the frozen record
  (beside `intervened`).

- **5e — `reviveRecord`** (≈ line 347): `const turnsUsed = typeof r.turnsUsed === "number"
  && Number.isInteger(r.turnsUsed) && r.turnsUsed >= 0 ? r.turnsUsed : undefined;` and the
  same conditional spread, beside `intervened`.

`RUN_LOG_SCHEMA_VERSION` stays `1` (additive optional field — same call as envelope/project/
intervened).

### 6. `src/play/decompose-epic-core.ts` — the justified constant

One addition (addon-free, so testable):

```ts
/**
 * DecomposeEpic's warranted default agentic turn cap (T-015-02), set on
 * `decomposeEpicPlay.maxTurns`. JUDGMENT, not a frozen guess:
 *  - clean decompose runs land at 1–7 turns (live transcripts; `num_turns` 1,2,2,3,4,7);
 *  - the ~85–95k token tail (E-014 E2, 2026-06-19) is agentic WANDERING, not input size;
 *  - 15 ≈ 2× the observed clean-run ceiling — generous (no false andon on a legitimate
 *    run, AC4) yet bounds the unbounded wander behind the tail (AC3).
 * turnsUsed is now logged so this is refined from data, not frozen (see design.md D2).
 */
export const DECOMPOSE_MAX_TURNS = 15;
```

### 7. `src/play/decompose-epic.ts` — wire the constant onto the play

Two edits:

- Import the constant from the core (the module already imports nothing runtime from the
  core — it re-exports `*`; add a named value import):
  `import { DECOMPOSE_MAX_TURNS } from "./decompose-epic-core.ts";`
  (If a circular-ish concern arises, the constant can be declared inline on the play with
  the same doc-comment; plan.md picks the cleaner of the two after a typecheck.)
- Add `maxTurns: DECOMPOSE_MAX_TURNS,` to the `decomposeEpicPlay` literal (after `budget`).

## Files extended (tests)

### 8. `src/engine/cast-core.test.ts`

- `resolveMaxTurns`: override wins over default; default applies when override absent;
  neither ⇒ undefined; `0` override is returned as-is (precedence is `??`, the seam folds
  `0` to absent downstream — documented, not re-tested here).
- `resolveTurnsUsed`: a finite int passes; `undefined`/`NaN`/`-1`/`"3"`/`2.5` ⇒ undefined.

### 9. `src/log/run-log.test.ts`

Mirror the envelope/intervened blocks:
- `buildRunRecord` carries `turnsUsed` through and round-trips via serialize/parse;
- absent `turnsUsed` ⇒ field OMITTED (not null), serialized line has no `turnsUsed` key;
- non-finite/negative/non-integer ⇒ omitted;
- `reviveRecord` keeps a valid `turnsUsed`, drops a malformed one without rejecting the
  record, and a pre-field line revives unchanged.

### 10. `src/play/decompose-epic.test.ts` (pure core import)

Assert `DECOMPOSE_MAX_TURNS === 15` (the value, pinned with its rationale) and that it is a
positive integer — locks the judgment against an accidental edit.

## Module boundaries — unchanged

- claude.ts stays the pure-argv + thin-spawn seam (only a type field added).
- play.ts stays types + registry (one optional field).
- cast-core.ts gains two pure resolvers; cast.ts threads them (no new import edge —
  cast-core already imported).
- run-log.ts keeps its zero-coupling invariant (the field is a plain number; no src/executor
  or src/budget import).
- decompose-epic-core.ts stays addon-free (a constant); decompose-epic.ts wires it.

## Ordering of changes (commit plan preview)

1. run-log.ts + run-log.test.ts — the `turnsUsed` field (self-contained, green).
2. claude.ts + cast-core.ts + cast-core.test.ts — type + pure resolvers (green).
3. play.ts + decompose-epic-core.ts + decompose-epic(.test).ts — the contract field, the
   justified constant, the wire.
4. cast.ts — thread resolve + harvest + log + surface (typecheck + existing live path).

plan.md sequences and defines verification per step.
