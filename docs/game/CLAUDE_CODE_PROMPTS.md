# Claude Code prompts — Chrono Agent (repo: nekontachik/history-quest; run in order; 1 and 2 can run in parallel after 0)

Before prompt 0: copy `GAME_SPEC.md` and `ART_DIRECTION.md` into the repo as `docs/game/GAME_SPEC.md` and `docs/game/ART_DIRECTION.md`.
Every prompt: follow CLAUDE.md (server-only rule, `rm -rf .next` after changes), run `npm test` before finishing, report with ✅/❌/⚠️.

---

## Prompt 0 — Switch image generation to PiAPI (fal as fallback)

```
Image generation moves from fal.ai to PiAPI (same model, Flux 1 Schnell, half the price). Keep fal.ai only as a fallback and for Kling video.

1. New server-only module lib/ai/providers/piapi.ts:
   - POST https://api.piapi.ai/api/v1/task with header x-api-key: PIAPI_KEY and body
     { model: "Qubico/flux1-schnell", task_type: "txt2img", input: { prompt, width, height } }.
   - Read data.task_id, then poll GET https://api.piapi.ai/api/v1/task/{task_id} (same header) every 2 s until
     data.status is "completed" or "success" (return data.output.image_url, or data.output.image_urls[0]) or "failed" (throw).
   - Overall timeout IMAGE_TIMEOUT_MS; raise IMAGE_TIMEOUT_MS to 60_000 in constants/index.ts.
   - Map 401/402/403 and "insufficient credit/balance" responses to the existing auth/billing error class so the API route reports it the same way as today.
2. lib/ai/image.ts: callFlux(prompt, width, height) tries PiAPI first; on any PiAPI error (including timeout) it logs and falls back to the existing fal.ai call (fal size: portrait_4_3 for 3:4, landscape_16_9 for 16:9). If PIAPI_KEY is unset, use fal directly.
3. constants/index.ts: IMAGE_PROVIDER = "piapi", PIAPI_MODEL = "Qubico/flux1-schnell". Env: PIAPI_KEY (add to .env.local.example, CLAUDE.md env table, and note it in docs/adr as ADR 006 "PiAPI over fal for images": same model, $0.0015 vs ~$0.003, verified on ~85 test images; fal kept as fallback).
4. Add the PiAPI image host(s) to OG_IMAGE_HOSTS and next.config.mjs images.remotePatterns (read the host from a real response in a test run; Blob persistence in prompt 2 makes this temporary).
5. Tests with fetch mocked: success after 2 polls, failed status -> fal fallback, timeout -> fal fallback, missing PIAPI_KEY -> fal, 402 -> billing error when fal also fails.

Do not change prompts, styles, routes or UI in this task.
```

---

## Prompt 1 — Style preset v1 and prompt builders

```
Read docs/game/ART_DIRECTION.md. Implement STYLE_VERSION "v1" in the image layer.

1. In constants/index.ts add: STYLE_VERSION = "v1"; STYLE_PORTRAIT, STYLE_SCENE, STYLE_ARTIFACT, STYLE_TAIL with the exact preset texts from ART_DIRECTION.md §2.
2. In lib/ai/image.ts:
   - Add type ImageKind = "portrait" | "scene" | "artifact" and a map ImageKind -> { preset, imageSize } with pixel sizes: portrait -> 768x1024, scene -> 1024x576, artifact -> 768x1024 (callFlux from prompt 0 takes width/height).
   - Add buildImagePrompt(kind, subject): returns `${preset} ${subject} ${STYLE_TAIL}`. Add a unit-tested guard: warn (console.warn) if the full prompt exceeds 90 words or 600 characters, and strip forbidden words from ART_DIRECTION §3 rule 8 out of the subject.
   - Rewrite buildFluxPrompt(event, scenario, year) to use STYLE_SCENE via buildImagePrompt. Describe the era in words (Ancient / Medieval / Early Modern / Industrial / Modern by year ranges from GAME_SPEC.md §3), never put the numeric year in the prompt (numbers leak into images as text).
   - Export generateImage(kind, subject) that reuses the existing retry/timeout/error-normalisation path.
3. Update tests/unit/buildFluxPrompt.test.ts to the new contract (era word present, no digits of the year, preset first, tail last) and add tests for buildImagePrompt for all three kinds.
4. Add lib/ai/image-qa.ts (server-only): checkImage(url, expected: { object: string; emotion: string }) calls the existing Gemini Flash model via OpenRouter with the image and a fixed prompt, returns { hasText, hasBorder, nonHumanFeatures, objectVisible, emotionMatches }. generateImage(kind, subject, expected?) re-rolls up to 3 times while any check fails (fail-open: if QA itself errors, accept the image). Unit tests with OpenRouter mocked.
5. Add scripts/style-check.ts: generates the 10-character regression set from ART_DIRECTION.md §7 as portraits via generateImage and writes the URLs to scripts/style-check/out.json. Do not run it in CI.

Do not change API routes, UI, caching or storage in this task.
```

