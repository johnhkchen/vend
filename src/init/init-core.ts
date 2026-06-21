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
// demand — the board and the cleared archive start honestly empty.

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
