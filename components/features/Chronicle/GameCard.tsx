"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Card, Side } from "@/types/game";
import styles from "./Chronicle.module.css";
import { STRINGS } from "./strings";

/** Horizontal travel, in CSS pixels, after which releasing the card commits the choice. */
const COMMIT_DISTANCE = 84;
/** Travel after which the drag starts previewing a side. */
const PREVIEW_DISTANCE = 14;
const TILT_DEG_PER_PX = 0.045;

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E3A84E]";

interface Props {
  card: Card;
  preview: Side | null;
  onPreview: (side: Side | null) => void;
  onChoose: (side: Side) => void;
  onCheckChronicle: () => void;
  reducedMotion: boolean;
}

function sideOf(dx: number, distance: number): Side | null {
  if (dx <= -distance) return "left";
  if (dx >= distance) return "right";
  return null;
}

export default function GameCard({ card, preview, onPreview, onChoose, onCheckChronicle, reducedMotion }: Props) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [portraitFailed, setPortraitFailed] = useState(false);
  const startX = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  // A new card takes focus so keyboard and screen-reader users land on it.
  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, []);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button, a")) return;
    startX.current = event.clientX;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const next = event.clientX - startX.current;
    setDx(next);
    onPreview(sideOf(next, PREVIEW_DISTANCE));
  }

  function endDrag(commit: boolean) {
    if (!dragging) return;
    const side = commit ? sideOf(dx, COMMIT_DISTANCE) : null;
    setDragging(false);
    setDx(0);
    onPreview(null);
    if (side) onChoose(side);
  }

  const dragSide = dragging ? sideOf(dx, PREVIEW_DISTANCE) : null;
  const pull = Math.min(1, Math.abs(dx) / COMMIT_DISTANCE);
  const transform =
    reducedMotion || dx === 0 ? undefined : `translateX(${dx}px) rotate(${dx * TILT_DEG_PER_PX}deg)`;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div
          ref={cardRef}
          tabIndex={-1}
          role="group"
          aria-label={STRINGS.card.name(card.speakerName)}
          data-testid="card"
          data-card-id={card.id}
          data-kind={card.kind}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={() => endDrag(true)}
          onPointerCancel={() => endDrag(false)}
          style={{
            transform,
            transition: dragging || reducedMotion ? "none" : "transform 0.22s ease-out",
            touchAction: "pan-y",
          }}
          className={`${styles.cardIn} relative aspect-[3/4] max-h-full w-full cursor-grab select-none overflow-hidden rounded-2xl border border-[#E3A84E]/35 bg-[#0d0d12] shadow-[0_0_40px_-12px_rgba(227,168,78,0.35)] outline-none active:cursor-grabbing ${FOCUS_RING}`}
        >
          {!portraitFailed && (
            // eslint-disable-next-line @next/next/no-img-element -- static local portrait; no optimizer round-trip wanted
            <img
              src={`/cast/1648/${card.roleId}.webp`}
              alt={STRINGS.card.portraitAlt(card.speakerName)}
              width={640}
              height={853}
              draggable={false}
              onError={() => setPortraitFailed(true)}
              className={`${styles.flicker} absolute inset-0 h-full w-full scale-[1.12] object-cover`}
            />
          )}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#07070a] via-[#07070a]/85 via-45% to-transparent to-75%"
          />

          {card.kind === "trace" && (
            <button
              type="button"
              data-testid="chronicle-check"
              onClick={onCheckChronicle}
              aria-haspopup="dialog"
              className={`absolute right-3 top-3 flex min-h-[2.5rem] items-center gap-1.5 rounded-full border border-[#E3A84E]/70 bg-[#07070a]/85 px-3.5 text-xs font-medium uppercase tracking-[0.12em] text-[#E3A84E] backdrop-blur-sm hover:bg-[#E3A84E]/15 ${FOCUS_RING}`}
            >
              <svg viewBox="0 0 12 16" width="10" height="14" aria-hidden="true">
                <path d="M1.5 1.5h6l3 3v10h-9z" fill="none" stroke="currentColor" strokeWidth="1.2" />
                <path d="M3.5 7h5M3.5 9.5h5M3.5 12h3" stroke="currentColor" strokeWidth="1" />
              </svg>
              {STRINGS.chronicle.checkFromCard}
            </button>
          )}

          {dragSide && (
            <p
              aria-hidden="true"
              style={{ opacity: 0.4 + pull * 0.6 }}
              className={`absolute top-3 max-w-[70%] rounded-lg border border-[#E3A84E] bg-[#07070a]/90 px-3 py-1.5 text-sm font-medium text-[#F1EBDF] ${
                dragSide === "left" ? "right-3 text-right" : "left-3 text-left"
              } ${card.kind === "trace" ? "mt-12" : ""}`}
            >
              {card[dragSide].label}
            </p>
          )}

          <div className="absolute inset-x-0 bottom-0 px-4 pb-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#E3A84E]">{card.speakerName}</p>
            <p className="mt-1.5 font-serif text-[1.02rem] leading-[1.34] text-[#F1EBDF]">“{card.line}”</p>
          </div>
        </div>
      </div>

      <div role="group" aria-label={STRINGS.card.choicesLabel} className="grid shrink-0 grid-cols-2 gap-2.5">
        {(["left", "right"] as const).map((side) => (
          <button
            key={side}
            type="button"
            data-testid={`choice-${side}`}
            aria-keyshortcuts={side === "left" ? "ArrowLeft" : "ArrowRight"}
            onClick={() => onChoose(side)}
            onMouseEnter={() => onPreview(side)}
            onMouseLeave={() => onPreview(null)}
            onFocus={() => onPreview(side)}
            onBlur={() => onPreview(null)}
            className={`flex min-h-[4.25rem] flex-col justify-center gap-0.5 rounded-xl border px-3 py-2 text-[0.82rem] leading-tight text-[#F1EBDF] transition-colors ${
              side === "left" ? "items-start text-left" : "items-end text-right"
            } ${
              preview === side
                ? "border-[#E3A84E] bg-[#E3A84E]/15"
                : "border-[#E3A84E]/40 bg-white/[0.03] hover:border-[#E3A84E]"
            } ${FOCUS_RING}`}
          >
            <span aria-hidden="true" className="text-sm leading-none text-[#E3A84E]">
              {side === "left" ? "←" : "→"}
            </span>
            <span>{card[side].label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
