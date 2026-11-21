// Acceptance tests for the Chronicle engine (shared/game/engine.ts).
// Source: docs/game/CHRONICLE_RULES.md §2, §3, §4 (trace rung, hint reveal), §5, §6.
// Written before the implementation: the engine must make these pass unedited.

import { describe, expect, test } from "vitest";

import { correctSide, entryIsTrue, initRun, play, result } from "@/shared/game/engine";
import type { Card, Deck, EntryState, Meter, RunState, Side } from "@/types/game";

import {
  clone,
  deckWith,
  deepFreeze,
  filler,
  fork,
  hint,
  makeDeck,
  option,
  stabilityForks,
  trace,
} from "./_deck";

function run(deck: Deck, sides: readonly Side[]): RunState {
  return sides.reduce<RunState>((state, side) => play(state, deck, side), initRun(deck));
}

function rights(n: number): Side[] {
  return Array.from({ length: n }, () => "right" as Side);
}

function lefts(n: number): Side[] {
  return Array.from({ length: n }, () => "left" as Side);
}

function fadedIds(state: RunState): string[] {
  return Object.keys(state.chronicle)
    .filter((id) => state.chronicle[id] === "faded")
    .sort();
}

const ALL_CLEAR: Record<string, EntryState> = {
  e1: "clear",
  e2: "clear",
  e3: "clear",
  e4: "clear",
  e5: "clear",
};

describe("initRun (§2, §3, §5)", () => {
  test("starts the Commoner with 50/60/30/50, a clear Chronicle and rung nobody", () => {
    const state = initRun(makeDeck());
    expect(state).toEqual({
      meters: { stability: 50, people: 60, power: 30, faith: 50 },
      chronicle: ALL_CLEAR,
      revealed: {},
      rung: "nobody",
      cardIndex: 0,
      lowestStability: 50,
      log: [],
      status: "playing",
    });
    expect(state.collapsedMeter).toBeUndefined();
  });

  test("keys the Chronicle state by the deck's own entry ids", () => {
    const deck = makeDeck();
    deck.chronicle[0].id = "khmelnytsky";
    deck.chronicle[4].id = "westphalia";
    const state = initRun(deck);
    expect(Object.keys(state.chronicle).sort()).toEqual(
      ["e2", "e3", "e4", "khmelnytsky", "westphalia"].sort(),
    );
    expect(state.chronicle.khmelnytsky).toBe("clear");
    expect(state.chronicle.westphalia).toBe("clear");
  });

  test("two fresh runs do not share mutable state", () => {
    const deck = makeDeck();
    const a = initRun(deck);
    const b = initRun(deck);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a.meters).not.toBe(b.meters);
    expect(a.chronicle).not.toBe(b.chronicle);
    expect(a.log).not.toBe(b.log);
  });
});

describe("effects (§2)", () => {
  test("people, power and faith effects apply in full", () => {
    const deck = deckWith([
      fork("a", option({ people: -7, power: 9, faith: -11 }), option({ people: 3 })),
    ]);
    const state = play(initRun(deck), deck, "left");
    expect(state.meters).toEqual({ stability: 50, people: 53, power: 39, faith: 39 });
  });

  test("the chosen side's effects are applied, not the other side's", () => {
    const deck = deckWith([
      fork("a", option({ people: -7, power: 9, faith: -11 }), option({ people: 3 })),
    ]);
    const state = play(initRun(deck), deck, "right");
    expect(state.meters).toEqual({ stability: 50, people: 63, power: 30, faith: 50 });
  });

  test.each([
    [-25, 38],
    [-24, 38],
    [15, 57],
    [25, 62],
    [-1, 50],
    [1, 50],
    [-3, 49],
    [3, 51],
    [-2, 49],
  ])("Stability effect %i is halved toward zero → Stability %i", (effect, expected) => {
    const deck = deckWith(stabilityForks([effect]));
    const state = play(initRun(deck), deck, "right");
    expect(state.meters.stability).toBe(expected);
    expect(state.lowestStability).toBe(Math.min(50, expected));
    expect(state.meters).toMatchObject({ people: 60, power: 30, faith: 50 });
  });

  test("only Stability is halved when an option changes several meters", () => {
    const deck = deckWith([
      fork("a", option({ faith: 1 }), option({ stability: -25, people: 15, power: -1 })),
    ]);
    const state = play(initRun(deck), deck, "right");
    expect(state.meters).toEqual({ stability: 38, people: 75, power: 29, faith: 50 });
  });

  test("effects accumulate from card to card", () => {
    const deck = deckWith([
      fork("a", option({ people: -10 }), option({ people: 1 })),
      fork("b", option({ people: 1 }), option({ people: 4, stability: 15 })),
      fork("c", option({ faith: -20, power: 5 }), option({ people: 1 })),
    ]);
    const state = run(deck, ["left", "right", "left"]);
    expect(state.meters).toEqual({ stability: 57, people: 54, power: 35, faith: 30 });
    expect(state.cardIndex).toBe(3);
    expect(state.status).toBe("playing");
  });
});

