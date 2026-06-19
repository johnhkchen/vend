# T-008-01 — Design: `check:committed`

*Options, tradeoffs, and the chosen approach — grounded in `research.md`. The
decisions a reviewer should be able to challenge in ~200 lines, before any code.*

---

## The shape, fixed by the ACs and the house pattern

Three pieces, non-negotiable from the ticket:
1. a **pure classifier** `porcelain string → offending source paths`,
2. a **thin impure entry** that runs `git status --porcelain`, classifies, exits,
3. a **`package.json` `check:committed` script** wiring `bun run` to (2).

The interesting design questions are the *boundaries* between them, not their
existence. Below: file placement, classifier signature, how git is invoked, exit
semantics, and scope edges.

---

## D1 — Where the code lives

**Options**
- **(a)** `src/ci/` — a new app-side domain folder: `committed-core.ts` (pure),
  `check-committed.ts` (impure entry), `committed-core.test.ts`.
- **(b)** `src/gate/` — reuse the existing gate folder alongside `gates.ts`.
- **(c)** Put it in the root `/ci` Dagger module.

**Decision: (a) `src/ci/`.**

- (c) is wrong by the Central Rule and S3077: `/ci` is a *separate program* that
  imports nothing from the app and cannot read the host working tree. Logic must
  live app-side as a `check:*` script. Rejected hard.
- (b) overloads "gate": `src/gate/gates.ts` is the **play-semantic** clearing
  contract (value/allocation/bounds/structural over a parsed WorkPlan). A
  commit-hygiene check is a **structural/CI** concern with a totally different
  input (git porcelain, not a WorkPlan). Co-locating would blur two unrelated
  meanings of "gate." Rejected.
- (a) matches the one-domain-folder-per-concern convention (`budget/`, `log/`,
  `engine/`…) and reads correctly: `src/ci/` is "the app-side logic the CI/lisa
  layer invokes." It is the natural future home for sibling `check:*` logic that
  outgrows a one-liner. Chosen.

Naming mirrors the press split exactly: `*-core.ts` pure + a plain entry file.

---

## D2 — The pure classifier's signature

**Options**
- **(a)** `classify(porcelain: string): string[]` — returns the offending source
  paths (empty = clean).
- **(b)** `classify(porcelain: string): { dirty: boolean; paths: string[] }`.
- **(c)** Return a discriminated result like `gates.ts` (`{status:"clean"} |
  {status:"dirty", paths}`).

**Decision: (a) — return `string[]` of offending paths; empty array = clean.**

