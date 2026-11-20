// Chronicle deck validation. Pure and client-safe: no I/O, no lib/ imports.
// Rules: docs/game/CHRONICLE_RULES.md §4; numbers: constants/game.ts.
// The error strings are sent back to the model on retry, so each one is short
// and names the card or entry it is about.
import { z } from "zod";
import type { Deck } from "@/types/game";
import {
  CHRONICLE_SIZE,
  DECK_SIZE,
  EFFECT_MAX,
  EFFECT_MIN,
  KIND_LIMITS,
  LABEL_MAX_CHARS,
  LINE_MAX_CHARS,
  MAX_EFFECTS_PER_OPTION,
  METERS,
  PORTRAIT_ROLE_IDS,
} from "@/constants/game";

/** One sentence shown after a choice (types/game.ts: CardOption.consequence). */
export const CONSEQUENCE_MAX_CHARS = 220;
// Not game rules: upper bounds that keep untrusted text from breaking the layout.
const ID_MAX_CHARS = 40;
const TITLE_MAX_CHARS = 120;
const SUMMARY_MAX_CHARS = 400;
const SPEAKER_MAX_CHARS = 60;
const URL_MAX_CHARS = 500;
/** Cap on reported errors, so a badly broken answer does not flood the retry message. */
const MAX_ERRORS = 25;

const SIDES = ["left", "right"] as const;
const KINDS = ["fork", "trace", "hint"] as const;

function text(max: number) {
  return z
    .string()
    .max(max, `must be at most ${max} characters`)
    .refine((value) => value.trim().length > 0, "must not be empty");
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const EffectValueSchema = z
  .number({ invalid_type_error: "must be a number" })
  .int("must be an integer")
  .min(EFFECT_MIN, `must be at least ${EFFECT_MIN}`)
  .max(EFFECT_MAX, `must be at most ${EFFECT_MAX}`)
  .refine((value) => value !== 0, "must not be 0");

const EffectsSchema = z
  .object({
    stability: EffectValueSchema.optional(),
    people: EffectValueSchema.optional(),
    power: EffectValueSchema.optional(),
    faith: EffectValueSchema.optional(),
  })
  .strict(`allowed meters are ${METERS.join(", ")}`)
  .refine(
    (effects) => {
      const count = Object.values(effects).filter((value) => value !== undefined).length;
      return count >= 1 && count <= MAX_EFFECTS_PER_OPTION;
    },
    `must change 1 to ${MAX_EFFECTS_PER_OPTION} meters`,
  );

const EntrySchema = z.object({
  id: text(ID_MAX_CHARS),
  title: text(TITLE_MAX_CHARS),
  summary: text(SUMMARY_MAX_CHARS),
  sourceUrl: z
    .string()
    .max(URL_MAX_CHARS, `must be at most ${URL_MAX_CHARS} characters`)
    .refine(isHttpUrl, "must be an http(s) URL"),
  survivesFading: z.boolean(),
});

const OptionSchema = z.object({
  label: text(LABEL_MAX_CHARS),
  effects: EffectsSchema,
  consequence: text(CONSEQUENCE_MAX_CHARS),
  fadesEntryId: z.string().optional(),
  revealsEntryId: z.string().optional(),
});

const CardSchema = z.object({
  id: text(ID_MAX_CHARS),
  kind: z.enum(KINDS, {
    errorMap: () => ({ message: `must be one of ${KINDS.join(", ")}` }),
  }),
  roleId: z.enum(PORTRAIT_ROLE_IDS, {
    errorMap: () => ({ message: `must be one of ${PORTRAIT_ROLE_IDS.join(", ")}` }),
  }),
  speakerName: text(SPEAKER_MAX_CHARS),
  line: text(LINE_MAX_CHARS),
  chronicleRef: z.string().optional(),
  correct: z
    .enum(SIDES, { errorMap: () => ({ message: 'must be "left" or "right"' }) })
    .optional(),
  left: OptionSchema,
  right: OptionSchema,
});

const DeckShapeSchema = z.object({
  year: z.number().int("must be an integer"),
  chronicle: z.array(EntrySchema),
  cards: z.array(CardSchema),
});

type DeckShape = z.infer<typeof DeckShapeSchema>;

/** Counts, uniqueness, references and kind-specific field rules. */
function checkRules(deck: DeckShape, ctx: z.RefinementCtx): void {
  const issue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });

  if (deck.chronicle.length !== CHRONICLE_SIZE) {
    issue(
      ["chronicle"],
      `must have exactly ${CHRONICLE_SIZE} entries, found ${deck.chronicle.length}`,
    );
  }
  if (deck.cards.length !== DECK_SIZE) {
    issue(["cards"], `must have exactly ${DECK_SIZE} cards, found ${deck.cards.length}`);
  }

  const entryIds = new Set<string>();
  deck.chronicle.forEach((entry, index) => {
    if (entryIds.has(entry.id)) issue(["chronicle", index, "id"], "duplicate entry id");
    entryIds.add(entry.id);
  });

  const cardIds = new Set<string>();
  const counts: Record<(typeof KINDS)[number], number> = { fork: 0, trace: 0, hint: 0 };

  deck.cards.forEach((card, index) => {
    const at = (...rest: (string | number)[]) => ["cards", index, ...rest];

    if (cardIds.has(card.id)) issue(at("id"), "duplicate card id");
    cardIds.add(card.id);
    counts[card.kind] += 1;

    if (card.chronicleRef !== undefined && !entryIds.has(card.chronicleRef)) {
      issue(at("chronicleRef"), `names "${card.chronicleRef}", which is not an entry id`);
    }
    if (card.kind === "trace") {
      if (card.chronicleRef === undefined) issue(at("chronicleRef"), "is required on a trace card");
      if (card.correct === undefined) issue(at("correct"), "is required on a trace card");
    } else if (card.correct !== undefined) {
      issue(at("correct"), `is only allowed on trace cards, not on a ${card.kind} card`);
    }

    let reveals = 0;
    for (const side of SIDES) {
      const option = card[side];

      if (option.fadesEntryId !== undefined) {
        if (card.kind !== "fork") {
          issue(
            at(side, "fadesEntryId"),
            `is only allowed on fork options, not on a ${card.kind} card`,
          );
        } else if (!entryIds.has(option.fadesEntryId)) {
          issue(
            at(side, "fadesEntryId"),
            `names "${option.fadesEntryId}", which is not an entry id`,
          );
        }
      }

      if (option.revealsEntryId !== undefined) {
        if (card.kind !== "hint") {
          issue(
            at(side, "revealsEntryId"),
            `is only allowed on hint options, not on a ${card.kind} card`,
          );
          continue;
        }
        reveals += 1;
        if (!entryIds.has(option.revealsEntryId)) {
          issue(
            at(side, "revealsEntryId"),
            `names "${option.revealsEntryId}", which is not an entry id`,
          );
        }
        const hasPrice = Object.values(option.effects).some(
          (value) => typeof value === "number" && value < 0,
        );
        if (!hasPrice) {
          issue(at(side, "effects"), "the revealing option needs at least one negative effect");
        }
      }
    }
    if (card.kind === "hint" && reveals !== 1) {
      issue(at(), `a hint needs exactly one option with revealsEntryId, found ${reveals}`);
    }
  });

  for (const kind of KINDS) {
    const { min, max } = KIND_LIMITS[kind];
    if (counts[kind] < min || counts[kind] > max) {
      const allowed = min === max ? `exactly ${min}` : `${min}-${max}`;
      issue(["cards"], `must contain ${allowed} ${kind} cards, found ${counts[kind]}`);
    }
  }
}

