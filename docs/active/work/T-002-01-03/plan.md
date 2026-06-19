# T-002-01-03 — Plan: verify-no-drift

*Ordered, independently-verifiable steps. This is a spike: the "implementation" is
running the experiment and recording evidence. Each step states its command and
its pass condition. Stop-the-line (andon) notes inline.*

## Testing strategy

There are **no unit tests to write** — by design. The thing under test is a
trigger-and-report gate whose only logic lives in the app's `check:test`. The
spike's "tests" are the three proofs P1/P2/P3 from Design, run on the machine. The
one ephemeral test file (the deliberate break) is created to *fail*, then deleted;
it is the instrument, not a deliverable. Verification criteria = the exit
conditions in Design.

## Andon precondition (already satisfied this session)

Docker up + `dagger v0.21.4` == pin, confirmed in Research. If at any step Docker
goes down or `dagger` errors on engine provisioning, **stop and surface it** — do
not fake or simulate a result (ticket Context: "do not fake the verification").

---

## Step 1 — Establish the standalone baseline (P1, green tree)

- Run: `bun run check` (which does `baml:gen && check:typecheck && check:test`) to
  mirror what the container does, then capture `bun run check:test` alone with
  timing.
- Record: exit code (expect 0), pass/fail tally (expect 229 pass / 0 fail per the
  T-002-01-02 baseline — note if it has moved), wall-time.
- **Pass condition:** exit 0, suite green. This is the "standalone" leg of the
  three-way agreement.

## Step 2 — Run the gate in-container (P1, green tree)

- Run bare first: `dagger call test run` from the **repo root** (Design D1, option
  c). Time the whole call; note the cold-start `connect` if visible.
- If it errors on mounting the wrong root / can't find the app: re-run with
  `dagger call test run --source=.` and **record the deviation** (confirms the
  `defaultPath: "/"` assumption was wrong — a finding for the next gate).
- Record: exact invocation used, exit code (expect 0), the pass tally visible in
  stdout, total wall-time, cold-start time.
- **Pass condition:** exit 0; the in-container suite tally **matches** the
  standalone tally (verdict-equality, Design D2). This is the "CI" leg.
- **Andon (prep, not check):** if `baml:gen` fails in-container for missing native
  libs, that is **prep** tuning — record it, do **not** edit `check:test`. Prefer
  surfacing; only adjust container prep if it is unambiguous and the check string
  stays byte-identical.

## Step 3 — Introduce the deliberate break (P2)

- Create `zz-drift-can-fail.test.ts` at the repo root (exact content in
  `structure.md`): one test asserting `expect(true).toBe(false)`.
- **Pass condition:** file exists and `git status` shows it as untracked.

## Step 4 — Prove the gate fails on the break (P2)

- Standalone: `bun run check:test` → **expect non-zero**, 1 failing test. Record.
- Container: `dagger call test run` (same invocation as Step 2) → **expect
  non-zero** (the failing exec makes the gate throw). Record exit code.
- **Pass condition:** **both** red. A gate that cannot fail is not a gate
  (playbook step 2). The container going red on the same break is the core P2
  evidence — it proves the gate, not just standalone Bun, detects the failure.

## Step 5 — Revert the break and confirm clean (P2 close)

- `rm zz-drift-can-fail.test.ts`.
- Re-run `bun run check:test` → **expect green again** (back to baseline tally).
- `git status --short` → must show **no** scratch file and no `ci/`/app-source
  change (only the RDSPI docs + Lisa's ticket `.md` edits).
- **Pass condition:** tree clean of the instrument; suite back to green. This is an
  exit condition — do not proceed to writeup with the break still present.

## Step 6 — Confirm separateness + collect timing (P3)

- `grep -RnE 'from "\.\.|/src/|@boundaryml' ci/src` → **expect empty** (imports
  nothing from the app).
- `grep -RnH '@dagger.io/dagger' package.json ci/package.json` → **expect** it is
  **not** a dependency anywhere (resolves via `ci/tsconfig` `paths` → `sdk/`).
- `git check-ignore ci/sdk` → **expect** `ci/sdk` (codegen, gitignored).
- Assemble the cold-start + run-time numbers from Steps 2 and 4 into one short
  note; state explicitly that **keep-warm is out of this slice** and why the
  number motivates it later.
- **Pass condition:** all three boundary checks green; timing recorded.

## Step 7 — Write evidence + RDSPI close, then commit docs only

- Write `progress.md` (the full evidence table — env, P1, P2, P3, deviations) as
  the steps run; finalize it here.
- Write `review.md` (handoff: what was proven, coverage, open concerns).
- Commit **docs only** (RDSPI artifacts under `docs/active/work/T-002-01-03/`).
  **Do not** commit the scratch test (already deleted), any `ci/` change, or touch
  the ticket frontmatter (Lisa owns phase/status).
- **Pass condition:** `git status` clean except the intended doc additions;
  ticket `.md` files left for Lisa.

## Rollback / safety

The only mutation is the scratch test, removed in Step 5. There is no schema
change, no migration, no engine bump (`dagger develop` is **not** run — andon). If
the spike is interrupted after Step 3, the recovery action is a single `rm
zz-drift-can-fail.test.ts`; `git status` will name it. No durable state is at risk.

## What this plan will NOT do

Add a second gate; run `dagger develop`; implement keep-warm; edit the
`check:test` definition; change `ci/src/*`; commit anything under `ci/`. All out
of slice (`ci-strategy.md` "First slice"; ticket AC4).
