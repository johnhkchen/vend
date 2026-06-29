# Brief — Fresh-seed full-slice clear (the recommended pull, prepped)

> **Build-ready PM brief** for `proposed-batch.md` #1 (visual-channel cycle). Elaborates E-058's
> deferred findings **#2 + #3** into a buildable spec, grounded in the E-058 gold master
> (`examples/templates/hackathon-seed/EXPECTED-OUTCOME.md`, `work/T-058-05/`) and E-059's in-flight
> wiring fix. Desk-only artifact; the actual code is built by the clearing play on pull (the PM writes
> only to `pm/`). On pull this becomes **E-060**.

## One-line intent

Make a designer's two gestures clear a **real slice end-to-end** on a fresh seed — not just render a
board. Close the two gaps E-059 deferred so the Set-B non-dev round-trip is **whole and re-runnable**.

## Context — where this sits

E-058 drove the hackathon seed live; the A3 risk materialized honestly (`EXPECTED-OUTCOME.md`). The three
findings split across two pulls:

- **E-059 (in flight)** wires the seed's `SEED.md` intent into steer → the board **renders** (finding #1).
- **This pull (findings #2 + #3 — deferred by E-059 as "separate signals")** makes a slice **clear**.

**Sequence: this depends on E-059** — the board must render before a slice can clear off it. Strictly
downstream; pull after E-059 lands.

## What gets built (two fixes + a proof)

### A. Finding #3 — `decompose` graceful-degrades without `codebase-memory-mcp`

On a fresh seed the clearing chain's `decompose-epic` refused with a missing-capability andon because
`codebase-memory-mcp` isn't present (a vend-repo capability, not a fresh-project one). The make-or-break
path (steer → board) never needs the MCP; only the deep decompose grounding does.

- **Behavior:** when the MCP is absent, `decompose` **proceeds** (does NOT andon) and **logs an honest
  reduced-grounding note** — decomposition runs against the seed + charter alone, plainly marked as
  reduced-grounding rather than silently lowering quality or hard-blocking the loop.
- **Resolved fork (vend-recommended, carried):** **graceful-degrade** — *not* ship-the-MCP (raises
  onboarding friction against P2/P5) and *not* hard-gate (blocks the seed's loop until the user installs).
  Override here if you'd rather ship-the-MCP or hard-gate.
- **Surface the signal on the run record** (pairs Frontier 6's stop-reason threading — batch #5) so a
  degraded clear is *countable*, not invisible.
- *House pattern:* the capability check stays where tool-resolution lives; the degrade is a
  missing-optional-capability branch, not a new andon path.

### B. Finding #2 — a seed-appropriate cold-start budget envelope

The cold-start propose→decompose chain prices ~120 min on the time axis (IA-8), so a tight two-gesture
`--budget` funds nothing — the P2 transaction collides with the P7 hard budget contract on exactly the
fresh-seed path the channel depends on.

- **Calibrate a seed envelope from the run-log fat tails (E-013 / `recalibrate`)** — measured, not guessed
  — that funds a real cold-start clear, and wire it as the hackathon seed's drive-script default so a
  designer's `vend work` is funded out of the box.
- Keep IA-8 honest: the quote stays the p90 price; the guard ≠ the price (E-050 funding-headroom).

### C. The proof — a LIVE closing re-drive (mirrors T-058-05)

Re-drive the seed end-to-end (steer → work) on a **sandboxed copy** (never mutate the committed template),
assert a **full slice clears** (a run-log record + a cleared forward-E1), and **update
`EXPECTED-OUTCOME.md`** to the *positive* gold master (board renders AND a slice clears) — the re-runnable
consistency bar.

## The drive (designer's path — target end state)

```
cp -r examples/templates/hackathon-seed my-hack && cd my-hack
lisa init
vend init --template hackathon
vend doctor                  # green
$EDITOR SEED.md              # one-line idea
vend steer                   # → board RENDERS (E-059)
vend work                    # → clears >=1 slice: FUNDED by default (B), DEGRADES gracefully w/o MCP (A)
```

## Acceptance criteria

1. On a fresh seed with no `codebase-memory-mcp`, `decompose` **clears** (does not andon) and the run
   record carries an **honest reduced-grounding marker**.
2. The seed's default budget **funds a cold-start `vend work`** to a real slice clear (no instant
   budget-exhausted on the two-gesture path).
3. A LIVE re-drive clears **≥1 slice end-to-end** and accrues a **cleared forward-E1** record.
4. `EXPECTED-OUTCOME.md` is updated to the **positive gold master** (board + cleared slice), comparable +
   re-runnable.
5. **No regression** to the make-or-break path (steer → board still works with the MCP present, as on the
   vend repo) and no new andon on the present-MCP path.

## Dependencies & risks

- **Dep — E-059** (board must render first). Strictly downstream.
- **Risk — degraded decompose quality.** Graceful-degrade trades grounding for flow; the honest note must
  make the trade *visible* — don't silently ship ungrounded decomposition (that regresses P-grounded /
  charter criterion 2).
- **Risk — envelope calibration on thin data.** The seed has little run-log history; calibrate from the
  vend repo's fat tails as a *starting* envelope, refine on the first real seed drive.

## Scope split (v1 vs later)

- **v1 (this pull):** the graceful-degrade branch + the seed envelope + one positive gold-master drive.
- **Later:** ship-the-MCP into the seed scaffold as an opt-in (if degrade proves too lossy); wire
  `EXPECTED-OUTCOME.md` into `src/probe` as a CI-gated consistency regression (carried from E-058).

## Verify on the machine before/at build (go-and-see)

1. Does `decompose` actually andon on a missing MCP today, and is the capability check the right seam to
   branch? (Reproduce E-058's finding #3 on a fresh sandbox.)
2. What does the cold-start chain really price on the seed *now* (post-E-059)? Calibrate **B** from that,
   not from the vend repo alone.
3. Does a degraded decompose still produce a **valid, allocatable** ticket set (gates pass), just less
   grounded? (The graceful-degrade must stay in-bounds — valid even if less valuable.)
