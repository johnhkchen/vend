# T-058-03 — Design

Decisions for the five drive-wiring files, grounded in the research. Each decision names
the options, the choice, and what was rejected and why.

## D1 — README: visual drive script vs. dev README

**Options.** (a) A conventional dev README (install, scripts, structure). (b) A
**designer-legible drive script** centered on the picture — what you do (a few gestures)
and what you *see* (the board), with the SVG board as the hero.

**Choice: (b).** The AC is explicit ("designer-legible … the SVG board is the centerpiece
of *what you'll see*") and E-058's protagonist is Maya the designer. The dev-facing stack
detail already lives in `README-STACK.md`, which hands off to this file — so `README.md`
must NOT duplicate it. README.md links to README-STACK.md for the "run the app" path and
owns the **vend drive**.

**Rejected (a):** redundant with README-STACK.md and misses the whole point of the
non-dev channel proof — a code-first README is exactly the "knee-deep in code" failure
E-058 exists to refute.

## D2 — How to render "the SVG board as the centerpiece" in markdown

**Options.** (a) Embed a real `.svg` file. (b) Describe the picture in prose only. (c) An
**ASCII sketch of the board** (status columns, a blocked edge) inline, framed as "this is
what `vend svg` draws," plus the `vend svg` gesture to produce the real one.

**Choice: (c).** Honest-empty forbids shipping a populated board (it would be seeded
demand), and a real pre-rendered `.svg` of a non-empty board would violate that. An ASCII
sketch is *illustrative*, clearly not real data, and renders in any terminal/markdown
viewer a designer opens. It teaches the columns-and-red-edges reading of the board (the
E-055/E-056 grammar) without seeding anything. T-058-04 wires the *real* live SVG beside
the app; T-058-05 captures a real board. The README points forward to both.

**Rejected (a):** a committed non-empty `.svg` is seeded demand → breaks honest-empty.
An *empty*-board `.svg` is uninteresting and still adds a binary artifact for no teaching.
**Rejected (b):** prose alone fails "the picture is the centerpiece."

## D3 — SEED.md: the one filled idea

**Options.** (a) The ticket's suggested team-finder page. (b) Something more elaborate.

**Choice: (a) verbatim-in-spirit** — *"A team-finder page that matches hackathon-goers by
skill + idea overlap"*, a small **frontend** feature for the Astro app (in-domain: it's a
page you'd add to this very seed). Plus the mandated one-line "replace this with your idea"
and the pair line (driver: dev; partner: designer). SEED.md is framed as **the only input
the user authors** — everything downstream is a cast.

**Rejected (b):** the brief calls for a *thin* one-line seed; elaboration defeats the "you
author one line" proof and risks steer ranking the elaboration instead of clearing it.

**Honest-empty check:** SEED.md is *intent*, not *demand* — it is the raw input a cast
clears into a board. It seeds no `E-/S-/T-` items. This is the allowed shape (IA-3/IA-4:
the first move is a cast).

## D4 — charter.md: tune vs. copy the live charter

**Options.** (a) Copy `docs/knowledge/charter.md`. (b) A **hackathon-tuned** value
function that mirrors the live charter's *structure* (a clearing-house framing + a small
set of value criteria + a couple of invariants/non-goals) but re-points "valuable" at
hackathon stakes. (c) A freeform "hackathon vibes" note.

**Choice: (b).** The AC wants a charter "that teaches the general clearing move while
honestly domain-specific." Mirroring the live charter's spine (five criteria, P-style
invariants, capped-at-one-page discipline) teaches the move; re-pointing the value
function — **a demonstrable runnable/deployable slice over polish; right-sized to a
session; gates kept light but real** — makes it honestly hackathon-specific. It must read
as something `vend steer`/`work` consume as steering context (`CHARTER_PATH`).

**Rejected (a):** copying teaches vend's *own* values, not the hackathon's — and would
make steer self-referential (the very A3 risk). **Rejected (c):** a vibes note isn't a
value function; steer needs criteria it can judge against, and "gates light but real"
must stay enforceable (P3).

### The tuning, concretely

- **Value criteria** kept (renamed for the domain): Demo-advancing (does it move a runnable
  slice?), Grounded (in the actual app state — go and see the running preview), Session-sized
  (one sitting, one budget), In-bounds (doesn't break the green build / the deploy), Showable
  (you can *see* it work — a rendered page, a passing check).
- **Light-but-real gates:** the build stays green and the slice is demonstrable; polish,
  test-coverage maximalism, and infra-perfection are explicitly out of scope for the session.
- **Capped at one page** — same amendment discipline, so the seed charter can't bloat.

## D5 — shelf-note.md: how much to say

**Options.** (a) Full play catalog. (b) A **focused note** pointing at the articulation
trilogy in drive order: `survey`/`steer` to read the seed → board (+ forks), then `work`
to clear the first slice on a budget; `svg` to *see* it.

**Choice: (b).** The AC scopes it to "which plays to reach for first." It names the
shipped gestures (matching USAGE), explains the survey-vs-steer scale (steer adds the
forks), and the work spend-down with the `<ms>,<tokens>` budget and the 2h/2M default.

**Rejected (a):** a full catalog duplicates `vend shelf` (the live, context-aware menu)
and goes stale; the note should *point at* `vend shelf`, not reproduce it.

## D6 — EXPECTED-OUTCOME.md: target stub vs. filled gold master

**Options.** (a) Leave a one-line TODO. (b) A **structured target** describing the *shape*
of a good drive (a coherent ranked board off the seed, a handful of genuine forks, ≥1
cleared slice) with explicit "FILLED BY T-058-05" markers where the live numbers go.

**Choice: (b).** The AC: "writes the *target* shape; T-058-05 captures the actual outcome
into it." A structured stub with placeholders is the re-runnable bar the consistency probe
later compares against, and it tells T-058-05 exactly what to capture. It must read
unambiguously as a **target**, not a captured result (no invented board numbers).

**Rejected (a):** a bare TODO gives T-058-05 nothing to fill against and isn't the
"target shape" the AC asks for.

## D7 — Idempotency / overlay-readiness

The five files sit at the seed root so the (forthcoming) `vend init --template hackathon`
overlay copies them write-if-absent. No file collides with the base `vend init` scaffold
(which writes `.vend/`, `docs/`, knowledge tree — not these seed-root names), and none
collides with the T-058-02 files (distinct names; `README.md` ≠ `README-STACK.md`). So the
overlay is clobber-free by construction.

## Cross-cutting: honesty boundaries to hold in the prose

- `vend init --template` is the documented contract; do not claim it runs today if asked —
  but the drive script states it plainly as the entry (it is the spec T-058-01 implements).
- Cloudflare deploy = config present + green build, NOT live (carry README-STACK.md's line).
- The live metered drive (steer/work for real) is T-058-05 and the human authorizes spend (P7).
- The board starts **empty** — say so; the first move is a cast.
