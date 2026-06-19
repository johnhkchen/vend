# T-021-03 — Structure: role-presets-save-load-seat-default

_The blueprint — files, boundaries, public interface, internal organization, ordering. Not
code; the shape of the code._

## Files

| File | Change | Purpose |
|---|---|---|
| `src/present/presets.ts` | **create** | Seat→preset table + pure canonical YAML serializer/deserializer + the two thin impure fs verbs (save/load seat spec). |
| `src/present/presets.test.ts` | **create** | Pure tests (seat table, serialize/deserialize, byte-equal at string level) + an fs round-trip test over a temp dir (AC coverage). |

New code only; **no existing file is modified or deleted**. `src/present/spec.ts` is imported
(types + presets + `validateSpec`), never edited. No new dependency: `Bun.YAML` +
`node:fs/promises` only (D2, research §"Constraints").

## `src/present/presets.ts` — internal organization (top → bottom)

Order mirrors `materialize.ts` / `run-log.ts`: header doc → imports → closed-set (seats) →
pure seat/preset table → pure serializer/deserializer → impure fs verbs.

### 1. Module header (the house discipline)

States: this is the **persistence + seat-default** layer over T-021-02's pure spec; the
pure/impure split (serializer + seat table pure and unit-tested; `saveSeatSpec`/`loadSeatSpec`
the two thin fs verbs, untested like `materialize`/`appendRunLog`); **byte-equal** is structural
(canonical serializer, fixed field order, D3); the §2b snake_case/`presentation:`-wrapper YAML
config is **deferred** to a future Linear-config loader (cf. `spec.ts` header); `Bun.YAML` is the
only serializer, no new dep.

### 2. Imports

```
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { DESIGNER_PRESET, DEV_PRESET, validateSpec } from "./spec.ts";
import type { PresentationSpec, Preset, SpecResult } from "./spec.ts";
```

`Bun.YAML` is a runtime global (no import), as in `model.ts`.

### 3. Seats (the `GATE_NAMES` idiom)

```
export const SEATS = ["designer", "dev"] as const;
export type Seat = (typeof SEATS)[number];
```

`founder` is intentionally excluded — it has no preset (research §"seat concept"). A `Seat` is
both the type and the runtime membership set.

### 4. Pure seat / preset table

- `defaultPresetForSeat(seat: Seat): PresentationSpec` — `designer → DESIGNER_PRESET`,
  `dev → DEV_PRESET`. Backed by one internal `Record<Seat, PresentationSpec>` constant so seat
  and named lookups share the source.
- `presetByName(name: Preset): PresentationSpec | null` — `designer → DESIGNER_PRESET`,
  `dev → DEV_PRESET`, `custom → null` (no canonical built-in for a tuned spec).

### 5. Pure serializer / deserializer (canonical, byte-equal — D3)

- `serializeSpec(spec: PresentationSpec): string` — build a fresh plain object in the **fixed
  canonical field order** (`preset, vocabulary, density, face, details, groupBy, metaphor,
  labels:{status}, colorLanguage`), then `Bun.YAML.stringify(obj, null, 2)`. Reads values only
  (never mutates the frozen input). `face`/`details` copied to plain arrays; `labels.status`
  copied to a plain object preserving key order. Deterministic by construction.
- `deserializeSpec(text: string, source?: string): SpecResult` — **total**: `Bun.YAML.parse`
  inside a `try`; on a YAML syntax error return `{ ok:false, violations:[{ field:"<yaml>",
  reason: "...source..." }] }`; otherwise hand the parsed value to `validateSpec` and return its
  verdict. Never throws (the budget.ts rule). `source` (a path) only enriches the error text.

### 6. Impure fs verbs (the two thin world-touching functions)

- `DEFAULT_PRESETS_DIR = ".vend/presets"` — the project-state dir convention (`run-log.ts`).
- `seatSpecPath(seat: Seat, dir = DEFAULT_PRESETS_DIR): string` — `join(dir, "${seat}.yaml")`.
  Pure path helper (no fs), exported so tests/callers can locate the file.
