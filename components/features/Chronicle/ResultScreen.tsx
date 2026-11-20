"use client";

import { useEffect, useRef } from "react";
import { METER_MIN } from "@/constants/game";
import type { Deck, RunResult, RunState } from "@/types/game";
import styles from "./Chronicle.module.css";
import { STRINGS, type CollapseEnd } from "./strings";

const BUTTON =
  "min-h-[3rem] rounded-xl px-6 text-sm uppercase tracking-[0.16em] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F1EBDF]";

interface Props {
  deck: Deck;
  run: RunState;
  runResult: RunResult;
  onPlayAgain: () => void;
  onOpenChronicle: () => void;
}

export default function ResultScreen({ deck, run, runResult, onPlayAgain, onOpenChronicle }: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  const changed = deck.chronicle.filter((entry) => run.chronicle[entry.id] === "faded");
  const collapsed = runResult.collapsedMeter;
  // Which end of the pillar gave way decides the wording; the engine decided that it broke.
  const collapseEnd: CollapseEnd | null =
    collapsed === undefined ? null : run.meters[collapsed] <= METER_MIN ? "empty" : "full";

  return (
    <section
      data-testid="result"
      data-status={run.status}
      className={`${styles.appear} flex flex-1 flex-col justify-center py-4`}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#B9B4AA]">{STRINGS.result.eyebrow}</p>
      <h1
        ref={titleRef}
        tabIndex={-1}
        data-testid="rung-title"
        data-rung={runResult.rung}
        className="mt-2 font-serif text-5xl leading-[1.05] text-[#E3A84E] outline-none"
      >
        {STRINGS.result.rung[runResult.rung]}
      </h1>

      <p
        data-testid="world-fate"
        data-fate={runResult.worldFate}
        className="mt-6 font-serif text-xl leading-snug text-[#F1EBDF]"
      >
        {STRINGS.result.fate[runResult.worldFate]}
      </p>

      {collapsed !== undefined && collapseEnd && (
        <p
          data-testid="collapse"
          data-meter={collapsed}
          className="mt-4 border-l-2 border-[#E36B5B] pl-3 font-serif text-lg leading-snug text-[#F1EBDF]"
        >
          {STRINGS.result.collapse[collapsed][collapseEnd]}
        </p>
      )}

      <h2 className="mt-8 text-[11px] font-medium uppercase tracking-[0.16em] text-[#B9B4AA]">
        {STRINGS.result.changedHeading}
      </h2>
      {changed.length === 0 ? (
        <p className="mt-2 text-sm text-[#F1EBDF]">{STRINGS.result.changedNothing}</p>
      ) : (
        <ul data-testid="changed-list" className="mt-2 space-y-1.5">
          {changed.map((entry) => (
            <li key={entry.id} className="flex items-baseline gap-2 font-serif text-lg italic text-[#F1EBDF]/75">
              <span aria-hidden="true" className="text-[#B9B4AA]">
                —
              </span>
              <span className="line-through decoration-[#F1EBDF]/30">{entry.title}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <button
          type="button"
          data-testid="play-again"
          onClick={onPlayAgain}
          className={`${BUTTON} border border-[#E3A84E] bg-[#E3A84E] font-semibold text-[#0a0a0f] hover:bg-[#f0b96a]`}
        >
          {STRINGS.result.playAgain}
        </button>
        <button
          type="button"
          data-testid="result-chronicle"
          onClick={onOpenChronicle}
          aria-haspopup="dialog"
          className={`${BUTTON} border border-[#E3A84E]/40 text-[#E3A84E] hover:border-[#E3A84E]`}
        >
          {STRINGS.chronicle.readAgain}
        </button>
      </div>
    </section>
  );
}
