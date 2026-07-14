# T-058-03 — Structure

The blueprint: exact files, their sections, and the order to write them. No prose code —
the shape of each artifact. All five are net-new markdown under the seed root.

## Files

```
examples/templates/hackathon-seed/
  README.md            # CREATE — the visual drive script (the hero file)
  SEED.md              # CREATE — the one input the user authors
  charter.md           # CREATE — hackathon-tuned value function
  shelf-note.md        # CREATE — which plays first, in drive order
  EXPECTED-OUTCOME.md  # CREATE — target stub, filled by T-058-05
```

No files modified or deleted. `README-STACK.md` already defers to `README.md` (no edit
needed). No source under `src/` is touched — `bun run check` is structurally unaffected
(`tsconfig` `include: ["src"]`, no test files in `examples/`).

## README.md — sections (the drive script)

1. **Title + one-liner** — "Hackathon seed — drive it with vend." One sentence: a designer
   + a dev turn a one-line idea into a board you can *see* and a first cleared slice, in one
   session. State the pair (driver: dev; partner: designer).
2. **What you'll see (the centerpiece)** — leads the file. An ASCII sketch of the work-graph
   board (status columns: e.g. `ready / in-progress / blocked / done`; a red blocked edge),
   framed "this is the picture `vend svg` draws; T-058-04 serves the live one beside your app."
   The hero section per D1/D2.
3. **The drive (the two-gesture path)** — the copy → init → doctor → edit SEED → steer →
   review board → work sequence, as a single fenced block, gestures matching USAGE exactly,
   budgets in `<ms>,<tokens>`. Annotated so a designer can read what each line *does*.
4. **What each gesture gives you** — a tiny table: `init --template` (lay the wiring),
   `doctor` (deps green?), `steer` (board + the real forks), `work` (clear a slice on a
   budget), `svg` (render the board to a picture). Points at `shelf-note.md` for depth.
5. **The one thing you edit** — points at `SEED.md`; everything else is a cast.
6. **What "good" looks like** — points at `EXPECTED-OUTCOME.md` (the target).
7. **Honest boundaries** — board starts empty (first move is a cast); `--template` is the
   wiring seam; Cloudflare = config + green build, not a live deploy; the live drive is metered
   (you authorize the spend). Links to `README-STACK.md` for the run-the-app path.

## SEED.md — sections

1. **Heading** — "Your seed — the one thing you author."
2. **The idea (filled example)** — one line: a team-finder page matching hackathon-goers by
   skill + idea overlap; one or two sentences of flavor (it's a page in *this* Astro app).
3. **`> Replace this with your idea.`** — the mandated one-line instruction, visually distinct.
4. **The pair** — driver: a dev; partner: a designer (one line each on who does what).
5. **Note** — this is intent, not demand; the board is still empty until you cast `steer`.

## charter.md — sections (mirrors live charter spine, tuned)

1. **Title + one-paragraph framing** — the value function for *this* hackathon project; what
   `vend steer`/`work` read as steering; small by design.
2. **The clearing move (one paragraph)** — turn the seed idea into the right slice, right-
   sized, worth doing in this session — the same general move, hackathon stakes.
3. **What makes work valuable here (5 tuned criteria)** — Demo-advancing, Grounded,
   Session-sized, In-bounds, Showable. One line each (D4).
4. **The value, one line** — *a demonstrable runnable/deployable slice over polish.*
5. **Invariants (light-but-real gates)** — a short list: build stays green; the slice is
   demonstrable (you can see it); budget is a hard contract. 3–4 items, P-style IDs (H1…).
6. **Out of bounds for the session** — polish-maximalism, test-coverage completeness, infra
   perfection. The non-goals, tuned.
7. **Amendment rule** — capped at one page; add one, retire one. (Keeps the seed honest.)

## shelf-note.md — sections

1. **Heading + one line** — "Which play to reach for first." Points at `vend shelf` as the
   live menu (don't reproduce it).
2. **Read the seed → a board** — `survey` (board) vs `steer` (board **and** the forks); reach
   for `steer` first on a fresh seed.
3. **Clear the first slice** — `work [--budget <ms>,<tokens>]`; the 2h/2M default if omitted;
   spends down the staged board until a clean stop.
4. **See it** — `svg [--seat designer]` renders the board to a picture (the designer's window).
5. **One-line ordering recap** — doctor → steer → (review) → work → svg.

## EXPECTED-OUTCOME.md — sections (target stub)

1. **Banner** — "TARGET, not a captured result. T-058-05 fills the live numbers." Loud.
2. **A good drive yields** — three bullets: a coherent ranked board off the seed; a handful
   of genuine forks (not junk, not self-referential); ≥1 cleared slice with a run-log record.
3. **Placeholders for the live capture** — labelled `FILLED BY T-058-05`: board item count,
   the actual forks framed, the slice cleared, the budget spent, the forward-E1 record.
4. **Why this exists** — the re-runnable consistency bar (the product-level probe); comparable
   across runs.

## Write order

research → design (done) → this. For implementation: charter.md and SEED.md first (the
drive *references* them), then shelf-note.md, then README.md (it links the others), then
EXPECTED-OUTCOME.md. Order is for authoring coherence only — files are independent.

## Verification shape (for Plan)

- `bun run check` green (must be unaffected — the proof the seed is self-contained).
- `grep` the five files for any `E-/S-/T-` board IDs → none (honest-empty).
- Cross-check every gesture string against `src/cli.ts` USAGE (spelling + budget format).
- Confirm README leads with the picture and links README-STACK.md / SEED.md /
  EXPECTED-OUTCOME.md / shelf-note.md.
