import "server-only";

/**
 * Helpers for building Open Graph / Twitter card metadata from query-string
 * input. Extracted from app/scenario/page.tsx so they can be unit-tested.
 */

/** Default card image shipped in /public. */
export const OG_DEFAULT_IMAGE = "/og-default.jpg";

/** Hosts we are willing to advertise in an OG/Twitter card. Must stay in sync
 *  with images.remotePatterns in next.config.mjs. */
const OG_IMAGE_HOSTS = [
  "fal.media",
  "storage.googleapis.com",
  "public.blob.vercel-storage.com",
];

/**
 * `imageUrl` arrives from the query string, so without a check anyone can send
 * `/scenario?imageUrl=https://attacker/x.png&eventTitle=<anything>` and get a
 * Twitter/Slack/Discord link preview with attacker-chosen imagery and headline,
 * branded with our domain. Classic link-preview phishing. Anything not on the
 * allowlist silently degrades to the default card image.
 */
export function safeOgImage(raw: string | undefined | null): string {
  if (!raw) return OG_DEFAULT_IMAGE;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return OG_DEFAULT_IMAGE;
  }

  if (url.protocol !== "https:") return OG_DEFAULT_IMAGE;

  const host = url.hostname.toLowerCase();
  const allowed = OG_IMAGE_HOSTS.some(
    (h) => host === h || host.endsWith(`.${h}`)
  );

  return allowed ? url.toString() : OG_DEFAULT_IMAGE;
}

/** Cap and flatten a query-string value before it becomes the page <title>. */
export function safeTitleFragment(
  raw: string | undefined | null
): string | null {
  if (!raw) return null;
  const clean = raw.replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, 120) : null;
}
