# ADR 006 — PiAPI as primary image provider, fal as fallback

Date: 2026-10-09
Status: Accepted
Scope: image generation for scenario covers, character portraits, scene art, artifact covers.

## Decision

Image generation goes through PiAPI (`Qubico/flux1-schnell`) first and falls back to fal.ai (`fal-ai/flux/schnell`) on any PiAPI failure. When `PIAPI_KEY` is not configured, fal is used directly.

## Context

- Flux 1 Schnell is the locked style target (see `docs/game/ART_DIRECTION.md`, STYLE_VERSION `v1`). Both providers run the same model.
- PiAPI charges $0.0015/image; fal.ai charges roughly $0.003/image. Phase-1 seed alone generates ~150 pool portraits plus every scene and artifact cover — half-price on the primary path matters.
- During the style tests (~85 images in `art/providers/piapi.py`) PiAPI returned the same output quality as fal and surfaced create/poll shapes we can mock deterministically (`data.task_id`, `data.status`, `data.output.image_url`).
- Phase-1 also introduces a vision QA re-roll loop (T5). Re-rolls amplify cost, so the primary provider must be the cheaper one.

## Fallback trigger

Any failure from PiAPI falls through to fal:

- HTTP non-2xx or network error on create or poll.
- `data.status === "failed"`.
- Overall timeout (`IMAGE_TIMEOUT_MS = 60_000` ms) elapsing while the task is still pending.
- Missing `image_url` / `image_urls[0]` after a `completed`/`success` status.

Billing/auth failures (401/402/403, or a body containing `"insufficient"`) are classified as billing-class. The provider call still falls back to fal — but if fal also fails, callers receive the shared `FalAuthError` instead of the fal error, so an exhausted PiAPI credit remains visible instead of being masked by a transient fal problem.

## Environment

- `PIAPI_KEY` — primary; absent → PiAPI is never called.
- `FAL_KEY` — required (fallback + video).

## Risks

- Doubled failure modes: a request can touch two upstreams and fail in two different ways. Mitigation: all errors normalise through the existing `FalAuthError` / `Error` surface; callers (`generateScenarioImage`, future `generateImage` in I1) keep their existing retry/placeholder behaviour.
- Request-shape drift: PiAPI's input shape (`model`, `task_type`, `input.width/height`) is pinned by committed fixtures (`tests/fixtures/game/piapi.*.json`) and asserted by the T1 acceptance test. Shape changes in the API will surface as test failures, not silent payload mismatches.
- Added latency when PiAPI fails: in the worst case a request spends `IMAGE_TIMEOUT_MS` on PiAPI before falling back. Acceptable at phase 1 (seed + ad-hoc generation).

## Alternatives considered

- fal-only (status quo). Rejected on cost (~2× per image for a batch-heavy phase 1).
- PiAPI-only. Rejected: single-vendor exposure on a new API, no fallback for outages.
- Replicate / Together. Rejected: higher price point and no advantage over fal for the Schnell model.

## Links

- `art/providers/piapi.py` — reference shape for the create + poll calls.
- `lib/ai/providers/piapi.ts` — primary implementation.
- `lib/ai/image.ts` — `callFlux` dispatch.
- `tests/game/T1.test.ts` — acceptance tests.
