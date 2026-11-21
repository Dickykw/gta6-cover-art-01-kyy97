# Palm & Pistol — GTA 6 Cover Art Studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/Dickykw/gta6-cover-art-01-kyy97/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/Dickykw/gta6-cover-art-01-kyy97/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Turn your photos into GTA 6-style movie-poster key art — a framed crime-epic
cover with **7 distinct characters**, a hero close-up, a review strip, a
striped chrome title, a script subtitle, a gold BEST CAST seal, a movie
billing block and a barcode. Built for the make.fun bounty
[Make GTA 6 Cover Art](https://make.fun/bounty/gta6-cover-art-01).

## What it does

- Renders a 1024×576 poster on a canvas (deterministic — same inputs, same pixels).
- **7 cast panels**: THE DRIVER, THE FIXER (large hero close-up, centre top),
  THE MECHANIC, THE CAPTAIN, THE RIDER, THE BOSS, THE LOOKOUT. Every panel
  crops to the face (face-aware focal-point crop), so no character is ever
  cut off or duplicated.
- **Review strip**: 5 gold stars + a press quote + gazette name, VOL. 1.
- **Striped chrome title** (editable), pink script subtitle (editable),
  tagline strip (editable).
- **5 colour grades**: Sunset, Neon, Vice, Gold, Noir.
- **Photo upload**: replace any cast member with your own photo; the crop
  stays centred on the face.
- **PNG export in 3 sizes**: 1024×576, 2048×1152, 512×288.
- **Fully offline**: all photos and fonts are bundled locally. No CDN, no
  network call at runtime.

## Run it

```sh
# preview in the browser
node serve.ts 8123
# open http://localhost:8123/app/index.html

# verify the whole entry (files, samples, fonts, badges, licence, offline)
node main.ts
```

`main.ts` is the program entry: it checks every required file, validates
each sample photo as a real JPEG, confirms the 7 samples are pairwise
distinct, checks the fonts and OFL licence, verifies the 3 live make.fun
badges in this README, the MIT licence + SPDX line, the payout wallet in
`.makefun/owner.json`, and that the app code contains no external URL.

## Files

| Path | What it is |
| --- | --- |
| `app/index.html` | Studio page (poster canvas + controls) |
| `app/style.css` | Studio styling (local fonts only) |
| `app/src/cover.js` | Deterministic canvas poster renderer |
| `app/src/main.js` | UI wiring: text, grades, upload, export |
| `app/samples/*.jpg` | 7 sample cast photos (Pollinations FLUX, local) |
| `app/fonts/*.ttf` | Bebas Neue, Oswald, Great Vibes (OFL 1.1) |
| `main.ts` | Build + verify entry point |
| `serve.ts` | Tiny static server for local preview |
| `shots.json` | Screenshot manifest |
| `screenshots/` | Real screenshots of the working app |

## Sample photos

The 7 bundled photos were generated with the free Pollinations image API
(model FLUX) and saved locally — one distinct person per role, verified
visually distinct. Replace any of them in the UI with your own photo.

## Licence

MIT — see [LICENSE](LICENSE). Fonts under the SIL Open Font License 1.1
(see `app/fonts/OFL.txt`).
