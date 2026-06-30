// The `vend init` scaffold's PURE core (T-040-01, story S-040-01, epic E-040) — the
// addon-free heart of idempotent scaffolding: the canonical manifest of dirs + seed
// files a vend scaffold layers onto a bare lisa project, a converge PLANNER that emits
// the create-vs-skip set for a given filesystem listing, and the lisa-project predicate.
//
// THE CENTRAL RULE (mirrors src/ci/committed-core.ts): the converge *logic* lives here,
// addon-free; the filesystem WRITE EFFECT (mkdir / write-if-absent / no-clobber) is the
// sibling ticket T-040-02 — a thin impure shell that APPLIES a plan this module produces.
// The CLI `init` dispatch arm is a later E-040 slice. Neither is in this file.
//
// PURE: every export takes plain values and returns plain values — no fs, clock, network,
// process, seam, or addon. So init-core.test.ts is an ordinary pure-function test, the
// same discipline committed-core / work-core / press-core follow. The first `node:fs`
// import in this package belongs to T-040-02, never here.
//
// ONE-WAY TO LISA (E-040): the manifest creates only VEND-OWNED paths. The `.vend/*`
// ignore lives in a vend-owned `.vend/.gitignore`, never by mutating the lisa project's
// root `.gitignore`. Empty-state rule (IA-3/IA-4): seed STRUCTURE + KNOWLEDGE, never
// demand — the board and the cleared archive start honestly empty. The E-061 STANDALONE
// templates (STANDALONE_TEMPLATES) relax only the lisa-project GATE (so a brew binary can
// scaffold an empty, no-checkout dir); they still write no lisa-owned file, so one-way-to-
// lisa is preserved.

/** One element of the scaffold: a directory, or a file with its seed contents. Paths are
 *  project-root-relative, POSIX, no leading `./`. The single shape both {@link planInit}
 *  and the T-040-02 write effect derive from — nobody re-lists the scaffold. */
export type ScaffoldEntry =
  | { readonly kind: "dir"; readonly path: string }
  | { readonly kind: "file"; readonly path: string; readonly contents: string };

/** One planned action over a manifest entry: create it (it was absent) or skip it (it
 *  was already present). The skip carries only path + kind — there is nothing to write. */
export type InitAction =
  | { readonly op: "create"; readonly entry: ScaffoldEntry }
  | { readonly op: "skip"; readonly path: string; readonly kind: "dir" | "file" };

/** A converge plan: one action per manifest entry (in manifest order), plus the `creates`
 *  subset the write effect materializes and the `skips` paths left untouched. `creates`
 *  empty ⇒ the project is already fully scaffolded (the idempotent re-run, A5). */
export type InitPlan = {
  readonly actions: readonly InitAction[];
  readonly creates: readonly ScaffoldEntry[];
  readonly skips: readonly string[];
};

/** The lisa-detection contract (E-040, PRD §7.2): a project is a lisa project iff it has
 *  ANY of these at its root. One widenable `as const` list — membership-checked, never
 *  re-listed (the SOURCE_PREFIXES discipline). Either marker suffices: a hand-rolled lisa
 *  project may ship only `CLAUDE.md`; a generated one, only `.lisa.toml`. */
export const LISA_MARKERS = ["CLAUDE.md", ".lisa.toml"] as const;

// ── Seed content (D6) — structure + knowledge, NEVER demand ────────────────────────────

/** The pull board — header + framing + an honest empty-state line. ZERO demand rows: no
 *  `vend chain "…"` pull line (IA-3/IA-4). The first move is a Survey/Steer cast off a seed. */
const EMPTY_BOARD = `# Vend — Demand (the pull board)

Thin demand **signals**, not epics — one line of "what + why it might matter." Epics are
**pulled** from here just-in-time when there's capacity; clearing (signal → epic →
stories/tickets) happens on pull, never ahead of demand. Cleared signals crystallize to
one line in \`docs/archive/demand-cleared.md\` and are deleted from here.

---

_No open demand yet — cast \`vend steer\` or \`vend survey\` off a seed to populate the
board (IA-3/IA-4). Vend never seeds fabricated demand._
`;

/** The cleared-demand archive — header + an honest empty-state line. ZERO demand rows: no
 *  `- **E-NN — …**` cleared-epic line yet. */
