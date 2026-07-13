import { describe, expect, test } from "bun:test";
import type { EpicFrontmatterFlip, SweepFlipSet, SweepRefusal } from "./sweep-core.ts";
import {
  renderEpicStatusFlip,
  renderSweepPlan,
  renderSweepRefusal,
  SweepApplyError,
} from "./sweep.ts";

const flip: EpicFrontmatterFlip = {
  epicId: "E-100",
  path: "docs/active/epic/E-100.md",
  field: "status",
  from: "open",
  to: "done",
  clearedTicketIds: ["T-100-01", "T-100-02"],
};

describe("renderEpicStatusFlip — narrow checked frontmatter transition", () => {
  test("changes only the top-level status line and preserves body lookalikes", () => {
    const source = [
      "---",
      "id: E-100",
      "title: fixture",
      "status: open # lifecycle",
      "advances: [P2]",
      "serves: fixture",
      "---",
      "",
      "body status: open",
      "status: prose",
      "",
    ].join("\n");

    expect(renderEpicStatusFlip(source, flip)).toBe(source.replace(
      "status: open # lifecycle",
      "status: done",
    ));
  });

  test("preserves CRLF bytes outside the changed scalar", () => {
    const source = [
      "---",
      "id: E-100",
      "title: fixture",
      "status: open",
      "advances: []",
      "serves: fixture",
      "---",
      "body",
      "",
    ].join("\r\n");
    const result = renderEpicStatusFlip(source, flip);
    expect(result).toContain("\r\nstatus: done\r\n");
    expect(result.replace("status: done", "status: open")).toBe(source);
  });

  test("refuses an identity mismatch", () => {
    const source = "---\nid: E-999\nstatus: open\n---\n";
    expect(() => renderEpicStatusFlip(source, flip)).toThrow(SweepApplyError);
    expect(() => renderEpicStatusFlip(source, flip)).toThrow(/expected id E-100/);
  });

  test("refuses a stale from-status", () => {
    const source = "---\nid: E-100\nstatus: active\n---\n";
    expect(() => renderEpicStatusFlip(source, flip)).toThrow(/expected status "open"/);
  });

  test("refuses missing and duplicate top-level status fields", () => {
    expect(() => renderEpicStatusFlip("---\nid: E-100\n---\n", flip)).toThrow(
      /observed undefined/,
    );
    expect(() => renderEpicStatusFlip(
      "---\nid: E-100\nstatus: open\nstatus: open\n---\n",
      flip,
    )).toThrow(/exactly one top-level status field/);
  });
});

const plan: SweepFlipSet = {
  kind: "flip-set",
  flips: [flip],
  pathspec: [flip.path],
  message: "sweep: close E-100\n\nE-100 cleared by T-100-01, T-100-02",
};

describe("sweep terminal rendering", () => {
  test("presents the exact file list and provenance message", () => {
    expect(renderSweepPlan(plan)).toBe(
      "sweep\n" +
      "files:\n" +
      "  docs/active/epic/E-100.md\n" +
      "message:\n" +
      "sweep: close E-100\n\n" +
      "E-100 cleared by T-100-01, T-100-02\n",
    );
  });

  test("presweep refusal names its code, every offender, and recovery action", () => {
    const refusal: SweepRefusal = {
      kind: "refusal",
      code: "presweep-offenders",
      offenders: ["docs/active/tickets/T-100-01.md", "src/x.ts"],
      reason: "Presweep could not prove that phase-done work is committed.",
      nextAction: "Commit or restore the offenders, then rerun `vend sweep`.",
    };
    expect(renderSweepRefusal(refusal)).toBe(
      "sweep refusal [presweep-offenders]: Presweep could not prove that phase-done work is committed.\n" +
      "offenders:\n" +
      "  docs/active/tickets/T-100-01.md\n" +
      "  src/x.ts\n" +
      "next: Commit or restore the offenders, then rerun `vend sweep`.\n",
    );
  });

  test("empty-board refusal makes no file/message claim", () => {
    const refusal: SweepRefusal = {
      kind: "refusal",
      code: "no-epics-ready",
      reason: "No all-done epic needs a status flip.",
      nextAction: "Wait for done work.",
    };
    const rendered = renderSweepRefusal(refusal);
    expect(rendered).toContain("[no-epics-ready]");
    expect(rendered).toContain("next: Wait for done work.");
    expect(rendered).not.toContain("files:");
    expect(rendered).not.toContain("message:");
  });
});

