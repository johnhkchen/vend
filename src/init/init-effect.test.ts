import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { countDemandRows, resolveTemplate, SCAFFOLD_MANIFEST, type ScaffoldEntry } from "./init-core.ts";
import { applyInitScaffold, runInit } from "./init-effect.ts";

// T-040-02: the guarded-live proof for the scaffold WRITE EFFECT — an ordinary `bun test`
// against a REAL temp-dir projectRoot (the propose-effect.test.ts / expand-effect.test.ts
// discipline). No mocks: real mkdtemp / mkdir / writeFile, asserted with real stat /
// readFile, torn down in `finally`. The AC, clause by clause:
//   (1) a bare lisa project → applying the effect creates the full tree;
//   (2) a pre-seeded file is left byte-identical (no clobber);
//   (3) a second apply adds no files and changes none (idempotent A5).

/** A throwaway projectRoot seeded as a BARE lisa project — a root `CLAUDE.md` and nothing
 *  vend-owned yet (the LISA_MARKERS detection the CLI will gate on; here it just frames the
 *  dir honestly, per the AC). The effect itself does not require it. */
async function seedBareLisa(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "vend-init-"));
  await writeFile(join(root, "CLAUDE.md"), "# bare lisa project\n", "utf8");
  return root;
}

async function exists(abs: string): Promise<boolean> {
  try {
    await stat(abs);
    return true;
  } catch {
    return false;
  }
}

