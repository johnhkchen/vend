# T-062-03 — Design

**Ticket:** `release-ci-tarball-sha`. Decision: how the release CI is shaped, how much
packaging logic is lifted into tested code, and how the AC's integrity clause is proven
in the gate. Grounded in Research.

## The core decision: where packaging logic lives

The AC's substance is *"a sha256 that re-verifies against the downloaded tarball."* That
is a format/correctness claim — exactly the kind the repo insists on covering with a
**pure core + smoke test**, not trusting to inline YAML.

### Option A — pure-bash workflow (lisa's literal approach)
The workflow itself runs `bun run compile`, `tar -cJf …`, `shasum -a 256 … > sums`,
`gh release create …`. No new TS.
- ➖ The packaging logic (tarball name, member layout, sha format) lives only in YAML —
  **untestable by `bun run check`**. Drift (wrong name, wrong `-c` format, sha over the
  wrong bytes) is caught only by cutting a real tag — the slowest possible feedback.
- ➖ Violates the repo's firm "judgment lives in a tested core" idiom (compile-core,
  every `*-core.ts`). Would be the only piece of shippable machinery with no unit cover.
- ➕ Smallest file count; closest to lisa line-for-line.

### Option B — tested packaging script the workflow calls (CHOSEN)
A pure `release-core.ts` owns every string/argv decision; a thin impure `package.ts`
shell does the I/O; tests cover both. The workflow shrinks to: load pin → setup bun →
`bun run compile` → `bun run src/release/package.ts` → `gh release create`.
- ➕ Mirrors T-062-02 **exactly** (`compile-core.ts`/`compile.ts`/two test files), so the
  release machinery is consistent with the binary machinery it sits beside.
- ➕ The AC's integrity clause becomes a **gate-enforced** round-trip test: build a fixture
  "binary", run the real packaging shell, then `shasum -a 256 -c` the produced sums file →
  proves re-verification without a real release.
- ➕ Tag↔version guard becomes a **pure, unit-tested** function, not a sed one-liner.
- ➖ More files than Option A. Acceptable — it is the house style, and each file is small.

### Option C — everything in one `package.ts` (compile + tar + sha + release call)
Fold compile into the packaging script too.
- ➖ Duplicates / re-wraps T-062-02's already-tested `compile.ts`. The compile step is
  already a clean, smoke-covered unit — re-implementing it loses that coverage and couples
  two tickets' concerns.
- ➖ `gh release create` needs a token + network → can't live in a script the gate runs.

**Decision: Option B.** It is the only option that puts the AC's verifiable substance
under `bun run check`, and it is the established pattern. The `gh release create` call —
the one genuinely un-gateable step — stays in YAML where it belongs (it needs the runner's
`GITHUB_TOKEN`), and is kept to a single faithful line mirroring lisa.

## Division of labor (the pure/impure cut)

**`release-core.ts` (pure — no I/O, no process, no BAML):**
- Constants: `SHA256SUMS = "sha256sums.txt"`, and the pin **key names** it reads
  (`TARBALL_KEY = "RELEASE_TARBALL"`). It does NOT re-declare the tarball literal — that
  is the pin's job; the shell reads it via `requireKey`.
- `tagToVersion(ref: string): string` — strip a single leading `v` from a tag/ref
  (`"v0.1.0" → "0.1.0"`, `"0.1.0" → "0.1.0"`). Mirrors lisa's `${GITHUB_REF_NAME#v}`.
- `assertTagMatchesVersion(tag, version)` — throw a typed, message-bearing error naming
  both when `tagToVersion(tag) !== version`. The release invariant, lisa's guard, tested.
- `tarArgv({ tarball, cwd, member })` — the **single owner** of the tar flag spelling:
  `["tar", "-c", "-J", "-f", tarball, "-C", cwd, member]` (xz; `-C cwd member` puts the
  bare `vend` at the archive root, per Research). One owner → the workflow, the shell, and
  the smoke test never drift.
- `sha256Line(hash, filename): string` — format `` `${hash}  ${filename}` `` (TWO spaces:
  the exact `shasum -c` / coreutils format). The integrity contract, as a pure string.

