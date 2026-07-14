# T-058-01 Research — vend-init-template-overlay-seam

Descriptive map. What exists, where, how it connects. No solutions.

## The ticket, restated

Extend `vend init` with an optional `--template <name>` that, after the base scaffold applies,
**overlays** a named template's files through the SAME converge discipline (write-if-absent, never
clobber, reported as DATA). Unknown name → a clean refusal listing available templates. Honest-empty
held (overlay adds structure/charter/SEED, NEVER demand). Bare `vend init` stays byte-identical.

This ticket is the **seam + a trivial template registry** so `--template hackathon` resolves; the
hackathon template *content* is T-058-02/03 (E-058 decomposition).

## The base scaffold — `src/init/init-core.ts` (E-040, PURE)

The addon-free heart. Everything here takes/returns plain values — no fs/clock/addon — so
`init-core.test.ts` is an ordinary pure-function test.

- **`ScaffoldEntry`** (`:24`) — the single shape both planner and effect derive from:
  `{ kind: "dir"; path }` | `{ kind: "file"; path; contents }`. POSIX, root-relative, no `./`.
- **`InitAction`** (`:30`) — `create` (absent) | `skip` (present, nothing to write).
- **`InitPlan`** (`:37`) — `{ actions, creates, skips }`; `creates` empty ⇒ already scaffolded (A5).
- **`LISA_MARKERS`** (`:47`) — `["CLAUDE.md", ".lisa.toml"]`; either suffices.
- **Seed content** (`:49`–`:123`) — `EMPTY_BOARD`, `EMPTY_ARCHIVE`, `PM_README`, `PROCESS_GATE`,
  `CHARTER_STUB`, `VISION_STUB`, `VEND_GITIGNORE`. The board/archive carry ZERO demand rows by
  construction (the IA-3/IA-4 honest-empty rule); `CHARTER_STUB` is a placeholder (`docs/knowledge/charter.md`).
- **`SCAFFOLD_MANIFEST`** (`:129`) — the canonical ordered list (parent-before-child, creation-safe
  for a naive sequential writer). 18 entries. The single source of truth.
- **`normalizePath`** (`:159`, private) — strips leading `./` and a trailing `/` so a real `readdir`
  listing matches a manifest path. The one place caller path quirks die.
- **`isLisaProject`** (`:169`) — true iff the listing contains any `LISA_MARKERS` entry. PURE.
- **`planInit(existing, manifest = SCAFFOLD_MANIFEST)`** (`:180`) — THE converge planner: one action
  per manifest entry (present⇒skip, absent⇒create) + the `creates`/`skips` projections. PURE, total,
  deterministic. Idempotency falls out directly. **Takes a `manifest` param already** — tests pass a
  focused fixture; this is the seam a template overlay can ride.
- **`countDemandRows(contents)`** (`:209`) — the honest-empty *measure*: counts the two structural
  demand-row shapes (`^vend chain "` and `^- \*\*E-\d`). Seeds return 0. Reusable by the effect /
  a later `vend doctor`. The pattern: a tested pure helper exposed ahead of full wiring.

## The write effect — `src/init/init-effect.ts` (E-040, ADDON-FREE but IMPURE)

The thin world-touching shell that APPLIES a plan the pure core produces. Imports only
`node:fs/promises`, `node:path`, and the pure core.

- **`InitApplyResult`** (`:37`) — `{ created, skipped }` (manifest-relative POSIX paths). DATA.
- **`pathExists(abs)`** (`:46`, private) — `stat`→true, ENOENT→false, else throw. The house ENOENT idiom.
- **`applyInitScaffold(projectRoot, manifest = SCAFFOLD_MANIFEST)`** (`:67`) — scan which manifest
  paths exist → `planInit(existing, manifest)` → materialize only `creates` (dirs via recursive
  `mkdir`, files via the EXCLUSIVE `wx` flag; EEXIST → reclassify create→skip, TOCTOU-safe). **Already
  parameterized on `manifest`** — passing a merged base+overlay manifest writes the overlay through
  the identical no-clobber path with no change to this function.
- **`InitOutcome`** (`:112`) — `{ kind: "not-lisa"; root }` | `{ kind: "scaffolded"; result }`. The
  refusal is DATA (a typed andon), not a throw. The shape a new `unknown-template` kind extends.
- **`runInit(projectRoot)`** (`:130`) — `readdir` → not lisa ⇒ refuse (writes nothing) → else apply.
  The composition the CLI arm calls. This is where a `template?` param threads in.