describe("clamping and collapse (§2)", () => {
  test("a meter reaching exactly 100 collapses the run", () => {
    const deck = deckWith([
      fork("a", option({ faith: 1 }), option({ people: 25 })),
      fork("b", option({ faith: 1 }), option({ people: 15 })),
    ]);
    const afterOne = run(deck, ["right"]);
    expect(afterOne.meters.people).toBe(85);
    expect(afterOne.status).toBe("playing");

    const state = run(deck, ["right", "right"]);
    expect(state.meters.people).toBe(100);
    expect(state.status).toBe("collapsed");
    expect(state.collapsedMeter).toBe("people");
  });

  test("a meter pushed past 100 is clamped to 100 and collapses", () => {
    const deck = deckWith([
      fork("a", option({ faith: 1 }), option({ people: 25 })),
      fork("b", option({ faith: 1 }), option({ people: 25 })),
    ]);
    const state = run(deck, ["right", "right"]);
    expect(state.meters.people).toBe(100);
    expect(state.status).toBe("collapsed");
    expect(state.collapsedMeter).toBe("people");
    // The log keeps the effect as applied (before clamping) and the clamped meter.
    expect(state.log[1].applied.people).toBe(25);
    expect(state.log[1].metersAfter.people).toBe(100);
  });

  test("a meter reaching exactly 0 collapses the run", () => {
    const deck = deckWith([
      fork("a", option({ faith: 1 }), option({ power: -25 })),
      fork("b", option({ faith: 1 }), option({ power: -5 })),
    ]);
    const state = run(deck, ["right", "right"]);
    expect(state.meters.power).toBe(0);
    expect(state.status).toBe("collapsed");
    expect(state.collapsedMeter).toBe("power");
  });

  test("a meter pushed below 0 is clamped to 0 and collapses", () => {
    const deck = deckWith([
      fork("a", option({ faith: 1 }), option({ power: -25 })),
      fork("b", option({ faith: 1 }), option({ power: -25 })),
    ]);
    const state = run(deck, ["right", "right"]);
    expect(state.meters.power).toBe(0);
    expect(state.status).toBe("collapsed");
    expect(state.collapsedMeter).toBe("power");
    expect(state.log[1].applied.power).toBe(-25);
    expect(state.log[1].metersAfter.power).toBe(0);
  });

  test("faith collapses at 0 too", () => {
    const deck = deckWith([
      fork("a", option({ people: 1 }), option({ faith: -25 })),
      fork("b", option({ people: 1 }), option({ faith: -25 })),
    ]);
    const state = run(deck, ["right", "right"]);
    expect(state.meters.faith).toBe(0);
    expect(state.status).toBe("collapsed");
    expect(state.collapsedMeter).toBe("faith");
  });

  test("99 and 1 do not collapse", () => {
    const deck = deckWith([
      fork("a", option({ faith: 1 }), option({ people: 25, power: -25 })),
      fork("b", option({ faith: 1 }), option({ people: 14, power: -4 })),
    ]);
    const state = run(deck, ["right", "right"]);
    expect(state.meters.people).toBe(99);
    expect(state.meters.power).toBe(1);
    expect(state.status).toBe("playing");
    expect(state.collapsedMeter).toBeUndefined();
  });

  test("Stability falling to 0 collapses, is clamped, and fades three entries", () => {
    // 50 → 38 → 26 → 14 → 2 → (2 - 5 = -3, clamped) 0
    const deck = deckWith(stabilityForks([-24, -24, -24, -24, -10]));
    const before = run(deck, rights(4));
    expect(before.meters.stability).toBe(2);
    expect(before.status).toBe("playing");

    const state = run(deck, rights(5));
    expect(state.meters.stability).toBe(0);
    expect(state.lowestStability).toBe(0);
    expect(state.status).toBe("collapsed");
    expect(state.collapsedMeter).toBe("stability");
    expect(fadedIds(state)).toEqual(["e1", "e2", "e3"]);
  });

  test("Stability rising to 100 collapses too, with nothing faded", () => {
    // 50 → 62 → 74 → 86 → 98 → (98 + 5 = 103, clamped) 100
    const deck = deckWith(stabilityForks([24, 24, 24, 24, 10]));
    const before = run(deck, rights(4));
    expect(before.meters.stability).toBe(98);
    expect(before.status).toBe("playing");

    const state = run(deck, rights(5));
    expect(state.meters.stability).toBe(100);
    expect(state.lowestStability).toBe(50);
    expect(state.status).toBe("collapsed");
    expect(state.collapsedMeter).toBe("stability");
    expect(fadedIds(state)).toEqual([]);
  });

  test("tie-break: stability wins over faith when both collapse at once", () => {
    const deck = deckWith([
      fork("a", option({ people: 1 }), option({ stability: -24, faith: -24 })), // 38, 26
      fork("b", option({ people: 1 }), option({ stability: -24, faith: -24 })), // 26, 2
      fork("c", option({ people: 1 }), option({ stability: -24 })), // 14
      fork("d", option({ people: 1 }), option({ stability: -24 })), // 2
      fork("e", option({ people: 1 }), option({ stability: -4, faith: -2 })), // 0, 0
    ]);
    const before = run(deck, rights(4));
    expect(before.meters).toMatchObject({ stability: 2, faith: 2 });
    expect(before.status).toBe("playing");

    const state = run(deck, rights(5));
    expect(state.meters).toMatchObject({ stability: 0, faith: 0 });
    expect(state.status).toBe("collapsed");
    expect(state.collapsedMeter).toBe("stability");
  });

  test("tie-break: people wins over power when both collapse at once", () => {
    const deck = deckWith([
      fork("a", option({ faith: 1 }), option({ power: -25, people: 25 })),
      fork("b", option({ faith: 1 }), option({ power: -25, people: 25 })),
    ]);
    const state = run(deck, ["right", "right"]);
    expect(state.meters).toMatchObject({ people: 100, power: 0 });
    expect(state.status).toBe("collapsed");
    expect(state.collapsedMeter).toBe("people");
  });

  test("tie-break: power wins over faith when both collapse at once", () => {
    const deck = deckWith([
      fork("a", option({ people: 1 }), option({ faith: -25, power: -25 })), // 25, 5
      fork("b", option({ people: 1 }), option({ faith: -25, power: -5 })), // 0, 0
    ]);
    const state = run(deck, ["right", "right"]);
    expect(state.meters).toMatchObject({ power: 0, faith: 0 });
    expect(state.status).toBe("collapsed");
    expect(state.collapsedMeter).toBe("power");
  });

  test("the collapsing choice is still logged and the card index still advances (§6 order)", () => {
    const deck = deckWith([
      fork("a", option({ faith: 1 }), option({ power: -25 })),
      fork("b", option({ faith: 1 }), option({ power: -5 })),
    ]);
    const state = run(deck, ["right", "right"]);
    expect(state.status).toBe("collapsed");
    expect(state.log).toHaveLength(2);
    expect(state.log[1].cardId).toBe("b");
    expect(state.log[1].side).toBe("right");
    expect(state.cardIndex).toBe(2);
  });

  test("a collapse on the twelfth card ends the run as collapsed, not finished", () => {
    const cards: Card[] = [
      ...Array.from({ length: 11 }, (_, i) => filler(`f${i + 1}`)),
      fork("last", option({ people: 1 }), option({ power: -25, faith: -25 })),
    ];
    const deck = deckWith(cards);
    // Eleven fillers played right: faith 50 → 39. Then power 30 → 5, faith 39 → 14.
    const noCollapse = run(deck, rights(12));
    expect(noCollapse.meters).toMatchObject({ power: 5, faith: 14 });
    expect(noCollapse.status).toBe("finished");

    const collapsing = clone(deck);
    collapsing.cards[11].right.effects = { power: -25, faith: -25, people: 5 };
    collapsing.cards[10].right.effects = { power: -5 };
    // Ten fillers right: faith 40. Card 11: power 25. Card 12: power 0, faith 15.
    const state = run(collapsing, rights(12));
    expect(state.meters).toMatchObject({ power: 0, faith: 15, people: 65 });
    expect(state.cardIndex).toBe(12);
    expect(state.status).toBe("collapsed");
    expect(state.collapsedMeter).toBe("power");
  });
});

