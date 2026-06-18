import { describe, expect, test } from "bun:test";
import { buildProjectSnapshot } from "./project-context.ts";

// T-002-03 project-context: the PURE snapshot formatter, pinned for shape +
// determinism. `assembleInputs` is the IMPURE read verb (epic/charter files + dir
// walk) and is deliberately NOT exercised — its logic is this formatter plus thin fs.

describe("buildProjectSnapshot — thin, deterministic go-and-see", () => {
  test("renders headed sections for src files, stories, and tickets", () => {
    const out = buildProjectSnapshot({
      root: "/repo",
      srcFiles: ["src/play/decompose-epic.ts", "src/gate/gates.ts"],
      stories: ["S-001", "S-002"],
      tickets: ["T-001-01", "T-002-03"],
    });
    expect(out).toContain("# Project snapshot — /repo");
    expect(out).toContain("## Source modules (src/**)");
    expect(out).toContain("- src/gate/gates.ts");
    expect(out).toContain("## Existing stories");
    expect(out).toContain("- S-001");
    expect(out).toContain("## Existing tickets");
    expect(out).toContain("- T-002-03");
  });

  test("sorts each list so the prompt input is reproducible", () => {
    const out = buildProjectSnapshot({
      root: "/repo",
      srcFiles: ["src/z.ts", "src/a.ts"],
      stories: [],
      tickets: [],
    });
    expect(out.indexOf("- src/a.ts")).toBeLessThan(out.indexOf("- src/z.ts"));
  });

  test("empty sections render '(none)', not a blank", () => {
    const out = buildProjectSnapshot({ root: "/repo", srcFiles: [], stories: [], tickets: [] });
    // every section should carry the placeholder
    expect(out.match(/- \(none\)/g)?.length).toBe(3);
  });
});
