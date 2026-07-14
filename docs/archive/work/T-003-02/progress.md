# Progress — T-003-02 gather-persist-and-vend-entry

Execution log against plan.md. What's done, what deviated, why.

## Status: complete — all steps green

| Step | State | Notes |
|---|---|---|
| 1 — pure gather surface + tests | ✅ | parsers, tier→budget, readiness, stateHash; 24 tests. |
| 2 — impure gather/browseShelf/writeMenuCache | ✅ | reads demand.md + spawns `lisa status`; persists `.vend/menu.json`. |
| 3 — `cli.ts` browse branch + tests | ✅ | bare `vend` / `vend --all`; existing `run` path untouched. |
| 4 — manual smoke vs live board | ✅ | see "Smoke" below. |
| 5 — full gate | ✅ | `bun test` 212 pass / 0 fail; `tsc --noEmit` exit 0. |

## Deviations from plan / structure (documented per RDSPI)

Two deviations, both forced by **live-board reality** discovered during the manual
smoke (step 4) — the planned heuristics were unsound against the real `demand.md` /
`lisa status`. Caught because the impure verbs were smoke-tested, not just the pure
units.

### D-A — done/readiness is sourced from demand.md's LEADING status word, not "any keyword"

Plan said `deriveReadiness` = "`/blocked/` anywhere" and drop-done = "`/done/`
anywhere". The real Status cells defeat this: the shelf signal's cell reads
`"**ready** — E-001 done. Spec staged → E-003"` — the `done` refers to *E-001*, not
this signal, so a substring match wrongly dropped E-003. **Fix:** added
`leadStatusWord(statusText)` (first alphabetic run, skipping `**`/punctuation) and
keyed both `deriveReadiness` and the new `isDoneStatus` off the signal's OWN leading
word. `done →` drops; a `done`/`blocked` later in prose is ignored.

### D-B — `lisa status` supplies an IN-PROGRESS signal, not done-ness (ticket→epic prefix is unsound)

Plan's `parseLisaDoneEpics` grouped tickets by id prefix (`T-003-xx → E-003`) and
marked an epic done when all its tickets were `done`. The smoke exposed that ticket
ids do **not** reliably encode their epic: E-001's work spans `T-001-*` AND `T-002-*`,
so the all-done `T-002-*` group phantom-marked **E-002** (the CI epic, genuinely
*ready*) as done — silently dropping it from the shelf. **Fix:** renamed to
`parseLisaInProgressEpics` and inverted the use — an epic with any not-yet-`done`
ticket is *being decomposed now*; `signalsToActions` overrides such an epic to
`blocked` (re-vending mid-decompose would clobber in-flight work). This
in-progress signal is phantom-free here (E-002's `T-002-*` are all done → not
in-progress; E-003's are mixed → in-progress). Done-ness comes from demand.md's own
authoritative per-signal Status cell; `lisa` output is still read and folded into the
freshness `stateHash`. Net: lisa is consulted (AC#1) without resting correctness on
the unsound prefix mapping. Documented as an open concern (review.md) with the sound
fix (read each ticket's `story` frontmatter → epic) noted as a future enrichment.

Both deviations make the menu *more* correct than the planned heuristics; neither
changes the public shape (`Action`/`MenuCache`) or the AC outcomes.

## Smoke (step 4) — against the real board

```
$ bun src/cli.ts
1. E-002 ci-cd-structural-backstop  [High] · 2h/50k · ready
(+1 hidden — vend --all)

$ bun src/cli.ts --all
1. E-002 ci-cd-structural-backstop  [High] · 2h/50k · ready
2. E-003 vend-context-aware-shelf  [High] · 2h/50k · blocked
```

- Instant, no LLM/network. E-001 dropped (done); E-003 hidden by default (in-progress
  → blocked), revealed by `--all`; E-002 the one ready action.
- `.vend/menu.json`: `version:1`, ISO `generatedAt`, non-empty `stateHash`, correct
  `all`, `actions` in display order matching the printed rows 1:1 (index contract).
- **Freshness:** re-running with the board unchanged reproduces the same `stateHash`
  (`21c4dbde` == `21c4dbde`); `generatedAt` advances. Bare-`vend` cache is `all:false`
  with only `E-002` — the press gesture (T-003-04) resolves `actions[i-1]` against it.

## Commits

1. `T-003-02: gather + persist .vend/menu.json — demand/lisa → ranked menu cache`
   (`src/shelf/gather.ts`, `gather.test.ts`).
2. `T-003-02: bare \`vend\` browse entry — gather → render → persist → print`
   (`src/cli.ts`, `cli.test.ts`).

Ticket frontmatter (`docs/active/tickets/*.md`) left unstaged — Lisa owns phase/status.
`.vend/menu.json` is gitignored runtime telemetry, not committed.

## AC trace

- **AC#1** `gather.ts` reads demand.md + `lisa status` into `Action[]`, pure shaping
  unit-tested — ✅ (24 tests).
- **AC#2** bare `vend`: gather → `rankActions` → `renderMenu` → write `.vend/menu.json`
  → print, instant, no LLM — ✅ (smoke).
- **AC#3** cache carries `generatedAt` + `stateHash` freshness marker — ✅.
- **AC#4** `check:test` / `check:typecheck` green; **P2** advanced — ✅ (212 / tsc 0).