describe("fading (§3)", () => {
  test.each<[number[], number, string[]]>([
    [[-24, -4], 36, []],
    [[-24, -6], 35, ["e1"]],
    [[-24, -24, -10], 21, ["e1"]],
    [[-24, -24, -12], 20, ["e1", "e2"]],
    [[-24, -24, -24, -16], 6, ["e1", "e2"]],
    [[-24, -24, -24, -18], 5, ["e1", "e2", "e3"]],
  ])("Stability effects %j → lowest %i → faded %j", (effects, lowest, expected) => {
    const deck = deckWith(stabilityForks(effects));
    const state = run(deck, rights(effects.length));
    expect(state.meters.stability).toBe(lowest);
    expect(state.lowestStability).toBe(lowest);
    expect(fadedIds(state)).toEqual(expected);
    expect(state.status).toBe("playing");
  });

  test("nothing fades at the start or while Stability only rises", () => {
    const deck = deckWith(stabilityForks([24, 24]));
    const state = run(deck, rights(2));
    expect(state.meters.stability).toBe(74);
    expect(state.lowestStability).toBe(50);
    expect(state.chronicle).toEqual(ALL_CLEAR);
  });

  test("fading never reverts when Stability recovers", () => {
    // 50 → 38 → 35 (one fade) → 47 → 36 → 24 → 20 (second fade)
    const deck = deckWith(stabilityForks([-24, -6, 24, -22, -24, -8]));

    const faded = run(deck, rights(2));
    expect(faded.meters.stability).toBe(35);
    expect(fadedIds(faded)).toEqual(["e1"]);

    const recovered = run(deck, rights(3));
    expect(recovered.meters.stability).toBe(47);
    expect(recovered.lowestStability).toBe(35);
    expect(recovered.chronicle).toEqual({ ...ALL_CLEAR, e1: "faded" });
    expect(recovered.log[2].fadedEntryIds).toEqual([]);

    const droppedAgain = run(deck, rights(4));
    expect(droppedAgain.meters.stability).toBe(36);
    expect(droppedAgain.lowestStability).toBe(35);
    expect(fadedIds(droppedAgain)).toEqual(["e1"]);

    const lower = run(deck, rights(5));
    expect(lower.meters.stability).toBe(24);
    expect(lower.lowestStability).toBe(24);
    expect(fadedIds(lower)).toEqual(["e1"]);

    const second = run(deck, rights(6));
    expect(second.meters.stability).toBe(20);
    expect(second.lowestStability).toBe(20);
    expect(fadedIds(second)).toEqual(["e1", "e2"]);
    expect(second.log[5].fadedEntryIds).toEqual(["e2"]);
  });

  test("the chosen option's fadesEntryId fades first when that entry is clear", () => {
    const deck = deckWith([
      fork("a", option({ faith: 1 }), option({ stability: -24 })),
      fork("b", option({ faith: 1 }), option({ stability: -6 }, { fadesEntryId: "e4" })),
    ]);
    const state = run(deck, rights(2));
    expect(state.meters.stability).toBe(35);
    expect(state.chronicle).toEqual({ ...ALL_CLEAR, e4: "faded" });
    expect(state.log[1].fadedEntryIds).toEqual(["e4"]);
  });

  test("with no fadesEntryId the first clear entry in deck order fades", () => {
    const deck = deckWith([
      fork("a", option({ faith: 1 }), option({ stability: -24 })),
      fork("b", option({ faith: 1 }), option({ stability: -6 })),
    ]);
    const state = run(deck, rights(2));
    expect(state.chronicle).toEqual({ ...ALL_CLEAR, e1: "faded" });
    expect(state.log[1].fadedEntryIds).toEqual(["e1"]);
  });

  test("when fadesEntryId is already faded, the first clear entry in deck order fades instead", () => {
    const deck = deckWith([
      fork("a", option({ faith: 1 }), option({ stability: -24 })), // 38
      fork("b", option({ faith: 1 }), option({ stability: -6 }, { fadesEntryId: "e4" })), // 35 → e4
      fork("c", option({ faith: 1 }), option({ stability: -24 })), // 23
      fork("d", option({ faith: 1 }), option({ stability: -6 }, { fadesEntryId: "e4" })), // 20 → e1
      fork("e", option({ faith: 1 }), option({ stability: -24 })), // 8
      fork("f", option({ faith: 1 }), option({ stability: -6 }, { fadesEntryId: "e1" })), // 5 → e2
    ]);
    const second = run(deck, rights(4));
    expect(second.meters.stability).toBe(20);
    expect(second.chronicle).toEqual({ ...ALL_CLEAR, e4: "faded", e1: "faded" });
    expect(second.log[3].fadedEntryIds).toEqual(["e1"]);

    const third = run(deck, rights(6));
    expect(third.meters.stability).toBe(5);
    expect(third.chronicle).toEqual({ ...ALL_CLEAR, e4: "faded", e1: "faded", e2: "faded" });
    expect(third.log[5].fadedEntryIds).toEqual(["e2"]);
  });

  test("fadesEntryId alone fades nothing when no fade is due", () => {
    const deck = deckWith([
      fork("a", option({ faith: 1 }), option({ stability: -24 }, { fadesEntryId: "e2" })),
    ]);
    const state = run(deck, rights(1));
    expect(state.meters.stability).toBe(38);
    expect(state.chronicle).toEqual(ALL_CLEAR);
    expect(state.log[0].fadedEntryIds).toEqual([]);
  });

  test("only the CHOSEN option's fadesEntryId counts", () => {
    const deck = deckWith([
      fork("a", option({ stability: -24 }), option({ stability: -24 })),
      fork(
        "b",
        option({ stability: -6 }, { fadesEntryId: "e5" }),
        option({ stability: -6 }, { fadesEntryId: "e3" }),
      ),
    ]);
    expect(run(deck, ["left", "left"]).chronicle).toEqual({ ...ALL_CLEAR, e5: "faded" });
    expect(run(deck, ["left", "right"]).chronicle).toEqual({ ...ALL_CLEAR, e3: "faded" });
  });

  test("when one choice makes two fades due, fadesEntryId goes first, then the first clear entry", () => {
    // Engine-only input (outside the schema range): -60 halves to -30, 50 → 20, two fades due.
    const deck = deckWith([
      fork("a", option({ faith: 1 }), option({ stability: -60 }, { fadesEntryId: "e4" })),
    ]);
    const state = run(deck, rights(1));
    expect(state.meters.stability).toBe(20);
    expect(state.chronicle).toEqual({ ...ALL_CLEAR, e4: "faded", e1: "faded" });
    expect(state.log[0].fadedEntryIds).toEqual(["e4", "e1"]);
  });
});

