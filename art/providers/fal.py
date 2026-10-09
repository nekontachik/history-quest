"""
fal -- Flux Schnell via fal.ai for ref2game gen.py (Time Machine adaptation). SAME endpoint/model as production
(lib/ai/image.ts uses fal-ai/flux/schnell), so pool images match what players see.
Sync endpoint: POST https://fal.run/fal-ai/flux/schnell, header "Authorization: Key $FAL_KEY",
body {prompt, image_size:{width,height}, num_images, seed?}; response {images:[{url,...}], seed}.
  [UNVERIFIED against current docs in this session - run `gen.py one probe ... --provider fal --dry-run`,
   then one real call, and fix via opts.params if a field differs. https://fal.ai/models/fal-ai/flux/schnell/api]
"""
from gen import GenError, download, env_key, http_json

API_BASE = "https://fal.run"
ENV = ["FAL_KEY"]

CAPS = {
    "native_alpha": False,
    "max_refs": 0,
    "sizes": "any",
    "edit": False,
    "env": ENV,
    "default_model": "fal-ai/flux/schnell",
    "labels": False,
    "style_bible": True,
    "max_prompt": 600,
}


def generate(prompt, refs, size, transparent, model, out_raw, opts, dry_run):
    model = model or CAPS["default_model"]
    body = {"prompt": prompt, "image_size": {"width": int(size[0]), "height": int(size[1])}, "num_images": 1}
    if opts.get("seed") is not None:
        body["seed"] = opts["seed"]
    body.update(opts.get("params") or {})
    headers = {"Authorization": "Key " + env_key(*ENV, dry_run=dry_run), "Content-Type": "application/json"}
    r = http_json("POST", f"{API_BASE}/{model}", body, headers,
                  timeout=float(opts.get("timeout", 120)), dry_run=dry_run)
    if dry_run:
        return {"dry_run": True}
    imgs = r.json.get("images") or []
    if not imgs or not imgs[0].get("url"):
        raise GenError(f"no image in response: {str(r.json)[:400]}")
    return {"path": download(imgs[0]["url"], out_raw), "native_alpha": False,
            "request_id": r.header("x-fal-request-id"), "model": model}
