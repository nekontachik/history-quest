import "server-only";

// ---------------------------------------------------------------------------
// PiAPI Flux Schnell provider — primary image backend (T1).
// Docs: https://piapi.ai/docs/flux-api/text-to-image + /get-task
// Shape verified against art/providers/piapi.py and tests/fixtures/game/piapi.*.json.
// Pricing & rationale: docs/adr/006-piapi-over-fal.md.
// ---------------------------------------------------------------------------

const API_BASE = "https://api.piapi.ai/api/v1";
const PIAPI_MODEL = "Qubico/flux1-schnell";
const PIAPI_TASK_TYPE = "txt2img";

/** Interval between poll calls while a task is pending. */
export const PIAPI_POLL_INTERVAL_MS = 2_000;

/** Overall timeout for one PiAPI generation attempt (create + poll). */
export const IMAGE_TIMEOUT_MS = 60_000;

export class PiapiError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "PiapiError";
    this.status = status;
  }
}

export class PiapiTimeoutError extends PiapiError {
  constructor(message: string) {
    super(message);
    this.name = "PiapiTimeoutError";
  }
}

type PiapiTaskStatus = "pending" | "processing" | "completed" | "success" | "failed";

interface PiapiTaskData {
  task_id?: string;
  status?: string;
  error?: unknown;
  output?: {
    image_url?: string;
    image_urls?: string[];
  };
}

interface PiapiEnvelope {
  code?: number;
  message?: string;
  data?: PiapiTaskData | null;
}

interface PiapiGenerateOptions {
  prompt: string;
  width: number;
  height: number;
  /** Overridable for tests. */
  signal?: AbortSignal;
}

/** Low-level HTTP helper. Isolated so vi.mock(global.fetch) in tests works cleanly. */
async function piapiFetch(
  path: string,
  init: RequestInit,
): Promise<{ status: number; body: PiapiEnvelope; raw: string }> {
  const apiKey = process.env.PIAPI_KEY;
  if (!apiKey) {
    throw new PiapiError("PIAPI_KEY is not set", 401);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const raw = await res.text();
  let body: PiapiEnvelope = {};
  if (raw.length > 0) {
    try {
      body = JSON.parse(raw) as PiapiEnvelope;
    } catch {
      body = {};
    }
  }

  if (res.status === 401 || res.status === 402 || res.status === 403) {
    throw new PiapiError(
      `piapi auth/billing error ${res.status}: ${raw.slice(0, 400)}`,
      res.status,
    );
  }

  if (raw.toLowerCase().includes("insufficient")) {
    throw new PiapiError(`piapi insufficient balance: ${raw.slice(0, 400)}`, 402);
  }

  if (!res.ok) {
    throw new PiapiError(
      `piapi http ${res.status}: ${raw.slice(0, 400)}`,
      res.status,
    );
  }

  return { status: res.status, body, raw };
}

/** Sleep that aborts when the deadline elapses. */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a PiAPI txt2img task and poll until it completes.
 * Returns the final image URL. Throws PiapiError on failure / billing /
 * timeout. Caller (`callFlux`) decides whether to fall back to fal.
 */
export async function piapiGenerate(opts: PiapiGenerateOptions): Promise<string> {
  const { prompt, width, height } = opts;
  const started = Date.now();

  const createBody = {
    model: PIAPI_MODEL,
    task_type: PIAPI_TASK_TYPE,
    input: {
      prompt,
      width,
      height,
    },
  };

  const created = await piapiFetch("/task", {
    method: "POST",
    body: JSON.stringify(createBody),
  });

  const taskId = created.body.data?.task_id;
  if (!taskId) {
    throw new PiapiError(
      `piapi create: no task_id in response: ${created.raw.slice(0, 400)}`,
    );
  }

  // Poll loop.
  // Spec: every 2000 ms; completed/success → return url; failed → throw;
  // pending → continue; overall timeout → throw PiapiTimeoutError.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() - started >= IMAGE_TIMEOUT_MS) {
      throw new PiapiTimeoutError(
        `piapi task ${taskId} timed out after ${IMAGE_TIMEOUT_MS}ms`,
      );
    }

    await wait(PIAPI_POLL_INTERVAL_MS);

    const polled = await piapiFetch(`/task/${taskId}`, { method: "GET" });
    const data = polled.body.data ?? {};
    const status = String(data.status ?? "").toLowerCase() as PiapiTaskStatus;

    if (status === "completed" || status === "success") {
      const url =
        data.output?.image_url ??
        (data.output?.image_urls && data.output.image_urls[0]) ??
        undefined;
      if (!url) {
        throw new PiapiError(
          `piapi task ${taskId}: no image_url in output`,
        );
      }
      return url;
    }

    if (status === "failed") {
      const detail =
        typeof data.error === "string"
          ? data.error
          : JSON.stringify(data.error ?? {});
      throw new PiapiError(`piapi task ${taskId} failed: ${detail}`);
    }

    // "pending" (or "processing") → loop and poll again.
  }
}