describe("applyInitScaffold — a bare lisa project gets the full tree", () => {
  test("every manifest path is created, with seed contents verbatim and an honestly-empty board", async () => {
    const root = await seedBareLisa();
    try {
      const res = await applyInitScaffold(root);

      // (1) the full tree exists — every dir and file from the manifest.
      for (const entry of SCAFFOLD_MANIFEST) {
        expect(await exists(join(root, entry.path))).toBe(true);
      }
      // file seeds landed byte-for-byte.
      for (const entry of SCAFFOLD_MANIFEST) {
        if (entry.kind === "file") {
          expect(await readFile(join(root, entry.path), "utf8")).toBe(entry.contents);
        }
      }
      // the board + archive are honestly empty (zero demand rows).
      expect(countDemandRows(await readFile(join(root, "docs/active/demand.md"), "utf8"))).toBe(0);
      expect(
        countDemandRows(await readFile(join(root, "docs/archive/demand-cleared.md"), "utf8")),
      ).toBe(0);

      // the result is a truthful tally: all created, nothing skipped on a bare root.
      expect(res.created.length).toBe(SCAFFOLD_MANIFEST.length);
      expect(res.skipped).toEqual([]);

      // one-way to lisa: the pre-existing CLAUDE.md is untouched (we wrote only vend paths).
      expect(await readFile(join(root, "CLAUDE.md"), "utf8")).toBe("# bare lisa project\n");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("applyInitScaffold — no clobber", () => {
  test("a pre-seeded manifest file is left byte-identical and reported skipped", async () => {
    const root = await seedBareLisa();
    const sentinelPath = "docs/knowledge/vision.md";
    const sentinel = "PRE-EXISTING — do not touch\n";
    try {
      // pre-seed a sentinel at a manifest file path (parent dir first).
      await mkdir(join(root, dirname(sentinelPath)), { recursive: true });
      await writeFile(join(root, sentinelPath), sentinel, "utf8");

      const res = await applyInitScaffold(root);

      // (2) the kept file is byte-identical — NOT overwritten with the stub seed.
      expect(await readFile(join(root, sentinelPath), "utf8")).toBe(sentinel);
      expect(res.skipped).toContain(sentinelPath);
      expect(res.created).not.toContain(sentinelPath);

      // the gap around it was still filled — a sibling file got its seed.
      const charter = SCAFFOLD_MANIFEST.find(
        (e): e is Extract<ScaffoldEntry, { kind: "file" }> =>
          e.kind === "file" && e.path === "docs/knowledge/charter.md",
      );
      expect(charter).toBeDefined();
      expect(await readFile(join(root, "docs/knowledge/charter.md"), "utf8")).toBe(
        charter!.contents,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("applyInitScaffold — idempotent second apply", () => {
  test("a second apply adds no files and changes none", async () => {
    const root = await seedBareLisa();
    try {
      await applyInitScaffold(root);

      // snapshot every manifest file's contents after the first apply.
      const snapshot = new Map<string, string>();
      for (const entry of SCAFFOLD_MANIFEST) {
        if (entry.kind === "file") {
          snapshot.set(entry.path, await readFile(join(root, entry.path), "utf8"));
        }
      }

      const res2 = await applyInitScaffold(root);

      // (3) the second apply creates nothing and skips everything.
      expect(res2.created).toEqual([]);
      expect(res2.skipped.length).toBe(SCAFFOLD_MANIFEST.length);

      // every file is byte-identical to the post-first-apply snapshot — changed none.
      for (const [path, before] of snapshot) {
        expect(await readFile(join(root, path), "utf8")).toBe(before);
      }
      // and nothing went missing.
      for (const entry of SCAFFOLD_MANIFEST) {
        expect(await exists(join(root, entry.path))).toBe(true);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

// T-040-03: the refuse-or-apply composition the CLI `vend init` arm calls. Guarded-live, same
// temp-dir discipline as the apply tests: detection gates on the project root's top-level markers,
// a `not-lisa` refusal writes NOTHING, and a lisa root scaffolds (idempotently on a second run).
describe("runInit — refuse-or-apply composition", () => {
  test("a non-lisa root is refused as a typed andon and writes nothing", async () => {
    const root = await mkdtemp(join(tmpdir(), "vend-init-nolisa-"));
    try {
      const outcome = await runInit(root);
      expect(outcome).toEqual({ kind: "not-lisa", root });
      // the refusal is inert — no manifest path materialized.
      for (const entry of SCAFFOLD_MANIFEST) {
        expect(await exists(join(root, entry.path))).toBe(false);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("a bare lisa root (CLAUDE.md) scaffolds the full tree with a truthful tally", async () => {
    const root = await seedBareLisa();
    try {
      const outcome = await runInit(root);
      expect(outcome.kind).toBe("scaffolded");
      if (outcome.kind !== "scaffolded") throw new Error("unreachable");
      expect(outcome.result.created.length).toBe(SCAFFOLD_MANIFEST.length);
      expect(outcome.result.skipped).toEqual([]);
      for (const entry of SCAFFOLD_MANIFEST) {
        expect(await exists(join(root, entry.path))).toBe(true);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("a second runInit is idempotent — scaffolded, zero created, all skipped", async () => {
    const root = await seedBareLisa();
    try {
      await runInit(root);
      const outcome = await runInit(root);
      expect(outcome.kind).toBe("scaffolded");
      if (outcome.kind !== "scaffolded") throw new Error("unreachable");
      expect(outcome.result.created).toEqual([]);
      expect(outcome.result.skipped.length).toBe(SCAFFOLD_MANIFEST.length);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("either marker suffices — a root with only .lisa.toml is detected as lisa", async () => {
    const root = await mkdtemp(join(tmpdir(), "vend-init-toml-"));
    try {
      await writeFile(join(root, ".lisa.toml"), "# generated lisa project\n", "utf8");
      const outcome = await runInit(root);
      expect(outcome.kind).toBe("scaffolded");
      expect(await exists(join(root, "docs/active/demand.md"))).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("applyInitScaffold — focused fixture manifest (the create/skip partition in isolation)", () => {
  const FIXTURE: readonly ScaffoldEntry[] = [
    { kind: "dir", path: "x" },
    { kind: "file", path: "x/a.md", contents: "A\n" },
  ];

  test("a bare root → both created; a pre-seeded file → skipped + byte-identical", async () => {
    const root = await mkdtemp(join(tmpdir(), "vend-init-fix-"));
    try {
      const first = await applyInitScaffold(root, FIXTURE);
      expect(first.created).toEqual(["x", "x/a.md"]);
      expect(first.skipped).toEqual([]);
      expect(await readFile(join(root, "x/a.md"), "utf8")).toBe("A\n");

      // mutate the file, then re-apply the fixture: it must be left exactly as the user left it.
      await writeFile(join(root, "x/a.md"), "USER EDIT\n", "utf8");
      const second = await applyInitScaffold(root, FIXTURE);
      expect(second.created).toEqual([]);
      expect(second.skipped).toEqual(["x", "x/a.md"]);
      expect(await readFile(join(root, "x/a.md"), "utf8")).toBe("USER EDIT\n");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

// T-058-01: the template overlay seam through `runInit(root, template)`. Same guarded-live temp-dir
// discipline. The AC, clause by clause: a known template applies base+overlay idempotently and
// no-clobber; an unknown template is a clean refusal that writes NOTHING; honest-empty + the lisa
// gate hold with a template in play; bare `runInit` is unchanged (the E-040 path).
describe("runInit — template overlay (T-058-01)", () => {
  test("a known template applies the base tree PLUS the overlay's SEED.md, board honest-empty", async () => {
    const root = await seedBareLisa();
    try {
      const outcome = await runInit(root, "hackathon");
      expect(outcome.kind).toBe("scaffolded");
      if (outcome.kind !== "scaffolded") throw new Error("unreachable");

      // the base tree is present...
      for (const entry of SCAFFOLD_MANIFEST) {
        expect(await exists(join(root, entry.path))).toBe(true);
      }
      // ...and the overlay's file landed and is reported created.
      expect(await exists(join(root, "SEED.md"))).toBe(true);
      expect(outcome.result.created).toContain("SEED.md");
      expect((await readFile(join(root, "SEED.md"), "utf8")).length).toBeGreaterThan(0);

      // honest-empty held: the board the overlay layered onto carries zero demand rows.
      expect(countDemandRows(await readFile(join(root, "docs/active/demand.md"), "utf8"))).toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("a second template run is idempotent — zero created, the overlay file among the skips", async () => {
    const root = await seedBareLisa();
    try {
      await runInit(root, "hackathon");
      const outcome = await runInit(root, "hackathon");
      expect(outcome.kind).toBe("scaffolded");
      if (outcome.kind !== "scaffolded") throw new Error("unreachable");
      expect(outcome.result.created).toEqual([]);
      expect(outcome.result.skipped).toContain("SEED.md");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("a user-edited overlay file is left byte-identical (no clobber)", async () => {
    const root = await seedBareLisa();
    const edited = "MY OWN ONE-LINE IDEA\n";
    try {
      await runInit(root, "hackathon");
      await writeFile(join(root, "SEED.md"), edited, "utf8");
      const outcome = await runInit(root, "hackathon");
      expect(outcome.kind).toBe("scaffolded");
      // the edit survives — the overlay never overwrites an existing file.
      expect(await readFile(join(root, "SEED.md"), "utf8")).toBe(edited);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("an unknown template is a clean refusal naming the available set — and writes NOTHING", async () => {
    const root = await seedBareLisa();
    try {
      const outcome = await runInit(root, "bogus");
      expect(outcome).toEqual({ kind: "unknown-template", name: "bogus", available: ["hackathon"] });
      // the refusal is inert: neither the base tree nor any overlay file materialized.
      for (const entry of SCAFFOLD_MANIFEST) {
        expect(await exists(join(root, entry.path))).toBe(false);
      }
      expect(await exists(join(root, "SEED.md"))).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("the lisa gate precedes template resolution — a non-lisa root refuses as not-lisa", async () => {
    const root = await mkdtemp(join(tmpdir(), "vend-init-tmpl-nolisa-"));
    try {
      const outcome = await runInit(root, "hackathon");
      expect(outcome).toEqual({ kind: "not-lisa", root });
      expect(await exists(join(root, "SEED.md"))).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("bare runInit (no template) is unchanged — base tree only, no SEED.md", async () => {
    const root = await seedBareLisa();
    try {
      const outcome = await runInit(root);
      expect(outcome.kind).toBe("scaffolded");
      expect(await exists(join(root, "SEED.md"))).toBe(false);
      expect(await exists(join(root, "docs/active/demand.md"))).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

// T-059-02: the tuned-charter override through `runInit(root, "hackathon")`. Same guarded-live temp-dir
// discipline. The charter rides the SAME write-if-absent / no-clobber path SEED.md does, so these pins
// confirm the EFFECT (the pure override is pinned in init-core.test.ts): the template writes the tuned
// charter where steer reads it; bare init still writes the generic stub there; idempotent + no-clobber
// hold; and the inlined `HACKATHON_CHARTER` stays byte-equal to its authored source (the drift guard).
describe("runInit — tuned charter overlay (T-059-02)", () => {
  const CHARTER = "docs/knowledge/charter.md";
  /** The overlay's tuned charter contents — the bytes the template must land at CHARTER. */
  const tunedCharter = resolveTemplate("hackathon")?.find(
    (e): e is Extract<ScaffoldEntry, { kind: "file" }> => e.kind === "file" && e.path === CHARTER,
  )?.contents;
  /** The base scaffold's generic stub — what bare `vend init` must still write there (E-040 parity). */
  const stubCharter = SCAFFOLD_MANIFEST.find(
    (e): e is Extract<ScaffoldEntry, { kind: "file" }> => e.kind === "file" && e.path === CHARTER,
  )?.contents;

  test("the overlay + base both expose a charter entry (guards the consts these tests assert on)", () => {
    expect(tunedCharter).toBeDefined();
    expect(stubCharter).toBeDefined();
  });

  test("`--template hackathon` writes the TUNED charter to docs/knowledge/charter.md (not the stub)", async () => {
    const root = await seedBareLisa();
    try {
      const outcome = await runInit(root, "hackathon");
      expect(outcome.kind).toBe("scaffolded");
      if (outcome.kind !== "scaffolded") throw new Error("unreachable");
      const written = await readFile(join(root, CHARTER), "utf8");
      expect(written).toBe(tunedCharter!);
      expect(written).not.toBe(stubCharter!);
      expect(outcome.result.created).toContain(CHARTER);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("bare runInit still writes the GENERIC stub there (bare `vend init` byte-identical to E-040)", async () => {
    const root = await seedBareLisa();
    try {
      await runInit(root);
      expect(await readFile(join(root, CHARTER), "utf8")).toBe(stubCharter!);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("a second template run is idempotent — the charter among the skips, content unchanged", async () => {
    const root = await seedBareLisa();
    try {
      await runInit(root, "hackathon");
      const outcome = await runInit(root, "hackathon");
      expect(outcome.kind).toBe("scaffolded");
      if (outcome.kind !== "scaffolded") throw new Error("unreachable");
      expect(outcome.result.created).toEqual([]);
      expect(outcome.result.skipped).toContain(CHARTER);
      expect(await readFile(join(root, CHARTER), "utf8")).toBe(tunedCharter!);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("a user-edited charter is left byte-identical (no clobber — never overwrites a tuned charter)", async () => {
    const root = await seedBareLisa();
    const edited = "# MY OWN VALUE FUNCTION\n\nGrade against this, not the template.\n";
    try {
      await mkdir(join(root, "docs/knowledge"), { recursive: true });
      await writeFile(join(root, CHARTER), edited, "utf8");
      const outcome = await runInit(root, "hackathon");
      expect(outcome.kind).toBe("scaffolded");
      // the edit survives — the overlay never overwrites an existing charter.
      expect(await readFile(join(root, CHARTER), "utf8")).toBe(edited);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("drift guard — the inlined HACKATHON_CHARTER is byte-equal to its authored source", async () => {
    // The overlay constant is a hand-shipped mirror of the example seed's charter; this keeps them in
    // sync. If the example file is edited (or removed), this fails loudly — the correct signal.
    const seedCharter = await readFile("examples/templates/hackathon-seed/charter.md", "utf8");
    expect(tunedCharter!).toBe(seedCharter);
  });
});
