# Progress — T-074-01-01

## Status

Implementation, verification, and the required Lisa source commit are complete. No acceptance
criterion is knowingly unmet.

## Baseline

Command:

```bash
bun test src/executor/claude.test.ts src/executor/openai-compat.test.ts src/executor/select.test.ts
```

Result: 75 pass, 0 fail, 152 assertions. This established the pre-ticket executor baseline,
including all existing `claude.test.ts` dispense/helper behavior.

## Test-first red

Probe tests were added before the new exports existed. The focused run failed at module loading:

- `CLAUDE_PROBE_HINT` missing from `claude.ts`;
- `OPENAI_COMPAT_PROBE_HINT` missing from `openai-compat.ts`.

Result: 0 pass, 2 fail, 2 module errors. This was the expected contract-red state.

## Step 1 — shared boundary

Completed in `src/executor/executor.ts`:

- added exported `ExecutorProbeResult` with `ok`, optional `reason`, optional `hint`;
- added required async `Executor.probe()`;
- documented that the method is shallow, unmetered, and returns environmental failure data.

No runtime dependency was introduced into the seam module.

## Step 2 — Claude probe

Completed in `src/executor/claude.ts`:

- added injectable `ClaudeProbeFacts` / reader contract;
- added pure `classifyClaudeProbe`;
- added the actionable login + sandbox Keychain hint;
- added `readClaudeProbeFacts`, which runs only `claude auth status --json`;
- parsed only `loggedIn`, never returning account fields;
- treated valid logged-out JSON as a readable config store even if the CLI exits non-zero;
- added `ClaudeExecutor.probe()` with an injected reader default and never-throw degradation.

The existing free `dispense` function and the class's dispense delegate were not changed.

## Step 3 — OpenAI-compatible probe

Completed in `src/executor/openai-compat.ts`:

- added injectable endpoint/auth fact types and reader contract;
- added pure `/models` request construction reusing existing base URL/key variables;
- added pure success/HTTP/network classifiers;
- added `readOpenAICompatProbeFacts` using authenticated `GET /models` with no body;
- ignored response bodies so errors cannot accidentally surface provider content/secrets;
- added `OpenAICompatExecutor.probe()` with never-throw degradation.

The streaming `/chat/completions` dispense function and delegate were not changed.

## Step 4 — primary tests

Completed in the existing executor test files:

- Claude readable/logged-in success;
- Claude config-store/Keychain-denied failure via injected facts;
- Claude readable-but-logged-out failure;
- Claude class reader injection with no spawn/dispense;
- OpenAI `/models` URL and optional bearer construction;
- OpenAI reachable success and HTTP-auth rejection;
- OpenAI class reader injection with no fetch/dispense.

Focused post-implementation result for the two implementation suites: 68 pass, 0 fail, 141
assertions.

## Step 5 — structural fixtures

The required interface method produced 11 expected type errors across existing fake executor
objects. Added deterministic `{ ok: true }` probe methods to fixture executors in:

- `src/cross-review/resolve-complement.test.ts`
- `src/cross-review/review.test.ts`
- `src/engine/cast.test.ts`
- `src/engine/cross-review-refusal.e2e.test.ts`
- `src/executor/select.test.ts`
- `src/kitchen/kitchen-degrade.test.ts`
- `src/play/bare-code-cast.test.ts`
- `src/play/story-gate-cast.test.ts`

These existing tests do not invoke the probes; their prior dispense behavior is unchanged.

## Verification

Typecheck:

```text
$ bun run build
$ tsc --noEmit
exit 0
```

Affected focused regression across 10 files:

```text
119 pass
0 fail
401 assertions
```

Full required gate:

```text
$ bun run check
BAML generation: pass
Typecheck: pass
1709 pass
1 skip (pre-existing dist-dependent acceptance integration)
0 fail
5273 assertions
```

## Scope audit

- No doctor production file changed.
- No cast production file changed.
- No budget, funding, shelf, or TIER_BUDGET file changed.
- No dependency, environment variable, or persisted format was added.
- No live Keychain-denial or endpoint probe was run by tests.
- The manual `claude auth status --json` discovery command was unmetered and made no dispense.
- Lisa-owned ticket/provenance changes and unrelated shared work directories were left untouched.

## Deviations from plan

- The exact structural fake list was confirmed by typecheck and contained eight files, matching the
  blueprint after duplicate fake sites within files were counted separately.
- Claude status parsing was hardened to accept valid `loggedIn: false` JSON regardless of exit code;
  this preserves the distinction between readable-but-logged-out and unreadable.
- No other design or scope deviation occurred.

## Commit

Created through `lisa commit-ticket` with the 13 exact source/test paths listed above and in the
scope audit:

```text
5f49a6086134a780b9c5b3bcd95af50137068765
feat(executor): add dispensability probe (T-074-01-01)
13 files changed, 273 insertions(+), 2 deletions(-)
```

`git show --name-only HEAD` confirmed only the 13 intended paths. All ticket-owned source/test
paths are clean. Remaining working-tree entries are Lisa-owned ticket/provenance/work publication
state and were not staged or committed by this ticket.
