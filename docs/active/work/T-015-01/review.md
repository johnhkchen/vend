# T-015-01 Review — max-turns mechanism through the seam

Handoff for a human reviewer. The ticket added an optional agentic turn cap that reaches
`claude -p` as `--max-turns <n>`, threaded cast → dispense → buildArgs.

## What changed

Two source files, one test file. Two atomic commits.

| File | Change | Commit |
|------|--------|--------|
| `src/executor/claude.ts` | `buildArgs` emits `--max-turns`; `DispenseOptions.maxTurns?`; `dispense` forwards it | `e1e411e` |
| `src/executor/claude.test.ts` | 4 new `buildArgs` unit tests | `e1e411e` |
| `src/engine/cast.ts` | `CastOptions.maxTurns?`; forwarded at the `dispense({…})` call | `c90f40c` |

No files created or deleted. No new dependencies, no new import edges, no `.vend/`
format change.

### `src/executor/claude.ts`
- `buildArgs` inline param type gains `maxTurns?: number`; new guarded push
  `if (maxTurns) args.push("--max-turns", String(maxTurns))` appended **last**, after
  `--system-prompt`. Signature wrapped to multiple lines to fit the width (cosmetic).
- `DispenseOptions` gains `maxTurns?: number`, doc-commented "Omitted ⇒ no flag ⇒ turns
  unbounded", clustered with the other flag options.
- `dispense` destructures `maxTurns` and passes it into the single `buildArgs({…})`
  call. Nothing downstream of `const args` touched.

### `src/engine/cast.ts`
- `CastOptions` gains `readonly maxTurns?: number` after `model?`, with an IA-8 doc
  comment.
- `castPlay`'s `dispense({…})` call gains `maxTurns: opts.maxTurns` — pure pass-through,
  mirroring `model`. `undefined` flows through and omits the flag.

## Acceptance criteria

- [x] **AC1** — `buildArgs` accepts optional `maxTurns`, emits `--max-turns <n>` when
  set; absent ⇒ argv identical to today. Verified: the guard appends last and is falsy-
  gated; test "max-turns absent ⇒ no flag" asserts `buildArgs()` / `buildArgs({model})`
  contain no `--max-turns`, and the existing 3-flag golden arrays are unchanged.
- [x] **AC2** — Pure + unit-tested: present → flag+value, absent → no flag, composes
  with model/effort/system. Verified by the four new tests (compose-all, alone, absent,
  falsy-0).
- [x] **AC3** — `CastOptions` carries optional `maxTurns`, threaded through `dispense` to
  `buildArgs`; a cast with no `maxTurns` dispenses exactly as before. Verified by
  type-check + the `undefined`-passthrough path (no branch, omits the flag).
- [x] **AC4** — `bun run check:*` green; existing casts and stream-parse path unaffected.
  Verified: `bun run check` → typecheck clean, **471 pass / 0 fail** across 29 files.

## Test coverage

- **New:** 4 `buildArgs` unit tests in `claude.test.ts` — composition with all flags
  (ordering + stringification), max-turns alone, absent-omits (byte-for-byte AC), and
  the falsy-`0` guard.
- **Regression:** full suite (471 tests) green — cast-core, chain, play, and the rest of
  the seam tests unchanged.
- **Deliberately not tested:** `dispense` (spawns a process; intentionally not unit-
  tested per the module's stated rule — all new behaviour is in the pure `buildArgs`).
  `castPlay`'s threading carries no unit test — it is the untested impure shell and
  `maxTurns` is pass-through data, added the same way `project`/`intervened`/`skipGates`
  were. This matches the house pattern, not a gap.

## Design notes worth a reviewer's eye

- **Guard is `if (maxTurns)` (truthiness), so `maxTurns: 0` is treated as absent.**
  Deliberate (design.md §Guard, option A): `--max-turns 0` is meaningless and folding it
  into "absent" keeps all four flag-guards visually identical. If a reviewer wants `0`/
  negative rejected explicitly, that validation belongs upstream (cast command / config),
  not in the thin pure argv builder — recorded as rejected option C.
- **No validation in the seam** — emits whatever positive integer it is handed, mirroring
  `model`/`effort`. The seam stays a dumb argv builder.

## Open concerns / limitations

1. **No CLI/command surface yet.** This ticket wires `maxTurns` from `CastOptions` to the
   flag; nothing yet *sets* `opts.maxTurns` (no cast command flag, no config). That is the
   intended scope boundary (the mechanism through the seam, R3/R12) — a follow-up wires
   the operator-facing knob. Until then the cap is reachable only programmatically.
2. **`--max-turns` behaviour on cap-hit is the CLI's.** When a run hits the cap, the
   process terminates and emits its terminal `result` like any other run; the existing
   meter/classify/gate path handles it unchanged. We did not add a distinct run-log
   outcome for "stopped at turn cap" — a capped run logs whatever outcome its terminal
   result + gates produce. If distinguishing "hit the turn cap" in the ledger is wanted,
   that is a separate enhancement (would need the seam to surface the stop reason).
3. **No live spawn verification.** Per the module's test rule, `--max-turns` reaching a
   real `claude` process is not exercised by an automated test; it is proven by the pure
   argv assertion plus the existing live cast path. Low risk (one guarded push), but the
   end-to-end "claude honors the cap" is trusted to the CLI contract, not asserted here.

## Verdict

Complete and green. Smallest possible clone of the `model` threading; the only judgment
call (the number guard) is documented with rationale and rejected alternatives. No
follow-up required for this ticket's scope; concerns 1–2 above are natural next tickets.
