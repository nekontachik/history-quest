// ---------------------------------------------------------------------------
// Chrono Agent — frozen game constants.
// Source of truth: docs/game/GAME_SPEC.md §2–3 and §6.
// Later tasks (T1–T8) read these and must not change them.
// ---------------------------------------------------------------------------

import type { EndingId, Meter } from "@/types/game";

/** The four meters, in canonical display order. GAME_SPEC §2 step 4. */
export const METERS: readonly Meter[] = [
  "stability",
  "people",
  "power",
  "faith",
] as const;

/** Every meter starts here at run start. GAME_SPEC §2 step 4. */
export const METER_START = 50;

/** Every deck contains exactly this many cards. GAME_SPEC §2 step 3. */
export const DECK_SIZE = 12;

// ---------------------------------------------------------------------------
// Eras — Atlas key = endingId × era (GAME_SPEC §3).
// Year ranges cover 3000 BCE through 2024 CE with no gaps.
// ---------------------------------------------------------------------------

export type EraId =
  | "ancient"
  | "medieval"
  | "early_modern"
  | "industrial"
  | "modern";

export interface Era {
  id: EraId;
  minYear: number;
  maxYear: number;
}

export const ERAS: readonly Era[] = [
  { id: "ancient", minYear: -3000, maxYear: 499 },
  { id: "medieval", minYear: 500, maxYear: 1499 },
  { id: "early_modern", minYear: 1500, maxYear: 1799 },
  { id: "industrial", minYear: 1800, maxYear: 1913 },
  { id: "modern", minYear: 1914, maxYear: 2024 },
] as const;

/** Map a year to its era id. Years outside the known range throw. */
export function eraForYear(year: number): EraId {
  for (const era of ERAS) {
    if (year >= era.minYear && year <= era.maxYear) return era.id;
  }
  throw new Error(`eraForYear: year ${year} is outside the known range`);
}

// ---------------------------------------------------------------------------
// Roles — the 10 character pool ids (GAME_SPEC §6).
// T3 passes this list to the LLM; T7 generates one portrait per era × role.
// ---------------------------------------------------------------------------

export type RoleId =
  | "hetman"
  | "monk"
  | "merchant"
  | "soldier"
  | "noblewoman"
  | "scribe"
  | "priest"
  | "peasant"
  | "spy"
  | "doctor";

export const ROLES: readonly RoleId[] = [
  "hetman",
  "monk",
  "merchant",
  "soldier",
  "noblewoman",
  "scribe",
  "priest",
  "peasant",
  "spy",
  "doctor",
] as const;

// ---------------------------------------------------------------------------
// Endings — 8 collapse + 5 survival = 13 (GAME_SPEC §3).
// Only ids and i18n keys live here; display strings are added by T8.
// ---------------------------------------------------------------------------

export interface EndingConst {
  id: EndingId;
  kind: "collapse" | "survival";
  nameKey: string;
  descKey: string;
}

export const ENDINGS: readonly EndingConst[] = [
  // Collapse: meter × bound (0 or 100). Named examples from GAME_SPEC §3.
  {
    id: "stability_0",
    kind: "collapse",
    nameKey: "game.end.stability_0.name",
    descKey: "game.end.stability_0.desc",
  },
  {
    id: "stability_100",
    kind: "collapse",
    nameKey: "game.end.stability_100.name",
    descKey: "game.end.stability_100.desc",
  },
  {
    id: "people_0",
    kind: "collapse",
    nameKey: "game.end.people_0.name",
    descKey: "game.end.people_0.desc",
  },
  {
    id: "people_100",
    kind: "collapse",
    nameKey: "game.end.people_100.name",
    descKey: "game.end.people_100.desc",
  },
  {
    id: "power_0",
    kind: "collapse",
    nameKey: "game.end.power_0.name",
    descKey: "game.end.power_0.desc",
  },
  {
    id: "power_100",
    kind: "collapse",
    nameKey: "game.end.power_100.name",
    descKey: "game.end.power_100.desc",
  },
  {
    id: "faith_0",
    kind: "collapse",
    nameKey: "game.end.faith_0.name",
    descKey: "game.end.faith_0.desc",
  },
  {
    id: "faith_100",
    kind: "collapse",
    nameKey: "game.end.faith_100.name",
    descKey: "game.end.faith_100.desc",
  },
  // Survival: one per dominant meter + the rare "Quiet Line" (all 40–60).
  {
    id: "survival_stability",
    kind: "survival",
    nameKey: "game.end.survival_stability.name",
    descKey: "game.end.survival_stability.desc",
  },
  {
    id: "survival_people",
    kind: "survival",
    nameKey: "game.end.survival_people.name",
    descKey: "game.end.survival_people.desc",
  },
  {
    id: "survival_power",
    kind: "survival",
    nameKey: "game.end.survival_power.name",
    descKey: "game.end.survival_power.desc",
  },
  {
    id: "survival_faith",
    kind: "survival",
    nameKey: "game.end.survival_faith.name",
    descKey: "game.end.survival_faith.desc",
  },
  {
    id: "survival_quiet_line",
    kind: "survival",
    nameKey: "game.end.survival_quiet_line.name",
    descKey: "game.end.survival_quiet_line.desc",
  },
] as const;

// ---------------------------------------------------------------------------
// Mission templates — GAME_SPEC §2 step 2.
// `{year}` is substituted at run start. Short, grim, factual.
// ---------------------------------------------------------------------------

export interface MissionTemplate {
  id: string;
  text: string;
}

export const MISSION_TEMPLATES: readonly MissionTemplate[] = [
  {
    id: "cracking_timeline",
    text: "{year}. The timeline is cracking. Survive 12 decisions without breaking the world.",
  },
  {
    id: "weight_of_record",
    text: "{year}. History remembers what you choose. Walk 12 steps and keep the record intact.",
  },
  {
    id: "quiet_hand",
    text: "{year}. A quiet hand on 12 moments. Change what you must, preserve what you can.",
  },
  {
    id: "edge_of_rupture",
    text: "{year}. The world is one wrong step from rupture. Twelve choices stand between it and silence.",
  },
] as const;

// ---------------------------------------------------------------------------
// Bonus goals — optional, picked once per run (GAME_SPEC §2 step 2).
// ---------------------------------------------------------------------------

export interface BonusGoal {
  id: string;
  text: string;
}

export const BONUS_GOALS: readonly BonusGoal[] = [
  {
    id: "people_over_70",
    text: "Keep People above 70 and never let Faith drop below 30.",
  },
  {
    id: "no_power_above_80",
    text: "Finish the run with Power at or below 80 at every step.",
  },
  {
    id: "stability_floor_40",
    text: "Never let Stability drop below 40.",
  },
  {
    id: "faith_quiet",
    text: "Keep Faith between 40 and 60 for every decision.",
  },
  {
    id: "two_real_events",
    text: "Change at least two real events of the year before the deck ends.",
  },
] as const;
