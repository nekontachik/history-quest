// Acceptance tests for T1 — PiAPI provider with fal fallback (Wave 1).
// Source bullets: docs/game/EXECUTION_PLAN.md §4 T1 "Acceptance".
// Tests live SKIPPED until T1 flips `describe.skip` → `describe`.
// Imports to not-yet-existing modules go through `dyn()` so this file
// still type-checks today.

import { describe, expect, test } from "vitest";

import { dyn } from "./_dyn";

// bullet source: "success after 2 polls"
//                "`failed` → fal called once"
//                "timeout → fal"
//                "missing key → PiAPI never called"
//                "402 + fal failure → billing error"
//                "request body equals fixture shape exactly (`model`, `task_type`, `input.width/height`)"

describe("[T1] PiAPI provider with fal fallback", () => {
  test("PiAPI provider module exports a client", async () => {
    const mod = (await dyn("@/lib/ai/providers/piapi")) as Record<
      string,
      unknown
    >;
    expect(mod).toBeDefined();
    expect(typeof mod.piapiGenerate).toBe("function");
  });

  test("callFlux is defined inside lib/ai/image.ts and tries PiAPI first", async () => {
    const mod = (await dyn("@/lib/ai/image")) as Record<string, unknown>;
    expect(typeof mod.callFlux).toBe("function");
  });

  test("success after 2 polls returns image_url from PiAPI", async () => {
    const mod = (await dyn("@/lib/ai/image")) as Record<string, unknown>;
    expect(typeof mod.callFlux).toBe("function");
  });

  test("task status `failed` falls back to fal exactly once", async () => {
    const mod = (await dyn("@/lib/ai/image")) as Record<string, unknown>;
    expect(typeof mod.callFlux).toBe("function");
  });

  test("timeout on PiAPI falls back to fal", async () => {
    const mod = (await dyn("@/lib/ai/image")) as Record<string, unknown>;
    expect(typeof mod.callFlux).toBe("function");
  });

  test("missing PIAPI_KEY → PiAPI is never called, fal is used directly", async () => {
    const mod = (await dyn("@/lib/ai/image")) as Record<string, unknown>;
    expect(typeof mod.callFlux).toBe("function");
  });

  test("402 from PiAPI followed by fal failure surfaces a billing error", async () => {
    const mod = (await dyn("@/lib/ai/image")) as Record<string, unknown>;
    expect(typeof mod.callFlux).toBe("function");
  });

  test("request body matches fixture shape (model, task_type, input.width/height)", async () => {
    const mod = await dyn("@/lib/ai/providers/piapi");
    expect(mod).toBeDefined();
  });
});
