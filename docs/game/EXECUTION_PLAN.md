# History Quest — Execution Plan (Chrono Agent, phase 1)

This plan supersedes `CLAUDE_CODE_PROMPTS.md`. Product rules live in `GAME_SPEC.md`; image rules in `ART_DIRECTION.md`.
Every task below is one agent, one git worktree, one branch, one PR into `main`.

---

## 0. How this plan prevents slop

1. **Contracts first, frozen.** Wave 0 writes all shared types, zod schemas, constants and fixtures. Later tasks code *against* them and may not change them.
2. **Tests first.** Wave 0 also writes the acceptance tests of every later task, tagged `[T1]`…`[T8]` and wrapped in `describe.skip`. A task is done when it flips **only its own** `describe.skip` → `describe` and those tests pass **without editing assertions**. `npm run guard:tests` enforces this.
3. **Exclusive file ownership.** Each task owns a list of paths (`docs/game/scopes/<ID>.txt`). `npm run guard:scope -- <ID>` fails the PR if the branch touched anything else.
4. **No invented APIs.** Every external call (PiAPI, fal, OpenRouter, Vercel Blob) is coded against a recorded fixture in `tests/fixtures/game/` or the official doc linked in the task. If a field is not in a fixture or doc, the agent stops and reports — it does not guess.
5. **LLM output is untrusted input.** Every LLM response goes through a zod schema + semantic validators; invalid → one retry → typed error. Never `JSON.parse` without validation, never render unvalidated text.
6. **Human gates where taste matters.** Gate A (images) and Gate B (playtest) are decided by the owner, not by an agent.

---

## 1. Global rules for every agent (also in CLAUDE.md)

**Must**
- Work only in your worktree/branch; open a PR to `main`; never push to `main`.
- Read: `CLAUDE.md`, `docs/game/GAME_SPEC.md`, `docs/game/ART_DIRECTION.md`, your task card below.
- Before finishing run, all green: `npm run lint && npx tsc --noEmit && npm test && npm run check:server-only && npm run guard:scope -- <ID> && npm run guard:tests -- <ID>`.
- Report in the PR body with ✅/❌/⚠️ per acceptance criterion — facts only.

**Must not**
- Change frozen contracts (`types/game.ts`, `shared/game/schemas.ts`, `constants/game.ts`, `constants/image.ts`, `tests/fixtures/game/**`, any `tests/game/**` assertion). Need a change → stop and report.
- Add dependencies other than those named in your card.
- Leave `TODO`, `FIXME`, placeholder text, commented-out code, or `console.log` (use the existing `[tag]` console.warn/error pattern for real errors only).
- Import mocks/fixtures from production code.
- Put user-facing strings outside `messages/{uk,en}.json`.
- Call real paid APIs in tests. Real calls only in scripts the owner runs.
- "Improve" things outside the card (refactors, renames, formatting of untouched files).

---

## 2. Dependency graph and waves

```
Wave 0 (1 agent, sequential)      G0  contracts + guards + skipped acceptance tests
                                   │
Wave 1 (5 agents, parallel)        ├─ T1 PiAPI provider (+fal fallback)
                                   ├─ T2 Vercel Blob image store
                                   ├─ T3 Deck generation API
                                   ├─ T4 Run engine (reducer + endings, pure)
                                   └─ T5 Image prompt builders + QA checklist module
                                   │
Wave 2 (3 agents, parallel)        ├─ I1 Image pipeline integration   (needs T1 T2 T5) ──► HUMAN GATE A
                                   ├─ T6 Game screen                  (needs T3 T4)
                                   └─ T7 Character pool data + seed script (needs T5; seed RUN waits for Gate A)
                                   │
Wave 3 (2 agents, parallel)        ├─ T8 Endings, artifact, decision tree, Atlas (needs T6 I1)
                                   └─ E1 Deck quality eval (needs T3)
                                   │
Wave 4 (owner + 1 agent)           S1 pool seeding run (paid) ─► HUMAN GATE B playtest ─► deploy
```

Merge order inside a wave does not matter (no shared files). Rebase on `main` before opening the PR.

---

## 3. Worktrees

```bash
# from the main clone, once per wave (creates ../hq-<ID> on branch game/<ID>)
bash scripts/worktrees.sh T1 T2 T3 T4 T5
# in each worktree
cd ../hq-T3 && npm ci && claude      # paste the task card
# dev server per worktree, distinct ports:  PORT=3003 npm run dev
# after merge
git worktree remove ../hq-T3 && git branch -d game/T3
```
Each worktree has its own `node_modules` and `.next` (CLAUDE.md: `rm -rf .next` after changes still applies). Tests mock Redis, so worktrees never share state.

