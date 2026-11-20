"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { METERS } from "@/constants/game";
import type { Meter, Side } from "@/types/game";
import ChroniclePanel from "./ChroniclePanel";
import Consequence, { outcomeAnnouncement } from "./Consequence";
import GameCard from "./GameCard";
import IntroScreen from "./IntroScreen";
import ResultScreen from "./ResultScreen";
import StatusBar from "./StatusBar";
import { STRINGS, type Direction } from "./strings";
import { useChronicleGame } from "./useChronicleGame";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/** How long a consequence stays up on its own; any tap or key moves on sooner. */
const CONSEQUENCE_MS = 4000;
/** Extra time for each further thing to read (an entry fading, a new standing, a hint). */
const CONSEQUENCE_EXTRA_MS = 2500;

/** Keys that never skip a consequence: navigation and bare modifiers. */
const PASSIVE_KEYS = new Set(["Tab", "Shift", "Control", "Alt", "Meta", "CapsLock", "Escape"]);

export default function Chronicle() {
  const game = useChronicleGame();
  const { phase, deck, run, card, outcome, runResult, begin, choose, advance, restart } = game;
  const reducedMotion = usePrefersReducedMotion();
  const [preview, setPreview] = useState<Side | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const openPanel = useCallback(() => setPanelOpen(true), []);
  const closePanel = useCallback(() => setPanelOpen(false), []);

  const handleChoose = useCallback(
    (side: Side) => {
      setPreview(null);
      choose(side);
    },
    [choose],
  );

  // Arrow keys answer the card; any other key dismisses a consequence.
  useEffect(() => {
    if (panelOpen || (phase !== "card" && phase !== "consequence")) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (phase === "card") {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        handleChoose(event.key === "ArrowLeft" ? "left" : "right");
      } else if (!PASSIVE_KEYS.has(event.key)) {
        event.preventDefault();
        advance();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, panelOpen, handleChoose, advance]);

  // The consequence moves on by itself; reading the book pauses it.
  const extraNotices = outcome
    ? outcome.fadedTitles.length + (outcome.newRung ? 1 : 0) + (outcome.learned ? 1 : 0)
    : 0;
  useEffect(() => {
    if (phase !== "consequence" || panelOpen) return;
    const timer = window.setTimeout(advance, CONSEQUENCE_MS + extraNotices * CONSEQUENCE_EXTRA_MS);
    return () => window.clearTimeout(timer);
  }, [phase, panelOpen, advance, extraNotices, run?.cardIndex]);

  // Warm the next portrait so the card does not pop in.
  const nextRoleId = deck && run ? deck.cards[run.cardIndex + (phase === "card" ? 1 : 0)]?.roleId : undefined;
  useEffect(() => {
    if (!nextRoleId) return;
    const image = new Image();
    image.src = `/cast/1648/${nextRoleId}.webp`;
  }, [nextRoleId]);

  // Direction markers: only the sign of each effect of the previewed option.
  const directions = useMemo(() => {
    const signs: Partial<Record<Meter, Direction>> = {};
    if (!card || !preview) return signs;
    const effects = card[preview].effects;
    for (const meter of METERS) {
      const effect = effects[meter];
      if (effect === undefined || effect === 0) continue;
      signs[meter] = effect > 0 ? "up" : "down";
    }
    return signs;
  }, [card, preview]);

  const announcement = outcome ? outcomeAnnouncement(outcome) : "";

  return (
    <main className="mx-auto flex h-[100dvh] min-h-[34rem] w-full max-w-md flex-col gap-3 overflow-x-hidden px-4 pb-4 pt-3">
      <p aria-live="polite" data-testid="announcer" className="sr-only">
        {announcement}
      </p>

      {phase === "loading" && (
        <p data-testid="loading" role="status" className="m-auto font-serif text-lg italic text-[#B9B4AA]">
          {STRINGS.loading}
        </p>
      )}

      {phase === "intro" && <IntroScreen onBegin={begin} />}

      {(phase === "card" || phase === "consequence") && deck && run && (
        <>
          <StatusBar
            meters={run.meters}
            entryStates={deck.chronicle.map((entry) => run.chronicle[entry.id] ?? "clear")}
            directions={directions}
            onOpenChronicle={openPanel}
            progress={{
              current: Math.min(run.cardIndex + (phase === "card" ? 1 : 0), deck.cards.length),
              total: deck.cards.length,
            }}
          />
          {phase === "card" && card && (
            <GameCard
              key={card.id}
              card={card}
              preview={preview}
              onPreview={setPreview}
              onChoose={handleChoose}
              onCheckChronicle={openPanel}
              reducedMotion={reducedMotion}
            />
          )}
          {phase === "consequence" && outcome && (
            <Consequence key={outcome.card.id} outcome={outcome} onContinue={advance} />
          )}
        </>
      )}

      {phase === "result" && deck && run && runResult && (
        <ResultScreen
          deck={deck}
          run={run}
          runResult={runResult}
          onPlayAgain={restart}
          onOpenChronicle={openPanel}
        />
      )}

      {panelOpen && deck && run && (
        <ChroniclePanel deck={deck} run={run} highlightEntryId={card?.chronicleRef} onClose={closePanel} />
      )}
    </main>
  );
}
