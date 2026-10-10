// Acceptance tests for T1 — PiAPI provider with fal fallback (Wave 1).
// Source bullets: docs/game/EXECUTION_PLAN.md §4 T1 "Acceptance".
//
// G0b: these replace the export-only stubs. Every test asserts BEHAVIOUR
// (HTTP calls made, fallback taken, error surfaced), never just `typeof fn`.
// Network is fully mocked: global fetch for PiAPI, @fal-ai/client for fal.

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { dyn } from "./_dyn";

import created from "@/tests/fixtures/game/piapi.task-created.json";
import pending from "@/tests/fixtures/game/piapi.task-pending.json";
import success from "@/tests/fixtures/game/piapi.task-success.json";
import failed from "@/tests/fixtures/game/piapi.task-failed.json";
import insufficient from "@/tests/fixtures/game/piapi.402.json";

vi.mock("server-only", () => ({}));

const falSubscribe = vi.fn();
vi.mock("@fal-ai/client", () => ({
  fal: { config: vi.fn(), subscribe: (...a: unknown[]) => falSubscribe(...a) },
}));

const FAL_URL = "https://fal.media/files/fallback.jpg";
const PIAPI_URL = success.data.output.image_url;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

type Call = { url: string; init: RequestInit };
let calls: Call[];
function mockFetch(...responses: Array<Response | (() => Response)>) {
  calls = [];
  let i = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      const r = responses[Math.min(i++, responses.length - 1)];
      return typeof r === "function" ? r() : r.clone();
    }),
  );
}

type ImageMod = {
  callFlux: (prompt: string, width?: number, height?: number) => Promise<string>;
  FalAuthError: new (m: string) => Error;
};
async function loadImage(): Promise<ImageMod> {
  vi.resetModules();
  return (await dyn("@/lib/ai/image")) as ImageMod;
}

/** Run callFlux while advancing fake timers so poll waits / timeouts elapse. */
async function run<T>(p: Promise<T>, ms = 200_000): Promise<T> {
  const settled = p.then(
    (v) => ({ ok: true as const, v }),
    (e) => ({ ok: false as const, e }),
  );
  await vi.advanceTimersByTimeAsync(ms);
  const r = await settled;
  if (r.ok) return r.v;
  throw r.e;
}

beforeEach(() => {
  vi.useFakeTimers();
  falSubscribe.mockReset();
  falSubscribe.mockResolvedValue({ data: { images: [{ url: FAL_URL }] } });
  vi.stubEnv("PIAPI_KEY", "test-piapi-key");
  vi.stubEnv("FAL_KEY", "test-fal-key");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe.skip("[T1] PiAPI provider with fal fallback", () => {
  test("success after 2 polls returns PiAPI image_url and never calls fal", async () => {
    mockFetch(json(created), json(pending), json(success));
    const { callFlux } = await loadImage();
    const url = await run(callFlux("p", 768, 1024));
    expect(url).toBe(PIAPI_URL);
    expect(calls).toHaveLength(3); // create + 2 polls
    expect(calls[1].url).toMatch(/\/task\/task_abc_123$/);
    expect(falSubscribe).not.toHaveBeenCalled();
  });

  test("task status `failed` falls back to fal exactly once", async () => {
    mockFetch(json(created), json(failed));
    const { callFlux } = await loadImage();
    const url = await run(callFlux("p", 768, 1024));
    expect(url).toBe(FAL_URL);
    expect(falSubscribe).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(2); // create + the one poll that said `failed`; no waiting for timeout
  });

  test("timeout on PiAPI (always pending) falls back to fal", async () => {
    mockFetch(json(created), () => json(pending));
    const { callFlux } = await loadImage();
    const url = await run(callFlux("p", 768, 1024), 400_000);
    expect(url).toBe(FAL_URL);
    expect(falSubscribe).toHaveBeenCalledTimes(1);
    expect(calls.length).toBeGreaterThan(3);
  });

  test("missing PIAPI_KEY → PiAPI is never called, fal is used directly", async () => {
    vi.stubEnv("PIAPI_KEY", "");
    mockFetch(json(created));
    const { callFlux } = await loadImage();
    const url = await run(callFlux("p", 768, 1024));
    expect(url).toBe(FAL_URL);
    expect(calls).toHaveLength(0);
  });

  test("402 from PiAPI followed by fal failure surfaces a billing error", async () => {
    mockFetch(json(insufficient, 402));
    falSubscribe.mockRejectedValue(new Error("fal exploded"));
    const { callFlux, FalAuthError } = await loadImage();
    await expect(run(callFlux("p", 768, 1024))).rejects.toBeInstanceOf(FalAuthError);
  });

  test("402 from PiAPI rescued by fal success returns the fal url", async () => {
    mockFetch(json(insufficient, 402));
    const { callFlux } = await loadImage();
    expect(await run(callFlux("p", 768, 1024))).toBe(FAL_URL);
  });

  test("request body matches fixture shape exactly (model, task_type, input.width/height) and sends x-api-key", async () => {
    mockFetch(json(created), json(success));
    const { callFlux } = await loadImage();
    await run(callFlux("engraving prompt", 768, 1024));
    const create = calls[0];
    expect(create.url).toBe("https://api.piapi.ai/api/v1/task");
    expect(create.init.method).toBe("POST");
    expect(JSON.parse(String(create.init.body))).toEqual({
      model: "Qubico/flux1-schnell",
      task_type: "txt2img",
      input: { prompt: "engraving prompt", width: 768, height: 1024 },
    });
    const headers = create.init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("test-piapi-key");
  });

  test("portrait request → fal fallback asks for a portrait size, not 16:9", async () => {
    mockFetch(json(created), json(failed));
    const { callFlux } = await loadImage();
    await run(callFlux("p", 768, 1024));
    const input = (falSubscribe.mock.calls[0][1] as { input: { image_size: string } }).input;
    expect(input.image_size).not.toBe("landscape_16_9");
  });
});
