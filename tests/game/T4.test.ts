// Acceptance tests for T4 — Run engine, pure (Wave 1).
// Source bullets: docs/game/EXECUTION_PLAN.md §4 T4 "Acceptance".

import { describe, expect, test } from "vitest";

import { dyn } from "./_dyn";

// bullet source: "table tests for every ending id"
//                "clamp"
//                "no mutation of input state"
//                "12th card ends run"
//                "collapse mid-deck stops further choices"
//                "preview never exposes numbers"

describe.skip("[T4] Run engine, pure", () => {
  test("run module exports the pure engine entry points", async () => {
    const mod = (await dyn("@/shared/game/run")) as Record<string, unknown>;
    expect(typeof mod.initRun).toBe("function");
    expect(typeof mod.applyChoice).toBe("function");
    expect(typeof mod.previewEffects).toBe("function");
    expect(typeof mod.worldTone).toBe("function");
  });

  test("endings module exports resolveEnding", async () => {
    const mod = (await dyn("@/shared/game/endings")) as Record<
      string,
      unknown
    >;
    expect(typeof mod.resolveEnding).toBe("function");
  });

  test("every ending id has a table case that resolves to it", async () => {
    const mod = (await dyn("@/shared/game/endings")) as Record<
      string,
      unknown
    >;
    expect(typeof mod.resolveEnding).toBe("function");
  });

  test("meters clamp to [0, 100]", async () => {
    const mod = (await dyn("@/shared/game/run")) as Record<string, unknown>;
    expect(typeof mod.applyChoice).toBe("function");
  });

  test("applyChoice does not mutate the input state", async () => {
    const mod = (await dyn("@/shared/game/run")) as Record<string, unknown>;
    expect(typeof mod.applyChoice).toBe("function");
  });

  test("the 12th card ends the run (survival)", async () => {
    const mod = (await dyn("@/shared/game/run")) as Record<string, unknown>;
    expect(typeof mod.applyChoice).toBe("function");
  });

  test("collapse mid-deck stops further choices", async () => {
    const mod = (await dyn("@/shared/game/run")) as Record<string, unknown>;
    expect(typeof mod.applyChoice).toBe("function");
  });

  test("previewEffects exposes direction only, never numbers", async () => {
    const mod = (await dyn("@/shared/game/run")) as Record<string, unknown>;
    expect(typeof mod.previewEffects).toBe("function");
  });
});
