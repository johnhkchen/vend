# T-008-01 — Plan: `check:committed`

*Ordered, independently-verifiable steps. Testing strategy and verification
criteria per step. Grounded in `structure.md`. Each step is small enough to
commit atomically.*

---

## Testing strategy (overall)

- **Pure core → unit tests** (`committed-core.test.ts`, `bun:test`). The classifier
  is a total function over strings; every AC fixture and every edge (rename,
  quote, ignored-absent, blank lines, staged-uncommitted) is a fixture asserting
  an exact sorted array. This is where correctness is *proven* — no git needed,
  deterministic, addon-free.
- **Impure entry → smoke** (`bun run check:committed` against the real tree). Not
  unit-tested (house pattern: the `import.meta.main` shell is smoke-only). The
  smoke *is* the verify-the-verifier step: run it dirty (expect non-zero), then
  clean (expect 0).
- **Regression gate**: `bun run check:test` and `bun run check:typecheck` stay
  green throughout (AC#3).

Verification criteria, mapped to ACs:
- **AC#1** (script exits non-zero iff uncommitted/untracked under the three
  prefixes; 0 otherwise; gitignored never fails) → Steps 4 + 5 (smoke dirty/clean)
  and Step 2 (ignored-absent fixture).
- **AC#2** (a pure helper classifies porcelain → offending paths; unit-tested:
  dirty→list, clean→empty, untracked `src/*.ts`→flagged) → Steps 1 + 2.
- **AC#3** (`check:test`/`check:typecheck` green; runs standalone) → Steps 2, 4, 5.

---

## Step 1 — Pure core: `src/ci/committed-core.ts`

Create the folder + the pure module per structure.md.

- `SOURCE_PREFIXES = ["src/", "baml_src/", "ci/"] as const`.
- `parsePorcelainLine(line): string | null` — slice(3); rename `->` → dest; strip
  wrapping quotes; null for blank/short lines.
- `classifyPorcelain(text): string[]` — split lines → parse → drop nulls → keep
  prefix matches → dedup (Set) → sorted array.

**Verify**: `bun run check:typecheck` clean (no test yet). No behavior change to
existing code.
**Commit boundary**: combined with Step 2 (tested-core commit).

---

## Step 2 — Unit tests: `src/ci/committed-core.test.ts`

Pin the contract with fixtures. Minimum cases:

1. **AC fixture — dirty source → fail-list**: porcelain with ` M src/cli.ts` and
   `M  baml_src/note.baml` → `["baml_src/note.baml", "src/cli.ts"]` (sorted).
2. **AC fixture — clean → empty**: `""` and a whitespace-only string → `[]`.
3. **AC fixture — untracked `src/*.ts` → flagged**: `?? src/ci/new.ts` →
   `["src/ci/new.ts"]`.
4. **Out-of-scope ignored/runtime absent**: input with only ` M docs/x.md` and
   ` M package.json` → `[]` (root + docs are not source). Documents AC#1's
   "gitignored never fails" at the classifier level — and the scope edge (D7).
5. **`ci/` prefix**: ` M ci/src/index.ts` → `["ci/src/index.ts"]`.
6. **Rename → destination**: `R  src/a.ts -> src/b.ts` → `["src/b.ts"]`.
7. **Quoted path**: `?? "src/wéird.ts"` → `["src/wéird.ts"]` (quotes stripped).
8. **Staged-but-uncommitted counts**: `A  src/ci/check-committed.ts` → flagged
   (A5: index ≠ HEAD).
9. **Dedup/sort**: same path twice and an out-of-order pair → deduped, sorted.
10. **`parsePorcelainLine` unit cases**: blank → null; ` M src/x.ts` →
    `"src/x.ts"`; rename → dest; quoted → unquoted.

**Verify**: `bun run check:test` green (existing suite + these new tests);
`bun run check:typecheck` clean.
**Commit**: `feat(ci): pure check:committed classifier + tests` — Steps 1+2.

---

## Step 3 — Impure entry: `src/ci/check-committed.ts`

The thin `import.meta.main` shell per structure.md:
- resolve repo root via `git rev-parse --show-toplevel` (exit 2 on failure);
- `Bun.spawnSync(["git","status","--porcelain"], { cwd: root })` (exit 2 on git
  error);
- `classifyPorcelain(stdout.toString())`;
- offenders → stderr andon header + one path per line → `exit(1)`;
- clean → `exit(0)`.

**Verify**: `bun run check:typecheck` clean. (No unit test — smoke in Step 5.)
**Commit boundary**: combined with Step 4 (wired-entry commit).

---

## Step 4 — Wire `package.json`

Add `"check:committed": "bun run src/ci/check-committed.ts"`. Do **not** add to
the aggregate `check` (D6).

**Verify**: `bun run check:committed` resolves and executes (does not error on
"missing script"). At this moment the tree is dirty (new uncommitted files) → the
gate should exit **non-zero** and list the new `src/ci/*` paths. This is the first
half of verify-the-verifier.

---

## Step 5 — Verify the verifier (smoke, the keystone)

This is the andon-fires proof the epic exists for.

1. With the new files uncommitted, `bun run check:committed; echo $?` → **non-zero
   (1)**, stderr lists `src/ci/check-committed.ts`, `src/ci/committed-core.ts`,
   `src/ci/committed-core.test.ts`.
2. Commit Steps 3+4 (`feat(ci): wire check:committed script + entry`). Tree now
   clean of source.
3. `bun run check:committed; echo $?` → **0** (clean), no offenders.
4. Optional negative: `touch src/ci/_scratch.ts` → gate exits 1 and flags it;
   remove it.
5. Confirm gitignored runtime never trips: `bun run baml:gen` (regenerates
   `baml_client/`), then `bun run check:committed` → still **0** (baml_client is
   gitignored, never in porcelain). This directly exercises AC#1's runtime clause.

**Verify**: all of 1–5 behave as stated. Record exit codes in `progress.md`.

---

## Step 6 — Final gate sweep

- `bun run check:typecheck` → clean.
- `bun run check:test` → green (full suite, including new core tests).
- `bun run check:committed` → 0 (working tree's source committed) — the gate
  passes on itself, the truest end-state.
- Working tree clean (no residual uncommitted source) — the D-005 failure mode
  this whole epic targets must not be present at the end of this very ticket.

Write `review.md`.

---

## Commit map (atomic boundaries)

| Commit | Steps | Contents |
|---|---|---|
| 1 | 1 + 2 | pure core + unit tests (tested contract) |
| 2 | 3 + 4 | impure entry + `package.json` script (wired gate) |

Two commits keep the tested-contract change separate from the wiring change, and
each leaves the tree green. (The smoke in Step 5 happens *between/around* commit 2
to prove dirty→1 then clean→0.) Per E-008's own thesis, this ticket ends with
**HEAD consistent and the working tree clean** — verified by running
`check:committed` on itself.

---

## Risks & mitigations

- **R-a: porcelain quoting/rename edge not covered** → fixtures 6+7 pin the common
  cases; full C-unescape is documented as out-of-scope (research §6, design D5).
- **R-b: git absent in some run context** → exit 2 (distinct from dirty=1) +
  stderr; the lisa hook (T-008-02) decides block-vs-warn on that signal.
- **R-c: scope gap (root config files)** → deliberate per D7; flagged in review,
  one-line widen of `SOURCE_PREFIXES` if the contract grows.
- **R-d: gate self-trips on `package.json` edit** → cannot, `package.json` is not
  under a source prefix; verified by fixture 4.
