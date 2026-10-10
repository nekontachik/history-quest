// ---------------------------------------------------------------------------
// Chrono Agent — image prompt builders (T5).
// PURE, CLIENT-SAFE: no `import "server-only"`, no Node-only APIs, no I/O.
// Only pure string manipulation + imports from constants/image.ts and types.
//
// The only way image prompts are built. ART_DIRECTION.md §2–3 is the source
// of truth; the shape here is enforced by `shared/game/image-prompts` tests
// (tests/game/T5.test.ts) and is consumed by lib/ai/image.ts via I1.
// ---------------------------------------------------------------------------

import {
  FORBIDDEN_PROMPT_WORDS,
  PROMPT_MAX_CHARS,
  STYLE_ARTIFACT,
  STYLE_PORTRAIT,
  STYLE_SCENE,
  STYLE_TAIL,
} from "@/constants/image";
import type { ImageKind } from "@/types/game";

/**
 * Thrown by `buildImagePrompt` when the final string would exceed
 * `PROMPT_MAX_CHARS`. Flux Schnell silently truncates past ~256 tokens
 * (ART_DIRECTION §3 rule 1), so a hard limit is required.
 */
export class PromptTooLongError extends Error {
  readonly length: number;
  readonly limit: number;
  constructor(length: number, limit: number) {
    super(
      `Image prompt is ${length} chars, exceeds PROMPT_MAX_CHARS=${limit}`,
    );
    this.name = "PromptTooLongError";
    this.length = length;
    this.limit = limit;
  }
}

const PRESETS: Record<ImageKind, string> = {
  portrait: STYLE_PORTRAIT,
  scene: STYLE_SCENE,
  artifact: STYLE_ARTIFACT,
};

/**
 * Strip every member of `FORBIDDEN_PROMPT_WORDS` from `subject` using
 * case-insensitive whole-word matches, then collapse any double spaces.
 *
 * Whole-word means the match is bounded on both sides by a non-letter
 * character (we treat `[a-z]` as the word alphabet — matches `\b` for
 * ASCII, and importantly keeps substrings like "yearning" intact when
 * removing "ears" would be wrong). The regex is built once per call so
 * the function stays pure.
 */
function stripForbiddenWords(subject: string): string {
  let out = subject;
  for (const word of FORBIDDEN_PROMPT_WORDS) {
    // Escape just in case a future addition contains regex metacharacters.
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|[^a-z])${escaped}(?=[^a-z]|$)`, "gi");
    out = out.replace(pattern, (_match, lead: string) => lead);
  }
  // Collapse runs of whitespace that the removals left behind.
  return out.replace(/\s{2,}/g, " ").trim();
}

/**
 * Build an image prompt in the one shape ART_DIRECTION §2 permits:
 *   `${preset} ${cleanedSubject} ${STYLE_TAIL}`
 * Preset FIRST, tail LAST (ART_DIRECTION §3 bullet 2). Throws
 * `PromptTooLongError` when the final string exceeds `PROMPT_MAX_CHARS`.
 */
export function buildImagePrompt(kind: ImageKind, subject: string): string {
  const preset = PRESETS[kind];
  const cleaned = stripForbiddenWords(subject);
  const final = `${preset} ${cleaned} ${STYLE_TAIL}`;
  if (final.length > PROMPT_MAX_CHARS) {
    throw new PromptTooLongError(final.length, PROMPT_MAX_CHARS);
  }
  return final;
}

/**
 * English, DIGIT-FREE phrase describing the era of `year`. Numbers in a Flux
 * prompt render as text in the image (ART_DIRECTION §3 rule 5), so this is
 * the only legal way to put era information into a scenario prompt.
 *
 * Year ranges mirror `ERAS` in constants/game.ts exactly:
 *   ancient      [-3000, 499]   → "ancient classical period"
 *   medieval     [500,   1499]  → "medieval period"
 *   early_modern [1500,  1799]  → "early modern period"
 *   industrial   [1800,  1913]  → "industrial age"
 *   modern       [1914,  2024]  → "modern era"
 *
 * Years outside the known range fall back to the nearest edge (older →
 * ancient, newer → modern) so callers never need to guard the input.
 */
export function eraWords(year: number): string {
  if (year <= 499) return "ancient classical period";
  if (year <= 1499) return "medieval period";
  if (year <= 1799) return "early modern period";
  if (year <= 1913) return "industrial age";
  return "modern era";
}
