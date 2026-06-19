# T-008-02 — Plan: wire-the-lisa-stop-hook

*Ordered, independently verifiable steps + the testing strategy. Each step small
enough to reason about; the whole thing commits atomically (one behavioral file).*

---

## Testing strategy (what gets tested, and why so little is new)

- **No new unit tests.** The *logic* (what counts as uncommitted source) is the
  pure classifier, already covered by 16 tests in T-008-01
  (`committed-core.test.ts`). The hook is a shell **trigger** — like
  `check-committed.ts`'s `import.meta.main` shell and `cli.ts`, triggers are
  smoke-verified, not unit-tested. Adding a bats/shell harness for one ~25-line
  hook would be the over-building reflex (ci-strategy rule 6).
- **Manual smoke = the dirty-tree demo.** This is the AC#3 deliverable: prove the
  andon fires on dirty source and stays silent on a clean tree, by driving
  `check:committed` (the thing the hook invokes) and the hook's translation
  directly.
- **Regression gate.** `bun run check:test` + `check:typecheck` must stay green
  (they don't touch the hook, but confirm nothing collateral broke). Plus
  `bun run check:committed` on the final tree must exit 0 — dogfooding: this
  ticket's own work must be committed.
- **Deferred (flagged, not faked).** The live "hook actually fires at session
  stop and blocks Claude" path is next-loop; it cannot run in this session.

---

## Step sequence

### Step 1 — Capture the clean-tree baseline
Run `bun run check:committed` (expect exit 0, "ok") and `git status --porcelain`
(expect only ticket + work-dir files, no source). Records the starting point and
confirms the script we're about to wire behaves as documented.
**Verify:** exit 0; no `src/`/`baml_src/`/`ci/` paths dirty.

### Step 2 — Rewrite `.lisa/hooks/on-stop.sh`
Apply the Structure blueprint: signal-write block unchanged and first; then the
tty-guarded stdin read, fail-open toolchain guards, gate invocation capturing
stderr, and the exit-code translation `case`. Preserve the shebang and the file's
executable bit.
**Verify:** `shellcheck`-clean if available (else manual read); `ls -l` shows the
mode still `-rwxr-xr-x`; the signal-write lines are byte-identical to the original.

### Step 3 — Smoke: clean tree → allow
Run the hook with empty stdin in a clean state and confirm it exits 0 and writes
no andon. (Run as `echo '{}' | .lisa/hooks/on-stop.sh` so stdin is a pipe, then
`echo exit=$?`.) Also confirm a `.stopped` signal would be written when
`LISA_PANE_ID` is set (set a dummy pane id, check the file appears, remove it).
**Verify:** hook exit 0; no "refusing to stop" text; signal file created for the
dummy pane id, then cleaned.

### Step 4 — Smoke: dirty source → andon (the AC#3 demo)
Create a throwaway untracked source file (e.g. `src/ci/_demo_dirty.ts`). Then:
- `bun run check:committed` → expect exit 1 and the offending path on stderr.
- `echo '{}' | .lisa/hooks/on-stop.sh; echo exit=$?` → expect the
  "done-means-committed gate … refusing to stop" framing **plus** the offending
  path relayed, and **exit 2** (block).
- `printf '{"stop_hook_active":true}' | .lisa/hooks/on-stop.sh; echo exit=$?` →
  expect the same andon text but **exit 0** (guard prevents re-block).
Then delete `src/ci/_demo_dirty.ts`.
**Verify:** exit 1 from the script; exit 2 from the hook (fresh stop); exit 0 from
the hook (already-blocked guard); andon names the demo path; tree clean again
after deletion.

### Step 5 — Fail-open sanity
Confirm the env-error path is harmless: temporarily simulate by running the hook
from a non-repo dir is awkward, so instead reason+spot-check the `*)` branch and
the `command -v bun` / `git rev-parse` guards by reading the final script. (A full
no-git environment is not constructible here without risk; the branch is
straight-line `exit 0` — low risk, recorded as a Review gap, mirroring T-008-01's
exit-2 gap.)
**Verify:** every non-(0|1) path in the `case`/guards leads to `exit 0`.

### Step 6 — Regression + dogfood
`bun run check:test` (expect 282 pass / 0 fail), `bun run check:typecheck`
(expect clean). Ensure the demo file from Step 4 is gone and
`bun run check:committed` exits 0 on the working tree (only ticket/work-doc files
dirty, which are out of `SOURCE_PREFIXES`).
**Verify:** tests green; typecheck clean; `check:committed` exit 0.

### Step 7 — Commit atomically
Stage `.lisa/hooks/on-stop.sh` + the `docs/active/work/T-008-02/` artifacts (and
the touched ticket files if appropriate) and commit with a message tying to
E-008/D-005. The commit must leave the tree clean so the very gate this ticket
ships would pass on its own work.
**Verify:** `git status --porcelain` shows no source paths post-commit;
`bun run check:committed` exit 0.

### Step 8 — Write progress.md, then review.md
Record actuals, deviations, and the deferred live-trigger verification in
`progress.md`; then the Review handoff.

---

## Atomicity / commit boundary

One behavioral file changes (`on-stop.sh`); it is self-contained and commits in a
single atomic commit alongside its RDSPI docs. No multi-step migration, no
sequencing hazard with other tickets (T-008-01 is `done`; nothing else touches
`.lisa/hooks/`).

---

## AC ↔ step map

| AC | Satisfied by |
|---|---|
| AC#1 hook runs `check:committed`, andon names paths | Steps 2, 4 |
| AC#2 block-vs-warn determined, recorded, follow-up flagged | Design D1 + Steps 4 (block + guard) |
| AC#3 dirty-tree demo fires; minimal/robust; effect-next-loop noted; `check:*` green | Steps 3–6, Review |

---

## Rollback

Single-file change. If the hook ever misbehaves in a live loop, revert
`on-stop.sh` to the signal-only original (one `git revert`/restore), or downgrade
to warn-only by changing the one `exit 2` to `exit 0` (Design D1 fallback). The
lisa signal write — the only thing other systems depend on — is untouched by
either move.
