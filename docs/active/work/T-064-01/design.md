# T-064-01 — Design

> Decide how `vend init --template <name>` lays a standalone workspace in an empty,
> no-checkout, no-Doppler directory — without weakening the lisa gate for the existing
> bare-init and `hackathon` paths. Grounded in Research.

## The decision in one line

Add a **standalone-template** concept: a named template can declare "make a fresh
workspace here, no lisa checkout required," and when such a template is given,
`runInit` **bypasses the lisa-project gate**. Ship one such template — `minimal` — as
the **empty placeholder** the epic anticipates. Doppler/repo independence is already
structurally true; pin it with a guard test.

## The core tension (from Research)

The lisa gate refuses an empty dir — exactly where a brew binary runs. We must get the
standalone path past the gate while keeping it intact for (a) bare `vend init` and (b)
`hackathon` (both pinned: `:138`, `:293`). Three reviewed invariants are in play:
one-way-to-lisa (`:241` — overlays name no lisa marker), honest-empty (`:230`), and the
no-clobber/idempotency contract.

## Options considered

### Option A — Relax the gate for *any* `--template`
When `template !== undefined`, skip `isLisaProject`. Simple.
- ✗ **Breaks `:293`** — `hackathon` in a non-lisa dir would now scaffold, not refuse.
  `hackathon` is an *overlay onto an existing lisa project*; making it scaffold a random
  empty dir silently is a behavior change to a reviewed E-058 path. Rejected.

### Option B — The standalone template seeds its own `CLAUDE.md` marker
Add `minimal` whose overlay includes `{kind:"file",path:"CLAUDE.md",...}`. Change the
gate to pass when the **effective** (merged) manifest will lay a marker. The dir becomes
a real lisa project as part of scaffolding.
- ✓ Keeps `hackathon` gated (its overlay carries no marker → still refused in a non-lisa
  dir), so `:293` survives.
- ✗ **Violates the one-way-to-lisa invariant test `:241`**, which forbids *any* overlay
  from naming a `LISA_MARKER`. To ship this, that reviewed E-058 invariant must be
  re-scoped ("never *clobber* a lisa file" instead of "never *name* a marker"). That is
  a real semantic change to a contract this epic explicitly says it should not expand
  (kitchen content / workspace authoring is E-062). Higher blast radius than the ticket
  warrants. **Rejected as primary** (recorded as the natural follow-up if a self-
  identifying `CLAUDE.md` is later wanted).

### Option C — A per-template **standalone flag**; the placeholder overlay is empty ✅
Keep the registry's overlay values as-is. Add a small, separate
`STANDALONE_TEMPLATES: ReadonlySet<string>` + `isStandaloneTemplate(name)`. `runInit`
bypasses the gate **iff a standalone template was named**. Ship `minimal` with an
**empty overlay** (`[]`): it adds no files — the base `SCAFFOLD_MANIFEST` already lays a
complete, honest-empty, usable workspace; `minimal` simply says "lay it here, standalone."
- ✓ `hackathon` stays non-standalone → gate still refuses it in a non-lisa dir (`:293`
  green). Bare init still gated (`:138` green).
- ✓ One-way-to-lisa (`:241`) **untouched** — `minimal: []` contributes no overlay entry,
  no marker is ever written, the base manifest is unchanged.
- ✓ Honest-empty (`:230`) trivially holds (empty overlay).
- ✓ Idempotency / no-clobber inherited verbatim — the standalone path runs the *same*
  `applyInitScaffold` over the *same* base manifest; the AC's "no-clobber converge" is
  the existing `wx`-flag guarantee, now exercised standalone.
- ✓ Minimal blast radius: two pinned expectations grow by one element
  (`availableTemplates()`, `unknown-template.available`); no invariant moves.
- Trade-off: an empty overlay means `--template minimal` writes the *same files* as a
  (hypothetical) bare init in that dir — its only distinguishing effect is the gate
  bypass. That is **exactly** the "minimal/placeholder template" the epic names: its job
  is to prove the standalone seam, not to author content.

## Decision: Option C

The standalone-ness is a **gate policy**, not a content concern, so it belongs as a
small policy set beside the registry — not baked into overlay data (which would force the
registry's value shape to change and ripple through the `Object.values(...)` invariant
tests). The placeholder template is honestly empty because the base scaffold *is* the
workspace; the value `minimal` adds is permission to lay it without a checkout.

### Why not fold standalone into the registry value shape?
Changing `TEMPLATE_REGISTRY`'s value to `{standalone?, overlay}` breaks the two invariant
tests that iterate `Object.values(TEMPLATE_REGISTRY)` as `ScaffoldEntry[]` (`:231`,
`:242`) and `resolveTemplate`'s return type. A parallel `STANDALONE_TEMPLATES` set keeps
`resolveTemplate`/`availableTemplates` and every existing test intact. One extra tiny
export is cheaper than reshaping a reviewed data structure.

## The resulting `runInit` flow (resolve template before the gate)

```
entries = readdir(root)
if template given:
    overlay = resolveTemplate(template)
    if !overlay: return unknown-template            # arg error — dir-independent
standalone = template != null && isStandaloneTemplate(template)
if !standalone && !isLisaProject(entries): return not-lisa
manifest = overlay ? mergeManifests(base, overlay) : base
return scaffolded(applyInitScaffold(root, manifest))
```

**Reordering note.** Template resolution now precedes the gate (the standalone bit needs
the name resolved). Effect on tested behavior:
- `:293` non-lisa + `hackathon` (known, non-standalone) → still `not-lisa`. ✓
- `:282` lisa + `bogus` (unknown) → still `unknown-template`. ✓
- *Untested* combo non-lisa + `bogus`: was `not-lisa`, now `unknown-template`. This is a
  strict improvement — an unknown template name is a usage error independent of the
  directory, so reporting the more specific arg error first is correct. No existing test
  asserts this combo; documented as a deliberate, defensible change.

## Doppler / repo independence — how it is satisfied

The init path reads no env and spawns no `git` (Research). Option C adds nothing that
would. Independence is therefore **structural**, and the AC test is a **guard**:
- Run `runInit(emptyDir, "minimal")` in a temp dir that is **not** a git repo (`mkdtemp`
  yields a bare dir with no `.git`) — proves "no checkout."
- Delete every `DOPPLER_*` key from `process.env` for the test's duration and confirm the
  scaffold still succeeds — proves "no Doppler env dependency."
- Assert the run created **no `.git`** under the dir — proves it didn't quietly init a repo.

## Naming

`minimal` — the literal word in the epic ("minimal/placeholder template"), signalling
"the smallest standalone workspace." `STANDALONE_TEMPLATES` names the policy directly.

## What stays out of scope (per epic E-061)

- Authoring kitchen/workspace content (E-062). `minimal` is deliberately contentless.
- Seeding a self-identifying `CLAUDE.md` (Option B) — deferred; would re-open the
  one-way invariant.
- Any CLI surface change — the existing dispatch arm already handles all three outcomes
  and the `--template` flag.
