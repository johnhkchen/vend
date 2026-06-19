import { describe, expect, test } from "bun:test";
import { DESIGNER_PRESET, DEV_PRESET, type PresentationSpec } from "./spec.ts";
import type { EpicNode, StoryNode, TicketNode } from "../graph/model.ts";
import {
  CODE_PLAIN,
  extractBamlInternals,
  extractCharterCodes,
  extractFileCites,
  faceJargon,
  faceText,
  humanizeTitle,
  jargonTokens,
  projectNode,
  rawAcceptanceCriteria,
  scrubFace,
  stateChip,
  structuralBreakdown,
  translateCode,
} from "./translate.ts";

// T-021-04 — the PURE vocabulary-translation layer, covered with plain-record node fixtures (no
// fs, no BAML), the spec.test.ts / model.test.ts mould. The AC contract is the final block.

// The fixture the AC names: a faithful T-018-01 TicketNode whose body trips EVERY denylist class
// (charter codes R1/R3/P5/PE-1, BAML/SAP, *.ts + baml_src/ cites, b.request/b.parse, an AC
// section). Built inline — the loader (T-021-01) is not this layer's concern.
const t018 = (): TicketNode => ({
  kind: "ticket",
  id: "T-018-01",
  storyId: "S-018-01",
  title: "steer-pure-core",
  type: "feature",
  status: "open",
  priority: "high",
  phase: "done",
  dependsOn: [],
  blocks: [],
  body: `## Context

The pure core of SteerProject-lite (R1 pure-core-first, R3 foundation, P5 consistency),
mirroring survey-core.ts. The SteerProject BAML function (b.request.SteerProject renders;
b.parse.SteerProject SAP-parses). Read-never-invent (PE-1): every signal traces to real state.
Cites: src/play/survey-core.ts, src/play/expand-core.ts, baml_src/.

## Acceptance Criteria

- [ ] The Fork type + the Steer output, wired authoring-only via a steer-bridge.
- [ ] bun run check green.
`,
});

// The §1c authored plain face (intent prose the layer routes — it never invents this).
const overlay018 = {
  plainTitle: "Build the brain that reads a project and proposes real choices",
  why: "So Vend can offer a ranked to-do list plus the genuine either/or decisions a human must make.",
  breakdown:
    "It produces a ranked list, flags the real decisions, and refuses to invent fake work just to look busy.",
};

const DENYLIST = ["P5", "PE-1", "BAML", "SAP", ".ts", "phase:done"];

describe("jargonTokens / scrubFace — the classifier (one policy, two uses)", () => {
  const mixed = "Build it (PE-1, P5) with BAML + SAP per survey-core.ts at phase:done";

  test("jargonTokens finds every denylist representative, deduped", () => {
    const toks = jargonTokens(mixed);
    expect(toks).toContain("PE-1");
    expect(toks).toContain("P5");
    expect(toks).toContain("BAML");
    expect(toks).toContain("SAP");
    expect(toks).toContain("survey-core.ts");
    expect(toks).toContain("phase:done");
  });

  test("scrubFace removes every jargon token and leaves clean prose", () => {
    const clean = scrubFace(mixed);
    expect(jargonTokens(clean)).toEqual([]);
    expect(clean).toContain("Build it");
    expect(clean).not.toContain("PE-1");
    expect(clean).not.toContain("BAML");
  });

  test("scrubFace tidies the wreckage (no empty parens, no doubled spaces)", () => {
    expect(scrubFace("a (PE-1) b")).toBe("a b");
    expect(scrubFace("   ")).toBe("");
  });
});

describe("translateCode — §1b translate-or-hide table", () => {
  test("known code → plain idea; unknown → null (hide)", () => {
    expect(translateCode("PE-1")).toBe(CODE_PLAIN["PE-1"] ?? null);
    expect(translateCode("IA-9")).toBeNull();
  });
});

describe("extractors — route dev content into the details bucket", () => {
  const body = t018().body;

  test("charter codes, deduped in appearance order", () => {
    const codes = extractCharterCodes(body);
    expect(codes).toContain("R1");
    expect(codes).toContain("P5");
    expect(codes).toContain("PE-1");
  });
  test("file cites", () => {
    const cites = extractFileCites(body);
    expect(cites.some((c) => c.includes("survey-core.ts"))).toBe(true);
    expect(cites.some((c) => c.startsWith("baml_src/"))).toBe(true);
  });
  test("baml internals include BAML/SAP and the b.request/b.parse calls", () => {
    const internals = extractBamlInternals(body);
    expect(internals).toContain("BAML");
    expect(internals).toContain("SAP");
    expect(internals.some((s) => s.startsWith("b.request"))).toBe(true);
    expect(internals.some((s) => s.startsWith("b.parse"))).toBe(true);
  });
  test("rawAcceptanceCriteria slices the AC section; absent → ''", () => {
    const acs = rawAcceptanceCriteria(body);
    expect(acs).toContain("Acceptance Criteria");
    expect(acs).toContain("Fork type");
    expect(acs).not.toContain("## Context");
    expect(rawAcceptanceCriteria("## Context\n\nno ACs here")).toBe("");
  });
});