describe("entryIsTrue (§3)", () => {
  test("every clear entry is true, whatever its survivesFading flag", () => {
    const deck = makeDeck();
    const state = initRun(deck);
    for (const id of ["e1", "e2", "e3", "e4", "e5"]) {
      expect(entryIsTrue(deck, state, id)).toBe(true);
    }
  });

  test("a faded entry that survives fading is still true", () => {
    // e1 (survives) is the first clear entry, so it is the one that fades at 35.
    const deck = deckWith(stabilityForks([-24, -6]));
    const state = run(deck, rights(2));
    expect(state.chronicle.e1).toBe("faded");
    expect(entryIsTrue(deck, state, "e1")).toBe(true);
  });

  test("a faded entry that does not survive fading is false", () => {
    const deck = deckWith([
      fork("a", option({ faith: 1 }), option({ stability: -24 })),
      fork("b", option({ faith: 1 }), option({ stability: -6 }, { fadesEntryId: "e2" })),
    ]);
    const state = run(deck, rights(2));
    expect(state.chronicle.e2).toBe("faded");
    expect(entryIsTrue(deck, state, "e2")).toBe(false);
    // The other entries are untouched and still true.
    expect(entryIsTrue(deck, state, "e1")).toBe(true);
    expect(entryIsTrue(deck, state, "e4")).toBe(true);
  });

  test("is decided by the given state and the deck's flags", () => {
    const deck = makeDeck();
    const state: RunState = {
      ...initRun(deck),
      chronicle: { e1: "faded", e2: "faded", e3: "clear", e4: "faded", e5: "clear" },
    };
    expect(entryIsTrue(deck, state, "e1")).toBe(true); // faded, survives
    expect(entryIsTrue(deck, state, "e2")).toBe(false); // faded, does not survive
    expect(entryIsTrue(deck, state, "e3")).toBe(true); // clear
    expect(entryIsTrue(deck, state, "e4")).toBe(false); // faded, does not survive
    expect(entryIsTrue(deck, state, "e5")).toBe(true); // clear, would not survive
  });
});

