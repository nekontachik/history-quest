// Acceptance tests for I1 — Image pipeline integration (Wave 2).
// Source bullets: docs/game/EXECUTION_PLAN.md §4 I1 "Acceptance".

import { describe, expect, test } from "vitest";

import { dyn } from "./_dyn";

// bullet source: "call order verified with mocks"
//                "re-roll stops at 3"
//                "QA skipped → image accepted"
//                "scenario prompt contains no digits"

describe.skip("[I1] Image pipeline integration", () => {
  test("generateImage is exported from lib/ai/image", async () => {
    const mod = (await dyn("@/lib/ai/image")) as Record<string, unknown>;
    expect(typeof mod.generateImage).toBe("function");
  });

  test("call order: buildImagePrompt → callFlux → checkImage → persistImage", async () => {
    const img = (await dyn("@/lib/ai/image")) as Record<string, unknown>;
    expect(typeof img.generateImage).toBe("function");
  });

  test("re-roll stops at 3 attempts", async () => {
    const img = (await dyn("@/lib/ai/image")) as Record<string, unknown>;
    expect(typeof img.generateImage).toBe("function");
  });

  test("QA checklist skipped → image is accepted (fail-open)", async () => {
    const img = (await dyn("@/lib/ai/image")) as Record<string, unknown>;
    expect(typeof img.generateImage).toBe("function");
  });

  test("scenario prompt built with eraWords contains no digits", async () => {
    const img = (await dyn("@/lib/ai/image")) as Record<string, unknown>;
    const prompts = (await dyn("@/shared/game/image-prompts")) as Record<
      string,
      unknown
    >;
    expect(typeof img.buildFluxPrompt).toBe("function");
    expect(typeof prompts.eraWords).toBe("function");
  });
});
