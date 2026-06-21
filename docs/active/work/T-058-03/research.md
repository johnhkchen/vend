# T-058-03 — Research

Mapping the codebase reality this ticket layers onto. Descriptive only — what exists,
where, and how it connects. No solutions here.

## What the ticket is

Layer the **vend drive wiring** into `examples/templates/hackathon-seed/` — the markdown
files that turn the T-058-02 frontend scaffold into a copy-and-drive vend project. Five
files: `README.md` (visual-centered drive script), `SEED.md` (one filled idea + "replace
me"), `charter.md` (hackathon-tuned value function), `shelf-note.md` (which plays first),
`EXPECTED-OUTCOME.md` (a *target* stub the live drive T-058-05 fills). No source code.

## The seed as it exists today (T-058-02 output)

`examples/templates/hackathon-seed/` already carries the Astro + React + Cloudflare
scaffold:

- `package.json`, `astro.config.mjs`, `tsconfig.json`, `wrangler.toml` — the stack.
- `src/pages/index.astro` + `src/components/HackathonApp.tsx` — one page, one React island
  (`client:load`), proof the `@astrojs/react` integration hydrates.
- `.github/workflows/deploy.yml` — deploy-on-push to Cloudflare Pages (config present,
  NOT a live deploy — no creds in this env; the designer sets repo secrets in their fork).
- `README-STACK.md` — frontend stack notes. **Crucially, it explicitly defers the drive
  script to this ticket**: *"The drive script (copy → init → steer → work) lives in the
  `README.md` added by T-058-03."* So `README.md` is a new file, not an edit of
  `README-STACK.md`.
- `dist/`, `node_modules/`, `.astro/` — build output + deps (gitignored / generated).

No `README.md`, `SEED.md`, `charter.md`, `shelf-note.md`, or `EXPECTED-OUTCOME.md` yet —
all five are net-new to the seed.

## The CLI surface the drive script must match (`src/cli.ts`)

The shipped `USAGE` banner (cli.ts:17–30) is the source of truth for gesture spelling:

- `vend survey [--budget <ms>,<tokens>]` — cold-start board bootstrap, reads whole project.
- `vend steer [--budget <ms>,<tokens>]` — capstone: board **and** the real forks.
- `vend work [--budget <ms>,<tokens>] [--board <path>] [--stale-ok]` — autonomous spend loop.
- `vend svg [--seat <designer|dev>] [--out <path>]` — render the live board to a static `.svg`.
- `vend shelf` — browse the context-aware shelf.
- `vend init` — scaffold the cwd over a bare lisa project, no-clobber.
- `vend doctor` — read-only preflight (probes lisa & claude & BAML deps).

**Budget format is `<ms>,<tokens>`** (e.g. `--budget 600000,400000`) — two comma-joined
ints, not a human string. The drive script must use this exact shape.

### Open tension: `vend init --template` is not shipped yet

`parseInitArgs` (cli.ts:220) rejects ANY token after `init`: *"unexpected init argument"*.
The `ParsedCommand` `init` arm (cli.ts:91) is `{ cmd: "init" }` — no `template` field. The
`--template <name>` overlay seam is **T-058-01**, which is still `status: open / phase:
research` with no work artifacts. T-058-03 `depends_on: [T-058-02]` only — so per the DAG
the two run concurrently.

The brief (`pm/brief-hackathon-example.md`) and epic (`E-058.md`) both treat
`vend init --template hackathon` as the canonical seam every example reuses, and this
ticket's AC explicitly lists it as a gesture the README must carry. So the README documents
the **intended contract** (the brief's exact drive). This is a documentation artifact whose
gesture list is the spec T-058-01 implements against — consistent with how the brief is
written. Honesty note: the README should not imply the overlay is already shippable today.

## The gestures the drive points at (`src/play/`)

- `steer.ts` — "the demand-extraction CAPSTONE one scale above Survey: where Survey reads
  the whole rough project and stages a ranked demand BOARD (the *what*), Steer reads it and
  stages a board AND the real FORKS (the *decisions*)." One gesture in, board + forks out,
  for human assent. Blue/Green permanent.
- `survey.ts` — the cold-start bootstrap one scale below steer (board only, no forks).
- `work.ts` — the "fund a macro-wallet once, walk away" gesture. `DEFAULT_MACRO_BUDGET =
  { timeMs: 7_200_000, tokens: 2_000_000 }` (2h / 2M tokens) when `--budget` omitted.
  Walks the ranked board, spends down across casts until a clean stop. Staged boards are
  tried in order: the steer board (board + forks), then the survey board fallback.

These were authored **against the vend repo itself**. The make-or-break A3 risk (brief +
epic) is whether they produce a coherent board off a *thin domain seed* — de-risked by the
shipped steer self-referential-demotion fix (E-044), proven for real only by T-058-05.

## The charter shape to tune (`docs/knowledge/charter.md`)

The live charter is the **value function** the work-clearing playbook checks every unit
against. Its spine, which the hackathon charter must echo (tuned, not restated):

- **The clearing house framing** — stands between intent and execution capacity; admits a
  unit only if it is worth allocating.
- **Five value criteria**: Purposeful, Grounded, Allocatable, In-bounds, Verifiable. These
  are "the steering" — an agent that internalizes them produces valuable, not merely valid,
  work.
- **Invariants P1–P7** (Author once / two gestures / gates are the contract / autonomy by
  default / local-first / executor-agnostic / budget is a hard contract).
- **Non-goals N1–N4** (not a chat copilot / not a babysitting dashboard / not a one-off
  prompt runner / not an executor).
- **Capped at ~one page**; amendment requires retiring another entry. Small by design.

The hackathon charter is a *project-local* charter for the seed project — it tunes the
value function to hackathon stakes (a demonstrable runnable slice over polish, right-sized
to a session) while teaching the same general clearing move. It is what `vend steer`/`work`
read as steering context (`project-context.ts` exposes `CHARTER_PATH`).

## The visual surface the README centers (E-055/E-056)

`vend svg` renders the live board to a static `.svg` (status columns, blocked edges in red)
— the designer's window, served beside the running app (that wiring is T-058-04, not this
ticket). The README's "what you'll see" must make the **picture** the centerpiece, not the
code — Maya the designer is the protagonist (E-058 intent).

## Constraints (from AC + charter invariants)

1. **Honest-empty held** — the overlay adds structure + charter + SEED, **never demand**.
   The board starts empty; the first move is a cast (IA-3/IA-4). The files must not seed any
   `E-`/`S-`/`T-` board items.
2. **Self-contained under `examples/`** — `tsconfig.json` `include: ["src"]` only, and the
   seed has no test files, so `bun run check` (baml:gen + typecheck + test) is unaffected.
   Confirmed: markdown additions cannot touch the gate.
3. **Designer-legible** — README is a visual script, not a dev README; the SVG board is the
   hero of "what you'll see."
4. **Gesture spelling matches USAGE** — exact command shapes and the `<ms>,<tokens>` budget.
5. **EXPECTED-OUTCOME is a TARGET stub** — describes the shape of a good drive; T-058-05
   fills it from the real live run. Must read as a target, not a captured result.

## Assumptions surfaced

- The pair is **driver: dev / partner: designer** (ticket + brief). The dev runs the
  gestures; the designer reads the board.
- `vend init --template hackathon` is documented as the canonical entry even though
  T-058-01 ships it in parallel — acceptable for a spec-grade drive script, flagged honestly.
- No edit to `README-STACK.md` (it already hands off to `README.md`).
