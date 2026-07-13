import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_LISA_LOOP_SETTLED_FAILURE_LOG_PATH,
  serializeLisaLoopSettledMarker,
} from "../seam/lisa-loop-settled-core.ts";
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
    cordFailureReason: "LISA_TICKETS_DONE must be a non-negative safe integer",
    delta: { firstSettle: true, newlyDoneTicketIds: [] },
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
    expect(rendered).toContain(
      "cord: last recording failed — LISA_TICKETS_DONE must be a non-negative safe integer",
    );
    expect(rendered).not.toContain(
      `${ANSI_RED}cord: last recording failed — LISA_TICKETS_DONE must be a non-negative safe integer`,
    );
    expect(rendered).toContain("delta: first settle — no baseline");
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

  test("prints an untracked-duration loop without fabricating a seconds figure", () => {
    const base = completeVerdict();
    if (base.kind !== "verdict") throw new Error("fixture must be a verdict");
    const rendered = renderSettleResult({
      ...base,
      loop: {
        v: 1,
        kind: "lisa-loop-settled",
        project: "vend",
        ticketsDone: 1,
      },
    }, { color: false });

    expect(rendered.split("\n")).toContain("loop: vend — 1 ticket done");
    expect(rendered).not.toContain("undefineds");
    expect(rendered).not.toMatch(/^loop: .* in [0-9]+s$/m);
  });

  test("keeps a measured zero duration distinct from untracked duration", () => {
    const base = completeVerdict();
    if (base.kind !== "verdict") throw new Error("fixture must be a verdict");
    const rendered = renderSettleResult({
      ...base,
      loop: { ...base.loop!, durationSecs: 0 },
    }, { color: false });

    expect(rendered).toContain("loop: vend — 1 ticket done in 0s");
  });

  test("an immediate repeat prints an empty delta and explicit empty concern/exception lines", () => {
    const base = completeVerdict();
    if (base.kind !== "verdict") throw new Error("fixture must be a verdict");
    const rendered = renderSettleResult({
      ...base,
      loop: null,
      cordFailureReason: null,
      delta: { firstSettle: false, newlyDoneTicketIds: [] },
      gate: { ok: true, name: "repository gate", detail: "7 tests", nextAction: null },
      presweep: { ok: true, doneIds: base.doneTicketIds, offenders: [] },
      reviewConcerns: [],
      exceptions: [],
    }, { color: false });

    expect(rendered).toContain("delta: none since last settle");
    expect(rendered).toContain("loop: none pending");
    expect(rendered).not.toContain("cord:");
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
    writeFile(join(root, "docs", "active", "epic", "E-899.md"), [
      "---", "id: E-899", "title: historical-epic", "status: done", "advances: [P3]",
      "serves: fixture", "---", "",
    ].join("\n")),
    writeFile(join(root, "docs", "active", "epic", "E-900.md"), [
      "---", "id: E-900", "title: fixture-epic", "status: open", "advances: [P4]",
      "serves: fixture", "---", "",
    ].join("\n")),
    writeFile(join(root, "docs", "active", "stories", "S-899-01.md"), [
      "---", "id: S-899-01", "title: historical-story", "type: story", "status: done",
      "priority: high", "tickets: [T-899-01]", "---", "",
    ].join("\n")),
    writeFile(join(root, "docs", "active", "stories", "S-900-01.md"), [
      "---", "id: S-900-01", "title: fixture-story", "type: story", "status: open",
      "priority: high", "tickets: [T-900-01]", "---", "",
    ].join("\n")),
    writeFile(join(root, "docs", "active", "tickets", "T-899-01.md"), [
      "---", "id: T-899-01", "story: S-899-01", "title: historical-ticket", "type: task",
      "status: done", "priority: high", "phase: done", "depends_on: []", "---", "",
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
      expect(first.cordFailureReason).toBeNull();
      const firstRendered = renderSettleResult(first, { color: false });
      expect(firstRendered).toContain("loop: fixture-project — 1 ticket done in 12s");
      expect(firstRendered).not.toContain("cord:");
      expect(firstRendered).toContain("delta: first settle — no baseline");
      expect(firstRendered).not.toContain("epic: E-899");
      expect(firstRendered).toContain("epic: E-900 — 1/1 cleared — sweep ready");
      expect(first.nextMarker).toEqual({
        version: LAST_SETTLE_MARKER_VERSION,
        doneTicketIds: ["T-899-01", "T-900-01"],
      });
      expect(await readFile(join(root, LAST_SETTLE_MARKER_PATH), "utf8")).toBe(
        '{"version":1,"doneTicketIds":["T-899-01","T-900-01"]}\n',
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

  test("a failure log newer than the last claim renders once with its reason verbatim", async () => {
    const root = await createSettleFixtureRoot();
    const tracePath = join(root, DEFAULT_LISA_LOOP_SETTLED_FAILURE_LOG_PATH);
    const lastSettlePath = join(root, LAST_SETTLE_MARKER_PATH);
    const reason = "LISA_PROJECT must be an absolute project root";
    const trace = `${JSON.stringify({
      timestamp: "2026-07-13T20:00:00.000Z",
      reason,
    })}\n`;
    try {
      const baseline = await runSettle({ root });
      expect(baseline.kind).toBe("verdict");
      await writeFile(tracePath, trace);
      await utimes(lastSettlePath, new Date(100_000), new Date(100_000));
      await utimes(tracePath, new Date(200_000), new Date(200_000));

      const result = await runSettle({ root });
      expect(result.kind).toBe("verdict");
      if (result.kind !== "verdict") throw new Error("expected settle verdict");
      expect(result.cordFailureReason).toBe(reason);
      expect(renderSettleResult(result, { color: false })).toContain(
        `cord: last recording failed — ${reason}`,
      );
      expect(await readFile(tracePath, "utf8")).toBe(trace);

      const repeated = await runSettle({ root });
      expect(repeated.kind).toBe("verdict");
      if (repeated.kind !== "verdict") throw new Error("expected repeated verdict");
      expect(repeated.cordFailureReason).toBeNull();
      expect(renderSettleResult(repeated, { color: false })).not.toContain("cord:");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("a successful marker claim newer than the log suppresses the cord line", async () => {
    const root = await createSettleFixtureRoot();
    const markerPath = join(root, ".vend", "loop-settled.json");
    const tracePath = join(root, DEFAULT_LISA_LOOP_SETTLED_FAILURE_LOG_PATH);
    try {
      await writeFile(tracePath, `${JSON.stringify({
        timestamp: "2026-07-13T20:00:00.000Z",
        reason: "older recorder failure",
      })}\n`);
      await writeFile(markerPath, serializeLisaLoopSettledMarker({
        v: 1,
        kind: "lisa-loop-settled",
        project: "fixture-project",
        ticketsDone: 1,
      }));
      await utimes(tracePath, new Date(100_000), new Date(100_000));
      await utimes(markerPath, new Date(200_000), new Date(200_000));

      const result = await runSettle({ root });
      expect(result.kind).toBe("verdict");
      if (result.kind !== "verdict") throw new Error("expected settle verdict");
      expect(result.loop).toMatchObject({ project: "fixture-project", ticketsDone: 1 });
      expect(result.cordFailureReason).toBeNull();
      expect(renderSettleResult(result, { color: false })).not.toContain("cord:");
      expect(await exists(markerPath)).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
