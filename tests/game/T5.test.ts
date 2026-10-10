// Acceptance tests for T5 — Image prompt builders + QA checklist (Wave 1).
// Source bullets: docs/game/EXECUTION_PLAN.md §4 T5 "Acceptance".
//
// G0b: behaviour tests. The vision model is mocked at the `openai` package
// boundary — no network.

import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  FORBIDDEN_PROMPT_WORDS,
  PROMPT_MAX_CHARS,
  STYLE_ARTIFACT,
  STYLE_PORTRAIT,
  STYLE_SCENE,
  STYLE_TAIL,
} from "@/constants/image";
import regression from "@/art/prompts/regression.json";

import { dyn } from "./_dyn";

vi.mock("server-only", () => ({}));

const create = vi.fn();
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: (...a: unknown[]) => create(...a) } };
  },
}));

type PromptsMod = {
  buildImagePrompt: (kind: "portrait" | "scene" | "artifact", subject: string) => string;
  eraWords: (year: number) => string;
};
type QaMod = {
  checkImage: (url: string, o: { object: string; emotion: string }) => Promise<unknown>;
};
const prompts = async () => (await dyn("@/shared/game/image-prompts")) as PromptsMod;
const qa = async () => {
  vi.resetModules();
  return (await dyn("@/lib/ai/image-qa")) as QaMod;
};
const reply = (content: string) => ({ choices: [{ message: { content } }] });
const GOOD = { hasText: false, hasBorder: false, nonHumanFeatures: false, objectVisible: true, emotionMatches: true };

beforeEach(() => {
  create.mockReset();
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
});

describe.skip("[T5] Image prompt builders + QA checklist", () => {
  test("preset first, subject in the middle, tail last — for every kind", async () => {
    const { buildImagePrompt } = await prompts();
    const cases = [
      ["portrait", STYLE_PORTRAIT],
      ["scene", STYLE_SCENE],
      ["artifact", STYLE_ARTIFACT],
    ] as const;
    for (const [kind, preset] of cases) {
      const p = buildImagePrompt(kind, "Weary scout gripping a brass compass");
      expect(p.startsWith(preset)).toBe(true);
      expect(p.endsWith(STYLE_TAIL)).toBe(true);
      expect(p).toContain("Weary scout gripping a brass compass");
    }
  });

  test("forbidden words are removed as whole words, case-insensitive; innocent substrings survive", async () => {
    const { buildImagePrompt } = await prompts();
    const p = buildImagePrompt("portrait", "Gothic monk by a Candle in smoke, yearning, pointed ears, within earshot");
    const subject = p.slice(STYLE_PORTRAIT.length, p.length - STYLE_TAIL.length).toLowerCase();
    for (const w of FORBIDDEN_PROMPT_WORDS) {
      expect(subject).not.toMatch(new RegExp(`(^|[^a-z])${w}([^a-z]|$)`));
    }
    expect(subject).toContain("yearning");
    expect(subject).toContain("earshot");
    expect(subject).not.toMatch(/ {2,}/);
  });

  test(`prompt over ${PROMPT_MAX_CHARS} chars throws, at the limit does not`, async () => {
    const { buildImagePrompt } = await prompts();
    const room = PROMPT_MAX_CHARS - STYLE_PORTRAIT.length - STYLE_TAIL.length - 2;
    expect(() => buildImagePrompt("portrait", "a".repeat(room))).not.toThrow();
    expect(() => buildImagePrompt("portrait", "a".repeat(room + 1))).toThrow();
  });

  test("eraWords never contains digits across the whole year range", async () => {
    const { eraWords } = await prompts();
    for (const y of [-3000, -753, -44, 0, 499, 500, 1066, 1499, 1500, 1648, 1799, 1800, 1913, 1914, 1969, 2024, 2100]) {
      const w = eraWords(y);
      expect(w.length).toBeGreaterThan(0);
      expect(w).not.toMatch(/\d/);
    }
    expect(eraWords(-753)).not.toBe(eraWords(1969));
  });

  test("all 10 regression subjects build as portraits under the limit", async () => {
    const { buildImagePrompt } = await prompts();
    expect(regression).toHaveLength(10);
    for (const r of regression as Array<{ name: string; prompt: string }>) {
      const subject = r.prompt.replace(STYLE_TAIL, "").trim();
      const p = buildImagePrompt("portrait", subject);
      expect(p.length, r.name).toBeLessThanOrEqual(PROMPT_MAX_CHARS);
    }
  });

  test("QA: clean checklist JSON (even fenced) → ok:true with checks", async () => {
    create.mockResolvedValue(reply("```json\n" + JSON.stringify(GOOD) + "\n```"));
    const { checkImage } = await qa();
    const r = await checkImage("https://x/y.jpg", { object: "compass", emotion: "fear" });
    expect(r).toEqual({ ok: true, checks: GOOD });
    const msgs = JSON.stringify(create.mock.calls[0][0]);
    expect(msgs).toContain("compass");
    expect(msgs).toContain("https://x/y.jpg");
  });

  test.each([
    ["hasText", { ...GOOD, hasText: true }],
    ["hasBorder", { ...GOOD, hasBorder: true }],
    ["nonHumanFeatures", { ...GOOD, nonHumanFeatures: true }],
    ["objectVisible", { ...GOOD, objectVisible: false }],
    ["emotionMatches", { ...GOOD, emotionMatches: false }],
  ])("QA: a single failing check (%s) → ok:false", async (_name, checks) => {
    create.mockResolvedValue(reply(JSON.stringify(checks)));
    const { checkImage } = await qa();
    const r = await checkImage("u", { object: "o", emotion: "e" });
    expect(r).toMatchObject({ ok: false });
  });

  test.each([
    ["prose", "Looks fine to me!"],
    ["missing key", JSON.stringify({ hasText: false })],
    ["wrong type", JSON.stringify({ ...GOOD, hasText: "no" })],
    ["empty", ""],
  ])("QA: malformed reply (%s) → { skipped: true }", async (_name, content) => {
    create.mockResolvedValue(reply(content));
    const { checkImage } = await qa();
    expect(await checkImage("u", { object: "o", emotion: "e" })).toEqual({ skipped: true });
  });

  test("QA: network error → { skipped: true } (fail-open)", async () => {
    create.mockRejectedValue(new Error("ECONNRESET"));
    const { checkImage } = await qa();
    expect(await checkImage("u", { object: "o", emotion: "e" })).toEqual({ skipped: true });
  });
});
