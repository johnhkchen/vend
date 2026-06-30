# T-061-01 — Plan

_Phase: Plan. Ordered, independently verifiable steps + testing strategy._

## Testing strategy (up front)

- **Unit-level (the gate):** `src/packaging.test.ts` reads the root manifest at
  runtime and asserts the three AC invariants (semver ≠ 0.0.0; `private` absent;
  `bin.vend === "./src/cli.ts"` and that file exists). These run inside `bun test`,
  hence inside `bun run check`.
- **Integration / smoke:** manually invoke the entrypoint through its declared bin
  path to confirm the shebang + path actually execute (`bun run ./src/cli.ts` and
  observe the USAGE banner / a known verb). No automated e2e is warranted for a
  manifest edit; the dependent ticket T-061-02 owns `--version` execution tests.
- **Regression guard:** the manifest test fails if any future change reintroduces
  `private`, resets the version, or breaks the `bin` path — cheap insurance.
- **Verification criteria for "done":** `bun run check` exits 0 with the new test
  present and passing; `git status` clean after commit (the repo's "done means
  committed" gate).

## Steps

### Step 1 — Edit `package.json`
- Change `"version": "0.0.0"` → `"version": "0.1.0"`.
- Delete the `"private": true,` line.
- Add `"bin": { "vend": "./src/cli.ts" }` after `"type": "module"`.
- **Verify:** file is valid JSON (`bun -e 'JSON.parse(await Bun.file("package.json").text())'`
  or simply that the next steps' tooling parses it). Eyeball the three fields.
- Atomic, self-contained.

### Step 2 — Add shebang to `src/cli.ts`
- Prepend a new first line `#!/usr/bin/env bun`; the existing header comment
  becomes line 2, unchanged.
- **Verify:** `head -2 src/cli.ts` shows the shebang then the original comment;
  `bun run check:typecheck` still passes (tsc tolerates the shebang — confirmed in
  Research).
- Independent of Step 1.

### Step 3 — Create `src/packaging.test.ts`
- Implement the blueprint from Structure: runtime read of `../package.json`
  relative to `import.meta.dir`; three assertions; the `bin` assertion checks the
  target file `exists()`.
- **Verify:** `bun test src/packaging.test.ts` passes in isolation.

### Step 4 — Run the full gate
- `bun run check` (baml:gen → typecheck → full test suite).
- **Verify:** exit 0. If red, diagnose against the offending step; do not proceed
  to commit until green. (Run under `doppler run --` if baml:gen needs secrets;
  per README, model-touching steps run under Doppler — baml:gen is codegen and
  typically does not, but use Doppler if it errors on missing env.)

### Step 5 — Smoke the entrypoint via the bin path
- Run the entrypoint the way the bin maps it: `bun run ./src/cli.ts` (no args) and
  confirm it prints `USAGE` and exits non-zero as designed; optionally
  `bun run ./src/cli.ts shelf` for a known harmless verb.
- **Verify:** the CLI executes through `src/cli.ts` (shebang present, path valid).
  This is a sanity check, not an automated test.

### Step 6 — Commit
- Stage `package.json`, `src/cli.ts`, `src/packaging.test.ts`, and the work
  artifacts under `docs/active/work/T-061-01/`.
- One atomic commit, message e.g.
  `feat(pkg): publishable manifest — 0.1.0, bin.vend, drop private (T-061-01)`.
- **Verify:** `bun run check:committed` style cleanliness — `git status` shows no
  uncommitted source after the commit.

## Sequencing rationale

Steps 1 and 2 are independent edits; 3 depends on both being in place to pass; 4
gates the whole; 5 is a human-confidence check; 6 lands it. The work is small
enough that 1–3 could be one edit pass, but keeping them named makes the
verification points explicit and the commit reviewable.

## Rollback / failure handling

- If Step 4 goes red **because of the shebang** (not expected): the shebang is
  removable without affecting the AC's literal text ("`bin.vend` resolves to the
  entrypoint" is satisfied by the path alone). Document the deviation in
  `progress.md` and drop to the path-only variant. The manifest edits (Steps 1, 3)
  stand on their own.
- If `bin` path needs to be a non-`.ts` once a compiled binary exists: out of
  scope here; that is a later E-061 ticket. Do not pre-point at a non-existent
  `dist/` artifact (it would fail "resolves").

## Out-of-scope reminders (do not do in this ticket)

- No `vend --version` verb, no `USAGE` line for it, no build-time semver embed —
  that is **T-061-02** (`depends_on: [T-061-01]`).
- No `files` / `repository` / `license` / `description` manifest additions.
- No release CI, no tarball/sha, no `vend.rb` — later E-061 tickets.
