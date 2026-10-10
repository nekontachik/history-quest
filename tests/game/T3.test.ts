// Acceptance tests for T3 — Deck generation API (Wave 1).
// Source bullets: docs/game/EXECUTION_PLAN.md §4 T3 "Acceptance".
//
// G0b: behaviour tests + the grounding contract. Cards may cite only events
// that the EXISTING Time Machine pipeline (`generateEvents`: Gemini titles →
// Tavily/Wikipedia enrichment) returned WITH a source URL. Unsourced events
// are never citable; a year with zero sourced events yields `deck_ungrounded`
// without spending an LLM call on the deck.
//
// Contract fixed here (T3 implements it, may not change it):
//   lib/game/deck.ts
//     generateDeck(
//       { year: number; locale: "uk" | "en" },
//       deps?: {
//         getEvents(year: number): Promise<HistoricalEvent[]>;   // default: generateEvents(year, "en")
//         complete(system: string, user: string): Promise<string>; // default: OpenRouter scenario model
//         cache: { get(key: string): Promise<unknown | null>; set(key: string, v: unknown): Promise<void> };
//       },
//     ): Promise<
//       | { ok: true; deck: Card[]; events: HistoricalEvent[] }   // events = the sourced events only
//       | { ok: false; error: "deck_invalid" | "deck_ungrounded"; errors: string[] }
//     >
//   lib/game/deck-prompt.ts
//     buildDeckSystemPrompt(year: number, events: HistoricalEvent[]): string
//   app/api/game/deck/route.ts  POST → 200 {deck, events} | 502 {error}

import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, test, vi } from "vitest";

import { STYLE_VERSION } from "@/constants/image";
import deckValid from "@/tests/fixtures/game/deck.valid.json";
import events1648 from "@/tests/fixtures/game/events.1648.json";

import { dyn } from "./_dyn";

vi.mock("server-only", () => ({}));

const SOURCED = ["1648-zhovti-vody", "1648-westphalia"];
type RawCard = { realEventRef?: string; roleId: string };

/** deck.valid with every realEventRef pointed at a sourced 1648 event. */
function groundedDeck(): RawCard[] {
  let i = 0;
  return (deckValid as RawCard[]).map((c) =>
    c.realEventRef ? { ...c, realEventRef: SOURCED[i++ % SOURCED.length] } : { ...c },
  );
}
const text = (deck: unknown) => JSON.stringify(deck);

function deps(...replies: string[]) {
  let n = 0;
  return {
    getEvents: vi.fn(async (_year: number): Promise<unknown[]> => events1648),
    complete: vi.fn(async (_system: string, _user: string) => replies[Math.min(n++, replies.length - 1)]),
    cache: {
      get: vi.fn(async (_key: string): Promise<unknown> => null),
      set: vi.fn(async (_key: string, _v: unknown) => {}),
    },
  };
}

async function deckMod() {
  return (await dyn("@/lib/game/deck")) as {
    generateDeck: (
      req: { year: number; locale: "uk" | "en" },
      d?: ReturnType<typeof deps>,
    ) => Promise<
      | { ok: true; deck: RawCard[]; events: Array<{ id: string }> }
      | { ok: false; error: string; errors: string[] }
    >;
  };
}
async function promptMod() {
  return (await dyn("@/lib/game/deck-prompt")) as {
    buildDeckSystemPrompt: (year: number, events: unknown[]) => string;
  };
}

beforeEach(() => {
  vi.resetModules();
});

