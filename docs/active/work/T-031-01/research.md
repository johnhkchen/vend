# T-031-01 — Research: home-composite-core

The pure heart of the DL-6 Home: a one-line ledger trust summary (`homeLedgerLine`) + a layout
composer (`renderHome`) that lays the three regions — board · shelf · ledger — into one screen.
**No I/O.** This maps the three emitters being composed, the purity discipline they all share, the
honest-empty precedents, and the seam to the downstream wiring ticket (T-031-02). Descriptive only.

## The three emitters being composed

All three already exist, all three are PURE/TOTAL, all three return plain strings or structured values
the render shell turns into strings. T-031-01 does **not** change any of them — it composes them.

### 1. Board — `renderMenu` (`src/shelf/menu.ts:151`)
- Signature: `renderMenu(actions: readonly Action[], opts?: RenderOpts): string`.
- Produces the numbered demand board: `1. E-002 ci-backstop  [High] · 2h/50k · ready`, with a
  `(+K hidden — vend --all)` footer and `opts.all` to reveal blocked/leaf rows.
- **Honest-empty (the precedent we inherit):** an empty visible list returns a single guidance line —
  `"(no actions)"` when there are zero actions, `"(no salient actions — vend --all)"` when all are
  hidden — never a throw (menu.ts:155–157).
- This is the **press namespace**: T-031-02's `.vend/menu.json` cache stores `visibleActions(ranked,
  all)` in display order, and `vend <sel>` resolves `actions[i-1]` by index. The board owns selection.
- `formatBudget(budget): string` (menu.ts:131) — the shared human-scale envelope formatter
  (`2h/50k`, `30m/8k`). Used by `renderMenu` AND `renderShelf`, so board and shelf read identically.

### 2. Shelf — `shelfRows` / `renderShelf` (`src/shelf/shelf-row.ts:86` / `:130`)
- `ShelfRow` (shelf-row.ts:45): `{ name, summary, envelope: Budget, confidence: ShelfConfidence }`.
  Structured fields, never pre-formatted strings — rendering is the render shell's job (no drift).
- `ShelfConfidence` (shelf-row.ts:34): discriminated union `{ kind:"measured"; runs } | { kind:"default" }`
  — the E-026 lesson made unrepresentable: a `default` row carries NO `runs`, so nothing can print
  "measured (0 runs)".
- `renderShelf(rows): string` (shelf-row.ts:130) — the **clean-typographic supply view** (E-030 /
  T-030-02): a `shelf — N playbooks` heading, then a numbered list where **worth leads** (name +
  summary at column 0) and **envelope · confidence recede** to the trailing column. A `default` row
  prefixes its envelope with `~` and reads `(default — no runs yet)`; a `measured` row reads
  `(measured · N runs)`. **No box chrome** (DL-9) — a flat list, columns self-size.
- **Honest-empty:** `renderShelf([])` returns `"(no playbooks)"` (shelf-row.ts:131).
- Private to shelf-row.ts: `confidenceLabel(c)` (shelf-row.ts:103) — the `(measured · N runs)` /
  `(default — no runs yet)` qualifier. Not exported.

### 3. Ledger — `WalkAwayReport` / `formatWalkAwayFindings` (`src/ledger/walk-away.ts`)
- `auditWalkAway(records, opts): WalkAwayReport` (walk-away.ts:160) — the impure-free E1 audit. The
  full readout `formatWalkAwayFindings(report)` (walk-away.ts:238) is the multi-line `vend audit`
  fragment (DL-8). T-031-01 wants the **one-line glance** of the same numbers (DL-6 foot).
- `WalkAwayReport.intervention: InterventionStat` (walk-away.ts:66) carries the **E-028 provenance
  split**: `reported`, `intervened`, `rate` (combined), plus `forward: InterventionSubStat` (live
  self-reports — the road a verdict cites) and `attested: InterventionSubStat` (post-hoc back-fill).
  These are kept distinct precisely so the two KINDS of evidence are never conflated (the E-026 over-
  claim came from merging them).
- `InterventionSubStat` (walk-away.ts:89, exported): `{ reported, intervened, rate: number|null }`.
  An empty partition ⇒ `rate: null`, **never a fabricated 0**.
- **The walk-away rate is `1 − intervention rate`** (finished untouched) — see `formatWalkAwayFindings`
  walk-away.ts:249 and `subWalk` walk-away.ts:228. The `(k/n)` fraction is `(reported − intervened)/
  reported` "ran untouched".
- Private to walk-away.ts: `pct(r: number|null): string` (walk-away.ts:214) — `"—"` when null, else
  `${Math.round(r*100)}%`. And `subWalk(s)` (walk-away.ts:226) — `"none yet"` when `reported === 0`,
  else `pct(1 − rate) (untouched fraction)`. **`pct` is the label-mirror seam** the ticket asks us to
  reuse so Home and `vend audit` round percentages identically.
- **Honest-empty:** when `intervention.reported === 0`, `formatWalkAwayFindings` prints
  `"walk-away rate: no self-reports yet (N runs, intervention bit unrecorded)"` (walk-away.ts:247) —
  the honest label, no fabricated rate. `auditWalkAway([])` degrades to `total: 0`, zeroed mix,
  `andonRate: 0`, null cost/intervention — never a throw (walk-away.ts:160 docstring).

## The DL-6 mock (design-language.md:119–142)

> **DL-6 — Home leads with demand; supply serves beneath.** Board leads at column 0; the shelf is a
> numbered list, never a grid of cards (DL-9); the ledger line recedes to the foot. Whitespace divides
> the three regions — no boxes, no rules.

```
NOW  ▶ scaffold the Bun/TypeScript project   [Keystone] · why: unblocks every other pull
shelf
  1. survey   read the project → propose a board   [Keystone] · 2h/50k  · ready
