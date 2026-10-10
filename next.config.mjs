import withSerwist from "@serwist/next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Resolve NEXT_PUBLIC_APP_URL automatically on Vercel if not set explicitly.
  // VERCEL_URL is a built-in system env var (no https:// prefix).
  env: {
    NEXT_PUBLIC_APP_URL:
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000"),
  },

  // Exclude heavy server-only packages from webpack bundling.
  // Next.js uses Node.js native require() for these instead, which avoids
  // webpack trying to parse complex/broken ESM exports (e.g. robot3 inside
  // @fal-ai/client) and prevents the "Cannot read properties of undefined
  // (reading 'call')" factory error in options.factory.
  experimental: {
    serverComponentsExternalPackages: [
      "@fal-ai/client",
      "ioredis",
      "openai",
    ],
  },
  images: {
    remotePatterns: [
      // fal.ai — Flux image generation
      { protocol: "https", hostname: "fal.media" },
      { protocol: "https", hostname: "*.fal.media" },
      { protocol: "https", hostname: "storage.googleapis.com" },
      // Vercel Blob — persisted generated images (T2).
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      // Tavily — thumbnail images from web search results.
      // Limited to known Tavily-CDN + Wikipedia hosts to prevent SSRF via
      // /_next/image?url=<arbitrary-https>. If a new Tavily-CDN host appears
      // in production logs, add it explicitly here — never use a wildcard.
      { protocol: "https", hostname: "*.tavilyusercontent.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
    ],
  },
};

const withPWA = withSerwist({
  // Source lives in app/ so it type-checks against the project tsconfig;
  // the compiled worker is emitted to public/sw.js and must stay gitignored.
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Service workers interfere with webpack HMR in development: the SW caches
  // /_next/static chunks, so a rebuilt module arrives stale and Next falls
  // back to a full reload, wiping any in-progress AI generation.
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: true,
});

export default withPWA(nextConfig);
