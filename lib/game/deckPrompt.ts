import "server-only";
/**
 * Pure prompt builder for the Chronicle deck generator. No I/O, no network:
 * it only turns inputs into a model request spec. Rules come from
 * docs/game/CHRONICLE_RULES.md (§1, §3, §4) and docs/game/GAME_SPEC.md (§5);
 * every number is read from constants/game.ts.
 */
import type { Deck } from "@/types/game";
import type { ChatMessage, PromptSpec } from "@/lib/ai/prompts";
import { SCENARIO_MODEL } from "@/constants";
import {
  CHRONICLE_SIZE,
  COMMONER_START,
  COMMONER_STABILITY_DIVISOR,
  DECK_SIZE,
  EFFECT_MAX,
  EFFECT_MIN,
  FADE_STEP,
  KIND_LIMITS,
  LABEL_MAX_CHARS,
  LINE_MAX_CHARS,
  MAX_EFFECTS_PER_OPTION,
  METERS,
  METER_MAX,
  METER_MIN,
} from "@/constants/game";

export const DECK_MAX_TOKENS = 6000;

export interface DeckPromptEvent {
  title: string;
  description: string;
  sourceUrl?: string;
}

export interface DeckPromptInput {
  year: number;
  events: DeckPromptEvent[];
  roleIds: readonly string[];
  example: Deck;
}

function range({ min, max }: { min: number; max: number }): string {
  return min === max ? `exactly ${min}` : `${min}–${max}`;
}

function deckSystemPrompt(): string {
  const meterList = METERS.join(", ");
  const start = METERS.map((m) => `${m} ${COMMONER_START[m]}`).join(", ");
  const halvedExample = Math.trunc(EFFECT_MIN / COMMONER_STABILITY_DIVISOR);
  const firstFadeAt = COMMONER_START.stability - FADE_STEP;

  return `You are the narrative designer of "Chronicle", an alternate-history detective game played on cards. You write one complete deck for one real year. Return only valid JSON, no markdown.

THE GAME
- The player is a commoner: an ordinary person in a real year of history with one advantage. They secretly own the Chronicle, a book that should not exist, which lists ${CHRONICLE_SIZE} real events of their year before they happen.
- They can follow history and get by, or bend it and rise. The more they bend it, the less their knowledge is worth: entries in the Chronicle fade, and a faded entry may no longer come true.
- The question behind every card is "is this still the world I know?". Every card is one person from the hero's surroundings speaking directly to the hero, who answers with one of two actions (left or right).
- Four meters, ${METER_MIN}–${METER_MAX}: ${meterList}. The commoner starts at ${start}. A meter at ${METER_MIN} or below, or at ${METER_MAX} or above, ends the run.
- The commoner is unnoticed: every stability effect is divided by ${COMMONER_STABILITY_DIVISOR} and rounded toward zero before it applies (${EFFECT_MIN} becomes ${halvedExample}; a stability effect of 1 or -1 becomes 0, so never use those). One Chronicle entry fades for every ${FADE_STEP} points of stability lost from the start (the first at ${firstFadeAt}). So a real bend of history needs a written stability effect of about -16 to ${EFFECT_MIN}; a nudge needs less.

FAIRNESS RULE (never break it)
- An entry that has not faded is always true. The player always sees which entries have faded. The game never lies without that signal.
- Each entry carries a hidden boolean "survivesFading": whether the event still happens after the entry has faded. Choose false for events the hero's interference could plausibly prevent and true for events beyond a commoner's reach. Use a mix of both.
- Because a faded entry can be false, card text must never state as fact whether a Chronicle event happened. Consequences describe what the hero does and what it costs, not how the battle or the election ended.

THE CHRONICLE: exactly ${CHRONICLE_SIZE} entries
- Build entries only from the real events supplied by the user. Do not add events, dates, places or names that the supplied descriptions do not support.
- "id": short kebab-case. "title": short name of the event. "sourceUrl": copy the supplied sourceUrl of that event unchanged.
- "summary": 1–2 sentences in the future-certain voice of the book, stating concrete checkable details (month, place, who prevails). Trace cards are decided from this text alone.
- Order the entries chronologically.

THE CARDS: exactly ${DECK_SIZE}, ids "c01".."c${String(DECK_SIZE).padStart(2, "0")}"
Kinds: ${range(KIND_LIMITS.fork)} "fork", ${range(KIND_LIMITS.trace)} "trace", ${range(KIND_LIMITS.hint)} "hint".

1. fork — follow history or change it.
- Both options cost something real (each has at least one negative effect) and neither is strictly better: no option whose effects are all greater than or equal to the other's across the four meters.
- Exactly one option changes history. It has a negative stability effect and names the entry it endangers in "fadesEntryId". The option that follows history has no "fadesEntryId".
- No "correct" field. "chronicleRef" is optional.

2. trace — spot the detail.
- The speaker's line contains one concrete detail (a place, a month, who prevails) that the "summary" of the entry named in "chronicleRef" contradicts. The answer must be decidable from that summary alone.
- One option trusts the Chronicle, the other trusts the speaker; the labels make clear which is which.
- "chronicleRef" is required. "correct" is required: the side ("left" or "right") that trusts the Chronicle. Vary which side that is across the deck.
- Effects follow from the action taken, not from being right. No "fadesEntryId", no "revealsEntryId".

3. hint — someone sells knowledge about how firmly one entry is fixed.
- Exactly one option carries "revealsEntryId" (an existing entry id) and at least one negative effect: that is the price.
- The other option declines, reveals nothing, and still has a small cost or benefit.
- The speaker must not say the answer in the line or the consequence; the game reveals it.
- No "correct" field, no "fadesEntryId".

FIELDS AND LIMITS (every card)
- "roleId": one of the allowed roleIds given by the user, exactly as written. Use at least six different ones. "speakerName": a short name or description.
- "line": what the speaker says, in first person, at most ${LINE_MAX_CHARS} characters.
- "left" and "right": each has "label" (an action, at most ${LABEL_MAX_CHARS} characters), "consequence" (exactly one sentence, at most ${LINE_MAX_CHARS} characters) and "effects".
- "effects": 1–${MAX_EFFECTS_PER_OPTION} meters, keys only from ${meterList}, values non-zero integers from ${EFFECT_MIN} to ${EFFECT_MAX}. Never include a meter with value 0.
- "chronicleRef", "fadesEntryId" and "revealsEntryId" must name an existing entry id. Omit a field that does not apply; never write null.

DILEMMA RULES
- No free choice. Both options must cost something real; neither may be strictly better.
- The core tension is morality against preserving history: the hero knows what really happens. Saving people tends to break history (stability down); preserving history means letting them suffer, knowingly.
- Rotate conflict types: life vs history, one vs many, now vs later, truth vs peace. No more than 3 cards of the same type.
- At least one card in three refers to a Chronicle event, so the player feels what they are changing.
- Anachronisms: objects or knowledge from the future (a medicine, a glowing map, a wristwatch) appear in at least 4 cards, at least 3 of them forks, and drive the dilemma. One fork carries a trace of "the Rewriter", someone who leaves things from the future behind; never explain who that is.
- Effects must be consistent with the text: giving medicine raises people and lowers stability; lying on a cross lowers faith.
- Tone: a dark, respectful historical thriller. Suffering is acknowledged, never enjoyed. No gratuitous gore. No real living people. Real historical figures may be mentioned but should rarely speak; speakers are ordinary people around the hero.

SHAPE AND BALANCE OF THE RUN
- The first card is gentle. Spread trace and hint cards out; never two in a row. Put the hardest forks last. Place a trace or hint about an entry after a fork that could fade it.
- Mix which side (left or right) changes history, so that always choosing one side is not always bending history.
- From the starting meters, choosing left every time or right every time must not end the run before card 6, and a sensible mixed path must reach the last card. Remember the halved stability.

OUTPUT
- Language: English.
- Return one JSON object with exactly this shape and nothing else — no markdown, no code fences, no comments, no text before or after:
{"year": number, "chronicle": [{"id", "title", "summary", "sourceUrl", "survivesFading"}], "cards": [{"id", "kind", "roleId", "speakerName", "line", "chronicleRef"?, "correct"?, "left": {"label", "effects", "consequence", "fadesEntryId"?, "revealsEntryId"?}, "right": {...}}]}`;
}

