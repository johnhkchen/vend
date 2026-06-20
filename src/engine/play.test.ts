import { describe, expect, test } from "bun:test";
import {
  type AnyPlay,
  type Card,
  DuplicatePlayError,
  type GateVerdict,
  type Play,
  PlayNotFoundError,
  PlayRegistry,
  registry,
} from "./play.ts";

// T-007-01 play registry + contract: the PURE registry test. No baml import at all — it
// builds a STUB play (no model call), so no native addon loads into the bun-test process
// (the discipline gates.test.ts / id-guard.test.ts follow). The contract's TYPES are
// checked by tsc; this file pins the registry's runtime behavior and proves the `Play`
// interface is implementable (the stub typechecks as `Play<unknown, unknown>`).

const CARD: Card = { color: ["blue", "white"], type: "permanent", rarity: "mythic" };
const CLEAR: GateVerdict = { status: "clear" };

/** A minimal, valid `Play` — enough to register and retrieve without any model call. */
function makeStubPlay(name: string): Play<unknown, unknown> {
  return {
    name,
    summary: `stub ${name}`,
    render: () => "",
    parse: () => ({}),
    gates: () => CLEAR,
    effect: async () => ({ ok: true }),
    budget: { timeMs: 1000, tokens: 1000 },
    card: CARD,
  };
}

describe("PlayRegistry — register + get round-trip", () => {
  test("get returns exactly the registered play (referential identity)", () => {
    const reg = new PlayRegistry();
    const play = makeStubPlay("decompose-epic");
    reg.register(play);

    const found = reg.get("decompose-epic");
    expect(found.found).toBe(true);
    // narrow then assert identity — the SAME object goes in and comes out.
    if (found.found) expect(found.play).toBe(play as AnyPlay);
  });

  test("has / names reflect registration state in insertion order", () => {
    const reg = new PlayRegistry();
    expect(reg.has("a")).toBe(false);
    expect(reg.names()).toEqual([]);

    reg.register(makeStubPlay("a"));
    reg.register(makeStubPlay("b"));

    expect(reg.has("a")).toBe(true);
    expect(reg.has("b")).toBe(true);
    expect(reg.has("c")).toBe(false);
    expect(reg.names()).toEqual(["a", "b"]);
  });
});

describe("PlayRegistry — the unknown name is a typed error, never undefined-deref", () => {
  test("get on a miss returns found:false with a PlayNotFoundError", () => {
    const reg = new PlayRegistry();
    reg.register(makeStubPlay("decompose-epic"));

    const result = reg.get("propose-epic");
    expect(result.found).toBe(false);
    if (!result.found) {
      expect(result.error).toBeInstanceOf(PlayNotFoundError);
      expect(result.error.requested).toBe("propose-epic");
      expect(result.error.available).toEqual(["decompose-epic"]);
    }
  });

  test("an empty registry reports an empty available list, not undefined", () => {
    const reg = new PlayRegistry();
    const result = reg.get("anything");
    expect(result.found).toBe(false);
    if (!result.found) {
      expect(result.error.requested).toBe("anything");
      expect(result.error.available).toEqual([]);
    }
  });
});

describe("PlayRegistry — duplicate registration throws (programmer error)", () => {
  test("re-registering a name throws DuplicatePlayError carrying the name", () => {
    const reg = new PlayRegistry();
    reg.register(makeStubPlay("dup"));
    expect(() => reg.register(makeStubPlay("dup"))).toThrow(DuplicatePlayError);

    try {
      reg.register(makeStubPlay("dup"));
      throw new Error("expected a throw");
    } catch (e) {
      expect(e).toBeInstanceOf(DuplicatePlayError);
      expect((e as DuplicatePlayError).playName).toBe("dup");
    }
    // the original registration survives the rejected duplicate.
    expect(reg.names()).toEqual(["dup"]);
  });
});

describe("PlayRegistry — instances are isolated", () => {
  test("registering in one registry does not leak into another", () => {
    const a = new PlayRegistry();
    const b = new PlayRegistry();
    a.register(makeStubPlay("only-in-a"));

    expect(a.has("only-in-a")).toBe(true);
    expect(b.has("only-in-a")).toBe(false);
    expect(b.names()).toEqual([]);
  });

  test("the default singleton `registry` is a usable PlayRegistry", () => {
    // use a uniquely-named play so this never collides with real registrations.
    const name = "stub-play-T-007-01-test";
    expect(registry.has(name)).toBe(false);
    registry.register(makeStubPlay(name));
    const found = registry.get(name);
    expect(found.found).toBe(true);
  });
});
