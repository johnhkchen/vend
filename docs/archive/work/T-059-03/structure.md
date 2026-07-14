# T-059-03 — Structure: artifacts touched and their shape

This is a measurement ticket: **no `src/` files are created, modified, or deleted** (AC4).
The "structure" is the set of documentation artifacts and the throwaway proof harness — the
shape of the evidence, not the shape of code.

## Files — created / modified / untouched

| Path | Disposition | Why |
| --- | --- | --- |
| `docs/active/work/T-059-03/research.md` | **created** | RDSPI trail. |
| `docs/active/work/T-059-03/design.md` | **created** | RDSPI trail. |
| `docs/active/work/T-059-03/structure.md` | **created** | this file. |
| `docs/active/work/T-059-03/plan.md` | **created** | RDSPI trail. |
| `docs/active/work/T-059-03/progress.md` | **created** | Implement log — real drive output + the honest stop point. |
| `docs/active/work/T-059-03/review.md` | **created** | handoff. |
| `docs/active/work/T-059-03/EXPECTED-OUTCOME.positive-scaffold.md` | **created** | the positive gold-master **draft** with `⟪FILL FROM LIVE RUN⟫` slots; NOT the committed file. |
| `docs/active/work/T-059-03/steer-input.proof.txt` | **created** | captured stdout of the free input proof (the make-or-break evidence). |
| `examples/templates/hackathon-seed/EXPECTED-OUTCOME.md` | **UNTOUCHED** | the committed (negative) gold master stays until a real positive drive exists; flipping it is the human-authorized step. |
| `src/**` | **UNTOUCHED** | AC4 — this ticket measures, it does not change code. |
| `docs/active/tickets/T-059-03.md` frontmatter | **UNTOUCHED** | Lisa advances phase/status from artifacts. |

> The throwaway proof harness (`scratchpad/show-steer-input.ts`) lives outside the repo (the
> session scratchpad) — it imports from `src/` but adds nothing to `src/`, so AC4 holds.

## Shape of the positive gold-master scaffold

`EXPECTED-OUTCOME.positive-scaffold.md` is the *template* the human fills after the authorized
drive. It carries the same section spine as the committed negative gold master (so the diff
when it lands is legible), with every unobserved value marked:

```
# Expected outcome — the gold master (captured from a real live drive)
> ⚠️ NOT YET CAPTURED — POSITIVE RE-DRIVE PENDING HUMAN-AUTHORIZED CAST (P7).
> Replace every ⟪…⟫ slot with the OBSERVED value, then flip this banner to
> "✅ CAPTURED, NOT A TARGET" with the real date/host/model/spend.

## Headline verdict (the A3 finding) — now CLOSED on the input fix
  - input-fix proof (FREE, deterministic): steer input now carries SEED.md + hackathon charter ✅
  - board capture (METERED): ⟪board signal count⟫ grounded in the team-finder line

## What the drive actually yielded
  | Board items off the seed (shipped flow) | a coherent ranked set | ⟪N⟫ |
  | Forks framed | a handful | ⟪N⟫ |
  | Slices cleared | ≥1 (gated by finding #3) | ⟪epic minted? decompose andon?⟫ |
  | Budget spent | within funded envelope | ⟪tok / s / $⟫ |
  | Forward-E1 record accrued | yes | ⟪yes/no⟫ |

## Honest boundaries
  - finding #3 (codebase-memory-mcp absent): ⟪where the drive stopped⟫
  - finding #2 (budget envelope): ⟪envelope used⟫

## Re-run block  (the exact authorized commands — see plan.md §metered)
```

Two structural invariants of the scaffold:
1. **No slot is pre-filled with a guess.** Every number is `⟪…⟫` until observed. (The one
   exception is the input-fix proof, which *is* observed — free and deterministic — so it is
   filled and marked ✅.)
2. **The banner is loud.** A reader cannot mistake the scaffold for a captured gold master;
   the committed file remains the negative one until the human flips it.

## Shape of the input proof artifact

`steer-input.proof.txt` is the verbatim stdout of assembling steer's input on the
freshly-`vend init`'d sandbox (no model cast). It must show, unambiguously:
- a `## Stated intent (SEED.md)` section containing the team-finder line, and
- the `charter` being the hackathon value function ("what is worth building in this
  session"), not the generic `CHARTER_STUB`.

This is the deterministic evidence that the A3 root cause (SEED.md absent from steer's input)
is closed. It is the spine of the Implement phase.

## Ordering of work

1. R/D/S/P artifacts (analysis — no execution dependency).
2. Implement: run free preflight + input proof in a sandbox; capture `steer-input.proof.txt`;
   write `EXPECTED-OUTCOME.positive-scaffold.md`; write `progress.md`.
3. Review: `review.md`.

No inter-file code dependencies exist (nothing compiles); ordering is purely
narrative/evidence ordering.

## Boundaries respected

- **engine ⊥ play / no src change** — untouched; the wiring under measurement is T-059-01/02's.
- **honest-empty** — the proof confirms the snapshot only gains the intent section *because*
  `SEED.md` is present; a project without it stays byte-identical (T-059-01's safety, not
  re-litigated here).
- **one-way-to-lisa** — only vend-owned doc paths are written; no ticket frontmatter touched.
