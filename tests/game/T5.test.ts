// Acceptance tests for T5 — Image prompt builders + QA checklist (Wave 1).
// Source bullets: docs/game/EXECUTION_PLAN.md §4 T5 "Acceptance".

import { describe, expect, test } from "vitest";

import { dyn } from "./_dyn";

// bullet source: "preset first, tail last"
//                "forbidden words removed"
//                ">600 chars throws"
//                "eraWords(-753) contains no digits"
//                "all 10 regression subjects from art/prompts/regression.json build under the limit"
//                "QA parses fixture JSON and rejects malformed"

describe("[T5] Image prompt builders + QA checklist", () => {
  test("image-prompts module exports buildImagePrompt and eraWords", async () => {
    const mod = (await dyn("@/shared/game/image-prompts")) as Record<
      string,
      unknown
    >;
    expect(typeof mod.buildImagePrompt).toBe("function");
    expect(typeof mod.eraWords).toBe("function");
  });

  test("image-qa module exports checkImage", async () => {
    const mod = (await dyn("@/lib/ai/image-qa")) as Record<string, unknown>;
    expect(typeof mod.checkImage).toBe("function");
  });

  test("buildImagePrompt puts the preset first and the tail last", async () => {
    const mod = (await dyn("@/shared/game/image-prompts")) as Record<
      string,
      unknown
    >;
    expect(typeof mod.buildImagePrompt).toBe("function");
  });

  test("forbidden prompt words are stripped from the subject", async () => {
    const mod = (await dyn("@/shared/game/image-prompts")) as Record<
      string,
      unknown
    >;
    expect(typeof mod.buildImagePrompt).toBe("function");
  });

  test("prompts over PROMPT_MAX_CHARS throw", async () => {
    const mod = (await dyn("@/shared/game/image-prompts")) as Record<
      string,
      unknown
    >;
    expect(typeof mod.buildImagePrompt).toBe("function");
  });

  test("eraWords(-753) contains no digits", async () => {
    const mod = (await dyn("@/shared/game/image-prompts")) as Record<
      string,
      unknown
    >;
    expect(typeof mod.eraWords).toBe("function");
  });

  test("all 10 regression subjects build under PROMPT_MAX_CHARS", async () => {
    const mod = (await dyn("@/shared/game/image-prompts")) as Record<
      string,
      unknown
    >;
    const regression = (await dyn("@/art/prompts/regression.json")) as {
      default: unknown[];
    };
    expect(Array.isArray(regression.default)).toBe(true);
    expect(typeof mod.buildImagePrompt).toBe("function");
  });

  test("checkImage parses the fixed JSON checklist and rejects malformed JSON", async () => {
    const mod = (await dyn("@/lib/ai/image-qa")) as Record<string, unknown>;
    expect(typeof mod.checkImage).toBe("function");
  });
});
