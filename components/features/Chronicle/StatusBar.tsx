"use client";

import type { EntryState, Meter } from "@/types/game";
import { STRINGS, type BarMeter, type Direction } from "./strings";

const BAR_METERS: readonly BarMeter[] = ["people", "power", "faith"];

/** Presentation only: which of the five wordings describes a bar this full. */
function levelIndex(value: number): number {
  if (value < 15) return 0;
  if (value < 40) return 1;
  if (value <= 60) return 2;
  if (value <= 85) return 3;
  return 4;
}

function Marker({ direction }: { direction: Direction | undefined }) {
  return (
    <span aria-hidden="true" className="inline-block w-3 text-center text-[10px] leading-none text-[#F1EBDF]">
      {direction ? STRINGS.directionGlyph[direction] : ""}
    </span>
  );
}

function MeterBar({ meter, value, direction }: { meter: BarMeter; value: number; direction?: Direction }) {
  const label = STRINGS.meterLabel[meter];
  const level = levelIndex(value);
  const atEdge = level === 0 || level === STRINGS.meterLevels.length - 1;
  const name = STRINGS.meterName(label, STRINGS.meterLevels[level]);
  return (
    <div role="img" aria-label={direction ? `${name}; ${STRINGS.direction[direction]}` : name}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#B9B4AA]">{label}</span>
        <Marker direction={direction} />
      </div>
      <div
        className={`mt-1 h-1.5 overflow-hidden rounded-full bg-white/10 ${
          direction ? "ring-1 ring-[#E3A84E]/70" : ""
        }`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${
            atEdge ? "bg-[#E36B5B]" : "bg-[#E3A84E]"
          }`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function ChronicleMark({ state }: { state: EntryState }) {
  const clear = state === "clear";
  return (
    <svg
      data-testid="chronicle-mark"
      data-state={state}
      viewBox="0 0 12 16"
      width="12"
      height="16"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M1.5 1.5h6l3 3v10h-9z"
        fill={clear ? "#E3A84E" : "none"}
        stroke={clear ? "#E3A84E" : "#B9B4AA"}
        strokeWidth="1"
        strokeDasharray={clear ? undefined : "1.6 1.6"}
        opacity={clear ? 1 : 0.6}
      />
      {clear && <path d="M3.5 7h5M3.5 9.5h5M3.5 12h3" stroke="#0a0a0f" strokeWidth="1" />}
    </svg>
  );
}

interface Props {
  meters: Record<Meter, number>;
  /** Entry states in deck order. */
  entryStates: EntryState[];
  /** Sign of the previewed option's effects; absent meters are untouched. */
  directions: Partial<Record<Meter, Direction>>;
  onOpenChronicle: () => void;
  /** 1-based position in the deck, or null when no card is on the table. */
  progress: { current: number; total: number } | null;
}

export default function StatusBar({ meters, entryStates, directions, onOpenChronicle, progress }: Props) {
  const fadedCount = entryStates.filter((state) => state === "faded").length;
  const clearCount = entryStates.length - fadedCount;
  const stabilityDirection = directions.stability;
  const marksName = STRINGS.chronicle.marksName(clearCount, fadedCount);

  return (
    <header className="shrink-0">
      <div className="grid grid-cols-3 gap-4">
        {BAR_METERS.map((meter) => (
          <MeterBar key={meter} meter={meter} value={meters[meter]} direction={directions[meter]} />
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <button
          type="button"
          data-testid="chronicle-open"
          onClick={onOpenChronicle}
          aria-haspopup="dialog"
          aria-label={
            stabilityDirection
              ? `${marksName} ${STRINGS.chronicle.stabilityDirection[stabilityDirection]}`
              : marksName
          }
          className={`-ml-2 flex min-h-[2.5rem] items-center gap-2 rounded-lg px-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#E3A84E] transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E3A84E] ${
            stabilityDirection ? "bg-white/5" : ""
          }`}
        >
          <span className="underline decoration-[#E3A84E]/40 underline-offset-4">{STRINGS.chronicle.button}</span>
          <span className="flex items-center gap-1">
            {entryStates.map((state, index) => (
              <ChronicleMark key={index} state={state} />
            ))}
          </span>
          <Marker direction={stabilityDirection} />
        </button>

        {progress && (
          <div className="flex items-center gap-1" data-testid="progress">
            <span className="sr-only">{STRINGS.card.progress(progress.current, progress.total)}</span>
            {Array.from({ length: progress.total }, (_, index) => (
              <span
                key={index}
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${
                  index + 1 < progress.current
                    ? "bg-[#B9B4AA]/70"
                    : index + 1 === progress.current
                      ? "bg-[#E3A84E] ring-2 ring-[#E3A84E]/30"
                      : "border border-[#B9B4AA]/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
