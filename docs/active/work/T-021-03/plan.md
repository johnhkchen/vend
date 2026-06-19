# T-021-03 — Plan: role-presets-save-load-seat-default

_Ordered, independently-verifiable steps. Testing strategy and verification criteria. Small
enough to commit atomically (one commit; the unit is self-contained)._

## Testing strategy

- **Pure functions** (`defaultPresetForSeat`, `presetByName`, `serializeSpec`,
  `deserializeSpec`, `seatSpecPath`) → unit tests over fabricated specs, no fs (the `spec.test.ts`
  / `model.test.ts` style).
- **Impure verbs** (`saveSeatSpec`, `loadSeatSpec`) → one fs round-trip test over a **temp dir**
  (`mkdtemp` + `afterAll` `rm`), the `materialize.test.ts` / `load.test.ts` precedent. These two
  verbs are otherwise thin (their judgment lives in the pure pair), but the AC's byte-equal and
  seat-default clauses are inherently fs-level, so they get a real-fs test.
- **Green gate:** `bun run check` (typecheck + lint + all tests) must pass with zero regressions
  before commit.

## Verification criteria → AC mapping

| AC clause | Verified by |
|---|---|
| Loading the `designer` preset returns `vocabulary:plain · density:low · metaphor:tree` | `presetByName("designer")` / `defaultPresetForSeat("designer")` deep-equals `DESIGNER_PRESET`, asserting those three knob values explicitly. |
| Saving a tuned spec and reloading round-trips **byte-equal** | fs test: `saveSeatSpec` a tuned spec → raw bytes A; `loadSeatSpec` `toEqual` the tuned spec; re-`saveSeatSpec` the reloaded spec → raw bytes B; `B === A`. |
| A test confirms the **designer seat resolves to the designer preset by default** | `loadSeatSpec("designer", <empty temp dir>)` (no file) returns `DESIGNER_PRESET` (ENOENT→default), and the pure `defaultPresetForSeat("designer") === DESIGNER_PRESET`. |

## Steps

### Step 1 — `src/present/presets.ts`: seats + preset table (pure)

Header doc (purity split, byte-equal-is-structural, §2b-deferral, no-new-dep). Imports from
`./spec.ts` (`DESIGNER_PRESET`, `DEV_PRESET`, `validateSpec`; types `PresentationSpec`, `Preset`,
`SpecResult`) and `node:fs/promises` / `node:path`. Define `SEATS`/`Seat`, the internal
`Record<Seat, PresentationSpec>` table, `defaultPresetForSeat`, `presetByName`.
**Verify:** typechecks; `defaultPresetForSeat("designer")` is `DESIGNER_PRESET`.

### Step 2 — `presets.ts`: canonical serializer + total deserializer (pure)

`serializeSpec` builds the fixed-order plain object (copying `face`/`details` arrays and
`labels.status` to plain mutable structures, preserving order) → `Bun.YAML.stringify(obj,null,2)`.
`deserializeSpec` wraps `Bun.YAML.parse` in `try/catch` (syntax error → a `<yaml>` violation),
else delegates to `validateSpec`.
**Verify:** `deserializeSpec(serializeSpec(DESIGNER_PRESET))` is `ok:true`, spec `toEqual`
`DESIGNER_PRESET`; `serializeSpec` of a key-reordered clone equals `serializeSpec` of the
original (canonical).

### Step 3 — `presets.ts`: fs verbs (impure)

`DEFAULT_PRESETS_DIR`, `seatSpecPath`, `saveSeatSpec` (`mkdir -p dirname` + `writeFile
serializeSpec`, return path), `loadSeatSpec` (`readFile`; ENOENT → `defaultPresetForSeat`;
present → `deserializeSpec`, throw `PresentationSpecError` on `not-ok`, else return spec). Import
`PresentationSpecError` from `./spec.ts` for the throw.
**Verify:** typechecks; the module's public surface matches structure.md.

### Step 4 — `src/present/presets.test.ts`

Author the full coverage blueprint from structure.md: seat default, named preset, value
round-trip (both presets), canonical/byte-stable, total-on-bad-input, **fs byte-equal round-trip
of a tuned spec**, **seat default via the fs verb (no file)**, corrupt-file-is-loud,
`seatSpecPath`. `mkdtemp` under `os.tmpdir()`; `afterAll` `rm -rf` the temp dir.
**Verify:** `bun test src/present/presets.test.ts` green.

### Step 5 — Green gate + commit

`bun run check`. Fix any lint/type issues. Commit `src/present/presets.ts` +
`src/present/presets.test.ts` as one atomic unit:
`feat(present): role presets save/load + per-seat default (T-021-03)`.
**Verify:** `bun run check` fully green, no regressions in the existing suite.

## Risks & mitigations

- **Byte-equality fragility** — mitigated by routing both save and the round-trip check through
  the one canonical `serializeSpec` (D3); the test asserts raw-byte equality, not just deep-equal.
- **`Bun.YAML.stringify` formatting surprises** (empty `{}` map, spaced label values) — already
  verified empirically in research; the `DEV_PRESET` (empty status) and `DESIGNER_PRESET`
  (`"To do"`/`"In progress"`) round-trip cases lock this in as regression tests.
- **Frozen-input mutation** — `serializeSpec` only reads the spec and copies into fresh
  structures; it never mutates the frozen presets.
- **Silent loss of a tuned spec** — avoided by the loud `PresentationSpecError` on a
  present-but-corrupt file (only true absence falls back to the default).

## Out of scope (noted, not done)

- The §2b snake_case / `presentation:`-wrapper YAML config (the eventual Linear render contract)
  — deferred to a future loader, per `spec.ts`'s header.
- A `founder` seat / preset (no preset defined for it).
- A multi-spec registry/index — one file per seat suffices.