describe.skip("[T3] Deck generation API", () => {
  test("valid output → ok with 12 cards; returned events are the sourced ones only", async () => {
    const { generateDeck } = await deckMod();
    const d = deps(text(groundedDeck()));
    const r = await generateDeck({ year: 1648, locale: "uk" }, d);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.deck).toHaveLength(12);
      expect(r.events.map((e) => e.id).sort()).toEqual([...SOURCED].sort());
    }
    expect(d.getEvents).toHaveBeenCalledWith(1648);
    expect(d.complete).toHaveBeenCalledTimes(1);
  });

  test("fenced JSON with prose around it parses as a deck", async () => {
    const { generateDeck } = await deckMod();
    const fenced = "Here is the deck:\n\n```json\n" + text(groundedDeck()) + "\n```\nHope it helps.";
    const r = await generateDeck({ year: 1648, locale: "uk" }, deps(fenced));
    expect(r.ok).toBe(true);
  });

  test("truncated output retries exactly once, then deck_invalid", async () => {
    const { generateDeck } = await deckMod();
    const truncated = readFileSync("tests/fixtures/game/llm.deck.truncated.txt", "utf-8");
    const d = deps(truncated, truncated);
    const r = await generateDeck({ year: 1648, locale: "uk" }, d);
    expect(d.complete).toHaveBeenCalledTimes(2);
    expect(r).toMatchObject({ ok: false, error: "deck_invalid" });
  });

  test("invalid roleId → one retry whose prompt carries the validator errors; valid retry succeeds", async () => {
    const { generateDeck } = await deckMod();
    const bad = groundedDeck();
    bad[0] = { ...bad[0], roleId: "astronaut" };
    const d = deps(text(bad), text(groundedDeck()));
    const r = await generateDeck({ year: 1648, locale: "uk" }, d);
    expect(r.ok).toBe(true);
    expect(d.complete).toHaveBeenCalledTimes(2);
    const retryPrompt = d.complete.mock.calls[1].join("\n");
    expect(retryPrompt).toMatch(/astronaut/);
  });

  test("a card citing an event the pipeline did not return is rejected (hallucinated event)", async () => {
    const { generateDeck } = await deckMod();
    const bad = groundedDeck();
    const i = bad.findIndex((c) => c.realEventRef);
    bad[i] = { ...bad[i], realEventRef: "1648-invented-battle" };
    const r = await generateDeck({ year: 1648, locale: "uk" }, deps(text(bad), text(bad)));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe("deck_invalid");
      expect(r.errors.join(" ")).toMatch(/grounding.*1648-invented-battle/);
    }
  });

  test("an event without sourceUrl/wikipediaUrl is not citable", async () => {
    const { generateDeck } = await deckMod();
    const bad = groundedDeck();
    const i = bad.findIndex((c) => c.realEventRef);
    bad[i] = { ...bad[i], realEventRef: "1648-unsourced" };
    const r = await generateDeck({ year: 1648, locale: "uk" }, deps(text(bad), text(bad)));
    expect(r.ok).toBe(false);
  });

  test("zero sourced events → deck_ungrounded and the deck LLM is never called", async () => {
    const { generateDeck } = await deckMod();
    const d = deps(text(groundedDeck()));
    d.getEvents.mockResolvedValue([{ id: "x", title: "t", description: "d", impact: "low" }]);
    const r = await generateDeck({ year: 1648, locale: "uk" }, d);
    expect(r).toMatchObject({ ok: false, error: "deck_ungrounded" });
    expect(d.complete).not.toHaveBeenCalled();
  });

  test("system prompt contains every GAME_SPEC §5 rule verbatim", async () => {
    const { buildDeckSystemPrompt } = await promptMod();
    const prompt = buildDeckSystemPrompt(1648, events1648.slice(0, 2));
    const spec = readFileSync("docs/game/GAME_SPEC.md", "utf-8");
    const section = spec.split(/^## 5\./m)[1].split(/^## 6\./m)[0];
    const rules = section
      .split("\n")
      .filter((l) => /^\d\.\s/.test(l))
      .map((l) => l.replace(/^\d\.\s+/, "").replace(/\*\*/g, "").trim());
    expect(rules.length).toBe(7);
    for (const rule of rules) expect(prompt).toContain(rule);
  });

  test("system prompt lists each sourced event with its id, title and source URL — and not the unsourced one", async () => {
    const { buildDeckSystemPrompt } = await promptMod();
    const sourced = events1648.filter((e) => e.sourceUrl || e.wikipediaUrl);
    const prompt = buildDeckSystemPrompt(1648, sourced);
    for (const e of sourced) {
      expect(prompt).toContain(e.id);
      expect(prompt).toContain(e.title);
      expect(prompt).toContain(e.sourceUrl ?? e.wikipediaUrl ?? "");
    }
    expect(prompt).not.toContain("1648-unsourced");
  });

  test("cache hit on deck:${STYLE_VERSION}:${year}:${locale} skips events and LLM", async () => {
    const { generateDeck } = await deckMod();
    const d = deps(text(groundedDeck()));
    const cached = { ok: true, deck: groundedDeck(), events: events1648.slice(0, 2) };
    d.cache.get.mockImplementation(async (k: string) => (k === `deck:${STYLE_VERSION}:1648:uk` ? cached : null));
    const r = await generateDeck({ year: 1648, locale: "uk" }, d);
    expect(r.ok).toBe(true);
    expect(d.getEvents).not.toHaveBeenCalled();
    expect(d.complete).not.toHaveBeenCalled();
  });

  test("route: deck_invalid → 502 {error}, never a partial deck", async () => {
    vi.doMock("@/lib/game/deck", () => ({
      generateDeck: async () => ({ ok: false, error: "deck_invalid", errors: ["x"] }),
    }));
    const { POST } = (await dyn("@/app/api/game/deck/route")) as {
      POST: (req: Request) => Promise<Response>;
    };
    const res = await POST(
      new Request("http://localhost/api/game/deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: 1648, locale: "uk" }),
      }),
    );
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toEqual({ error: "deck_invalid" });
  });
});
