# T-012-01 — Research

_Widen `SOURCE_PREFIXES` to cover `.lisa/hooks/` — closing the commit gate's self-exempt blind spot._

Descriptive only. What exists, where, how it connects. No solutions proposed.

## The ticket in one sentence

The `check:committed` gate (E-008) refuses to let an agent stop with uncommitted **source** in the
working tree. Its definition of "source" lives in one exported constant, `SOURCE_PREFIXES`. That set
covers `src/`, `baml_src/`, and `ci/` — but **not** `.lisa/hooks/`, the very shell scripts that fire
the gate. The hooks police every commit yet are themselves outside the policed scope.

## The gate's anatomy (pure/impure split)

The gate is two files in `src/ci/`, following the house pure/impure discipline (`ci-strategy.md`,
mirrored by `press-core` / `gates` / `decompose-epic-core`):

- **`src/ci/committed-core.ts`** — PURE. Every export takes a plain string, returns fresh values; no
  fs, clock, network, process, or git. Three exports:
  - `SOURCE_PREFIXES = ["src/", "baml_src/", "ci/"] as const` (line 28) — the **R12 SHARED
    CONTRACT**. Documented as "the single source of what counts as uncommitted source"; every
    consumer derives scope from it and "never re-lists it." Comment explicitly says: _"Widening the
    contract later is a one-line edit here."_ This ticket is that one-line edit.
  - `parsePorcelainLine(line)` (line 42) — extracts the path field from one `git status --porcelain`
    v1 line. Handles index-3 slice, ` -> ` rename destinations, and one layer of C-quote stripping.
    Untouched by this ticket.
  - `classifyPorcelain(porcelain)` (line 62) — splits porcelain text into lines, parses each, KEEPS
    only paths matching some prefix in `SOURCE_PREFIXES`, returns a sorted/deduped offender list. The
    prefix test is a plain `path.startsWith(prefix)`. Behaviour is fully driven by `SOURCE_PREFIXES`,
    so widening the constant automatically widens classification — no logic change needed.

- **`src/ci/check-committed.ts`** — IMPURE entry behind `bun run check:committed` (package.json:12).
  Under `import.meta.main`: resolves repo root via `git rev-parse --show-toplevel`, runs
  `git status --porcelain` at that root, hands stdout to `classifyPorcelain`, then exits. Exit codes:
  `0` clean, `1` ANDON (uncommitted source — the D-005 failure mode), `2` environment error (git
  missing / not a repo). Smoke-only, not unit-tested. Consumes scope solely through
  `classifyPorcelain`; it never references `SOURCE_PREFIXES` directly, so it inherits the wider scope
  for free.

## The test surface

**`src/ci/committed-core.test.ts`** — pure-function test, imports only `committed-core.ts`. Three
`describe` blocks:

1. `parsePorcelainLine` — five line-shape cases (blank, modified, staged, rename, quoted).
2. `classifyPorcelain` — AC fixtures (dirty→fail-list, clean→empty, untracked→flagged) plus scope
   edges: non-source root config/docs → empty; `ci/` in scope; gitignored runtime → empty; staged
   counts; rename→destination; dedup+sort; mixed source/non-source.
3. `SOURCE_PREFIXES (R12 shared contract)` — one test asserting the **exact** array
   `["src/", "baml_src/", "ci/"]`. **This assertion will break the moment the constant is widened**
   and must be updated in lockstep — it is the canary that proves the contract changed deliberately.

Notable existing edge already in the suite: `" M .vend/menu.json\n"` is asserted to NOT be flagged —
documenting that non-source `.`-prefixed runtime paths stay out of scope. The new `.lisa/hooks/` scope
must remain narrow enough not to disturb that intent for other `.`-dirs.

## The hooks directory on disk

`.lisa/hooks/` currently contains four tracked shell scripts:

```
.lisa/hooks/on-clear.sh      (5752 B)
.lisa/hooks/on-heartbeat.sh  (338 B)
.lisa/hooks/on-idle.sh       (333 B)
.lisa/hooks/on-stop.sh       (3299 B)   ← the T-008-02 trigger that invokes check:committed
```

`git ls-files .lisa/` confirms all four hooks plus `.lisa/.gitignore` are tracked. The on-stop hook is
the gate's own trigger — the self-referential heart of E-012.

## `.lisa/` ignore topology (the scope-safety question)

The AC requires the new scope flag dirty hooks **without** flagging non-hook `.lisa/` paths. Two
ignore layers keep `.lisa/` runtime state out of porcelain entirely:

- **`.lisa/.gitignore`** ignores `signals/` → `.lisa/signals/` never appears in `git status
  --porcelain` (no `--ignored` flag is ever passed).
- **Root `.gitignore`** ignores `.lisa-layout.kdl`, `.vend/*` (keeping `.vend/decisions.jsonl`).

So `.lisa/` runtime/state (signals, layout) is already invisible to the classifier. Choosing the
prefix `.lisa/hooks/` (not the broader `.lisa/`) is the conservative cut: it polices exactly the
committed shell scripts and cannot reach `.lisa/signals/` or any future `.lisa/` state dir even if
such a dir were accidentally un-ignored.

## Constraints & assumptions

- **Prefix matching is literal `startsWith`.** `.lisa/hooks/` (with trailing slash) matches
  `.lisa/hooks/on-stop.sh` but not a hypothetical sibling `.lisa/hooksomething`. Trailing slash
  matters and matches the existing convention (`src/`, `ci/`).
- **`as const` tuple typing.** `SOURCE_PREFIXES` is `readonly [...]`; the R12 contract test compares
  against an exact literal array, so the test fixture must be widened in the same change.
- **No consumer re-lists scope** — the AC explicitly forbids re-listing. Verified: `check-committed.ts`
  goes only through `classifyPorcelain`; no other file references `SOURCE_PREFIXES` except the test.
- **Single working tree, single branch.** No DAG/dependency interaction; `depends_on: []`.
- **Verification is reproducible offline.** The pure classifier can be unit-tested directly; the live
  ANDON behaviour can be smoke-checked by touching a dummy file under `.lisa/hooks/` and running
  `bun run check:committed`, then removing it.
