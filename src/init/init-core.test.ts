import { describe, expect, test } from "bun:test";
import { matchIds } from "../gate/gates.ts";
import {
  availableTemplates,
  countDemandRows,
  isLisaProject,
  isStandaloneTemplate,
  LISA_MARKERS,
  mergeManifests,
  planInit,
  planTemplate,
  resolveTemplate,
  SCAFFOLD_MANIFEST,
  STANDALONE_TEMPLATES,
  TEMPLATE_REGISTRY,
  type ScaffoldEntry,
} from "./init-core.ts";

// T-040-01 init-core: the PURE scaffold manifest + converge planner + lisa predicate.
// Imports ONLY ./init-core.ts — no fs, no process, no BAML addon — so this is an ordinary
// pure-function test, the same discipline committed-core / work-core follow. The fs write
// effect and its guarded-live temp-dir test are T-040-02; nothing here touches disk.

/** Every path the full manifest will create — a "fully scaffolded" filesystem listing. */
const ALL_PATHS = SCAFFOLD_MANIFEST.map((e) => e.path);

/** The exact generic charter bytes a bare `vend init` plans and writes. */
const baseCharter = SCAFFOLD_MANIFEST.find(
  (e): e is Extract<ScaffoldEntry, { kind: "file" }> =>
    e.kind === "file" && e.path === "docs/knowledge/charter.md",
);

describe("planInit — create-vs-skip set (AC clause 1)", () => {
  test("empty listing → full scaffold (every entry creates)", () => {
    const plan = planInit([]);
    expect(plan.creates.length).toBe(SCAFFOLD_MANIFEST.length);
    expect(plan.skips.length).toBe(0);
    expect(plan.actions.every((a) => a.op === "create")).toBe(true);
    // one action per manifest entry, in manifest order
    expect(plan.actions.length).toBe(SCAFFOLD_MANIFEST.length);
  });

  test("fully-scaffolded listing → zero creates (idempotent re-run)", () => {
    const plan = planInit(ALL_PATHS);
    expect(plan.creates.length).toBe(0);
    expect(plan.skips.length).toBe(SCAFFOLD_MANIFEST.length);
    expect(plan.actions.every((a) => a.op === "skip")).toBe(true);
    // a second plan over the same listing is identical — converge is stable
    expect(planInit(ALL_PATHS)).toEqual(plan);
  });

  test("partial listing → only the gap creates", () => {
    // a bare lisa project: markers + the top docs dirs exist, the rest does not
    const present = ["CLAUDE.md", ".lisa.toml", "docs/active", "docs/active/epic"];
    const plan = planInit(present);
    const createdPaths = plan.creates.map((e) => e.path);
    // present structural dirs are skipped...
    expect(plan.skips).toContain("docs/active");
    expect(plan.skips).toContain("docs/active/epic");
    expect(createdPaths).not.toContain("docs/active");
    // ...and absent entries are created
    expect(createdPaths).toContain("docs/active/demand.md");
    expect(createdPaths).toContain(".vend/.gitignore");
    expect(createdPaths).toContain("docs/archive/demand-cleared.md");
    // exactly the gap: creates + skips partition the manifest, no overlap, no loss
    expect(plan.creates.length + plan.skips.length).toBe(SCAFFOLD_MANIFEST.length);
    expect(plan.creates.length).toBe(SCAFFOLD_MANIFEST.length - 2);
  });

  test("trailing-slash / './' listing still matches the manifest (normalization)", () => {
    const present = ["docs/active/", "./.vend", "docs/archive/"];
    const plan = planInit(present);
    expect(plan.skips).toContain("docs/active");
    expect(plan.skips).toContain(".vend");
    expect(plan.skips).toContain("docs/archive");
    expect(plan.creates.map((e) => e.path)).not.toContain(".vend");
  });

  test("focused fixture manifest proves the create/skip partition", () => {
    const fixture: readonly ScaffoldEntry[] = [
      { kind: "dir", path: "a" },
      { kind: "file", path: "a/seed.md", contents: "hi" },
    ];
    const plan = planInit(["a"], fixture);
    expect(plan.skips).toEqual(["a"]);
    expect(plan.creates).toEqual([{ kind: "file", path: "a/seed.md", contents: "hi" }]);
  });
});

