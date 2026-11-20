// Fairness tests for the reference deck (shared/game/referenceDeck1648.json).
// Source: docs/game/CHRONICLE_RULES.md §3 — "a clear entry is always true" and
// "the number of faded entries must equal floor((50 − lowestStability) / 15), capped at 5".

import { describe, expect, test } from "vitest";

import { validateDeck } from "@/shared/game/deckSchema";
import { entryIsTrue, initRun, play, result } from "@/shared/game/engine";
import referenceDeckJson from "@/shared/game/referenceDeck1648.json";
import type { Deck, RunState, Side } from "@/types/game";

const deck = referenceDeckJson as unknown as Deck;

function pattern(text: string): Side[] {
  return text.split("").map((ch) => (ch === "L" ? "left" : "right"));
}

const SEQUENCES: [string, Side[]][] = [
  ["all left", pattern("LLLLLLLLLLLL")],
  ["all right", pattern("RRRRRRRRRRRR")],
  ["alternating from left", pattern("LRLRLRLRLRLR")],
  ["alternating from right", pattern("RLRLRLRLRLRL")],
  ["pairs", pattern("LLRRLLRRLLRR")],
  ["mixed A", pattern("RRLRLLRLRRLL")],
  ["mixed B", pattern("LRRRLRLLRRRL")],
];

function expectedFadedCount(lowestStability: number): number {
  return Math.min(5, Math.floor((50 - Math.min(50, lowestStability)) / 15));
}

function fadedCount(state: RunState): number {
  return Object.values(state.chronicle).filter((entryState) => entryState === "faded").length;
}

describe("reference deck 1648 — shape", () => {
  test("passes validateDeck", () => {
    const res = validateDeck(referenceDeckJson);
    expect(res.ok === false ? res.errors : []).toEqual([]);
    expect(res.ok).toBe(true);
  });

  test("is the 1648 deck with five entries and twelve cards", () => {
    expect(deck.year).toBe(1648);
    expect(deck.chronicle).toHaveLength(5);
    expect(deck.cards).toHaveLength(12);
  });

  test("with every entry clear, all five entries are true", () => {
    const state = initRun(deck);
    expect(Object.keys(state.chronicle).sort()).toEqual(deck.chronicle.map((e) => e.id).sort());
    for (const entry of deck.chronicle) {
      expect(state.chronicle[entry.id]).toBe("clear");
      expect(entryIsTrue(deck, state, entry.id)).toBe(true);
    }
  });
});

describe("reference deck 1648 — fairness holds after every step", () => {
  test.each(SEQUENCES)("%s", (_name, sides) => {
    expect(sides).toHaveLength(12);

    let state = initRun(deck);
    let lowest = 50;
    let steps = 0;

    for (const side of sides) {
      if (state.status !== "playing") break;
      const before = state;
      state = play(state, deck, side);
      steps += 1;

      expect(state.cardIndex).toBe(steps);
      expect(state.log).toHaveLength(steps);

      // The lowest Stability is tracked independently from the engine's own field.
      lowest = Math.min(lowest, state.meters.stability);
      expect(state.lowestStability).toBe(lowest);

      // Faded count equals the formula.
      expect(fadedCount(state)).toBe(expectedFadedCount(lowest));

      for (const entry of deck.chronicle) {
        // A clear entry is always true.
        if (state.chronicle[entry.id] === "clear") {
          expect(entryIsTrue(deck, state, entry.id)).toBe(true);
        } else {
          // A faded entry is true exactly when it survives fading.
          expect(state.chronicle[entry.id]).toBe("faded");
          expect(entryIsTrue(deck, state, entry.id)).toBe(entry.survivesFading);
        }
        // Fading never reverts.
        if (before.chronicle[entry.id] === "faded") {
          expect(state.chronicle[entry.id]).toBe("faded");
        }
      }

      // Every meter stays inside 0–100.
      for (const value of Object.values(state.meters)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    }

    // The run has ended one way or the other and yields a full result.
    expect(state.status).not.toBe("playing");
    if (state.status === "finished") expect(steps).toBe(12);
    const res = result(state);
    expect(["nobody", "noticed", "needed", "influential", "summit"]).toContain(res.rung);
    expect(["as_it_was", "shifted", "unrecognisable", "torn"]).toContain(res.worldFate);
    expect(res.collapsedMeter).toBe(state.collapsedMeter);
    expect(state.status === "collapsed").toBe(res.collapsedMeter !== undefined);
  });

  test("replaying the same sequence gives the same run", () => {
    const sides = pattern("RRLRLLRLRRLL");
    const once = sides.reduce<RunState>((s, side) => play(s, deck, side), initRun(deck));
    const twice = sides.reduce<RunState>((s, side) => play(s, deck, side), initRun(deck));
    expect(twice).toEqual(once);
    expect(once.log.length).toBeGreaterThan(0);
    expect(once.log[0].cardId).toBe(deck.cards[0].id);
  });
});
