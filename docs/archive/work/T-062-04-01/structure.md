# T-062-04-01 — Structure

The file-level blueprint. This is a **synthesis/docs** card: it adds one committed artifact (the
gold-master) plus the RDSPI trail. **No `src/` change, no test change, no template-code change.**

## Files created

| Path | Kind | Purpose |
|---|---|---|
| `examples/templates/kitchen-seed/EXPECTED-OUTCOME.md` | **new (canonical deliverable)** | The frozen kitchen gold-master — the re-runnable consistency bar. Mirrors `hackathon-seed/EXPECTED-OUTCOME.md`. **This is the AC artifact.** |
| `docs/active/work/T-062-04-01/research.md` | new (artifact) | done |
| `docs/active/work/T-062-04-01/design.md` | new (artifact) | done |
| `docs/active/work/T-062-04-01/structure.md` | new (artifact) | this file |
| `docs/active/work/T-062-04-01/plan.md` | new (artifact) | Implement sequence + verification |
| `docs/active/work/T-062-04-01/free-stages.proof.txt` | new (artifact) | captured stdout of the re-run free stages (init/doctor/svg) — the evidence behind the gold-master's captured numbers |
| `docs/active/work/T-062-04-01/progress.md` | new (artifact) | execution log |
| `docs/active/work/T-062-04-01/review.md` | new (artifact) | handoff |

## Files modified

| Path | Change |
|---|---|
| — | **none.** No source, test, BAML, or template-code file is touched. |

The committed kitchen-seed **template tree stays byte-for-byte unchanged** except for the *added*
`EXPECTED-OUTCOME.md` (a sibling of `SEED.md`, not a mutation of any existing file). The stub
`index.astro` — the cook's slice — is not edited (verified in Research; the clean-room drive depends
on it).

## The canonical artifact — internal structure

`examples/templates/kitchen-seed/EXPECTED-OUTCOME.md`, ~160–200 lines, sections per Design D3:

```
# Expected outcome — the kitchen gold master (the frozen consistency bar)
> Header banner: what/provenance/honest-split
  - CAPTURED (free, offline): init/doctor/svg/render/build/degrade/composition — FACT
  - PENDING (⟪…⟫): the one live metered steer→work clear + its budget line (human-authorized, P7)
  - provenance: host darwin, executor claude/claude-opus-4-8, throwaway sandbox, free stages re-run <date>

## Headline — the bootstrap path drives clean & free; one metered line remains
## What the drive yields            (table: CAPTURED rows w/ real values | PENDING rows ⟪…⟫)
## The board (the diff target)      (Keystone = menu render; deploy slice; SSG/SSR fork)
## The rendered menu (captured)     (render contract + example-dish card + green build)
## The graceful degrade (captured)  (MCP-absent → reducedGrounding; live line ⟪…⟫)
## The budget envelope              (coldStartEnvelope mechanism; "lands inside" def; live ⟪…⟫)
## Residual / honest boundaries     (metered cast; live EmDash REST; live Cloudflare → clean-room epic)
## Re-run block                     (free stages + metered casts + jq/grep budget checks)
## Honest-on-outcome footer         (capture/pending contract; no number invented; voiding gates)
```

### Content provenance (every captured value traces to a source — no invention)

| Gold-master row | Source of the captured value |
|---|---|
| `vend init --template kitchen` → 31 created / 0 skipped | `free-stages.proof.txt` (re-run this card) |
| `vend doctor` → ok, 3 green | `free-stages.proof.txt` |
| `vend svg` (pre-drive) → honest-empty 0/0/0 | `free-stages.proof.txt` |
| SEED.md + kitchen charter reach steer | `T-062-03-01/steer-input.proof.txt` + `seed-steer-seam.test.ts` |
| The expected board (Keystone/deploy/fork) | `T-062-03-01/expected-board.md` |
| Render = one card per dish, matching example | `T-062-03-03` `menu-render.test.ts` (8 tests) |
| `astro build` green | `T-062-03-03/build.proof.txt` (astro 6.4.8 + cloudflare, exit 0) |
| Degrade → `reducedGrounding:true`, no andon | `T-062-03-02` `kitchen-degrade.test.ts` |
| Whole-path composition green | `T-062-03-04` `cold-start-redrive.test.ts` (25 expects) |
| Full gate 1488 pass / 1 skip / 0 fail | `T-062-03-04/progress.md` |
| Live ranking / clear / budget values | **`⟪…⟫`** — not observed; the human-authorized cast |

### `⟪…⟫` rows (must stay slots — the metered half)

- `vend steer` live ranking confirms Keystone = menu render.
- `vend work` `runs.jsonl` line: `outcome:"success"`, `totalTokens ≤ envelope.tokens`, `wallClockMs ≤
  envelope.timeMs`, the `envelope` values, turns, cost.
- zero `budget-exhausted` / `timed-out` / `missing-capability` rows (asserted as the bound, value `⟪…⟫`).

## Ordering of changes

1. (already done) research → design → structure.
2. `plan.md`.
3. **Re-run the free stages** in a throwaway sandbox; capture to `free-stages.proof.txt`. (Real,
   freshly-observed numbers — the captured half's evidence.)
4. Write `examples/templates/kitchen-seed/EXPECTED-OUTCOME.md` from the component captures + the proof.
5. `progress.md`, `review.md`.

No step depends on a metered cast. No step mutates `src/` or the template code. The card is **purely
additive and offline**.

## Boundaries / non-changes (explicit)

- **No engine/CLI/test/BAML edit.** The gold-master reads existing artifacts; it asserts nothing new
  in code. (If it did, that would be a different card.)
- **No ticket frontmatter edit** (phase/status left to Lisa, per rdspi-workflow §Phase Rules 3).
- **No new ticket files** (decompose-epic owns minting; the friction overflow was already escalated by
  T-062-03-04 as a proposed downstream epic).
- **No live metered cast** (P7 — human-authorized; left as `⟪…⟫`).
- **Commits left to Lisa** (file-locked serialization; the working tree carries uncommitted
  sibling-thread kitchen work — a by-hand `git add` would entangle it).
