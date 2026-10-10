import "server-only";
import { fal } from "@fal-ai/client";
import { IMAGE_MODEL, IMAGE_TIMEOUT_MS, IMAGE_MAX_ATTEMPTS } from "@/constants";
import { piapiGenerate, PiapiError } from "./providers/piapi";

/**
 * Image generation via fal.ai (Flux 1 Schnell).
 */

fal.config({ credentials: process.env.FAL_KEY });

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

export function buildFluxPrompt(
  event: string,
  scenario: string,
  year: number
): string {
  const era = year < 0 ? `${Math.abs(year)} BC` : `${year} AD`;
  return [
    `Cinematic historical scene, ${era}.`,
    `Alternative timeline: ${scenario}.`,
    `Key element: ${event}.`,
    `Style: dramatic oil painting meets photorealism,`,
    `cinematic lighting, epic scale, highly detailed,`,
    `16:9 aspect ratio, no text, no watermarks.`,
  ].join(" ");
}

// ---------------------------------------------------------------------------
// Fallback placeholder selection
// ---------------------------------------------------------------------------

function getPlaceholderUrl(year: number): string {
  if (year < 500) return "/placeholder-ancient.jpg";
  if (year <= 1900) return "/placeholder-modern.jpg";
  return "/placeholder-future.jpg";
}

// ---------------------------------------------------------------------------
// fal.ai error classification
// ---------------------------------------------------------------------------

export class FalAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FalAuthError";
  }
}

/**
 * fal.ai can throw plain objects, fetch Responses, or non-standard values.
 * Normalise everything into a proper Error so every catch block works reliably.
 */
function normalizeFalError(err: unknown): Error {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes("401") ||
      msg.includes("402") ||
      msg.includes("403") ||
      msg.includes("unauthorized") ||
      msg.includes("forbidden") ||
      msg.includes("payment") ||
      msg.includes("billing") ||
      msg.includes("quota")
    ) {
      return new FalAuthError(err.message);
    }
    return err;
  }
  if (typeof err === "object" && err !== null) {
    const obj = err as Record<string, unknown>;
    const status = obj.status ?? obj.statusCode ?? obj.code;
    const detail =
      obj.message ?? obj.detail ?? obj.error ?? JSON.stringify(err);
    if (status === 401 || status === 402 || status === 403) {
      return new FalAuthError(String(detail));
    }
    return new Error(String(detail));
  }
  return new Error(String(err));
}

// ---------------------------------------------------------------------------
// Single Flux call with timeout
// ---------------------------------------------------------------------------

// PiAPI primary, fal fallback. Signature allows a width/height per T1 card;
// defaults match the existing scenario (16:9 scene) so other callers stay
// unchanged. PIAPI_KEY absent → PiAPI is never called. A billing-class failure
// from PiAPI (401/402/403 or "insufficient") that is NOT rescued by a
// subsequent fal success surfaces as the shared FalAuthError.
export async function callFlux(
  prompt: string,
  width: number = 1024,
  height: number = 576,
): Promise<string> {
  const piapiKey = process.env.PIAPI_KEY;
  let billingError: FalAuthError | undefined;

  if (piapiKey) {
    try {
      return await piapiGenerate({ prompt, width, height });
    } catch (err) {
      if (
        err instanceof PiapiError &&
        err.status != null &&
        (err.status === 401 || err.status === 402 || err.status === 403)
      ) {
        billingError = new FalAuthError(err.message);
      }
      // Fall through to fal on any PiAPI failure.
    }
  }

  const imageSize = height > width ? "portrait_4_3" : "landscape_16_9";
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("fal.ai timeout")), IMAGE_TIMEOUT_MS),
  );

  let result: unknown;
  try {
    result = await Promise.race([
      fal.subscribe(IMAGE_MODEL, {
        input: {
          prompt,
          image_size: imageSize,
          num_images: 1,
        },
      }),
      timeoutPromise,
    ]);
  } catch (err) {
    if (billingError) throw billingError;
    throw normalizeFalError(err);
  }

  const imageUrl = (result as { data: { images: { url: string }[] } }).data
    ?.images?.[0]?.url;
  if (!imageUrl) {
    if (billingError) throw billingError;
    throw new Error("No image returned from fal.ai");
  }

  return imageUrl;
}

// ---------------------------------------------------------------------------
// Public wrapper with retry + fallback
// ---------------------------------------------------------------------------

export async function generateScenarioImage(
  scenarioSummary: string,
  year: number,
  _style: string = "cinematic",
  event: string = ""
): Promise<string | { error: string; status: number }> {
  const prompt = event
    ? buildFluxPrompt(event, scenarioSummary, year)
    : buildFluxPrompt(scenarioSummary, scenarioSummary, year);

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= IMAGE_MAX_ATTEMPTS; attempt++) {
    try {
      return await callFlux(prompt);
    } catch (err) {
      const normalized = normalizeFalError(err);
      lastError = normalized;

      // Auth/billing errors won't be fixed by retrying — bail out immediately
      if (normalized instanceof FalAuthError) {
        console.error("[flux] auth/billing error, skipping retries:", normalized.message);
        return { error: "fal_auth", status: 402 };
      }

      console.warn(
        `[flux] attempt ${attempt}/${IMAGE_MAX_ATTEMPTS} failed:`,
        normalized.message
      );
    }
  }

  console.error(
    "[flux] all attempts failed, returning placeholder. Last error:",
    lastError?.message
  );


  return getPlaceholderUrl(year);
}
