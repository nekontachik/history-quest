import "server-only";
/**
 * Chronicle deck generation: the five reference events → one model call
 * (plus at most one retry carrying the validation errors) → a validated Deck.
 *
 * Model output is untrusted. Nothing leaves this module unless it has passed
 * validateDeck — that includes decks read back from the Redis cache.
 */
import type { Deck } from "@/types/game";
import { PORTRAIT_ROLE_IDS, PROTOTYPE_YEAR } from "@/constants/game";
import { getOpenRouterClient } from "@/lib/ai/text";
import type { ChatMessage, PromptSpec } from "@/lib/ai/prompts";
import { getRedisClient } from "@/lib/infrastructure/redis-client";
import { deckPrompt, deckRetryMessage, type DeckPromptEvent } from "@/lib/game/deckPrompt";
import { validateDeck } from "@/shared/game/deckSchema";
import referenceDeckJson from "@/shared/game/referenceDeck1648.json";

/**
 * Bump when the prompt (lib/game/deckPrompt.ts), SCENARIO_MODEL or the Deck
 * contract changes, so stale decks are not served for the rest of their TTL.
 */
const DECK_CACHE_VERSION = "v1";
const DECK_CACHE_TTL_SECONDS = 60 * 60;

type DeckMessage = ChatMessage | { role: "assistant"; content: string };

export class DeckGenerationError extends Error {
  /** Validation or parse errors of the last attempt; empty for transport failures. */
  readonly errors: string[];

  constructor(message: string, errors: string[] = [], options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DeckGenerationError";
    this.errors = errors;
  }
}

function deckKey(year: number): string {
  return `deck:${DECK_CACHE_VERSION}:${year}`;
}

async function getCachedDeck(year: number): Promise<Deck | null> {
  try {
    const cached = await getRedisClient()?.get(deckKey(year));
    if (!cached) return null;
    const res = validateDeck(JSON.parse(cached));
    return res.ok && res.deck.year === year ? res.deck : null;
  } catch {
    return null;
  }
}

async function setCachedDeck(year: number, deck: Deck): Promise<void> {
  try {
    await getRedisClient()?.set(deckKey(year), JSON.stringify(deck), "EX", DECK_CACHE_TTL_SECONDS);
  } catch {
    // Cache write failure is non-fatal.
  }
}

/**
 * The Chronicle is built from the reference deck's five hand-checked events,
 * not from the live events pipeline: that pipeline returns at most three
 * events per year, and trace cards are only fair when their facts are sourced.
 * The model writes new cards around the same five entries.
 */
function chronicleEvents(reference: Deck): DeckPromptEvent[] {
  return reference.chronicle.map((entry) => ({
    title: entry.title,
    description: entry.summary,
    sourceUrl: entry.sourceUrl,
  }));
}

/** Removes a ```json fence or prose around the object, if the model added either. */
function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(trimmed);
  const body = fenced ? fenced[1] : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

type ParseResult = { ok: true; deck: Deck } | { ok: false; errors: string[] };

function parseDeck(text: string, year: number): ParseResult {
  if (text.trim().length === 0) return { ok: false, errors: ["deck: the answer was empty"] };

  let raw: unknown;
  try {
    raw = JSON.parse(extractJson(text));
  } catch {
    return {
      ok: false,
      errors: ["deck: the answer is not valid JSON (it may be cut off or wrapped in extra text)"],
    };
  }

  const res = validateDeck(raw);
  if (!res.ok) return res;
  if (res.deck.year !== year) {
    return { ok: false, errors: [`deck year: must be ${year}, found ${res.deck.year}`] };
  }
  return res;
}

async function askModel(spec: PromptSpec, messages: DeckMessage[]): Promise<string> {
  const response = await getOpenRouterClient().chat.completions.create({
    model: spec.model,
    max_tokens: spec.maxTokens,
    messages,
  });
  const content: unknown = response.choices[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

/**
 * A validated deck for PROTOTYPE_YEAR, from the cache or freshly generated.
 * Throws DeckGenerationError when the model call fails, or the answer is still invalid after the single retry.
 */
export async function generateDeck(): Promise<Deck> {
  const year = PROTOTYPE_YEAR;

  const cached = await getCachedDeck(year);
  if (cached) return cached;

  let first: string;
  let spec: PromptSpec;
  try {
    const reference = referenceDeckJson as unknown as Deck;
    spec = deckPrompt({
      year,
      events: chronicleEvents(reference),
      roleIds: PORTRAIT_ROLE_IDS,
      example: reference,
    });
    first = await askModel(spec, spec.messages);
  } catch (err) {
    throw new DeckGenerationError("Deck generation failed before validation", [], { cause: err });
  }

  let attempt = parseDeck(first, year);
  if (!attempt.ok) {
    const messages: DeckMessage[] = [...spec.messages];
    // An empty assistant turn is rejected by the provider, so it is left out.
    if (first.trim().length > 0) messages.push({ role: "assistant", content: first });
    messages.push(deckRetryMessage(attempt.errors));

    let second: string;
    try {
      second = await askModel(spec, messages);
    } catch (err) {
      throw new DeckGenerationError("Deck retry request failed", attempt.errors, { cause: err });
    }
    attempt = parseDeck(second, year);
  }

  if (!attempt.ok) {
    throw new DeckGenerationError("Model returned an invalid deck twice", attempt.errors);
  }

  await setCachedDeck(year, attempt.deck);
  return attempt.deck;
}
