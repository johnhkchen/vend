# T-067-01-02 — materialize-carries-code-text-at-cut — Research

Descriptive map: what exists, where, how it connects. No solutions here.

## The ticket in one line

Thread the charter into materialize's PURE render pair so freshly cut bodies carry every cited
charter code WITH its one-line text (`P4 — Autonomy by default, not supervision`, code kept),
for both the ticket `_Advances:_` line and story-body citations — pinned by materialize.test.ts
goldens, with the render pair staying clock-free and addon-free.

## Story context (S-067-01, read first)

- Scope: this ticket is the materialize integration — the render pair, the impure `materialize`
  verb (charter threaded as a parameter), and the decompose runner that supplies the charter it
  already holds for `ClearContext`. gates.ts and the BAML decompose prompt are untouched.
- Wave rationale: sequential after T-067-01-01 (done, commit `23469d9`); T-067-01-03 (the
  bare-code write guard) runs after THIS ticket because it asserts over the exact rendered
  bodies this ticket produces. Refusal-on-missing-code is therefore NOT this ticket's job.
- Honest boundary: fixture-proven and FREE; the live metered cast is a deferred close-out.
- Out of slice: charter amendment, backfilling old artifacts, read-side stripping, the bounds
  gate's dangling-ref check.

## The settled upstream contract (T-067-01-01, landed)

`src/play/charter-snapshot.ts` exports exactly two names:

- `type CharterSnapshot = ReadonlyMap<string, string>` — key: code as written (`"P4"`); value:
  the definition's one-line TITLE, trailing period stripped, whitespace collapsed, guaranteed
  non-blank. Miss: `.get()` → `undefined` (typed absence strict tsc forces callers to narrow).
- `snapshotCharterCodes(charter: string): CharterSnapshot` — PURE (zero imports) and TOTAL
  (never throws; codeless charter → empty map). Parses only the bold definition shape
  (`**P4 — Autonomy by default, not supervision.** …`); prose mentions neither create nor
  shadow; code shape is prefix-generic (`[A-Z]{1,3}\d+`).

The T-067-01-01 review's explicit handoff: build the snapshot ONCE per cut from the charter the
runner already holds (`ctx.inputs.charter`), thread it into the render pair as a PARAMETER,
render advances as `${code} — ${snapshot.get(code)}` (the snapshot value is code-free; this
renderer is the single owner of that assembly), and treat `undefined` as the refusal INPUT the
T-067-01-03 guard later turns into a named andon.

## materialize.ts today (`src/play/materialize.ts`, 282 lines)

- `renderTicketFile(t: TicketDraft): RenderedFile` — PURE. Frontmatter: the eight lisa fields
  (`advances` is NOT one of them — it lives only in the body). Body: `## Context` + `t.purpose`,
  then the line `` `_Advances: ${t.advances.join(", ")}_` `` (materialize.ts:154 — the exact
  line this ticket replaces), then `## Acceptance Criteria` + `- [ ] ${t.doneSignal}`.
- `renderStoryFile(s: StoryDraft, storyTickets, cutDate: string): RenderedFile` — PURE. Story
  contract body (T-066-01-03): `**Scope:**`/`**Story acceptance:**`/`**Honest boundary:**`
  paragraphs (absent field renders NOTHING — the completeness gate owns refusal), a derived
  `## DAG` fenced block (ids/titles/edges only), `Wave rationale:` prose under the DAG,
  `**Out of this slice:**`, and a dated provenance footer. The clock stays out: `cutDate` is a
  parameter — the exact precedent for threading cut-time data into the pure pair.
- `materialize(plan, targets): Promise<MaterializeResult>` — the single IMPURE verb: gathers
  board ids, runs `detectCollisions`, throws typed `IdCollisionError` BEFORE any write, then
  mkdir + one clock read (`cutDate`) + writeFile loops over stories then tickets.
- Purity discipline (module header): render pair + alias maps are pure — no fs, no clock, no
  native addon; the baml import is TYPE-ONLY (erased). materialize.test.ts is an ordinary
  pure-function test plus a real-fs collision-guard fixture.

## Where the codes actually appear in a rendered body

