# Chronicle prototype — task cards

One branch, `rebuild/chronicle`, one PR into `main`. Rules for everyone: follow `CLAUDE.md`; read `docs/game/CHRONICLE_RULES.md` and `types/game.ts` first; touch only the paths you own; do not change `types/game.ts`, `constants/game.ts` or `CHRONICLE_RULES.md` (if one looks wrong, stop and report); no new dependencies; no `TODO`, placeholder text or `console.log`; no real network calls in tests; do not run git commands that change history or the index (the lead commits). Before finishing run `npx tsc --noEmit` and `npm test`. Report facts only, with ✅/❌/⚠️ per acceptance bullet.

Repo facts that differ from older docs: there is no next-intl and no `messages/` folder (the app is English-only); `"use client"` components must not import from `lib/`, so client-safe game code lives in `shared/game/`; `checkBucketLimit(ip, bucket)` has no fail-closed option here and buckets are `scenario | events | image`.

| Agent | Owns | Depends on |
|---|---|---|
| Tester | `tests/game/**` (except T1/T2/T5/I1 and `_dyn.ts`), `tests/e2e/play.spec.ts` | contracts |
| Narrative designer | `lib/game/deckPrompt.ts`, `shared/game/referenceDeck1648.json` | contracts |
| Engine developer | `shared/game/engine.ts` | tester |
| Deck developer | `shared/game/deckSchema.ts`, `lib/game/deck.ts`, `app/api/game/deck/**`, `tests/api/game-deck.test.ts` | tester, narrative |
| UI developer | `components/features/Chronicle/**`, `app/play/**`, `public/cast/1648/**` | engine, deck |
| Reviewer | nothing (read-only) | all |

## Tester
Acceptance tests written before the implementation, importing the real module paths. Behavioural assertions with concrete inputs and expected outputs only.
- `tests/game/engine.test.ts`: every numbered rule in CHRONICLE_RULES §2, §3, §4 (trace rung, hint reveal), §5 and the `play` no-op after the run ends.
- `tests/game/deck-schema.test.ts`: every rule in CHRONICLE_RULES §4 against `validateDeck(raw)` from `shared/game/deckSchema.ts` → `{ ok: true, deck } | { ok: false, errors: string[] }`; one failing case per rule, built by mutating a valid deck.
- `tests/game/fairness.test.ts`: for the reference deck, replay several fixed choice sequences and assert after every step that every clear entry is true and that the faded count equals the formula.
- Must not: write implementation code; assert on export existence only.

## Narrative designer
- `lib/game/deckPrompt.ts`: pure `deckPrompt({ year, events, roleIds, example })` → `PromptSpec` (shape from `lib/ai/prompts.ts`, model `SCENARIO_MODEL`). English output. Encodes CHRONICLE_RULES §1, §3 fairness, §4 and GAME_SPEC §5 tone rules; demands JSON only, matching `Deck`.
- `shared/game/referenceDeck1648.json`: a hand-written `Deck` for 1648 that passes every §4 rule and reads well. Five real, sourced events of 1648 with Wikipedia URLs. It is the few-shot example, the offline deck and the test fixture.
- Must not: add network calls, routes or UI.

## Engine developer
- `shared/game/engine.ts` exactly per CHRONICLE_RULES §6. Pure, no randomness, no imports from `lib/`.
- Acceptance: `tests/game/engine.test.ts` and `tests/game/fairness.test.ts` pass with no assertion edited.

## Deck developer
- `shared/game/deckSchema.ts`: zod `DeckSchema` + `validateDeck`. Pure and client-safe.
- `lib/game/deck.ts` (`import "server-only"` first): `generateDeck()` takes the five events from the reference deck (the live events pipeline returns at most three per year), calls `SCENARIO_MODEL` once through OpenRouter with `deckPrompt`, strips code fences, validates, retries once with the errors appended, then throws a typed `DeckGenerationError`. Redis cache 1 hour, fail-open.
- `POST /api/game/deck` → `Deck`. Rate-limited with `checkBucketLimit(ip, "scenario")`. Returns the reference deck with no model call unless `DECK_LIVE=1` (also when `DECK_FIXTURE=1` or `OPENROUTER_API_KEY` is missing), and as a fallback when generation fails (response header `x-deck-source: reference | generated`).
- Acceptance: `tests/game/deck-schema.test.ts` passes unedited; `tests/api/game-deck.test.ts` covers fixture mode, a valid generated deck, a fenced response, invalid → retry → fallback, and 429.
- Must not: touch UI or the engine.

## UI developer
- `/play`, mobile-first at 360 px, in the existing dark look. English strings in one `strings.ts` inside the component folder.
- Flow: fetch the deck → intro card → 12 cards → result screen with the rung title, one sentence for the world fate and "Play again".
- Four meters with direction-only highlight while a card is dragged or a button is focused; no numbers. Stability is drawn as five Chronicle marks, not a bar.
- Chronicle panel: five entries; a faded entry is visibly washed out and labelled "uncertain"; a revealed entry shows what the hint bought.
- Card: portrait `/cast/1648/{roleId}.webp`, speaker, line, two labelled actions; pointer swipe, arrow keys and two buttons.
- After each choice show the consequence about 1.5 s; show an entry fading when it happens.
- All rules come from `shared/game/engine.ts`; no game rule in components.
- Acceptance: `tests/e2e/play.spec.ts` (written with the tester's card) plays a full run with the deck API mocked.
- Must not: add timers that pressure the player, streaks, scores or any number without narrative meaning.

## Reviewer
Checks the branch against CHRONICLE_RULES §2–§7 and reports facts only. Changes no code.