---

## Prompt 2 — Persistent image storage (Vercel Blob)

```
Generated images currently stay on provider URLs (PiAPI / fal.media), which are not guaranteed to be permanent. Persist them in Vercel Blob.

1. Add @vercel/blob. New server-only module lib/infrastructure/image-store.ts with persistImage(sourceUrl, key): downloads the image and uploads it with put() to Blob (access: "public"), returns the Blob URL. Env: BLOB_READ_WRITE_TOKEN (add to .env.local.example and CLAUDE.md env section).
2. Key format: `${STYLE_VERSION}/${kind}/${stableHash}.jpg` (STYLE_VERSION from constants). The hash is computed from kind + subject.
3. Fail-open: if the token is missing or upload fails, log and return the original provider URL (same philosophy as ADR 002).
4. Call persistImage at the end of generateImage and generateScenarioImage in lib/ai/image.ts.
5. Add the Blob public host to OG_IMAGE_HOSTS in lib/og.ts and to next.config.mjs images.remotePatterns.
6. Unit tests with the Blob client mocked: success path, missing token fallback, upload error fallback, key contains STYLE_VERSION.

Do not touch prompts, routes or UI in this task.
```

---

## Prompt 3 — Character pool seeding (depends on 1 and 2)

```
Read docs/game/GAME_SPEC.md §6 and docs/game/ART_DIRECTION.md §3. Build a pre-generated character portrait pool.

1. constants/game.ts: ERAS (ancient, medieval, earlyModern, industrial, modern with year ranges) and ROLES (hetman/ruler, soldier, monk/priest, merchant, noblewoman, scribe, peasant, spy, doctor, rebel). For every era × role write a visual subject description that follows ART_DIRECTION §3: appearance only, no colours, no years, culture shown visually, hands holding nothing (the anachronism is added per card later), a neutral-intense expression.
2. scripts/seed-pool.ts: for each era × role generate N=3 portraits via generateImage("portrait", subject) (persisted to Blob by prompt 2), store in Redis hash `pool:${STYLE_VERSION}:${era}:${role}` as a JSON array of URLs. Idempotent: skip slots that already have N images. Concurrency 4.
3. lib/game/pool.ts (server-only): getPortrait(era, role) returns a random URL from the pool, or null if empty (caller falls back to live generation).
4. Unit tests for getPortrait with Redis mocked.

No UI in this task.
```

---

## Prompt 4 — Deck generation API