**`package.ts` (impure shell — I/O + process only, smoke-only like compile.ts):**
1. Resolve git root (the `compile.ts` idiom); non-repo → exit 2.
2. Read + parse the pin; missing file/`RELEASE_TARBALL` key → exit 2.
3. Optional tag check: if a tag is supplied (argv `--tag` or `GITHUB_REF_NAME` env),
   `assertTagMatchesVersion(tag, VERSION)`; mismatch → exit 1 (a release-correctness
   failure, not a precondition). Absent tag → skip (local packaging is allowed).
4. Require the compiled binary at `<dist>/vend` (`DEFAULT_OUTFILE` from compile-core);
   absent → exit 2 with "run `bun run compile` first".
5. `tar` the binary → `<dist>/<RELEASE_TARBALL>` via `tarArgv`; tar failure → exit 1.
6. Compute sha256 over the tarball bytes (`Bun.CryptoHasher("sha256")` — in-process, no
   shell dependency), write `<dist>/<SHA256SUMS>` as `sha256Line(hash, RELEASE_TARBALL)`.
7. Print the asset + digest; exit 0.

`<dist>` defaults to `<root>/dist` but is overridable by an **optional positional argv**
(`package.ts [distDir]`) — a clean test seam so the smoke test runs the real shell against
a fixture dir with a fake `vend`, no 90 s compile required.

## The workflow (`.github/workflows/release.yml`)

Single job, mirroring lisa's trigger/permissions but collapsed to one platform:
- `on: push: tags: ["v*"]` — clause 1 of the AC.
- `permissions: contents: write`.
- `runs-on: macos-14` — but **read from the pin**, not blind: load the pin into
  `$GITHUB_ENV` (the established `cat … >> "$GITHUB_ENV"` idiom) so the job is
  pin-referencing. (`runs-on` can't interpolate `$GITHUB_ENV`, so the literal `macos-14`
  is asserted-equal to `CI_RUNNER` in a guard step — the same self-check discipline as
  `release-target-check.yml`.)
- Steps: checkout → `cat .github/release-target.env >> "$GITHUB_ENV"` → assert
  `runner == CI_RUNNER` → `oven-sh/setup-bun@v2` with `bun-version: ${{ env.BUN_VERSION }}`
  → `bun install` → `bun run compile` → `bun run src/release/package.ts` (tag via
  `GITHUB_REF_NAME`) → `gh release create "$GITHUB_REF_NAME" --title "$GITHUB_REF_NAME"
  --generate-notes "dist/$RELEASE_TARBALL" "dist/sha256sums.txt"`.

The one `gh release create` line is the only un-gateable step; everything upstream of it
is either a tested script or a self-checking guard.

## How each AC clause is discharged

| Clause | Discharged by |
|--------|---------------|
| tag trigger | `on: push: tags: ["v*"]` (structural) |
| arm64-mac tarball asset | `tarArgv` over `dist/vend` → `RELEASE_TARBALL` (pin), uploaded by `gh release create`; **live-pin drift guard** test keeps the name correct |
| sha256 re-verifies | `sha256Line` format + `package.smoke.test.ts` round-trip: package a fixture, then `shasum -a 256 -c sha256sums.txt` **passes** (and a tampered tarball **fails**) |
| tag ↔ version | `assertTagMatchesVersion`, unit-tested + invoked in the shell |

## Rejected specifics

- **`sha256sum` in the workflow** — absent on macOS runners; would fail. Use `shasum -a
  256` semantics, and compute in-process via `Bun.CryptoHasher` so the gate test needs no
  external tool to *produce* the sum (it still uses `shasum -c` to prove re-verification,
  which is the consumer's real tool).
- **`.tar.gz`** — the pin says `.tar.xz`; honor the SSOT. `tarArgv` uses `-J`.
- **Matrix / `upload-artifact` + `download-artifact`** — single platform; unnecessary
  ceremony. One job compiles and releases.
- **Folding compile into package.ts** (Option C) — keep T-062-02's tested compile intact;
  the workflow chains the two scripts.