---

## 4. Task cards

Card format: **Goal · Depends · Owns (exclusive) · Inputs · Build · Acceptance · Must not**.

### G0 — Contracts, guards, acceptance tests (Wave 0)
- **Goal:** freeze every interface the parallel tasks share and write their acceptance tests (skipped).
- **Depends:** nothing. **Owns:** see `scopes/G0.txt`.
- **Build:**
  1. `types/game.ts` — `Meter`, `CardOption`, `Card`, `Deck`, `Mission`, `EndingId`, `Ending`, `RunState`, `DecisionLogEntry`, `Artifact`, `ImageKind` exactly per GAME_SPEC §3–4.
  2. `shared/game/schemas.ts` (pure, client-safe, no `server-only`): zod `CardSchema`, `DeckSchema` (exactly 12 cards; effects 1–3 meters, integers in [-25, 25]; ≤3 cards per conflictType; ≥4 cards with `realEventRef`; roleId ∈ allowed list passed in), `ArtifactSchema`. Export `validateDeck(raw, allowedRoleIds)` → `{ ok: true, deck } | { ok: false, errors: string[] }`.
  3. `constants/game.ts`: `METERS`, `METER_START=50`, `DECK_SIZE=12`, `ERAS` (ids + year ranges, GAME_SPEC §3), `ROLES` (10 ids), `ENDINGS` (13 ids), `MISSION_TEMPLATES`, `BONUS_GOALS`. `constants/image.ts`: `STYLE_VERSION="v1"`, `STYLE_PORTRAIT/SCENE/ARTIFACT`, `STYLE_TAIL` verbatim from ART_DIRECTION §2, `IMAGE_SIZES` (768×1024, 1024×576), `PROMPT_MAX_CHARS=600`, `FORBIDDEN_PROMPT_WORDS`.
  4. Fixtures `tests/fixtures/game/`: `deck.valid.json` (12 cards, uses the three 1648 examples from GAME_SPEC §5), one invalid deck per schema rule, `llm.deck.fenced.txt` (JSON in ```json fences), `llm.deck.truncated.txt`; PiAPI `piapi.task-created.json`, `piapi.task-pending.json`, `piapi.task-success.json`, `piapi.task-failed.json`, `piapi.402.json` (shapes: `data.task_id`, `data.status`, `data.output.image_url` — recorded from real runs, see `art/providers/piapi.py`).
  5. Acceptance tests in `tests/game/<ID>.test.ts` for T1–T8 (bullets under each card), all inside `describe.skip("[<ID>] …")`. They import modules that do not exist yet via the exact paths named in each card — the file must still type-check, so put the import inside the test body with `await import(...)`.
  6. Guards: `scripts/guards/check-scope.sh <ID>` (fails if the branch changed files outside `docs/game/scopes/<ID>.txt`) and `scripts/guards/check-tests.sh <ID>` (fails if `tests/game/**` or `tests/fixtures/game/**` changed beyond flipping `describe.skip("[<ID>]` → `describe("[<ID>]`); npm scripts `guard:scope`, `guard:tests`; one scope file per task in `docs/game/scopes/`; `scripts/worktrees.sh <IDs…>` creates `../hq-<ID>` on branch `game/<ID>`; vitest include `tests/game/**`; CI job running both guards.
  7. Unit tests for `schemas.ts` (not skipped): valid fixture passes; each invalid fixture fails with a named error.
- **Acceptance:** all repo checks green; `tests/game/*.test.ts` exist for T1–T8 and are skipped; schema tests pass; CI runs guards.
- **Must not:** implement any feature logic beyond schemas/constants; change existing behaviour of the app.

### T1 — PiAPI provider with fal fallback (Wave 1)
- **Goal:** image generation goes PiAPI first, fal on any failure.
- **Owns:** `lib/ai/providers/**`, `docs/adr/006-piapi-over-fal.md`, the `callFlux` function inside `lib/ai/image.ts` (nothing else in that file), `.env.local.example`, CLAUDE.md env table.
- **Inputs:** PiAPI docs https://piapi.ai/docs/flux-api/text-to-image and /get-task; fixtures `piapi.*.json`.
- **Build:** `lib/ai/providers/piapi.ts` (create task → poll every 2 s → `image_url`), timeout `IMAGE_TIMEOUT_MS` (60 000), 401/402/403/"insufficient" → existing auth/billing error class; `callFlux(prompt, width, height)` tries PiAPI then fal (fal sizes `portrait_4_3`/`landscape_16_9`); no `PIAPI_KEY` → fal directly.
- **Acceptance (`[T1]`):** success after 2 polls; `failed` → fal called once; timeout → fal; missing key → PiAPI never called; 402 + fal failure → billing error; request body equals fixture shape exactly (`model`, `task_type`, `input.width/height`).
- **Must not:** touch prompts, styles, routes, UI, storage; add deps.

### T2 — Vercel Blob image store (Wave 1)
- **Goal:** generated images get permanent URLs.
- **Owns:** `lib/infrastructure/image-store.ts`, `lib/og.ts` (host list only), `next.config.mjs` (remotePatterns only), `package.json` (+`@vercel/blob` only).
- **Build:** `persistImage(sourceUrl, { kind, subject })` → download, `put()` public to key `${STYLE_VERSION}/${kind}/${sha256(kind+subject).slice(0,16)}.jpg`, return Blob URL; no `BLOB_READ_WRITE_TOKEN` or any error → log + return `sourceUrl`.
- **Acceptance (`[T2]`):** key contains `STYLE_VERSION` and kind; same input → same key; missing token → source URL, `put` never called; `put` throws → source URL; Blob host present in og + next config.
- **Must not:** call `persistImage` from anywhere (I1 wires it); touch providers or prompts.

### T3 — Deck generation API (Wave 1)
- **Goal:** `POST /api/game/deck` returns a validated 12-card deck for a year.
- **Owns:** `lib/game/deck.ts`, `lib/game/deck-prompt.ts`, `app/api/game/deck/**`.
- **Inputs:** GAME_SPEC §2–5 (dilemma rules verbatim in the system prompt; 1648 examples as few-shot); existing `lib/ai/text.ts` client and historical-events lib function (import, don't HTTP).
- **Build:** one OpenRouter call (scenario model) → strip code fences → `validateDeck` → on failure one retry with the errors appended → else 502 `{ error: "deck_invalid" }`. Random year when omitted; era from `ERAS`; mission + bonus goal from constants; Redis cache key `deck:${STYLE_VERSION}:${year}:${locale}` 1 h, fail-open.
- **Acceptance (`[T3]`):** valid fixture → 200 with 12 cards; fenced fixture → parsed; truncated → retry then 502; invalid roleId → retry; system prompt contains every rule from GAME_SPEC §5 (string checks); real events passed into prompt; cache hit skips LLM.
- **Must not:** generate images; touch UI; loosen the schema.

### T4 — Run engine, pure (Wave 1)
- **Goal:** all game rules as pure, deterministic functions.
- **Owns:** `shared/game/run.ts`, `shared/game/endings.ts`.
- **Build:** `initRun(deck)`, `applyChoice(state, side)` (clamp 0–100, append decision log, detect collapse at ≤0/≥100, survival after card 12), `previewEffects(card, side)` → meters + direction only, `resolveEnding(state)` per GAME_SPEC §3 (8 collapse + 5 survival incl. "Quiet Line" all 40–60), `worldTone(state)` → `"stable"|"tension"|"collapse"` for the frame colour (ART_DIRECTION §5).
- **Acceptance (`[T4]`):** table tests for every ending id; clamp; no mutation of input state; 12th card ends run; collapse mid-deck stops further choices; preview never exposes numbers.
- **Must not:** import React, fetch, or anything server-side.

### T5 — Image prompt builders + QA checklist (Wave 1)
- **Goal:** the only way prompts are built, and the vision QA check.
- **Owns:** `shared/game/image-prompts.ts`, `lib/ai/image-qa.ts`.
- **Build:** `buildImagePrompt(kind, subject)` = preset + subject + tail; strips `FORBIDDEN_PROMPT_WORDS` from subject; throws if > `PROMPT_MAX_CHARS`; `eraWords(year)` (no digits). `checkImage(url, { object, emotion })` → Gemini Flash via existing OpenRouter client, fixed JSON checklist `{hasText, hasBorder, nonHumanFeatures, objectVisible, emotionMatches}` validated by zod; on QA error return `{ skipped: true }` (fail-open).
- **Acceptance (`[T5]`):** preset first, tail last; forbidden words removed; >600 chars throws; `eraWords(-753)` contains no digits; all 10 regression subjects from `art/prompts/regression.json` build under the limit; QA parses fixture JSON and rejects malformed.
- **Must not:** call image providers; touch `lib/ai/image.ts`.

### I1 — Image pipeline integration (Wave 2) → HUMAN GATE A
- **Owns:** `lib/ai/image.ts` (except `callFlux`), `app/api/image/**`, `scripts/style-check.ts`.
- **Build:** `generateImage(kind, subject, expected?)` = `buildImagePrompt` → `callFlux` → `checkImage` (re-roll ≤3 while any check fails) → `persistImage`. `buildFluxPrompt` for scenarios rewritten onto `STYLE_SCENE` + `eraWords`. `scripts/style-check.ts` generates the 10-character regression set through `generateImage` and writes `scripts/style-check/out.json` + an HTML contact sheet.
- **Acceptance (`[I1]`):** call order verified with mocks; re-roll stops at 3; QA skipped → image accepted; scenario prompt contains no digits.
- **Gate A (owner):** run `npx tsx scripts/style-check.ts` (≈10–30 images, <$0.05); pass = ≥8/10 clean before re-rolls, 10/10 after (ART_DIRECTION §7). Fail → stop, adjust presets in a new G-task, rerun.

### T6 — Game screen (Wave 2)
- **Owns:** `components/features/ChronoAgent/**`, `app/page.tsx`, `app/api/game/portrait/**`, `messages/{uk,en}.json` (`game.play.*` keys only), `tests/e2e/game-play.spec.ts`.
- **Build:** per GAME_SPEC §2 steps 1–5: StarField year drop (random default, existing slider to pick), mission card, swipe card (pointer + arrow keys + two buttons), four meters with direction-only preview while dragging, consequence line ~1.5 s, frame colour from `worldTone`, ending placeholder. Portraits via `/api/game/portrait` (pool or placeholder until T7/S1). Mobile-first 360 px. Card feel: tilt toward pointer, overshoot snap (ref2game genres §8).
- **Acceptance (`[T6]`):** Playwright with deck API mocked plays 12 cards to the placeholder ending at 360 px and desktop; keyboard-only run works; no hard-coded UI strings (grep); existing scenario routes still reachable (existing e2e green).
- **Must not:** contain game rules (only call `shared/game/run.ts`); generate images directly.

### T7 — Character pool data + seed script (Wave 2; run after Gate A)
- **Owns:** `shared/game/pool-subjects.ts`, `lib/game/pool.ts`, `scripts/seed-pool.ts`.
- **Build:** subject text for every era × role following ART_DIRECTION §3 (emotion-neutral-intense, no colours/years, culture visual, hands free); `seed-pool.ts` — N=3 per slot through `generateImage`, idempotent (Redis `pool:${STYLE_VERSION}:${era}:${role}`), concurrency 4, `--dry-run` prints count and cost (`count × $0.0015`); `getPortrait(era, role)`.
- **Acceptance (`[T7]`):** 5×10 subjects exist and each passes `buildImagePrompt` limits and forbidden-word check; dry-run prints 150 jobs / $0.23; idempotency with Redis mocked.
- **Must not:** run the real seed (owner does S1).

### T8 — Endings, artifact, decision tree, Atlas (Wave 3)
- **Owns:** `app/api/game/artifact/**`, `components/features/ChronoAgent/Ending/**`, `app/atlas/**`, `middleware.ts` (anon id cookie only), `messages/{uk,en}.json` (`game.end.*`, `atlas.*` keys only), `tests/e2e/game-ending.spec.ts`.
- **Build:** per GAME_SPEC §2 steps 6–9, §7: artifact text via scenario engine, cover via `generateImage("artifact")`, rare flag on collapse; anon httpOnly cookie; Atlas 13×5 grid from Redis; decision tree with locked "?" branches naming the meter the other option pushes most.
- **Acceptance (`[T8]`):** artifact API contract with LLM+image mocked; every ending id has uk+en strings; Playwright: finish run → artifact → visible in `/atlas`; no streaks/decay (GAME_SPEC §9 grep for "streak").
- **Must not:** change run rules (T4) or deck API (T3).

### E1 — Deck quality eval (Wave 3)
- **Owns:** `scripts/eval/game/**`.
- **Build:** reuse the existing eval harness (`scripts/eval`, judge via OpenRouter) to generate 20 decks for 10 years and score each card on: both options cost something, effects match text, no gore/living people, anachronism drives the dilemma; output a ✅/❌ table + failing examples.
- **Acceptance:** `--dry-run` works offline; report format matches existing eval outputs. Owner runs it live before Gate B.

### S1 + Gate B (Wave 4, owner)
1. `npx tsx scripts/seed-pool.ts --dry-run` → confirm cost → run for real (≈150–190 images, ≈$0.30).
2. Vercel env: `OPENROUTER_API_KEY`, `PIAPI_KEY`, `FAL_KEY`, `REDIS_URL` (separate DB), Blob store connected (Public), `NEXT_PUBLIC_APP_URL`, `RATE_LIMIT_FREE=1000`.
3. **Gate B playtest:** 5 full runs on a phone. Pass = no broken images, every card readable, at least one hard choice per run, endings + Atlas work. Findings → new narrow tasks, not edits to this plan.
