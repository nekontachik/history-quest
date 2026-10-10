// ---------------------------------------------------------------------------
// Chrono Agent — zod schemas for the frozen contract.
// PURE, CLIENT-SAFE: no `import "server-only"`, no Node-only imports.
// Rules mirror docs/game/GAME_SPEC.md §4–5. Later tasks may read, not change.
// ---------------------------------------------------------------------------

import { z } from "zod";

import type { Deck } from "@/types/game";

// Minimal integer validator we use for every meter effect.
const integerInEffectRange = z
  .number()
  .int("effect must be an integer")
  .gte(-25, "effect must be >= -25")
  .lte(25, "effect must be <= 25");

export const MeterSchema = z.enum(["stability", "people", "power", "faith"]);

/**
 * Effects: 1–3 meters, integers in [-25, 25]. GAME_SPEC §4.
 * zod records don't enforce key count, so we check it inside `.superRefine`
 * on CardOptionSchema below.
 */
const EffectsSchema = z.record(MeterSchema, integerInEffectRange);

export const CardOptionSchema = z
  .object({
    label: z.string().min(1, "label is required"),
    effects: EffectsSchema,
    consequence: z
      .string()
      .min(1, "consequence is required")
      .max(220, "consequence must be <= 220 chars"),
  })
  .superRefine((opt, ctx) => {
    const n = Object.keys(opt.effects).length;
    if (n < 1 || n > 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["effects"],
        message: `effects must have 1-3 meters (got ${n})`,
      });
    }
  });

export const ConflictTypeSchema = z.enum([
  "life_vs_history",
  "one_vs_many",
  "now_vs_later",
  "truth_vs_peace",
]);

export const CardSchema = z.object({
  id: z.string().min(1, "card id is required"),
  roleId: z.string().min(1, "roleId is required"),
  speakerName: z.string().min(1, "speakerName is required"),
  line: z
    .string()
    .min(1, "line is required")
    .max(220, "line must be <= 220 chars"),
  realEventRef: z.string().min(1).optional(),
  conflictType: ConflictTypeSchema,
  left: CardOptionSchema,
  right: CardOptionSchema,
});

/**
 * DeckSchema — the gate every LLM-returned deck must pass. GAME_SPEC §4–5.
 *
 * Enforced here (shape only; roleId allow-list is enforced by `validateDeck`
 * because it depends on the era):
 *   • exactly 12 cards
 *   • <= 3 cards per conflictType
 *   • >= 4 cards with `realEventRef`
 *
 * Per-card effect range / count / integer-ness are enforced by CardOptionSchema.
 */
export const DeckSchema = z
  .array(CardSchema)
  .length(12, "deck must contain exactly 12 cards (size rule)")
  .superRefine((deck, ctx) => {
    const counts: Record<string, number> = {};
    let realEventCount = 0;
    for (const card of deck) {
      counts[card.conflictType] = (counts[card.conflictType] ?? 0) + 1;
      if (card.realEventRef) realEventCount += 1;
    }
    for (const [type, n] of Object.entries(counts)) {
      if (n > 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [],
          message: `conflict cap exceeded: '${type}' appears ${n} times (max 3)`,
        });
      }
    }
    if (realEventCount < 4) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [],
        message: `realEvent minimum not met: ${realEventCount} cards have realEventRef (need >= 4)`,
      });
    }
  });

// ---------------------------------------------------------------------------
// Artifact — stored keepsake, GAME_SPEC §2 step 7.
// ---------------------------------------------------------------------------

export const EndingIdSchema = z.enum([
  "stability_0",
  "stability_100",
  "people_0",
  "people_100",
  "power_0",
  "power_100",
  "faith_0",
  "faith_100",
  "survival_stability",
  "survival_people",
  "survival_power",
  "survival_faith",
  "survival_quiet_line",
]);

export const DecisionLogEntrySchema = z.object({
  cardId: z.string().min(1),
  side: z.enum(["left", "right"]),
  effects: EffectsSchema,
  metersAfter: z.object({
    stability: z.number().int().min(0).max(100),
    people: z.number().int().min(0).max(100),
    power: z.number().int().min(0).max(100),
    faith: z.number().int().min(0).max(100),
  }),
  consequence: z.string().min(1).max(220),
});