The emptiness *is* the verdict (`paths.length === 0` ⇔ clean), so a separate
`dirty` boolean (b) is redundant state that can desync. The discriminated union
(c) is the right tool when there are *distinct kinds* of outcome carrying
*different data* (as gates' stop/clear do); here there is one kind with a list
that may be empty. `string[]` is the simplest total function that the AC's three
fixtures ("dirty source → fail-list; clean → empty; untracked `src/*.ts` →
flagged") map onto directly. The paths are sorted+deduped so output is
deterministic (fixtures assert exact arrays — cf. press-core tests asserting real
values, not frozen hashes).

Helper exported alongside: `SOURCE_PREFIXES = ["src/", "baml_src/", "ci/"]` as the
single source of the scope contract (R12). A second tiny pure helper
`parsePorcelainLine(line): string | null` extracts the path field (handling
`->` renames and surrounding quotes), returning `null` for blank lines. Keeping
line-parsing separate from prefix-matching keeps each unit independently testable.

---

## D3 — How `git` is invoked (the thin impure verb)

**Options**
- **(a)** Bun's `Bun.spawnSync(["git","status","--porcelain"])`.
- **(b)** Node `child_process.execFileSync`.
- **(c)** `Bun.$` shell template.

**Decision: (a) `Bun.spawnSync` with an argv array.**

The project is Bun-native (`engines.bun`, `@types/bun`, scripts run under bun).
`spawnSync` with an **argv array** (not a shell string) avoids shell-quoting
pitfalls and is the most direct, synchronous call — the gate is a fire-once
script, async buys nothing. `Bun.$` (c) invokes a shell and is overkill/risk for
a one-shot. Node `execFileSync` (b) works but `Bun.spawnSync` is the idiomatic
choice given `types: ["bun"]`.

- Run with `cwd` = the repo root. The entry will run `git rev-parse
  --show-toplevel` first to resolve the root, so the gate is correct regardless of
  the directory `bun run` is invoked from. (Falls back to `process.cwd()` if that
  fails — but a failure there means "not a git repo," an environment error.)
- `--porcelain` (v1) is stable, machine-readable, locale-independent — exactly
  what a classifier wants. We do **not** pass `--ignored` (so gitignored runtime
  stays invisible, per research §5) and do **not** pass `-z` (plain mode is
  enough for the fixtures; `-z` parsing is more complex — noted as a limitation).

---

## D4 — Exit semantics & error policy

Following the house rule (research §3): expected outcome = return/exit code;
programmer/environment error = throw.

- **Clean** (classifier returns `[]`) → write nothing (or a terse OK line) to
  stdout, `process.exit(0)`.
- **Dirty** (non-empty) → write each offending path to **stderr** with a short
  header naming the andon ("uncommitted source — commit before stopping"), then
  `process.exit(1)`. Non-zero is what a lisa hook / CI reads as the andon. This
  mirrors `cli.ts`'s "any non-success → non-zero exit."
- **git missing / not a repo** → the spawn fails or returns nonzero with no
  parseable output. This is an **environment error**, not "dirty." Decision:
  surface it loudly on stderr and exit with a **distinct non-zero code (2)**, the
  same convention `cli.ts` uses for usage/wiring errors (exit 2) vs. andon (exit
  1). A reviewer can challenge whether git-missing should be 1 or 2; 2 keeps
  "dirty source" (1) distinguishable from "couldn't even check" (2).

Only the pure core is unit-tested; the `import.meta.main` shell is smoke-only,
exactly as `cli.ts` / `press.ts` shells are untested.

---

## D5 — Rename, quoting, and the path field

The classifier must not be fooled by porcelain's two shapes:
- **Rename** `R  src/a.ts -> src/b.ts`: the uncommitted artifact is the
  destination. `parsePorcelainLine` splits on ` -> ` and takes the right side.
  (Both sides are under a source prefix in practice; taking the dest is the
  precise answer and avoids double-reporting.)
- **Quoting** `"src/\303\251.ts"`: strip a single layer of surrounding double
  quotes if present. Full C-unescaping is **out of scope** (no such paths exist in
  this tree; documented as a limitation). Stripping the quotes is enough for the
  prefix match to fire — better to over-flag a weird path than to miss it.

Prefix match is a plain `path.startsWith(prefix)` against `SOURCE_PREFIXES`. A
path is reported once (dedup via a Set; sort for determinism).

---

## D6 — Is the `check` aggregate updated?

**Decision: No.** `check:committed` is *not* added to the existing aggregate
`check` (`baml:gen && check:typecheck && check:test`). That aggregate is the
**structural build pipeline** run *during* work; commit-hygiene is a **post-stop**
gate with a different trigger (the lisa on-stop hook, T-008-02). Bundling them
would make every `bun run check` fail on a normal dirty mid-work tree — which is
the *correct* state during development. Keeping it separate preserves the
distinction between "is the code good?" (`check`) and "is the code *committed*?"
(`check:committed`). The hook in T-008-02 invokes `check:committed` directly.

---

## D7 — Scope edge: root files out of scope

The ACs scope failure to `src/` / `baml_src/` / `ci/`. A modified root
`package.json` or `tsconfig.json` will **not** fail this gate. This is a faithful
reading of the ticket (and convenient — committing this very script touches
`package.json`, which must not self-trip the gate). It is a **deliberate, narrow
scope**, but a genuine gap (uncommitted root config escapes). Recorded as an open
concern for review; widening the prefix set is a one-line change to
`SOURCE_PREFIXES` if the contract later grows.

---

## Chosen design, in one paragraph

A new `src/ci/` folder. `committed-core.ts` exports `SOURCE_PREFIXES`,
`parsePorcelainLine`, and `classifyPorcelain(text): string[]` — all pure, fully
fixtured in `committed-core.test.ts`. `check-committed.ts` is the thin
`import.meta.main` shell: resolve repo root, `Bun.spawnSync` `git status
--porcelain`, feed stdout to `classifyPorcelain`, print offenders to stderr and
`exit(1)` if any, `exit(0)` if clean, `exit(2)` on a git/environment failure. A
`check:committed` script in `package.json` runs `bun run src/ci/check-committed.ts`.
Not added to the aggregate `check`. T-008-02 wires the lisa hook to call it.
