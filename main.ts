// Vice Coast Cover Studio — a gta6-cover-art-01 entry (Node 22, standard
// library only): the app is this directory's app/ folder, plain static files
// a desktop browser loads offline (app/index.html and its ES modules, the
// Bebas Neue / Oswald / Montserrat Alternates fonts vendored under app/fonts/
// under the SIL Open Font License, no network request), and the program hands
// it in. It copies app/ and screenshots/ from beside this file to /output and
// writes /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library.
//
// The app turns a photo and a caption into GTA 6-style cover art: a
// multi-panel poster (triptych, hero + 2, grid, or full bleed), each panel's
// photo cropped and positioned by dragging, a Vice City sunset or neon colour
// grade, bold neon-stroked caption lettering, and a corner badge — exported
// as a PNG in 1080 x 1080, 1080 x 1350 or 1920 x 1080.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Pre-flight: refuse to hand in an entry the scorer would refuse outright —
// a missing index.html, or a screenshots/ folder outside the gate's own
// limits (3 to 4 images, each at most 256 KiB). Failing here, loudly, beats
// a silent invalid entry after submission.
const indexHtml = join(here, 'app', 'index.html');
if (!existsSync(indexHtml)) throw new Error(`missing app/index.html at ${indexHtml}`);
const shotDir = join(here, 'screenshots');
const shotFiles = existsSync(shotDir)
  ? readdirSync(shotDir).filter((f) => !f.startsWith('.')).sort()
  : [];
if (shotFiles.length < 3 || shotFiles.length > 4) {
  throw new Error(`screenshots/ must hold 3 to 4 images, found ${shotFiles.length}`);
}
for (const file of shotFiles) {
  const bytes = statSync(join(shotDir, file)).size;
  if (bytes > 262144) throw new Error(`screenshots/${file} is ${bytes} bytes, over the 256 KiB cap`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of app
// files, in all, or a path under app/ over 1000 bytes: app/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
