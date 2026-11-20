// Chronicle prototype — numbers. Explained in docs/game/CHRONICLE_RULES.md.
import type { Meter, Rung, WorldFate } from "@/types/game";

export const METERS: readonly Meter[] = ["stability", "people", "power", "faith"];

/** The prototype is fixed to one year and one hero (the Commoner). */
export const PROTOTYPE_YEAR = 1648;

export const DECK_SIZE = 12;
export const CHRONICLE_SIZE = 5;

/** Allowed number of cards of each kind in one deck (sums to DECK_SIZE). */
export const KIND_LIMITS = {
  fork: { min: 7, max: 8 },
  trace: { min: 2, max: 3 },
  hint: { min: 2, max: 2 },
} as const;

export const EFFECT_MIN = -25;
export const EFFECT_MAX = 25;
export const MAX_EFFECTS_PER_OPTION = 3;
export const LINE_MAX_CHARS = 220;
export const LABEL_MAX_CHARS = 40;

/** Commoner starting meters. */
export const COMMONER_START: Readonly<Record<Meter, number>> = {
  stability: 50,
  people: 60,
  power: 30,
  faith: 50,
};

/** The Commoner is unnoticed: every Stability effect is divided by this, rounded toward zero. */
export const COMMONER_STABILITY_DIVISOR = 2;

/** One clear entry fades for every this many points of Stability lost from the start. */
export const FADE_STEP = 15;

export const METER_MIN = 0;
export const METER_MAX = 100;

export const RUNGS: readonly Rung[] = ["nobody", "noticed", "needed", "influential", "summit"];

/** Lowest final Stability for each world fate, checked top to bottom. */
export const WORLD_FATE_THRESHOLDS: readonly { fate: WorldFate; minStability: number }[] = [
  { fate: "as_it_was", minStability: 45 },
  { fate: "shifted", minStability: 30 },
  { fate: "unrecognisable", minStability: 15 },
  { fate: "torn", minStability: 0 },
];

/** The eight pre-generated 1648 portraits in public/cast/1648/{roleId}.webp. */
export const PORTRAIT_ROLE_IDS = [
  "wife",
  "scout",
  "doctor",
  "monk",
  "merchant",
  "envoy",
  "peasant",
  "elder",
] as const;
export type PortraitRoleId = (typeof PORTRAIT_ROLE_IDS)[number];
