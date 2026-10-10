# Time Machine — AI Alternative History PWA

## Stack
- **Framework**: Next.js 14.2 (App Router), TypeScript strict, Tailwind CSS
- **3D**: Three.js (StarField component, lazy-loaded)
- **AI Text**: OpenRouter API (`OPENROUTER_API_KEY`) — Gemini 2.0 Flash (events) + Claude Sonnet (scenarios)
- **AI Images**: fal.ai → Flux 1 Schnell (`lib/ai/image.ts`, `buildFluxPrompt`)
- **AI Video**: fal.ai → Kling 2.0 Master (`lib/video-providers/kling.ts`)
- **Cache / Rate limit**: ioredis (`lib/infrastructure/redis-client.ts`)
- **i18n**: next-intl v3.26.3 — `messages/uk.json` + `messages/en.json`; config in `i18n.ts`
- **Testing**: Vitest (unit/API) + Playwright (E2E)
- **CI**: GitHub Actions

## API Routes
| Route | Method | Purpose |
|---|---|---|
| `/api/historical-events` | GET | Top-3 events for year; Redis cache-first → OpenRouter |
| `/api/scenario` | POST | Streaming alternative history (ReadableStream) |
| `/api/image` | POST | Flux 1 Schnell image via fal.ai |
| `/api/test-flux` | POST | Dev-only endpoint (blocked in production) |
| `/api/video/create` | POST | Start Kling video task via fal.ai queue |
| `/api/video/status` | GET | Poll fal.ai queue for video task status |

## Key Components
`YearSection/index.tsx` · `ScenarioStream/ScenarioStream.tsx` · `EventCard/EventCard.tsx`
`StarField/index.tsx` · `LanguageToggle/index.tsx` · `PremiumModal/PremiumModal.tsx`
`ShareCard/ShareCard.tsx` · `InstallPrompt/index.tsx` · `ServiceWorkerRegister/index.tsx`

## Server/Client Boundary Rules

1. Every file in lib/ that uses Node.js APIs (ioredis, fal-ai, openai)
   MUST have `import "server-only"` as the first line
2. Files: lib/ai/image.ts, lib/ai/text.ts, lib/infrastructure/redis-client.ts,
   lib/infrastructure/rate-limit.ts, lib/infrastructure/cache.ts,
   lib/premium.ts, lib/video-providers/kling.ts — all MUST start with `import "server-only"`
3. Components with "use client" must NEVER import from lib/ directly —
   they communicate with server code only through API routes (fetch)
4. After ANY file change, run `rm -rf .next` before testing

## Key Lib Files
- `lib/ai/text.ts` — OpenRouter text generation (Gemini for events, Claude for scenarios)
- `lib/ai/image.ts` — fal.ai Flux image wrapper, exports `buildFluxPrompt`, `generateScenarioImage`
- `lib/ai/search.ts` — Tavily web search for event context enrichment
- `lib/ai/video-prompt.ts` — builds video motion prompt for Kling
- `lib/infrastructure/redis-client.ts` — ioredis client for event caching (24h TTL)
- `lib/infrastructure/rate-limit.ts` — Redis key `ratelimit:{ip}:{YYYY-MM-DD}`, TTL 24h; limit = `RATE_LIMIT_FREE` env (default 3)
- `lib/infrastructure/cache.ts` — event cache wrapper
- `lib/premium.ts` — shared premium check (Redis `premium:{ip}` keys)
- `lib/video-providers/kling.ts` — fal.ai queue API; `USE_MOCK = !FAL_KEY`; mock simulates 3-poll completion

## Environment Variables
```
OPENROUTER_API_KEY=      # required — text generation (events + scenarios)
PIAPI_KEY=               # optional — primary image provider (Flux Schnell via PiAPI); unset → fal direct
FAL_KEY=                 # required — image fallback + video generation via fal.ai
REDIS_URL=               # optional — cache + rate limiting (fail-open without)
RATE_LIMIT_FREE=         # optional — free req/day limit (default 3)
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SENTRY_DSN=  # optional — error monitoring
SENTRY_AUTH_TOKEN=       # optional — source map upload (CI/Vercel only)
```

## Mock / Dev Flags
- `USE_MOCK` in `kling.ts`: `true` when `FAL_KEY` missing
- `SKIP_PREMIUM` in `premium.ts`: `true` when `NODE_ENV === 'development'`
- `/api/test-flux`: returns 404 in production

## Testing
```bash
npm test              # Vitest unit + API tests
npm run test:e2e      # Playwright E2E tests
npm run test:coverage # Vitest with coverage
```

## Conventions
- Server Components by default; `"use client"` only for Three.js, hooks, streaming
- All AI calls through `lib/` wrappers — never inline in components or routes
- All AI generation (text, image, video) through unified providers: OpenRouter + fal.ai
- Redis unavailable → rate limit silently bypassed (fail-open)
