// Acceptance tests for validateDeck (shared/game/deckSchema.ts).
// Source: docs/game/CHRONICLE_RULES.md §4 (deck shape, kinds, effects, field rules).
// Every failing case mutates a deep copy of the valid helper deck.
// Error wording is free: only `ok` and "non-empty string array" are asserted.

import { describe, expect, test } from "vitest";

import { validateDeck } from "@/shared/game/deckSchema";
import type { Card, Deck } from "@/types/game";

import { clone, makeDeck } from "./_deck";

// Positions in makeDeck(): forks 0,3,4,6,8,9,10,11 · traces 1,5 · hints 2,7.
const FORK = 0;
const FORK_2 = 3;
const TRACE = 1;
const TRACE_2 = 5;
const HINT = 2; // left reveals e2, right declines
const HINT_2 = 7; // left declines, right reveals e5

function mutated(change: (deck: Deck) => void): Deck {
  const deck = clone(makeDeck());
  change(deck);
  return deck;
}

function expectInvalid(raw: unknown): void {
  const res = validateDeck(raw);
  expect(res.ok).toBe(false);
  if (res.ok) return;
  expect(Array.isArray(res.errors)).toBe(true);
  expect(res.errors.length).toBeGreaterThan(0);
  for (const message of res.errors) {
    expect(typeof message).toBe("string");
    expect(message.length).toBeGreaterThan(0);
  }
}

function expectValid(raw: unknown): void {
  const res = validateDeck(raw);
  expect(res.ok === false ? res.errors : []).toEqual([]);
  expect(res.ok).toBe(true);
}

/** Rewrites a card in place as a valid fork. */
function toFork(card: Card): void {
  card.kind = "fork";
  delete card.chronicleRef;
  delete card.correct;
  delete card.left.revealsEntryId;
  delete card.right.revealsEntryId;
}

/** Rewrites a card in place as a valid trace. */
function toTrace(card: Card): void {
  card.kind = "trace";
  card.chronicleRef = "e3";
  card.correct = "left";
  delete card.left.fadesEntryId;
  delete card.right.fadesEntryId;
  delete card.left.revealsEntryId;
  delete card.right.revealsEntryId;
}

/** Rewrites a card in place as a valid hint (left reveals and costs people). */
function toHint(card: Card): void {
  card.kind = "hint";
  delete card.chronicleRef;
  delete card.correct;
  delete card.left.fadesEntryId;
  delete card.right.fadesEntryId;
  card.left = { ...card.left, effects: { people: -5 }, revealsEntryId: "e3" };
  card.right = { ...card.right, effects: { power: 2 } };
  delete card.right.revealsEntryId;
}

function kindCounts(deck: Deck): Record<string, number> {
  const counts: Record<string, number> = { fork: 0, trace: 0, hint: 0 };
  for (const card of deck.cards) counts[card.kind] += 1;
  return counts;
}

describe("validateDeck — valid decks", () => {
  test("the helper deck passes and is returned as the deck", () => {
    const raw = makeDeck();
    const res = validateDeck(clone(raw));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.deck).toEqual(raw);
    expect(res.deck.cards).toHaveLength(12);
    expect(res.deck.chronicle).toHaveLength(5);
  });

  test("the helper deck has 8 forks, 2 traces and 2 hints", () => {
    expect(kindCounts(makeDeck())).toEqual({ fork: 8, trace: 2, hint: 2 });
  });

  test("7 forks, 3 traces and 2 hints is valid too", () => {
    const deck = mutated((d) => toTrace(d.cards[FORK]));
    expect(kindCounts(deck)).toEqual({ fork: 7, trace: 3, hint: 2 });
    expectValid(deck);
  });

  test("effects of exactly -25 and +25 are valid", () => {
    expectValid(
      mutated((d) => {
        d.cards[FORK].left.effects = { people: -25, faith: 25 };
      }),
    );
  });

  test("an option with one effect and an option with three effects are valid", () => {
    expectValid(
      mutated((d) => {
        d.cards[FORK].left.effects = { faith: 1 };
        d.cards[FORK].right.effects = { stability: -24, power: 10, people: -1 };
      }),
    );
  });

  test("a line of exactly 220 characters is valid", () => {
    expectValid(
      mutated((d) => {
        d.cards[FORK].line = "x".repeat(220);
      }),
    );
  });

  test("chronicleRef is allowed on fork and hint cards when it names an existing entry", () => {
    expectValid(
      mutated((d) => {
        d.cards[FORK].chronicleRef = "e2";
        d.cards[HINT].chronicleRef = "e5";
      }),
    );
  });

  test("all eight portrait roles are accepted", () => {
    const roles = ["wife", "scout", "doctor", "monk", "merchant", "envoy", "peasant", "elder"];
    expectValid(
      mutated((d) => {
        roles.forEach((roleId, i) => {
          d.cards[i].roleId = roleId;
        });
      }),
    );
  });
});

