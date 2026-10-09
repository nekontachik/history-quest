# Time Machine — Art Direction (STYLE_VERSION = "v1")

Status: 2026-10-09, after 12 test rounds (~85 images) on Flux 1 Schnell. Applies to the WHOLE product: game cards, scenario images, artifacts.
Model: Flux 1 Schnell via **PiAPI** (`Qubico/flux1-schnell`, txt2img, $0.0015/image — half of fal). All style tests ran through these exact PiAPI calls. fal.ai (`fal-ai/flux/schnell`, same model) stays only as an automatic fallback when PiAPI fails; Kling video stays on fal.
The portrait preset below is LOCKED (test round f7, 6 characters): 6/6 clean palette, no text, no border, full-bleed, centred; 6/6 readable emotion; 5/6 object visible; 1/6 slightly pointy ears. Remaining defects are handled by the QA gate (§4). Re-run the regression set (§7) once through the production pipeline as the first step of implementation.

## 1. Look in one sentence
Graphic close-up steel engraving: bold black ink outlines and dense cross-hatching, monochrome amber and black, one warm light from below on a face carrying a strong emotion. The emotion is the subject.

References: Darkest Dungeon (ink line, grimness), Joseph Wright of Derby & Rembrandt etchings (single warm light), Greig Fraser / Dune (scene composition and scale).

## 2. Prompt presets (exact text — constants in code)

STYLE_PORTRAIT (character card, 3:4 → 768×1024):
```
Steel engraving, bold black ink outlines, dense cross-hatching, monochrome amber and black only. Close-up head-and-shoulders portrait, centred. Dramatic chiaroscuro: a single warm light from below lights the face, dark hatched background fading to black on every edge. Realistic human anatomy.
```

STYLE_SCENE (scenario image / unique scene, 16:9 → 1024×576):
```
Steel engraving, bold black ink outlines, dense cross-hatching, monochrome amber and black only. Wide cinematic composition, low camera angle, small human figures against monumental architecture or landscape, atmospheric haze. A single warm light source, the rest falling into black, rendered edge to edge.
```

STYLE_ARTIFACT (artifact cover, 3:4 → 768×1024):
```
Steel engraving printed in metallic gold ink on deep navy-black, bold outlines, fine cross-hatching, symbolic centred composition like an antique book frontispiece, high contrast, rendered edge to edge.
```

TAIL:
```
No text, no signature, no border, full-bleed.
```

Final prompt = `${STYLE} ${subject} ${TAIL}`.

## 3. Prompt rules (learned the hard way)
1. **Keep the whole prompt under ~90 words / 600 characters.** Flux Schnell reads only the start of a long prompt (≈256 tokens): with a long style block the subject's emotion, the object and the "no text/no frame" tail were silently dropped (round f5).
2. **Style first, then subject.** Subject-first prompts drifted into digital painting.
3. **Subject = emotion first, then role, appearance, object, pose.** e.g. "Shocked Victorian lady, eyes wide, lips parted, high lace collar, clearly holding a pair of white wireless earbuds between her fingers." Emotion-first restored strong expressions (round f6).
4. Say "clearly holding <object with one concrete detail>" — vague objects get dropped or swapped (pen instead of calculator).
5. **No colours in the subject** (a "red coat" broke the palette). **No years or dates** (they render as text, e.g. "12000 AD"); describe the era in words.
6. **Culture via visible features**, not names ("Aztec" alone gave a Plains war bonnet; describe quetzal feathers, jade ear spools, black face paint).
7. Face stays visible: objects at chest level, never over eyes/mouth.
8. **Forbidden words:** fantasy, gothic, game, monster, elf, orc, smoke, candle, torch, paper, ears. ("on cream paper" left half the frame blank; mentioning "ears" made them pointy; "gothic game" gave elf ears and fangs; "smoke" turned into a cigarette.)
9. Modern + classic mix is intended (a hetman with beard + oseledets + moustache is fine).

## 4. Known Flux Schnell behaviours and the required QA gate
- Holds the style across eras; palette stays unified when subjects contain no colour words.
- Roughly 1 in 4–6 images still has a defect: fake signature, cream print border, pointy ears/fangs on bearded warriors, missing object. Prompting alone does not get this to zero.
- Therefore a **vision QA gate is part of phase 1**: after generation a vision model (Gemini Flash via OpenRouter, already in the stack) answers a fixed JSON checklist — `hasText`, `hasBorder`, `nonHumanFeatures`, `objectVisible`, `emotionMatches`. Any fail → re-roll (max 3). Schnell costs $0.0015/image on PiAPI, re-rolls are cheap.
- Ignores negations of strong associations (long moustache ⇒ beard). Accepted.
- Flux Dev is NOT better for this style (drifts to painting, loses close-ups, same errors, more expensive).

## 5. UI palette
| Token | Hex | Use |
|---|---|---|
| bg | #13151D | app background |
| surface | #1C1F2A / #262A38 | cards, panels |
| text | #F1EBDF | primary text |
| muted | #B9B4AA | secondary text |
| amber | #E3A84E | accent, card frame, "tension" state |
| cyan | #7FE3F0 | "stable" state, frame glow |
| red | #E36B5B | "collapse near" state |
Card frame colour follows world state: cyan = stable, amber = tension, red = collapse near. Fonts: EB Garamond (display) + Rubik (UI), both with Cyrillic.

## 6. Formats
Character card 3:4 (768×1024), scene 16:9 (1024×576), artifact cover 3:4 (768×1024). PiAPI takes width/height in pixels; the fal fallback maps them to `portrait_4_3` / `landscape_16_9`.

## 7. Regression set (run after any preset change)
Emotion-first subjects: terrified Egyptian scribe (calculator), suspicious Roman senator (smartphone), furious Viking chieftain (brass compass), guilty medieval monk (tablet), cold calculating samurai (instant photo), grim determined Ukrainian Cossack hetman (wristwatch), ecstatic Aztec priest (light bulb — describe visually), shocked Victorian lady (wireless earbuds), contemptuous Qing empress (VR headset at chest), exhausted haunted WWII pilot (drone).
Pass = style + readable emotion + object visible + no text/border, ≥8/10 before the QA gate, 10/10 after it.
