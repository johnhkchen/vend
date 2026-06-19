import { describe, expect, test } from "bun:test";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { classifyAuthorityViolations, importsWriter, stripComments } from "./authority-guard.ts";

// T-021-07 — the STATIC half of one-way authority. The pure classifier is exercised over fabricated
// sources (its judgment in isolation, incl. the presets.ts negative and the E-012 self-check), then
// the REAL src/present/*.ts files are read off disk and asserted clean — the build-failing scan.

describe("classifyAuthorityViolations — fabricated sources", () => {
  test("flags a module that writes against docs/active", () => {
    const src = [
      `import { writeFile } from "node:fs/promises";`,
      `export async function bad(root: string) {`,
      `  await writeFile(join(root, "docs/active/tickets/x.md"), "z");`,
      `}`,
    ].join("\n");
    const v = classifyAuthorityViolations([["bad.ts", src]]);
    expect(v).toHaveLength(1);
    expect(v[0]!.file).toBe("bad.ts");
    expect(v[0]!.primitive).toBe("writeFile");
  });

  test("does NOT flag presets.ts shape — a writer aimed at .vend, not the board", () => {
    const src = [
      `import { mkdir, writeFile } from "node:fs/promises";`,
      `const DIR = ".vend/presets";`,
      `export async function save(p: string) {`,
      `  await mkdir(DIR, { recursive: true });`,
      `  await writeFile(p, "x");`,
      `}`,
    ].join("\n");
    expect(classifyAuthorityViolations([["presets.ts", src]])).toEqual([]);
  });

  test("does NOT flag a pure module that names docs/active only in a comment", () => {
    const src = [
      `// grounded in docs/active/pm/linear-surface-prep.md §1a`,
      `import type { Foo } from "./x.ts";`,
      `export const f = (g: Foo) => g;`,
    ].join("\n");
    // both legs absent after stripping: no writer, and docs/active was comment-only.
    const code = stripComments(src);
    expect(code.includes("docs/active")).toBe(false);
    expect(classifyAuthorityViolations([["pure.ts", src]])).toEqual([]);
  });

  test("Bun.write is detected by call shape — flagged to the board, clean to .vend", () => {
    const toBoard = `export async function w() { await Bun.write("docs/active/x.md", "y"); }`;
    const toVend = `export async function w() { await Bun.write(".vend/x", "y"); }`;
    expect(classifyAuthorityViolations([["b.ts", toBoard]])[0]?.primitive).toBe("Bun.write");
    expect(classifyAuthorityViolations([["v.ts", toVend]])).toEqual([]);
  });

  test("a namespace-import write is caught by call shape", () => {
    const src = [
      `import * as fs from "node:fs/promises";`,
      `export const go = () => fs.mkdir("docs/active/tickets");`,
    ].join("\n");
    expect(classifyAuthorityViolations([["ns.ts", src]])[0]?.primitive).toBe("mkdir");
  });

  test("the guard's OWN source is not self-flagged (E-012 self-exemption, tested not assumed)", async () => {
    const own = await readFile(join(import.meta.dir, "authority-guard.ts"), "utf8");
    // it names WRITE_PRIMITIVES and PROTECTED_PATH as data, but imports/calls no writer.
    expect(importsWriter(stripComments(own))).toBeNull();
    expect(classifyAuthorityViolations([["authority-guard.ts", own]])).toEqual([]);
  });
});

describe("real-source scan — src/present/*.ts is clean", () => {
  test("no presentation module writes against docs/active", async () => {
    const dir = import.meta.dir;
    const names = (await readdir(dir)).filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts"));
    const entries: [string, string][] = [];
    for (const n of names) entries.push([n, await readFile(join(dir, n), "utf8")]);

    // not vacuous: the known modules must actually be in scope (a mis-globbed read can't pass empty).
    for (const known of ["project.ts", "translate.ts", "spec.ts", "presets.ts", "authority-guard.ts"]) {
      expect(names).toContain(known);
    }

    const violations = classifyAuthorityViolations(entries);
    expect(violations, `one-way-authority violations: ${JSON.stringify(violations)}`).toEqual([]);
  });
});
