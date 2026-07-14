# Plan — T-081-01-01

## Goal

Turn the two real-transcript censuses into sanitized, replayable evidence and a reviewer-facing
root-cause note, then verify the repository remains green.

## Step 1 — Extract authoritative turn facts

Read only:

- `.vend/transcripts/run-2026-07-13T14-39-35-941Z.jsonl`;
- `.vend/runs.jsonl` line 32.

Compute and pin:

- raw top-level message counts;
- assistant row count;
- unique nested assistant IDs;
- null versus non-null `parent_tool_use_id` groups;
- first-occurrence source line for every unique ID;
- all result source lines and `num_turns` values;
- final ledger `turnsUsed`.

Verification criteria:

- raw rows total 522;
- assistants total 156 rows / 45 unique IDs;
- main group is 12;
- sidechain groups are 4, 9, 11, 9;
- 12 + 4 + 9 + 11 + 9 = 45;
- result counters are 10, 1, 1, 1, 2;
- ledger `turnsUsed` is 2.

## Step 2 — Construct the sanitized turn fixture

Create `fixtures/turn-sidechain-excerpt.jsonl` with `apply_patch`.

For each unique assistant ID:

- retain one first-occurrence source line;
- replace real ID with deterministic ordinal;
- retain null/non-null parent class using sanitized labels;
- replace usage with `{}`;
- remove all content and provenance payloads.

Append the five sanitized result records.

Independent checks:

- every line parses with `jq`;
- 50 total fixture rows;
- 45 assistant rows;
- 45 unique IDs;
- 12 null-parent / 33 sidechain;
- result list remains `[10,1,1,1,2]`.

## Step 3 — Extract authoritative token facts

Read only:

- `.vend/transcripts/run-2026-07-13T17-07-45-166Z.jsonl`;
- `.vend/runs.jsonl` line 33.

Compute:

- assistant rows and unique IDs;
- first and final line per unique ID;
- first and final four-bucket usage per ID;
- first-event bucket totals;
- production per-message-rounded fold;
- system subtype counts;
- sum of `thinking_tokens.estimated_tokens_delta`;
- terminal four-bucket usage;
- canonical terminal weighted total;
- per-bucket residuals;
- post-thinking terminal output residual.

Verification criteria:

- 35 assistant rows / nine IDs;
- endpoint usage difference zero for all nine IDs;
- live fold 104,807;
- thinking delta 15,419 across 150 records;
- terminal weighted total 214,621;
- output-only difference 21,963 tokens / 109,815 weighted;
- final residual 6,544 output tokens / 32,720 weighted.

## Step 4 — Construct the sanitized token fixture

Create `fixtures/token-spend-excerpt.jsonl` with `apply_patch`.

For each ID:

- retain the first and final event when distinct;
- retain the singleton once;
- replace real ID with `turn-NN`;
- retain exact four-bucket usage;
- retain source line and endpoint label;
- remove content, model, session, request, signature, service, and cache-detail metadata.

Append:

- one sanitized aggregate thinking record;
- one sanitized terminal result.

Independent checks:

- every line parses with `jq`;
- 19 total rows: 17 assistant endpoints, one system aggregate, one result;
- nine unique assistant IDs;
- real production fold yields 104,807 and nine turns;
- terminal `countTokens` yields 214,621.

## Step 5 — Write fixture provenance manifest

Create `fixtures/README.md`.

Include:

- source run IDs and file paths;
- exact sanitization transformation;
- retained/removed fields;
- source-line audit convention;
- thinking aggregation disclosure;
- expected counts and arithmetic;
- scope warning: evidence, not fix policy;
- downstream ticket IDs.

Check that no real message/tool/session/request/UUID identifiers occur in either fixture.

## Step 6 — Replay through production functions

Use a temporary command-line Bun script without creating a repository file.

Imports:

- `accumulateCastProgress`;
- `EMPTY_CAST_PROGRESS`;
- `countTokens`.

Assertions:

- turn fixture current fold = 45;
- turn fixture filtered to null parent = 12;
- token fixture current fold = `{ turns: 9, weightedTokens: 104807 }`;
- token fixture terminal weighted total = 214621;
- endpoint equality holds;
- thinking aggregate and terminal residual match expected values.

Why not commit this as a test:

- the downstream implementation tickets own behavioral expectations;
- pinning current buggy behavior in production tests would need immediate deliberate replacement;
- the evidence fixtures plus recorded verification provide the spike contract without choosing a
  production remedy.

## Step 7 — Write the final root-cause note

Create `root-cause.md` only after fixture replay passes.

The note will:

- lead with the corrected turn-counter vocabulary;
- reconcile 45 exactly from main and sidechain IDs;
- show that sidechains inflate current `progress.turns` by 33;
- cite all five terminal result lines and the real ledger line;
- reproduce 104,807 and 214,621 bucket by bucket;
- quantify first-versus-last as zero rather than claiming it caused this run's gap;
- name skipped system thinking and terminal-only residual separately;
- map facts to each dependent ticket without prescribing code.

Acceptance check:

- every conclusion includes run ID and source line citation;
- both fixture filenames are linked;
- no conclusion relies only on the original field-report shorthand.

## Step 8 — Run quality gates

Focused artifact checks:

- `jq -e .` for every fixture line;
- replay assertions through real pure functions;
- search fixtures for known raw identifier prefixes (`msg_`, `toolu_`, session/request UUID keys);
- inspect attempt artifact tree.

Repository gate:

- run `bun run check`;
- record BAML generation, typecheck, test count, skips, and failures.

If `bun run check` fails because of unrelated concurrent work:

1. identify exact failing path/test;
2. confirm whether the failure touches ticket-owned artifacts;
3. rerun once after checking current worktree state;
4. report honestly in Review if it remains red.

## Step 9 — Commit handling

There is no production source unit in this spike.

- Do not use ordinary `git add` or `git commit`.
- Do not include `docs/active/tickets/T-081-01-01.md`.
- Do not force-add private attempt artifacts through `lisa commit-ticket`.
- Allow Lisa to publish the verified attempt artifacts in its completion commit, as required by
  the assignment's lease protocol.

If implementation unexpectedly needs a non-attempt repository file, document the deviation in
`progress.md` before editing and commit that exact path with `lisa commit-ticket`.

## Step 10 — Review and stop

Write:

- `progress.md` with completed steps and verification receipts;
- `review.md` with acceptance assessment, coverage, and limitations;
- `review-disposition.json` with exact pass/block schema.

Pass only if:

- both fixtures are valid and replay successfully;
- root-cause arithmetic reconciles exactly;
- sidechain verdict is counted and explicit;
- no unsanitized payload remains;
- full repository check is green;
- all required Review artifacts exist.

After Review, remain on T-081-01-01 and stop. Do not start T-081-01-02 or T-081-02-01.
