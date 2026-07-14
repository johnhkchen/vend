# T-067-01-03 — bare-code-write-guard — Plan

Ordered steps, each independently verifiable. Two commits (the guard + fixtures must
land atomically to keep the suite green; the cast proof closes the AC). Gate:
`bun run check` (baml:gen + tsc + lint + full suite) at each commit.

## Step 1 — mint the `bare-code` outcome (run-log.ts)

- Add `"bare-code"` to `RUN_OUTCOMES` between `graph-invalid` and `errored`; extend the
  tuple's provenance doc comment with the one-line origin.
- No new test needed: `run-log.test.ts` runs `test.each([...RUN_OUTCOMES])` and derives.

Verify: `bun test src/log/run-log.test.ts` green; grep confirms no exhaustive-switch
consumer elsewhere (research already established none).

## Step 2 — pure detector + typed error (materialize.ts)

- `BARE_CODE = /\b([A-Z]{1,3})\d+\b(?! —)/g` beside `PROSE_CODE`, lockstep comment on
  the shared gloss-skip.
- `BareCodeHit` interface, `findBareCodes(files, snapshot)` (policed prefixes = {P, N}
  ∪ snapshot-key prefixes; per-file dedupe, body order; whole file scanned; total,
  never throws), `BareCodeError` (IdCollisionError pattern: `name`, `hits`, message
  naming each file with its codes).
- Module header gains the T-067-01-03 paragraph.

Unit tests (new describe in materialize.test.ts, pure, addon-free):
1. clear: fully-glossed bodies → `[]`.
2. hit: a body with bare `P9` → one hit naming file + code.
3. dedupe + order: `P9 … N7 … P9` → `["P9", "N7"]`.
4. gloss-skip: `P4 — any gloss text` is not a hit (charter text or model's own words).
5. foreign prefix: `forward-E1`, `A3` never hit against the P/N charter.
6. snapshot-derived prefix: a `**K1 — …**` charter makes bare `K7` a hit; `A3` still
   passes (A never policed).
7. empty snapshot: bare `P1` still hits (the {P, N} floor — the handoff's
   counterexample made unreachable).
8. multi-file: hits keyed by `RenderedFile.name`, files with no hits absent.

Verify: `bun test src/play/materialize.test.ts` (new describe green; nothing else
touched yet).

## Step 3 — the verb reorder + guard throw (materialize.ts)

- Reorder `materialize`: collisions → snapshot/cutDate → render-all (stories then
  tickets, plan order, story-tickets filter moves here) → `findBareCodes` over all
  rendered → throw `BareCodeError` on hits → mkdir ×2 → write from the rendered arrays
  (same paths, same result-array construction).
- Rewrite the verb's doc comment: two pre-write guards, collision first (identity
  before content), zero partial output structural for both.

Real-fs tests (materialize.test.ts guard section, beside the collision pair):
1. refusal: bold charter WITHOUT P9, plan whose ticket purpose cites `P9` →
   `BareCodeError`, `hits` = `[{file: "T-….md", codes: ["P9"]}]`, target dirs ENOENT
   (throw precedes mkdir), nothing on disk.
2. guard order: a plan that BOTH collides and carries a bare code refuses with
   `IdCollisionError` (collision wins).
3. pass: the existing "fresh/disjoint board" test now doubles as the pass side (its
   plan cites only defined codes against the bold CHARTER fixture) — assert one glossed
   body line so the pass is observable.

## Step 4 — fixture charters go bold-shaped (same commit as 2–3)

- `story-gate-cast.test.ts` `CHARTER` → `**P1 — Author once, run forever.** …` (same
  three codes, bold DEFINITION shape).
- `chain-propose-decompose.test.ts` `CHARTER` → bold shape, same four codes.
- Run both files; the contrast cast and the chain materialize test must stay green
  (assertions are substring/pass-through safe per design D7).

**Commit A** (steps 1–4): `feat(play): bare-code write guard — refuse unresolved codes
before first byte (T-067-01-03)`. Gate: `bun run check` full green.

## Step 5 — effect relabel (decompose-epic.ts)

- Import `BareCodeError`; add the `instanceof` arm in `decomposeEffect`'s catch →
  `{ok: false, outcome: "bare-code", detail: "bare-code — charter cannot resolve cited
  code(s): <file: codes; …>"}`; extend the effect doc comment's relabel list.
- No direct unit test (the effect is the impure verb, per house pattern); proven at
  cast level in step 6.

## Step 6 — cast-level fixture proof (bare-code-cast.test.ts, new)

Per structure.md: stub executor + decompose-shaped fixture play (REAL `clear`, REAL
`materialize`), bold `CHARTER`, two casts:
1. refusal — prose-cited `P9` invisible to the real bounds gate → outcome `bare-code`,
   `materialized: false`, dirs ENOENT, run-log record carries outcome + detail naming
   `P9`.
2. grep-clean — full plan (five-section story, two tickets) → `success`; every written
   body matches `/\b[PN]\d+\b(?! —)/` zero times; one positive glossed-line assert.

**Commit B** (steps 5–6): `feat(play): bare-code andon relabel + cast-level grep-clean
proof (T-067-01-03)`. Gate: `bun run check` full green.

## Testing strategy summary

- **Unit (pure)**: `findBareCodes` — 8 cases, the judgment matrix.
- **Integration (real fs)**: `materialize` refusal/order/pass — the zero-partial-output
  contract on disk.
- **Cast-level (stub executor)**: the AC's named-andon refusal AND the grep-clean full
  plan — the story-acceptance bar, token-free.
- **Regression**: existing goldens byte-untouched (renderers not modified in behavior);
  the two fixture charters updated at the shape layer only.

## Risks / watch-fors

- The renderer loops move but their bytes must not: the full-file goldens are the
  tripwire (any diff = a reorder mistake).
- `_Advances: P9; P1 — …_` — the semicolon after a bare code must still hit the
  detector (`(?! —)` sees `;`) — covered by unit case 2 shape.
- chain test's `CHARTER` is also asserted with `toBe` on inputs pass-through — update
  is one const, both sites reference it.
- If `bun run check` reveals an unforeseen `RUN_OUTCOMES` consumer, fix forward in
  Commit A (research found none).
