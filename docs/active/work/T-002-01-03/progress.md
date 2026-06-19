# T-002-01-03 — Progress: verify-no-drift

## Status: complete

The `test` gate is **proven real and drift-free** on the machine. The gate agrees
with standalone `bun run check:test` (both green, identical tally), it **can fail**
(a deliberate break turned both red with identical tally), and `/ci` is confirmed
a separate program. The deliberate break was reverted; the working tree is clean.
**No production code changed** — this is a spike; the only durable artifacts are
the RDSPI docs.

## Environment snapshot (andon precondition — satisfied)

| Fact | Value |
|------|-------|
| `docker info` | **UP** |
| `dagger version` | **`v0.21.4`** (`registry.dagger.io/engine:v0.21.4`), darwin/arm64 — **matches the `ci/dagger.json` pin** |
| HEAD at start | `6a5a16d` (T-002-01-02 RDSPI artifacts) |
| Engine state | **warm** from this session (`connect` 0.2s, not the ~18.4s cold-start) |
| Bun (standalone & in-container) | `1.3.9 (cf6cdbbb)` — same build both sides |

The andon ("if Docker is down, surface it — do not fake") was clear: Docker up,
engine at the pin. Every result below was run for real.

## Steps executed (against plan.md)

| Step | Plan item | Result |
|------|-----------|--------|
| 1 | Standalone baseline (P1 green) | ✅ `bun run check:test` → **229 pass / 0 fail**, exit 0, suite ~144ms |
| 2 | Gate in-container (P1 green) | ✅ `dagger -m ci call test run` → exit **0**, total **12.6s** (cold) → **5.9s** (cached) |
| 3 | Introduce deliberate break (P2) | ✅ `zz-drift-can-fail.test.ts` created, untracked |
| 4 | Prove gate fails (P2) | ✅ standalone exit **1** (229/1); container exit **1** (229/1) — both red, identical tally |
| 5 | Revert + confirm clean (P2 close) | ✅ scratch `rm`'d; standalone back to **229/0**; tree clean of instrument |
| 6 | Separateness + timing (P3) | ✅ all boundary greps green; timing recorded below |
| 7 | Evidence + RDSPI close | ✅ this file + `review.md`; docs-only commit |

## P1 — Agreement (green tree)

- **Standalone:** `bun run check:test` → exit **0**, **229 pass / 0 fail**, 399
  `expect()` calls, 15 files, ~144ms suite.
- **In-container:** `dagger -m ci call test run` (run from the repo root) → exit
  **0**. The source argument resolved to
  `Host.directory(path: "/Volumes/ext1/swe/repos/vend", exclude: ["**/node_modules","baml_client",".git"])`
  — i.e. the **git repo root** (the app). The full container chain (`bun install
  --frozen-lockfile` → `bun run baml:gen` → `bun run check:test`) ran clean; the
  exec exited 0 so the gate passed.
- **Verdict-equality:** both legs **agree — green** on the current tree. (See the
  "stdout vs stderr" finding below for why the in-container *tally text* surfaces
  in Dagger's progress log rather than in the returned string; the **verdict**
  agreement is exact.)

## P2 — Can-fail (broken tree)

Introduced `zz-drift-can-fail.test.ts` (one test, `expect(true).toBe(false)`):

- **Standalone:** `bun run check:test` → exit **1**, **229 pass / 1 fail** —
  `(fail) DELIBERATE FAILURE — verify-no-drift can-fail proof`,
  `error: script "check:test" exited with code 1`.
- **In-container:** `dagger -m ci call test run` → exit **1**. Dagger's log shows
  the same `(fail) DELIBERATE FAILURE …`, `229 pass / 1 fail`,
  `error: script "check:test" exited with code 1`, `! exit code: 1`. The failing
  `withExec` made the gate throw — **the gate went red**.
- **Tally agreement on the broken tree, too:** both legs reported **229 pass / 1
  fail** (230 across 16 files). Not just "both fail" — they fail *identically*.
- **Revert:** `rm zz-drift-can-fail.test.ts`; standalone re-run → **229 pass / 0
  fail** (back to baseline). `git status` clean of the instrument.