const EMPTY_ARCHIVE = `# Vend — Cleared demand (compacted ledger)

Signals pulled, cleared, and verified — moved off the live board (\`docs/active/demand.md\`)
to keep it lean. One line per epic: what it delivered. Full cards live in
\`docs/active/epic/\`; full proofs in \`docs/active/work/<ticket>/\`.

---

_Nothing cleared yet._
`;

/** The PM agent's upstream desk — a minimal stub. The PM proposes; the human pulls. */
const PM_README = `# PM workspace — the PM agent's desk

An **upstream** space where a PM agent surveys project state and stages a **proposed
batch** of demand. Drafts here are cheap and un-promoted: staging a candidate is not
pulling it. The PM writes ONLY here — never \`demand.md\`, \`epic/\`, \`stories/\`, or
\`tickets/\`; those change only when a play clears a promoted signal (pull-discipline).

Discovery vs. processing is gated by \`process-gate.md\`: discovery (gate down) surveys
freely; processing (\`ready: true\`) synthesizes the final batch, then lowers the gate.
`;

/** The discovery/processing control flag — defaults DOWN (discovery). */
const PROCESS_GATE = `---
ready: false
---

# Process gate

The human's "I'm ready for you to process this." While \`ready: false\` the PM agent
surveys freely and promotes nothing. Set \`ready: true\` to have it synthesize the final
ranked batch and recommend promotions (one-shot, then it lowers the gate).
`;

/** Knowledge stubs — minimal placeholders. Rich authored content is a deferred follow-up
 *  epic (PE-7 right-sizing); this scaffold only makes the structure present and valid. */
const CHARTER_STUB = `# Vend — Charter

_Stub — author your project's **value function** here: what is worth allocating on this
project and why, so cleared work is valuable, not merely valid. See \`vision.md\`._
`;

const VISION_STUB = `# Vend — Vision

_Stub — author the canonical statement of what this project is and why it exists. The
durable anchor planning references; keep it small and slow-changing._
`;

/** Vend-owned ignore: drop runtime telemetry, KEEP the durable decision log — the
 *  local-first (P5) intent the live root \`.gitignore\` expresses, localized here so init
 *  never mutates a lisa-owned file (one-way vend → lisa). */
const VEND_GITIGNORE = `*
!.gitignore
!decisions.jsonl
`;

/** The hackathon template's SEED — the ONE thing the user edits (brief piece B). A STUB this
 *  ticket: T-058-01 is the seam + a trivial registry; the rich example seed / tuned charter /
 *  shelf-note are T-058-02/03. Structure + knowledge, ZERO demand (honest-empty IA-3/IA-4) — never
 *  a `vend chain "…"` pull line, so the board the overlay layers onto still starts honestly empty. */
const HACKATHON_SEED_STUB = `# Seed — your one-line idea

_Replace this line with the one thing you're building (e.g. "A web app that helps solo
hackathon-goers find a team by skill + idea overlap"). The seed is the only input you author;
\`vend steer\` reads it to propose a ranked board and the real forks._
`;

/** The hackathon template's TUNED CHARTER — the demonstrable-slice value function (the 5 criteria
 *  + gates H1–H3) `vend steer`/`work`/`decompose` grade the seed against. Overlaid at
 *  `docs/knowledge/charter.md` (where {@link CHARTER_PATH} reads), OVERRIDING the generic
 *  {@link CHARTER_STUB} via {@link mergeManifests} BEFORE the disk is consulted (T-059-02, the intended-
 *  but-unbuilt T-058-03 enrichment). Byte-equal to the authored source
 *  `examples/templates/hackathon-seed/charter.md` — a drift test pins the equality. Knowledge, ZERO
 *  demand (honest-empty IA-3/IA-4); a vend-owned path (one-way-to-lisa). */
