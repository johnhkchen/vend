# T-026-02 — Structure: file-level blueprint

The shape of the `intervened`-through-`vend work` wiring. Pure pass-through, four edits + one test, mirroring the proven `run --intervened` and `model`/`project` paths. No new files, no deletions.

## Files modified

### 1. `src/play/chain-propose-decompose.ts` — carry the bit into both chain steps
- **`ChainProposeDecomposeOptions`** (l.34): add
  ```ts
  /** The E1 trust self-report (T-014-01) threaded session-level through `vend work`: did the
   *  author step in (`true`) or let the sweep clear (`false`)? Stamped on BOTH chain records
   *  (propose + decompose). Absent ⇒ field omitted ⇒ unknown — pass-through, like `model`. */
  readonly intervened?: boolean;
  ```
- **Step 1 (propose) `opts`** (l.93) and **Step 2 (decompose) `opts`** (l.111): add `intervened: opts.intervened` to each. `castPlay` already spreads `intervened` into `appendRunLog` only when defined, so passing `undefined` keeps the back-compat record shape (no key written). No conditional spread needed at this layer — `CastOptions.intervened` is already `?:`.

### 2. `src/play/work.ts` — accept + forward the session-level bit
- **`WorkOptions`** (l.48): add
  ```ts
  /** The E1 trust self-report for this walk-away session (T-026-02): forwarded to every chain
   *  cast so the sweep's records carry the bit. Absent ⇒ unknown (unreported). */
  readonly intervened?: boolean;
  ```
- **`castProposeDecomposeChain` call inside `spendDown`** (l.186): add to the cast options
  ```ts
  ...(opts.intervened !== undefined ? { intervened: opts.intervened } : {}),
  ```
  Conditional spread here keeps the chain-options object byte-identical when unreported (matches the `opts.model` spread directly above it).

### 3. `src/cli.ts` — parse + dispatch the flag
- **`ParsedCommand` work variant** (l.51–60): add
  ```ts
  /** The E1 trust self-report (T-014-01/T-026-02): `--intervened` ⇒ true, `--no-intervened` ⇒
   *  false, neither ⇒ absent. Spread only when supplied, so a bare `work` keeps its shape. */
  readonly intervened?: boolean;
  ```
- **`parseWorkArgs`** (l.372): after the loop (it already rejects unknown flags, so the two presence flags must be recognised *inside* the loop). Add two `else if` arms before the `else { unexpected }`:
  ```ts
  } else if (a === "--intervened") {
    intervened = true;
  } else if (a === "--no-intervened") {
    intervened = false;
  ```
  with `let intervened: boolean | undefined;` declared alongside `staleOk`, and the return extended:
  ```ts
  ...(intervened !== undefined ? { intervened } : {}),
  ```
- **Work dispatch arm** (l.605, the `castWork({...})` call): forward
  ```ts
  ...(parsed.intervened !== undefined ? { intervened: parsed.intervened } : {}),
  ```

### 4. `src/cli.test.ts` — parser unit tests (pure, addon-free)
New tests in the `parseArgs — work` describe block, mirroring the `run --intervened` block (l.323):
- `work --intervened` → `{ cmd: "work", intervened: true }`
- `work --no-intervened` → `{ cmd: "work", intervened: false }` (false is a value)
- bare `work` → no `intervened` key (back-compat shape)
- `work --intervened` composes with `--budget`/`--board`/`--stale-ok`
- `--no-intervened` + `--stale-ok` compose (both presence flags, order-independent)

## The threading chain (after the edits)

```
vend work --no-intervened
  → parseArgs → parseWorkArgs        : { cmd:"work", intervened:false }
  → cli work arm → castWork          : WorkOptions.intervened = false
  → castProposeDecomposeChain(opts)  : ChainProposeDecomposeOptions.intervened = false
  → PlayStep.opts (propose, decompose): CastOptions.intervened = false
  → castPlay → appendRunLog          : record.intervened = false   (both records)
  → .vend/runs.jsonl                 : 2 genuine bit-carrying records per cleared signal
  → vend audit                       : carriers += 2, counted toward walk-away rate
```

Identical in shape to the already-proven `vend run --no-intervened` path through `castPlay` (T-026-01); the only new spans are `WorkOptions` and `ChainProposeDecomposeOptions`, both pure data carriers.

## Module-boundary check (E-007 keystone)

- No new imports. `work.ts` already imports the chain; `chain-propose-decompose.ts` already imports the plays + engine. The new field rides existing edges. Engine ⊥ play unchanged (the bit is data, not engine logic).
- `cli.ts` stays addon-free in the parser (presence-flag string checks only; no play/BAML import), exactly as `parseRunArgs` does.

## Ordering of changes

1. `chain-propose-decompose.ts` (the leaf carrier) — typechecks alone.
2. `work.ts` (forwards into the chain) — depends on #1's new field.
3. `cli.ts` (parse + dispatch) — depends on #2's new `WorkOptions` field.
4. `cli.test.ts` — tests #3's parser.

Each step typechecks independently in order; the four can land as one atomic commit (one coherent feature) or split #1–#3 / #4. Chosen: one commit (small, cohesive), then a docs/evidence commit.

## Evidence artifacts (no code)

- `progress.md` — executed steps, gate results, the genuine-seed record state, the accumulation flag.
- `sweep-protocol.md` — how the user accrues ≥10 genuine records via real `vend work --no-intervened`/`--intervened` sweeps (the bounded multi-sitting background sweep, flagged per the AC).
- `review.md` — handoff: what changed, coverage, and the critical open concern (count not yet ≥10; accrues from real use).
