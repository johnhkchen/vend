# T-009-01 — Progress

## Completed (all plan steps)

- **Step 1 — `baml_src/propose.baml`** ✅ — Header (authoring-only, SAP-rejects-like-Note
  note), three enums (`CardColor` WUBRG, `CardType` Sorcery|Permanent, `CardRarity`
  Common…Mythic) with uppercase-first members + lowercase `@alias`, `class EpicCard`
  (frontmatter + stat-block + body, every field `@description`'d), and
  `function ProposeEpic(signal, charter, project) -> EpicCard` with `client ClaudeStub`
  and the PE-1…PE-7 prompt framing ending in `{{ ctx.output_format }}`.
- **Step 2 — `bun run baml:gen`** ✅ — exit 0, "Wrote 14 files". `baml_client/types.ts`
  now exports `interface EpicCard` + `enum CardColor/CardType/CardRarity`. Verified the
  generated `EpicCard` field list matches the ticket spec exactly (id, title, kind,
  advances, serves, manaCost, color[], type, rarity, intent, value, doneLooksLike,
  context).
- **Step 3 — `src/baml/propose-bridge.ts`** ✅ — `ProposeBridgeOp`/`ProposeBridgeResult`,
  `runOp` (parse → `b.parse.ProposeEpic`; render → `extractPromptText(b.request.
  ProposeEpic(...))`), `import.meta.main` stdin→stdout protocol. `extractPromptText`
  imported from `decompose-bridge.ts` (not re-implemented).
- **Step 4 — `src/baml/propose.test.ts`** ✅ — type-only imports; `runBridge` spawner;
  `CANNED` card JSON (alias tokens); sentinels; one batched module-level `RESULTS`; the
  three pins (parse → typed EpicCard incl. enum member names + kind===type; garbage →
  rejected with "required field"; render → three sentinels + "epic-proposer" framing).
- **Step 5 — full sweep** ✅ — `bun run check:typecheck` exit 0; `bun run check:test`
  **285 pass / 0 fail** across 21 files (the 3 new ProposeEpic pins included).

## Deviations from plan

None. The note-bridge mirror held exactly. The optional present-but-empty pin was
deliberately omitted (per design D6) — the garbage-reject pin is the higher-signal check
(proves EpicCard is a required-scalar class), and the empty-card STOP is a PE-gate concern
for T-009-02, not a shape pin here.

## Notes for downstream tickets

- **T-009-02 (PE gates + renderer):** `kind` and `type` are one enum (`CardType`) on two
  fields — the structural gate can assert `kind === type`. The renderer maps member →
  alias for frontmatter `kind:` (lowercase) and uses the member name for the stat-block
  type line (title-case). `color` is an array (handles Azorius WU); the value gate should
  treat `color: []` / `advances: []` as a STOP. EpicCard rejects garbage (throws) but
  *coerces* a present-but-empty reply — the parse closure in T-009-03 should catch the
  throw and hand the gates an empty card, exactly as `note.ts` does.
- **`baml_client/` is gitignored** — regenerated, never staged.

## Commit

Pending Step 6 (next): stage `baml_src/propose.baml`, `src/baml/propose-bridge.ts`,
`src/baml/propose.test.ts`, and the work artifacts. Ticket frontmatter left untouched
(Lisa owns it).
