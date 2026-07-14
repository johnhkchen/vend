# T-009-01 — Review: ProposeEpic BAML (signal → EpicCard)

Handoff document. What a reviewer needs to understand the work without reading every diff.

## What changed

Committed at **`dd5d66f`** on `main`.

| File | Change | Summary |
|---|---|---|
| `baml_src/propose.baml` | **new** | `function ProposeEpic(signal, charter, project) -> EpicCard` + three enums (`CardColor`, `CardType`, `CardRarity`) + `class EpicCard`. Authoring-only via `ClaudeStub`. |
| `src/baml/propose-bridge.ts` | **new** | Subprocess render/parse bridge; mirrors `note-bridge.ts`; reuses `extractPromptText` from `decompose-bridge.ts`. |
| `src/baml/propose.test.ts` | **new** | Three offline pins: parse → typed `EpicCard`, garbage → rejected, render → inputs in prompt. |
| `docs/active/work/T-009-01/*.md` | **new** | RDSPI artifacts (research, design, structure, plan, progress, review). |
| `baml_client/` | regenerated, **not committed** | gitignored build product (`EpicCard` + enums materialized by `bun run baml:gen`). |

`EpicCard` shape (matches the ticket spec field-for-field): frontmatter `id`, `title`,
`kind`, `advances[]`, `serves`; stat-block `manaCost`, `color[]`, `type`, `rarity`; body
`intent`, `value`, `doneLooksLike`, `context`.

## Acceptance criteria — status

- ✅ **AC1** — `baml_src/propose.baml` defines `ProposeEpic(signal, charter, project) ->
  EpicCard` with frontmatter + stat-block + body fields; `bun run baml:gen` regenerates
  the client (verified: exit 0, `EpicCard` + 3 enums present in `baml_client/types.ts`).
- ✅ **AC2** — a unit test feeds a canned reply through `b.parse.ProposeEpic` → a typed
  `EpicCard` (parse pin); a second asserts `b.request.ProposeEpic(...)` renders the inputs
  into the prompt (render pin). No live call — all ops run render-only through the
  subprocess bridge.
- ✅ **AC3** — `bun run check:typecheck` exit 0; `bun run check:test` **285 pass / 0 fail**
  across 21 files.

## Test coverage

Three pins, all offline and deterministic (canned/sentinel data, no clock/randomness/model):
1. **parse** — canned card → typed `EpicCard`; asserts id/title/serves, all stat-block
   enum **member** names (`color[0]==="Blue"`, `type==="Permanent"`, `kind==="Permanent"`,
   `rarity==="Rare"`), `kind===type`, `advances`, and all four body fields.
2. **garbage-reject** — `b.parse` throws "required field" on a non-card reply, proving
   `EpicCard` is a required-scalar class (rejects, ≠ WorkPlan's degrade-to-empty).
3. **render** — `b.request` renders the `signal`/`charter`/`project` sentinels and the
   `epic-proposer` framing into the prompt.

### Coverage gaps (intentional, scoped out)
- **No present-but-empty pin.** Omitted per design D6 — the empty-card STOP is a PE-gate
  concern (T-009-02), not a shape pin. The garbage-reject pin is the higher-signal check.
- **No live cast / no semantic validation.** Authoring-only ticket. Whether the minted
  `id` is disjoint from the board, `advances` actually holds, and non-goals are respected
  is owned by the PE gates (T-009-02) and the live cast (T-009-03). BAML owns SHAPE; gates
  own MEANING.
- **No render assertion on individual PE-rule tokens** beyond the `epic-proposer` framing
  marker — consistent with the sibling suites, which assert one framing token, not the
  whole preamble.

## Open concerns / notes for downstream

- **`kind` and `type` are one enum (`CardType`) on two fields** — the same single-use/
  reusable axis rendered two ways. T-009-02's structural gate should assert `kind === type`;
  the renderer maps member→alias for frontmatter `kind:` (lowercase) and uses the member
  name for the stat-block type line (title-case).
- **`color` is `CardColor[]`** to model multi-color (Azorius WU). The value/structural gate
  should treat `color: []` and `advances: []` as a STOP (the model is instructed never to
  leave them empty, but the gate is the contract).
- **Parse-closure contract for T-009-03** — `b.parse.ProposeEpic` *throws* on garbage but
  *coerces* a present-but-empty reply to a blank card. The play's parse closure must catch
  the throw and hand the gates an empty card (so a bad reply becomes a clean `gate-failed`
  andon, never a `castPlay` crash) — exactly the `note.ts` pattern.
- **No new flake risk** — the native-addon one-call-per-process discipline is preserved:
  the test uses only type-only BAML imports and does all native work in the spawned child.

## Tree state

Working tree is clean for source after the commit; the only unstaged path is
`docs/active/tickets/T-009-01.md` (Lisa-owned phase/status frontmatter, deliberately not
touched). `baml_client/` is gitignored and not staged. `check:committed` is satisfied for
source.

## Verdict

Ready for review and to unblock **T-009-02** (pure PE gates + card→markdown renderer). The
typed `EpicCard` shape and its render/parse pins are in place; three plays now author
through the same BAML substrate.