- Ticket `advances: string[]` — the structured citation (BAML: "which charter invariants
  (P1..P7) and/or epic outcomes this serves; never empty"). NOTE: on the decompose path,
  `parse` already runs `stripNonGoalAdvances` (decompose-epic.ts:248), so N-codes are stripped
  from `advances` arrays before gates/materialize ever see them — advances carry P-codes in
  practice, but the type allows anything.
- Ticket prose — `purpose` routinely cites codes inline (this very ticket's Context ends
  "…full grounding (P4, P6)"); `doneSignal` can too.
- Story prose — `StoryDraft` has NO `advances` field; its citations live inside the five
  optional section strings (scope, storyAcceptance, honestBoundary, waveRationale, outOfSlice),
  e.g. the live S-067-01 scope cites "(P4, P6)"-style codes. "Story-body citations" in the AC
  can only mean these.
- NOT code-bearing: frontmatter (both kinds), the DAG block (ids like `T-009-01` put a hyphen
  between letter and digits, so the code shape `[A-Z]{1,3}\d+` cannot match them), the footer.

## Call sites that must supply the charter

- `decomposeEffect` (decompose-epic.ts:188) — the ONLY production caller:
  `materialize(finalPlan, {storiesDir, ticketsDir})`. It holds `ctx.inputs.charter` already
  (the same string it feeds `clear(plan, {epic, charter})` — `ClearContext`, gates.ts:41-45).
  `DecomposeInputs.charter` is read verbatim from `docs/knowledge/charter.md` by
  `assembleInputs` (project-context.ts:168-189, "the charter MUST be the real one").
- `chain-propose-decompose.test.ts:137` — calls `materialize(CANNED_PLAN, {…})` directly; a
  `CHARTER` fixture ("P1 author-once. …", line 52 — NOT the bold definition shape, so it
  snapshots to an empty map) is in scope.
- `story-gate-cast.test.ts:124` — `decomposeShapedPlay`'s effect calls
  `materialize(plan, dirs)`; the play's inputs carry `charter: CHARTER` (line 40, also not
  bold-shaped) and the effect signature can receive `ctx` (the real decomposeEffect does).
- Nobody else imports the render pair (grep: only comments in note-core.ts / propose-core.ts
  cite it as a pattern). expand-effect.ts writes staged signals via its own renderer — no
  ticket/story bodies, out of scope.

## Test terrain (materialize.test.ts, 313 lines)

- Fabricated drafts via `ticket(over)` / `story(over)` factories; enum members as cast string
  literals; every baml import TYPE-ONLY (a value import would load the native addon into
  `bun test` — forbidden).
- Byte-exact goldens (house EXPECTED-OUTCOME style, inline literals + `toBe`): the ticket
  full-file golden (line 96, `_Advances: P1_` — its comment says editing it means the ticket
  surface deliberately moved), the story contract golden (five sections + two-parent DAG +
  footer), the degraded golden (absent contract fields render nothing).
- Targeted `toContain` tests for aliases, flow arrays, the value triplet, edge fidelity.
- The collision guard is covered by a real-fs mkdtemp fixture exercising `materialize` itself.
- Precedent for feeding real charter text with no fs: Bun text imports
  (`with { type: "text" }`), already typed by `seed-text-modules.d.ts` and used by
  charter-snapshot.test.ts. gates.test.ts:22 shows the inline fabricated-CHARTER alternative.

## Live charter one-liners (what expansions will actually say)

P1 "Author once, run forever" · P2 "The run is two gestures" · P3 "Gates are the contract" ·
P4 "Autonomy by default, not supervision" · P5 "Local-first" · P6 "Executor-agnostic
underneath" · P7 "Budget is a hard contract" · N1 "Not a chat copilot" · N2 "Not a babysitting
dashboard" · N3 "Not a one-off prompt runner" · N4 "Not an executor" (titles as
charter-snapshot's gold pin resolves them, periods stripped).

## Constraints and assumptions surfaced

1. AC wording "the charter supplied as a render parameter" vs the T-067-01-01 handoff "build
   the snapshot once per cut … thread IT into the render pair" — whether the pure pair takes
   the raw charter string or the parsed `CharterSnapshot` is a Design decision; either keeps
   the pair clock-free/addon-free (the resolver is zero-import pure).
2. Miss behavior HERE must be degrade-not-refuse: T-067-01-03 owns the named andon, and the
   render pair is pure/total by house pattern (expected absence is data; only wiring errors
   throw, e.g. `alias`'s RangeError). A bare code surviving this ticket is the guard's input.
3. Prose expansion must not touch non-charter tokens: `[A-Z]{1,3}\d+` also matches strings
   like `E1` (forward-E1), `A3`, `K1` in running prose — only codes the snapshot RESOLVES are
   safe to rewrite; everything else must pass through untouched.
4. Idempotency / double-expansion: model-authored prose may already write `P4 — <its own
   gloss>`; a naive replace would yield `P4 — <title> — <gloss>`. Whether/how to guard is a
   Design decision.
5. The `_Advances:_` line is comma-joined today; expanded texts make comma separation
   ambiguous (titles could contain commas — none do today, but the format outlives the
   current charter). Separator choice is a Design decision.
6. All three goldens change bytes only if their fixtures cite codes: the current contract
   fixtures carry NO codes in section prose, and the ticket golden's `advances: ["P1"]` line
   WILL change shape. The full-file-golden comment ("the ticket surface moved — a deliberate
   decision") is exactly this ticket's mandate.
7. Frontmatter must stay byte-identical (lisa validity; `advances` never was frontmatter).
8. The two non-production `materialize` call sites hold non-bold-shaped charter fixtures that
   snapshot to EMPTY maps — with degrade semantics their existing assertions (ids, sections,
   gate refusals) keep passing; nothing there asserts on `_Advances:` bodies (grep-verified).
9. Dependency direction: materialize.ts (play layer) may import charter-snapshot.ts (same
   dir, pure leaf) — no cycle risk; the engine never imports src/play/.
