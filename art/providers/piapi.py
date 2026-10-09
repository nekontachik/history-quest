"""
piapi -- Flux via PiAPI for ref2game gen.py (Time Machine adaptation). Cheap test generations.
Docs: https://piapi.ai/docs/flux-api/text-to-image (create task), https://piapi.ai/docs/flux-api/get-task (poll)
  [verified 2026-10-09 by WebFetch + real runs: ~85 images through these exact calls]
"""
from gen import GenError, download, dry_note, env_key, http_json, poll, say

API_BASE = "https://api.piapi.ai/api/v1"
ENV = ["PIAPI_KEY"]

CAPS = {
    "native_alpha": False,          # full-bleed art only, no alpha in this project
    "max_refs": 0,                  # txt2img: no reference images
    "sizes": "any",                 # width/height in pixels (multiples of 64 used: 768x1024, 1024x576, 1024x1024)
    "edit": False,
    "env": ENV,
    "default_model": "Qubico/flux1-schnell",
    "labels": False,                # no "Image N =" lines (no refs)
    "style_bible": True,            # style bible is the SHORT preset (<=40 words) - keep total prompt < ~70 words
    "max_prompt": 600,              # chars; Flux Schnell drops the tail of long prompts (~256 tokens)
}


def _auth(dry_run):
    return {"x-api-key": env_key(*ENV, dry_run=dry_run), "Content-Type": "application/json"}


def generate(prompt, refs, size, transparent, model, out_raw, opts, dry_run):
    model = model or CAPS["default_model"]
    body = {"model": model, "task_type": "txt2img",
            "input": {"prompt": prompt, "width": int(size[0]), "height": int(size[1])}}
    body["input"].update(opts.get("params") or {})
    r = http_json("POST", f"{API_BASE}/task", body, _auth(dry_run), dry_run=dry_run)
    if dry_run:
        dry_note(f"then polls GET {API_BASE}/task/<task_id> until status completed/success")
        return {"dry_run": True}
    task_id = (r.json.get("data") or {}).get("task_id")
    if not task_id:
        raise GenError(f"no task_id: {str(r.json)[:400]}")
    say(f"task {task_id} submitted", name=opts.get("_name"))

    def check():
        d = http_json("GET", f"{API_BASE}/task/{task_id}", None, _auth(False)).json.get("data") or {}
        st = str(d.get("status", "")).lower()
        if st in ("completed", "success"):
            return d
        if st == "failed":
            raise GenError(f"task {task_id} failed: {str(d.get('error'))[:400]}")
        return None

    d = poll(check, timeout=float(opts.get("timeout", 300)), label=f"task {task_id}")
    out = d.get("output") or {}
    url = out.get("image_url") or (out.get("image_urls") or [None])[0]
    if not url:
        raise GenError(f"task {task_id}: no image_url in {str(out)[:300]}")
    return {"path": download(url, out_raw), "native_alpha": False, "request_id": task_id, "model": model}