/** The complete deck contract: shape plus every CHRONICLE_RULES §4 rule. */
export const DeckSchema = DeckShapeSchema.superRefine(checkRules);

function idAt(raw: unknown, list: "cards" | "chronicle", index: number): string | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const items = (raw as Record<string, unknown>)[list];
  if (!Array.isArray(items)) return undefined;
  const item: unknown = items[index];
  if (typeof item !== "object" || item === null) return undefined;
  const id = (item as Record<string, unknown>).id;
  return typeof id === "string" && id.trim().length > 0 ? id.slice(0, ID_MAX_CHARS) : undefined;
}

/** Turns a zod issue into one line such as `card "c03" left.effects.power: must not be 0`. */
function describeIssue(raw: unknown, issue: z.ZodIssue): string {
  const [head, index, ...rest] = issue.path;
  let subject: string;
  let field: (string | number)[];

  if ((head === "cards" || head === "chronicle") && typeof index === "number") {
    const noun = head === "cards" ? "card" : "entry";
    const id = idAt(raw, head, index);
    subject = id ? `${noun} "${id}"` : `${noun} #${index + 1}`;
    field = rest;
  } else if (head === undefined) {
    subject = "deck";
    field = [];
  } else {
    subject = `deck ${String(head)}`;
    field = index === undefined ? [] : [index, ...rest];
  }

  const where = field.length > 0 ? ` ${field.join(".")}` : "";
  const message = issue.message === "Required" ? "is required" : issue.message;
  return `${subject}${where}: ${message}`;
}

/**
 * Validates untrusted data as a Deck. Never mutates `raw`; on success the
 * returned deck is a fresh object holding only the known fields.
 */
export function validateDeck(
  raw: unknown,
): { ok: true; deck: Deck } | { ok: false; errors: string[] } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: ["deck: must be a JSON object with year, chronicle and cards"] };
  }

  const parsed = DeckSchema.safeParse(raw);
  if (parsed.success) return { ok: true, deck: parsed.data };

  const errors = Array.from(new Set(parsed.error.issues.map((issue) => describeIssue(raw, issue))));
  if (errors.length > MAX_ERRORS) {
    const hidden = errors.length - MAX_ERRORS;
    return { ok: false, errors: [...errors.slice(0, MAX_ERRORS), `deck: ${hidden} more errors`] };
  }
  return { ok: false, errors };
}
