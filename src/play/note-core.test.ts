import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Note } from "../../baml_client/index.ts";
import type { CastContext } from "../engine/play.ts";
import { classify } from "../engine/cast-core.ts";
import {
  captureNoteEffect,
  clearNote,
  NOTE_GATE,
  NOTES_DIR,
  renderNoteFile,
  slugify,
  type NoteInputs,
} from "./note-core.ts";

// T-007-04 second-play-proves-agnostic: the OFFLINE demonstration test for the `capture-note`
// sorcery. Imports note-core (pure helpers + the file-writing effect) and the engine's pure
// `classify` ONLY — every BAML import is TYPE-ONLY (erased), so no native addon loads into this
// `bun test` process (the gates.test.ts / materialize.test.ts discipline). The play's render/
// parse (which call BAML) are proven separately in ../baml/note.test.ts via the subprocess
// bridge; here we prove the bits the engine plugs in: the gate (pass + stop) and the effect
// (writes a real markdown artifact), plus the classify wiring that stops the line on a stop.

// A Note fixture — built directly (no model call). `b.parse` would produce this shape.
const FULL_NOTE: Note = {
  title: "Casting engine is play-agnostic",
  summary: "A second play casts through the same castPlay, proving the engine is generic.",
  points: ["Two plays now share one loop", "The cast loop has zero per-play branches", "Run log counts both"],
};

const ctxFor = (projectRoot: string): CastContext<NoteInputs> => ({
  inputs: { topic: "the casting engine", project: "snapshot" },
  projectRoot,
});

describe("slugify — a filename stem, never empty", () => {
  test("a normal title slugs to a kebab stem", () => {
    expect(slugify("Casting Engine is Play-Agnostic")).toBe("casting-engine-is-play-agnostic");
  });
  test("an all-punctuation title falls back to `note`", () => {
    expect(slugify("!!! ???")).toBe("note");
    expect(slugify("")).toBe("note");
  });
});

describe("renderNoteFile — the markdown artifact body (pure)", () => {
  test("carries the title heading, the summary, and every point as a bullet", () => {
    const { name, body } = renderNoteFile(FULL_NOTE);
    expect(name).toBe("casting-engine-is-play-agnostic.md");
    expect(body).toContain("# Casting engine is play-agnostic");
    expect(body).toContain(FULL_NOTE.summary);
    for (const p of FULL_NOTE.points) expect(body).toContain(`- ${p}`);
    expect(body).toContain("capture-note");
  });
});

describe("clearNote — the substance gate (pass + the three stop units)", () => {
  test("a full note clears, echoing the gate name for the run log", () => {
    const v = clearNote(FULL_NOTE);
    expect(v.status).toBe("clear");
    if (v.status === "clear") expect(v.cleared).toEqual([NOTE_GATE]);
  });

  test("an empty title stops the line at `title`", () => {
    const v = clearNote({ ...FULL_NOTE, title: "   " });
    expect(v.status).toBe("stop");
    if (v.status === "stop") {
      expect(v.gate).toBe(NOTE_GATE);
      expect(v.unit).toBe("title");
    }
  });

  test("an empty summary stops at `summary`", () => {
    const v = clearNote({ ...FULL_NOTE, summary: "" });
    expect(v.status).toBe("stop");
    if (v.status === "stop") expect(v.unit).toBe("summary");
  });

  test("no non-empty points (the SAP empty-degradation case) stops at `points`", () => {
    expect(clearNote({ ...FULL_NOTE, points: [] }).status).toBe("stop");
    const v = clearNote({ ...FULL_NOTE, points: ["  ", ""] });
    expect(v.status).toBe("stop");
    if (v.status === "stop") expect(v.unit).toBe("points");
  });
});

describe("captureNoteEffect — writes a real markdown artifact", () => {
  const dirs: string[] = [];
  afterAll(async () => {
    await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
  });

  test("writes <root>/docs/active/notes/<slug>.md and reports the path", async () => {
    const root = await mkdtemp(join(tmpdir(), "vend-note-"));
    dirs.push(root);

    const result = await captureNoteEffect(FULL_NOTE, ctxFor(root));
    expect(result.ok).toBe(true);

    const expectedPath = join(root, NOTES_DIR, "casting-engine-is-play-agnostic.md");
    expect(result.artifacts).toEqual([expectedPath]);

    const written = await readFile(expectedPath, "utf8");
    expect(written).toContain("# Casting engine is play-agnostic");
    expect(written).toContain(FULL_NOTE.points[0]!);
  });
});

describe("classify wiring — clear materializes, a gate stop stops the line", () => {
  const inBudget = { status: "ok", spent: 100, ceiling: 8000, remaining: 7900 } as const;

  test("a clear verdict → success + materialize (the effect would run)", () => {
    const v = classify({ timedOut: false, budgetOutcome: inBudget, gateVerdict: clearNote(FULL_NOTE) });
    expect(v.outcome).toBe("success");
    expect(v.materialize).toBe(true);
    // the cleared `substance` row reaches the run log
    expect(v.gateLog).toEqual([{ gate: NOTE_GATE, passed: true }]);
  });

  test("a stop verdict → gate-failed + no materialize (the andon)", () => {
    const stop = clearNote({ ...FULL_NOTE, title: "" });
    const v = classify({ timedOut: false, budgetOutcome: inBudget, gateVerdict: stop });
    expect(v.outcome).toBe("gate-failed");
    expect(v.materialize).toBe(false);
    expect(v.gateLog[0]).toMatchObject({ gate: NOTE_GATE, passed: false });
  });
});
