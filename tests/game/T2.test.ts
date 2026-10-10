// Acceptance tests for T2 — Vercel Blob image store (Wave 1).
// Source bullets: docs/game/EXECUTION_PLAN.md §4 T2 "Acceptance".
//
// G0b: behaviour tests (keys, fail-open paths, config hosts). `@vercel/blob`
// and global fetch are mocked — no network, no real Blob writes.

import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { STYLE_VERSION } from "@/constants/image";

import { dyn } from "./_dyn";

vi.mock("server-only", () => ({}));

const put = vi.fn();
vi.mock("@vercel/blob", () => ({ put: (...a: unknown[]) => put(...a) }));

const SRC = "https://cdn.piapi.ai/results/task_abc_123.jpg";
const BLOB = "https://abc123.public.blob.vercel-storage.com/x.jpg";

type StoreMod = {
  persistImage: (src: string, o: { kind: "portrait" | "scene" | "artifact"; subject: string }) => Promise<string>;
};
async function load(): Promise<StoreMod> {
  vi.resetModules();
  return (await dyn("@/lib/infrastructure/image-store")) as StoreMod;
}

beforeEach(() => {
  put.mockReset();
  put.mockResolvedValue({ url: BLOB });
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-blob-token");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(new Uint8Array([0xff, 0xd8, 0xff]), { status: 200 })),
  );
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe.skip("[T2] Vercel Blob image store", () => {
  test("happy path: downloads source, puts public jpeg, returns the Blob URL", async () => {
    const { persistImage } = await load();
    const url = await persistImage(SRC, { kind: "portrait", subject: "weary scout" });
    expect(url).toBe(BLOB);
    expect(fetch).toHaveBeenCalledWith(SRC);
    expect(put).toHaveBeenCalledTimes(1);
    const [, body, opts] = put.mock.calls[0];
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(opts).toMatchObject({ access: "public", contentType: "image/jpeg" });
  });

  test("key contains STYLE_VERSION and kind, ends in a 16-hex hash .jpg", async () => {
    const { persistImage } = await load();
    await persistImage(SRC, { kind: "scene", subject: "Korsun camp" });
    const key = put.mock.calls[0][0] as string;
    expect(key).toMatch(new RegExp(`^${STYLE_VERSION}/scene/[0-9a-f]{16}\\.jpg$`));
  });

  test("same {kind, subject} → same key; different subject → different key", async () => {
    const { persistImage } = await load();
    await persistImage(SRC, { kind: "portrait", subject: "monk" });
    await persistImage("https://other/x.jpg", { kind: "portrait", subject: "monk" });
    await persistImage(SRC, { kind: "portrait", subject: "doctor" });
    const [a, b, c] = put.mock.calls.map((c) => c[0]);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  test("missing token → returns source URL and put() is never called", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    const { persistImage } = await load();
    expect(await persistImage(SRC, { kind: "portrait", subject: "x" })).toBe(SRC);
    expect(put).not.toHaveBeenCalled();
  });

  test("put() throws → returns source URL (fail-open)", async () => {
    put.mockRejectedValue(new Error("blob down"));
    const { persistImage } = await load();
    expect(await persistImage(SRC, { kind: "portrait", subject: "x" })).toBe(SRC);
  });

  test("source download 404 → returns source URL, put() never called", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("gone", { status: 404 })));
    const { persistImage } = await load();
    expect(await persistImage(SRC, { kind: "portrait", subject: "x" })).toBe(SRC);
    expect(put).not.toHaveBeenCalled();
  });

  test("Blob host is accepted by safeOgImage and listed in next.config remotePatterns", async () => {
    const { safeOgImage } = await import("@/lib/og");
    expect(safeOgImage(BLOB)).toBe(BLOB);
    expect(safeOgImage("https://evil.example/x.jpg")).not.toBe("https://evil.example/x.jpg");
    const cfg = readFileSync("next.config.mjs", "utf-8");
    expect(cfg).toMatch(/public\.blob\.vercel-storage\.com/);
  });
});