describe("validateDeck — not a deck at all", () => {
  test.each([
    ["null", null],
    ["a string", "deck"],
    ["a number", 1648],
    ["an array", []],
    ["an empty object", {}],
  ])("%s is rejected", (_name, raw) => {
    expectInvalid(raw);
  });

  test("a deck without cards is rejected", () => {
    const raw = clone(makeDeck()) as Partial<Deck>;
    delete raw.cards;
    expectInvalid(raw);
  });

  test("a deck without a chronicle is rejected", () => {
    const raw = clone(makeDeck()) as Partial<Deck>;
    delete raw.chronicle;
    expectInvalid(raw);
  });
});

describe("validateDeck — deck size (§4: exactly 12 cards, §3: five entries)", () => {
  test("11 cards", () => {
    const deck = mutated((d) => {
      d.cards.pop();
    });
    expect(deck.cards).toHaveLength(11);
    expectInvalid(deck);
  });

  test("13 cards", () => {
    const deck = mutated((d) => {
      d.cards.push({ ...clone(d.cards[FORK]), id: "c13" });
    });
    expect(deck.cards).toHaveLength(13);
    expectInvalid(deck);
  });

  test("4 entries", () => {
    const base = makeDeck();
    // Repoint every reference to e5 first, so the missing entry is the only fault.
    const cards = JSON.parse(JSON.stringify(base.cards).replaceAll('"e5"', '"e1"')) as Card[];
    const deck: Deck = { ...base, cards, chronicle: base.chronicle.slice(0, 4) };
    expect(deck.chronicle).toHaveLength(4);
    expectInvalid(deck);
  });

  test("6 entries", () => {
    const deck = mutated((d) => {
      d.chronicle.push({ ...clone(d.chronicle[0]), id: "e6" });
    });
    expect(deck.chronicle).toHaveLength(6);
    expectInvalid(deck);
  });
});

describe("validateDeck — kind counts (§4: 7–8 fork, 2–3 trace, exactly 2 hint)", () => {
  test("too few forks (6 fork, 4 trace, 2 hint)", () => {
    const deck = mutated((d) => {
      toTrace(d.cards[FORK]);
      toTrace(d.cards[FORK_2]);
    });
    expect(kindCounts(deck)).toEqual({ fork: 6, trace: 4, hint: 2 });
    expectInvalid(deck);
  });

  test("too many forks (9 fork, 1 trace, 2 hint)", () => {
    const deck = mutated((d) => toFork(d.cards[TRACE]));
    expect(kindCounts(deck)).toEqual({ fork: 9, trace: 1, hint: 2 });
    expectInvalid(deck);
  });

  test("too few traces (8 fork, 1 trace, 3 hint)", () => {
    const deck = mutated((d) => toHint(d.cards[TRACE]));
    expect(kindCounts(deck)).toEqual({ fork: 8, trace: 1, hint: 3 });
    expectInvalid(deck);
  });

  test("too many traces (7 fork, 4 trace, 1 hint)", () => {
    const deck = mutated((d) => {
      toTrace(d.cards[FORK]);
      toTrace(d.cards[HINT]);
    });
    expect(kindCounts(deck)).toEqual({ fork: 7, trace: 4, hint: 1 });
    expectInvalid(deck);
  });

  test("too few hints (8 fork, 3 trace, 1 hint)", () => {
    const deck = mutated((d) => toTrace(d.cards[HINT]));
    expect(kindCounts(deck)).toEqual({ fork: 8, trace: 3, hint: 1 });
    expectInvalid(deck);
  });

  test("too many hints (7 fork, 2 trace, 3 hint)", () => {
    const deck = mutated((d) => toHint(d.cards[FORK]));
    expect(kindCounts(deck)).toEqual({ fork: 7, trace: 2, hint: 3 });
    expectInvalid(deck);
  });

  test("an unknown card kind", () => {
    const deck = mutated((d) => {
      (d.cards[FORK] as { kind: string }).kind = "duel";
    });
    expectInvalid(deck);
  });
});