```
Read docs/game/GAME_SPEC.md §2–§5. Implement deck generation for one run.

1. types/game.ts: Meter, CardOption, Card, Deck, Mission exactly as in GAME_SPEC §4 (+ Mission { text, bonusGoalId }).
2. lib/game/deck.ts (server-only): generateDeck(year, locale) ->
   - fetch real events for the year via the existing historical-events logic (reuse the lib function, not HTTP);
   - one OpenRouter call (the model already used for scenarios in lib/ai/text.ts) with a system prompt that encodes GAME_SPEC §5 dilemma rules verbatim, the 1648 examples as few-shot, the list of real events, the allowed roleIds for the era, and asks for a JSON deck of exactly 12 cards in the user's locale;
   - validate with zod (effects 1–3 meters, integers in [-25, 25]; conflictType rotation ≤3 of the same type; ≥4 cards with realEventRef; roleId in the allowed list). On validation failure retry once, then return a 502-style error.
   - pick a Mission and a bonus goal from a fixed template list in constants/game.ts.
3. POST /api/game/deck { year?, locale } -> { year, era, mission, cards } (random year when omitted). Cache by year+locale+STYLE_VERSION in Redis for 1 hour (fail-open).
4. Tests: zod schema unit tests (valid deck, wrong effect range, wrong roleId, too many same conflictType), API contract test with the LLM mocked.

No UI in this task.
```

---

## Prompt 5 — Game screen (main page)

```
Read docs/game/GAME_SPEC.md §1–§2 and docs/game/ART_DIRECTION.md §5. Make the game the main screen.

1. app/page.tsx renders a new client component components/features/ChronoAgent (keep the existing scenario flow reachable at its current routes).
2. Flow: StarField year drop (random by default; the existing year slider lets the user pick a year instead) -> POST /api/game/deck -> mission card -> 12 swipeable cards.
3. Card: portrait from the pool (getPortrait via a small API route; if null call generateImage("portrait") with the role subject + the card's anachronistic object), speakerName, line, left/right action labels. Swipe with pointer + keyboard arrows + two buttons (accessibility).
4. Four meters at the top (Stability, People, Power, Faith; start 50, clamp 0–100). While dragging, highlight the meters the hovered option will change (direction only, no numbers). After a swipe show the option's consequence sentence for ~1.5 s.
5. Card frame colour follows world state per ART_DIRECTION §5 (cyan / amber / red by the lowest distance of any meter to 0 or 100).
6. Run state in a reducer (pure, unit-tested): apply effects, detect collapse (≤0 or ≥100) or survival after 12 cards, record the decision log.
7. All UI strings via next-intl (uk + en). Mobile-first, works at 360 px width.
8. Tests: reducer unit tests; Playwright happy path with the deck API mocked (play 12 cards, reach an ending screen placeholder).

The ending screen is a placeholder in this task (prompt 6 builds it).
```

---

## Prompt 6 — Endings, artifact, decision tree, Atlas

```
Read docs/game/GAME_SPEC.md §2 (steps 6–9), §3, §7, §9.

1. constants/game.ts: the fixed ENDINGS list (8 collapse + 5 survival incl. "Quiet Line") with ids; names/descriptions in messages/uk.json and en.json. Pure function resolveEnding(finalMeters, collapsedMeter?) with unit tests for every ending.
2. Artifact: POST /api/game/artifact { year, era, endingId, decisionLog, locale } -> reuse the scenario engine in lib/ai/text.ts to write a short world summary + a generated title; cover via generateImage("artifact", ...). Collapse endings are flagged rare. Store the artifact in Redis under an anonymous player id (httpOnly cookie, created by middleware if missing); mirror to localStorage.
3. Ending screen: artifact cover, title, summary, rarity badge, share via the existing ShareCard.
4. Decision tree: show the 12 decisions; for each, the unchosen option is shown locked with "?" and a hint naming the meter it would have pushed most.
5. Atlas page /atlas: grid of ENDINGS × 5 eras (65 slots); found = cover thumbnail, unfound = dark silhouette with "?". Read from Redis by player id.
6. Respect GAME_SPEC §9: no streaks, no decaying resources.
7. Tests: resolveEnding units, artifact API contract (LLM + image mocked), Playwright: finish a run -> artifact appears in /atlas.
```
