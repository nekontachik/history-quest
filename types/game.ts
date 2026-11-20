// ---------------------------------------------------------------------------
// Chronicle prototype — game contract.
// Source of truth for the numbers: docs/game/CHRONICLE_RULES.md.
// Pure types only: safe to import from client and server code.
// ---------------------------------------------------------------------------

/** The four meters. `stability` is shown to the player as the Chronicle's state. */
export type Meter = "stability" | "people" | "power" | "faith";

export type Side = "left" | "right";

/** fork = follow history or change it; trace = spot the detail; hint = pay for knowledge. */
export type CardKind = "fork" | "trace" | "hint";

/** One real event of the year, as written in the hero's Chronicle. */
export interface ChronicleEntry {
  id: string;
  /** Short name of the real event. */
  title: string;
  /** What the Chronicle says will happen — trace cards are decided from this text alone. */
  summary: string;
  /** Source for the real event (Wikipedia or similar). */
  sourceUrl: string;
  /**
   * Hidden from the player. Whether the event still happens once history has
   * bent and the entry has faded. A clear entry is ALWAYS true regardless.
   */
  survivesFading: boolean;
}

export type EntryState = "clear" | "faded";

export interface CardOption {
  /** Short action label, ≤ 40 chars. */
  label: string;
  /** 1–3 meters, non-zero integers in [-25, 25]. */
  effects: Partial<Record<Meter, number>>;
  /** One sentence shown after the choice, ≤ 220 chars. */
  consequence: string;
  /** Fork only: the entry this option fades first when a fade is due. */
  fadesEntryId?: string;
  /** Hint only: choosing this option reveals that entry's `survivesFading`. */
  revealsEntryId?: string;
}

export interface Card {
  id: string;
  kind: CardKind;
  /** One of PORTRAIT_ROLE_IDS (constants/game.ts). */
  roleId: string;
  speakerName: string;
  /** What the speaker says, ≤ 220 chars. */
  line: string;
  /** Required for trace; optional for fork and hint. */
  chronicleRef?: string;
  /** Trace only: the correct side WHILE the referenced entry is true. It flips when the entry is false. */
  correct?: Side;
  left: CardOption;
  right: CardOption;
}

export interface Deck {
  year: number;
  /** Exactly CHRONICLE_SIZE entries. */
  chronicle: ChronicleEntry[];
  /** Exactly DECK_SIZE cards. */
  cards: Card[];
}

/** The hero's standing, lowest to highest. */
export type Rung = "nobody" | "noticed" | "needed" | "influential" | "summit";

export type WorldFate = "as_it_was" | "shifted" | "unrecognisable" | "torn";

export interface LogEntry {
  cardId: string;
  side: Side;
  /** Effects as applied (after the hero's Stability halving, before clamping). */
  applied: Partial<Record<Meter, number>>;
  metersAfter: Record<Meter, number>;
  /** Entries that faded because of this choice. */
  fadedEntryIds: string[];
  /** Trace cards only: whether the player picked the correct side. */
  traceCorrect?: boolean;
  /** Hint cards only: the entry whose truth was revealed. */
  revealedEntryId?: string;
}

export interface RunState {
  meters: Record<Meter, number>;
  /** Entry id → state. Every entry starts "clear". Fading never reverts. */
  chronicle: Record<string, EntryState>;
  /** Entry id → revealed `survivesFading`, for entries bought through a hint. */
  revealed: Record<string, boolean>;
  rung: Rung;
  /** Index of the next card to play. */
  cardIndex: number;
  /** Lowest Stability reached so far — drives fading. */
  lowestStability: number;
  log: LogEntry[];
  status: "playing" | "collapsed" | "finished";
  collapsedMeter?: Meter;
}

export interface RunResult {
  rung: Rung;
  worldFate: WorldFate;
  collapsedMeter?: Meter;
}

/** Kept for the image layer (portraits, scenes, artifact covers). */
export type ImageKind = "portrait" | "scene" | "artifact";