const HACKATHON_CHARTER = `# Charter — your hackathon project

The value function this project is judged on. It's small on purpose. \`vend steer\` and
\`vend work\` read this file as **steering context** — it tells the agents *what is worth
building in this session, and why* — so the work they clear is **valuable**, not merely
valid. Tune it to your hack; keep it to one page.

> This is the hackathon-tuned cousin of vend's own charter (\`docs/knowledge/charter.md\`).
> Same clearing move, different stakes.

---

## The clearing move

You authored one line of intent in \`SEED.md\`. The clearing move turns that line into the
**right slice** — right-sized, in the right order, worth doing *now* — instead of a pile of
half-finished ideas. The gates are the guarantee: nothing gets built that hasn't cleared.
At a hackathon the stakes are simple: **you want something you can show.**

---

## What makes work valuable here

A unit of work is worth allocating this session only if it is:

1. **Demo-advancing** — it moves a *runnable, deployable slice* forward. Work that advances
   nothing you can show is the worst waste — refuse it. (The opposite of polish for its own sake.)
2. **Grounded** — it answers to the app as it *actually is*. Go and see: the dev server is
   running, the page previews — build against what's there, not a someday architecture.
3. **Session-sized** — one sitting, one budget. If it can't finish and be shown before the
   clock runs out, it's too big — split it.
4. **In-bounds** — it doesn't break the green build or the deploy path. A broken demo is
   worth less than a smaller working one.
5. **Showable** — "done" can be *seen*: a rendered page, a passing check, a working
   interaction. If you can't point at it, it isn't done.

These five are the steering. An agent that internalizes them clears good hackathon work
without being told the answer.

**The one-line value:** *a demonstrable runnable slice over polish.*

---

## Light-but-real gates (invariants)

Kept deliberately light for a hack — but real, because a gate that isn't enforced is a lie.

- **H1 — The build stays green.** Every cleared slice leaves \`npm run build\` passing. A red
  build blocks the demo.
- **H2 — Every slice is showable.** It ships with something you can point at — a page, an
  interaction, a check that passes.
- **H3 — Budget is a hard contract.** \`vend work\` respects the time/tokens you fund it with,
  both ways. When the budget is spent, the session stops clean.

---

## Out of bounds for this session

The non-goals — tuned for a hack. These are *not* what "valuable" means here:

- **Polish maximalism** — pixel-perfect styling, animation, copy-editing before the slice runs.
- **Test-coverage completeness** — a smoke check that the slice works beats 100% coverage of
  a feature nobody's seen yet.
- **Infra perfection** — the deploy path is config + a green build; live Cloudflare hookup is
  the designer's push, not this session's blocker.

---

## Amendment rule

Capped at **one page**. To add a criterion or a gate, retire or merge another — pay the cost
deliberately. A charter that grows into a wiki has failed at its one job: being the small,
stable thing the agents steer by.
`;

/** The canonical scaffold: the dirs + seed files a vend scaffold layers onto a bare lisa
 *  project. Order is parent-before-child (creation-safe for a naive sequential write
 *  effect). Dirs that receive a seed file need no separate listing beyond their own entry.
 *  The single source of truth — {@link planInit} and the T-040-02 effect both derive from it. */
export const SCAFFOLD_MANIFEST: readonly ScaffoldEntry[] = [
  // Active board tree
  { kind: "dir", path: "docs/active" },
  { kind: "dir", path: "docs/active/epic" },
  { kind: "dir", path: "docs/active/stories" },
  { kind: "dir", path: "docs/active/tickets" },
  { kind: "dir", path: "docs/active/work" },
  { kind: "file", path: "docs/active/demand.md", contents: EMPTY_BOARD },
  // PM desk
  { kind: "dir", path: "docs/active/pm" },
  { kind: "dir", path: "docs/active/pm/staged" },
  { kind: "file", path: "docs/active/pm/README.md", contents: PM_README },
  { kind: "file", path: "docs/active/pm/process-gate.md", contents: PROCESS_GATE },
  // Archive
  { kind: "dir", path: "docs/archive" },
  { kind: "file", path: "docs/archive/demand-cleared.md", contents: EMPTY_ARCHIVE },
  // Knowledge stubs
  { kind: "dir", path: "docs/knowledge" },
  { kind: "file", path: "docs/knowledge/charter.md", contents: CHARTER_STUB },
  { kind: "file", path: "docs/knowledge/vision.md", contents: VISION_STUB },
  // Local-first runtime state (P5)
  { kind: "dir", path: ".vend" },
  { kind: "file", path: ".vend/.gitignore", contents: VEND_GITIGNORE },
];

// ── Template registry (E-058) — named overlays layered over the base scaffold ────────────

