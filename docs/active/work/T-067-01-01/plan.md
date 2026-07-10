# T-067-01-01 — charter-code-snapshot-resolver — Plan

Ordered, independently verifiable steps. Two files, one leaf module — the plan is short and
the verification is the point.

## Step 1 — Create `src/play/charter-snapshot.ts`

Write the module per structure.md: header narrative (snapshot-at-cut story, id-guard purity
standard, definition-anchored parse, first-wins, the matchIds split), `DEFINITION` regex,
private `oneLine` normalizer, exported `CharterSnapshot` type + `snapshotCharterCodes`.

**Verify:** `bun run check:typecheck` passes (module compiles standalone; zero imports means
zero resolution risk). Quick REPL sanity: `bun -e` feeding the live charter through the
function prints an 11-entry map. *(A REPL read of the charter file is fine — the no-fs rule
binds the module and the test, not ad-hoc verification.)*

## Step 2 — Create `src/play/charter-snapshot.test.ts`

Write the five describes per structure.md, in the order listed (gold pin first — it is the
AC's core and the fixture other suites contrast against):

1. **live charter gold pin** — text-import `docs/knowledge/charter.md`; assert snapshot size
   11 and full entry-by-entry equality with `LIVE_EXPECTED` (P1..P7, N1..N4, title-only
   values transcribed from the charter).
2. **typed absence** — live snapshot: `get("P9")`/`get("PE1")`/`get("X1")` all `undefined`,
   `.has` false. Retired fixture (fabricated charter = live invariant list minus P3): `P3`
   absent, `P2`/`P4` resolve.
3. **never an empty string** — malformed fixtures (`**P8 — .**`, `**P8 —  **`, `**P8 — 	.**`)
   mint no entry; every value in the live AND kitchen snapshots is non-blank after trim.
4. **definition-anchored, first wins** — `advances P1 today` prose (no bold) → empty map;
   prose mention before a real definition doesn't shadow the definition's text; duplicate
   `**P1 — First.** … **P1 — Second.**` → `First`.
5. **shape robustness** — bold span wrapped across a newline resolves to one
   space-collapsed line; `**P8 — Ships v2.**` → `Ships v2` (interior period kept, exactly
   one trailing stripped); kitchen charter → exactly `K1..K3` with their live titles.

**Verify:** `bun test src/play/charter-snapshot.test.ts` — all green.

## Step 3 — Full gate + commit

- `bun run check` (baml:gen + tsc + full suite) — proves the leaf module broke nothing and
  the text imports typecheck under `verbatimModuleSyntax`.
- Single commit (structure.md: module + test are one atomic unit; the test IS the AC):
  `feat(play): charter-code snapshot resolver — pure code→one-liner map (T-067-01-01)`
  with the Claude co-author trailer.

## Testing strategy summary

- **Unit tests only, all pure** — no fs (text imports), no BAML addon (zero BAML imports
  anywhere in either file), no integration surface exists yet (first consumer lands in
  T-067-01-02). This matches the AC exactly; a cast-level proof is deliberately NOT here
  (T-067-01-03's fixture cast owns it).
- **Gold-master discipline:** the live-charter pin is intentionally brittle — a charter
  amendment MUST fail it (that failure is the snapshot contract doing its job). Noted for
  review.md so a future charter editor isn't surprised.

## Risks & contingencies

- **Em-dash assumptions:** if the live charter somewhere uses a hyphen or spacing variant in
  a definition, the gold pin catches it immediately (step 2.1 fails) — fix the regex, not
  the charter (out of slice).
- **`*.md` wildcard typing:** declared in `src/kitchen/seed-text-modules.d.ts`, which is
  inside the tsconfig `include: ["src"]` — ambient for the whole program; expected to just
  work (kitchen-overlay precedent). If tsc still complains from the play directory, the
  fallback is extending that d.ts comment's scope note — NOT adding fs.
- **Lint:** repo `check` has no separate lint step (package.json: check = baml:gen +
  typecheck + test); house style is enforced by convention — match sibling modules.

## Step → AC traceability

| AC clause | Covered by |
| --- | --- |
| "Pure unit tests (no fs, no BAML addon)" | Steps 1–2 file properties; step 3 full gate |
| "fed the live charter text it maps every P1..P7 and N1..N4 code to its one-line text" | Step 2.1 gold pin |
| "unknown or retired code resolves to a typed absence the caller must handle" | Step 2.2 + `CharterSnapshot`'s `.get(): string \| undefined` |
| "never a silent empty string" | Step 2.3 (structural: parser mints no blank values) |
