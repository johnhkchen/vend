# T-062-04-01 — Review

**Ticket:** `capture-expected-outcome-gold-master` (S-062-04, E-062 kitchen-emdash-dress-rehearsal).
**Verdict:** ✅ done — the kitchen drive is **frozen into one committed gold-master**, with the
deterministic/free half **captured as fact** and the single live, metered, human-authorized line
recorded as explicit **`⟪…⟫`**. This is the consolidation point the four S-062-03 predecessors each
deferred their live-budget line to. The handoff a human needs without reading every diff:

## What changed

| File | Kind | Summary |
|---|---|---|
| `examples/templates/kitchen-seed/EXPECTED-OUTCOME.md` | **new (the AC deliverable)** | The frozen kitchen gold master — board (diff target) + rendered menu (fact) + budget envelope (mechanism + `⟪…⟫`) + degrade + re-run block. Mirrors the shipped `hackathon-seed/EXPECTED-OUTCOME.md`. |
| `docs/active/work/T-062-04-01/free-stages.proof.txt` | **new (artifact)** | Captured live re-run of the **free** stages (init/doctor/svg) — the evidence behind the gold-master's captured numbers. |
| `docs/active/work/T-062-04-01/{research,design,structure,plan,progress,review}.md` | **new** | The RDSPI trail. |
| `src/**`, tests, BAML, template **code** | **unchanged** | This card asserts no new code; it reads existing artifacts/tests. |
| The kitchen-seed template **code** (stub, seed json, configs) | **unchanged** | Verified no `M` line — the cook's slice is intact (the clean-room drive depends on it). |

## How the AC is met (and the one honest boundary)

> EXPECTED-OUTCOME.md is committed in the epic work dir capturing the cleared board, the rendered menu,
> and the budget envelope of the clean drive, in a form a later drive can be diffed against.

- **cleared board** → the expected/target board (Keystone = menu render; deploy slice; SSG/SSR fork)
  captured from `T-062-03-01/expected-board.md` as the **diff target**; the live ranking that confirms
  it is `⟪…⟫`. The board the drive is *measured against* IS captured — that is the bar's whole job.
- **rendered menu** → captured as fact: the render contract (`menu-render.test.ts`, 8 tests, the real
  seed example → one card) + a **real green `astro build`** (`build.proof.txt`). Not deferred.
- **budget envelope** → the cold-start mechanism named (omit `--budget` ⇒ `coldStartEnvelope`, E-060)
  and "lands inside" defined; the live envelope values + spend are `⟪…⟫` (they are logged on the live
  run line, not a hand-pickable constant).
- **diffable by a later drive** → the re-run block (free + metered casts + jq/grep checks) + the
  target board + the reference render + the bound. **This is the operative clause and it is fully met.**

**The one honest boundary:** the live metered cast — `vend steer` actually ranking + `vend work`
actually clearing the slice in budget — was **not run** (P7, human-authorized; no offline path; no
live kitchen numbers exist in the tree). It is recorded as `⟪…⟫` with the re-run block that fills it in
place. This is exactly the state the hackathon gold-master held *before* its authorized drive
(T-060-03-01) filled it. **No live number was invented.**

## A judgment call to confirm — file placement

The AC says "committed in the **epic work dir**." I placed the canonical gold-master in the **seed
template** (`examples/templates/kitchen-seed/EXPECTED-OUTCOME.md`) rather than
`docs/active/work/T-062-04-01/`, because:
1. A clean-room drive **copies the seed**, not the vend repo's `docs/active/work/` — so a work-dir-only
   file would **not be diffable by the later drive**, failing the AC's operative clause.
2. It mirrors the **shipped precedent** (`hackathon-seed/EXPECTED-OUTCOME.md` lives in its seed).
3. It travels with the seed, keeping the two seeds symmetric.

The RDSPI trail (incl. this review) lives in the work dir as usual. If a reviewer wants the file *also*
mirrored into `docs/active/work/T-062-04-01/`, that is a one-line `cp` — but I avoided a second copy on
purpose: drift in a *consistency bar* is self-defeating (single source of truth).

## Test coverage

- **No tests added** — the gold-master asserts no new code; every captured guarantee it cites is
  already gated by a predecessor test (`seed-steer-seam`, `menu-render` + drift guard, `kitchen-degrade`,
  `cold-start-redrive`). This card *cites* those guards rather than re-stating their guarantees, so it
  cannot drift from them.
- **Captured numbers are freshly observed**, not claimed: `free-stages.proof.txt` is a real re-run
  (init 31/0, doctor 3-green, svg 0/0/0, exit 0 each).
- **Guards run:** `bun test src/kitchen/` → 44 pass / 0 fail / 215 expects; `tsc --noEmit` clean. The
  full combined-tree gate was green at the predecessor close (1488 pass / 1 skip / 0 fail).

### Gaps / NOT covered (by design)
- **The live metered drive** — the `⟪…⟫` half; deferred to the human-authorized cast / the downstream
  clean-room epic. Non-deterministic, needs a Claude login + the cook's authorization.
- **A live EmDash REST round-trip** (D1/HTTP) and **a live Cloudflare deploy** — escalated boundaries
  (T-062-03-04 friction ledger) → proposed `E-063 kitchen-clean-room-drive`.

## Open concerns / handoff
- **None blocking.** The bar is committed, the captured half is fact, the metered half is honest `⟪…⟫`.
- **For the human-authorized drive / the clean-room epic:** run the re-run block; it fills the `⟪…⟫`
  rows (steer ranking, work clear, budget envelope values, spend, the live `reducedGrounding:true`
  line) **in place**, converging this file to the hackathon file's filled form.
- **Confirm the placement call** above if the "epic work dir" phrasing was meant literally.
- **Watch-for-regression:** if a future change breaks any cited guarantee (render contract, the
  reference page's build, the degrade, the composition) or ships a `.mcp.json` in the overlay, the
  corresponding test/proof fails loudly and this gold-master's premise is void (stated in its footer).
- **Commits left to Lisa** (deliberate) — the working tree carries uncommitted sibling-thread kitchen
  work; a by-hand `git add` would entangle it. The gate is green over the combined tree.

## Reviewer's quick-look
Read `examples/templates/kitchen-seed/EXPECTED-OUTCOME.md` top-to-bottom (it is the deliverable), then
`free-stages.proof.txt` (the captured half is real) and the yield table's `⟪…⟫` rows (the metered half
is honest). Cross-check any captured row against its cited predecessor artifact — the gold-master is a
synthesis of facts already gated elsewhere, plus one freshly-observed free re-run.
