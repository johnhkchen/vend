# T-060-03-01 — Structure: files, artifacts, and the shape of the flip

The blueprint. What is created, modified, left untouched, and the internal shape of the rewritten gold
master. No prose code — the shape of the change.

## Repo files — the complete set of writes

| Path | Action | Notes |
| --- | --- | --- |
| `examples/templates/hackathon-seed/EXPECTED-OUTCOME.md` | **MODIFY** (full rewrite) | The flip: negative → positive. The one product-surface change. |
| `docs/active/work/T-060-03-01/research.md` | CREATE | (done) |
| `docs/active/work/T-060-03-01/design.md` | CREATE | (done) |
| `docs/active/work/T-060-03-01/structure.md` | CREATE | this file |
| `docs/active/work/T-060-03-01/plan.md` | CREATE | next |
| `docs/active/work/T-060-03-01/progress.md` | CREATE | the drive, as run — captured outcomes |
| `docs/active/work/T-060-03-01/runs.jsonl` | CREATE | durable copy of the sandbox `.vend/runs.jsonl` (evidence) |
| `docs/active/work/T-060-03-01/review.md` | CREATE | the handoff |

## Explicitly NOT touched

- **`src/**`** — no source change. This ticket measures the shipped artifact.
- **`src/engine/cast.ts`, `src/log/run-log.ts`, their `*.test.ts`, `justfile`** — present in the
  working tree (T-060-01-02 / unrelated). Left **unstaged**. Active for the drive, committed by their
  own ticket, not this one.
- **The committed seed template** (`SEED.md`, `README.md`, `charter.md`, `src/`, etc. under
  `examples/templates/hackathon-seed/`) — the drive runs on a `cp -R` sandbox; the template is never
  mutated. Only `EXPECTED-OUTCOME.md` is written back.
- **Ticket frontmatter** (`docs/active/tickets/T-060-03-01.md`) — Lisa advances `phase`/`status`.

## The sandbox (ephemeral — not in the repo)

```
$SANDBOX (mktemp -d)/                # throwaway; stripped of node_modules/.astro/.vend after cp
  SEED.md                            # rich team-finder seed (survives no-clobber)
  docs/knowledge/charter.md          # ← HACKATHON_CHARTER overlaid by vend init (steer reads here)
  docs/active/pm/staged/steer.md     # ← board + forks written by vend steer (shipped flow)
  docs/active/epic|stories|tickets/  # ← minted by the propose→decompose chain (the cleared slice)
  .vend/runs.jsonl                   # ← the run records (forward-E1 + reducedGrounding) — CAPTURED
  .vend/work-graph.svg               # ← vend svg render
```

The only thing extracted from the sandbox into the repo is `.vend/runs.jsonl` → `work/.../runs.jsonl`,
plus the captured numbers/quotes transcribed into `progress.md` and `EXPECTED-OUTCOME.md`.

## `EXPECTED-OUTCOME.md` — the positive shape (section-by-section)

The rewrite keeps the file's spine (it is a recognizable evolution of the negative one, so a reviewer
can diff intent) but flips each verdict. Target ~same length (~150 lines).

1. **Capture banner** (`> ✅ CAPTURED, NOT A TARGET`) — restamp: date **2026-06-29**, host darwin,
   executor `claude` / `claude-opus-4-8`, throwaway sandbox, **new total spend** (from the drive).
   Keep the "honest-on-outcome" sentence; the seed is now driven end-to-end on the shipped path.

2. **Headline verdict** — was "the shipped flow produces an honest-empty steer (A3 finding)". Now:
   the shipped flow (`copy → lisa init → vend init --template hackathon → vend steer`) produces a
   **coherent ranked board + genuine forks**; `vend work` (calibrated default budget) clears **≥1 real
   slice** end-to-end — propose mints the epic, decompose **degrades-and-clears** (optional MCP absent
   ⇒ reduced grounding, recorded, not andoned) into stories/tickets. **The A3 finding is closed by
   E-059; findings #2/#3 by T-060-02 / T-060-01.** One honest caveat retained: decompose ran with
   **reduced grounding** (no `codebase-memory-mcp` in the fresh sandbox) — a recorded degrade, and the
   cold-start wallet overshoots by design until the ledger warms.

3. **"What the drive actually yielded" table** — flip the Actual column:
   - Board items off the seed (**shipped** flow): `0 — honest-empty` → **N — coherent ranked set**.
   - Drop the separate "intent wired — diagnostic" row (no longer a distinct condition) OR keep it as
     a historical note that the shipped flow now matches it.
   - Forks framed: from the live board (count + 1 verbatim sample).
   - **Slices cleared: ≥1** (was "1 epic minted, decompose refused") — now epic + decomposed
     stories/tickets, with the reduced-grounding marker.
   - Budget spent (ms, tokens, $) — from the drive; quote stays the p90 price (IA-8).
   - Forward-E1 record accrued: **yes** — chain casts carry live `intervened:false` (+ reducedGrounding).

4. **The coherent board** — the real ranked signals from the live steer (leverage-ordered), each
   grounded in a `SEED.md` quote. Replaces the prior diagnostic-only board.

5. **The genuine forks** — 1–2 verbatim forks from the live drive.

6. **The cleared slice (`vend work`)** — propose-epic clears (mints `E-00x`); decompose-epic
   **clears with reduced grounding** (mints stories/tickets). Replaces the negative "decompose andon"
   paragraph. Note the run records: `intervened:false`, `reducedGrounding:true`, no instant
   budget-exhausted.

7. **The SVG board** — `vend svg` renders the populated graph (now with decomposed slices to draw,
   unlike the negative drive's 0 cards).

8. **"What this means" / follow-ups** — flip from three OPEN findings to three **CLOSED** ones
   (E-059, T-060-01-01/02, T-060-02-02), then a short "residual imperfections" (cold-start overshoot,
   reduced-grounding grounding depth) so the file stays honest, not triumphal.

9. **Re-run block** — drop the diagnostic `cat charter.md SEED.md > …` line; reflect the shipped
   `vend steer` and the omit-`--budget` `vend work`. The block should reproduce a *comparable* drive.

10. **"Why this exists"** — keep; update the closing line to "re-run after E-059/E-060 landed and this
    table fills green across the shipped flow" → now it does.

## Ordering constraints

1. The drive (Implement) must run **before** `EXPECTED-OUTCOME.md` is rewritten — the numbers/quotes
   come from the real run. R/D/S/P artifacts are authored from prior knowledge; only progress.md,
   runs.jsonl, EXPECTED-OUTCOME.md, and review.md depend on the drive's output.
2. `runs.jsonl` is captured from the sandbox **before** the sandbox is discarded.
3. The commit is last, after the gate is re-confirmed green (no `src/` change ⇒ it stays green).

## Verification surface (what proves the AC)

- `work/T-060-03-01/runs.jsonl` contains a chain record with `intervened:false`,
  `reducedGrounding:true`, `outcome:"cleared"`-equivalent, and a decompose record that minted slices —
  no `missing-capability`, no instant budget-exhausted.
- `EXPECTED-OUTCOME.md` headline reads positive (board renders AND a slice clears) and is committed.
- `bun run check` still green (sanity; this ticket changes no `src/`).
