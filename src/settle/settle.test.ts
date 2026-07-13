import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serializeLisaLoopSettledMarker } from "../seam/lisa-loop-settled-core.ts";
import {
  LAST_SETTLE_MARKER_PATH,
  LAST_SETTLE_MARKER_VERSION,
  type SettleResult,
} from "./settle-core.ts";
import {
  ANSI_RED,
  ANSI_RESET,
  renderSettleResult,
  reviewConcernFromDisposition,
  runSettle,
} from "./settle.ts";

const dispositionPath = "docs/active/work/T-900-01/review-disposition.json";

describe("reviewConcernFromDisposition — structured work-artifact authority", () => {
  test("a canonical pass is not an open concern", () => {
    expect(reviewConcernFromDisposition(
      "T-900-01",
      dispositionPath,
      '{"disposition":"pass","reason":null}',
    )).toBeNull();
  });

  test("a reasoned block becomes a named concern with an exact resolution action", () => {
    expect(reviewConcernFromDisposition(
      "T-900-01",
      dispositionPath,
      '{"disposition":"block","reason":"  missing release proof  "}',
    )).toEqual({
      ticketId: "T-900-01",
      name: "missing release proof",
      nextAction:
        "Resolve missing release proof for T-900-01, then record a passing disposition in docs/active/work/T-900-01/review-disposition.json.",
    });
  });

  for (const [name, contents, reason] of [
    ["invalid JSON", "{", "invalid JSON"],
    ["blank block reason", '{"disposition":"block","reason":"  "}', "block requires a nonblank reason"],
    ["pass with a reason", '{"disposition":"pass","reason":"old"}', "expected pass/null"],
    ["extra key", '{"disposition":"pass","reason":null,"extra":true}', "expected exactly"],
    ["array root", "[]", "root must be an object"],
  ] as const) {
    test(`${name} is visible as a repair concern`, () => {
      const concern = reviewConcernFromDisposition("T-900-01", dispositionPath, contents);
      expect(concern?.name).toContain(reason);
      expect(concern?.nextAction).toBe(
        "Repair docs/active/work/T-900-01/review-disposition.json to a valid pass or reasoned block disposition, then rerun `vend settle`.",
      );
    });
  }
});

function completeVerdict(): SettleResult {
  return {
    kind: "verdict",
    loop: {
      v: 1,
      kind: "lisa-loop-settled",
      project: "vend",
      ticketsDone: 1,
      durationSecs: 41,
    },
    delta: { firstSettle: true, newlyDoneTicketIds: ["T-900-01"] },
    epics: [
      {
        epicId: "E-900",
        title: "fixture epic",
        cleared: 1,
        total: 2,
        clearedTicketIds: ["T-900-01"],
        allDone: false,
      },
      {
        epicId: "E-901",
        title: "ready epic",
        cleared: 1,
        total: 1,
        clearedTicketIds: ["T-901-01"],
        allDone: true,
      },
    ],
    doneTicketIds: ["T-900-01", "T-901-01"],
    allDoneEpicIds: ["E-901"],
    gate: {
      ok: false,
      name: "repository gate",
      detail: "typecheck failed",
      nextAction: "Run `bun run check` and fix the type error.",
    },
    presweep: {
      ok: false,
      doneIds: ["T-900-01", "T-901-01"],
      offenders: ["src/broken.ts"],
    },
    reviewConcerns: [
      {
        ticketId: "T-900-01",
        name: "missing release proof",
        nextAction: "Run the release fixture.",
      },
    ],
    exceptions: [
      {
        kind: "gate",
        name: "repository gate",
        message: "typecheck failed",
        nextAction: "Run `bun run check` and fix the type error.",
      },
      {
        kind: "presweep",
        name: "src/broken.ts",
        message: "Uncommitted presweep offender: src/broken.ts",
        nextAction: "Commit or restore src/broken.ts, then rerun `bun run check:presweep`.",
      },
      {
        kind: "review",
        name: "T-900-01",
        message: "missing release proof",
        nextAction: "Run the release fixture.",
      },
    ],
    nextMarker: {
      version: LAST_SETTLE_MARKER_VERSION,
      doneTicketIds: ["T-900-01", "T-901-01"],
    },
  };
}