describe("validateDeck — trace and fork field rules (§4)", () => {
  test("trace without chronicleRef", () => {
    expectInvalid(
      mutated((d) => {
        delete d.cards[TRACE].chronicleRef;
      }),
    );
  });

  test("trace without correct", () => {
    expectInvalid(
      mutated((d) => {
        delete d.cards[TRACE_2].correct;
      }),
    );
  });

  test("trace with a correct that is not a side", () => {
    expectInvalid(
      mutated((d) => {
        (d.cards[TRACE] as { correct?: string }).correct = "up";
      }),
    );
  });

  test("trace chronicleRef naming a missing entry", () => {
    expectInvalid(
      mutated((d) => {
        d.cards[TRACE].chronicleRef = "e9";
      }),
    );
  });

  test("fork chronicleRef naming a missing entry", () => {
    expectInvalid(
      mutated((d) => {
        d.cards[FORK].chronicleRef = "e9";
      }),
    );
  });

  test("fork with correct", () => {
    expectInvalid(
      mutated((d) => {
        d.cards[FORK].correct = "left";
      }),
    );
  });

  test("hint with correct", () => {
    expectInvalid(
      mutated((d) => {
        d.cards[HINT].correct = "right";
      }),
    );
  });

  test("fadesEntryId on a trace option", () => {
    expectInvalid(
      mutated((d) => {
        d.cards[TRACE].right.fadesEntryId = "e1";
      }),
    );
  });

  test("fadesEntryId on a hint option", () => {
    expectInvalid(
      mutated((d) => {
        d.cards[HINT].right.fadesEntryId = "e1";
      }),
    );
  });

  test("fadesEntryId naming a missing entry", () => {
    expectInvalid(
      mutated((d) => {
        d.cards[FORK].right.fadesEntryId = "e9";
      }),
    );
  });
});

describe("validateDeck — hint rules (§4)", () => {
  test("revealsEntryId on a fork option", () => {
    expectInvalid(
      mutated((d) => {
        d.cards[FORK].left.revealsEntryId = "e1";
      }),
    );
  });

  test("revealsEntryId on a trace option", () => {
    expectInvalid(
      mutated((d) => {
        d.cards[TRACE].left.revealsEntryId = "e1";
      }),
    );
  });

  test("hint with no revealing option", () => {
    expectInvalid(
      mutated((d) => {
        delete d.cards[HINT].left.revealsEntryId;
      }),
    );
  });

  test("hint with two revealing options", () => {
    expectInvalid(
      mutated((d) => {
        // Both options cost something, so the only fault is the second reveal.
        d.cards[HINT].right.effects = { power: -2 };
        d.cards[HINT].right.revealsEntryId = "e3";
      }),
    );
  });

  test("hint revealing option with no negative effect", () => {
    expectInvalid(
      mutated((d) => {
        d.cards[HINT].left.effects = { people: 10 };
      }),
    );
  });

  test("hint revealing option with only positive effects on several meters", () => {
    expectInvalid(
      mutated((d) => {
        d.cards[HINT_2].right.effects = { faith: 10, power: 3 };
      }),
    );
  });

  test("revealsEntryId naming a missing entry", () => {
    expectInvalid(
      mutated((d) => {
        d.cards[HINT].left.revealsEntryId = "e9";
      }),
    );
  });
});