A gate that cannot fail is not a gate (playbook step 2). This one fails on a real
break, in-container, with the same verdict as standalone. ✅

## P3 — Separateness + timing

**Separateness (all green):**
- `grep -RnE 'from "\.\.|/src/|@boundaryml' ci/src` → **empty** — `/ci` imports
  nothing from the app.
- `grep '@dagger.io/dagger' package.json ci/package.json` → **not a dependency**
  anywhere. `ci/package.json` deps = `{ typescript: 5.9.3 }` only (the module's
  own toolchain). The SDK resolves via `ci/tsconfig.json` `paths` → `./sdk/…`.
- `git check-ignore ci/sdk` → `ci/sdk` (codegen, gitignored).

**Timing (recorded, not engineered):**
- Engine `connect`: **0.2s** — engine was **warm** from this session. The
  measured **~18.4s cold-start** (`ci-strategy.md`) did **not** bite this run; it
  would on a genuinely cold engine.
- First green container run (load workspace + module build + container chain):
  **12.6s** total wall-time (`test` sub-object 1.5s, `run` exec 7.3s).
- Second container run (broken tree, BuildKit layers cached — only the changed
  test re-ran): **5.9s**. The cache delta (12.6s → 5.9s) is exactly the
  fast-increment behavior `ci-strategy.md` relies on.
- **Keep-warm stays out of this slice** (ticket AC4). These numbers *motivate* it:
  a ~12s first hit + ~18s cold-start, paid per increment across a fast-committing
  fleet, is the cost keep-warm later amortizes. Not built here — recorded here.

## Findings (worth carrying forward)

1. **Module path:** `dagger call test run` from the repo root errors
   (`unknown command "test"`) — the module lives in `ci/`, so the leaf is
   **`dagger -m ci call test run`** (or run from inside `ci/`). Correction to the
   T-002-01-02 handoff's `dagger call test run` shorthand; the **chained `run`**
   part of that handoff was right.
2. **`defaultPath: "/"` resolves to the git repo root** (the app) — the
   T-002-01-02 surfaced assumption is **CONFIRMED**. No `--source=.` fallback was
   needed; the mount excluded `node_modules`/`baml_client`/`.git` as declared.
3. **In-container prep worked first try:** `bun install --frozen-lockfile` against
   the committed `bun.lock` and the linux `baml` native binary generating
   `baml_client/` inside `oven/bun:1.3.9-slim` both succeeded — no extra libs, no
   prep tuning needed. (The other two T-002-01-02 surfaced assumptions, confirmed.)
4. **`bun test` writes its pass/fail summary to stderr, not stdout.** The gate's
   `.stdout()` therefore returns only the `bun test v1.3.9 …` banner; the tally
   appears in Dagger's progress (stderr) log. This is **not drift** — the *check
   string* and the *verdict* (exit code, which enforces the gate) are identical
   both sides. If richer machine-readable gate reporting is wanted later, capture
   stderr too — but that is a reporting nicety, out of this slice, and must not
   change the `check:test` definition.

## Deviations from plan

- **Step 2 invocation:** used `dagger -m ci call test run` instead of bare
  `dagger call test run` — the module is in `ci/`, not the repo root (Finding 1).
  The bare form was tried first (per Plan D1) and surfaced the path issue; this is
  the recorded deviation, not a silent fix.
- **No `--source=.` needed** — the default resolved correctly (Finding 2). Plan's
  fallback branch was not taken.
- **No `dagger develop`, no engine bump.** The tool again advertised v0.21.7;
  **declined** — staying pinned at v0.21.4 is intentional (andon honored).

## What was NOT done (anti-over-build)

No second gate; no `lint`/`typecheck`/`consistency`; no keep-warm; no change to
`check:test`, to `ci/src/*`, or to any `ci/` config; no `dagger develop`. The
scratch test was created to fail and deleted. Out of slice, by design.

## Commit

RDSPI artifacts only (`docs/active/work/T-002-01-03/`). No production code
changed; the scratch instrument was removed before commit. Ticket frontmatter left
untouched for Lisa.