describe("renderSettleResult — one-screen terminal contract", () => {
  test("prints every verdict field, preserves actions, and colors each exception red", () => {
    const rendered = renderSettleResult(completeVerdict());
    expect(rendered).toContain("loop: vend — 1 ticket done in 41s");
    expect(rendered).toContain("delta: first settle — T-900-01");
    expect(rendered).toContain("epic: E-900 — 1/2 cleared");
    expect(rendered).toContain("epic: E-901 — 1/1 cleared — sweep ready");
    expect(rendered).toContain("gate: red — repository gate: typecheck failed");
    expect(rendered).toContain("presweep: red — 1 offender: src/broken.ts");
    expect(rendered).toContain("review concern: T-900-01 — missing release proof");
    expect(rendered).toContain("next: Run `bun run check` and fix the type error.");
    expect(rendered).toContain(
      "next: Commit or restore src/broken.ts, then rerun `bun run check:presweep`.",
    );
    expect(rendered).toContain("next: Run the release fixture.");
    expect(rendered.match(new RegExp(ANSI_RED.replace("[", "\\["), "g"))).toHaveLength(3);
    expect(rendered.match(new RegExp(ANSI_RESET.replace("[", "\\["), "g"))).toHaveLength(3);
    expect(rendered.endsWith("\n")).toBe(true);
  });

  test("an immediate repeat prints an empty delta and explicit empty concern/exception lines", () => {
    const base = completeVerdict();
    if (base.kind !== "verdict") throw new Error("fixture must be a verdict");
    const rendered = renderSettleResult({
      ...base,
      loop: null,
      delta: { firstSettle: false, newlyDoneTicketIds: [] },
      gate: { ok: true, name: "repository gate", detail: "7 tests", nextAction: null },
      presweep: { ok: true, doneIds: base.doneTicketIds, offenders: [] },
      reviewConcerns: [],
      exceptions: [],
    }, { color: false });

    expect(rendered).toContain("delta: none since last settle");
    expect(rendered).toContain("loop: none pending");
    expect(rendered).toContain("gate: green — repository gate: 7 tests");
    expect(rendered).toContain("presweep: green — 2 done tickets, source + board committed");
    expect(rendered).toContain("review concerns: none");
    expect(rendered).toContain("exceptions: none");
    expect(rendered).not.toContain("\x1b[");
  });

  test("a malformed marker refusal is named, red, actionable, and contains no verdict claims", () => {
    const result: SettleResult = {
      kind: "refusal",
      code: "malformed-last-settle-marker",
      path: LAST_SETTLE_MARKER_PATH,
      reason: "marker is not valid JSON",
      nextAction:
        "Remove .vend/last-settle.json and rerun `vend settle` for a full-board first-settle summary.",
    };
    const rendered = renderSettleResult(result);
    expect(rendered).toContain(
      `${ANSI_RED}refusal [malformed-last-settle-marker] .vend/last-settle.json: marker is not valid JSON${ANSI_RESET}`,
    );
    expect(rendered).toContain(`${ANSI_RED}next: Remove .vend/last-settle.json`);
    expect(rendered).not.toContain("delta:");
    expect(rendered).not.toContain("gate:");
  });

  test("a malformed Lisa loop marker refusal uses the same red terminal path", () => {
    const result: SettleResult = {
      kind: "refusal",
      code: "malformed-loop-settled-marker",
      path: ".vend/loop-settled.json",
      reason: "marker is not valid JSON",
      nextAction:
        "Repair or remove .vend/loop-settled.json, then rerun `vend settle`; " +
        "the malformed marker was left pending for diagnosis.",
    };
    const rendered = renderSettleResult(result);
    expect(rendered).toContain(
      `${ANSI_RED}refusal [malformed-loop-settled-marker] .vend/loop-settled.json: marker is not valid JSON${ANSI_RESET}`,
    );
    expect(rendered).not.toContain("loop:");
    expect(rendered).not.toContain("delta:");
  });
});