describe("trace cards and rungs (§4, §5)", () => {
  const traceCard = trace("t", "e2", "left", option({ power: 5 }), option({ people: 5 }));

  test("correctSide is the card's `correct` while the referenced entry is clear", () => {
    const deck = deckWith([traceCard]);
    expect(correctSide(deck, initRun(deck), deck.cards[0])).toBe("left");

    const mirrored = deckWith([trace("t", "e2", "right", option({ power: 5 }), option({ people: 5 }))]);
    expect(correctSide(mirrored, initRun(mirrored), mirrored.cards[0])).toBe("right");
  });

  test("correctSide is undefined for fork and hint cards", () => {
    const deck = makeDeck();
    const state = initRun(deck);
    expect(deck.cards[0].kind).toBe("fork");
    expect(correctSide(deck, state, deck.cards[0])).toBeUndefined();
    expect(deck.cards[2].kind).toBe("hint");
    expect(correctSide(deck, state, deck.cards[2])).toBeUndefined();
  });

  test("a correct trace raises the rung by one and its effects apply", () => {
    const deck = deckWith([traceCard]);
    const state = play(initRun(deck), deck, "left");
    expect(state.rung).toBe("noticed");
    expect(state.meters).toEqual({ stability: 50, people: 60, power: 35, faith: 50 });
    expect(state.log[0].traceCorrect).toBe(true);
  });

  test("a wrong trace leaves the rung alone but its effects still apply", () => {
    const deck = deckWith([traceCard]);
    const state = play(initRun(deck), deck, "right");
    expect(state.rung).toBe("nobody");
    expect(state.meters).toEqual({ stability: 50, people: 65, power: 30, faith: 50 });
    expect(state.log[0].traceCorrect).toBe(false);
  });

  test("fork and hint cards never change the rung", () => {
    const deck = deckWith([
      fork("a", option({ power: 20 }), option({ people: 20 })),
      hint("h", option({ people: -5 }, { revealsEntryId: "e1" }), option({ power: 1 })),
    ]);
    expect(run(deck, ["left", "left"]).rung).toBe("nobody");
    expect(run(deck, ["right", "right"]).rung).toBe("nobody");
  });

  test("the rung climbs nobody → noticed → needed → influential → summit and stops there", () => {
    const deck = deckWith([
      trace("t1", "e1", "left", option({ faith: 1 }), option({ faith: -1 })),
      trace("t2", "e2", "right", option({ faith: 1 }), option({ faith: -1 })),
      trace("t3", "e3", "left", option({ faith: 1 }), option({ faith: -1 })),
      trace("t4", "e4", "right", option({ faith: 1 }), option({ faith: -1 })),
      trace("t5", "e5", "left", option({ faith: 1 }), option({ faith: -1 })),
    ]);
    const sides: Side[] = ["left", "right", "left", "right", "left"];
    expect(run(deck, sides.slice(0, 1)).rung).toBe("noticed");
    expect(run(deck, sides.slice(0, 2)).rung).toBe("needed");
    expect(run(deck, sides.slice(0, 3)).rung).toBe("influential");
    expect(run(deck, sides.slice(0, 4)).rung).toBe("summit");

    const top = run(deck, sides);
    expect(top.rung).toBe("summit");
    expect(top.log[4].traceCorrect).toBe(true);
    expect(top.status).toBe("playing");
  });

  test("a wrong trace between correct ones neither raises nor lowers the rung", () => {
    const deck = deckWith([
      trace("t1", "e1", "left", option({ faith: 1 }), option({ faith: -1 })),
      trace("t2", "e2", "right", option({ faith: 1 }), option({ faith: -1 })),
      trace("t3", "e3", "left", option({ faith: 1 }), option({ faith: -1 })),
    ]);
    const state = run(deck, ["left", "left", "left"]);
    expect(state.log.map((entry) => entry.traceCorrect)).toEqual([true, false, true]);
    expect(state.rung).toBe("needed");
  });

  test("the correct side flips once the referenced entry has faded and does not survive", () => {
    const cards = [
      fork("a", option({ faith: 1 }), option({ stability: -24 })),
      fork("b", option({ faith: 1 }), option({ stability: -6 }, { fadesEntryId: "e2" })),
      traceCard, // references e2 (does not survive), correct "left" while e2 is true
    ];
    const deck = deckWith(cards);
    const before = run(deck, rights(2));
    expect(before.chronicle.e2).toBe("faded");
    expect(entryIsTrue(deck, before, "e2")).toBe(false);
    expect(correctSide(deck, before, deck.cards[2])).toBe("right");

    const trustSpeaker = play(before, deck, "right");
    expect(trustSpeaker.rung).toBe("noticed");
    expect(trustSpeaker.log[2].traceCorrect).toBe(true);

    const trustChronicle = play(before, deck, "left");
    expect(trustChronicle.rung).toBe("nobody");
    expect(trustChronicle.log[2].traceCorrect).toBe(false);
  });

  test("the correct side does not flip when the faded entry survives fading", () => {
    const deck = deckWith([
      fork("a", option({ faith: 1 }), option({ stability: -24 })),
      fork("b", option({ faith: 1 }), option({ stability: -6 }, { fadesEntryId: "e1" })),
      trace("t", "e1", "left", option({ power: 5 }), option({ people: 5 })),
    ]);
    const before = run(deck, rights(2));
    expect(before.chronicle.e1).toBe("faded");
    expect(correctSide(deck, before, deck.cards[2])).toBe("left");

    expect(play(before, deck, "left").rung).toBe("noticed");
    expect(play(before, deck, "right").rung).toBe("nobody");
  });

  test("the correct side does not flip while the entry is clear, even if others have faded", () => {
    const deck = deckWith([
      fork("a", option({ faith: 1 }), option({ stability: -24 })),
      fork("b", option({ faith: 1 }), option({ stability: -6 }, { fadesEntryId: "e4" })),
      traceCard,
    ]);
    const before = run(deck, rights(2));
    expect(before.chronicle).toEqual({ ...ALL_CLEAR, e4: "faded" });
    expect(correctSide(deck, before, deck.cards[2])).toBe("left");
    expect(play(before, deck, "left").rung).toBe("noticed");
  });

  test("correctSide follows a hand-built state as well", () => {
    const deck = deckWith([traceCard]);
    const state: RunState = {
      ...initRun(deck),
      chronicle: { ...ALL_CLEAR, e2: "faded" },
    };
    expect(correctSide(deck, state, deck.cards[0])).toBe("right");
  });

  test("the trace is judged from the state BEFORE the choice, even if the choice fades its entry", () => {
    // e1 does not survive here and is the first clear entry, so it fades at 35.
    const survives = [false, true, true, true, true];
    const deck = deckWith(
      [
        fork("a", option({ faith: 1 }), option({ stability: -24 })), // 38
        trace("t", "e1", "left", option({ stability: -6 }), option({ stability: -6 })), // 35 either way
      ],
      survives,
    );
    const before = run(deck, rights(1));
    expect(before.chronicle.e1).toBe("clear");
    expect(correctSide(deck, before, deck.cards[1])).toBe("left");

    const left = play(before, deck, "left");
    expect(left.chronicle.e1).toBe("faded");
    expect(left.log[1].fadedEntryIds).toEqual(["e1"]);
    expect(left.log[1].traceCorrect).toBe(true);
    expect(left.rung).toBe("noticed");
    // After the choice the entry is false, so the side would now be the other one.
    expect(entryIsTrue(deck, left, "e1")).toBe(false);
    expect(correctSide(deck, left, deck.cards[1])).toBe("right");

    const right = play(before, deck, "right");
    expect(right.chronicle.e1).toBe("faded");
    expect(right.log[1].traceCorrect).toBe(false);
    expect(right.rung).toBe("nobody");
  });
});

