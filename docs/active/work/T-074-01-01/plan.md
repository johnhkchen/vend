# Plan — T-074-01-01

## Verification strategy

Use test-first focused coverage for the probe contract, then typecheck to discover every structural
fixture affected by the required method. No test is permitted to access the real Keychain, spawn
Claude auth, call a live endpoint, or dispense. Finish with `bun run check`, the repository gate.

## Step 1 — baseline

- Run focused existing executor tests.
- Record whether `claude.test.ts`, `openai-compat.test.ts`, and `select.test.ts` start green.
- Preserve the existing dirty Lisa-owned paths.

Verification:

```bash
bun test src/executor/claude.test.ts src/executor/openai-compat.test.ts src/executor/select.test.ts
```

## Step 2 — write failing contract tests

- Add Claude pure-fact tests for success, denied config store, and logged-out state.
- Add Claude class injection test.
- Add OpenAI request/fact tests for success and reachability/auth failure.
- Add OpenAI class injection test.
- Avoid assertions tied to live machine state.

Expected red state: missing exports/methods.

## Step 3 — expand the shared seam

- Add `ExecutorProbeResult` to `executor.ts`.
- Add required `probe()` to `Executor`.
- Document no-spend and returned-data semantics.

Verification: typecheck should now report unimplemented production classes and test doubles; these
errors are expected until later steps.

## Step 4 — implement Claude probe

- Add typed fact model and pure classifier.
- Implement auth-status JSON effect reader.
- Ensure command arguments contain `auth status --json`, never `-p`.
- Avoid surfacing stdout that could contain account details.
- Add injected reader/default constructor and safe `probe()` method.
- Leave `dispense()` unchanged.

Verification:

```bash
bun test src/executor/claude.test.ts
```

## Step 5 — implement openai-compatible probe

- Build `/models` URL and headers from existing config constants.
- Implement an injectable GET reader.
- Do not read or return a response body.
- Purely classify reachable, HTTP failure, and connection failure facts.
- Add injected reader/default constructor and safe `probe()` method.
- Leave streaming dispense unchanged.

Verification:

```bash
bun test src/executor/openai-compat.test.ts
```

## Step 6 — repair structural fixtures

- Run `bun run build`.
- For each typed fake executor reported, add a deterministic successful `probe()`.
- Do not alter fixture dispense results or test intent.
- Re-run typecheck until green.

## Step 7 — focused regression

Run all executor tests together:

```bash
bun test src/executor/claude.test.ts src/executor/openai-compat.test.ts src/executor/select.test.ts
```

Confirm:

- Claude success and denied config-store branches pass via injected facts.
- OpenAI success and failure branches pass via injected facts.
- No live spawn/fetch occurred.
- Existing Claude dispense helper tests remain green.
- Selector defaults and alternate selection remain green.

## Step 8 — full repository gate

```bash
bun run check
```

If red, fix only failures caused by this ticket and rerun focused checks before the full gate. Do
not commit while red. Record exact counts/results in `progress.md`.

## Step 9 — inspect scope

- Review `git diff --` for each ticket-owned path.
- Confirm no edits in doctor, cast production, budget, funding, or ticket frontmatter.
- Confirm dispense function bodies are unchanged.
- Confirm no ticket-owned file is staged.

## Step 10 — commit through Lisa

Use one meaningful source unit because the required boundary expansion, both implementations, and
their structural fixture updates cannot typecheck independently:

```bash
lisa commit-ticket \
  --ticket-id T-074-01-01 \
  --message "feat(executor): add dispensability probe (T-074-01-01)" \
  --include <each exact modified source/test path>
```

Never use ordinary `git add` or `git commit`. After commit:

- inspect `git show --stat --oneline HEAD`;
- confirm the exact include set;
- confirm all ticket-owned paths are clean;
- leave Lisa-owned provenance/ticket modifications alone.

## Step 11 — implementation artifact and review

Write `progress.md` with baseline, red/green evidence, file list, deviations, gate result, and commit
hash. Then write `review.md` with acceptance mapping, test coverage, honest boundary, open concerns,
and clean handoff. Stop on this ticket after review; Lisa owns publication and completion.

## Andons

- If the available Claude CLI lacks `auth status --json`, stop rather than guessing private stores.
- If `/models` would require a completion on a supported target, keep the shallow endpoint check and
  report the compatibility limitation honestly.
- If full tests reveal a current consumer invoking `probe`, inspect it; this ticket must not change
  cast behavior.
- If Lisa rejects an include due to lease/ownership, do not use ordinary Git as a fallback.
