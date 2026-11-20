// Chronicle engine — pure and deterministic. Rules: docs/game/CHRONICLE_RULES.md §2–§6.
// Client-safe: no I/O, no randomness, no imports from lib/.
import {
  COMMONER_STABILITY_DIVISOR,
  COMMONER_START,
  FADE_STEP,
  METER_MAX,
  METER_MIN,
  METERS,
  RUNGS,
  WORLD_FATE_THRESHOLDS,
} from "@/constants/game";
import type {
  Card,
  Deck,
  EntryState,
  LogEntry,
  Meter,
  RunResult,
  RunState,
  Side,
} from "@/types/game";

const clamp = (value: number): number => Math.min(METER_MAX, Math.max(METER_MIN, value));

const otherSide = (side: Side): Side => (side === "left" ? "right" : "left");

export function initRun(deck: Deck): RunState {
  const chronicle: Record<string, EntryState> = {};
  for (const entry of deck.chronicle) chronicle[entry.id] = "clear";
  return {
    meters: { ...COMMONER_START },
    chronicle,
    revealed: {},
    rung: RUNGS[0],
    cardIndex: 0,
    lowestStability: COMMONER_START.stability,
    log: [],
    status: "playing",
  };
}

/** An entry is true while clear; once faded, only if it survives fading. */
export function entryIsTrue(deck: Deck, state: RunState, entryId: string): boolean {
  if (state.chronicle[entryId] !== "faded") return true;
  return deck.chronicle.find((entry) => entry.id === entryId)?.survivesFading === true;
}

/** The right answer of a trace card in this state; `undefined` for other kinds. */
export function correctSide(deck: Deck, state: RunState, card: Card): Side | undefined {
  if (card.kind !== "trace" || !card.correct || !card.chronicleRef) return undefined;
  return entryIsTrue(deck, state, card.chronicleRef) ? card.correct : otherSide(card.correct);
}

export function play(state: RunState, deck: Deck, side: Side): RunState {
  if (state.status !== "playing") return state;
  const card = deck.cards[state.cardIndex];
  if (!card) return state;
  const option = card[side];

  // The trace is judged against the world as it was BEFORE this choice.
  const rightSide = correctSide(deck, state, card);

  // Effects: the unnoticed Commoner moves Stability by half, rounded toward zero.
  const applied: Partial<Record<Meter, number>> = {};
  const meters = { ...state.meters };
  for (const meter of METERS) {
    const raw = option.effects[meter];
    if (raw === undefined) continue;
    // "+ 0" turns the -0 that Math.trunc(-1 / 2) yields into a plain 0.
    const delta = meter === "stability" ? Math.trunc(raw / COMMONER_STABILITY_DIVISOR) + 0 : raw;
    applied[meter] = delta;
    meters[meter] = clamp(meters[meter] + delta);
  }

  const lowestStability = Math.min(state.lowestStability, meters.stability);

  // Fading follows the lowest Stability ever reached, so it never reverts.
  const chronicle = { ...state.chronicle };
  const fadedEntryIds: string[] = [];
  const isClear = (id: string): boolean => chronicle[id] === "clear";
  const due = Math.min(
    deck.chronicle.length,
    Math.floor((COMMONER_START.stability - lowestStability) / FADE_STEP),
  );
  let faded = deck.chronicle.filter((entry) => !isClear(entry.id)).length;
  while (faded < due) {
    const preferred = option.fadesEntryId;
    const id =
      preferred !== undefined && isClear(preferred)
        ? preferred
        : deck.chronicle.find((entry) => isClear(entry.id))?.id;
    if (id === undefined) break;
    chronicle[id] = "faded";
    fadedEntryIds.push(id);
    faded += 1;
  }

  // Rung: only a correct trace raises it, by one, never past the top.
  const traceCorrect = rightSide === undefined ? undefined : side === rightSide;
  const rung = traceCorrect
    ? RUNGS[Math.min(RUNGS.indexOf(state.rung) + 1, RUNGS.length - 1)]
    : state.rung;

  // Reveal: a paid hint records whether the entry would survive fading.
  const revealedEntry = deck.chronicle.find((entry) => entry.id === option.revealsEntryId);
  const revealed = revealedEntry
    ? { ...state.revealed, [revealedEntry.id]: revealedEntry.survivesFading }
    : state.revealed;

  const logEntry: LogEntry = {
    cardId: card.id,
    side,
    applied,
    metersAfter: { ...meters },
    fadedEntryIds,
  };
  if (traceCorrect !== undefined) logEntry.traceCorrect = traceCorrect;
  if (revealedEntry) logEntry.revealedEntryId = revealedEntry.id;

  const cardIndex = state.cardIndex + 1;
  // METERS order is the collapse tie-break; a collapse wins over "finished".
  const collapsedMeter = METERS.find(
    (meter) => meters[meter] <= METER_MIN || meters[meter] >= METER_MAX,
  );

  const next: RunState = {
    meters,
    chronicle,
    revealed,
    rung,
    cardIndex,
    lowestStability,
    log: [...state.log, logEntry],
    status: collapsedMeter ? "collapsed" : cardIndex >= deck.cards.length ? "finished" : "playing",
  };
  if (collapsedMeter) next.collapsedMeter = collapsedMeter;
  return next;
}

export function result(state: RunState): RunResult {
  const stability = state.meters.stability;
  const worldFate = (
    WORLD_FATE_THRESHOLDS.find((step) => stability >= step.minStability) ??
    WORLD_FATE_THRESHOLDS[WORLD_FATE_THRESHOLDS.length - 1]
  ).fate;
  const runResult: RunResult = { rung: state.rung, worldFate };
  if (state.collapsedMeter) runResult.collapsedMeter = state.collapsedMeter;
  return runResult;
}
