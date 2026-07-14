# T-021-03 — Review: role-presets-save-load-seat-default

_Handoff document: what changed, test coverage, open concerns. Enough to review without reading
every diff._

## Summary

Adds the **persistence + per-seat-default** layer over T-021-02's pure presentation-spec. The
calibration loop can now start from a seat's built-in preset, save a tuned spec, and have that
tune reproduce on demand — while an unsaved seat falls back to its built-in preset. Serialization
is canonical block YAML via `Bun.YAML`, so saved specs round-trip **byte-equal**. One atomic
commit (`8eac3b4`); `bun run check` green (652 pass / 0 fail).

## Files changed

| File | Change | Summary |
|---|---|---|
| `src/present/presets.ts` | **created** (~150 LOC) | `SEATS`/`Seat`; `SEAT_DEFAULTS` table; pure `defaultPresetForSeat`, `presetByName`, `serializeSpec`, `deserializeSpec`; impure `saveSeatSpec`, `loadSeatSpec`; `DEFAULT_PRESETS_DIR`, `seatSpecPath`. |
| `src/present/presets.test.ts` | **created** (13 tests) | Pure seat-table + serialize/deserialize tests; fs round-trip tests over a temp dir (`mkdtemp` + `afterAll` cleanup). |

No existing file was modified or deleted. `src/present/spec.ts` is imported only.

## How the AC is met

1. **Loading the 'designer' preset returns `vocabulary:plain · density:low · metaphor:tree`** —
   `presetByName("designer")` and `defaultPresetForSeat("designer")` both return
   `DESIGNER_PRESET`; tests assert those three knob values explicitly.
2. **Saving a tuned spec and reloading round-trips byte-equal** — `saveSeatSpec` writes
   `serializeSpec(spec)`; the fs test saves a tuned spec (bytes A), `loadSeatSpec` deep-equals the
   tuned spec, and re-saving the reloaded spec yields bytes B with `B === A`. Byte-equality is
   structural: both writes funnel through the one canonical `serializeSpec` (fixed field order,
   `Bun.YAML.stringify(_,null,2)`).
3. **The designer seat resolves to the designer preset by default** — covered twice: the pure
   `defaultPresetForSeat("designer") === DESIGNER_PRESET`, and the fs verb `loadSeatSpec("designer",
   <empty dir>)` returning `DESIGNER_PRESET` via the ENOENT→default fallback.

## Design decisions worth a reviewer's eye

- **One file, pure-core + thin impure verbs** (the `materialize.ts` / `run-log.ts` shape) rather
  than the `model.ts`/`load.ts` split — the impure surface is two short verbs, so a second file
  earns nothing.
- **YAML via `Bun.YAML.stringify(_, null, 2)`** (block style, camelCase) — board-idiomatic, no new
  dependency, empirically byte-equal on round-trip (verified in research before coding). JSON and
  a hand-rolled snake_case serializer were rejected (design.md D2).
- **Saved-or-default is one tolerant verb** (`loadSeatSpec`): absence → default, corruption →
  loud `PresentationSpecError`. A silent fallback on a corrupt file would hide a lost tune, so
  only true ENOENT falls back.
- **Canonical serializer ignores input key order** — `serializeSpec` rebuilds a fixed-order plain
  object, so byte-equality holds regardless of how the in-memory spec's keys are ordered.

## Test coverage

- **Pure (9 tests):** seat default (designer/dev), named lookup (designer/dev/custom→null),
  value round-trip for both presets (incl. `DEV_PRESET`'s empty status map), canonical
  serialization independent of key order, total deserialize on malformed YAML, deserialize
  delegating a bad knob to `validateSpec`.
- **Fs (4 tests):** byte-equal save/reload of a tuned spec, unsaved-seat→default for both seats,
  corrupt-file→`PresentationSpecError`, `seatSpecPath` composition + default dir.
- **Full suite:** `bun run check` 652 pass / 0 fail; no regressions in the existing 639 tests.

### Coverage gaps / not tested

- The two impure verbs' fs mechanics (`mkdir`/`writeFile`/`readFile`) are exercised via the
  round-trip tests, not isolated — consistent with the house rule that thin verbs aren't
  unit-tested (`materialize`, `appendRunLog`).
- A non-ENOENT read failure (e.g. EACCES) in `loadSeatSpec` re-throws the raw error; not
  unit-tested (would need fs-permission fixtures), but the branch is explicit.

## Open concerns / future work (none block this ticket)

- **§2b snake_case / `presentation:`-wrapper YAML config is deferred.** This module persists the
  canonical **camelCase** spec. The eventual Linear render contract (snake_case keys, a
  `presentation:` wrapper, readable block layout matching prep §2b) is a separate future loader,
  exactly as `spec.ts`'s header states. A consumer expecting §2b-shaped files will need that
  bridge.
- **No `founder` seat.** `SEATS` is `designer`/`dev` only — `founder` (job-stories) has no preset.
  Adding it later means a preset + a `SEAT_DEFAULTS` entry.
- **No saved-preset registry/index.** One file per seat (`.vend/presets/{seat}.yaml`) is enough
  for two seats; a listing/discovery API can come if the seat set grows.
- **Concurrency:** the ticket touches only new files in `src/present/`, so there is no shared-file
  edge with siblings (T-021-04 is the vocabulary layer, disjoint).

## Verdict

AC fully met, green, committed. No critical issues for human attention; the deferred §2b YAML
config is the one thing a downstream Linear-render ticket must pick up.