describe("hint cards (§4)", () => {
  const hintCard = hint(
    "h",
    option({ people: -10 }, { revealsEntryId: "e2" }),
    option({ power: 2 }),
  );

  test("the revealing option records the entry's survivesFading (false)", () => {
    const deck = deckWith([hintCard]);
    const state = play(initRun(deck), deck, "left");
    expect(state.revealed).toEqual({ e2: false });
    expect(state.meters.people).toBe(50);
    expect(state.log[0].revealedEntryId).toBe("e2");
  });

  test("the revealing option records the entry's survivesFading (true)", () => {
    const deck = deckWith([
      hint("h", option({ power: 2 }), option({ faith: -4 }, { revealsEntryId: "e3" })),
    ]);
    const state = play(initRun(deck), deck, "right");
    expect(state.revealed).toEqual({ e3: true });
    expect(state.log[0].revealedEntryId).toBe("e3");
  });

  test("the declining option reveals nothing", () => {
    const deck = deckWith([hintCard]);
    const state = play(initRun(deck), deck, "right");
    expect(state.revealed).toEqual({});
    expect(state.meters.power).toBe(32);
    expect(state.log[0].revealedEntryId).toBeUndefined();
  });

  test("a reveal does not fade the entry or change its truth", () => {
    const deck = deckWith([hintCard]);
    const state = play(initRun(deck), deck, "left");
    expect(state.chronicle).toEqual(ALL_CLEAR);
    expect(entryIsTrue(deck, state, "e2")).toBe(true);
  });

  test("reveals from several hints accumulate", () => {
    const deck = deckWith([
      hintCard,
      hint("h2", option({ power: 2 }), option({ faith: -4 }, { revealsEntryId: "e1" })),
    ]);
    const state = run(deck, ["left", "right"]);
    expect(state.revealed).toEqual({ e2: false, e1: true });
  });
});

