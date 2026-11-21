# Chronicle — hero game design (prototype)

Reconstructed on 2026-11-20 from the team doc "Хроніка — команда агентів для прототипу" and
`CHRONICLE_RULES.md`; the original file was never committed. Numbers and exact rules live in
`CHRONICLE_RULES.md` (source of truth), contracts in `types/game.ts`, constants in
`constants/game.ts`. If this file and the rules disagree, the rules win.

## 1. Concept

You are an ordinary person in a real year of history with one advantage: you know what is going
to happen. You found **the Chronicle**, a book that should not exist, listing five real events of
your year. Follow history and you get by; bend it and you rise. The more you bend it, the less
your knowledge is worth: entries fade, and a faded entry may no longer come true.

An alternate-history detective on cards, not a ruler-survival game. The question every turn is
"is this still the world I know?".

## 2. The run

One run = one year (1648), one hero (the Commoner), 12 cards, a few minutes.

1. **Intro card**: "1648. You found a book that should not exist."
2. **Cards**: a speaker (portrait, name, one line) and two labelled actions, chosen by swipe,
   arrow keys or buttons. Each choice moves 1–3 of four meters: Stability, People, Power, Faith.
3. **Consequence**: one sentence after every choice; if an entry fades, the player sees it fade.
4. **End**: after the twelfth card, or earlier if any meter hits 0 or 100 (collapse). A collapse
   still gives a full result, never an empty failure.
5. **Result**: the hero's rung and the fate of the world, then "Play again".

Stability is never shown as a number: the player reads it as the state of the Chronicle.

## 3. The Chronicle and the three card types

**The Chronicle.** Five real, sourced events of the year. All start clear. As Stability drops
from its starting value, entries fade one by one (every 15 points of the lowest Stability
reached) and never come back. A clear entry is always true. A faded entry may or may not still
happen; the game never says which, unless the player paid for it.

**Fairness rule (never broken):** a clear entry is always true, and the player always sees which
entries have faded. The game never lies without that signal.

**Fork (7–8 per deck).** Follow history or change it. Both options cost something; neither is
strictly better. An option that changes history lowers Stability and names the entry it
endangers.

**Trace (2–3).** The speaker's line contains one detail that a Chronicle entry confirms or
contradicts. One side trusts the Chronicle, the other trusts the speaker. The answer must be
decidable from the entry text alone. While the entry is true, trusting the Chronicle is right;
once it is faded and no longer true, the speaker is right. A correct trace raises the rung.

**Hint (exactly 2).** Someone offers knowledge for a price paid in a meter: pay, and you learn
whether a given entry will still happen even if history bends. Declining still moves a meter a little (every option must) and
reveals nothing.

## 4. The hero, the screen and the result

**The Commoner** (only hero in the prototype). Starts with People 60, Power 30, Faith 50,
Stability 50. Ability **Unnoticed**: every Stability change they cause is halved. They start at
the bottom rung, `nobody`.

**Rungs**: nobody → noticed → needed → influential → summit. Only a correct trace climbs one
rung. Spotting the truth is how a nobody rises.

**World fate** by final Stability: the world as it was → shifted → unrecognisable → torn.

**Screen** (mobile-first, 360 px, existing dark look, palette from `ART_DIRECTION.md` §5):
- top: four meters, direction-only highlight while a card is dragged or a button focused, no
  numbers; Stability drawn as five Chronicle marks, not a bar;
- a Chronicle button opens a panel with the five entries; a faded entry is washed out and
  labelled "uncertain"; a revealed entry shows what the hint bought;
- the card: portrait from `/cast/1648/{roleId}.webp`, speaker name, line, two actions;
- after a choice, the consequence for about 1.5 s;
- result screen: the rung as a title under the portrait, the world fate as one sentence,
  "Play again".

**Cast 1648**: eight ready portraits, no live image generation: wife, scout, doctor, monk,
merchant, envoy, peasant, elder.

## 5. Out of the prototype (second wave)

- Noble and Chronicler heroes with their own abilities.
- Campaign with world scars, then the Atlas and the artifact.
- Eval agent: 20 generated decks, checking trace fairness and that no option is better without a
  price.

## 6. Deck generation

A deck is generated once per run by the scenario model from the year's real events
(`lib/game/deckPrompt.ts`), validated against `CHRONICLE_RULES.md` §4, with the hand-written
reference deck as the few-shot example and the offline fallback. English only.

## 7. Tone and design principles

- Tone: dark historical thriller, respectful; no gratuitous gore; no real living people. The
  dilemma rules of `GAME_SPEC.md` §5 apply in full (rotating conflict types, objects from the
  future driving some dilemmas, effects consistent with the text: giving medicine raises People
  and lowers Stability).
- No clean "correct" playthrough: facts have right answers, decisions only have prices.
- Return motivation is curiosity and authorship, never FOMO. No streaks, timers or decaying
  resources.
- Stakes live inside the fiction. Every number or label the player sees has narrative meaning.
