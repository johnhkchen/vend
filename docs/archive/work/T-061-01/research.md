# T-061-01 — Research

_Phase: Research. Descriptive map of the terrain. No solutions proposed here._

## Ticket in one line

Make `package.json` shippable: real semver, a `bin.vend` entry, and drop
`private: true`, so the binary/formula pipeline (E-061) has something installable
to point at. Gate (`bun run check`) must still pass.

## The manifest as it stands

`package.json` (30 lines) today:

```json
{
  "name": "vend",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "engines": { "bun": ">=1.3.9" },
  "scripts": { ... "check": "bun run baml:gen && bun run check:typecheck && bun run check:test", "build": "tsc --noEmit" },
  "dependencies": { "@boundaryml/baml": "^0.222.0", "envinfo": "^7.21.0" },
  "devDependencies": { "@types/bun": "latest", "typescript": "^5.7.0" }
}
```

Three fields are the whole job:
- `version: "0.0.0"` — placeholder. The epic "Done looks like" requires
  `vend --version` to report a **real** semver. Wiring `--version` to read it is a
  *separate* ticket (T-061-02); this ticket only sets the value.
- `private: true` — npm/Bun refuse to publish a `private` package, and more to the
  point the field signals "this is not a distributable artifact." The formula
  pipeline needs the manifest to read as a real, installable package.
- **No `bin` field.** There is no declared executable. Nothing maps the name
  `vend` to an entrypoint at the package level.

## The CLI entrypoint

`src/cli.ts` (≈690 lines) is the entrypoint. Header comment self-identifies as
"The `vend` CLI entry point (T-002-03)". Structure:
- Top of file is a block comment (line 1 is `// The \`vend\` CLI entry point ...`).
  **There is no shebang.** No file under `src/` carries a `#!/usr/bin/env` line
  (`grep -rl "#!/usr/bin/env" src/` returns nothing).
- Exports pure, tested helpers: `USAGE`, `parseBudgetArg`, `parseArgs`, etc.
- The impure shell is the `if (import.meta.main) { ... }` block at line 663 — it
  dispatches verbs, calls impure runners, writes stdout/stderr, and `process.exit`s.
  House pattern (stated in the header): parsing is pure + tested; the
  `import.meta.main` dispatch is the thin untested shell.

How it is invoked today: `justfile` line 9 sets `vend := "bun run src/cli.ts"`
and comments "No global `vend` binary is installed, so run the entrypoint through
bun." So the project already treats `src/cli.ts` as *the* entrypoint; it simply
has no package-level `bin` alias and no global install path. That global install
path is exactly what E-061 builds.

## `--version` is NOT currently handled

`grep -n "version\|--version" src/cli.ts` finds nothing. The CLI has no version
verb today. `USAGE` lists `run / chain / expand / annotate / survey / steer /
work / svg / shelf / init / doctor / envelope / audit` — no `--version`. So:
- Setting `version` in the manifest is **inert** for runtime behavior right now.
- The actual `vend --version` surface (and embedding the value so it survives a
  compiled single-file binary) is T-061-02, which `depends_on: [T-061-01]`. This
  ticket is the prerequisite data; that ticket is the wiring.

This boundary matters: T-061-01 must not over-reach into `--version` plumbing.

## The gate — what "still passes" means

`bun run check` = `baml:gen` (regenerate BAML client) → `check:typecheck`
(`tsc --noEmit`) → `check:test` (`bun test`). Relevant constraints:
- `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `module: ESNext`,
  `moduleResolution: bundler`, `allowImportingTsExtensions`, `noEmit`. `include`
  is `["src"]`. **`package.json` is not type-checked** (it is not under `src`).
- Confirmed experimentally: `tsc --noEmit --strict` tolerates a leading
  `#!/usr/bin/env bun` shebang on a `.ts` file (exit 0). So adding a shebang to
  `src/cli.ts`, if chosen, would not break typecheck.
- Tests: `src/cli.test.ts` (≈25 KB) imports the pure exports of `cli.ts`
  (`USAGE`, parse helpers). A shebang line does not change any export, so those
  tests are unaffected by a shebang. `src/smoke.test.ts` exists (small).

## Sibling / epic context (boundaries)

- **E-061** (epic): mirror lisa's distribution — `bun build --compile` per-platform
  binary, tarball + sha256, GitHub release, `vend.rb` in its own tap; extend the
  E-058 `vend init --template` seam. MVP is single-platform (arm64-mac) because
  vend's binary bundles BAML (~108 MB native addon), making cross-compile risky.
- **S-061** (story `publishable-package-manifest`): tickets `[T-061-01, T-061-02]`.
- **T-061-02** (`version-command-embeds-semver`, `depends_on: [T-061-01]`): adds
  `vend --version` reading the manifest semver, embedded at build so it survives a
  compiled binary (runtime `package.json` read is unavailable post-compile).
- Lisa is the verified reference: a compiled binary, own tap, sha-per-variant, MIT.

## Constraints & assumptions surfaced

1. **Scope is exactly three manifest fields** + keep the gate green. No `--version`
   runtime code belongs here (that is T-061-02).
2. **`bin` target must be a path that resolves.** `src/cli.ts` is the only
   entrypoint; pointing `bin.vend` at it is the natural choice. Whether the file
   *also* needs a shebang to be directly executable is a Design question.
3. **Removing `private` makes the package npm-publishable in principle.** The
   chosen distribution is brew + compiled binary, not `npm publish`; AC does not
   require full npm-publish readiness (e.g. `files`, `repository`, `license`
   fields), only that the manifest is no longer marked private and has a `bin`.
4. **`.gitignore`** ignores `dist/`, `node_modules/`, `baml_client/`. None of
   these interact with the manifest edit.
5. **Version value**: AC offers `0.1.0` as an example ("a non-zero semver"). The
   epic only requires "a real semver, not 0.0.0." First public pre-1.0 release.
6. **No existing `bin` consumer to break.** Since no `bin` exists today, adding one
   is purely additive; nothing references `node_modules/.bin/vend` yet.

## Open questions carried into Design

- Does `bin.vend` point at the raw `src/cli.ts`, or at a built/compiled artifact?
  (The compiled binary is produced by a *later* E-061 ticket; it does not exist in
  the tree yet, so a `bin` pointing at it would not resolve today.)
- Should `src/cli.ts` gain a `#!/usr/bin/env bun` shebang so the `bin` entry is
  actually executable when installed via a package manager, mirroring how real
  CLI packages ship? Or is "resolves to the entrypoint" satisfied by the path alone?