describe("log (types/game.ts LogEntry)", () => {
  test("a fork entry records card, side, applied effects, meters and faded entries", () => {
    const deck = deckWith([
      fork("a", option({ faith: 1 }), option({ stability: -24, power: 10 })),
      fork("b", option({ faith: 1 }), option({ stability: -7, people: 10 }, { fadesEntryId: "e4" })),
    ]);
    const state = run(deck, rights(2));
    expect(state.log).toHaveLength(2);

    const first = state.log[0];
    expect(first.cardId).toBe("a");
    expect(first.side).toBe("right");
    expect(first.applied.stability).toBe(-12);
    expect(first.applied.power).toBe(10);
    expect(first.metersAfter).toEqual({ stability: 38, people: 60, power: 40, faith: 50 });
    expect(first.fadedEntryIds).toEqual([]);
    expect(first.traceCorrect).toBeUndefined();
    expect(first.revealedEntryId).toBeUndefined();

    const second = state.log[1];
    expect(second.cardId).toBe("b");
    expect(second.side).toBe("right");
    expect(second.applied.stability).toBe(-3); // -7 halved toward zero
    expect(second.applied.people).toBe(10);
    expect(second.metersAfter).toEqual({ stability: 35, people: 70, power: 40, faith: 50 });
    expect(second.fadedEntryIds).toEqual(["e4"]);
  });

  test("the left side is logged as left with the left option's effects", () => {
    const deck = deckWith([fork("a", option({ faith: -9 }), option({ power: 10 }))]);
    const state = run(deck, ["left"]);
    expect(state.log[0].cardId).toBe("a");
    expect(state.log[0].side).toBe("left");
    expect(state.log[0].applied.faith).toBe(-9);
    expect(state.log[0].metersAfter).toEqual({ stability: 50, people: 60, power: 30, faith: 41 });
  });

  test("trace entries carry traceCorrect, hint entries carry revealedEntryId", () => {
    const deck = deckWith([
      trace("t", "e1", "left", option({ power: 5 }), option({ people: 5 })),
      hint("h", option({ people: -10 }, { revealsEntryId: "e5" }), option({ power: 2 })),
    ]);
    const state = run(deck, ["right", "left"]);
    expect(state.log[0].traceCorrect).toBe(false);
    expect(state.log[0].revealedEntryId).toBeUndefined();
    expect(state.log[1].traceCorrect).toBeUndefined();
    expect(state.log[1].revealedEntryId).toBe("e5");
    expect(state.log.map((entry) => entry.cardId)).toEqual(["t", "h"]);
  });

  test("metersAfter of the last entry always equals the state's meters", () => {
    const deck = makeDeck();
    let state = initRun(deck);
    const sides: Side[] = ["right", "left", "right", "left", "right", "left"];
    for (const side of sides) {
      state = play(state, deck, side);
      expect(state.log[state.log.length - 1].metersAfter).toEqual(state.meters);
    }
    expect(state.log).toHaveLength(6);
  });
});

describe("end of the run and purity (§5, §6)", () => {
  test("the run is still playing after eleven cards and finished after the twelfth", () => {
    const deck = deckWith([]);
    const eleven = run(deck, lefts(11));
    expect(eleven.status).toBe("playing");
    expect(eleven.cardIndex).toBe(11);

    const twelve = play(eleven, deck, "left");
    expect(twelve.status).toBe("finished");
    expect(twelve.cardIndex).toBe(12);
    expect(twelve.log).toHaveLength(12);
    expect(twelve.meters.faith).toBe(62);
    expect(twelve.collapsedMeter).toBeUndefined();
  });

  test("cardIndex advances by one per choice and picks the next card", () => {
    const deck = makeDeck();
    const state = run(deck, ["left", "left", "left"]);
    expect(state.cardIndex).toBe(3);
    expect(state.log.map((entry) => entry.cardId)).toEqual(["c01", "c02", "c03"]);
  });

  test("play is a no-op after the run has finished", () => {
    const deck = deckWith([]);
    const finished = run(deck, lefts(12));
    expect(finished.status).toBe("finished");
    const snapshot = clone(finished);

    expect(play(finished, deck, "left")).toEqual(snapshot);
    expect(play(finished, deck, "right")).toEqual(snapshot);
    expect(play(play(finished, deck, "right"), deck, "right").log).toHaveLength(12);
  });

  test("play is a no-op after a collapse", () => {
    const deck = deckWith([
      fork("a", option({ faith: 1 }), option({ power: -25 })),
      fork("b", option({ faith: 1 }), option({ power: -5 })),
    ]);
    const collapsed = run(deck, rights(2));
    expect(collapsed.status).toBe("collapsed");
    const snapshot = clone(collapsed);

    const again = play(collapsed, deck, "right");
    expect(again).toEqual(snapshot);
    expect(again.cardIndex).toBe(2);
    expect(again.meters.faith).toBe(50);
    expect(again.collapsedMeter).toBe("power");
  });

  test("play does not mutate the state or the deck it is given", () => {
    const deck = makeDeck();
    const start = run(deck, ["right", "left", "left", "right"]);
    const stateSnapshot = clone(start);
    const deckSnapshot = clone(deck);

    const next = play(start, deck, "right");
    expect(next).not.toBe(start);
    expect(next.cardIndex).toBe(5);
    expect(start).toEqual(stateSnapshot);
    expect(deck).toEqual(deckSnapshot);
  });

  test("play works on deeply frozen inputs", () => {
    const deck = deepFreeze(makeDeck());
    let state = deepFreeze(initRun(deck));
    for (const side of ["right", "right", "left", "right"] as Side[]) {
      state = deepFreeze(play(state, deck, side));
    }
    // c01 right, c02 right, c03 left, c04 right
    expect(state.meters).toEqual({ stability: 34, people: 65, power: 40, faith: 50 });
    expect(state.chronicle).toEqual({ ...ALL_CLEAR, e4: "faded" });
    expect(state.revealed).toEqual({ e2: false });
  });

  test("play is deterministic", () => {
    const deck = makeDeck();
    const sides: Side[] = ["right", "left", "right", "right", "left", "right", "left"];
    expect(run(deck, sides)).toEqual(run(deck, sides));
  });
});

