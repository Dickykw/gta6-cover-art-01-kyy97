[![gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/Dickykw/gta6-cover-art-01-kyy97/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/Dickykw/gta6-cover-art-01-kyy97/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

# Vice Coast Cover Studio

A GTA 6-style cover art maker for the [make.fun gta6-cover-art-01 bounty](https://make.fun/bounty/gta6-cover-art-01): an offline web app that turns your photo and a caption into a Vice City sunset poster, exported as a PNG to share.

## What it does

- **Multi-panel poster** — Triptych (3 vertical panels), Hero + 2, Grid (4 panels), or Full bleed. Fill several panels with one photo or a different photo per panel.
- **Any photo, positioned** — Click a panel to select it, drag to position the photo, scroll to zoom. A 5% safe-zone guide keeps the caption clear of the edges.
- **Sunset / neon grades** — Sunset Vice, Neon Night, Palm Gold, Mono Noir: gradient colour grades over the panels, plus grain and vignette.
- **Bold caption lettering** — Bebas Neue capitals with a neon pink stroke, cyan hairline and glow, an Oswald subtitle above, and a corner badge (GTA-6 / Vice Coast / Made with make.fun / off).
- **Fast and easy** — Photo → caption → Export PNG. Three common post sizes: **1080 × 1080**, **1080 × 1350**, **1920 × 1080**.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

`app/` is plain static files with no build step and no network request: every script, font and sample photo is a file under `app/`. Photos are read on your own machine and never uploaded.

## Fonts

Bebas Neue, Oswald and Montserrat Alternates, vendored under `app/fonts/` under the SIL Open Font License (`app/fonts/OFL.txt`). No Rockstar Games logo, wordmark, artwork, character or font is used anywhere.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only) copies `app/` and `screenshots/` to `/output` and writes `/output/dossier.json` with the vendored `vendor/makefun-app.ts` library.

## Screenshots

`shots.json` lists the four screenshots in `screenshots/`: the exported square cover first, then the editor with a photo loaded, then the portrait and wide covers — each rendered by the app itself in headless Chrome from the `?shot=` scenes in `app/src/shots.js`.

## License

MIT — see [LICENSE](LICENSE).
