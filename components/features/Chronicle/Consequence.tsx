"use client";

import { useEffect, useRef } from "react";
import type { Outcome } from "./useChronicleGame";
import styles from "./Chronicle.module.css";
import { STRINGS } from "./strings";

interface Props {
  outcome: Outcome;
  onContinue: () => void;
}

/** What the last answer did. Tapping anywhere on it, or the button, moves on. */
export default function Consequence({ outcome, onContinue }: Props) {
  const continueRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    continueRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-h-0 flex-1 items-center justify-center">
        {/* The button below is the accessible control; the whole card is a convenience tap target. */}
        <div
          data-testid="consequence"
          onClick={onContinue}
          className={`${styles.appear} relative flex aspect-[3/4] max-h-full w-full cursor-pointer flex-col justify-center overflow-hidden rounded-2xl border border-[#E3A84E]/20 bg-[#0d0d12] px-6 py-6`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static local portrait; no optimizer round-trip wanted */}
          <img
            src={`/cast/1648/${outcome.card.roleId}.webp`}
            alt=""
            width={640}
            height={853}
            draggable={false}
            className="absolute inset-0 h-full w-full scale-[1.12] object-cover opacity-[0.13]"
          />
          <div className="relative flex flex-col gap-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#B9B4AA]">
              {outcome.card[outcome.side].label}
            </p>
            <p className="font-serif text-[1.18rem] leading-snug text-[#F1EBDF]">{outcome.consequence}</p>

            {outcome.fadedTitles.map((title) => {
              const fading = STRINGS.consequence.fading(title);
              return (
                <p
                  key={title}
                  data-testid="consequence-fading"
                  className="border-l-2 border-dashed border-[#B9B4AA]/60 pl-3 text-sm text-[#B9B4AA]"
                >
                  {fading.lead}{" "}
                  <span className={`${styles.inkFading} inline-block font-serif text-base text-[#F1EBDF]`}>
                    {fading.title}
                  </span>
                </p>
              );
            })}

            {outcome.newRung && (
              <p
                data-testid="consequence-standing"
                className="border-l-2 border-[#E3A84E] pl-3 font-serif text-base italic text-[#E3A84E]"
              >
                {STRINGS.standing[outcome.newRung]}
              </p>
            )}

            {outcome.learned && (
              <p data-testid="consequence-learned" className="border-l-2 border-[#E3A84E] pl-3 text-sm text-[#F1EBDF]">
                <span className="font-serif text-base text-[#E3A84E]">{outcome.learned.title}.</span>{" "}
                {outcome.learned.survives ? STRINGS.consequence.hintSurvives : STRINGS.consequence.hintFails}
              </p>
            )}
          </div>
        </div>
      </div>

      <button
        ref={continueRef}
        type="button"
        data-testid="consequence-continue"
        onClick={onContinue}
        className="min-h-[4.25rem] shrink-0 rounded-xl border border-[#E3A84E]/40 bg-white/[0.03] px-3 text-sm uppercase tracking-[0.16em] text-[#E3A84E] hover:border-[#E3A84E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E3A84E]"
      >
        {STRINGS.consequence.continue}
      </button>
    </div>
  );
}

/** The same outcome as one plain sentence run, for the live region. */
export function outcomeAnnouncement(outcome: Outcome): string {
  const parts = [outcome.consequence];
  for (const title of outcome.fadedTitles) {
    const fading = STRINGS.consequence.fading(title);
    parts.push(`${fading.lead} ${fading.title}.`);
  }
  if (outcome.newRung) parts.push(STRINGS.standing[outcome.newRung]);
  if (outcome.learned) {
    parts.push(
      `${outcome.learned.title}. ${
        outcome.learned.survives ? STRINGS.consequence.hintSurvives : STRINGS.consequence.hintFails
      }`,
    );
  }
  return parts.join(" ");
}