describe("result and world fate (§5)", () => {
  function finishedAt(stability: number): RunState {
    const base = initRun(makeDeck());
    return {
      ...base,
      meters: { ...base.meters, stability },
      lowestStability: Math.min(50, stability),
      cardIndex: 12,
      status: "finished",
    };
  }

  test.each([
    [50, "as_it_was"],
    [45, "as_it_was"],
    [44, "shifted"],
    [30, "shifted"],
    [29, "unrecognisable"],
    [15, "unrecognisable"],
    [14, "torn"],
    [1, "torn"],
  ])("final Stability %i → %s", (stability, fate) => {
    expect(result(finishedAt(stability))).toEqual({ rung: "nobody", worldFate: fate });
  });

  test("the result carries the state's rung", () => {
    expect(result({ ...finishedAt(31), rung: "influential" })).toEqual({
      rung: "influential",
      worldFate: "shifted",
    });
  });

  test.each<[number[], number, string]>([
    [[-10], 45, "as_it_was"],
    [[-12], 44, "shifted"],
    [[-24, -16], 30, "shifted"],
    [[-24, -18], 29, "unrecognisable"],
    [[-24, -24, -22], 15, "unrecognisable"],
    [[-24, -24, -24], 14, "torn"],
  ])("played run with Stability effects %j ends at %i → %s", (effects, final, fate) => {
    const deck = deckWith(stabilityForks(effects));
    // The padding cards are played left: they only touch faith.
    const state = run(deck, [...rights(effects.length), ...lefts(12 - effects.length)]);
    expect(state.status).toBe("finished");
    expect(state.meters.stability).toBe(final);
    expect(result(state)).toEqual({ rung: "nobody", worldFate: fate });
  });

  test("world fate comes from FINAL Stability, not the lowest reached", () => {
    // 50 → 38 → 35 → 47, then nine padding cards.
    const deck = deckWith(stabilityForks([-24, -6, 24]));
    const state = run(deck, [...rights(3), ...lefts(9)]);
    expect(state.status).toBe("finished");
    expect(state.meters.stability).toBe(47);
    expect(state.lowestStability).toBe(35);
    expect(fadedIds(state)).toEqual(["e1"]);
    expect(result(state).worldFate).toBe("as_it_was");
  });

  test("a finished run has no collapsedMeter in its result", () => {
    const deck = deckWith([]);
    const res = result(run(deck, lefts(12)));
    expect(res).toEqual({ rung: "nobody", worldFate: "as_it_was" });
    expect(res.collapsedMeter).toBeUndefined();
  });

  test.each<[Meter, Card[], string]>([
    [
      "power",
      [
        fork("a", option({ faith: 1 }), option({ power: -25 })),
        fork("b", option({ faith: 1 }), option({ power: -5 })),
      ],
      "as_it_was",
    ],
    [
      "people",
      [
        fork("a", option({ faith: 1 }), option({ people: 25, stability: -24 })),
        fork("b", option({ faith: 1 }), option({ people: 25, stability: -24 })),
      ],
      "unrecognisable",
    ],
    ["stability", stabilityForks([-24, -24, -24, -24, -4]), "torn"],
  ])("a %s collapse still yields a full result", (meter, cards, fate) => {
    const deck = deckWith(cards);
    const state = run(deck, rights(cards.length));
    expect(state.status).toBe("collapsed");
    expect(result(state)).toEqual({ rung: "nobody", worldFate: fate, collapsedMeter: meter });
  });

  test("a collapse keeps the rung earned before it", () => {
    const deck = deckWith([
      trace("t", "e1", "left", option({ power: -5 }), option({ people: 5 })),
      fork("a", option({ faith: 1 }), option({ power: -25 })),
    ]);
    const state = run(deck, ["left", "right"]);
    expect(state.meters.power).toBe(0);
    expect(result(state)).toEqual({
      rung: "noticed",
      worldFate: "as_it_was",
      collapsedMeter: "power",
    });
  });
});

describe("full runs on the helper deck", () => {
  test("all left: follows history, finishes with nothing faded", () => {
    const deck = makeDeck();
    const state = run(deck, lefts(12));
    expect(state.status).toBe("finished");
    expect(state.cardIndex).toBe(12);
    expect(state.meters).toEqual({ stability: 57, people: 46, power: 30, faith: 59 });
    expect(state.lowestStability).toBe(50);
    expect(state.chronicle).toEqual(ALL_CLEAR);
    expect(state.revealed).toEqual({ e2: false });
    // c02 left is correct, c06 left is wrong.
    expect(state.log[1].traceCorrect).toBe(true);
    expect(state.log[5].traceCorrect).toBe(false);
    expect(state.rung).toBe("noticed");
    expect(result(state)).toEqual({ rung: "noticed", worldFate: "as_it_was" });
  });

  test("all right: bends history until the Chronicle tears on the tenth card", () => {
    const deck = makeDeck();

    const nine = run(deck, rights(9));
    expect(nine.status).toBe("playing");
    expect(nine.meters).toEqual({ stability: 7, people: 60, power: 79, faith: 30 });
    expect(nine.chronicle).toEqual({ ...ALL_CLEAR, e4: "faded", e3: "faded" });
    expect(nine.revealed).toEqual({ e5: false });
    expect(nine.rung).toBe("noticed"); // c02 right wrong, c06 right correct (e2 still clear)

    const state = run(deck, rights(12));
    expect(state.status).toBe("collapsed");
    expect(state.collapsedMeter).toBe("stability");
    expect(state.cardIndex).toBe(10);
    expect(state.log).toHaveLength(10);
    expect(state.meters).toEqual({ stability: 0, people: 60, power: 79, faith: 22 });
    expect(state.lowestStability).toBe(0);
    expect(state.chronicle).toEqual({ ...ALL_CLEAR, e4: "faded", e3: "faded", e1: "faded" });
    expect(state.log.map((entry) => entry.fadedEntryIds)).toEqual([
      [],
      [],
      [],
      ["e4"],
      [],
      [],
      ["e3"],
      [],
      [],
      ["e1"],
    ]);
    expect(result(state)).toEqual({
      rung: "noticed",
      worldFate: "torn",
      collapsedMeter: "stability",
    });
  });
});
