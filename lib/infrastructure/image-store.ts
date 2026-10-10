import "server-only";

import { createHash } from "node:crypto";

import { put } from "@vercel/blob";

import { STYLE_VERSION } from "@/constants/image";
import type { ImageKind } from "@/types/game";

/**
 * Persist a generated image to Vercel Blob and return its permanent URL.
 *
 * Fail-open: if the Blob token is missing, the source cannot be downloaded,
 * or `put()` throws, we log once with the existing `[image-store]` tag and
 * return `sourceUrl` so the caller can still render the ephemeral provider
 * URL. T2 only owns persistence — I1 wires `persistImage` into the image
 * pipeline.
 *
 * Key layout: `${STYLE_VERSION}/${kind}/${sha256(kind+subject).slice(0,16)}.jpg`
 * The hash is deterministic (same {kind, subject} → same key), so repeated
 * generations for the same subject overwrite the blob instead of filling
 * the store with duplicates. Bumping `STYLE_VERSION` (constants/image.ts)
 * invalidates every stored key — intentional, so a style change forces a
 * fresh render.
 */

/** Node's crypto digest; `subtle` is unnecessary and would force async. */
function keyFor(kind: ImageKind, subject: string): string {
  const hash = createHash("sha256")
    .update(kind + subject)
    .digest("hex")
    .slice(0, 16);
  return `${STYLE_VERSION}/${kind}/${hash}.jpg`;
}

let warnedMissingToken = false;

export async function persistImage(
  sourceUrl: string,
  opts: { kind: ImageKind; subject: string }
): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    if (!warnedMissingToken) {
      console.warn(
        "[image-store] BLOB_READ_WRITE_TOKEN missing — returning source URL (fail-open)"
      );
      warnedMissingToken = true;
    }
    return sourceUrl;
  }

  // Download the generated image. Provider URLs (PiAPI, fal) are usually
  // short-lived, so a transient network failure is expected and non-fatal.
  let buffer: Buffer;
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) {
      console.warn(
        `[image-store] download failed (${res.status}) — returning source URL: ${sourceUrl}`
      );
      return sourceUrl;
    }
    const arrayBuffer = await res.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[image-store] download threw — returning source URL: ${msg}`
    );
    return sourceUrl;
  }

  const key = keyFor(opts.kind, opts.subject);

  try {
    const result = await put(key, buffer, {
      access: "public",
      token,
      contentType: "image/jpeg",
    });
    return result.url;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[image-store] put() failed — returning source URL: ${msg}`
    );
    return sourceUrl;
  }
}
