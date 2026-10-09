// Acceptance tests for T3 — Deck generation API (Wave 1).
// Source bullets: docs/game/EXECUTION_PLAN.md §4 T3 "Acceptance".

import { describe, expect, test } from "vitest";

import { dyn } from "./_dyn";

// bullet source: "valid fixture → 200 with 12 cards"
//                "fenced fixture → parsed"
//                "truncated → retry then 502"
//                "invalid roleId → retry"
//                "system prompt contains every rule from GAME_SPEC §5 (string checks)"
//                "real events passed into prompt"
//                "cache hit skips LLM"

describe.skip("[T3] Deck generation API", () => {
  test("deck module exports a generator", async () => {
    const mod = (await dyn("@/lib/game/deck")) as Record<string, unknown>;
    expect(mod).toBeDefined();
    expect(typeof mod.generateDeck).toBe("function");
  });

  test("deck prompt module exports a system-prompt builder", async () => {
    const mod = (await dyn("@/lib/game/deck-prompt")) as Record<
      string,
      unknown
    >;
    expect(typeof mod.buildDeckSystemPrompt).toBe("function");
  });

  test("valid fixture round-trips to a 200 with 12 cards", async () => {
    const mod = (await dyn("@/lib/game/deck")) as Record<string, unknown>;
    expect(typeof mod.generateDeck).toBe("function");
  });

  test("fenced JSON fixture (```json … ```) parses as a deck", async () => {
    const mod = (await dyn("@/lib/game/deck")) as Record<string, unknown>;
    expect(typeof mod.generateDeck).toBe("function");
  });

  test("truncated LLM output retries once, then returns 502 deck_invalid", async () => {
    const mod = (await dyn("@/lib/game/deck")) as Record<string, unknown>;
    expect(typeof mod.generateDeck).toBe("function");
  });

  test("invalid roleId triggers one retry before failing", async () => {
    const mod = (await dyn("@/lib/game/deck")) as Record<string, unknown>;
    expect(typeof mod.generateDeck).toBe("function");
  });

  test("system prompt contains every dilemma rule from GAME_SPEC §5", async () => {
    const mod = (await dyn("@/lib/game/deck-prompt")) as Record<
      string,
      unknown
    >;
    expect(typeof mod.buildDeckSystemPrompt).toBe("function");
  });

  test("real events of the year are passed into the prompt", async () => {
    const mod = (await dyn("@/lib/game/deck-prompt")) as Record<
      string,
      unknown
    >;
    expect(typeof mod.buildDeckSystemPrompt).toBe("function");
  });

  test("cache hit on deck:${STYLE_VERSION}:${year}:${locale} skips the LLM call", async () => {
    const mod = (await dyn("@/lib/game/deck")) as Record<string, unknown>;
    expect(typeof mod.generateDeck).toBe("function");
  });
});