/** A named template's OVERLAY manifest — the vend-owned files `vend init --template <name>` layers
 *  over {@link SCAFFOLD_MANIFEST}. The `hackathon` overlay carries the SEED stub (T-058-01) PLUS the
 *  tuned {@link HACKATHON_CHARTER} override (T-059-02) — the latter wins over the base {@link CHARTER_STUB}
 *  at `docs/knowledge/charter.md` via {@link mergeManifests}, so `vend steer` grades the seed against the
 *  demonstrable-slice value function, not the generic stub. Adding a template is one entry. The single
 *  source of valid template names — the membership the CLI's clean refusal lists. Overlays name ONLY
 *  vend-owned paths (one-way-to-lisa) and add NO demand (honest-empty). */
export const TEMPLATE_REGISTRY: Readonly<Record<string, readonly ScaffoldEntry[]>> = {
  hackathon: [
    { kind: "file", path: "SEED.md", contents: HACKATHON_SEED_STUB },
    { kind: "file", path: "docs/knowledge/charter.md", contents: HACKATHON_CHARTER },
  ],
  // The minimal/placeholder template (E-061, T-064-01): an EMPTY overlay — it adds no files. The
  // base {@link SCAFFOLD_MANIFEST} already lays a complete, honest-empty, usable workspace; `minimal`
  // exists to mark the STANDALONE path (the lisa-project gate is bypassed for it — see
  // {@link STANDALONE_TEMPLATES}), so a brew-installed binary can `vend init --template minimal` into
  // an EMPTY dir with no checkout and no Doppler. Standalone-ness lives in the policy set below, NOT
  // in this overlay data — so the registry's value shape (and the invariant tests iterating it) stay
  // untouched, and one-way-to-lisa/honest-empty hold trivially (it names no path at all).
  minimal: [],
};

/** The templates that make a STANDALONE workspace (E-061, T-064-01): named with `vend init --template
 *  <name>`, they BYPASS the lisa-project gate so a brew-installed binary can lay a fresh workspace into
 *  an empty dir with no checkout. A NON-standalone overlay (e.g. `hackathon`) still requires an existing
 *  lisa project — it overlays onto one (one-way). Kept as a small policy SET beside the registry (gate
 *  policy, not overlay content) so the registry value shape stays a plain `ScaffoldEntry[]`. INVARIANT:
 *  every name here is also a {@link TEMPLATE_REGISTRY} key (a pure test pins it). */
export const STANDALONE_TEMPLATES: ReadonlySet<string> = new Set(["minimal"]);

/** Does this template make a standalone workspace (gate-bypassing)? PURE — membership in
 *  {@link STANDALONE_TEMPLATES}. An unknown name is not standalone (false). */
export function isStandaloneTemplate(name: string): boolean {
  return STANDALONE_TEMPLATES.has(name);
}

/** The available template names, sorted — the deterministic list a clean `unknown-template` refusal
 *  names (the `LISA_MARKERS` membership discipline; sorted so the message is stable). PURE. */
export function availableTemplates(): readonly string[] {
  return Object.keys(TEMPLATE_REGISTRY).sort();
}

/** Resolve a template name → its overlay manifest, or `undefined` for an unknown name (the effect
 *  maps that to a typed `unknown-template` andon + the {@link availableTemplates} hint). PURE. */
export function resolveTemplate(name: string): readonly ScaffoldEntry[] | undefined {
  return TEMPLATE_REGISTRY[name];
}

// ── Pure functions ─────────────────────────────────────────────────────────────────────

/** Drop a leading `./` and a single trailing `/` so a real `readdir` listing (which may
 *  yield `docs/active/` or `./.vend`) matches a manifest path. Internal — the one place
 *  the impure caller's path quirks die, so planInit/isLisaProject stay robust. */
function normalizePath(p: string): string {
  let out = p;
  if (out.startsWith("./")) out = out.slice(2);
  if (out.length > 1 && out.endsWith("/")) out = out.slice(0, -1);
  return out;
}

/** Is this a lisa project? True iff the listing contains ANY {@link LISA_MARKERS} entry.
 *  PURE. Kept separate from {@link planInit} (its own AC guarantee): the T-040-02 shell
 *  composes them — refuse if not a lisa project, else apply the plan. */
