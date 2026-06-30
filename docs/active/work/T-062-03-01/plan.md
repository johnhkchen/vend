# T-062-03-01 — Plan

Ordered, independently-verifiable steps + the testing strategy. Each step is commit-sized.

## Testing strategy (what proves what)

- **Deterministic + gated (`bun run check`):** the seam (intent + tuned charter reach the steer
  snapshot) and the recorded board's validity (clears the gates, menu-render at index 0). This is
  the substance T-062-03-01 can prove offline — it goes in `bun test`.
- **No-spend trail artifact:** `steer-input.proof.txt` — the *real* `assembleSteerInputs` output,
  proving the shipped path (not just the test's reconstruction) emits the intent. Zero tokens
  (no `b.request`).
- **Deferred (not in this ticket):** the live metered `vend steer` ranking — T-062-03-03's
  human-authorized cast (P7). `expected-board.md` records the **target** it will be diffed against;
  no live numbers are invented here.

The bar (honest-on-outcome): this ticket asserts as **fact** only the deterministic seam and the
recorded board's gate-validity. The live ranking is recorded as an **expected target**, explicitly
not-yet-captured.

## Step 1 — author the seed-intent + tuned charter sources

Create `examples/templates/kitchen-seed/SEED.md` and `examples/templates/kitchen-seed/charter.md`
(content per structure.md §1–§2). Intent prose only; **zero demand rows**; menu-render named as the
first slice; charter tuned to "a usable menu the couple orders from", deferrals (ordering/shopping/
nutrition/polish) listed out-of-bounds.

**Verify:** files exist; eyeball for backtick/`${}` safety (text-embedded verbatim); `grep` confirms
no `vend chain "` / `- **E-` lines. Inert (not yet wired) — nothing else changes.

## Step 2 — wire the two files into the kitchen overlay

In `src/kitchen/kitchen-overlay.ts`: add the two `with { type: "text" }` imports and the two
`KITCHEN_OVERLAY` entries (`SEED.md` overlay-only; `docs/knowledge/charter.md` override). Extend the
header note (seed-intent + tuned charter; override-in-slot; one-way-to-lisa/honest-empty hold).

**Verify:**
- `bun run build` / `tsc --noEmit` clean (the `.md` text imports resolve natively).
- `src/kitchen/init-kitchen.test.ts` still green — `MERGED.length` auto-updates (SEED.md adds 1;
  charter overrides in-slot, no length delta); the "base workspace present" + `countDemandRows==0`
  + no-clobber assertions still hold.
- The overlay's headline-files test still passes (it checks a subset, unaffected).

Commit: `feat(kitchen): wire seed-intent + tuned charter into the kitchen overlay (E-062 S-062-03)`.

## Step 3 — the seam confirm test

Create `src/kitchen/seed-steer-seam.test.ts` with blocks A/B/C (structure.md §4):
- **A** — scaffold via `runInit(root,"kitchen")`; assert `SEED.md` + kitchen `charter.md` present,
  byte-equal to source (drift pin), charter ≠ generic stub.
- **B** — reconstruct the assembler output addon-free (`readFile` SEED + charter,
  `buildProjectSnapshot({srcFiles:[],…,intent})`); assert the snapshot contains
  `## Stated intent (SEED.md)` + the menu-render phrase, and `charter` is the kitchen function;
  negative control: `intent: undefined` ⇒ no section.
- **C** — define `GOLD_MASTER_BOARD: Steer` (keystone menu-render + tail + honest forks); assert
  `clear(...).status === "clear"`, `signals[0].tier === Keystone`, `signals[0].what` names the menu
  render. Share the keystone `what` string as an exported/const so `expected-board.md` quotes the
  identical text (anti-drift).

**Verify:** `bun test src/kitchen/seed-steer-seam.test.ts` green; then full `bun run check`.

Commit: `test(kitchen): confirm seed-intent reaches steer + record gold-master board (T-062-03-01)`.

## Step 4 — generate the no-spend proof + write the recorded board

- **Proof:** a throwaway script (run once, not committed as source) that `mkdtemp`s, `runInit(...,
  "kitchen")`, calls the **real** `assembleSteerInputs({ projectRoot })` (imports `steer.ts` — fine
  in a `bun run` process; the addon loads but **no `b.request` fires → zero spend**), and writes the
  `project` snapshot + charter head to `docs/active/work/T-062-03-01/steer-input.proof.txt`. Confirm
  the proof shows the `## Stated intent` section.
- **Recorded board:** write `docs/active/work/T-062-03-01/expected-board.md` (positive-scaffold
  form, `⚠️ NOT YET CAPTURED` banner, deterministic rows ✅, metered rows `⟪…⟫`, the ranked expected
  board, the re-run block). Quote the shared keystone `what` string verbatim from the test const.

**Verify:** `steer-input.proof.txt` contains `Stated intent (SEED.md)` and the menu-render line and
**no** cost/usage line (proving no metered call); `expected-board.md` invents no live numbers.

Commit: `docs(kitchen): record kitchen gold-master board + seam proof (T-062-03-01)`.

## Step 5 — full gate + progress

Run `bun run check` (`baml:gen → tsc --noEmit → bun test`). Record results in `progress.md`,
including any **pre-existing** failures (e.g. the known live-board `GraphIntegrityError` on S-06x→
E-06x edges noted in T-062-03's review) — verify-by-stash that they are not caused by this ticket,
and flag them in review (not silently absorbed). Update `progress.md` with deviations.

## Verification criteria (the definition of done for this ticket)

1. `vend init --template kitchen` lays a `SEED.md` (menu-render intent) **and** a kitchen-tuned
   `docs/knowledge/charter.md` — proven by `seed-steer-seam.test.ts` block A (drift-pinned).
2. The intent **reaches the steer snapshot** — `## Stated intent (SEED.md)` + the menu-render phrase
   appear in `buildProjectSnapshot` output (block B) and in the no-spend `steer-input.proof.txt`.
3. The recorded gold-master board **clears the steer gates** and has the **menu-render slice at
   index 0 / Keystone** (block C) — the AC's "highest-ranked slice is the menu-render slice."
4. The board is **recorded** in `expected-board.md` for the gold-master diff, honestly labeled
   not-yet-captured (the live ranking is T-062-03-03).
5. `bun run check` is green except for verified pre-existing failures (flagged, not introduced).

## Risks & mitigations

- **Scope creep into the live drive.** Mitigation: hard line — no `castSteer`, no tokens; live
  ranking deferred to T-062-03-03 and recorded as a target only.
- **Charter override breaking idempotency tests.** Mitigation: the merge already supports in-slot
  override; `init-kitchen.test.ts` is dynamic; run the full suite in Step 2.
- **Text-embed of `.md` failing under one toolchain axis.** Mitigation: `.json`/`.md` already embed
  in this overlay (seed.json, README.md) and resolve under tsc natively — `.md` is a proven axis;
  `bun run check` covers all three (gen/tsc/test).
- **The expected board mis-rank (a tail signal out of order) failing `clear`.** Mitigation: keep the
  board minimal (Keystone then Standard — strictly non-increasing); the test pins it, so a bad order
  reds immediately and is fixed before commit.
