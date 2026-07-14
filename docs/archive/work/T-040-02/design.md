# T-040-02 — Design: decisions for the scaffold write effect

One new module, `src/init/init-effect.ts` (addon-free, impure) + its temp-dir test.
Every decision is grounded in the research map and the house effect idiom. Rejected
options recorded.

## D1 — Module placement & split

**Decision:** `src/init/init-effect.ts` (the impure verb) + `src/init/init-effect.test.ts`
(guarded-live temp-dir test). Imports only `node:fs/promises`, `node:path`, and the pure
`./init-core.ts`. No BAML, no engine, no addon.

**Why:** mirrors `propose-core.ts ↔ propose-effect.ts` and `expand-core.ts ↔
expand-effect.ts` exactly — the precedent the whole repo follows. The core's own header
names this file as the home of "the first `node:fs` import in this package." Re-opening
the reviewed, committed `init-core.ts` to bolt on an fs verb is the very thing the
pure/impure split exists to prevent.

**Rejected:** adding the write to `init-core.ts` (breaks its loud pure contract; makes its
test no longer an ordinary pure test); putting it in `src/play/` (it is not a play — casts
nothing, spends no mana, exactly as `init-core` is not a play).

## D2 — How the effect learns `existing`: probe the manifest paths

**Decision:** the effect derives the `existing` listing by **probing each manifest path**
under `projectRoot` with a tiny `pathExists(abs)` helper (`stat`, ENOENT→false), collecting
the present ones, then calls `planInit(existing, manifest)`. It does **not** walk the whole
tree.

**Why:** `planInit` only ever inspects manifest paths — feeding it a full recursive
`readdir` of the project would gather thousands of irrelevant paths (the lisa project's own
source, `.git/`, etc.) for zero benefit. Probing the ≤17 manifest paths is targeted,
O(manifest), and reuses the core's `normalizePath` tolerance for free (the probe passes the
manifest's own clean paths). This keeps the **single source of the create/skip decision in
`planInit`** — the effect does not re-implement "is it present"; it gathers evidence and
asks the planner.

**Rejected:** a full `readdir` walk (wasteful, and risks matching a non-manifest path that
happens to share a prefix); accepting a caller-supplied listing only (pushes fs concerns up
into the CLI — the effect should own its own scan so a single `applyInitScaffold(root)` call
is the whole contract).

## D3 — No-clobber: trust the plan AND guard the write (`wx`)

**Decision:** two layers of no-clobber.
1. The plan: `planInit` already marks a present path `skip`; the effect writes only
   `plan.creates`. This is the primary guard and what makes the result honest.
2. The write: files are written with the exclusive flag —
   `writeFile(abs, contents, {flag: "wx"})` (`O_CREAT|O_EXCL`). If an EEXIST surfaces (a
   file appeared in the window between scan and write, or two concurrent applies race), the
   effect **catches it, leaves the existing file untouched, and reclassifies that entry
   create→skip** in the returned result. Any other fs error propagates (a real fault — the
   `captureNoteEffect`/`propose-effect` "a genuine fs failure throws" rule).

Dirs use `mkdir(abs, {recursive: true})`, which is **inherently idempotent and
non-clobbering** — creating an existing directory is a silent no-op, and `recursive` makes
ordering irrelevant.

**Why:** the AC ("a pre-seeded file is left byte-identical") and the epic's A5 idempotency
are absolute. The plan alone is correct for the snapshot it was built from; `wx` closes the
TOCTOU window so the guarantee holds even under a race or a file that materialized late —
no read-modify-write, no truncation, ever. Reclassifying EEXIST→skip keeps the result a
truthful record of what the filesystem now holds.

**Rejected:** `writeFile` with the default flag (`w`) gated only on the plan (truncates on a
late-arriving file — violates no-clobber under TOCTOU); read-then-write-if-different
(pointless — we never want to change an existing file at all, identical or not); throwing on
EEXIST (a present file is the *expected* idempotent case, not an error).

## D4 — Entry point & result shape

**Decision:** one primary export, a slim result type:

```ts
export interface InitApplyResult {
  readonly created: readonly string[];  // manifest-relative POSIX paths written
  readonly skipped: readonly string[];  // manifest-relative paths left untouched
}
export async function applyInitScaffold(
  projectRoot: string,
  manifest: readonly ScaffoldEntry[] = SCAFFOLD_MANIFEST,
): Promise<InitApplyResult>;
```

`created`/`skipped` are project-relative manifest paths (the same strings the plan carries),
not absolutes — legible, stable, and what the CLI will print as "created N / skipped M". The
`manifest` param defaults to `SCAFFOLD_MANIFEST` and is overridable so the test drives a
focused fixture manifest into a temp dir (the `planInit(existing, manifest)` precedent).

**Why a dedicated type, not `EffectResult`:** this is not a play (no cast loop consumes it),
so borrowing the engine's `EffectResult` (`ok/outcome/produced`) would import cast-loop
semantics that don't apply. A `{created, skipped}` pair is exactly the apply's outcome and
nothing more. (Contrast `proposeEpicEffect`, which *is* a play effect and rightly returns
`EffectResult`.)

**Rejected:** returning the raw `InitPlan` (leaks the pre-apply plan, which can diverge from
reality after an EEXIST reclassification); returning `void` (the test and the CLI both need
the created/skipped tallies to assert and to report).

## D5 — The `isLisaProject` gate stays out of the effect

**Decision:** `applyInitScaffold` does **not** check `isLisaProject`. It applies the
scaffold to whatever root it is handed. The refusal ("this is not a lisa project — run
`lisa init` first") is composed by the CLI ticket (T-040-03 `init-cli-command`):
`isLisaProject(scan) ? applyInitScaffold(root) : andon`.

**Why:** T-040-02's AC is purely apply / no-clobber / idempotency — it says nothing about
refusal. The lisa-detection gate is a *policy* decision with a user-facing fix-it hint,
which is the CLI's job (where arg-parse, exit codes, and stderr live). Keeping the effect a
pure-apply seam means the CLI composes two small, separately-tested pieces (`isLisaProject`
from core, `applyInitScaffold` from effect) rather than the effect owning a half-policy.
The core's design note ("the shell composes them") is satisfied by the *CLI* shell, the
natural place for it.

**Rejected:** baking the refusal into the effect (couples the apply to a policy + a
user-facing message; would force the temp-dir test to seed a `CLAUDE.md` just to exercise
the happy path, and would duplicate the gate the CLI must do anyway for its hint).

## D6 — Ordering & directory creation

**Decision:** iterate `plan.creates` in manifest order. For a `dir` entry → `mkdir(abs,
{recursive:true})`. For a `file` entry → `mkdir(dirname(abs), {recursive:true})` then the
`wx` write. The per-file parent `mkdir` makes the effect robust even if a file's parent dir
entry was (somehow) absent from the plan — recursive mkdir is cheap and idempotent.

**Why:** the manifest is already parent-before-child (the core left this as a courtesy), so
order is naturally safe; the per-file parent `mkdir` is defense-in-depth so the effect never
depends on a manifest invariant a future edit could break. `recursive:true` means a
re-create is always a no-op.

## What this design explicitly does NOT do

- No CLI parsing / `init` dispatch arm / exit codes — T-040-03.
- No `isLisaProject` refusal or fix-it hint — composed by the CLI (D5).
- No mutation of any lisa-owned file (root `.gitignore` etc.) — writes only manifest paths.
- No rich knowledge-stub content — deferred follow-up epic (PE-7); seeds come verbatim from
  the core's manifest.
- No change to `init-core.ts` — it is reused, not reopened.
