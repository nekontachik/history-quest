import { NextRequest, NextResponse } from "next/server";
import { DeckGenerationError, generateDeck } from "@/lib/game/deck";
import { checkBucketLimit, getClientIp } from "@/lib/infrastructure/rate-limit";
import referenceDeckJson from "@/shared/game/referenceDeck1648.json";
import type { Deck } from "@/types/game";

type DeckSource = "reference" | "generated";

function deckResponse(deck: Deck, source: DeckSource): NextResponse {
  return NextResponse.json(deck, {
    headers: { "x-deck-source": source, "Cache-Control": "no-store" },
  });
}

function referenceDeck(): NextResponse {
  return deckResponse(referenceDeckJson as unknown as Deck, "reference");
}

export async function POST(req: NextRequest) {
  // Fixture mode costs nothing, so it is answered before the rate limit is spent.
  if (process.env.DECK_FIXTURE === "1" || !process.env.OPENROUTER_API_KEY) {
    return referenceDeck();
  }

  const ip = getClientIp(req);
  const { allowed, limit } = await checkBucketLimit(ip, "scenario");
  if (!allowed) {
    return NextResponse.json(
      { error: "Daily limit reached", limit },
      { status: 429, headers: { "X-RateLimit-Remaining": "0" } }
    );
  }

  try {
    return deckResponse(await generateDeck(), "generated");
  } catch (err) {
    // The game must always be playable: any failure falls back to the reference deck.
    if (err instanceof DeckGenerationError) {
      console.error("[deck] generation failed:", err.message, err.errors, err.cause ?? "");
    } else {
      console.error("[deck] unhandled error:", err);
    }
    return referenceDeck();
  }
}
