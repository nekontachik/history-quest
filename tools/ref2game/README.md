# tools/ref2game

Scripts copied from https://github.com/studioigor/ref2game (`claude/scripts`, MIT — see LICENSE), used only for the
image-generation pipeline (`gen.py`, `sheet.py`, etc.). The WebGL engine, rigs and templates are not used.
Time Machine adapter lives at the repo root: `ref2game.json`, `art/style_*.txt`, `art/providers/{piapi,fal}.py`,
`art/prompts/regression.json`. Rules: `docs/game/ART_DIRECTION.md`.

Run from the repo root:
    python3 tools/ref2game/gen.py check
    python3 tools/ref2game/gen.py batch art/prompts/regression.json --jobs 4 --no-style-ref
