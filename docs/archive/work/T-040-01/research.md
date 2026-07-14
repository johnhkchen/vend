# T-040-01 — Research: the scaffold manifest, planner & lisa predicate

Descriptive map of what exists today and the boundaries this ticket lives inside.
No solutions here — those are Design's.

## What the ticket is

Define the **pure, addon-free heart** of `vend init` (epic E-040, story S-040-01):

1. a canonical **scaffold manifest** — the dirs + seed files a vend scaffold layers
   onto a bare lisa project,
2. a **pure converge planner** (`planInit`) — given a listing of what already exists,
   emit the correct *create-vs-skip* set, and
3. a **lisa-project predicate** (`isLisaProject`) — true only when the project is a
   lisa project (`CLAUDE.md` or `.lisa.toml` present).

**No filesystem is touched.** The write effect — mkdir/write-if-absent, no-clobber —
is the sibling ticket **T-040-02** (`depends_on: [T-040-01]`). This ticket is the
testable logic; T-040-02 is the impure shell that applies a plan it produces.

## The house pattern this slots into (the load-bearing precedent)

The repo has a strict, repeated **pure-core / impure-shell split**. Every gate or
gesture with non-trivial branching factors the branching into a `*-core.ts` module
that takes plain values and returns plain values — **no fs, clock, network, process,
or BAML native addon** — and is unit-tested as an ordinary pure-function test. The
impure verb (read fs, run git, exit the process) is a thin separate file.

Concrete precedents read for this ticket:

- **`src/ci/committed-core.ts`** (`committed-core.test.ts`): `SOURCE_PREFIXES` (a
  shared `as const` contract), `parsePorcelainLine` + `classifyPorcelain` (pure
  string→data). The impure verb (run `git status`, exit) lives in
  `check-committed.ts`. Header comment states the rule verbatim: "check *logic*
  lives here … the trigger is a thin shell that only invokes it."
- **`src/play/work-core.ts`** (`work-core.test.ts`): the pure parse+render half of
  `vend work`; `work.ts` is the impure shell that value-imports the BAML chain, so
  no `bun test` may value-import it. The pure module holds the branching and is
  unit-tested. This is the **exact shape** T-040-01 ↔ T-040-02 should mirror.

So the deliverable is `src/init/init-core.ts` + `src/init/init-core.test.ts`,
following `src/ci/`'s pure-core directory convention. There is **no `src/init/`
today** (`ls src/init` → absent) and **no prior `planInit`/`isLisaProject`/manifest**
symbol anywhere in `src/` (grep confirmed) — this is greenfield within an established
idiom.

## What a "vend scaffold" actually is (ground truth from this repo)

The structures `vend init` must lay down, read off the live project tree:

| Path | Kind | Role |
|---|---|---|
| `docs/active/` | dir | the active board root |
| `docs/active/epic/` | dir | pulled epic cards (empty at scaffold) |
| `docs/active/stories/` | dir | materialized stories (empty) |
| `docs/active/tickets/` | dir | materialized tickets (empty) |
| `docs/active/work/` | dir | per-ticket RDSPI artifacts (empty) |
| `docs/active/demand.md` | file | **the pull board** — must be honestly empty |
| `docs/active/pm/` | dir | the PM agent's upstream desk |
| `docs/active/pm/README.md` | file | desk charter (discovery vs processing) |
| `docs/active/pm/process-gate.md` | file | the `ready:` control flag |
| `docs/active/pm/staged/` | dir | staged proposals (empty) |
| `docs/archive/` | dir | history root |
| `docs/archive/demand-cleared.md` | file | **cleared-demand archive** — honestly empty |
| `docs/knowledge/` | dir | durable knowledge |
| `docs/knowledge/charter.md` | file | the value-function stub (authored later) |
| `docs/knowledge/vision.md` | file | the vision stub (authored later) |
| `.vend/` | dir | local-first runtime state (P5) |

Verified against the live tree: `docs/active/demand.md` is the board;
`docs/archive/demand-cleared.md` is the cleared ledger (note: **`docs/archive/`**, a
sibling of `docs/active/` — confirmed via `find`, the board header points to it);
`docs/active/pm/` holds `README.md` + `process-gate.md` + `staged/`.

## The empty-state rule (IA-3/IA-4) — load-bearing, not cosmetic

The epic and PRD §7.1 are emphatic: a fresh scaffold's board starts **honestly
empty**. Seed *structure + knowledge, never demand*. The first real move is a
Survey/Steer cast off a seed — vend never fabricates demand.

So the manifest's `demand.md` and `demand-cleared.md` seed content must carry the
*explanatory header* (what the board is, how pulls work) but **zero demand rows**.
Observed row shapes that must be absent from the seeds:
- a live board pull is a `vend chain "<signal>"` line (matched by
  `work-core.ts`'s `CHAIN_LINE = /^vend chain "(.*)"…/`),
- a cleared-archive row is a `- **E-0NN — …**` one-line epic record
  (`demand-cleared.md` is entirely such lines today).

The AC's third clause — "board and cleared-archive entries carry zero demand rows" —
is checkable by counting exactly those two shapes in the seed content.

## The lisa-project predicate

E-040 + PRD §7.2: `vend init` detects an existing lisa project via **`CLAUDE.md`** or
**`.lisa.toml`**. Both exist at the repo root today (confirmed via `ls -a`). Dependency
direction is **one-way: vend → lisa** — init *mirrors* lisa's own `init`, never modifies
lisa-owned files. The predicate's whole job: given a root listing, is this a lisa project?

## Constraints & boundaries surfaced

- **Purity:** `init-core.ts` must value-import nothing impure (matches
  `committed-core.ts`). `tsconfig` is `strict` + `verbatimModuleSyntax` +
  `moduleResolution: bundler` → type-only imports must say `import type`, and local
  imports carry the `.ts` extension.
- **Idempotency (A5):** the planner is the *converge* primitive. `planInit` over
  empty→full scaffold, full→zero creates, partial→only the gap. It must be a pure
  function of (manifest, existing-set) with no ordering surprises.
- **No-clobber is T-040-02's:** the planner only *decides* create-vs-skip; the
  byte-identical-leave guarantee is the write effect's test. Don't pull it forward.
- **One-way to lisa:** do **not** plan edits to root `.gitignore` (lisa-owned). The
  `.vend/*` ignore should live in a vend-owned `.vend/.gitignore`, not by mutating a
  lisa file (see the live root `.gitignore` for the intent to mirror).
- **Right-sizing (PE-7):** knowledge-stub *content* stays minimal placeholders; rich
  authored content is explicitly a follow-up epic, not this card.

## Open questions for Design

1. Manifest shape: flat `ScaffoldEntry[]` of tagged `dir | file`, vs. separate dir/file
   lists. (Lean: one tagged list — self-documenting, single source.)
2. How `planInit` consumes "what exists" — a `Set<string>`/`Iterable<string>` of paths,
   keeping it pure and trivially seedable from a real `readdir` in T-040-02.
3. Whether `isLisaProject` is folded into `planInit` or stays a separate predicate
   (AC lists them as separate guarantees → keep separate, compose in the shell).
4. How to express "zero demand rows" as a guarantee — a pure `countDemandRows` helper
   the test asserts `=== 0` on the two seed files.
