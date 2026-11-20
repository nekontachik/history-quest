"use client";

// The single place that holds Chronicle game state. Every rule is delegated to
// shared/game/engine.ts; this file only sequences screens around it.
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { initRun, play, result } from "@/shared/game/engine";
import referenceDeck from "@/shared/game/referenceDeck1648.json";
import type { Card, Deck, RunResult, RunState, Rung, Side } from "@/types/game";

const DECK_ENDPOINT = "/api/game/deck";
const FALLBACK_DECK = referenceDeck as unknown as Deck;

export type Phase = "loading" | "intro" | "card" | "consequence" | "result";

/** What the last choice did, in the words the player is shown. */
export interface Outcome {
  card: Card;
  side: Side;
  consequence: string;
  fadedTitles: string[];
  /** Set when the hero's standing rose on this choice. */
  newRung?: Rung;
  /** Set when a hint was bought: whether the entry survives fading. */
  learned?: { title: string; survives: boolean };
}

interface GameState {
  phase: Phase;
  deck: Deck | null;
  run: RunState | null;
  /** The hero's standing before the last choice, to detect a rise. */
  rungBefore: Rung | null;
}

type Action =
  | { type: "loaded"; deck: Deck }
  | { type: "begin" }
  | { type: "choose"; side: Side }
  | { type: "advance" }
  | { type: "restart" };

const INITIAL: GameState = { phase: "loading", deck: null, run: null, rungBefore: null };

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "loaded":
      if (state.phase !== "loading") return state;
      return { phase: "intro", deck: action.deck, run: initRun(action.deck), rungBefore: null };
    case "begin":
      if (state.phase !== "intro") return state;
      return { ...state, phase: "card" };
    case "choose": {
      if (state.phase !== "card" || !state.deck || !state.run) return state;
      const run = play(state.run, state.deck, action.side);
      if (run === state.run) return state;
      return { ...state, phase: "consequence", run, rungBefore: state.run.rung };
    }
    case "advance":
      if (state.phase !== "consequence" || !state.run) return state;
      return { ...state, phase: state.run.status === "playing" ? "card" : "result" };
    case "restart":
      if (!state.deck) return state;
      return { phase: "card", deck: state.deck, run: initRun(state.deck), rungBefore: null };
  }
}

/** Accepts only something shaped like a deck; anything else falls back to the bundled one. */
function looksLikeDeck(value: unknown): value is Deck {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { chronicle?: unknown; cards?: unknown };
  return (
    Array.isArray(candidate.chronicle) &&
    candidate.chronicle.length > 0 &&
    Array.isArray(candidate.cards) &&
    candidate.cards.length > 0
  );
}

async function fetchDeck(): Promise<Deck> {
  try {
    const response = await fetch(DECK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!response.ok) return FALLBACK_DECK;
    const body: unknown = await response.json();
    return looksLikeDeck(body) ? body : FALLBACK_DECK;
  } catch {
    return FALLBACK_DECK;
  }
}

function describeOutcome(state: GameState): Outcome | null {
  const { deck, run, rungBefore } = state;
  if (!deck || !run) return null;
  const last = run.log[run.log.length - 1];
  if (!last) return null;
  const card = deck.cards.find((candidate) => candidate.id === last.cardId);
  if (!card) return null;
  const titleOf = (entryId: string): string =>
    deck.chronicle.find((entry) => entry.id === entryId)?.title ?? entryId;

  const outcome: Outcome = {
    card,
    side: last.side,
    consequence: card[last.side].consequence,
    fadedTitles: last.fadedEntryIds.map(titleOf),
  };
  if (last.traceCorrect && rungBefore !== null && run.rung !== rungBefore) {
    outcome.newRung = run.rung;
  }
  if (last.revealedEntryId !== undefined && last.revealedEntryId in run.revealed) {
    outcome.learned = {
      title: titleOf(last.revealedEntryId),
      survives: run.revealed[last.revealedEntryId],
    };
  }
  return outcome;
}

export interface ChronicleGame {
  phase: Phase;
  deck: Deck | null;
  run: RunState | null;
  /** The card waiting for an answer (only while phase is "card"). */
  card: Card | null;
  /** What the last choice did (only while phase is "consequence"). */
  outcome: Outcome | null;
  /** The outcome of the run (only while phase is "result"). */
  runResult: RunResult | null;
  begin: () => void;
  choose: (side: Side) => void;
  advance: () => void;
  restart: () => void;
}

export function useChronicleGame(): ChronicleGame {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const requested = useRef(false);

  useEffect(() => {
    // Guarded by a ref so React's development double-mount asks for one deck only.
    if (requested.current) return;
    requested.current = true;
    void fetchDeck().then((deck) => dispatch({ type: "loaded", deck }));
  }, []);

  const begin = useCallback(() => dispatch({ type: "begin" }), []);
  const choose = useCallback((side: Side) => dispatch({ type: "choose", side }), []);
  const advance = useCallback(() => dispatch({ type: "advance" }), []);
  const restart = useCallback(() => dispatch({ type: "restart" }), []);

  return useMemo(() => {
    const { phase, deck, run } = state;
    return {
      phase,
      deck,
      run,
      card: phase === "card" && deck && run ? deck.cards[run.cardIndex] ?? null : null,
      outcome: phase === "consequence" ? describeOutcome(state) : null,
      runResult: phase === "result" && run ? result(run) : null,
      begin,
      choose,
      advance,
      restart,
    };
  }, [state, begin, choose, advance, restart]);
}