function deckUserPrompt({ year, events, roleIds, example }: DeckPromptInput): string {
  const eventLines = events
    .map((event, index) => {
      const source = event.sourceUrl ? `\n   sourceUrl: ${event.sourceUrl}` : "";
      return `${index + 1}. ${event.title}\n   ${event.description}${source}`;
    })
    .join("\n");

  return `Year: ${year}

Real events of ${year} (the only material allowed for the Chronicle; choose exactly ${CHRONICLE_SIZE} and keep each sourceUrl unchanged):
${eventLines}

Allowed roleIds: ${roleIds.join(", ")}

Example of a valid deck (year ${example.year}). Match its structure and quality; do not reuse its cards, speakers' lines or wording:
${JSON.stringify(example)}

Write the deck for ${year} now. Return only the JSON object.`;
}

/** Prompt for generating one full Chronicle deck for a year. */
export function deckPrompt(input: DeckPromptInput): PromptSpec {
  return {
    model: SCENARIO_MODEL,
    maxTokens: DECK_MAX_TOKENS,
    messages: [
      { role: "system", content: deckSystemPrompt() },
      { role: "user", content: deckUserPrompt(input) },
    ],
  };
}

/** Follow-up user message for the single retry after a failed validation. */
export function deckRetryMessage(errors: string[]): ChatMessage {
  const list = errors.map((error) => `- ${error}`).join("\n");
  return {
    role: "user",
    content: `The deck you returned is invalid. Validation errors:
${list}

Fix every error, keep everything that was valid, and return the corrected full deck as one JSON object. Return only the JSON, no markdown and no explanation.`,
  };
}
