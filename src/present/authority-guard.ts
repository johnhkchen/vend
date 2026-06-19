// The STATIC half of E-021's one-way-authority guarantee (T-021-07, story S-021-03). The pure
// classifier behind the build-time gate: scan presentation-module SOURCE and flag any module that
// would WRITE against the canonical board (docs/active). The runtime half — proving the bytes on
// disk are actually untouched after load→project→render — lives in one-way-authority.test.ts; this
// file is the source-level companion, so a writer added to the present layer fails the build BEFORE
// it can ever run (defense in depth, the model.ts `readonly`+`deepFreeze` posture).
//
// PURE / TOTAL (the budget.ts rule, cf. committed-core.ts): every export takes plain strings and
// returns fresh data — no fs, clock, network, process, or throw. A "violation" is RETURNED data,
// never an exception; an empty result IS the verdict "clean" (no separate boolean to desync). The
// IMPURE half — read the present sources off disk and assert the result is empty — lives in the
// test, exactly as classifyPorcelain's git read lives in check-committed.ts.
//
// THE TWO FALSE-POSITIVE TRAPS this is built to avoid (research.md):
//   1. presets.ts legitimately imports writeFile/mkdir — but writes the SPEC STORE (.vend/presets),
//      never docs/active. So "imports a writer" alone is NOT the offense; the target must be the
//      board. We require BOTH a writer AND a `docs/active` reference IN CODE.
//   2. every present module names `docs/active/...` in its HEADER COMMENTS (provenance pointers). So
//      the path scan runs on COMMENT-STRIPPED code only.
//
// THE E-012 SELF-EXEMPTION TRAP, made structural: this module necessarily NAMES the forbidden
// primitives (the WRITE_PRIMITIVES array) and the protected path (PROTECTED_PATH). Detection is
// therefore IMPORT/CALL-shaped — a bare mention as string DATA is not a writer — so this guard
// PASSES ITS OWN SCAN by construction and needs no self-exclusion (a unit test pins that).

/**
 * The `node:fs` / `node:fs/promises` mutation surface a presentation module must not aim at the
 * board — the R12 shared contract (cf. committed-core's SOURCE_PREFIXES). Every consumer derives
 * the write-primitive set from THIS const and never re-lists it. `createWriteStream` is included so
 * a streamed write is caught; `Bun.write(` is detected separately (it is a global, not an import).
 */
export const WRITE_PRIMITIVES: readonly string[] = Object.freeze([
  "writeFile", "appendFile", "mkdir", "rm", "rmdir", "unlink", "rename", "copyFile", "cp",
  "truncate", "createWriteStream",
  "writeFileSync", "appendFileSync", "mkdirSync", "rmSync", "rmdirSync", "unlinkSync",
  "renameSync", "copyFileSync", "truncateSync",
]);

/** The canonical-board path no presentation module may write to. Single source of the token. */
export const PROTECTED_PATH = "docs/active";

/** One offending module: which file, which write primitive, and a human reason for the andon. */
export interface Violation {
  readonly file: string;
  readonly primitive: string;
  readonly reason: string;
}

/**
 * Strip `// line` and `/* block *​/` comments so the later scans see CODE only. PURE. This is the
 * single defense against the "docs/active appears in a header comment" false positive. Pragmatic
 * (not a full tokenizer): the `[^:]` guard spares `://` so a URL is not mis-cut. Over-stripping
 * would only risk a false NEGATIVE on `docs/active`, which the runtime byte-hash gate still catches.
 */
export function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/([^:]|^)\/\/[^\n]*/g, "$1");
}

/** The named specifiers of every `import { … } from "node:fs"|"node:fs/promises"|"fs"|…` in CODE.
 *  Takes the imported binding (left of `as`). PURE. */
export function importedFsNames(code: string): string[] {
  const names: string[] = [];
  const re = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["'](?:node:)?fs(?:\/promises)?["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    for (const part of m[1]!.split(",")) {
      const name = part.trim().split(/\s+as\s+/)[0]!.trim();
      if (name) names.push(name);
    }
  }
  return names;
}

/**
 * The first write CAPABILITY the code carries, or `null`. PURE. Import/call-shaped on purpose:
 *  - a `node:fs*` named import of a {@link WRITE_PRIMITIVES} member (the presets.ts shape), or
 *  - a CALL `primitive(` (covers a namespace import `fs.writeFile(`), or
 *  - a `Bun.write(` call.
 * A primitive named only as string DATA (this module's own array) is NOT a writer — which is why
 * this guard passes its own scan.
 */
export function importsWriter(code: string): string | null {
  const set = new Set(WRITE_PRIMITIVES);
  for (const name of importedFsNames(code)) {
    if (set.has(name)) return name;
  }
  for (const p of WRITE_PRIMITIVES) {
    if (new RegExp(`\\b${p}\\s*\\(`).test(code)) return p;
  }
  if (/\bBun\.write\s*\(/.test(code)) return "Bun.write";
  return null;
}

/** Whether CODE (already comment-stripped) names the protected board path. PURE. */
export function referencesProtectedPath(code: string): boolean {
  return code.includes(PROTECTED_PATH);
}

/**
 * Classify a set of `[file, source]` modules → the SORTED list of one-way-authority violations.
 * PURE/TOTAL. A module offends iff its comment-stripped code BOTH carries a write capability AND
 * references {@link PROTECTED_PATH}. An EMPTY array is the verdict "clean" — there is no separate
 * boolean. The conjunction is what keeps presets.ts (writes `.vend`, never the board) clean while
 * still failing a real write at docs/active.
 */
export function classifyAuthorityViolations(
  sources: Iterable<readonly [string, string]>,
): Violation[] {
  const out: Violation[] = [];
  for (const [file, src] of sources) {
    const code = stripComments(src);
    const primitive = importsWriter(code);
    if (primitive !== null && referencesProtectedPath(code)) {
      out.push({ file, primitive, reason: `writes via ${primitive} against ${PROTECTED_PATH}` });
    }
  }
  return out.sort((a, b) => a.file.localeCompare(b.file));
}
