// Every user-facing string of the Chronicle game (English only).
import type { Meter, Rung, WorldFate } from "@/types/game";

export type BarMeter = Exclude<Meter, "stability">;
export type Direction = "up" | "down";
export type CollapseEnd = "empty" | "full";

export const STRINGS = {
  loading: "Opening the book…",

  intro: {
    year: "1648",
    lead: "You found a book that should not exist. It knows what happens this year.",
    how: "People will come to you. Swipe a card left or right, or use the buttons, to answer them. Follow history and the book stays true; bend it and the ink begins to fade.",
    begin: "Begin",
  },

  meterLabel: { people: "People", power: "Power", faith: "Faith" } satisfies Record<BarMeter, string>,
  /** Text alternatives for a bar, from nearly empty to nearly full. */
  meterLevels: ["almost gone", "thin", "steady", "swelling", "close to swallowing everything"],
  meterName: (label: string, level: string) => `${label}: ${level}`,
  direction: { up: "would rise", down: "would fall" } satisfies Record<Direction, string>,
  directionGlyph: { up: "▲", down: "▼" } satisfies Record<Direction, string>,

  chronicle: {
    title: "The Chronicle",
    button: "Chronicle",
    subtitle: "Five things this year will bring.",
    marksName: (clear: number, faded: number) =>
      faded === 0
        ? `Open the Chronicle. All ${clear} entries are clear.`
        : `Open the Chronicle. Entries clear: ${clear}. Entries uncertain: ${faded}.`,
    stabilityDirection: {
      up: "The ink would hold firmer.",
      down: "The ink would grow weaker.",
    } satisfies Record<Direction, string>,
    checkFromCard: "Check the book",
    readAgain: "Read the Chronicle",
    close: "Close the book",
    uncertain: "uncertain",
    uncertainNote: "The ink has faded. This may no longer come true.",
    asked: "This is what you are being asked about.",
    learnedSurvives: "You paid to learn: even if history bends, this will still happen.",
    learnedFails: "You paid to learn: if history bends, this will not happen.",
    source: "Source",
    sourceNewTab: "(opens in a new tab)",
  },

  card: {
    name: (speaker: string) => `${speaker} speaks to you`,
    portraitAlt: (speaker: string) => `Engraved portrait of ${speaker}`,
    progress: (current: number, total: number) => `Card ${current} of ${total}`,
    swipeHint: "Swipe, press the arrow keys, or choose below.",
    choicesLabel: "Your answer",
  },

  consequence: {
    fading: (title: string) => ({ lead: "The ink is fading:", title }),
    hintSurvives: "Even if history bends, this will still happen.",
    hintFails: "If history bends, this will not happen.",
    continue: "Continue",
  },

  standing: {
    nobody: "You are nobody.",
    noticed: "You are noticed.",
    needed: "You are needed.",
    influential: "You have influence now.",
    summit: "You stand at the summit.",
  } satisfies Record<Rung, string>,

  result: {
    eyebrow: "The year 1648 ends. You were",
    rung: {
      nobody: "Nobody",
      noticed: "Noticed",
      needed: "Needed",
      influential: "A person of influence",
      summit: "The summit",
    } satisfies Record<Rung, string>,
    fate: {
      as_it_was:
        "The year closed as the book said it would, and no one will ever know you were holding the pen.",
      shifted:
        "The year closed a little crooked: the same names, the same battles, and a few lines no other book will ever agree with.",
      unrecognisable:
        "The year you knew is gone; the book now describes a country that no longer exists.",
      torn: "Nothing in the book came true in the end. You hold the only record of a year that never happened.",
    } satisfies Record<WorldFate, string>,
    collapse: {
      stability: {
        empty: "The world you knew came apart before the year was out.",
        full: "History set like stone around you, and nothing would move again.",
      },
      people: {
        empty: "The people turned their backs, and a commoner without neighbours is no one at all.",
        full: "The people would follow no one but you, and a crowd that large cannot be led.",
      },
      power: {
        empty: "The powerful stopped seeing you at all, and you were swept aside.",
        full: "Power swallowed everything else, and there was no room left in it for you.",
      },
      faith: {
        empty: "Faith drained out of the village, and nothing held it together after that.",
        full: "Faith swallowed everything else.",
      },
    } satisfies Record<Meter, Record<CollapseEnd, string>>,
    changedHeading: "What you put in doubt",
    changedNothing: "Nothing. Every line of the book still reads true.",
    playAgain: "Play again",
  },
} as const;
