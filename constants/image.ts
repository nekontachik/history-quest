// ---------------------------------------------------------------------------
// Chrono Agent — frozen image prompt constants.
// Source of truth: docs/game/ART_DIRECTION.md §2 (verbatim).
// Changing STYLE_VERSION invalidates every cached blob (lib/infrastructure/image-store.ts).
// ---------------------------------------------------------------------------

/** Bumping this invalidates all persisted image keys. ART_DIRECTION §1 header. */
export const STYLE_VERSION = "v1";

/**
 * Character card, 3:4 → 768×1024.
 * Copied VERBATIM from ART_DIRECTION §2 fenced block.
 */
export const STYLE_PORTRAIT =
  "Steel engraving, bold black ink outlines, dense cross-hatching, monochrome amber and black only. Close-up head-and-shoulders portrait, centred. Dramatic chiaroscuro: a single warm light from below lights the face, dark hatched background fading to black on every edge. Realistic human anatomy.";

/**
 * Scenario image / unique scene, 16:9 → 1024×576.
 * Copied VERBATIM from ART_DIRECTION §2 fenced block.
 */
export const STYLE_SCENE =
  "Steel engraving, bold black ink outlines, dense cross-hatching, monochrome amber and black only. Wide cinematic composition, low camera angle, small human figures against monumental architecture or landscape, atmospheric haze. A single warm light source, the rest falling into black, rendered edge to edge.";

/**
 * Artifact cover, 3:4 → 768×1024.
 * Copied VERBATIM from ART_DIRECTION §2 fenced block.
 */
export const STYLE_ARTIFACT =
  "Steel engraving printed in metallic gold ink on deep navy-black, bold outlines, fine cross-hatching, symbolic centred composition like an antique book frontispiece, high contrast, rendered edge to edge.";

/** Appended to every prompt. Copied VERBATIM from ART_DIRECTION §2 TAIL block. */
export const STYLE_TAIL = "No text, no signature, no border, full-bleed.";

/**
 * Image sizes per ART_DIRECTION §6. PiAPI takes width/height in pixels;
 * the fal fallback maps them to `portrait_4_3` / `landscape_16_9` (T1).
 */
export const IMAGE_SIZES = {
  portrait: { w: 768, h: 1024 },
  scene: { w: 1024, h: 576 },
  artifact: { w: 768, h: 1024 },
} as const;

/** Flux Schnell silently truncates past ~256 tokens. ART_DIRECTION §3 rule 1. */
export const PROMPT_MAX_CHARS = 600;

/** Learned-the-hard-way blocklist. ART_DIRECTION §3 rule 8. */
export const FORBIDDEN_PROMPT_WORDS = [
  "fantasy",
  "gothic",
  "game",
  "monster",
  "elf",
  "orc",
  "smoke",
  "candle",
  "torch",
  "paper",
  "ears",
] as const;
