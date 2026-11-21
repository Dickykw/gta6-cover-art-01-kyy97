// cover.js — deterministic GTA 6-style movie-poster key art renderer.
// Pure canvas 2D, no network, no randomness, no Date. All layout is derived
// from the base grid (1024 x 576) scaled by a single factor, so every export
// size is pixel-identical up to scale.
//
// The poster is "PALM & PISTOL" — a crime-epic key art with 7 distinct
// characters, each with a role name tag, a hero close-up, a review strip,
// a striped chrome title, a script subtitle, a gold BEST CAST seal, a
// movie billing block and a barcode.

(function (global) {
  'use strict';

  var BASE_W = 1024;
  var BASE_H = 576;

  // Role order: top row (4) then bottom row (3). The FIXER is the hero.
  var ROLES = [
    { id: 'driver',   label: 'THE DRIVER',   row: 0, hero: false },
    { id: 'fixer',    label: 'THE FIXER',    row: 0, hero: true  },
    { id: 'mechanic', label: 'THE MECHANIC', row: 0, hero: false },
    { id: 'captain',  label: 'THE CAPTAIN',  row: 0, hero: false },
    { id: 'rider',    label: 'THE RIDER',    row: 1, hero: false },
    { id: 'boss',     label: 'THE BOSS',     row: 1, hero: false },
    { id: 'lookout',  label: 'THE LOOKOUT',  row: 1, hero: false },
  ];

  // Face focal points (fractions of the sample photo, 512 x 640, except
  // fixer/captain at 512 x 612). These are HEAD centres: the crop window
  // is centred on the head, and the focal y is chosen so the hair top
  // stays inside the window with a clear margin — no head or hair may
  // touch or cross a panel's top edge. The window is already the largest
  // rect with the panel's aspect ratio (see coverRect), so the fix is
  // the placement: centre on the head, never on the chin or chest.
  // Measured head boxes (photo fractions, measured from the full-size
  // photos, not thumbnails): driver hair top 0.18, eyes 0.28, chin
  // 0.38; fixer hair top 0.03, eyes 0.33, chin 0.70 (photo padded to
  // 760 wide so the crop window is tall enough for the face — focal y
  // 0.355 centres the window on the face, chin sits behind the tag);
  // mechanic 0.08/0.28/0.42; captain (hat) 0.02/0.55; rider 0.22/0.33/
  // 0.47; boss hair top 0.13, eyes 0.20, chin 0.28 (wide shot, small
  // face — the only way a whole face fits the very wide centre panel);
  // lookout 0.16/0.33/0.48.
  // BOSS face sits RIGHT of centre (x 0.59): the retro sunset sun
  // overlaps the centre panel's left side, so her face must stay clear
  // of it — the reference puts her face on the panel's right.
  var FOCAL = {
    driver:   { x: 0.52, y: 0.28 },
    fixer:    { x: 0.50, y: 0.45 },
    mechanic: { x: 0.48, y: 0.28 },
    captain:  { x: 0.56, y: 0.28 },
    rider:    { x: 0.50, y: 0.46 },
    boss:     { x: 0.59, y: 0.24 },
    lookout:  { x: 0.52, y: 0.38 },
  };

  // Five colour grades. `filter` is a canvas 2D filter string applied when
  // the photo is drawn; `wash` is a translucent overlay drawn on top.
  var GRADES = {
    sunset: { filter: 'saturate(1.25) contrast(1.06)',            wash: 'rgba(255,140,40,0.08)'  },
    neon:   { filter: 'saturate(1.60) hue-rotate(-15deg) contrast(1.10)', wash: 'rgba(255,0,120,0.10)' },
    vice:   { filter: 'saturate(1.40) hue-rotate(25deg) contrast(1.06)',  wash: 'rgba(120,0,180,0.12)' },
    gold:   { filter: 'sepia(0.35) saturate(1.50) contrast(1.05)',        wash: 'rgba(255,180,0,0.10)' },
    noir:   { filter: 'grayscale(0.90) contrast(1.35) brightness(1.06)',  wash: 'rgba(0,0,0,0.00)'     },
  };
  var GRADE_ORDER = ['sunset', 'neon', 'vice', 'gold', 'noir'];

  var DEFAULT_STATE = {
    title: 'PALM & PISTOL',
    subtitle: 'Every sunset has a price',
    tagline: 'SEVEN CREWS  ·  ONE LAST SCORE  ·  NO WAY OUT',
    quote: 'THE WILDEST RIDE OF THE YEAR',
    gazette: 'PALM CITY HERALD',
    grade: 'sunset',
  };

  function cloneState(s) {
    var out = {};
    var k;
    for (k in DEFAULT_STATE) out[k] = DEFAULT_STATE[k];
    if (s) for (k in s) if (s[k] !== undefined && s[k] !== null) out[k] = s[k];
    return out;
  }

  // Cover-crop: pick the largest source rect with the target aspect ratio
  // whose centre is as close as possible to the focal point.
  function coverRect(sw, sh, fx, fy, tw, th) {
    var target = tw / th;
    var srcAspect = sw / sh;
    var sx, sy, sw2, sh2;
    if (srcAspect > target) {
      sh2 = sh;
      sw2 = sh * target;
    } else {
      sw2 = sw;
      sh2 = sw / target;
    }
    var cx = fx * sw;
    var cy = fy * sh;
    sx = cx - sw2 / 2;
    sy = cy - sh2 / 2;
    if (sx < 0) sx = 0;
    if (sy < 0) sy = 0;
    if (sx + sw2 > sw) sx = sw - sw2;
    if (sy + sh2 > sh) sy = sh - sh2;
    return { x: sx, y: sy, w: sw2, h: sh2 };
  }

  function drawPhoto(ctx, img, focal, rect, grade) {
    if (!img || !img.naturalWidth) {
      // Missing photo: flat sunset placeholder with a question mark.
      ctx.save();
      ctx.fillStyle = '#3a1c4d';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = '#ffd76a';
      ctx.font = 'bold ' + Math.round(rect.h * 0.4) + 'px Oswald, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.restore();
      return;
    }
    var g = GRADES[grade] || GRADES.sunset;
    var r = coverRect(img.naturalWidth, img.naturalHeight, focal.x, focal.y, rect.w, rect.h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    try { ctx.filter = g.filter; } catch (e) { /* older canvas: ignore */ }
    ctx.drawImage(img, r.x, r.y, r.w, r.h, rect.x, rect.y, rect.w, rect.h);
    try { ctx.filter = 'none'; } catch (e) { /* ignore */ }
    if (g.wash !== 'rgba(0,0,0,0.00)') {
      ctx.fillStyle = g.wash;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    // Warm bottom shade so the name tag stays readable. Kept light
    // (0.35 max, starting at 65% height) so faces in the lower half
    // stay visible — the old 0.55 shade swallowed chins.
    var shade = ctx.createLinearGradient(0, rect.y + rect.h * 0.65, 0, rect.y + rect.h);
    shade.addColorStop(0, 'rgba(10,4,20,0)');
    shade.addColorStop(1, 'rgba(10,4,20,0.35)');
    ctx.fillStyle = shade;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }

  function drawNameTag(ctx, s, x, y, w, label, hero) {
    var h = hero ? 26 * s : 20 * s;
    var fs = hero ? 15 * s : 11.5 * s;
    ctx.save();
    ctx.fillStyle = 'rgba(8,4,16,0.88)';
    ctx.fillRect(x, y - h, w, h);
    ctx.fillStyle = '#ffd76a';
    ctx.fillRect(x, y - h, 4 * s, h);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 ' + fs + 'px Oswald, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 9 * s, y - h / 2 + 0.5 * s);
    ctx.restore();
  }

  function drawPanel(ctx, s, img, role, rect, grade) {
    // Thin gold frame.
    ctx.save();
    ctx.fillStyle = '#1a0b26';
    ctx.fillRect(rect.x - 2 * s, rect.y - 2 * s, rect.w + 4 * s, rect.h + 4 * s);
    drawPhoto(ctx, img, FOCAL[role.id], rect, grade);
    ctx.strokeStyle = 'rgba(255,215,106,0.85)';
    ctx.lineWidth = 1.5 * s;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    drawNameTag(ctx, s, rect.x, rect.y + rect.h, rect.w, role.label, role.hero);
    ctx.restore();
  }

  // Striped chrome title: vertical gradient with hard band stops so the
  // fill reads as horizontal chrome stripes, plus a magenta outline.
  function chromeGradient(ctx, y, h) {
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    var stops = [
      [0.00, '#fff3b0'], [0.14, '#ffd76a'], [0.20, '#fff8dc'],
      [0.30, '#ffb347'], [0.38, '#ffe9a8'], [0.46, '#ff7ab8'],
      [0.55, '#ffd76a'], [0.64, '#fff3b0'], [0.72, '#ff9e57'],
      [0.82, '#ffe9a8'], [0.90, '#ffd76a'], [1.00, '#fff3b0'],
    ];
    for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    return g;
  }

  function drawTitle(ctx, s, state) {
    var cx = BASE_W * s / 2;
    var y = 318 * s; // baseline
    var fontPx = 96 * s;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = fontPx + 'px "Bebas Neue", "Oswald", sans-serif';
    // Soft glow behind.
    ctx.shadowColor = 'rgba(255,46,136,0.75)';
    ctx.shadowBlur = 22 * s;
    ctx.shadowOffsetY = 3 * s;
    ctx.lineWidth = 7 * s;
    ctx.strokeStyle = '#5b0a2e';
    ctx.lineJoin = 'round';
    ctx.strokeText(state.title, cx, y);
    ctx.shadowBlur = 0;
    ctx.fillStyle = chromeGradient(ctx, y - fontPx * 0.82, fontPx * 0.95);
    ctx.fillText(state.title, cx, y);
    // Thin highlight line through the middle of the letters (title width only).
    var titleW = ctx.measureText(state.title).width;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(cx - titleW / 2, y - fontPx * 0.42, titleW, 2 * s);
    ctx.restore();
  }

  // Retro striped sun: a setting-sun dome with horizontal slats cut
  // through it, centred slightly left of middle under the tagline.
  // It is drawn AFTER the bottom row so it sits in front of the centre
  // panel's left side, the way the reference sun sits in front of the
  // BOSS panel — her face is on the panel's right, clear of it.
  function drawSunsetSun(ctx, s) {
    var cx = 430 * s, horizon = 505 * s, r = 90 * s;
    ctx.save();
    // Clip to the band so nothing spills into the billing block.
    ctx.beginPath();
    ctx.rect(315 * s, 425 * s, 230 * s, 80 * s);
    ctx.clip();
    var g = ctx.createRadialGradient(cx, horizon, 6 * s, cx, horizon, r);
    g.addColorStop(0, '#ffe9a8');
    g.addColorStop(0.45, '#ffb347');
    g.addColorStop(0.75, '#ff7a3d');
    g.addColorStop(1, '#e0437a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, horizon, r, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    // Cut the slats through the dome only: re-clip to the dome shape.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, horizon, r, Math.PI, 0);
    ctx.closePath();
    ctx.clip();
    var slats = [[440, 3], [455, 4], [470, 5], [485, 6], [498, 7]];
    ctx.fillStyle = '#160818';
    for (var i = 0; i < slats.length; i++) {
      ctx.fillRect(315 * s, slats[i][0] * s, 230 * s, slats[i][1] * s);
    }
    ctx.restore();
    ctx.restore();
  }

  function drawSeal(ctx, s) {
    var cx = 946 * s, cy = 332 * s, r = 36 * s;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#e8b64c';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f7d774';
    ctx.beginPath(); ctx.arc(0, 0, r - 4 * s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a5a12';
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath(); ctx.arc(0, 0, r - 8 * s, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#5b2d05';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 ' + 12 * s + 'px Oswald, sans-serif';
    ctx.fillText('BEST', 0, -8 * s);
    ctx.fillText('CAST', 0, 6 * s);
    ctx.font = 10 * s + 'px Oswald, sans-serif';
    ctx.fillText('★ ★ ★', 0, 18 * s);
    ctx.restore();
  }

  function drawBarcode(ctx, s, x, y, w, h) {
    var bars = [3,1,2,1,1,3,1,2,2,1,3,1,1,2,1,1,3,2,1,1,2,3,1,2,1,1,3,1,2,1,1,2,3,1,1,2,1,3];
    var bx = x;
    var unit = w / bars.reduce(function (a, b) { return a + b; }, 0);
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 3 * s, y - 3 * s, w + 6 * s, h + 12 * s);
    ctx.fillStyle = '#111111';
    for (var i = 0; i < bars.length; i++) {
      if (i % 2 === 0) ctx.fillRect(bx, y, bars[i] * unit, h);
      bx += bars[i] * unit;
    }
    ctx.font = 9 * s + 'px Oswald, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('0 18472 65991 8', x + w / 2, y + h + 2 * s);
    ctx.restore();
  }

  // Main render. `images` maps role id -> HTMLImageElement (or null).
  // `width`/`height` choose the export size; layout scales from 1024x576.
  function render(canvas, images, state, width, height) {
    state = cloneState(state);
    width = width || BASE_W;
    height = height || BASE_H;
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d');
    var s = width / BASE_W;
    var W = BASE_W * s, H = BASE_H * s;

    // --- backdrop: near-black, like the reference — the panels carry the
    // colour. The old magenta sunset gradient left a tall empty band.
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0.00, '#1c0a26');
    bg.addColorStop(0.50, '#160818');
    bg.addColorStop(1.00, '#200a24');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    var vig = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H * 0.5, H * 0.95);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(10,2,24,0.55)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // --- review strip ----------------------------------------------------
    ctx.fillStyle = '#160818';
    ctx.fillRect(0, 0, W, 36 * s);
    ctx.fillStyle = '#ffd76a';
    ctx.font = 15 * s + 'px Oswald, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('★★★★★', 12 * s, 19 * s);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 ' + 13 * s + 'px Oswald, sans-serif';
    var quoteText = '"' + state.quote + '"';
    ctx.fillText(quoteText, 92 * s, 19 * s);
    var quoteW = ctx.measureText(quoteText).width;
    ctx.fillStyle = '#ffb347';
    ctx.font = 11 * s + 'px Oswald, sans-serif';
    ctx.fillText('— ' + state.gazette, 92 * s + quoteW + 10 * s, 19 * s);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 ' + 13 * s + 'px Oswald, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('VOL. 1', W - 12 * s, 19 * s);
    ctx.textAlign = 'left';

    // --- top row: 4 panels, FIXER is the wide hero -----------------------
    // Taller than before (224 vs 204) so the title can overlap its bottom
    // edge the way the reference does, instead of floating in a band.
    var topY = 40 * s, topH = 224 * s;
    var topWidths = [200, 386, 200, 218];
    var x = 4 * s;
    var topRects = [];
    for (var i = 0; i < 4; i++) {
      var rw = topWidths[i] * s;
      topRects.push({ x: x, y: topY, w: rw, h: topH });
      x += rw + 4 * s;
    }
    for (i = 0; i < 4; i++) {
      drawPanel(ctx, s, images[ROLES[i].id], ROLES[i], topRects[i], state.grade);
    }

    // --- middle band: dark, like the reference (the title overlaps the
    // top row; the script/tagline sit in the dark band, centred slightly
    // left of middle so the BOSS face on the right stays clear) ----------
    ctx.save();
    ctx.fillStyle = 'rgba(12,4,18,0.55)';
    ctx.fillRect(0, 264 * s, W, 120 * s);
    ctx.restore();

    // --- title band (overlaps the top row's bottom edge) -----------------
    drawTitle(ctx, s, state);
    // Name tags back on top: the title overlaps the top row's bottom
    // edge, and the tags must stay readable over the title letters,
    // the way the reference draws THE FIXER over SUNDOWN RACKET.
    for (i = 0; i < 4; i++) {
      drawNameTag(ctx, s, topRects[i].x, topRects[i].y + topRects[i].h,
        topRects[i].w, ROLES[i].label, ROLES[i].hero);
    }

    // --- subtitle script + tagline strip ----------------------------------
    // Bright neon pink (the old #ff9ecf washed out on the magenta band).
    var midX = 430 * s;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5da2';
    ctx.shadowColor = 'rgba(255,46,136,0.9)';
    ctx.shadowBlur = 16 * s;
    ctx.font = 42 * s + 'px "Great Vibes", cursive';
    ctx.fillText(state.subtitle, midX, 356 * s);
    ctx.restore();
    var tag = state.tagline;
    ctx.save();
    ctx.font = '600 ' + 12.5 * s + 'px Oswald, sans-serif';
    var tagW = ctx.measureText(tag).width + 28 * s;
    ctx.fillStyle = 'rgba(255,46,136,0.92)';
    var tagX = midX - tagW / 2, tagY = 366 * s;
    ctx.fillRect(tagX, tagY, tagW, 20 * s);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tag, midX, tagY + 10.5 * s);
    ctx.restore();

    // --- bottom row: 3 panels, BOSS is the wide centre --------------------
    // Taller (128 vs 108) and starts right under the tagline, so the row
    // packs tight against the middle band like the reference.
    var botY = 384 * s, botH = 128 * s;
    var botWidths = [278, 505, 225];
    x = 4 * s;
    var botRects = [];
    for (i = 0; i < 3; i++) {
      rw = botWidths[i] * s;
      botRects.push({ x: x, y: botY, w: rw, h: botH });
      x += rw + 4 * s;
    }
    for (i = 0; i < 3; i++) {
      drawPanel(ctx, s, images[ROLES[4 + i].id], ROLES[4 + i], botRects[i], state.grade);
    }

    // --- retro sunset sun (in front of the BOSS panel's left side) -------
    drawSunsetSun(ctx, s);

    // --- gold seal (overlaps title band / bottom row, right side) --------
    drawSeal(ctx, s);

    // --- billing block + COMING SOON + barcode ---------------------------
    ctx.save();
    ctx.fillStyle = '#160818';
    ctx.fillRect(0, 520 * s, W, 56 * s);
    ctx.fillStyle = '#e8dcc8';
    ctx.font = 9 * s + 'px Oswald, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('A SUNSET BOULEVARD PICTURES PRODUCTION IN ASSOCIATION WITH NEON MILE', W / 2, 526 * s);
    ctx.fillText('A M. SANTOS FILM  "PALM & PISTOL"  MUSIC BY MIDNIGHT PALMS  EDITED BY K. REYES', W / 2, 538 * s);
    ctx.fillText('WRITTEN BY L. FONTAINE & J. OKONKWO  DIRECTED BY M. SANTOS', W / 2, 550 * s);
    ctx.fillStyle = '#ffb347';
    ctx.font = '700 ' + 20 * s + 'px "Bebas Neue", Oswald, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('—  COMING SOON', 12 * s, 534 * s);
    ctx.restore();
    drawBarcode(ctx, s, W - 88 * s, 528 * s, 72 * s, 26 * s);

    // --- outer frame -------------------------------------------------------
    ctx.save();
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 3 * s;
    ctx.strokeRect(1.5 * s, 1.5 * s, W - 3 * s, H - 3 * s);
    ctx.restore();

    return { width: width, height: height, roles: ROLES.length };
  }

  global.CoverArt = {
    BASE_W: BASE_W,
    BASE_H: BASE_H,
    ROLES: ROLES,
    FOCAL: FOCAL,
    GRADES: GRADES,
    GRADE_ORDER: GRADE_ORDER,
    DEFAULT_STATE: DEFAULT_STATE,
    render: render,
    coverRect: coverRect,
    cloneState: cloneState,
  };
})(typeof window !== 'undefined' ? window : globalThis);
