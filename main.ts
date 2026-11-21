// main.ts — program entry: build + verify the Palm & Pistol Cover Studio.
// Usage: node main.ts [port]
// Checks (all local; the HTTP check serves the repo itself, no internet):
//   1. every required file exists (app, fonts, samples, docs, meta)
//   2. every sample photo is a real JPEG (magic bytes) with distinct bytes
//   3. fonts are real TTF files and the OFL licence is present
//   4. README carries the 3 live make.fun badges (no static shields.io)
//   5. LICENSE is MIT and carries the SPDX identifier line
//   6. .makefun/owner.json names the payout wallet
//   7. cover.js / main.js contain no external URL (the app is offline)
//   8. the poster title is original (not the top-rank entry's title)
//   9. END-TO-END: serve.ts serves the page and every asset it references
//      (HTML, CSS, JS, fonts, samples) returns HTTP 200
// Exit code 0 = all checks pass, 1 = any check fails.

import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..');

const REQUIRED_FILES = [
  'app/index.html',
  'app/style.css',
  'app/src/cover.js',
  'app/src/main.js',
  'app/fonts/BebasNeue-Regular.ttf',
  'app/fonts/Oswald.ttf',
  'app/fonts/GreatVibes-Regular.ttf',
  'app/fonts/OFL.txt',
  'main.ts',
  'serve.ts',
  'shots.json',
  'README.md',
  'LICENSE',
  '.makefun/owner.json',
];

const SAMPLE_ROLES = ['driver', 'fixer', 'mechanic', 'captain', 'rider', 'boss', 'lookout'];
const PAYOUT_WALLET = '3GddR11Yr75f3APZercRqiQ2rdh1A2aq84R5tfYTrCuL';
const BADGE_BASE = 'https://make.fun/api/competitions/gta6-cover-art-01/badge';

type Check = { name: string; ok: boolean; detail: string };

const results: Check[] = [];
function check(name: string, ok: boolean, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

async function exists(p: string): Promise<boolean> {
  try { await stat(join(ROOT, p)); return true; } catch { return false; }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Serve the repo on a scratch port and fetch the page + every asset it
// references. Returns false if the server never comes up.
async function httpCheck(port: number): Promise<boolean> {
  const server: ChildProcess = spawn('node', ['serve.ts', String(port)], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  try {
    let up = false;
    for (let i = 0; i < 25; i++) {
      try {
        const r = await fetch(`http://localhost:${port}/app/index.html`);
        if (r.ok) { up = true; break; }
      } catch { /* not up yet */ }
      await sleep(200);
    }
    check('serve.ts comes up', up);
    if (!up) return false;

    const html = await (await fetch(`http://localhost:${port}/app/index.html`)).text();
    const refs = new Set<string>();
    for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      const u = m[1];
      if (!u.startsWith('http') && !u.startsWith('#')) refs.add(u);
    }
    // Assets the HTML pulls in indirectly (fonts via CSS, samples via JS).
    for (const f of ['fonts/BebasNeue-Regular.ttf', 'fonts/Oswald.ttf', 'fonts/GreatVibes-Regular.ttf']) refs.add(f);
    for (const role of SAMPLE_ROLES) refs.add(`samples/${role}.jpg`);
    const css = await (await fetch(`http://localhost:${port}/app/style.css`)).text();
    for (const m of css.matchAll(/url\("([^"]+)"\)/g)) refs.add(m[1]);

    let allOk = true;
    for (const ref of refs) {
      const url = `http://localhost:${port}/app/${ref}`;
      const r = await fetch(url);
      if (!r.ok) allOk = false;
      check(`GET /app/${ref}`, r.ok, `${r.status}`);
    }
    return allOk;
  } finally {
    server.kill('SIGTERM');
  }
}

async function main(): Promise<void> {
  // 1. required files
  for (const f of REQUIRED_FILES) {
    check(`file exists: ${f}`, await exists(f));
  }

  // 2. samples: real JPEGs, distinct content
  const hashes = new Set<string>();
  for (const role of SAMPLE_ROLES) {
    const p = `app/samples/${role}.jpg`;
    if (!(await exists(p))) { check(`sample ${role}`, false, 'missing'); continue; }
    const buf = await readFile(join(ROOT, p));
    const isJpeg = buf.length > 20000 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    const hash = createHash('sha256').update(buf).digest('hex').slice(0, 12);
    hashes.add(hash);
    check(`sample ${role} is JPEG`, isJpeg, `${buf.length} bytes, sha ${hash}`);
  }
  check('7 samples are pairwise distinct', hashes.size === 7, `${hashes.size} unique hashes`);

  // 3. fonts are real TTF
  for (const f of ['BebasNeue-Regular.ttf', 'Oswald.ttf', 'GreatVibes-Regular.ttf']) {
    const buf = await readFile(join(ROOT, 'app/fonts', f));
    check(`font ${f} is TTF`, buf.subarray(0, 4).toString('ascii') === '\x00\x01\x00\x00', `${buf.length} bytes`);
  }
  const ofl = await readFile(join(ROOT, 'app/fonts/OFL.txt'), 'utf8');
  check('OFL licence present', ofl.includes('SIL Open Font License'));

  // 4. README: 3 live make.fun badges, no static shields.io
  const readme = await readFile(join(ROOT, 'README.md'), 'utf8');
  check('README has live badge (competition)', readme.includes(BADGE_BASE));
  check('README has live badge (rank)', readme.includes(`${BADGE_BASE}/rank`));
  check('README has live badge (reward)', readme.includes(`${BADGE_BASE}/reward`));
  check('README has no static shields.io badge', !readme.includes('shields.io'));

  // 5. LICENSE
  const lic = await readFile(join(ROOT, 'LICENSE'), 'utf8');
  check('LICENSE is MIT', lic.includes('MIT License'));
  check('LICENSE has SPDX line', lic.includes('SPDX-License-Identifier: MIT'));

  // 6. owner.json
  const owner = JSON.parse(await readFile(join(ROOT, '.makefun/owner.json'), 'utf8')) as { wallet?: string };
  check('owner.json wallet', owner.wallet === PAYOUT_WALLET, owner.wallet ?? 'missing');

  // 7. offline: no external URL in the app code
  for (const f of ['app/src/cover.js', 'app/src/main.js', 'app/index.html', 'app/style.css']) {
    const src = await readFile(join(ROOT, f), 'utf8');
    const external = /https?:\/\/[^"'\s)]+/.test(src);
    check(`offline: no external URL in ${f}`, !external);
  }

  // 8. original title (not the rank-1 entry's title)
  const cover = await readFile(join(ROOT, 'app/src/cover.js'), 'utf8');
  check('title is original', !/sundown racket/i.test(cover) && cover.includes('PALM & PISTOL'));
  check('7 roles with hero defined', (cover.match(/id: '(driver|fixer|mechanic|captain|rider|boss|lookout)'/g) || []).length === 7);
  check('5 grades defined', (cover.match(/^(    (sunset|neon|vice|gold|noir):)/gm) || []).length === 5);

  // 9. screenshots directory has the poster shots
  const shots = await readdir(join(ROOT, 'screenshots')).catch(() => [] as string[]);
  check('screenshots present', shots.filter((s) => /\.(jpe?g|png)$/i.test(s)).length >= 2, shots.join(', ') || 'none');

  // 10. end-to-end HTTP check
  const port = Number(process.argv[2] || 8131);
  await httpCheck(port);

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => { console.error('ERROR', err); process.exit(1); });