describe("validateDeck — effects (§4: 1–3 meters, non-zero integers in [-25, 25])", () => {
  test("option with 0 effects", () => {
    expectInvalid(
      mutated((d) => {
        d.cards[FORK].left.effects = {};
      }),
    );
  });

  test("option with 4 effects", () => {
    expectInvalid(
      mutated((d) => {
        d.cards[FORK].left.effects = { stability: -2, people: -5, power: 5, faith: 5 };
      }),
    );
  });

  test("effect of 0", () => {
    expectInvalid(
      mutated((d) => {
        d.cards[FORK].left.effects = { people: 0, faith: 5 };
      }),
    );
  });

  test("effect above the range (26)", () => {
    expectInvalid(
      mutated((d) => {
        d.cards[FORK].left.effects = { people: 26 };
      }),
    );
  });

  test("effect below the range (-26)", () => {
    expectInvalid(
      mutated((d) => {
        d.cards[FORK].right.effects = { stability: -26, power: 10 };
      }),
    );
  });

  test("non-integer effect", () => {
    expectInvalid(
      mutated((d) => {
        d.cards[FORK].left.effects = { people: 2.5 };
      }),
    );
  });

  test("effect given as a string", () => {
    expectInvalid(
      mutated((d) => {
        (d.cards[FORK].left as { effects: unknown }).effects = { people: "5" };
      }),
    );
  });

  test("unknown meter key", () => {
    expectInvalid(
      mutated((d) => {
        (d.cards[FORK].left as { effects: unknown }).effects = { gold: 5 };
      }),
    );
  });

  test("unknown meter key next to a valid one", () => {
    expectInvalid(
      mutated((d) => {
        (d.cards[TRACE].right as { effects: unknown }).effects = { people: 5, luck: 3 };
      }),
    );
  });

  test("a bad effect on a trace or hint option is rejected as well", () => {
    expectInvalid(
      mutated((d) => {
        d.cards[TRACE].left.effects = { power: 30 };
      }),
    );
    expectInvalid(
      mutated((d) => {
        d.cards[HINT].right.effects = { power: 0 };
      }),
    );
  });
});

describe("validateDeck — card fields and ids", () => {
  test("roleId not in PORTRAIT_ROLE_IDS", () => {
    expectInvalid(
      mutated((d) => {
        d.cards[FORK].roleId = "king";
      }),
    );
  });

  test("line longer than 220 characters", () => {
    expectInvalid(
      mutated((d) => {
        d.cards[FORK].line = "x".repeat(221);
      }),
    );
  });

  test("duplicate card ids", () => {
    expectInvalid(
      mutated((d) => {
        d.cards[FORK_2].id = d.cards[FORK].id;
      }),
    );
  });

  test("duplicate entry ids", () => {
    const base = makeDeck();
    // Repoint references to e5 so that the duplicate id is the only fault.
    const cards = JSON.parse(JSON.stringify(base.cards).replaceAll('"e5"', '"e1"')) as Card[];
    const deck: Deck = { ...base, cards };
    deck.chronicle[4].id = "e1";
    expectInvalid(deck);
  });

  test("a card missing its right option", () => {
    const deck = clone(makeDeck());
    delete (deck.cards[FORK] as Partial<Card>).right;
    expectInvalid(deck);
  });
});

describe("validateDeck — reports and purity", () => {
  test("several faults still give ok:false with string errors", () => {
    expectInvalid(
      mutated((d) => {
        d.cards[FORK].roleId = "king";
        d.cards[TRACE].chronicleRef = "e9";
        d.cards[HINT].left.effects = { people: 99 };
      }),
    );
  });

  test("does not mutate its input", () => {
    const valid = clone(makeDeck());
    const validSnapshot = clone(valid);
    validateDeck(valid);
    expect(valid).toEqual(validSnapshot);

    const invalid = mutated((d) => {
      d.cards[FORK].left.effects = {};
    });
    const invalidSnapshot = clone(invalid);
    expectInvalid(invalid);
    expect(invalid).toEqual(invalidSnapshot);
  });
});
