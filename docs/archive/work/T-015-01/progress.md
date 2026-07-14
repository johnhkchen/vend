# T-015-01 Progress

## Status: implementation complete, all checks green

`bun run check` → baml:gen ok, typecheck clean, **471 pass / 0 fail** (972 expects, 29
files).

## Completed

### Step 1 — seam mechanism (`src/executor/claude.ts`)
- [x] `buildArgs` — inline param type gains `maxTurns?: number`; added
      `if (maxTurns) args.push("--max-turns", String(maxTurns));` as the **last** guarded
      push. Reformatted the signature onto multiple lines (it exceeded the line width with
      the extra field) — purely cosmetic.
- [x] `DispenseOptions` — added `maxTurns?: number` with "Omitted ⇒ no flag ⇒ turns
      unbounded", clustered with `model`/`effort`/`system`.
- [x] `dispense` — destructure adds `maxTurns`; `buildArgs({ model, effort, system,
      maxTurns })` forwards it.

### Step 2 — unit tests (`src/executor/claude.test.ts`)
- [x] "appends max-turns when supplied, composes with all flags (last, stringified)"
- [x] "max-turns alone"
- [x] "max-turns absent ⇒ no flag (argv identical to today)"
- [x] "max-turns 0 is treated as absent (falsy guard)"
- All four pass; existing `buildArgs` 3-flag golden tests untouched and still green.

### Step 3 — thread through the cast (`src/engine/cast.ts`)
- [x] `CastOptions` — added `readonly maxTurns?: number` after `model?`, with the IA-8
      doc comment.
- [x] `castPlay`'s `dispense({…})` call — added
      `maxTurns: opts.maxTurns, // undefined ⇒ no --max-turns flag ⇒ unbounded turns`.

### Step 4 — full gate
- [x] `bun run check` green.

## Deviations from plan

- **`buildArgs` signature wrapped to multiple lines.** Plan implied a single-line
  signature; the added field pushed it past the formatter width, so it now spans three
  lines (same as the structure.md blueprint showed). No behavioural change.
- No other deviations. Guard is option A (`if (maxTurns)`) as designed; flag appended
  last; type is `number` stringified at the push.

## Remaining
- Commit (two atomic commits per plan), then Review artifact.
