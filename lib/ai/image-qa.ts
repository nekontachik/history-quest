import "server-only";

// ---------------------------------------------------------------------------
// Chrono Agent — image QA checklist (T5).
//
// After every generated image we ask a vision model to fill a fixed JSON
// checklist. The caller (I1) re-rolls on `ok: false`, up to 3 attempts.
// ART_DIRECTION §4 ("Known Flux Schnell behaviours and the required QA gate")
// is the source of truth.
//
// Fail-open policy: any error — parse, network, zod — becomes
// `{ skipped: true }` so a flaky QA service cannot block an otherwise usable
// image.
// ---------------------------------------------------------------------------

import OpenAI from "openai";
import { z } from "zod";

import { EVENTS_MODEL } from "@/constants";

/**
 * Vision model goes through the same OpenRouter configuration as
 * `lib/ai/text.ts`: same package, same base URL, same env var, same model
 * identifier that file already names (`EVENTS_MODEL`, i.e. Gemini Flash).
 * No new model name is hardcoded here. The client is built lazily so a
 * module-time import never fails when `OPENROUTER_API_KEY` is absent
 * (openai@6 throws from the constructor).
 */
let cachedClient: OpenAI | null = null;
function openrouter(): OpenAI {
  if (!cachedClient) {
    cachedClient = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }
  return cachedClient;
}

const QA_CHECKLIST_SCHEMA = z.object({
  hasText: z.boolean(),
  hasBorder: z.boolean(),
  nonHumanFeatures: z.boolean(),
  objectVisible: z.boolean(),
  emotionMatches: z.boolean(),
});

export type QaChecks = z.infer<typeof QA_CHECKLIST_SCHEMA>;

export type QaResult =
  | { ok: boolean; checks: QaChecks; skipped?: never }
  | { skipped: true };

interface CheckImageOptions {
  object: string;
  emotion: string;
}

function buildQaMessages(url: string, opts: CheckImageOptions) {
  return [
    {
      role: "system" as const,
      content:
        'You audit a generated steel-engraving image against a fixed checklist. Return only valid JSON with exactly these five boolean keys: "hasText", "hasBorder", "nonHumanFeatures", "objectVisible", "emotionMatches". No prose, no markdown fences, no extra keys.',
    },
    {
      role: "user" as const,
      content: [
        {
          type: "text" as const,
          text: `Audit this image.
- hasText: true if ANY letters, numbers, signatures or watermarks appear anywhere in the image.
- hasBorder: true if the image has a visible frame, border, print mat or empty margin on any side.
- nonHumanFeatures: true if the central figure shows non-human anatomy (pointy ears, fangs, horns, extra fingers, etc.).
- objectVisible: true if "${opts.object}" is clearly visible, held or shown by the figure.
- emotionMatches: true if the figure's facial expression clearly conveys "${opts.emotion}".
Reply with ONLY the JSON object.`,
        },
        {
          type: "image_url" as const,
          image_url: { url },
        },
      ],
    },
  ];
}

function stripFences(text: string): string {
  return text.replace(/```json\n?|\n?```/g, "").trim();
}

/**
 * Run the five-boolean QA checklist against `url`. Returns `{ skipped: true }`
 * on any failure (network, non-JSON reply, schema mismatch) — fail-open.
 */
export async function checkImage(
  url: string,
  opts: CheckImageOptions,
): Promise<QaResult> {
  let raw: string;
  try {
    const response = await openrouter().chat.completions.create({
      model: EVENTS_MODEL,
      max_tokens: 200,
      messages: buildQaMessages(url, opts),
    });
    const content = response.choices[0]?.message?.content;
    if (typeof content !== "string" || content.length === 0) {
      return { skipped: true };
    }
    raw = content;
  } catch {
    return { skipped: true };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(stripFences(raw));
  } catch {
    return { skipped: true };
  }

  const result = QA_CHECKLIST_SCHEMA.safeParse(parsedJson);
  if (!result.success) {
    return { skipped: true };
  }

  const checks = result.data;
  const ok =
    !checks.hasText &&
    !checks.hasBorder &&
    !checks.nonHumanFeatures &&
    checks.objectVisible &&
    checks.emotionMatches;

  return { ok, checks };
}
