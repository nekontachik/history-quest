import "server-only";
import OpenAI from "openai";
import type { HistoricalEvent } from "@/types";
import { searchEventContext } from "@/lib/tavily";
import { findWikipediaUrl } from "@/lib/ai/search";
import {
  eventTitlesPrompt,
  enrichEventPrompt,
  scenarioPrompt,
  parseEventTitles,
  yearLabel,
} from "@/lib/ai/prompts";

/**
 * Text generation via OpenRouter.
 *
 * Uses OpenAI-compatible SDK pointed at OpenRouter's API endpoint.
 * - Historical events → fast Gemini Flash model
 * - Alternative history scenarios → Claude Sonnet (streaming)
 *
 * Prompts live in lib/ai/prompts.ts (shared with the eval harness).
 */

let cachedClient: OpenAI | null = null;

/**
 * Created on first use, not at module load: `next build` imports every route
 * to collect page data, and the SDK throws when no key is set, which broke
 * builds in environments without OPENROUTER_API_KEY (preview deployments).
 */
export function getOpenRouterClient(): OpenAI {
  if (!cachedClient) {
    cachedClient = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }
  return cachedClient;
}

export async function generateEventTitles(
  year: number,
  lang: string
): Promise<HistoricalEvent[]> {
  const spec = eventTitlesPrompt(year, lang);

  const response = await getOpenRouterClient().chat.completions.create({
    model: spec.model,
    max_tokens: spec.maxTokens,
    messages: spec.messages,
    response_format: spec.responseFormat as any,
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("Empty response from model");

  return parseEventTitles(text);
}

export async function enrichEventWithContext(
  event: HistoricalEvent,
  tavilySnippets: string,
  lang: string
): Promise<string> {
  const spec = enrichEventPrompt(event, tavilySnippets, lang);

  const response = await getOpenRouterClient().chat.completions.create({
    model: spec.model,
    max_tokens: spec.maxTokens,
    messages: spec.messages,
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("Empty response from model");
  return text.trim();
}

export async function generateEvents(
  year: number,
  lang: string
): Promise<HistoricalEvent[]> {
  const raw = await generateEventTitles(year, lang);

  const events = await Promise.all(
    raw.map(async (e) => {
      const [tavilyResult, wikipediaUrl] = await Promise.all([
        searchEventContext(e.title, year),
        findWikipediaUrl(`${e.title} ${yearLabel(year)}`).then((u) => u ?? undefined),
      ]);

      const description =
        tavilyResult.snippets.length > 0
          ? await enrichEventWithContext(e, tavilyResult.snippets.join("\n\n"), lang)
          : e.description;

      return {
        ...e,
        description,
        thumbnail: tavilyResult.imageUrl,
        sourceUrl: tavilyResult.sourceUrl,
        wikipediaUrl,
      };
    })
  );

  return events;
}

export async function streamScenario({
  year,
  changes,
  lang,
  premium,
}: {
  year: number;
  changes: string;
  lang: string;
  premium?: { country: string; city: string };
}): Promise<ReadableStream<Uint8Array>> {
  const spec = scenarioPrompt({
    year,
    changes,
    lang,
    premium,
    canary: process.env.REDTEAM_CANARY, // red-team only; undefined in prod
  });

  const stream = await getOpenRouterClient().chat.completions.create({
    model: spec.model,
    max_tokens: spec.maxTokens,
    stream: true,
    messages: spec.messages,
  });

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          controller.enqueue(encoder.encode(delta));
        }
      }
      controller.close();
    },
  });
}
