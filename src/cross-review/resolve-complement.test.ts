import { describe, expect, test } from "bun:test";
import type { DispenseOptions, Executor, ResultMessage } from "../executor/executor.ts";
import type { ExecutorRegistry } from "../executor/select.ts";
import { resolveComplementExecutor } from "./resolve-complement.ts";

/** Inert but invokable: identity proves routing without spending tokens or touching transport. */
function stubExecutor(id: string): Executor {
  return {
    id,
    dispense(_opts: DispenseOptions): Promise<ResultMessage> {
      return Promise.resolve({ type: "result", subtype: "success" } as ResultMessage);
    },
  };
}

describe("resolveComplementExecutor", () => {
  const claude = stubExecutor("claude");
  const openaiCompat = stubExecutor("openai-compat");
  const bothSeats: ExecutorRegistry = {
    claude: () => claude,
    "openai-compat": () => openaiCompat,
  };

  test("a Claude-authored run resolves the Codex/openai-compat executor", () => {
    const resolved = resolveComplementExecutor("claude", bothSeats);

    expect(resolved).toEqual({ seat: "codex", executor: openaiCompat });
    expect(resolved?.executor.id).toBe("openai-compat");
  });

  test("a Codex-authored run resolves the Claude executor", () => {
    const resolved = resolveComplementExecutor("codex", bothSeats);

    expect(resolved).toEqual({ seat: "claude", executor: claude });
    expect(resolved?.executor.id).toBe("claude");
  });

  test("a one-seat configuration has no complement and is cross-review inert", () => {
    const claudeOnly: ExecutorRegistry = { claude: () => claude };

    expect(resolveComplementExecutor("claude", claudeOnly)).toBeNull();
  });

  test("an absent or unknown authoring seat is cross-review inert", () => {
    expect(resolveComplementExecutor(undefined, bothSeats)).toBeNull();
    expect(resolveComplementExecutor("other", bothSeats)).toBeNull();
  });

  test("an opposite-only registry is incomplete, not a configured second seat", () => {
    const openaiOnly: ExecutorRegistry = { "openai-compat": () => openaiCompat };

    expect(resolveComplementExecutor("claude", openaiOnly)).toBeNull();
  });
});
