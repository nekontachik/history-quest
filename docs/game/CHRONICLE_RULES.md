# Chronicle prototype — design summary and exact rules

Branch `rebuild/chronicle`. This file is the source of truth for the prototype. It supersedes the run rules in `GAME_SPEC.md` (meters, endings, card contract); `GAME_SPEC.md` §5 (dilemma tone) and §9 (design principles) still apply. Contracts: `types/game.ts`, numbers: `constants/game.ts`.

## 1. What the game is

You are an ordinary person in a real year of history with one advantage: you know what is going to happen. You own the **Chronicle**, a book that should not exist, listing five real events of your year. You can follow history and get by, or bend it and rise. The more you bend it, the less your knowledge is worth: entries in the Chronicle fade, and a faded entry may no longer come true.

It is an alternate-history detective on cards, not a ruler-survival game. The interesting question each turn is "is this still the world I know?".

Prototype scope: one hero (the Commoner), one year (1648), one run of 12 cards. No campaign, no other heroes, no Atlas, no artifact, no live image generation.

## 2. Meters

Four meters, 0–100: Stability, People, Power, Faith.

- Commoner start: Stability 50, People 60, Power 30, Faith 50.
- Stability is never shown as a number. The player sees it as the state of the Chronicle (how many entries are still clear).
- **Unnoticed:** every Stability effect the Commoner causes is halved, rounded toward zero (−25 → −12, +15 → +7, −1 → 0). Other meters apply in full.
- Meters are clamped to 0–100 after each choice.
- **Collapse:** if any meter is ≤ 0 or ≥ 100 after a choice, the run ends with status `collapsed` and that meter as `collapsedMeter`. If several collapse at once, the first in the order stability, people, power, faith wins.

## 3. The Chronicle

- Five entries, all `clear` at the start. Each has a hidden `survivesFading` flag.
- **Fading:** track the lowest Stability reached. The number of faded entries must equal `floor((50 − lowestStability) / 15)`, capped at 5: one at 35, two at 20, three at 5. Fading never reverts when Stability recovers.
- **Which entry fades:** the chosen option's `fadesEntryId` if that entry is still clear; otherwise the first clear entry in deck order.
- **Truth:** an entry is true if it is `clear`, or if it is `faded` and `survivesFading` is true.
- **Fairness rule (must never be broken):** a clear entry is always true. The player always sees which entries have faded. The game never lies without that signal.

## 4. Cards

A deck is exactly 12 cards: 7–8 fork, 2–3 trace, exactly 2 hint. Every option changes 1–3 meters by a non-zero integer in [−25, 25].

- **Fork.** Follow history or change it. Both options cost something; neither is strictly better. No `correct` side. An option that changes history lowers Stability and should name the entry it endangers in `fadesEntryId`.
- **Trace.** The speaker's line contains one detail that the referenced entry (`chronicleRef`) confirms or contradicts. One side means "trust the Chronicle", the other "trust the speaker". `correct` is the right side while the entry is true; when the entry is false (faded and not surviving), the correct side is the opposite one. The answer must be decidable from the entry's `summary` alone.
  - Correct choice: the rung rises by one. Wrong choice: no rung change. Effects apply either way.
- **Hint.** Someone offers knowledge for a price. Exactly one option carries `revealsEntryId` and at least one negative effect. Choosing it records that entry's `survivesFading` in `RunState.revealed` ("even if history bends, this will / will not still happen"). The other option declines and reveals nothing.

Field rules: `chronicleRef` is required on trace, optional elsewhere, and must name an existing entry. `correct` only on trace. `fadesEntryId` only on fork options. `revealsEntryId` only on hint options. `roleId` must be one of the eight portrait roles.

## 5. Rungs and the end of the run

- Rungs: nobody → noticed → needed → influential → summit. The Commoner starts at `nobody`. Only a correct trace raises the rung, by one, never past `summit`.
- The run ends when a meter collapses or the twelfth card has been played (`finished`).
- **World fate** from final Stability: ≥ 45 `as_it_was`, 30–44 `shifted`, 15–29 `unrecognisable`, < 15 `torn`.
- Result = `{ rung, worldFate, collapsedMeter? }`. A collapse still yields a result, never an empty failure.

## 6. Engine API (pure, deterministic, no I/O)

`shared/game/engine.ts`:

- `initRun(deck): RunState`
- `play(state, deck, side): RunState` — returns a new state; a no-op when `status !== "playing"`.
- `result(state): RunResult`
- `entryIsTrue(deck, state, entryId): boolean`
- `correctSide(deck, state, card): Side | undefined` — `undefined` for non-trace cards.

Order inside `play`: read the card's truth and correct side from the state BEFORE the choice → apply effects (Stability halved) → clamp → update `lowestStability` → fade entries → rung → reveal → log → advance `cardIndex` → set status.

## 7. Design principles (do not violate)

- Return motivation is curiosity and authorship, never FOMO. No streaks, timers or decaying resources.
- Stakes live inside the fiction. Every number or label the player sees has narrative meaning.
- No clean "correct" playthrough: facts have right answers, decisions only have prices.
