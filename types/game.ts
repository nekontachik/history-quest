// ---------------------------------------------------------------------------
// Chrono Agent — frozen game contract (phase 1 prototype).
// Source of truth: docs/game/GAME_SPEC.md §3–4, docs/game/EXECUTION_PLAN.md G0.
// Later tasks (T1–T8/I1/E1) code AGAINST this file and must not change it.
// ---------------------------------------------------------------------------

/** The four meters that drive every run (GAME_SPEC §2 step 4). */
export type Meter = "stability" | "people" | "power" | "faith";

/** One of the two labelled actions on a card (GAME_SPEC §4). */
export interface CardOption {
  /** Short action label, e.g. "Give the medicine". */
  label: string;
  /** 1–3 meters changed by an integer in [-25, 25]. Enforced by schema. */
  effects: Partial<Record<Meter, number>>;
  /** One-sentence consequence shown after the swipe, ≤ 220 chars. */
  consequence: string;
}

/** Four possible conflict types (GAME_SPEC §5 rule 3). */
export type ConflictType =
  | "life_vs_history"
  | "one_vs_many"
  | "now_vs_later"
  | "truth_vs_peace";

/** One card in the 12-card deck (GAME_SPEC §4). */
export interface Card {
  id: string;
  /** Must match a role in the character pool for this era. */
  roleId: string;
  /** Who speaks the line, e.g. "Colonel's wife". */
  speakerName: string;
  /** The dilemma text, ≤ 220 chars. */
  line: string;
  /** Set when the card is tied to a real event of the year. */
  realEventRef?: string;
  conflictType: ConflictType;
  left: CardOption;
  right: CardOption;
}

/**
 * A deck is exactly 12 cards. The length is enforced in `DeckSchema`
 * (shared/game/schemas.ts); the TypeScript surface stays `Card[]` so
 * callers can map/filter without casting.
 */
export type Deck = Card[];

/** Mission card (GAME_SPEC §2 step 2). */
export interface Mission {
  /** Short mission title shown at run start, e.g. the year + prompt. */
  title: string;
  /** Optional bonus goal from a fixed template list (constants/game.ts). */
  bonusGoal?: {
    /** Template id from BONUS_GOALS. */
    id: string;
    /** The human-readable goal text (resolved from the template). */
    text: string;
  };
}

/**
 * Union of the 13 ending ids encoded in constants/game.ts (GAME_SPEC §3).
 * 8 collapse + 5 survival.
 */
export type EndingId =
  // Collapse endings (meter × bound)
  | "stability_0"
  | "stability_100"
  | "people_0"
  | "people_100"
  | "power_0"
  | "power_100"
  | "faith_0"
  | "faith_100"
  // Survival endings (dominant meter + "Quiet Line")
  | "survival_stability"
  | "survival_people"
  | "survival_power"
  | "survival_faith"
  | "survival_quiet_line";

/** Fixed ending descriptor (GAME_SPEC §3). */
export interface Ending {
  id: EndingId;
  kind: "collapse" | "survival";
  /** i18n key for the ending name (resolved by T8 in messages/*.json). */
  nameKey: string;
  /** i18n key for the ending description. */
  descKey: string;
}

/**
 * One row of the decision log — recorded by the run engine (T4) and
 * replayed inside the artifact (T8).
 */
export interface DecisionLogEntry {
  cardId: string;
  side: "left" | "right";
  /** The option's `effects` as applied (post-clamp). */
  effects: Partial<Record<Meter, number>>;
  /** Meter snapshot AFTER the choice was applied (0–100 clamped). */
  metersAfter: Record<Meter, number>;
  /** The consequence line that was shown to the player. */
  consequence: string;
}

/** Immutable run state (T4 reducer input/output). */
export interface RunState {
  meters: Record<Meter, number>;
  deck: Deck;
  cardIndex: number;
  decisions: DecisionLogEntry[];
  status: "playing" | "collapsed" | "survived";
  endingId?: EndingId;
}

/**
 * Generated keepsake at the end of a run (GAME_SPEC §2 step 7).
 * A collapse ending yields `rare: true` (never an empty failure).
 */
export interface Artifact {
  id: string;
  endingId: EndingId;
  rare: boolean;
  title: string;
  summary: string;
  coverUrl: string;
  year: number;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** Anonymous player id (cookie, see T8 middleware). */
  playerId: string;
  /** The full decision log of the run that produced this artifact. */
  lineage: DecisionLogEntry[];
}

/** The three image kinds we generate (GAME_SPEC §6, ART_DIRECTION §6). */
export type ImageKind = "portrait" | "scene" | "artifact";
