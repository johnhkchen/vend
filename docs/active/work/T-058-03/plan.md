# T-058-03 — Plan

Ordered, independently verifiable steps. This is a documentation ticket: "implement" = write
five markdown files; "test" = the gate stays green + content checks. One commit (all five
files are one coherent unit; none is independently shippable).

## Step 1 — Capture the gate baseline

Confirm `bun run check` is green *before* any change, so a green check after proves the seed
additions are inert to vend's build.

- **Do:** run `bun run check` (baml:gen + typecheck + test); record pass/fail + test count.
- **Verify:** green. (Baseline from memory/context: ~1295 tests passing.)

## Step 2 — Write `charter.md` (the value function steer/work read)

- **Do:** author the hackathon-tuned charter per structure §charter — clearing framing, 5
  tuned criteria (Demo-advancing, Grounded, Session-sized, In-bounds, Showable), the one-line
  value (*demonstrable runnable slice over polish*), 3–4 light-but-real invariants, out-of-
  bounds, one-page amendment rule.
- **Verify:** under ~one page; no `E-/S-/T-` IDs; reads as steering context, not vend's own
  charter copied.

## Step 3 — Write `SEED.md` (the one authored input)

- **Do:** filled team-finder idea (a page for *this* Astro app) + the `> Replace this with
  your idea.` line + the pair (driver: dev / partner: designer) + the intent-not-demand note.
- **Verify:** exactly one filled idea; the replace-me line present and distinct; no board IDs.

## Step 4 — Write `shelf-note.md` (which plays first)

- **Do:** drive-order note — `vend shelf` as the live menu, survey-vs-steer (steer adds
  forks), `work [--budget <ms>,<tokens>]` (2h/2M default), `svg [--seat designer]`, the
  doctor→steer→work→svg recap.
- **Verify:** every gesture matches `src/cli.ts` USAGE spelling; budget format `<ms>,<tokens>`.

## Step 5 — Write `README.md` (the visual drive script — the hero)

- **Do:** author per structure §README — leads with the **what-you'll-see** ASCII board
  sketch (status columns + a red blocked edge), then the annotated drive block (copy → init
  --template → doctor → edit SEED → steer → review → work), the gesture table, links to
  SEED.md / shelf-note.md / EXPECTED-OUTCOME.md / README-STACK.md, and the honest-boundaries
  section (empty board, --template seam, Cloudflare config-not-live, metered live drive).
- **Verify:** picture leads the file; gestures match USAGE; links resolve to real sibling
  files; designer-legible (no stack/build minutiae — those stay in README-STACK.md).

## Step 6 — Write `EXPECTED-OUTCOME.md` (target stub)

- **Do:** loud TARGET banner; "a good drive yields" (coherent board / genuine forks / ≥1
  cleared slice); `FILLED BY T-058-05` placeholders (counts, forks, slice, budget, E1 record);
  the why (re-runnable consistency bar).
- **Verify:** unmistakably a target (no invented live numbers); placeholders explicit.

## Step 7 — Content + honest-empty audit

- **Do:** `grep -rERn '\b[EST]-[0-9]' examples/templates/hackathon-seed/*.md` over the five
  new files → expect no board-item IDs (refs to ticket/epic IDs in prose are acceptable only
  where they name the *spec*, e.g. "T-058-05 fills this"; no *seeded demand*).
- **Do:** cross-check each gesture string against `src/cli.ts` USAGE one more time.
- **Verify:** no seeded demand; gesture spellings exact.

## Step 8 — Re-run the gate

- **Do:** `bun run check` again.
- **Verify:** green, same test count as Step 1 — proves the markdown additions are inert.

## Step 9 — Commit

- **Do:** stage the five new files; commit
  `feat(examples): vend drive wiring for hackathon-seed — README/SEED/charter/shelf/expected (T-058-03)`.
- **Note:** the modified ticket frontmatter files in the working tree (process-gate.md,
  T-058-0x.md) are NOT mine to commit — stage only the five seed files + this work dir.
- **Verify:** `git status` shows only intended files staged; commit clean.

## Testing strategy

- **No unit tests** — there is no code; the artifacts are markdown. The correct gate is
  "vend's build is unaffected" (Steps 1 & 8) + the content audit (Step 7). This matches the
  T-058-02 precedent (a docs/scaffold ticket verified by the gate staying green, not new tests).
- **Live behavior (steer/work actually producing a board off the seed)** is explicitly
  **out of scope** here — that is the metered T-058-05 drive. This ticket writes the wiring;
  T-058-05 proves it.

## Risks / watch-items

- **R1 — gesture drift.** If USAGE changes before T-058-05, the README's strings go stale.
  Mitigated by sourcing every string from cli.ts at write time + the Step 7 cross-check.
- **R2 — `--template` honesty.** README documents the seam T-058-01 ships; prose must not
  imply it runs today. Handled by the honest-boundaries section.
- **R3 — honest-empty.** A real `.svg` or any board item would seed demand. Mitigated by the
  ASCII-sketch decision (D2) and the Step 7 grep.
