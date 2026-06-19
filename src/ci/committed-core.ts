// The `check:committed` PURE classifier (T-008-01) — the addon-free heart of the
// "done means committed" gate (E-008, the D-005 / D-010 fix).
//
// THE CENTRAL RULE (ci-strategy.md): check *logic* lives here in the app repo, behind a
// `bun run check:*` script; the trigger (the lisa on-stop hook, T-008-02) is a thin shell
// that only invokes it. This classifier IS that logic — the single source of "what counts
// as uncommitted source." It runs on the host, never in a Dagger container (a container
// cannot read the host working tree), which is exactly why E-008 is a lisa hook and not a
// /ci sub-class.
//
// PURE: every export takes a plain string and returns fresh values — no fs, clock, network,
// process, or git. The one IMPURE verb (run `git status --porcelain`, exit the process)
// lives in check-committed.ts. This keeps committed-core.test.ts an ordinary pure-function
// test, the same discipline press-core / gates / decompose-epic-core follow.
//
// HOUSE RULE (budget.ts / gates.ts): a malformed *call* is a programmer error (TS forbids a
// non-string at compile time under `strict`), so no runtime assert is added; an offending
// path is RETURNED data, never thrown. "Source is dirty" is an expected outcome, not an
// exception.

/**
 * The source prefixes whose uncommitted/untracked presence fails the gate — the R12 SHARED
 * CONTRACT. Every consumer (the entry below, the T-008-02 hook, any future CI sub-class)
 * derives scope from THIS export and never re-lists it. `baml_client/` is generated (gitignored)
 * and so is NOT here; `baml_src/` is the authored source and IS. Widening the contract later is
 * a one-line edit here.
 *
 * `.lisa/hooks/` is in scope (T-012-01, E-012): those shell scripts are the trigger that FIRES this
 * gate, so leaving them unpoliced would let the gate self-exempt its own source — the blind spot
 * E-012 closes. Scope is `.lisa/hooks/` ONLY, not `.lisa/`: other `.lisa/` paths (`signals/`, the
 * layout file) are legitimately-uncommitted runtime state and are gitignored, so they never appear
 * in porcelain and must not be flagged.
 */
export const SOURCE_PREFIXES = ["src/", "baml_src/", "ci/", ".lisa/hooks/"] as const;

/**
 * Extract the path field from ONE `git status --porcelain` v1 line. PURE/TOTAL.
 *
 * Porcelain v1 shape is `XY<space>PATH` (two status columns, a space, the path), so the path
 * begins at index 3. Two shapes are normalized:
 *  - a RENAME/COPY line is `R  old -> new` — the uncommitted artifact is the DESTINATION, so
 *    we take the right side of ` -> `.
 *  - a path with unusual bytes is C-quoted in surrounding double quotes — we strip one wrapping
 *    layer so the prefix match still fires (full C-unescaping is out of scope; over-flagging a
 *    weird path beats missing it).
 * Returns null for a blank or too-short line.
 */
export function parsePorcelainLine(line: string): string | null {
  if (line.length < 4) return null; // "XY P" is the shortest meaningful line
  let path = line.slice(3); // drop the two status columns + the separating space
  const arrow = path.indexOf(" -> ");
  if (arrow >= 0) path = path.slice(arrow + 4); // rename/copy → destination
  path = path.trim();
  if (path.length === 0) return null;
  if (path.length >= 2 && path.startsWith('"') && path.endsWith('"')) {
    path = path.slice(1, -1); // strip one layer of porcelain quoting
  }
  return path.length > 0 ? path : null;
}

/**
 * Classify full `git status --porcelain` text → the SORTED, DEDUPED list of offending paths
 * under {@link SOURCE_PREFIXES}. PURE/TOTAL. An EMPTY array is the verdict "clean" — there is no
 * separate boolean to desync. Gitignored runtime (`baml_client/`, `node_modules/`, `.vend/*`…)
 * never appears in porcelain in the first place (we never pass `--ignored`), so the classifier
 * only needs to KEEP source-prefixed paths, not maintain an ignore denylist.
 */
export function classifyPorcelain(porcelain: string): string[] {
  const offenders = new Set<string>();
  for (const line of porcelain.split("\n")) {
    const path = parsePorcelainLine(line);
    if (path === null) continue;
    if (SOURCE_PREFIXES.some((prefix) => path.startsWith(prefix))) offenders.add(path);
  }
  return [...offenders].sort();
}