ledger   E1 walk-away 87% (13/15)   └ forward 50% · attested 92%      (full readout: DL-8)
```

The charter **explicitly names `renderHome` as its one honest gap** (design-language.md:138): "there is
no single `renderHome` composite emitter today — Home is the CLI composing `renderMenu` + ... + the
audit summary line." T-031-01 closes exactly that named gap with a pure composite. The mock is
"reference, not pixel specs" and the charter's standing rule is **"where a future TUI and a mock
disagree, fix one — they are not allowed to drift."**

## Purity discipline (the house pattern this module must hold)

menu.ts, shelf-row.ts, walk-away.ts each open with the same contract: no fs, clock, network, process,
LLM, or native addon; every export takes plain values and returns fresh ones, never mutating input,
never throwing (TOTAL). Tests are ordinary pure tests that never load the BAML addon. T-031-01's
`home.ts` + `home.test.ts` must hold the same line — it only consumes already-rendered strings and
already-read structured values. The impure gather (read `.vend/runs.jsonl`, rank the board, persist
`.vend/menu.json`, print) is **T-031-02's** job (the `browse` arm, `src/cli.ts` ~533).

## The press-contract boundary (why the shelf-beneath is safe to render)

T-031-02 keeps `browseShelf`'s persistence of `.vend/menu.json` (the board's `visibleActions`) as the
**single** cache writer, and `vend <sel>` (`pressShelf`, `src/shelf/press.ts:44`) resolves by index
against that cache — **independent of the printed text**. So Home can render a shelf region beneath the
board without any press regression: the board is the selection namespace; the shelf-beneath is
informational. The shelf's distinguishing *look* (renderShelf's worth-leads key vs renderMenu's
`[Tier]·budget·readiness`) is what keeps it from reading as the press namespace.

## Constraints & assumptions

- **Reuse, don't re-derive numbers.** `pct` (walk-away.ts) is the rounding seam to mirror so the foot's
  percentages equal `vend audit`'s exactly. Re-implementing the rounding would invite display drift —
  the very thing the charter forbids.
- **Asymmetric inputs are intentional.** The ticket's `renderHome({ boardMenu, shelfRows, ledger })`
  takes board + ledger as **already-rendered strings** but the shelf as **`ShelfRow[]`** — so
  `renderHome` owns the shelf's Home presentation (rendering it "receding beneath") while the board
  (needs `--all`/cache coordination upstream) and the ledger (trivial) arrive pre-rendered.
- **Honest-empty is the through-line.** Every region already has an honest-empty path (`(no actions)`,
  `(no playbooks)`, `no runs/self-reports yet`). The composite must let each pass through, never an
  error, never a fabricated trust number — the standing read-never-invent discipline (IA-8 / E-026).
- Codebase-memory coordinates confirmed against source: `renderMenu` menu.ts:151; `shelfRows`/
  `renderShelf` shelf-row.ts:86/130; `formatWalkAwayFindings`/split walk-away.ts:238; `pct`
  walk-away.ts:214; `InterventionSubStat` walk-away.ts:89.
- Run-log state (from prior sessions): ~20 records across 6 plays, **no intervention bits set** — so in
  the live T-031-02 proof the foot will honestly read "no self-reports yet". T-031-01 proves the
  populated path with fixtures that set the bits, and the honest-empty path with `auditWalkAway([])`.