- `saveSeatSpec(seat, spec, dir?): Promise<string>` — `mkdir -p dirname` then `writeFile`
  `serializeSpec(spec)`; returns the path written. The `materialize`/`appendRunLog` write shape.
- `loadSeatSpec(seat, dir?): Promise<PresentationSpec>` — read the file; **ENOENT → return
  `defaultPresetForSeat(seat)`** (the `load.ts` tolerance, D4/D6); on a present file,
  `deserializeSpec` and if the verdict is `not-ok` **throw `PresentationSpecError(violations)`**
  (corrupt config is loud, D6) else return the spec. Re-uses `spec.ts`'s error class — imported
  for the throw.

## Public interface (exports)

```
// seats
SEATS, type Seat
defaultPresetForSeat, presetByName
// serialization (pure)
serializeSpec, deserializeSpec
// fs verbs + paths (impure / path)
DEFAULT_PRESETS_DIR, seatSpecPath, saveSeatSpec, loadSeatSpec
```

`PresentationSpecError` is **re-thrown** from `loadSeatSpec` but not re-exported (callers import
it from `spec.ts`, the single home of the type).

## `src/present/presets.test.ts` — coverage blueprint

`import { afterAll, describe, expect, test } from "bun:test";` plus `node:fs/promises`
(`mkdtemp`, `rm`, `readFile`) and `node:os`/`node:path` for a temp dir.

- **seat default (AC clause 3)** — `defaultPresetForSeat("designer") === DESIGNER_PRESET` (and
  its `vocabulary:plain · density:low · metaphor:tree`); `defaultPresetForSeat("dev") ===
  DEV_PRESET`.
- **named preset (AC clause 1)** — `presetByName("designer")` is `DESIGNER_PRESET`;
  `presetByName("dev")` is `DEV_PRESET`; `presetByName("custom")` is `null`.
- **serialize round-trips at the value level** — `deserializeSpec(serializeSpec(DESIGNER_PRESET))`
  is `{ ok:true }` with a spec `toEqual` `DESIGNER_PRESET`; same for `DEV_PRESET` (the empty
  status map path).
- **serialize is canonical / byte-stable** — `serializeSpec(parsed) === serializeSpec(spec)` even
  when the input object's keys are in a different order (build a reordered clone).
- **deserialize is total on bad input** — malformed YAML → `ok:false` with a `<yaml>` violation;
  an out-of-set knob (`density:"huge"`) → `ok:false` from `validateSpec`.
- **fs save → load round-trip is byte-equal (AC clause 2)** — in a temp dir: a **tuned** spec
  (`{ ...DESIGNER_PRESET, preset:"custom", density:"medium", vocabulary:"mixed" }`),
  `saveSeatSpec("designer", tuned, tmp)` → read raw bytes; `loadSeatSpec("designer", tmp)`
  `toEqual` tuned; save the reloaded spec again → raw bytes `toBe` the first bytes.
- **seat default via the fs verb** — `loadSeatSpec("designer", emptyTmp)` with **no file**
  returns `DESIGNER_PRESET` (ENOENT→default; the AC "by default" through the real verb).
- **corrupt saved file is loud** — write malformed YAML / an invalid spec to the seat path, then
  `loadSeatSpec` rejects with `PresentationSpecError`.
- **`seatSpecPath`** — composes `dir/seat.yaml`.

`afterAll` removes the temp dir.

## Ordering of changes (one atomic commit)

1. `src/present/presets.ts` (seats + table + serializer + fs verbs).
2. `src/present/presets.test.ts`.
3. `bun run check` green → commit. Single self-contained unit; depends only on the committed
   `spec.ts` (`depends_on: [T-021-02]`), touches no shared files, so no concurrency edge.
