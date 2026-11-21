"use client";

import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { Deck, RunState } from "@/types/game";
import styles from "./Chronicle.module.css";
import { STRINGS } from "./strings";

const FOCUSABLE = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

interface Props {
  deck: Deck;
  run: RunState;
  /** The entry the current card is about, if any. */
  highlightEntryId?: string;
  onClose: () => void;
}

export default function ChroniclePanel({ deck, run, highlightEntryId, onClose }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const highlightRef = useRef<HTMLLIElement>(null);

  // Take focus on open, hand it back to whatever opened the book on close.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus({ preventScroll: true });
    highlightRef.current?.scrollIntoView({ block: "nearest" });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !sheetRef.current) return;
    const focusable = Array.from(sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !sheetRef.current.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !sheetRef.current.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onKeyDown={handleKeyDown}>
      <div
        aria-hidden="true"
        data-testid="chronicle-backdrop"
        onClick={onClose}
        className={`${styles.backdrop} absolute inset-0 bg-black/75`}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chronicle-panel-title"
        data-testid="chronicle-panel"
        className={`${styles.sheet} relative flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-2xl border border-b-0 border-[#E3A84E]/40 bg-[#1a1712] shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.9)]`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#E3A84E]/20 px-4 pb-3 pt-4">
          <div>
            <h2 id="chronicle-panel-title" className="font-serif text-2xl text-[#E3A84E]">
              {STRINGS.chronicle.title}
            </h2>
            <p className="mt-0.5 text-xs text-[#B9B4AA]">{STRINGS.chronicle.subtitle}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            data-testid="chronicle-close"
            onClick={onClose}
            className="min-h-[2.5rem] shrink-0 rounded-lg border border-[#E3A84E]/40 px-3 text-xs uppercase tracking-[0.12em] text-[#E3A84E] hover:border-[#E3A84E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E3A84E]"
          >
            {STRINGS.chronicle.close}
          </button>
        </div>

        <ol className="min-h-0 flex-1 list-none space-y-2.5 overflow-y-auto overscroll-contain px-4 pb-6 pt-3">
          {deck.chronicle.map((entry) => {
            const state = run.chronicle[entry.id] ?? "clear";
            const faded = state === "faded";
            const highlighted = entry.id === highlightEntryId;
            const learned = entry.id in run.revealed ? run.revealed[entry.id] : undefined;
            return (
              <li
                key={entry.id}
                ref={highlighted ? highlightRef : undefined}
                data-testid="chronicle-entry"
                data-entry-id={entry.id}
                data-state={state}
                data-highlighted={highlighted ? "true" : undefined}
                className={`rounded-xl border px-3.5 py-3 ${
                  highlighted
                    ? "border-[#E3A84E] bg-[#E3A84E]/10"
                    : faded
                      ? "border-dashed border-[#B9B4AA]/40"
                      : "border-[#E3A84E]/20"
                }`}
              >
                {highlighted && (
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[#E3A84E]">
                    <span aria-hidden="true">☞ </span>
                    {STRINGS.chronicle.asked}
                  </p>
                )}
                <div className="flex items-baseline justify-between gap-3">
                  <h3
                    className={`font-serif text-lg leading-snug ${
                      faded ? "italic text-[#F1EBDF]/60 blur-[0.3px]" : "text-[#F1EBDF]"
                    }`}
                  >
                    {entry.title}
                  </h3>
                  {faded && (
                    <span className="shrink-0 rounded-full border border-dashed border-[#F1EBDF]/60 px-2 py-0.5 text-[11px] uppercase tracking-[0.12em] text-[#F1EBDF]">
                      {STRINGS.chronicle.uncertain}
                    </span>
                  )}
                </div>
                <p
                  className={`mt-1 font-serif text-[0.9rem] leading-normal ${
                    faded ? "text-[#F1EBDF]/55" : "text-[#F1EBDF]/90"
                  }`}
                >
                  {entry.summary}
                </p>
                {faded && <p className="mt-2 text-xs text-[#B9B4AA]">{STRINGS.chronicle.uncertainNote}</p>}
                {learned !== undefined && (
                  <p
                    data-testid="chronicle-entry-learned"
                    className="mt-2 border-l-2 border-[#E3A84E] pl-2.5 text-xs leading-relaxed text-[#E3A84E]"
                  >
                    {learned ? STRINGS.chronicle.learnedSurvives : STRINGS.chronicle.learnedFails}
                  </p>
                )}
                <a
                  href={entry.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex min-h-[1.75rem] items-center rounded text-xs text-[#B9B4AA] underline underline-offset-2 hover:text-[#F1EBDF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E3A84E]"
                >
                  {STRINGS.chronicle.source}
                  <span aria-hidden="true">&nbsp;↗</span>
                  <span className="sr-only"> {STRINGS.chronicle.sourceNewTab}</span>
                </a>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