describe("face / state helpers", () => {
  test("humanizeTitle is plain and jargon-free", () => {
    expect(humanizeTitle("steer-pure-core")).toBe("Steer pure core");
    expect(jargonTokens(humanizeTitle("steer-pure-core"))).toEqual([]);
  });
  test("stateChip: a done phase reads 'Done' via the designer labels — never 'phase:done'", () => {
    const chip = stateChip(t018(), DESIGNER_PRESET);
    expect(chip).toBe("Done");
    expect(chip).not.toContain("phase:");
  });
  test("stateChip: an unlabeled status falls back to the bare word, not the raw phase form", () => {
    const blocked: TicketNode = { ...t018(), status: "blocked", phase: "implement" };
    const chip = stateChip(blocked, DESIGNER_PRESET);
    expect(chip).toBe("blocked");
    expect(chip).not.toContain("phase:");
  });
  test("structuralBreakdown counts children / deps", () => {
    const story: StoryNode = {
      kind: "story",
      id: "S-018-01",
      epicId: "E-018",
      title: "t",
      status: "open",
      priority: "high",
      tickets: [t018(), { ...t018(), id: "T-018-02" }],
      body: "",
    };
    const epic: EpicNode = {
      kind: "epic",
      id: "E-018",
      title: "t",
      status: "open",
      advances: [],
      serves: "",
      kindLabel: null,
      stories: [story],
      body: "",
    };
    expect(structuralBreakdown(epic)).toBe("1 stories");
    expect(structuralBreakdown(story)).toBe("2 tickets");
    const withDeps: TicketNode = { ...t018(), dependsOn: ["T-1", "T-2"], blocks: ["T-9"] };
    expect(structuralBreakdown(withDeps)).toBe("depends on 2 · blocks 1");
    expect(structuralBreakdown(t018())).toBe("");
  });
});

describe("projectNode — spec-driven routing (same node, many renders)", () => {
  test("DESIGNER_PRESET emits all four face fields", () => {
    const card = projectNode(t018(), DESIGNER_PRESET, overlay018);
    expect(card.face.plainTitle).toBeDefined();
    expect(card.face.why).toBeDefined();
    expect(card.face.state).toBeDefined();
    expect(card.face.breakdown).toBeDefined();
  });
  test("DEV_PRESET face omits 'why' (it is not in DEV_PRESET.face)", () => {
    const card = projectNode(t018(), DEV_PRESET, overlay018);
    expect(card.face.why).toBeUndefined();
    expect(card.face.plainTitle).toBeDefined();
  });
  test("a spec with empty details routes nothing into the bucket", () => {
    const spec = { ...DESIGNER_PRESET, details: [] } as PresentationSpec;
    const card = projectNode(t018(), spec, overlay018);
    expect(card.details).toEqual({});
  });
  test("honest-empty: no overlay → no invented why", () => {
    const card = projectNode(t018(), DESIGNER_PRESET);
    expect(card.face.why).toBeUndefined();
    expect(card.face.plainTitle).toBe("Steer pure core"); // humanized fallback
  });
  test("the returned card is frozen (the model.ts read-only idiom)", () => {
    const card = projectNode(t018(), DESIGNER_PRESET, overlay018);
    expect(Object.isFrozen(card)).toBe(true);
    expect(() => {
      (card.face as { why?: string }).why = "hacked";
    }).toThrow();
  });
});

describe("T-018-01 — the AC contract", () => {
  const card = projectNode(t018(), DESIGNER_PRESET, overlay018);

  test("(1) the face reproduces the prep §1c plain face", () => {
    expect(card.face.plainTitle).toBe(overlay018.plainTitle);
    expect(card.face.state).toBe("Done");
    expect(card.face.why).toBe(overlay018.why);
    expect(card.face.breakdown).toBe(overlay018.breakdown);
  });

  test("(2) ZERO denylist tokens on the face", () => {
    expect(faceJargon(card)).toEqual([]);
    const text = faceText(card);
    for (const tok of DENYLIST) {
      expect(text).not.toContain(tok);
    }
  });

  test("(3) the same tokens remain reachable in the details bucket", () => {
    expect(card.details.charterCodes).toContain("PE-1");
    expect(card.details.charterCodes).toContain("R1");
    expect(card.details.charterCodes).toContain("P5");
    expect(card.details.bamlInternals).toContain("BAML");
    expect(card.details.bamlInternals).toContain("SAP");
    expect(card.details.fileCites?.some((c) => c.includes("survey-core.ts"))).toBe(true);
    expect(card.details.rawAcceptanceCriteria).toBeTruthy();
    expect(card.details.rawAcceptanceCriteria).toContain("Acceptance Criteria");
  });
});
