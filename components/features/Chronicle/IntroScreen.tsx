"use client";

import styles from "./Chronicle.module.css";
import { STRINGS } from "./strings";

export default function IntroScreen({ onBegin }: { onBegin: () => void }) {
  return (
    <section
      data-testid="intro"
      className={`${styles.appear} flex flex-1 flex-col items-center justify-center px-2 text-center`}
    >
      <svg viewBox="0 0 48 60" width="44" height="55" aria-hidden="true" className={`${styles.flicker} mb-6`}>
        <path d="M4 4h30l10 10v42H4z" fill="none" stroke="#E3A84E" strokeWidth="1.5" />
        <path d="M34 4v10h10" fill="none" stroke="#E3A84E" strokeWidth="1.5" />
        <path d="M12 24h24M12 31h24M12 38h24M12 45h14" stroke="#E3A84E" strokeWidth="1.5" opacity="0.7" />
      </svg>
      <h1 className="font-serif text-7xl tracking-tight text-[#E3A84E]">{STRINGS.intro.year}</h1>
      <p className="mt-6 max-w-xs font-serif text-xl leading-snug text-[#F1EBDF]">{STRINGS.intro.lead}</p>
      <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#B9B4AA]">{STRINGS.intro.how}</p>
      <button
        type="button"
        data-testid="intro-begin"
        onClick={onBegin}
        className="mt-9 min-h-[3rem] rounded-xl border border-[#E3A84E] bg-[#E3A84E] px-10 text-sm font-semibold uppercase tracking-[0.2em] text-[#0a0a0f] hover:bg-[#f0b96a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F1EBDF]"
      >
        {STRINGS.intro.begin}
      </button>
    </section>
  );
}
