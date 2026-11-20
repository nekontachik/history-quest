// Test helper for the Chronicle acceptance tests (engine, deck schema, fairness).
// Source of truth: docs/game/CHRONICLE_RULES.md. Not a test file itself.

import type {
  Card,
  CardOption,
  ChronicleEntry,
  Deck,
  Meter,
  Side,
} from "@/types/game";

export type Effects = Partial<Record<Meter, number>>;

/** Hidden `survivesFading` flags of the helper chronicle, in deck order e1..e5. */
export const DEFAULT_SURVIVES: readonly boolean[] = [true, false, true, false, false];

/** Deep copy of plain JSON-like data. */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Recursively freezes plain data, so that any in-place mutation throws. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

/** Five entries with ids e1..e5 and the given `survivesFading` flags. */
export function makeChronicle(
  survives: readonly boolean[] = DEFAULT_SURVIVES,
): ChronicleEntry[] {
  return survives.map((survivesFading, i) => ({
    id: `e${i + 1}`,
    title: `Event ${i + 1}`,
    summary: `The Chronicle says that event ${i + 1} happens in the autumn.`,
    sourceUrl: `https://en.wikipedia.org/wiki/Event_${i + 1}`,
    survivesFading,
  }));
}

export function option(
  effects: Effects,
  extra: Partial<Omit<CardOption, "effects">> = {},
): CardOption {
  return {
    label: "Do it",
    consequence: "Something changes because of what you did.",
    ...extra,
    effects,
  };
}

function baseCard(id: string, kind: Card["kind"], roleId: string, left: CardOption, right: CardOption): Card {
  return {
    id,
    kind,
    roleId,
    speakerName: `Speaker ${id}`,
    line: `This is what the speaker of card ${id} says to you.`,
    left,
    right,
  };
}

export function fork(id: string, left: CardOption, right: CardOption, roleId = "peasant"): Card {
  return baseCard(id, "fork", roleId, left, right);
}

export function trace(
  id: string,
  chronicleRef: string,
  correct: Side,
  left: CardOption,
  right: CardOption,
  roleId = "scout",
): Card {
  return { ...baseCard(id, "trace", roleId, left, right), chronicleRef, correct };
}

export function hint(id: string, left: CardOption, right: CardOption, roleId = "merchant"): Card {
  return baseCard(id, "hint", roleId, left, right);
}

/** Harmless fork used to pad custom decks: left faith +1, right faith -1. */
export function filler(id: string): Card {
  return fork(id, option({ faith: 1 }), option({ faith: -1 }));
}

/**
 * A 12-card deck that starts with `cards` and is padded with fillers
 * (ids pad1, pad2, ...). Meant for ENGINE tests only: the kind counts are not
 * necessarily valid for validateDeck.
 */
export function deckWith(
  cards: Card[],
  survives: readonly boolean[] = DEFAULT_SURVIVES,
): Deck {
  const padded = [...cards];
  for (let i = 1; padded.length < 12; i += 1) padded.push(filler(`pad${i}`));
  return { year: 1648, chronicle: makeChronicle(survives), cards: padded };
}

/** One fork per number: playing "right" applies that Stability effect, "left" does nothing to Stability. */
export function stabilityForks(effects: readonly number[]): Card[] {
  return effects.map((stability, i) =>
    fork(`s${i + 1}`, option({ faith: 1 }), option({ stability })),
  );
}

/**
 * The small, fully valid deck: 5 entries, 12 cards (8 fork, 2 trace, 2 hint).
 *
 * Entries: e1 survives, e2 does not, e3 survives, e4 does not, e5 does not.
 *
 * All LEFT  → finished: stability 57, people 46, power 30, faith 59, rung noticed,
 *             nothing faded, revealed { e2: false }.
 * All RIGHT → collapses on c10 (stability 0): e4, e3, e1 faded, rung noticed,
 *             revealed { e5: false }.
 */
export function makeDeck(): Deck {
  return {
    year: 1648,
    chronicle: makeChronicle(),
    cards: [
      fork(
        "c01",
        option({ people: -5, faith: 5 }),
        option({ stability: -24, power: 10 }, { fadesEntryId: "e2" }),
        "monk",
      ),
      trace("c02", "e1", "left", option({ power: 5 }), option({ people: 5, stability: -2 }), "scout"),
      hint(
        "c03",
        option({ people: -10 }, { revealsEntryId: "e2" }),
        option({ power: 2 }),
        "merchant",
      ),
      fork(
        "c04",
        option({ faith: -5, people: 5 }),
        option({ stability: -6, people: 10 }, { fadesEntryId: "e4" }),
        "wife",
      ),
      fork(
        "c05",
        option({ power: -5 }),
        option({ stability: -24, power: 15, faith: -10 }, { fadesEntryId: "e2" }),
        "envoy",
      ),
      trace("c06", "e2", "right", option({ faith: 5 }), option({ people: -5 }), "doctor"),
      fork(
        "c07",
        option({ people: 5, power: -3 }),
        option({ stability: -6, people: -10, power: 10 }, { fadesEntryId: "e3" }),
        "peasant",
      ),
      hint(
        "c08",
        option({ power: 3 }),
        option({ faith: -10 }, { revealsEntryId: "e5" }),
        "elder",
      ),
      fork(
        "c09",
        option({ stability: 15, power: -5 }),
        option({ stability: -25, power: 12 }, { fadesEntryId: "e5" }),
        "monk",
      ),
      fork(
        "c10",
        option({ faith: 4 }),
        option({ stability: -24, faith: -8 }, { fadesEntryId: "e1" }),
        "envoy",
      ),
      fork(
        "c11",
        option({ people: -4 }),
        option({ stability: -24, people: 8 }, { fadesEntryId: "e3" }),
        "wife",
      ),
      fork(
        "c12",
        option({ power: 5, people: -5 }),
        option({ stability: -1, power: 20 }, { fadesEntryId: "e4" }),
        "elder",
      ),
    ],
  };
}