export const ArtifactSchema = z.object({
  id: z.string().min(1),
  endingId: EndingIdSchema,
  rare: z.boolean(),
  title: z.string().min(1),
  summary: z.string().min(1),
  coverUrl: z.string().url("coverUrl must be a URL"),
  year: z.number().int(),
  createdAt: z.string().min(1),
  playerId: z.string().min(1),
  lineage: z.array(DecisionLogEntrySchema),
});

// ---------------------------------------------------------------------------
// validateDeck — the one entry point T3 uses.
// Returns a tagged union so callers never have to try/catch.
// ---------------------------------------------------------------------------

export interface ValidateDeckOk {
  ok: true;
  deck: Deck;
}

export interface ValidateDeckErr {
  ok: false;
  errors: string[];
}

export type ValidateDeckResult = ValidateDeckOk | ValidateDeckErr;

/**
 * Validate a raw LLM output as a Deck.
 *
 * Rules enforced:
 *   1. Shape via DeckSchema
 *   2. Every card.roleId ∈ allowedRoleIds
 *   3. Deck size exactly 12
 *   4. Per-card effects: 1–3 meters, integers in [-25, 25]
 *   5. Conflict-type cap <= 3 per type
 *   6. >= 4 cards with realEventRef
 *   7. (when groundedEventIds given) every realEventRef ∈ groundedEventIds
 *
 * Errors are human-readable strings including the failing rule name
 * (`size`, `effects range`, `effects count`, `effects integer`, `conflict`,
 * `realEvent`, `role`, `grounding`) and, where applicable, the card index.
 */
export function validateDeck(
  raw: unknown,
  allowedRoleIds: readonly string[],
  /**
   * G0b grounding rule. Ids of the year's events that came back from the
   * existing Time Machine pipeline (`generateEvents` → Tavily/Wikipedia) WITH
   * a source URL. When given, every `realEventRef` must be one of these ids —
   * a card may not cite an event the grounded pipeline did not return.
   * Omit only in unit tests that do not exercise grounding.
   */
  groundedEventIds?: readonly string[],
): ValidateDeckResult {
  const parsed = DeckSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: string[] = [];
    for (const issue of parsed.error.issues) {
      errors.push(formatIssue(issue));
    }
    return { ok: false, errors };
  }

  const roleErrors: string[] = [];
  parsed.data.forEach((card, idx) => {
    if (!allowedRoleIds.includes(card.roleId)) {
      roleErrors.push(
        `card ${idx}: role rule violated — roleId '${card.roleId}' is not in the allowed role list`,
      );
    }
  });
  if (roleErrors.length) {
    return { ok: false, errors: roleErrors };
  }

  if (groundedEventIds) {
    const groundErrors: string[] = [];
    parsed.data.forEach((card, idx) => {
      if (card.realEventRef && !groundedEventIds.includes(card.realEventRef)) {
        groundErrors.push(
          `card ${idx}: grounding rule violated — realEventRef '${card.realEventRef}' is not one of the year's sourced events [${groundedEventIds.join(", ")}]`,
        );
      }
    });
    if (groundErrors.length) {
      return { ok: false, errors: groundErrors };
    }
  }

  return { ok: true, deck: parsed.data };
}

// Map a zod issue into a human-readable string that names the failing rule.
function formatIssue(issue: z.ZodIssue): string {
  const path = issue.path.length ? ` at ${issue.path.join(".")}` : "";
  const msg = issue.message;
  const low = msg.toLowerCase();
  let rule = "schema";
  if (low.includes("size rule") || low.includes("12 cards")) {
    rule = "size";
  } else if (low.includes("conflict cap")) {
    rule = "conflict";
  } else if (low.includes("realevent")) {
    rule = "realEvent";
  } else if (low.includes("effect must be an integer")) {
    rule = "effects integer";
  } else if (
    low.includes("effect must be >=") ||
    low.includes("effect must be <=")
  ) {
    rule = "effects range";
  } else if (low.includes("effects must have")) {
    rule = "effects count";
  } else if (low.includes("roleid")) {
    rule = "role";
  }
  // Card index, when the path points at a specific element of the deck.
  const cardIdx =
    typeof issue.path[0] === "number" ? ` (card ${issue.path[0]})` : "";
  return `${rule} rule violated${cardIdx}${path}: ${msg}`;
}
