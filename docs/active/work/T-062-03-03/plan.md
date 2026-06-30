# T-062-03-03 — Plan

**Phase:** Plan. Ordered, independently-verifiable steps + the testing strategy.

## Testing strategy (what proves each clause)

| Clause | Verification | Kind |
|---|---|---|
| 1 — one-card-per-dish from REST, matching the example dish | `menu-render.test.ts` blocks A–C: pure contract + render shape + the **real `seed.json`** example renders to one card with its name/photo/description | unit (gated) |
| 2 — `astro build` green | actually run `astro build` on the reference page in a seed-dir copy → `build.proof.txt` (exit 0); plus the drift guard (block D) keeps the built page == the spec | integration (offline, real) |
| 3 — lands inside cold-start budget in `runs.jsonl` | recorded `⟪…⟫` + re-run block in `EXPECTED-OUTCOME.menu-render.md` (metered, human-authorized) | recorded (honest pending) |

Gate command: `bun run check` (baml:gen + `tsc --noEmit` + `bun test`) must stay green — the bar
03-01/03-02 held (≈1479 pass / 1 skip / 0 fail before this ticket).

## Steps

### Step 1 — `src/kitchen/menu-render.ts` (the pure render spec)
- Import `EmDashRecord`, `EmDashSeed`, `dishRecords`, `DISH_COLLECTION_SLUG` from `./dish-seed.ts`.
- `dishToCard`: read `record.data.{name,photo,description}`; coerce non-string photo/description → null,
  name → string (`""` if absent so a malformed row is *visible*).
- `menuCards`: filter `status === "published"`, map `dishToCard`, preserve order.
- `renderMenu(cards)`: emit `<article class="dish-card">…</article>` per card (img only when photo,
  `<h2>` name, `<p>` description when present), or the honest-empty `MENU_EMPTY_MARKER` block on zero.
  Private `esc()` escapes `& < > " '`.
- `dishesFromSeed(seed) = dishRecords(seed)` (render-intent alias, the offline fallback source).
- Export `MENU_CARD_CLASS`, `MENU_EMPTY_MARKER`.
- **Verify:** `tsc --noEmit` clean (run via step 4's `bun run check`).

### Step 2 — `docs/active/work/T-062-03-03/menu-render.index.astro` (the reference page)
- Front-matter (SSR, runs per request): read `EMDASH_API_URL` from env; if set, `fetch`
  `${EMDASH_API_URL}/api/collections/dishes/records?status=published` in a `try`; on any failure or if
  unset, fall back to the **seeded example** (inline the one example record so the page is
  self-contained — the cook's scaffold has no `.emdash/seed.json` import wired into Astro yet, and the
  fallback must render even with no server). Normalize the REST payload to the `{id,slug,status,data}`
  record shape.
- Body: keep the stub's mobile-first frame (`<meta viewport>`, system font, centered column,
  `#fff8f2` palette); replace the placeholder `<main>` content with the rendered cards (inline the
  same card structure `renderMenu` emits — `dish-card` class, img/h2/p). Honest-empty state when zero.
- Self-contained: **no import from vend `src/`** (a scaffolded page can't reach it).
- **Verify:** step 3 builds it.

### Step 3 — `astro build` green proof → `build.proof.txt`
- Copy the seed dir's buildable surface into a temp dir **or** back up the stub in place. Chosen
  mechanic (least risk to the committed tree): in a `mktemp` dir, symlink/copy `node_modules`,
  `package.json`, `astro.config.mjs`, `tsconfig.json`, `src/env.d.ts`, `public/`, then write the
  reference page as `src/pages/index.astro`; run `node_modules/.bin/astro build`.
  - If copying `node_modules` is too heavy, instead: back up the seed's real `index.astro`, drop the
    reference in, `astro build`, then **restore the stub** (verify byte-identical via `git status`
    showing no change to the template). Either way the committed template stub is unchanged.
- Capture stdout+stderr+exit code into `build.proof.txt` with a header noting the mechanic and that the
  template stub was restored. **Pass condition:** exit 0, `dist/server` + `dist/client` emitted.
- **Verify:** `git status` shows `examples/templates/kitchen-seed/` unmodified after.

### Step 4 — `src/kitchen/menu-render.test.ts` + gate
- Blocks A–D per structure.md. Block C reads the real `seed.json` (the drift idiom); block D reads the
  reference `.astro`.
- Run **`bun run check`** → expect green (new tests pass, no regression). Fix any `tsc` issue in step 1.
- **Verify:** exit 0; the new file's tests counted in the pass total.

### Step 5 — `EXPECTED-OUTCOME.menu-render.md` (the gold-master record)
- Header: ⚠️ NOT YET CAPTURED for the metered half (03-02's wording).
- "Deterministic half — CAPTURED": the render contract (pinned by `menu-render.test.ts`) + the real
  `astro build` green (`build.proof.txt`), with the example-dish card shown.
- "Metered half — PENDING (the live `vend work`)": a table, every live value `⟪…⟫` — `outcome:success`,
  `totalTokens ≤ envelope.tokens`, `wallClockMs ≤ envelope.timeMs`, cost, the run's `play`/`epic`.
- Re-run block: `vend init --template kitchen` → `vend doctor` → `vend steer` → **`vend work`** (the
  metered cast), then `jq`/`grep` on `.vend/runs.jsonl` to confirm `outcome:"success"` and the budget
  bound. Note `--budget` omitted ⇒ the calibrated cold-start envelope (E-060 #2).
- Honest-on-outcome footer.

### Step 6 — `progress.md` + `review.md`
- `progress.md`: per-step done/deviation log.
- `review.md`: the handoff — files, coverage, clause-by-clause status, open concerns, the metered-half
  pointer to T-062-04-01.

## Risks & mitigations
- **`astro build` flaky/slow in the seed copy** → if `node_modules` copy is impractical, use the
  back-up-restore-in-place mechanic; always confirm the template stub is byte-restored via `git status`.
- **Drift between spec and reference page** → block D pins shared markers; both reference the same
  `MENU_CARD_CLASS`.
- **Over-reach (building the live cast)** → explicitly out of scope; clause 3 stays `⟪…⟫` (honest).
- **Breaking the seed contract** → the template stub is never committed-over; reference lives in `docs/`.

## Out of scope
Cloudflare deploy (board's Standard slice); engine/CLI/BAML/run-log edits; real EmDash server; `--budget`
tuning; committing the render into the template.