export function isLisaProject(existing: Iterable<string>): boolean {
  const set = new Set<string>();
  for (const p of existing) set.add(normalizePath(p));
  return LISA_MARKERS.some((m) => set.has(m));
}

/** The converge planner: given the paths that already exist, emit one action per manifest
 *  entry (present ⇒ skip, absent ⇒ create), plus the `creates`/`skips` projections. PURE,
 *  total, deterministic. Idempotency (A5) falls out directly — a fully-scaffolded listing
 *  yields zero creates; a bare one, all creates; a partial one, only the gap. The manifest
 *  defaults to {@link SCAFFOLD_MANIFEST}; tests pass a focused fixture manifest. */
export function planInit(
  existing: Iterable<string>,
  manifest: readonly ScaffoldEntry[] = SCAFFOLD_MANIFEST,
): InitPlan {
  const present = new Set<string>();
  for (const p of existing) present.add(normalizePath(p));

  const actions: InitAction[] = [];
  const creates: ScaffoldEntry[] = [];
  const skips: string[] = [];
  for (const entry of manifest) {
    const path = normalizePath(entry.path);
    if (present.has(path)) {
      actions.push({ op: "skip", path, kind: entry.kind });
      skips.push(path);
    } else {
      actions.push({ op: "create", entry });
      creates.push(entry);
    }
  }
  return { actions, creates, skips };
}

/** Merge an OVERLAY manifest over a BASE — the pure heart of `vend init --template` (E-058). An
 *  overlay entry OVERRIDES a base entry at the same (normalized) path: the base keeps its POSITION
 *  (so parent-before-child ordering stays creation-safe) but takes the overlay's kind + contents;
 *  overlay-only entries are appended in overlay order. PURE, deterministic. The merge is what lets a
 *  template's tuned file win over the base stub BEFORE the disk is consulted — no-clobber is then
 *  enforced against the real filesystem by {@link planInit} over this effective manifest, unchanged.
 *  (A naive apply-base-then-apply-overlay would instead let the base stub win and skip the override.) */
export function mergeManifests(
  base: readonly ScaffoldEntry[],
  overlay: readonly ScaffoldEntry[],
): ScaffoldEntry[] {
  const overlayByPath = new Map<string, ScaffoldEntry>();
  for (const e of overlay) overlayByPath.set(normalizePath(e.path), e);
  const seen = new Set<string>();
  const merged: ScaffoldEntry[] = [];
  for (const e of base) {
    const p = normalizePath(e.path);
    merged.push(overlayByPath.get(p) ?? e); // overlay overrides in the base slot
    seen.add(p);
  }
  for (const e of overlay) {
    const p = normalizePath(e.path);
    if (!seen.has(p)) {
      merged.push(e); // overlay-only — appended in overlay order
      seen.add(p);
    }
  }
  return merged;
}

/** The template converge planner (E-058): merge base + overlay, then converge against `existing` —
 *  so the overlay's content lands (override) while no-clobber + idempotency hold (it is
 *  {@link planInit} over the effective {@link mergeManifests} result). PURE, total, deterministic.
 *  `vend init --template` reaches the IDENTICAL plan via `applyInitScaffold(root,
 *  mergeManifests(base, overlay))` — one writer; this is the named pure unit the AC pins. */
export function planTemplate(
  existing: Iterable<string>,
  base: readonly ScaffoldEntry[],
  overlay: readonly ScaffoldEntry[],
): InitPlan {
  return planInit(existing, mergeManifests(base, overlay));
}

/** Count the demand rows in board/archive text — the "honestly empty" measure (D5). Counts
 *  the two STRUCTURAL demand-row shapes: a live-board pull line (`vend chain "…"`) and a
 *  cleared-archive epic row (`- **E-NN …`). Anchored on structure, not prose, so the
 *  empty-state gloss (which uses ordinary bullets) never false-positives. PURE. Seeds must
 *  return 0; a populated board returns ≥1. Reusable on a LIVE board by the write effect /
 *  a later `vend doctor`. */
export function countDemandRows(contents: string): number {
  const pulls = contents.match(/^vend chain "/gm)?.length ?? 0;
  const cleared = contents.match(/^- \*\*E-\d/gm)?.length ?? 0;
  return pulls + cleared;
}
