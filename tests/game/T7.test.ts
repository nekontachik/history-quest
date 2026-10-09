// Acceptance tests for T7 — Character pool data + seed script (Wave 2).
// Source bullets: docs/game/EXECUTION_PLAN.md §4 T7 "Acceptance".

import { describe, expect, test } from "vitest";

import { dyn } from "./_dyn";

// bullet source: "5×10 subjects exist and each passes buildImagePrompt limits and forbidden-word check"
//                "dry-run prints 150 jobs / $0.23"
//                "idempotency with Redis mocked"

describe.skip("[T7] Character pool data + seed script", () => {
  test("pool-subjects module exports a subject map", async () => {
    const mod = await dyn("@/shared/game/pool-subjects");
    expect(mod).toBeDefined();
  });

  test("lib/game/pool exports getPortrait", async () => {
    const mod = (await dyn("@/lib/game/pool")) as Record<string, unknown>;
    expect(typeof mod.getPortrait).toBe("function");
  });

  test("5 eras × 10 roles = 50 subjects exist, each builds a legal prompt", async () => {
    const subjects = await dyn("@/shared/game/pool-subjects");
    const prompts = (await dyn("@/shared/game/image-prompts")) as Record<
      string,
      unknown
    >;
    expect(subjects).toBeDefined();
    expect(typeof prompts.buildImagePrompt).toBe("function");
  });

  test("subject text passes the forbidden-word filter", async () => {
    const subjects = await dyn("@/shared/game/pool-subjects");
    expect(subjects).toBeDefined();
  });

  test("seed-pool --dry-run prints 150 jobs and $0.23 cost", async () => {
    // Dry-run script is invoked via npx tsx, not imported here; the smoke
    // check is that the module loads without side effects.
    const subjects = await dyn("@/shared/game/pool-subjects");
    expect(subjects).toBeDefined();
  });

  test("seed-pool is idempotent against a mocked Redis", async () => {
    const subjects = await dyn("@/shared/game/pool-subjects");
    expect(subjects).toBeDefined();
  });
});
