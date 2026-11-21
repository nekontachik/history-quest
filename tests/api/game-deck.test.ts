import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";

import referenceDeck from "@/shared/game/referenceDeck1648.json";
import { clone, makeDeck } from "../game/_deck";

// ---------------------------------------------------------------------------
// Mocks — the model, the events loader and Redis. No network.
// ---------------------------------------------------------------------------

import type { Deck } from "@/types/game";

const mockCreate = vi.fn();
const mockGenerateEvents = vi.fn();
const mockGetCachedEvents = vi.fn();
const mockSetCachedEvents = vi.fn();

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  eval: vi.fn(),
};

vi.mock("@/lib/ai/text", () => ({
  getOpenRouterClient: () => ({ chat: { completions: { create: mockCreate } } }),
  generateEvents: mockGenerateEvents,
}));

vi.mock("@/lib/infrastructure/cache", () => ({
  getCachedEvents: mockGetCachedEvents,
  setCachedEvents: mockSetCachedEvents,
}));

vi.mock("@/lib/infrastructure/redis-client", () => ({
  getRedisClient: () => mockRedis,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EVENTS = [
  {
    id: "1",
    title: "Battle of Korsun",
    description: "The Crown army is destroyed near Korsun in May 1648.",
    impact: "high",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Battle_of_Korsun",
  },
  {
    id: "2",
    title: "Peace of Westphalia",
    description: "Treaties signed in October 1648 end the Thirty Years' War.",
    impact: "high",
  },
];

function answer(content: string | null) {
  return { choices: [{ message: { content } }] };
}

/**
 * What the model sends back: the helper deck's cards around the five
 * reference entry ids, with Chronicle text of its own.
 */
function modelDeck(): Deck {
  const ids = referenceDeck.chronicle.map((e) => e.id);
  let json = JSON.stringify(makeDeck());
  ids.forEach((id, i) => {
    json = json.split(`"e${i + 1}"`).join(`"${id}"`);
  });
  return JSON.parse(json) as Deck;
}

/** What the route must answer: the model's cards, the hand-checked Chronicle. */
function servedDeck(): Deck {
  return { ...modelDeck(), chronicle: referenceDeck.chronicle as Deck["chronicle"] };
}

function validDeckJson(): string {
  return JSON.stringify(modelDeck());
}

/** A deck with one fault: card c01 gets an unknown portrait role. */
function invalidDeckJson(): string {
  const deck = clone(modelDeck());
  deck.cards[0].roleId = "king";
  return JSON.stringify(deck);
}

function makeRequest(): NextRequest {
  return new Request("http://localhost:3000/api/game/deck", {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.7" },
  }) as unknown as NextRequest;
}

describe("POST /api/game/deck", () => {
  let POST: typeof import("@/app/api/game/deck/route").POST;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("DECK_FIXTURE", "");
    vi.stubEnv("DECK_LIVE", "1");
    vi.stubEnv("RATE_LIMIT_SCENARIO", "");

    mockCreate.mockReset();
    mockGenerateEvents.mockReset().mockResolvedValue(EVENTS);
    mockGetCachedEvents.mockReset().mockResolvedValue(null);
    mockSetCachedEvents.mockReset().mockResolvedValue(undefined);
    mockRedis.get.mockReset().mockResolvedValue(null);
    mockRedis.set.mockReset().mockResolvedValue("OK");
    mockRedis.eval.mockReset().mockResolvedValue(1);

    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const mod = await import("@/app/api/game/deck/route");
    POST = mod.POST;
  });

  afterEach(() => {
    errorSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  // ── Reference deck without a model call ────────────────────────────────

  it("returns the reference deck with no model call unless DECK_LIVE=1", async () => {
    vi.stubEnv("DECK_LIVE", "");

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(res.headers.get("x-deck-source")).toBe("reference");
    expect(await res.json()).toEqual(referenceDeck);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockRedis.eval).not.toHaveBeenCalled();
  });

  it("returns the reference deck with no model call when DECK_FIXTURE=1", async () => {
    vi.stubEnv("DECK_FIXTURE", "1");

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(res.headers.get("x-deck-source")).toBe("reference");
    expect(await res.json()).toEqual(referenceDeck);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockGenerateEvents).not.toHaveBeenCalled();
    // Fixture mode does not spend the rate limit.
    expect(mockRedis.eval).not.toHaveBeenCalled();
  });

  it("returns the reference deck with no model call when OPENROUTER_API_KEY is missing", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(res.headers.get("x-deck-source")).toBe("reference");
    expect(await res.json()).toEqual(referenceDeck);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockRedis.eval).not.toHaveBeenCalled();
  });

  // ── Generation ─────────────────────────────────────────────────────────

  it("returns a valid generated deck with source 'generated'", async () => {
    mockCreate.mockResolvedValueOnce(answer(validDeckJson()));

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(res.headers.get("x-deck-source")).toBe("generated");
    expect(await res.json()).toEqual(servedDeck());
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("builds the request from the five reference events and the portrait roles", async () => {
    mockCreate.mockResolvedValueOnce(answer(validDeckJson()));

    await POST(makeRequest());

    // The live events pipeline (at most three events a year) is not used.
    expect(mockGetCachedEvents).not.toHaveBeenCalled();
    expect(mockGenerateEvents).not.toHaveBeenCalled();

    const request = mockCreate.mock.calls[0][0];
    expect(request.model).toBe("anthropic/claude-sonnet-4.6");
    expect(request.messages.map((m: { role: string }) => m.role)).toEqual(["system", "user"]);
    const user: string = request.messages[1].content;
    expect(user).toContain("Year: 1648");
    expect(referenceDeck.chronicle).toHaveLength(5);
    for (const entry of referenceDeck.chronicle) {
      expect(user).toContain(entry.title);
      expect(user).toContain(`sourceUrl: ${entry.sourceUrl}`);
    }
    expect(user).toContain("wife, scout, doctor, monk, merchant, envoy, peasant, elder");
  });

  it("parses an answer wrapped in a ```json fence", async () => {
    mockCreate.mockResolvedValueOnce(answer("```json\n" + validDeckJson() + "\n```"));

    const res = await POST(makeRequest());

    expect(res.headers.get("x-deck-source")).toBe("generated");
    expect(await res.json()).toEqual(servedDeck());
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("drops fields the contract does not know before answering", async () => {
    const deck = clone(modelDeck()) as unknown as Record<string, unknown>;
    deck.note = "<script>alert(1)</script>";
    mockCreate.mockResolvedValueOnce(answer(JSON.stringify(deck)));

    const res = await POST(makeRequest());

    const body = await res.json();
    expect(body).toEqual(servedDeck());
    expect(body).not.toHaveProperty("note");
  });

  // ── Retry and fallback ─────────────────────────────────────────────────

  it("retries exactly once with the validation errors after an invalid answer", async () => {
    const bad = invalidDeckJson();
    mockCreate
      .mockResolvedValueOnce(answer(bad))
      .mockResolvedValueOnce(answer(validDeckJson()));

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(res.headers.get("x-deck-source")).toBe("generated");
    expect(await res.json()).toEqual(servedDeck());
    expect(mockCreate).toHaveBeenCalledTimes(2);

    const first = mockCreate.mock.calls[0][0].messages;
    const second = mockCreate.mock.calls[1][0].messages;
    expect(second).toHaveLength(first.length + 2);
    expect(second.slice(0, first.length)).toEqual(first);
    expect(second[first.length]).toEqual({ role: "assistant", content: bad });

    const retry = second[first.length + 1];
    expect(retry.role).toBe("user");
    expect(retry.content).toContain("Validation errors");
    expect(retry.content).toContain('card "c01" roleId');
  });

  it("retries when the first answer is not JSON at all", async () => {
    mockCreate
      .mockResolvedValueOnce(answer("Sorry, I cannot write that deck."))
      .mockResolvedValueOnce(answer(validDeckJson()));

    const res = await POST(makeRequest());

    expect(res.headers.get("x-deck-source")).toBe("generated");
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[1][0].messages.at(-1).content).toContain("not valid JSON");
  });

  it("falls back to the reference deck after two invalid answers", async () => {
    mockCreate.mockResolvedValue(answer(invalidDeckJson()));

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(res.headers.get("x-deck-source")).toBe("reference");
    expect(await res.json()).toEqual(referenceDeck);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockRedis.set).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    expect(String(errorSpy.mock.calls[0][0])).toContain("[deck]");
  });

  it("falls back to the reference deck when the deck is for another year", async () => {
    const deck = clone(modelDeck());
    deck.year = 1649;
    mockCreate.mockResolvedValue(answer(JSON.stringify(deck)));

    const res = await POST(makeRequest());

    expect(res.headers.get("x-deck-source")).toBe("reference");
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("falls back to the reference deck when the model call throws", async () => {
    mockCreate.mockRejectedValueOnce(new Error("upstream 502"));

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(res.headers.get("x-deck-source")).toBe("reference");
    expect(await res.json()).toEqual(referenceDeck);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("falls back to the reference deck when the model call fails", async () => {
    mockCreate.mockRejectedValueOnce(new Error("model down"));

    const res = await POST(makeRequest());

    expect(res.headers.get("x-deck-source")).toBe("reference");
    expect(await res.json()).toEqual(referenceDeck);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  // ── Rate limit ─────────────────────────────────────────────────────────

  it("returns 429 and makes no model call when the scenario limit is exceeded", async () => {
    mockRedis.eval.mockResolvedValueOnce(11); // BUCKET_LIMITS.scenario is 10

    const res = await POST(makeRequest());

    expect(res.status).toBe(429);
    expect(res.headers.get("x-deck-source")).toBeNull();
    expect((await res.json()).error).toBe("Daily limit reached");
    expect(String(mockRedis.eval.mock.calls[0][2])).toContain("ratelimit:scenario:203.0.113.7");
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockGenerateEvents).not.toHaveBeenCalled();
  });

  // ── Cache ──────────────────────────────────────────────────────────────

  it("stores a generated deck in Redis for one hour under a versioned key", async () => {
    mockCreate.mockResolvedValueOnce(answer(validDeckJson()));

    await POST(makeRequest());

    expect(mockRedis.set).toHaveBeenCalledTimes(1);
    const [key, value, mode, ttl] = mockRedis.set.mock.calls[0];
    expect(key).toMatch(/^deck:v\d+:1648$/);
    expect(JSON.parse(value)).toEqual(servedDeck());
    expect(mode).toBe("EX");
    expect(ttl).toBe(3600);
  });

  it("serves a cached deck without calling the model", async () => {
    mockRedis.get.mockResolvedValueOnce(JSON.stringify(servedDeck()));

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(res.headers.get("x-deck-source")).toBe("generated");
    expect(await res.json()).toEqual(servedDeck());
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockGenerateEvents).not.toHaveBeenCalled();
  });

  it("ignores a cached deck that no longer passes validation", async () => {
    mockRedis.get.mockResolvedValueOnce(invalidDeckJson());
    mockCreate.mockResolvedValueOnce(answer(validDeckJson()));

    const res = await POST(makeRequest());

    expect(res.headers.get("x-deck-source")).toBe("generated");
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("still generates a deck when Redis fails on read and write", async () => {
    mockRedis.get.mockRejectedValueOnce(new Error("redis down"));
    mockRedis.set.mockRejectedValueOnce(new Error("redis down"));
    mockRedis.eval.mockRejectedValueOnce(new Error("redis down"));
    mockCreate.mockResolvedValueOnce(answer(validDeckJson()));

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(res.headers.get("x-deck-source")).toBe("generated");
    expect(await res.json()).toEqual(servedDeck());
  });
});