async function createSettleFixtureRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "vend-settle-loop-"));
  await Promise.all([
    mkdir(join(root, "docs", "active", "epic"), { recursive: true }),
    mkdir(join(root, "docs", "active", "stories"), { recursive: true }),
    mkdir(join(root, "docs", "active", "tickets"), { recursive: true }),
    mkdir(join(root, ".vend"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(root, "docs", "active", "epic", "E-900.md"), [
      "---", "id: E-900", "title: fixture-epic", "status: open", "advances: [P4]",
      "serves: fixture", "---", "",
    ].join("\n")),
    writeFile(join(root, "docs", "active", "stories", "S-900-01.md"), [
      "---", "id: S-900-01", "title: fixture-story", "type: story", "status: open",
      "priority: high", "tickets: [T-900-01]", "---", "",
    ].join("\n")),
    writeFile(join(root, "docs", "active", "tickets", "T-900-01.md"), [
      "---", "id: T-900-01", "story: S-900-01", "title: fixture-ticket", "type: task",
      "status: done", "priority: high", "phase: done", "depends_on: []", "---", "",
    ].join("\n")),
    writeFile(
      join(root, "package.json"),
      '{"name":"settle-loop-fixture","private":true,"scripts":{"check":"bun run fixture-check.ts"}}\n',
    ),
    writeFile(join(root, "fixture-check.ts"), 'console.log("5 pass");\n'),
  ]);

  const git = (...args: string[]) => {
    const result = Bun.spawnSync(["git", ...args], { cwd: root });
    expect(result.exitCode, result.stderr.toString()).toBe(0);
  };
  git("init", "-q");
  git("config", "user.email", "fixture@example.test");
  git("config", "user.name", "Vend Fixture");
  git("add", ".");
  git("commit", "-qm", "fixture baseline");
  return root;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

describe("runSettle — Lisa loop marker lifecycle", () => {
  test("a valid marker prints once, is consumed after verdict, and never reappears", async () => {
    const root = await createSettleFixtureRoot();
    const markerPath = join(root, ".vend", "loop-settled.json");
    try {
      await writeFile(markerPath, serializeLisaLoopSettledMarker({
        v: 1,
        kind: "lisa-loop-settled",
        project: "fixture-project",
        ticketsDone: 1,
        durationSecs: 12,
      }));

      const first = await runSettle({ root });
      expect(first.kind).toBe("verdict");
      if (first.kind !== "verdict") throw new Error("expected first verdict");
      expect(first.loop).toMatchObject({ project: "fixture-project", ticketsDone: 1, durationSecs: 12 });
      expect(renderSettleResult(first, { color: false })).toContain(
        "loop: fixture-project — 1 ticket done in 12s",
      );
      expect(await exists(markerPath)).toBe(false);

      const second = await runSettle({ root });
      expect(second.kind).toBe("verdict");
      if (second.kind !== "verdict") throw new Error("expected repeated verdict");
      expect(second.loop).toBeNull();
      expect(renderSettleResult(second, { color: false })).toContain("loop: none pending");
      expect(await exists(markerPath)).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("malformed marker bytes refuse and remain pending byte-for-byte", async () => {
    const root = await createSettleFixtureRoot();
    const markerPath = join(root, ".vend", "loop-settled.json");
    const malformed = "{not-json\n";
    try {
      await writeFile(markerPath, malformed);
      const result = await runSettle({ root });
      expect(result).toMatchObject({ kind: "refusal", code: "malformed-loop-settled-marker" });
      expect(await readFile(markerPath, "utf8")).toBe(malformed);
      expect((await Bun.$`find ${join(root, ".vend")} -name '*.settling'`.text()).trim()).toBe("");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
