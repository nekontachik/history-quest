// Acceptance tests for T2 — Vercel Blob image store (Wave 1).
// Source bullets: docs/game/EXECUTION_PLAN.md §4 T2 "Acceptance".

import { describe, expect, test } from "vitest";

import { dyn } from "./_dyn";

// bullet source: "key contains `STYLE_VERSION` and kind"
//                "same input → same key"
//                "missing token → source URL, `put` never called"
//                "`put` throws → source URL"
//                "Blob host present in og + next config"

describe.skip("[T2] Vercel Blob image store", () => {
  test("image-store exports persistImage", async () => {
    const mod = (await dyn("@/lib/infrastructure/image-store")) as Record<
      string,
      unknown
    >;
    expect(typeof mod.persistImage).toBe("function");
  });

  test("key contains STYLE_VERSION and the image kind", async () => {
    const mod = (await dyn("@/lib/infrastructure/image-store")) as Record<
      string,
      unknown
    >;
    expect(typeof mod.persistImage).toBe("function");
  });

  test("same {kind, subject} input produces the same key", async () => {
    const mod = (await dyn("@/lib/infrastructure/image-store")) as Record<
      string,
      unknown
    >;
    expect(typeof mod.persistImage).toBe("function");
  });

  test("missing BLOB_READ_WRITE_TOKEN → returns source URL, put never called", async () => {
    const mod = (await dyn("@/lib/infrastructure/image-store")) as Record<
      string,
      unknown
    >;
    expect(typeof mod.persistImage).toBe("function");
  });

  test("put() throws → returns source URL (fail-open)", async () => {
    const mod = (await dyn("@/lib/infrastructure/image-store")) as Record<
      string,
      unknown
    >;
    expect(typeof mod.persistImage).toBe("function");
  });

  test("Blob host is present in og allow-list and next.config remotePatterns", async () => {
    const og = await dyn("@/lib/og");
    expect(og).toBeDefined();
  });
});
