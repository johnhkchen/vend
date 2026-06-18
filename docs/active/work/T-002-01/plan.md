# T-002-01 — Plan: ordered, verifiable implementation steps

Each step is small, independently checkable, and mapped to an AC. The agent leaves files
for lisa to commit (project convention, T-001-02/03) — no `git commit` here.

---

## Testing strategy (up front)

- **Unit, offline, fabricated inputs** — no `claude` spawn, no network (project rule;
  mirrors mc's `fixtures.test`). Three tests in `src/baml/decompose.test.ts`:
  1. **parse pin** — canned reply → `b.parse.DecomposeEpic` → typed `WorkPlan` (AC4a).
  2. **render pin** — `b.request.DecomposeEpic(...)` renders the three inputs (AC4b).
  3. **empty-degradation pin** — junk reply → empty plan (documents SAP leniency for
     downstream; not an AC but prevents a false assumption in T-002-02/03).
- **Gate of record:** `bun run check` (now `baml:gen && typecheck && test`) must be green.
- **Codegen check:** `bun run baml:gen` exits 0 and writes `baml_client/` (AC3).
- **Out of scope:** any live dispense (T-002-04), any gate behavior (T-002-02).

---

## Step 1 — `baml_src/generators.baml`  (AC3)

Write the TS generator (`output_type "typescript"`, `output_dir "../"`,
`version "0.222.0"`).
**Verify:** file exists; defer generate to Step 6 (needs the other sources).

## Step 2 — `baml_src/clients.baml`  (AC1)

Write the render-only `ClaudeStub` with the "never called" header comment (D1).
**Verify:** matches the mc reference field-for-field (provider/model/api_key/max_tokens).

## Step 3 — `baml_src/decompose.baml`  (AC2)

Author, in declaration order (structure.md): header comment (transport boundary + SAP
empty-degradation pin) → four enums (`@alias("in-progress")` on `DraftStatus.in_progress`)
→ `TicketDraft` (lisa fields + `purpose`/`advances`/`doneSignal`, each `@description`-ed)
→ `StoryDraft` → `WorkPlan` → `function DecomposeEpic(epic, charter, project) -> WorkPlan`
with `client ClaudeStub` and the charter/gates-steering prompt ending in
`{{ ctx.output_format }}`.
**Verify (deferred to Step 6):** generates without a BAML schema error; enums/classes/fn
appear in `baml_client`.

## Step 4 — `package.json`  (AC3, enables the gate)

Add `"baml:gen": "baml-cli generate --from baml_src"` and change `check` to
`bun run baml:gen && bun run check:typecheck && bun run check:test`. Preserve formatting/key
order (structure.md diff).
**Verify:** `bun run baml:gen` resolves the `baml-cli` binary and runs (Step 6 confirms output).

## Step 5 — generate the client

Run `bun run baml:gen`.
**Verify:** exit 0; `baml_client/index.ts` exists and exports `b` plus `WorkPlan`,
`StoryDraft`, `TicketDraft`, and the four enums (`grep` the generated `types`/`type_builder`
for the names). If generate fails, fix `decompose.baml` (Step 3) before proceeding — a
malformed schema is the most likely early andon.

## Step 6 — `src/baml/decompose.test.ts`  (AC4)

Write the three tests (structure.md skeleton):
- Build `CANNED` = a JSON object: 1 story (`tickets` ordered), 2 tickets with valid enum
  tokens, full `purpose`/`advances`/`doneSignal`, a `depends_on` edge between them.
- Parse pin: assert lengths, order preserved (ticket ids in declared order), enum values,
  value-triplet populated.
- Render pin: render-only key guard in `try/finally`; `extractPromptText(req)` via
  `req.body.json().messages`; assert the three sentinels present.
- Empty pin: `b.parse.DecomposeEpic("not a work plan")` → `stories.length === 0 &&
  tickets.length === 0`.
**Verify:** `bun test src/baml/decompose.test.ts` green in isolation.

## Step 7 — full gate

Run `bun run check`.
**Verify:** `baml:gen` regenerates, `tsc --noEmit` clean (incl. the generated client in the
graph), `bun test` green (new tests + existing `smoke`/executor/budget suites unaffected).
If `tsc` flags generated client code, decide per structure.md risk (expected clean).

## Step 8 — progress + leave for lisa

Update `progress.md` with what landed and any deviations. Do **not** `git commit`
(lisa owns commits; files left modified/untracked).

---

## Verification matrix (AC → step → check)

| AC | Step | Check |
|---|---|---|
| 1 — render-only `ClaudeStub` | 2 | matches mc reference; header states never-called |
| 2 — `DecomposeEpic` + `WorkPlan` w/ lisa fields + purpose/advances/doneSignal | 3,5 | generates; names present in `baml_client` |
| 3 — `generators.baml`; `bun run baml:gen` regenerates | 1,4,5 | `baml:gen` exit 0; `baml_client/` written |
| 4 — parse-pin + render-pin tests | 6,7 | `bun run check` green |

---

## Risk register & andons

- **Schema rejected at generate (Step 5).** Most likely first stop. Read the BAML error,
  fix `decompose.baml`. Common causes: a hyphen in an enum identifier (use `@alias`), an
  unknown attribute, a class referenced before… (BAML tolerates forward refs, but verify).
- **`tsc` trips on generated client (Step 7).** `skipLibCheck` won't cover it. Expected
  clean on 0.222.0; if not, the minimal fix is a targeted `tsconfig` exclude of
  `baml_client` *only if* it's purely generated noise — but prefer leaving it in the graph
  so the seam is type-checked. Decide at run; document in review.
- **`package.json` lock contention with S-001.** lisa serializes commits; only scripts
  touched. If a concurrent edit conflicts, re-apply the two-line scripts change (it is
  additive and order-independent from `src/` edits).
- **Render key leak.** The guard sets a *dummy* key and deletes it in `finally`; it is
  never sent (BAML reads it only to build the request). No real credential involved.
- **SAP doesn't degrade as assumed (Step 6 empty pin).** If `b.parse` *throws* on junk
  instead of returning empty, that is still fine for downstream — but update the pin to
  assert the throw and correct the hand-off note. Either way the behavior gets pinned, not
  assumed.
