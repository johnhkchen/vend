# T-062-01 — Plan

Ordered, independently-verifiable steps. This is a spike: the "tests" are assertions about
the pin's correctness and the workflow's well-formedness, run locally — there is no app code
to unit-test. Each step is small enough to commit atomically; the whole thing is one logical
commit.

## Step 1 — write the SSOT pin

Create `.github/release-target.env` with the six pinned keys (Structure §1).

- **Verify:** `source .github/release-target.env` in a subshell; echo each key; confirm
  `$BUN_COMPILE_TARGET=bun-darwin-arm64` and
  `$RELEASE_TARBALL = $RELEASE_TARBALL_PREFIX-$RELEASE_ASSET_TRIPLE.tar.xz`.

## Step 2 — prove the pinned target is real on this machine

Re-confirm (already probed in Research, re-assert as the plan's gate):

- **Verify A (arch match):** `uname -m` → `arm64` → maps to `bun-darwin-arm64` ==
  `$BUN_COMPILE_TARGET`. This is the AC's "matches the actual machine arch".
- **Verify B (bun accepts it):** `bun build --compile --target=$BUN_COMPILE_TARGET` on a
  trivial entry exits 0 and emits an executable. (No need to compile the real CLI — that is
  T-062-02; here we only prove the *target string* is valid.)

## Step 3 — record the decision in the work dir

Create `docs/active/work/T-062-01/target.md` (Structure §3): measured facts, pinned values,
provenance, pointer to the env file. This discharges the AC clause "recorded in the epic
work dir".

- **Verify:** values in `target.md` are byte-identical to the keys in
  `.github/release-target.env` (no drift between the human record and the machine SSOT).

## Step 4 — write the CI guard that references the pin

Create `.github/workflows/release-target-check.yml` (Structure §2): load the env file into
`$GITHUB_ENV`, assert runner arch == pinned target, assert tarball-name consistency.

- **Verify (static):** the file is valid YAML; the `source`/`cat … >> $GITHUB_ENV` step
  literally references `.github/release-target.env` (discharges "referenced by the CI
  config"); the assertion logic mirrors Step 2's local checks.
- **Verify (logic dry-run):** run the same arch-mapping shell snippet locally (the dev box
  is arm64-darwin, equivalent to the `macos-14` runner) and confirm it passes; hand-mutate
  the expected value in a scratch copy to confirm it *fails* on mismatch (the guard has
  teeth).

## Step 5 — gate

Run the repo gate to confirm nothing regressed (these are config/docs-only changes, so the
gate should be untouched, but verify honestly):

- **Verify:** `bun run check` (baml gen → typecheck → tests) stays green. No source changed,
  so this is a regression guard, not a feature test.

## Step 6 — commit

One atomic commit: the pin, the guard, the record, and the RDSPI artifacts.

## Testing strategy

| What | How | Why this and not more |
|------|-----|-----------------------|
| Pin internal consistency | local `source` + string-equality assertions | the pin is the contract; a typo here propagates to every downstream ticket |
| Target validity | `bun build --compile --target=…` exit 0 (Research, re-run) | proves the string isn't fictional |
| Arch match | `uname -m` mapping == pin, run locally | the AC's literal requirement; the dev box == the target |
| Workflow well-formed | YAML parse + the reference line present | "referenced by the CI config" must be a real reference, not prose |
| Guard has teeth | mutate-and-fail dry run | a check that can't fail is theater |
| No regression | `bun run check` | honest confirmation the spike touched nothing it shouldn't |

**Explicitly NOT tested here (out of scope, downstream):** an actual GitHub Actions run
(needs a push/PR to the remote — the workflow is authored and locally dry-run, and I will
not claim a green CI run I haven't observed); the real ~108 MB BAML-bundled compile
(T-062-02); tarball/sha256/release (T-062-03). These limitations are stated plainly in
`review.md`.

## Rollback

All four/six files are new and isolated under `.github/` and the work dir. Reverting the
commit fully removes the change with no migration. The decision is also append-only-friendly:
adding targets later does not require editing this pin.
