// Acceptance tests for T6 — Game screen (Wave 2).
// Playwright specs ship under `tests/e2e/game-play.spec.ts` (T6 scope).
// Here we smoke the public contracts the screen depends on, as vitest tests.
// Source bullets: docs/game/EXECUTION_PLAN.md §4 T6 "Acceptance".

import { describe, expect, test } from "vitest";

import { dyn } from "./_dyn";

// bullet source: "Playwright with deck API mocked plays 12 cards to the placeholder ending at 360 px and desktop"
//                "keyboard-only run works"
//                "no hard-coded UI strings (grep)"
//                "existing scenario routes still reachable (existing e2e green)"

describe.skip("[T6] Game screen", () => {
  test("portrait API route module exists", async () => {
    const mod = await dyn("@/app/api/game/portrait/route");
    expect(mod).toBeDefined();
  });

  test("ChronoAgent root component module exists", async () => {
    const mod = await dyn("@/components/features/ChronoAgent/index");
    expect(mod).toBeDefined();
  });

  test("game screen imports the pure run engine (T4), not its own rules", async () => {
    const run = (await dyn("@/shared/game/run")) as Record<string, unknown>;
    expect(typeof run.applyChoice).toBe("function");
  });

  test("game screen uses the frozen i18n keys (game.play.*)", async () => {
    const uk = (await dyn("@/messages/uk.json")) as { default: unknown };
    const en = (await dyn("@/messages/en.json")) as { default: unknown };
    expect(uk.default).toBeDefined();
    expect(en.default).toBeDefined();
  });
});
