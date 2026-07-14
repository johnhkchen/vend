# T-060-03-01 — Progress: the closing LIVE re-drive, as run

The drive was run end-to-end against a throwaway `mktemp -d` sandbox copy of the seed. Honest-on-
outcome: the real outcomes are recorded, including the one place the cleared slice falls short (the
populated SVG render). The committed template was not mutated (only `EXPECTED-OUTCOME.md` is written
back). The sandbox `.vend/runs.jsonl` is captured verbatim into this dir as `runs.jsonl`.

**Sandbox:** `/var/folders/kn/…/T/vend-seed-drive-rXlR` (host: darwin; executor: `claude`, model
`claude-opus-4-8`). **Total real spend: $1.08** (3 metered casts; free steps $0). Date: **2026-06-29**.

## Steps executed (vs the plan)

| Step | Result |
| --- | --- |
| A — sandbox copy | ✅ seed copied; `node_modules/.astro/.vend` stripped; `SEED.md` = team-finder (rich seed intact); **no `.mcp.json`** (reduced-grounding precondition). |
| A1 — `lisa init` | ✅ non-interactive (exit 0); minted `CLAUDE.md` + `.lisa.toml` + the `docs/` tree. |
| A2 — `vend init --template hackathon` | ✅ exit 0; **11 created / 7 skipped**; `SEED.md` **skipped** (no-clobber held); `docs/knowledge/charter.md` carries the tuned `HACKATHON_CHARTER`. |
| A3 — `vend doctor` | ✅ **green 4/4** (lisa, claude, BAML addon, executor:claude). |
| A5 — `vend svg` (pre-drive) | ✅ valid honest-empty SVG (0 cards). |
| **B1 — `vend steer` (SHIPPED, no hack)** | ✅ **success — coherent 4-signal board + 2 genuine forks**, all grounded in `SEED.md`. **A3 finding CLOSED live.** 5 turns, $0.505. |
| **B2 — `vend work --no-intervened`** (omit `--budget` ⇒ calibrated default) | ✅ default funded the first clear (**no instant budget-exhausted**); **Cast 1, cleared 1** — propose-epic minted **E-001**, decompose-epic **degraded-and-cleared** (`· reduced grounding …`) minting 2 stories + 4 tickets. 203.8k tok / ~1m for the chain. |
| B3 — `vend svg` (populated) | ⚠️ **GraphIntegrityError** — `story 'S-002' has no epic 'E-002'`. The slice cleared on disk, but the decomposed story numbering breaks vend's graph id-convention (see Finding below). |
| C — capture | ✅ `runs.jsonl` copied into this dir; records inspected; spend summed. |
| D — flip gold master | ✅ `EXPECTED-OUTCOME.md` rewritten to the positive form. |
| D3 — vend gate | ✅ `bun run check` green (1354 pass / 0 fail) — no `src/` change. |

## The run-log records (`.vend/runs.jsonl`, 3 records — captured)

1. `steer` — **success**, coherent board + forks, $0.5046, 5 turns. (steer carries no `intervened`
   bit — it is the staging gesture, not a clearing cast.)
2. `propose-epic` — **success**, minted **E-001 team-finder-overlap-ranking** (advances H2/H1),
   $0.3330, 5 turns, **`intervened: false`** (forward-E1).
3. `decompose-epic` — **success**, minted S-001/S-002 + 4 tickets, `lisa validate ✓`, $0.2413, 5
   turns, **`intervened: false`** (forward-E1), **`reducedGrounding: true`** (the optional
   `codebase-memory-mcp` was absent — degraded, not andoned).

**AC check:** ✅ a runs.jsonl record shows ≥1 slice cleared with the **reduced-grounding marker set**
(record 3) and **no instant budget-exhausted** (cleared 1 before the wallet exhausted); ✅ **two
cleared forward-E1 records accrued** (records 2 + 3, live `intervened:false`); ✅ `EXPECTED-OUTCOME.md`
flipped to positive (board renders AND a slice clears).

## The cleared slice (on disk in the sandbox)

```
docs/active/epic/E-001.md          # team-finder-overlap-ranking {2}{W}{U} (advances H2, H1)
docs/active/stories/S-001.md       # team-finder-core  → tickets T-001-01, T-001-02
docs/active/stories/S-002.md       # team-finder-page  → tickets T-002-01, T-002-02
docs/active/tickets/T-001-01.md … T-002-02.md  (4 tickets)
```

Epic → 2 stories → 4 tickets: a full slice, minted by the propose→decompose chain with reduced
grounding. This is the end-to-end clear the negative gold master could not reach (it andoned at
decompose).

## Finding (honest shortfall — carried into the gold master + a follow-up)

**The populated `vend svg` render throws `GraphIntegrityError`.** vend's graph model links stories to
epics PURELY by id convention (`src/graph/model.ts:148`, `epicIdForStory`): a story `S-NNN[-MM]`
belongs to epic `E-NNN`; there is no `epic:` field. decompose-epic minted the two stories as **flat-
sequential** `S-001` (→ E-001 ✓) and `S-002` (→ **E-002**, which does not exist) instead of nesting
both under E-001 (e.g. `S-001` + `S-001-01`). So the populated board cannot resolve S-002's parent and
the SVG build andons. Notably the decompose cast itself returned **success** and `lisa validate`
passed inside the cast — lisa's validator and vend's graph id-convention disagree on the minted
numbering.

- **Not this ticket's AC.** The AC is: runs.jsonl shows ≥1 slice cleared + reduced-grounding marker +
  forward-E1 + the gold-master flip (board renders = the *steer* board; a slice clears = `vend work`).
  All met. The populated-SVG render is the designer's downstream view, not an AC clause.
- **Newly surfaced, not a regression.** decompose never ran on the seed before (it andoned in
  T-058-05 on the absent MCP). The graceful-degrade fix (T-060-01-01) is what let it run — and running
  it surfaced this decompose id-numbering issue for the first time. It is plausibly not reduced-
  grounding-specific (a fresh empty board + decompose's sequential id-minting), but that cannot be
  confirmed without a fully-grounded comparison run.
- **Carried as a follow-up**, recorded in the gold master's "residual imperfections" so the file stays
  honest, exactly as the negative gold master recorded the decompose andon.

## Deviations from the plan (documented)

- **No `--stale-ok` needed.** The shipped steer wrote the board directly; `vend svg` between steer and
  work is read-only, so the staged board stayed fresh — `vend work` ran clean without the override
  T-058-05 needed. (Cleaner drive = more faithful gold master.)
- **No diagnostic re-steer.** Unlike T-058-05 Step 6′, the SHIPPED steer rendered the coherent board
  on the first try (E-059 wiring), so no `cat charter.md SEED.md > …` hack was run.

## Not done (honestly)

- The **populated SVG** does not render off this slice (the graph-integrity finding above). The
  *honest-empty* SVG (pre-drive) renders fine; the *populated* one needs the decompose story-numbering
  fixed. Recorded, not papered over.
