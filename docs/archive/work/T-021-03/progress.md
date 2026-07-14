# T-021-03 — Progress: role-presets-save-load-seat-default

## Status: implementation complete, green, committed

| Step | State | Notes |
|---|---|---|
| 1. seats + preset table (pure) | ✅ | `SEATS`/`Seat`, `SEAT_DEFAULTS`, `defaultPresetForSeat`, `presetByName`. |
| 2. canonical serializer + total deserializer | ✅ | `serializeSpec` (fixed-order plain object → `Bun.YAML.stringify(_,null,2)`), `deserializeSpec` (total; YAML errors → `<yaml>` violation, else `validateSpec`). |
| 3. fs verbs (impure) | ✅ | `DEFAULT_PRESETS_DIR`, `seatSpecPath`, `saveSeatSpec`, `loadSeatSpec` (ENOENT→default; corrupt→throw). |
| 4. test suite | ✅ | `src/present/presets.test.ts` — 13 tests, all AC clauses covered. |
| 5. green gate + commit | ✅ | `bun run check`: 652 pass / 0 fail. Committed atomically. |

## What was built

- `src/present/presets.ts` — the persistence + seat-default layer over T-021-02's pure spec.
- `src/present/presets.test.ts` — pure + fs round-trip coverage.

## AC verification

- **Load 'designer' preset → plain · low · tree** — `presetByName("designer")` /
  `defaultPresetForSeat("designer")` are `DESIGNER_PRESET`; tests assert the three knob values.
- **Save tuned + reload byte-equal** — fs test: save a tuned spec → bytes A; `loadSeatSpec`
  `toEqual` tuned; re-save → bytes B; `B === A`.
- **Designer seat resolves to designer preset by default** — pure
  `defaultPresetForSeat("designer") === DESIGNER_PRESET` **and** `loadSeatSpec("designer",
  <empty dir>)` returns `DESIGNER_PRESET` (ENOENT→default).

## Deviations from plan

None. The plan was followed step-for-step; the public surface matches structure.md exactly.

## Notes

- Serialization uses `Bun.YAML.stringify(obj, null, 2)` (block style, readable, deterministic),
  verified byte-equal on round-trip during research before any code was written.
- The §2b snake_case / `presentation:`-wrapper YAML config and a `founder` seat remain out of
  scope (deferred per `spec.ts`'s header / no preset defined), as planned.
