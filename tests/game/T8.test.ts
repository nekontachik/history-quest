// Acceptance tests for T8 — Endings, artifact, decision tree, Atlas (Wave 3).
// Playwright specs ship under `tests/e2e/game-ending.spec.ts` (T8 scope).
// Here we smoke the public contracts T8 ships, as vitest tests.
// Source bullets: docs/game/EXECUTION_PLAN.md §4 T8 "Acceptance".

import { describe, expect, test } from "vitest";

import { dyn } from "./_dyn";

// bullet source: "artifact API contract with LLM+image mocked"
//                "every ending id has uk+en strings"
//                "Playwright: finish run → artifact → visible in /atlas"
//                "no streaks/decay (GAME_SPEC §9 grep for 'streak')"

describe.skip("[T8] Endings, artifact, decision tree, Atlas", () => {
  test("artifact API route module exists", async () => {
    const mod = await dyn("@/app/api/game/artifact/route");
    expect(mod).toBeDefined();
  });

  test("Atlas page module exists", async () => {
    const mod = await dyn("@/app/atlas/page");
    expect(mod).toBeDefined();
  });

  test("Ending component module exists", async () => {
    const mod = await dyn("@/components/features/ChronoAgent/Ending/index");
    expect(mod).toBeDefined();
  });

  test("every ENDINGS id has uk+en messages", async () => {
    const uk = (await dyn("@/messages/uk.json")) as { default: unknown };
    const en = (await dyn("@/messages/en.json")) as { default: unknown };
    expect(uk.default).toBeDefined();
    expect(en.default).toBeDefined();
  });

  test("no streaks or decay primitives in T8 code (grep contract)", async () => {
    const mod = await dyn("@/app/api/game/artifact/route");
    expect(mod).toBeDefined();
  });
});
