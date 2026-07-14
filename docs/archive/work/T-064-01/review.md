# T-064-01 — Review

> Handoff for a human reviewer. What changed, how it's covered, what to watch.
> Ticket: extend `vend init --template <name>` so a brew binary lays a workspace into
> an empty, no-checkout, no-Doppler dir, against a minimal/placeholder template.

## AC verdict

> _In an empty directory with no checkout and no Doppler env, `vend init --template
> <name>` writes the workspace files; a test covers the no-clobber converge and the
> absence of any repo/Doppler dependency._

**Met.** `vend init --template minimal` in a bare `mkdtemp` dir (no lisa marker, no
`.git`) scaffolds the full `SCAFFOLD_MANIFEST` workspace. Tests cover the empty-dir
scaffold, the no-clobber converge, and the no-Doppler / no-repo independence.

## What changed

### Production (2 files)
- **`src/init/init-core.ts`**
  - `TEMPLATE_REGISTRY.minimal = []` — an empty placeholder overlay (the base scaffold is
    the whole workspace).
  - `STANDALONE_TEMPLATES = new Set(["minimal"])` + `isStandaloneTemplate(name)` — the
    gate-bypass policy, kept as a small set beside the registry (so the registry's
    `ScaffoldEntry[]` value shape and the invariant tests iterating it are untouched).
  - Header note extended: the standalone bypass relaxes only the lisa GATE, never writes a
    lisa-owned file (one-way-to-lisa preserved).
- **`src/init/init-effect.ts`** — `runInit` rewritten: resolve the template first (unknown
  ⇒ `unknown-template`), then gate only when `!standalone && !isLisaProject`, then apply.
  For `minimal`, `mergeManifests(base, [])` is the base manifest unchanged. Doc-comments
  updated with the E-061 standalone clause and the resolve-then-gate ordering.

### Tests (2 files)
- **`src/init/init-core.test.ts`** — `availableTemplates()` expectation grew to
  `["hackathon", "minimal"]`; new pure block: empty-overlay resolve, `isStandaloneTemplate`
  membership, the standalone⊆registry invariant, and `planTemplate([],base,[]) ==
  planInit([],base)`.
- **`src/init/init-effect.test.ts`** — `unknown-template.available` grew to match; new
  guarded-live block (4 AC tests + 1 regression).

### Untouched
- `src/cli.ts` — the dispatch arm already maps `not-lisa` / `unknown-template` /
  `scaffolded` and parses `--template`; USAGE already advertises it. No change needed.
- The base `SCAFFOLD_MANIFEST` and the `hackathon` template/overlay are byte-unchanged.

## Test coverage

| AC clause | Test | File |
|-----------|------|------|
| writes the workspace files (empty dir) | "an empty, no-checkout dir scaffolds the full workspace via `minimal`" | init-effect.test |
| no-clobber converge | "a second standalone run is a no-clobber converge — zero created, user edits survive" | init-effect.test |
| no Doppler dependency | "no Doppler dependency — scaffolds with every DOPPLER_* env var removed" | init-effect.test |
| no repo dependency | "no repo dependency — the run needs no checkout and creates no `.git`" | init-effect.test |
| (regression) gate intact | "the gate still holds for non-standalone paths in the same empty dir" | init-effect.test |
| pure seam | empty-overlay resolve / membership / invariant / converge | init-core.test |

- `bun test src/init/` → **65 pass, 0 fail**. `bun test src/init/ src/cli.test.ts` → **167
  pass, 0 fail**. `bun run check:typecheck` → clean.
- Pre-existing invariant tests still pass unchanged: one-way-to-lisa (`:241`), honest-empty
  (`:230`), and the lisa-gate-refuses-non-lisa pins (`:138`, `:293`) — `minimal` is
  non-content (empty overlay) and `hackathon` stays non-standalone.

## Design rationale (one paragraph)

The lisa-project gate refuses an empty dir — exactly where a brew binary runs. Rather than
relax the gate for all templates (would break `hackathon`'s overlay-onto-a-checkout
contract) or seed a `CLAUDE.md` marker (would re-open the reviewed one-way-to-lisa
invariant for content this epic defers to E-062), a template now *declares* whether it
makes a standalone workspace via `STANDALONE_TEMPLATES`. Standalone-ness is gate policy,
not overlay content, so it lives beside the registry and leaves every reviewed invariant
intact. `minimal` is honestly empty because the base scaffold already is a complete,
usable, honest-empty workspace — the template's only job is permission to lay it without a
checkout. Full alternatives in `design.md`.

## Open concerns / things to watch

1. **Behavioral reorder (intentional).** Template resolution now precedes the gate, so the
   *untested* combo "non-lisa dir + unknown template" changed from `not-lisa` →
   `unknown-template`. This is a strict improvement (an unknown name is a usage error
   regardless of directory) and is documented in the `runInit` doc-comment + design. No
   existing test asserted that combo.

2. **`minimal` adds no files.** A reviewer may ask "how is `--template minimal` different
   from bare init in that dir?" Answer: bare init is *refused* in a non-lisa dir; `minimal`
   bypasses the gate. The distinguishing effect is the gate bypass, by design (it is the
   "minimal/placeholder template" E-061 names).

3. **Pre-existing failures, NOT from this ticket.** Full `bun test` shows 8 failures, all
   in live-board smoke (`graph/load.test`, `present/svg-file.test`, `present/*` projection,
   one-way-authority). Verified pre-existing by stashing `src/init/` and re-running — they
   fail identically without this ticket's code. They read the in-flight `docs/active/**`
   board (E-061 tickets/work dirs mid-edit). **Flag for the human**, but out of scope here.

4. **No git commits.** Working tree left uncommitted (session produces artifacts for Lisa;
   repo discipline is commit-only-when-asked). The change is one cohesive commit when the
   normal flow picks it up.

5. **Follow-on (not this ticket).** If a standalone workspace should self-identify as a
   lisa/Claude project (a seeded `CLAUDE.md`), that is the deferred Option B — it would
   re-scope the one-way invariant from "names no marker" to "never clobbers a lisa file."
   Worth a ticket if E-062's kitchen content wants it. The compiled-binary end-to-end
   (T-062-02) and the fresh-machine acceptance (T-065-01) consume this seam downstream.

## Risk: low

Additive change behind an explicit, named flag; two mechanical expectation updates; one
documented reorder. No new runtime deps, no addon, no env reads — so the no-Doppler /
no-repo property the AC pins is structural, not merely asserted.
