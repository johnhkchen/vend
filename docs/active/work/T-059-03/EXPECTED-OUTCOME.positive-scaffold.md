# Expected outcome — the gold master (captured from a real live drive)

> ⚠️ **NOT YET CAPTURED — POSITIVE RE-DRIVE PENDING THE HUMAN-AUTHORIZED METERED CAST (P7).**
> This is a **draft scaffold**, not the committed gold master. The committed
> `examples/templates/hackathon-seed/EXPECTED-OUTCOME.md` is still the *negative* gold master
> (T-058-05) and stays that way until a real positive drive replaces it.
>
> **To close it:** run the metered cast (plan.md Track 2 / the re-run block below) under
> Doppler secrets, then replace every `⟪…⟫` slot with the **observed** value and flip this
> banner to:
> `✅ CAPTURED, NOT A TARGET — real numbers from the corrected live drive, <date>, host <…>,
> executor claude (model claude-opus-4-8), total real spend $⟪…⟫.`
> Do **not** fill any `⟪…⟫` with a guess — a number that was not observed must stay `⟪…⟫`.

---

## Headline verdict (the A3 finding) — input fix PROVEN, board capture PENDING

The A3 root cause from T-058-05 was **input wiring**: `SEED.md` was never in steer's input
path, so steer graded an empty board + a generic charter stub and honestly abstained. That
half is now **closed deterministically and for free** (see `steer-input.proof.txt`): on a
freshly-`vend init --template hackathon` sandbox, `assembleSteerInputs` now emits a
`## Stated intent (SEED.md)` section carrying the team-finder line, and the charter steer reads
is the hackathon value function — **not** the stub. The honest-empty rule no longer has grounds
to fire.

The remaining half — that the model, given this corrected input, **stages a non-empty grounded
board** — is the metered cast captured below. Fill it from the live run.

---

## What the drive actually yielded

| What | Target | Actual (live) |
| --- | --- | --- |
| Input fix: SEED.md + hackathon charter reach steer (FREE, deterministic) | present | **✅ present** — proven, zero spend (`steer-input.proof.txt`) |
| Board items off the seed (shipped flow) | a coherent ranked set | ⟪N — and confirm ≥1 traces to the team-finder line⟫ |
| Forks framed | a handful of genuine ones | ⟪N⟫ |
| Slices cleared | ≥ 1 (gated by finding #3) | ⟪epic minted? decompose andon?⟫ |
| Budget spent (tokens, ms) | within the funded envelope | ⟪steer: … tok / … s; total $…⟫ |
| Forward-E1 record accrued | yes | ⟪yes/no — propose-epic record `intervened:false`?⟫ |

### The coherent board (from the live cast)

⟪Paste the ranked board staged at `docs/active/pm/staged/steer.md`. Each signal should quote
or trace to the seed's team-finder idea. "Comparable, not identical" to T-058-05's diagnostic
4-signal board (Keystone→Leaf) is the bar — not the exact same wording.⟫

### The genuine forks (verbatim sample)

⟪Paste 1–2 forks verbatim, each recommendation-first.⟫

### The SVG board (the designer's view)

⟪`vend svg` after the cast: how many cards rendered, and what the designer sees beside the
running Astro preview. Note that the work-graph view renders decomposed slices — if decompose
is refused (finding #3) the board may show the staged signals only.⟫

---

## Honest boundaries (recorded, not papered over)

1. **finding #3 — `codebase-memory-mcp` absent in a fresh seed.** A *full* slice clear
   (decompose → work) is OUT OF SCOPE for this ticket and is expected to stop at a clean amber
   andon. ⟪Record exactly where the drive stopped: epic proposed? decompose refused with
   `missing-capability: codebase-memory-mcp`?⟫
2. **finding #2 — budget envelope.** ⟪Record the `--budget` used and whether the cold-start
   chain priced inside it (the chain prices ~120 min on the time axis; a tight time funds
   nothing).⟫

---

## Re-run block (the authorized drive — reproduce a comparable run)

```bash
SANDBOX=$(mktemp -d "${TMPDIR:-/tmp}/vend-seed-drive-XXXX")
cp -R examples/templates/hackathon-seed/. "$SANDBOX/"
rm -rf "$SANDBOX/node_modules" "$SANDBOX/.astro" "$SANDBOX/.vend"
VEND=$PWD/src/cli.ts
( cd "$SANDBOX" && lisa init )
( cd "$SANDBOX" && bun run "$VEND" init --template hackathon )   # ~11 created / 7 skipped
( cd "$SANDBOX" && bun run "$VEND" doctor )                      # green: 4/4
( cd "$SANDBOX" && bun run "$VEND" svg )                         # honest-empty SVG
# THE METERED CAST (human-authorized, P7) — corrected flow, no diagnostic charter swap:
( cd "$SANDBOX" && doppler run -- bun run "$VEND" steer --budget 7200000,400000 ) # → grounded board
# Optional — drive to the honest stop (finding #3):
( cd "$SANDBOX" && doppler run -- bun run "$VEND" work --budget 7300000,500000 --no-intervened --stale-ok )
#   → expect propose-epic clears, decompose andon: missing codebase-memory-mcp
```

> Note the difference from T-058-05's re-run block: there is **no `cat charter.md SEED.md >
> docs/knowledge/charter.md` diagnostic step**. The intent now reaches steer through the
> shipped wiring (T-059-01/02), so the corrected drive uses the *shipped* flow directly — that
> is the whole point of this re-capture.

---

## Why this exists

A hackathon demo is a one-shot; the point of vend is that the *clearing* is repeatable. T-058-05
captured the honest negative: the shipped seed yielded an empty steer, pinned to input wiring.
T-059-01/02 fixed the wiring; this drive turns the gold master positive. The input fix is proven
here for free; the board capture is the one authorized cast that closes the loop.
