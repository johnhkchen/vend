# T-040-03 — Research: wire the `vend init` command

_Ticket: add the `vend init` command — a pure `parseInitArgs` + USAGE entry and the thin
dispatch arm that runs the scaffold effect and refuses cleanly (typed andon + fix-it hint)
when the cwd is not a lisa project. Advances P2, P5, E-040-entrypoint-accepts-init._

Descriptive only — what exists today, where, and how the pieces connect. No solutions here.

## The two prerequisites this ticket consumes

This is the third and final slice of E-040 (`vend-init-scaffold`). The work it stands on is
already landed and reviewed:

- **T-040-01 — pure core** (`src/init/init-core.ts`). Addon-free. Exports:
  - `SCAFFOLD_MANIFEST: readonly ScaffoldEntry[]` — the canonical dirs + seed files a vend
    scaffold layers onto a bare lisa project (17 entries: the `docs/active/*` board tree, the
    PM desk, the archive, knowledge stubs, and `.vend/.gitignore`).
  - `planInit(existing, manifest?)` — the pure converge planner (create-vs-skip).
  - `isLisaProject(existing: Iterable<string>): boolean` — true iff the listing contains ANY
    `LISA_MARKERS` entry.
  - `LISA_MARKERS = ["CLAUDE.md", ".lisa.toml"] as const` — both are project-ROOT files.
  - `countDemandRows`, `ScaffoldEntry`, `InitAction`, `InitPlan` types.
- **T-040-02 — write effect** (`src/init/init-effect.ts`). Impure but addon-free (imports only
  `node:fs/promises`, `node:path`, and the pure core). Exports:
  - `applyInitScaffold(projectRoot, manifest?): Promise<InitApplyResult>` — scans which manifest
    paths exist, asks `planInit`, materializes only the creates (dirs via recursive mkdir, files
    via the exclusive `wx` flag). No-clobber is absolute. Returns `{created, skipped}` as DATA.
  - `InitApplyResult { created: readonly string[]; skipped: readonly string[] }`.

Both have their own tests: `init-core.test.ts` (pure) and `init-effect.test.ts` (guarded-live
against a real temp dir). What is missing is the **CLI surface**: nothing routes `vend init`.

A signpost already exists. The `init-effect.ts` header reads: _"The `isLisaProject` refusal +
fix-it hint is the CLI's composition (T-040-03 init-cli-command), not this seam."_ So the
lisa-detection refusal is explicitly THIS ticket's job, layered on top of the two seams above.

## The CLI surface — `src/cli.ts` (746 lines)

The single entry point. Its shape is a firm house pattern, repeated across ten commands:

1. **`USAGE`** — a multi-line banner string, printed on any parse error. One line per verb.
2. **`ParsedCommand`** — a discriminated union (`cmd: "run" | "chain" | … | "usage"`). Each
   verb is one arm; `usage` carries an optional `error` string.
3. **`parseArgs(argv): ParsedCommand`** — PURE. Routes on `argv[0]` to a per-verb
   `parse<Verb>Args` helper. Never reads fs, never exits. Bare `vend` (no args) → `browse`.
4. **Per-verb parsers** — e.g. `parseShelfArgs`, `parseSurveyArgs`. The closest templates for
   `init` are the **flags-only, no-positional-subject** verbs:
   - `parseShelfArgs` (lines 148–151): takes NO arguments at all — `argv.length > 1` is a usage
     error. `shelf` reads-only and casts nothing, so it has no `--budget`. This is the exact
     shape `init` wants: `init` scaffolds the filesystem; nothing is cast, so nothing to fund.
   - `parseSurveyArgs` / `parseSteerArgs` (lines 320–380): flags-only with an optional
     `--budget`; any positional token is an error. A near-template but `init` needs no budget.
5. **The impure dispatch shell** — `if (import.meta.main) { … }` (lines 526–745). Parses
   `Bun.argv.slice(2)`, then one `if (parsed.cmd === …)` arm per verb. Each arm **lazily
   imports** its effect module (keeping the BAML addon off the pure-parse path), runs it, prints
   a line, and `process.exit(code)`s. This block does NOT run on import, so the test never
   touches it.

### Exit-code conventions in the dispatch shell

Observed across the arms:
- **`usage` → exit 2.** Malformed command line. Prints the error + the USAGE banner to stderr.
- **broken precondition → exit 1.** `no-menu`, `stale` (press), `no-board`, `empty-board`,
  `stale-board` (work). A clean refusal handed back as a typed `kind`, rendered to stderr, exit 1.
- **typed not-found andon → exit 2.** `no-play` (run dispatch): `res.error.message` to stderr.
- **success → exit 0.** Prints the receipt/tally to stdout.

So a "not a lisa project" refusal has two plausible precedents: the precondition family (exit 1)
and the typed-andon family (exit 2). It is an environment precondition, not a malformed command —
nearest to `no-board` (exit 1).

## The test surface — `src/cli.test.ts` (409 lines)

Pure-parser tests only. The header states the discipline outright: _"The `import.meta.main`
dispatch … does not run on import, so this test never touches the runner or the BAML addon — it
only exercises parsing."_ Every verb has a `describe`/`test` cluster asserting `parseArgs([...])`
deep-equals the expected `ParsedCommand`, plus the usage-error paths. The shelf cluster
(lines 399–408) is the tightest template: bare verb parses; any positional or flag is usage.

`init-effect.test.ts` is the guarded-live template for any fs-touching composition: `mkdtemp`
a temp root, seed it (`seedBareLisa` writes a root `CLAUDE.md`), run the effect, assert with
real `stat`/`readFile`, tear down in `finally`.

## The house pattern for testable composition

`pressShelf` (press.ts), `castWork` (work.ts), and `runPlay` (dispatch.ts) all return a
**discriminated union** that includes their precondition failures (`no-menu`, `no-board`,
`no-play`). The CLI arm stays thin: it switches on `kind` and maps to an exit code. The
precondition logic is in the effect module and IS tested. This is the established way to make a
refusal path testable rather than burying it in the untested `import.meta.main` block.

## Boundaries & constraints surfaced

- **Pure/impure split is sacred.** `parseInitArgs` must be pure (no fs, no exit) so it lives in
  cli.ts beside the other parsers and is unit-tested. Anything touching the filesystem (the
  cwd listing, `applyInitScaffold`) belongs in the impure shell or the effect module.
- **Lazy-import the effect** in the dispatch arm — the BAML-addon-avoidance idiom. (init-effect
  has no BAML, but the idiom is uniform and keeps the pure-parse path import-free.)
- **`LISA_MARKERS` are root files.** Detection only needs the cwd's top-level entries — a single
  `readdir(projectRoot)`, not a recursive walk.
- **`isLisaProject` already exists and is tested** — do NOT re-implement the marker check; feed
  it the cwd listing.
- **No budget on `init`.** Like `shelf`, scaffolding casts nothing.
- **AC verbatim:** `parseArgs(['init', ...])` tests cover bare `init` and unknown-flag→usage;
  USAGE lists the init line; the dispatch arm exits 0 after scaffolding and exits non-zero with a
  `'not a lisa project — run lisa init first'` hint when neither `CLAUDE.md` nor `.lisa.toml` is
  found.
- **The fix-it hint string** is partially specified by the AC: it must convey "not a lisa
  project" and point at `lisa init`.
