# Chrono Agent — Game Spec (Phase 1 prototype)

Status: agreed in design chat, 2026-10-09. Art direction lives in `ART_DIRECTION.md` (style preset finalised after the cinematic test).
Target codebase: `nekontachik/history-quest` (copy of `nekontachik/time_machine`: Next.js 14 App Router, OpenRouter, Redis, next-intl). Images: Flux Schnell via PiAPI, fal.ai as fallback.

## 1. Placement
- The game becomes the **main screen** of Time Machine.
- The existing scenario engine is reused inside the game: it writes the final "what became of the world" text for every run.
- Reuse: `/api/historical-events` (real events of the year), scenario generation in `lib/ai/text.ts`, `StarField` for the year-drop transition, `lib/ai/image.ts` for images.
- Languages: UA + EN via existing next-intl. Card text is generated in the user's locale.
- No rate limit for the prototype.

## 2. Core loop (one run, ~3–4 min)
1. **Year drop** — by default StarField spins and the player lands in a random year (range 3000 BCE–2024 CE); the existing year slider stays available to pick a specific year instead.
2. **Mission card** — e.g. "1648. The timeline is cracking. Survive 12 decisions without breaking the world." + one optional **bonus goal** from a fixed template list (e.g. "Keep People above 70 and never let Faith drop below 30").
3. **Deck of 12 cards.** Each card = a character (portrait) + one line of dialogue with a dilemma + two labelled actions (swipe left / swipe right).
4. **Four meters** at the top: Stability (of time), People, Power, Faith. Range 0–100, all start at 50.
   - Each option changes 1–3 meters by an integer in [-25, +25].
   - While dragging a card, the meters that will change are highlighted (direction dot only, no numbers).
5. **After each swipe** — one-sentence consequence ("The camp lives. Somewhere, a chronicle goes blank.").
6. **End of run:**
   - **Collapse** — any meter reaches ≤0 or ≥100 → collapse ending of that meter/direction.
   - **Survival** — all 12 cards played → survival ending chosen by final meter state.
7. **Artifact** — the scenario engine writes the world summary; the player receives an artifact: generated title, cover image (gold engraving variant), decision lineage. A collapse yields a *rare* artifact, never an empty failure.
8. **Decision tree** — after the run, show the chosen path; neighbouring branches are shown locked with a "?" and a hint ("here Faith would have reached 100").
9. **Atlas** — all possible endings shown; found ones with cover, unfound as dark silhouettes with "?".

## 3. Endings (fixed list in code — required for the Atlas)
- 8 collapse endings: {Stability, People, Power, Faith} × {0, 100}. Examples: Faith 100 → "Theocracy"; Power 0 → "Anarchy"; People 100 → "Republic of the Free"; Stability 0 → "Unravelled Timeline".
- 5 survival endings: one per dominant meter (highest final value) + "Quiet Line" (all meters within 40–60, legendary/rare).
- Atlas key = `endingId × era`, eras: Ancient (<500), Medieval (500–1499), Early Modern (1500–1799), Industrial (1800–1913), Modern (1914+). 13 × 5 = 65 slots.
- Ending ids and names live in code + i18n; only the artifact's title/summary/cover are generated.

## 4. Card data contract
```ts
type Meter = "stability" | "people" | "power" | "faith";

interface CardOption {
  label: string;                         // short action, e.g. "Give the medicine"
  effects: Partial<Record<Meter, number>>; // 1–3 meters, integers in [-25, 25]
  consequence: string;                   // one sentence shown after the swipe
}

interface Card {
  id: string;
  roleId: string;            // must match a role in the character pool for this era
  speakerName: string;       // e.g. "Colonel's wife"
  line: string;              // the dilemma, ≤ 220 chars
  realEventRef?: string;     // set when the card is tied to a real event of the year
  conflictType: "life_vs_history" | "one_vs_many" | "now_vs_later" | "truth_vs_peace";
  left: CardOption;
  right: CardOption;
}
```
The deck (12 cards) is generated in ONE LLM call returning JSON, validated with a schema (reject + retry once on invalid).

## 5. Dilemma rules (card generator system prompt — the most important part)
1. **No free choice.** Both options must cost something real; neither may be strictly better.
2. **Core tension: morality vs. preserving history.** The player knows what really happened. Saving people tends to break history (Stability ↓); preserving history means letting them suffer, knowingly.
3. **Rotate conflict types** across the deck: life vs history, one vs many, now vs later, truth vs peace. No more than 3 cards of the same type.
4. **At least 1 in 3 cards references a real event of that year** (from `/api/historical-events`), so the player feels what they are changing.
5. Anachronisms (objects from the future) appear in at least 4 cards and drive the dilemma (a vaccine, a smartphone map, a wristwatch).
6. Effects must be consistent with the text (giving medicine raises People, lowers Stability).
7. Tone: dark historical thriller, respectful; no gratuitous gore; no real living people.

Reference examples (1648):
- A doctor from the future offers plague medicine for the camp. Give → People +20, Stability −20. Refuse → People −15, Faith +5.
- The colonel's wife begs you to warn her husband of an ambush you know he dies in. Warn → Stability −15, Power +10. Stay silent → People −10, Faith −5.
- A scout brings a smartphone showing every enemy position. Give to the hetman → Power +25, Stability −10. Destroy → Power −10, Stability +10.

## 6. Images
- Style preset, formats and prompt rules: see `ART_DIRECTION.md`.
- Formats: character card 3:4, scene 16:9, artifact cover 3:4.
- **Character pool** pre-generated per `era × roleId` (e.g. hetman, monk, merchant, soldier, noblewoman, scribe, priest, peasant, spy, doctor). The card generator receives the list of available roleIds for the era and must pick from it. Only unique scenes and artifact covers are generated live.
- Provider: **PiAPI** Flux Schnell ($0.0015/image), fal.ai only as fallback.
- Storage: **Vercel Blob**. All image keys include `STYLE_VERSION` so a style change regenerates cleanly.
- Scenario images of the existing flow move to the same style preset.

## 7. Persistence (phase 1)
- Anonymous player id (cookie). Atlas + artifacts stored in Redis keyed by player id; localStorage as offline cache.

## 8. Out of scope for phase 1 (designed, build later)
- World memory across runs (your timeline persists; NPCs remember past runs; carry one anachronism into the next run as a third option).
- Meta-mystery: who scatters the anachronisms — one clue per run.
- Year of the day (same seed for everyone, compare outcomes; no streaks).
- Rate limits / Chrono-Energy, payments.

## 9. Design principles (do not violate)
- Return motivation = curiosity and authorship, never FOMO. No streaks that reset, no decaying resources.
- Stakes live inside the fiction (meters, collapse), not as external punishment.
- Every number shown to the player has narrative meaning.