describe("isLisaProject (AC clause 2)", () => {
  test("CLAUDE.md present → true", () => {
    expect(isLisaProject(["CLAUDE.md", "README.md"])).toBe(true);
  });
  test(".lisa.toml present → true", () => {
    expect(isLisaProject([".lisa.toml", "src"])).toBe(true);
  });
  test("both markers present → true", () => {
    expect(isLisaProject(["CLAUDE.md", ".lisa.toml"])).toBe(true);
  });
  test("neither marker → false", () => {
    expect(isLisaProject(["README.md", "package.json", "src"])).toBe(false);
  });
  test("empty listing → false", () => {
    expect(isLisaProject([])).toBe(false);
  });
  test("normalized markers still detected (./CLAUDE.md)", () => {
    expect(isLisaProject(["./CLAUDE.md"])).toBe(true);
  });
  test("LISA_MARKERS is the documented contract", () => {
    expect([...LISA_MARKERS]).toEqual(["CLAUDE.md", ".lisa.toml"]);
  });
});

describe("zero demand rows (AC clause 3)", () => {
  const board = SCAFFOLD_MANIFEST.find((e) => e.path === "docs/active/demand.md");
  const archive = SCAFFOLD_MANIFEST.find((e) => e.path === "docs/archive/demand-cleared.md");

  test("the manifest seeds both the board and the cleared archive", () => {
    expect(board?.kind).toBe("file");
    expect(archive?.kind).toBe("file");
  });

  test("board seed carries zero demand rows", () => {
    expect(board && board.kind === "file" ? countDemandRows(board.contents) : -1).toBe(0);
  });

  test("cleared-archive seed carries zero demand rows", () => {
    expect(archive && archive.kind === "file" ? countDemandRows(archive.contents) : -1).toBe(0);
  });

  test("positive control — countDemandRows actually fires (so the zero is meaningful)", () => {
    const populated = 'vend chain "do the thing"\n- **E-001 — delivered the thing**\n';
    expect(countDemandRows(populated)).toBe(2);
  });

  test("empty-state prose bullets do not false-positive", () => {
    // ordinary list bullets that are NOT cleared-epic rows must count as zero
    expect(countDemandRows("- a point\n- another point\n")).toBe(0);
  });
});

describe("base charter teaches the P-label convention (T-078-02-03)", () => {
  test("the shared gate detector resolves the scaffold's labeled invariants", () => {
    expect(baseCharter).toBeDefined();
    expect([...matchIds(baseCharter!.contents, "P")]).toEqual(["P1", "P2", "P3"]);
  });

  test("the scaffold pins the one-line note that casts cite the labels", () => {
    expect(baseCharter).toBeDefined();
    expect(baseCharter!.contents).toContain(
      "<!-- Casts cite these labels in `advances`; keep each P-label stable once referenced. -->",
    );
  });
});

