# T-059-03 — Research: gold-master re-drive on the corrected seed

Descriptive map of the territory. T-059-03 is a **measurement ticket**, not a code ticket:
it re-runs the E-058 live drive on the *corrected* seed and re-captures the gold master.
"No `src/` change in this ticket" (AC4). The deliverable is a captured artifact + the RDSPI
trail, mirroring T-058-05.

## The arc this ticket closes

- **E-058 / T-058-05** captured the **negative** gold master: the shipped two-gesture flow
  (copy seed → `lisa init` → `vend init --template hackathon` → `vend steer`) produced an
  **honest-empty steer** — no board, no forks. Root cause pinned in code: `SEED.md` was
  never in steer's input path; steer graded an empty board + a generic charter stub and
  correctly abstained (the A3 risk *materialized*). The engine was proven sound by a
  *diagnostic* re-steer (intent hand-placed where steer reads it → coherent 4-signal board +
  2 forks + a grounded epic E-001). Captured to `examples/templates/hackathon-seed/
  EXPECTED-OUTCOME.md` (committed `b9751f0`).
- **T-059-01** (phase: done) wired the seed's intent into steer's input path.
- **T-059-02** (phase: done) overlaid the tuned hackathon charter where steer reads it.
- **T-059-03** (this ticket) re-drives the corrected flow live and turns the negative gold
  master positive — closing A3.

## The corrected wiring (T-059-01 + T-059-02), as it stands in the working tree

> Note: the T-059-01/02 `src/` edits are present in the **working tree but uncommitted**
> (`git diff --stat`: `src/init/init-core.ts`, `src/play/{steer,survey,project-context}.ts`
> + their tests). Their tickets read `phase: done` with full RDSPI trails. This ticket
> measures that corrected artifact; it adds no further `src/` change.

- `src/play/project-context.ts` — `SnapshotParts` gained an optional `intent?: string`
  (`project-context.ts:47`). `buildProjectSnapshot` emits a `## Stated intent (SEED.md)`
  section verbatim **only when `intent` is non-blank** (`project-context.ts:63-66`); absent/
  blank ⇒ section omitted ⇒ snapshot byte-identical (honest-empty preserved). `SEED_PATH =
  "SEED.md"` exported (`project-context.ts:22`).
- `src/play/steer.ts` — `assembleSteerInputs` (`steer.ts:112`) now reads root `SEED.md`
  tolerantly (`readFile(...).catch(() => undefined)`, `steer.ts:116`) and threads it as
  `intent` into `buildProjectSnapshot` (`steer.ts:120`). `survey.ts` got the identical wire.
- `src/init/init-core.ts` — `TEMPLATE_REGISTRY.hackathon` now overlays `HACKATHON_CHARTER`
  to `docs/knowledge/charter.md` (the path `CHARTER_PATH` steer reads). `mergeManifests`
  overrides the base `CHARTER_STUB` slot; no-clobber + idempotency hold.

## What the drive exercises (the shipped flow under proof)

The canonical drive (re-run block, EXPECTED-OUTCOME.md:104-119), all in a throwaway sandbox
so the committed template is never mutated:

1. `cp -R examples/templates/hackathon-seed/.` → clean `node_modules/.astro/.vend`.
2. `lisa init` — scaffolds `.claude/`, board dirs. **Free.**
3. `vend init --template hackathon` — overlays structure + `SEED.md` stub + the tuned
   `docs/knowledge/charter.md`; no-clobber leaves the seed's real root `SEED.md` intact.
   **Free.**
4. `vend doctor` — environment gate (lisa/claude on PATH, BAML addon, executor). **Free.**
5. `vend svg` — renders the work-graph SVG (the designer's window). Read-only, **free**.
6. `vend steer [--budget …]` — **the one metered cast.** Reads `docs/knowledge/charter.md`
   + the project snapshot (now carrying `SEED.md`) and stages a board + forks under
   `docs/active/pm/staged/steer.md`. **Costs real tokens; requires the live model.**

## The free-vs-metered boundary (the load-bearing constraint)

Confirmed against `src/cli.ts` and the environment:

- `init`, `doctor`, `svg` take no `--budget` — nothing is cast, **free**.
- `steer` (and `survey`/`work`) cast the live executor (`claude`, model
  `claude-opus-4-8`) via the Claude Agent SDK — **metered, real money**.
- There is **no `--dry-run`/preview** flag on `steer`: invoking it casts immediately.
- `ANTHROPIC_API_KEY` is **absent from the ambient env**; the metered cast runs under
  Doppler-injected secrets (`doppler` on PATH). So a live cast is a deliberate, secret-gated,
  money-spending action — exactly the human-authorized step the ticket gates on P7.
- **But steer's *input* is assemblable for free:** `assembleSteerInputs` is a pure-ish fs
  read; calling it without `castPlay` yields the `{project, charter}` the model would see, at
  zero spend. This is the deterministic proof surface for the make-or-break.

## What "make-or-break" means here, and what's in/out of scope

- **In scope (the make-or-break, A3):** a live drive stages a **non-empty, grounded** board
  off `SEED.md` (≥1 signal tracing to the team-finder line), rendered on the SVG surface;
  `EXPECTED-OUTCOME.md` re-captured positive + a forward-E1 record; A3 recorded **closed**.
- **Out of scope, recorded honestly, not papered over:**
  - **E-058 finding #3** — `codebase-memory-mcp` absent in a fresh seed blocks
    `decompose-epic`, so a *full* slice clear (decompose → work) is gated. The drive is
    expected to stop at "epic proposed, decompose refused" (a clean amber andon, exit 0).
  - **E-058 finding #2** — the cold-start chain prices ~120 min on the time axis; a tight
    `--budget` time funds nothing. Fund the steer cast generously; note the envelope used.

## Reference points

- `examples/templates/hackathon-seed/{SEED.md, charter.md, EXPECTED-OUTCOME.md}` — the seed
  under proof, its tuned charter, and the gold master to re-capture.
- `docs/active/work/T-058-05/{research,design,structure,plan,progress,review}.md` — the prior
  negative-drive trail; the comparison baseline and the document-shape precedent.
- `src/present/svg-file.ts` — `vend svg` (E-055/E-056); the designer's view.
- `docs/active/epic/E-059.md`; the honest-on-outcome discipline (gates-as-contract; never
  launder evidence; verify against real exit codes / git).

## Assumptions & constraints surfaced

1. The metered cast is **human-authorized (P7)** — an autonomous agent must not silently
   incur it. The honest deliverable separates what is free-provable now from what the human
   must authorize.
2. The gold master is **captured, not targeted** — its numbers (spend/host/model) are real or
   they are absent. Fabricated numbers would violate honest-on-outcome discipline (the worst
   failure mode: a positive gold master that was never driven).
3. The committed template must not be mutated — the drive runs in a tmpdir sandbox; only
   `EXPECTED-OUTCOME.md` may change, and only from a real run.
4. "Comparable, not identical" is the consistency bar (gated validity, not wording identity):
   a re-drive should yield a coherent grounded board, not the exact 4 signals.