## The CLI — `src/cli.ts` (PURE parse + impure dispatch)

- **`USAGE`** (`:17`) — the banner; the `vend init` line (`:27`) gains `[--template <name>]`.
- **`ParsedCommand`** (`:43`) — the `init` variant is `{ cmd: "init" }` (`:91`); it gains an optional
  `template?: string`. Precedent for "spread a key only when present" is everywhere (e.g. `svg`'s
  `...(out ? { out } : {})` at `:209`, `run`'s `skipGates`).
- **`parseArgs`** (`:150`) — routes `init` to `parseInitArgs` (`:164`).
- **`parseInitArgs`** (`:219`) — TODAY rejects ALL args (`argv.length > 1` ⇒ usage). Must learn one
  flag, `--template <name>`. The exact idiom to mirror is `parseSvgArgs` `--out` (`:201`): read the
  next word, reject a missing/`--`-prefixed value, else capture. The `--seat` validated-enum block
  (`:196`) is the membership-check pattern (but template names are validated at DISPATCH against the
  registry, like a play name — NOT at parse, keeping the parser addon/registry-free).
- **The init dispatch arm** (`:844`–`:863`, under `import.meta.main`) — lazy-imports `runInit`, maps
  `not-lisa` → stderr fix-it + exit 1, `scaffolded` → the create/skip tally + exit 0. The untested
  shell; a new `unknown-template` branch slots in beside `not-lisa`.

## Test patterns to mirror

- **`init-core.test.ts`** — pure, imports only `./init-core.ts`. `planInit` is exercised with the
  full manifest AND a focused fixture; `ALL_PATHS` models a fully-scaffolded listing; equivalence is
  asserted with `toEqual`. The home for `planTemplate`/merge/registry unit tests.
- **`init-effect.test.ts`** — guarded-live against a real `mkdtemp` root, torn down in `finally`.
  `seedBareLisa()` writes a root `CLAUDE.md`. Asserts: full-tree create, no-clobber (a pre-seeded
  sentinel left byte-identical + reported skipped), idempotent second apply, `runInit` refuse-or-apply,
  either-marker detection, and a focused-fixture create/skip partition. The home for the template
  overlay's guarded-live tests (idempotent overlay, unknown-template refusal writes nothing).
- **`cli.test.ts`** (`:498`) — pure parse tests; `parseArgs(["init"])` deep-equals `{ cmd: "init" }`
  (the byte-identical bare path the new code must preserve), `["init","junk"]` → unexpected-arg usage.

## The brief & epic (intent grounding)

`pm/brief-hackathon-example.md` piece A (`:16`–`:30`): the overlay reuses the *same* converge
planner; "pure core decides the overlay plan (`planTemplate(existing, base, overlay)`), the effect
writes." `E-058.md` decomposition (`:38`): T-058-01 is "pure `planTemplate`/overlay over the base
scaffold … unknown name → clean refusal … honest-empty preserved; the effect writes; FREE/deterministic."

## Constraints & assumptions surfaced

- **No-clobber is against the DISK, not base-vs-overlay.** Within one run the base seeds a path then
  the overlay may name the same path; the overlay's content must be the one that lands. So a naive
  "apply base THEN apply overlay sequentially" would let base's stub win (overlay skipped). The
  overlay must be **merged over the base before converging** so the effective manifest carries the
  overlay's content for shared paths; THEN converge against the disk (no-clobber preserved). (Design.)
- **`planInit` already takes a `manifest`** — the overlay rides the existing converge logic; no new
  write path is needed in the effect.
- **Honest-empty:** the overlay must add only structure/knowledge (SEED/charter/shelf-note), never a
  demand row. `countDemandRows` over the resulting board/archive must stay 0 — and the overlay must
  not touch `demand.md`/`demand-cleared.md`.
- **One-way-to-lisa:** the template names only vend-owned paths (never `CLAUDE.md`/`.lisa.toml`/root
  `.gitignore`).
- **Trivial registry:** `hackathon` only needs to *resolve* here; its rich content is T-058-02/03. The
  registered overlay should be minimal + honest-empty (a `SEED.md` stub), with merge-override capability
  tested via a fixture rather than baked into the real hackathon overlay yet.
- **Bare `vend init` byte-identical:** `{ cmd: "init" }` with no `template` key; the dispatch calls
  `runInit(cwd)` with no overlay → the exact E-040 path.
- **No live model**, FREE/deterministic — pure unit + guarded-live temp-dir tests only.