describe("manifest sanity", () => {
  test("paths are unique", () => {
    const paths = SCAFFOLD_MANIFEST.map((e) => e.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  test("every file entry has contents; no leading './'", () => {
    for (const e of SCAFFOLD_MANIFEST) {
      expect(e.path.startsWith("./")).toBe(false);
      if (e.kind === "file") expect(typeof e.contents).toBe("string");
    }
  });

  test("parent dirs precede their children (creation-safe order)", () => {
    const seen = new Set<string>();
    for (const e of SCAFFOLD_MANIFEST) {
      const slash = e.path.lastIndexOf("/");
      if (slash > 0) {
        const parent = e.path.slice(0, slash);
        // the parent must be a dir entry already seen, OR not be a manifest dir at all
        const parentIsManifestDir = SCAFFOLD_MANIFEST.some((x) => x.kind === "dir" && x.path === parent);
        if (parentIsManifestDir) expect(seen.has(parent)).toBe(true);
      }
      seen.add(e.path);
    }
  });
});

// ── T-058-01: the template overlay seam (pure half) ───────────────────────────────────────

// A focused base + overlay fixture: the overlay (1) OVERRIDES a same-path base file (`a.md`) and
// (2) adds an overlay-only file (`seed.md`). Exercises both merge behaviors in isolation.
const BASE_FIX: readonly ScaffoldEntry[] = [
  { kind: "dir", path: "x" },
  { kind: "file", path: "x/a.md", contents: "BASE A\n" },
  { kind: "file", path: "x/b.md", contents: "BASE B\n" },
];
const OVERLAY_FIX: readonly ScaffoldEntry[] = [
  { kind: "file", path: "x/a.md", contents: "OVERLAY A\n" }, // overrides base x/a.md
  { kind: "file", path: "seed.md", contents: "SEED\n" }, // overlay-only
];

describe("mergeManifests — overlay overrides same path, appends overlay-only (T-058-01)", () => {
  test("an overlay entry wins on a shared path, keeping the base slot's position", () => {
    const merged = mergeManifests(BASE_FIX, OVERLAY_FIX);
    const a = merged.find((e) => e.path === "x/a.md");
    expect(a).toEqual({ kind: "file", path: "x/a.md", contents: "OVERLAY A\n" });
    // position preserved: x/a.md is still the 2nd entry (index 1), where the base had it.
    expect(merged[1]?.path).toBe("x/a.md");
    // base-only entries are untouched.
    const b = merged.find((e) => e.path === "x/b.md");
    expect(b && b.kind === "file" ? b.contents : null).toBe("BASE B\n");
  });

  test("overlay-only entries are appended in overlay order, after the base", () => {
    const merged = mergeManifests(BASE_FIX, OVERLAY_FIX);
    // exactly one new path beyond the base; same-path override does NOT grow the list.
    expect(merged.length).toBe(BASE_FIX.length + 1);
    expect(merged.at(-1)).toEqual({ kind: "file", path: "seed.md", contents: "SEED\n" });
  });

  test("an empty overlay is the base unchanged", () => {
    expect(mergeManifests(BASE_FIX, [])).toEqual([...BASE_FIX]);
  });
});

describe("planTemplate — converge over the merged manifest (T-058-01)", () => {
  test("a bare listing → every effective path creates, the override carrying overlay content", () => {
    const plan = planTemplate([], BASE_FIX, OVERLAY_FIX);
    expect(plan.creates.length).toBe(BASE_FIX.length + 1); // base + the one overlay-only
    const a = plan.creates.find((e) => e.path === "x/a.md");
    expect(a && a.kind === "file" ? a.contents : null).toBe("OVERLAY A\n"); // override won
    expect(plan.creates.some((e) => e.path === "seed.md")).toBe(true);
  });

  test("a fully-applied listing → zero creates (idempotent overlay re-run)", () => {
    const allPaths = mergeManifests(BASE_FIX, OVERLAY_FIX).map((e) => e.path);
    const plan = planTemplate(allPaths, BASE_FIX, OVERLAY_FIX);
    expect(plan.creates).toEqual([]);
    expect(plan.skips.length).toBe(allPaths.length);
  });

  test("equivalence: planTemplate === planInit over the merged manifest (the effect's path)", () => {
    const existing = ["x", "x/a.md"];
    expect(planTemplate(existing, BASE_FIX, OVERLAY_FIX)).toEqual(
      planInit(existing, mergeManifests(BASE_FIX, OVERLAY_FIX)),
    );
  });
});

describe("TEMPLATE_REGISTRY — a trivial, honest-empty registry (T-058-01)", () => {
  test("`hackathon` resolves; an unknown name does not; the available list is sorted", () => {
    expect(resolveTemplate("hackathon")).toBeDefined();
    expect(resolveTemplate("nope")).toBeUndefined();
    expect(availableTemplates()).toEqual(["hackathon", "kitchen", "minimal"]);
  });

  test("every overlay adds ONLY structure/knowledge — zero demand rows (honest-empty IA-3/IA-4)", () => {
    for (const overlay of Object.values(TEMPLATE_REGISTRY)) {
      for (const entry of overlay) {
        // overlays never touch the demand board/archive, and carry no demand-row shape.
        expect(entry.path).not.toBe("docs/active/demand.md");
        expect(entry.path).not.toBe("docs/archive/demand-cleared.md");
        if (entry.kind === "file") expect(countDemandRows(entry.contents)).toBe(0);
      }
    }
  });

  test("overlays name only vend-owned paths — never a lisa-owned root marker (one-way-to-lisa)", () => {
    for (const [name, overlay] of Object.entries(TEMPLATE_REGISTRY)) {
      for (const entry of overlay) {
        // No overlay EVER writes a lisa marker — absolute, for standalone and non-standalone alike.
        expect(LISA_MARKERS.includes(entry.path as (typeof LISA_MARKERS)[number])).toBe(false);
        // A NON-standalone overlay (e.g. hackathon) layers onto an existing lisa checkout, so it must
        // not own/clobber the lisa project's root `.gitignore`. A STANDALONE template (kitchen) mints a
        // fresh workspace into an EMPTY dir — there is no lisa project to clobber — so it legitimately
        // owns the root `.gitignore` (and no-clobber protects any pre-existing one regardless).
        if (!isStandaloneTemplate(name)) expect(entry.path).not.toBe(".gitignore");
      }
    }
  });
});

// ── T-064-01: the standalone/minimal template (pure half) ─────────────────────────────────
// The E-061 standalone seam: a `minimal` placeholder template whose overlay is EMPTY (it adds no
// files — the base scaffold IS the workspace) and whose name is in STANDALONE_TEMPLATES (so the
// effect bypasses the lisa-project gate for it). These pins stay fs-free; the empty-dir scaffold /
// no-clobber converge / no-Doppler-no-repo guards live in the fs-capable init-effect test.
describe("STANDALONE_TEMPLATES / minimal (T-064-01)", () => {
  test("`minimal` resolves to an EMPTY overlay (the base scaffold is the whole workspace)", () => {
    expect(resolveTemplate("minimal")).toEqual([]);
  });

  test("isStandaloneTemplate — `minimal` is standalone; `hackathon` and unknowns are not", () => {
    expect(isStandaloneTemplate("minimal")).toBe(true);
    expect(isStandaloneTemplate("hackathon")).toBe(false);
    expect(isStandaloneTemplate("nope")).toBe(false);
  });

  test("invariant — every standalone name is a real TEMPLATE_REGISTRY key", () => {
    for (const name of STANDALONE_TEMPLATES) {
      expect(Object.hasOwn(TEMPLATE_REGISTRY, name)).toBe(true);
    }
  });

  test("the empty overlay converges to the base — planTemplate([],base,[]) == planInit([],base)", () => {
    expect(planTemplate([], SCAFFOLD_MANIFEST, [])).toEqual(planInit([], SCAFFOLD_MANIFEST));
  });
});

// ── T-059-02: the hackathon overlay's TUNED CHARTER override (pure, data-layer) ───────────────

// The coupled-charter close: the hackathon overlay now carries a `docs/knowledge/charter.md` entry
// (the demonstrable-slice value function) that OVERRIDES the base `CHARTER_STUB` via `mergeManifests`
// — so a fresh seed is graded against the hackathon charter, where `vend steer` reads it. These pins
// stay fs-free (the byte-equality-to-the-seed-file drift guard lives in the fs-capable effect test).

/** The hackathon overlay's charter override entry. */
const overlayCharter = resolveTemplate("hackathon")?.find(
  (e): e is Extract<ScaffoldEntry, { kind: "file" }> =>
    e.kind === "file" && e.path === "docs/knowledge/charter.md",
);

describe("hackathon overlay — the tuned charter override (T-059-02)", () => {
  test("the overlay carries a docs/knowledge/charter.md entry that is NOT the base stub", () => {
    expect(overlayCharter).toBeDefined();
    expect(baseCharter).toBeDefined();
    // the override is real content, distinct from the generic base stub.
    expect(overlayCharter!.contents).not.toBe(baseCharter!.contents);
    // and it IS the demonstrable-slice value function (assert on the right content, not just "non-stub").
    expect(overlayCharter!.contents).toContain("demonstrable runnable slice");
    expect(overlayCharter!.contents).toContain("Demo-advancing");
  });

  test("mergeManifests lets the tuned charter win over CHARTER_STUB in the base's slot", () => {
    const merged = mergeManifests(SCAFFOLD_MANIFEST, resolveTemplate("hackathon")!);
    const mergedCharter = merged.find((e) => e.path === "docs/knowledge/charter.md");
    expect(mergedCharter && mergedCharter.kind === "file" ? mergedCharter.contents : null).toBe(
      overlayCharter!.contents,
    );
    // the charter OVERRIDES in place (does not append); only SEED.md is overlay-only ⇒ +1 entry.
    expect(merged.length).toBe(SCAFFOLD_MANIFEST.length + 1);
  });

  test("planTemplate creates the charter slot with the tuned contents", () => {
    const plan = planTemplate([], SCAFFOLD_MANIFEST, resolveTemplate("hackathon")!);
    const created = plan.creates.find((e) => e.path === "docs/knowledge/charter.md");
    expect(created && created.kind === "file" ? created.contents : null).toBe(overlayCharter!.contents);
  });

  test("the tuned charter is honest-empty — zero demand rows", () => {
    expect(countDemandRows(overlayCharter!.contents)).toBe(0);
  });

  test("the BASE manifest still ships the generic stub", () => {
    // The override lives ONLY in the overlay; the enriched base slot stays generic.
    expect(baseCharter!.contents).toContain("author your project's");
    expect(baseCharter!.contents).not.toContain("demonstrable runnable slice");
  });
});
