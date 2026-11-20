// Vice Coast Cover Studio — cover renderer for the gta6-cover-art-01 entry.
// Everything here draws on a plain 2D canvas: photo panels, a sunset/neon
// colour grade, film grain, a vignette, and big neon caption lettering.
// No network, no library, no Rockstar asset — only the vendored OFL fonts.

export const EXPORT_SIZES = {
  square: { label: '1080 × 1080', width: 1080, height: 1080 },
  portrait: { label: '1080 × 1350', width: 1080, height: 1350 },
  wide: { label: '1920 × 1080', width: 1920, height: 1080 },
};

export const LAYOUTS = {
  triptych: { label: 'Triptych · 3 panels', panels: 3 },
  hero: { label: 'Hero + 2 panels', panels: 3 },
  grid: { label: 'Grid · 4 panels', panels: 4 },
  fullbleed: { label: 'Full bleed · 1 photo', panels: 1 },
};

// Each grade is a diagonal wash plus a warm glow rising from the foot.
// `desat` grades pull the colour out first so the wash reads as monochrome.
export const GRADES = {
  sunset: { label: 'Sunset Vice', desat: 0, stops: ['#ffe45c', '#ff8a3d', '#ff2e88', '#7b2ff7', '#241258'] },
  neon: { label: 'Neon Night', desat: 0, stops: ['#00f0ff', '#2e7bff', '#ff2e88', '#7b2ff7', '#0d0221'] },
  gold: { label: 'Palm Gold', desat: 0, stops: ['#fff3b0', '#ffc233', '#fb8500', '#8a2be2', '#3d1a00'] },
  noir: { label: 'Mono Noir', desat: 0.85, stops: ['#f2f2f2', '#b5b5b5', '#555555', '#111111'] },
};

export const BADGES = {
  gta6: 'GTA-6',
  coast: 'VICE COAST',
  makefun: 'MADE WITH MAKE.FUN',
  none: '',
};

// Panel rectangles for a layout, in canvas pixels. The caption band along
// the foot is reserved for the lettering; panels never run under it.
export function layoutPanels(layout, w, h) {
  const gap = Math.max(5, Math.round(w * 0.009));
  const band = Math.round(h * 0.235);
  const top = h - band;
  if (layout === 'fullbleed') return [{ x: 0, y: 0, w, h: top }];
  if (layout === 'grid') {
    const cw = (w - gap) / 2;
    const ch = (top - gap) / 2;
    return [
      { x: 0, y: 0, w: cw, h: ch },
      { x: cw + gap, y: 0, w: cw, h: ch },
      { x: 0, y: ch + gap, w: cw, h: ch },
      { x: cw + gap, y: ch + gap, w: cw, h: ch },
    ];
  }
  if (layout === 'hero') {
    const big = Math.round(w * 0.6);
    const side = w - big - gap;
    const rh = (top - gap) / 2;
    return [
      { x: 0, y: 0, w: big, h: top },
      { x: big + gap, y: 0, w: side, h: rh },
      { x: big + gap, y: rh + gap, w: side, h: rh },
    ];
  }
  const cw = (w - gap * 2) / 3;
  return [
    { x: 0, y: 0, w: cw, h: top },
    { x: cw + gap, y: 0, w: cw, h: top },
    { x: (cw + gap) * 2, y: 0, w: cw, h: top },
  ];
}

// Cover-fits one photo into a panel rect. `view` carries the user's crop:
// zoom (1 = just fits) and pan offsets as fractions of the panel size.
export function paintPhoto(ctx, photo, rect) {
  if (!photo || !photo.img) return;
  const img = photo.img;
  const zoom = photo.zoom || 1;
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const scale = base * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = rect.x + (rect.w - dw) / 2 + (photo.ox || 0) * rect.w;
  const dy = rect.y + (rect.h - dh) / 2 + (photo.oy || 0) * rect.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = Math.max(1, Math.round(rect.w * 0.002));
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
  ctx.restore();
}

// Washes the grade's gradient diagonally across the cover.
export function tintGrade(ctx, grade, w, h) {
  if (grade.desat > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'saturation';
    ctx.globalAlpha = grade.desat;
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  const wash = ctx.createLinearGradient(0, 0, w * 0.35, h);
  grade.stops.forEach((colour, i) => {
    wash.addColorStop(i / (grade.stops.length - 1), colour);
  });
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.45;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  const glow = ctx.createLinearGradient(0, h * 0.4, 0, h);
  glow.addColorStop(0, 'rgba(255,110,60,0)');
  glow.addColorStop(1, 'rgba(255,46,136,0.38)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}

// A small deterministic noise tile, tiled over the cover for film grain.
// The tile is built once per seed so repeated renders stay identical.
const noiseTiles = new Map();
function noiseTile(seed) {
  if (noiseTiles.has(seed)) return noiseTiles.get(seed);
  const size = 140;
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const tctx = tile.getContext('2d');
  const data = tctx.createImageData(size, size);
  let s = seed >>> 0 || 1;
  for (let i = 0; i < data.data.length; i += 4) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const v = s >> 24;
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  tctx.putImageData(data, 0, 0);
  noiseTiles.set(seed, tile);
  return tile;
}

export function filmGrain(ctx, w, h) {
  const pattern = ctx.createPattern(noiseTile(20261120), 'repeat');
  ctx.save();
  ctx.globalAlpha = 0.045;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function vignette(ctx, w, h) {
  const v = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.32,
    w / 2, h / 2, Math.max(w, h) * 0.78,
  );
  v.addColorStop(0, 'rgba(8,0,18,0)');
  v.addColorStop(1, 'rgba(8,0,18,0.5)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

// Shrinks the font until one line of text fits the width. Returns the size.
export function fitText(ctx, text, family, weight, start, maxWidth) {
  let size = start;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > 12 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

// The caption: oversized Bebas Neue capitals in white, edged with a hot
// pink neon stroke, a thin cyan hairline, and a pink glow; the Oswald
// subtitle sits above it in yellow. Baselines are anchored to the foot, so
// the lettering never clips at any export size.
export function drawCaption(ctx, caption, subtitle, w, h) {
  const words = (caption || '').trim().toUpperCase();
  const sub = (subtitle || '').trim().toUpperCase();
  if (!words && !sub) return;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const base = h - h * 0.04;
  // Size from the smaller side, so a wide cover's lettering still fits its
  // caption band instead of climbing into the panels.
  const startSize = Math.round(Math.min(w * 0.16, h * 0.15));
  const capSize = words
    ? fitText(ctx, words, '"Bebas Neue", sans-serif', 400, startSize, w * 0.94)
    : startSize;
  if (sub) {
    const subSize = fitText(ctx, sub, '"Oswald", sans-serif', 600, Math.round(w * 0.042), w * 0.84);
    ctx.font = `600 ${subSize}px "Oswald", sans-serif`;
    try { ctx.letterSpacing = `${Math.round(subSize * 0.22)}px`; } catch { /* older canvas */ }
    ctx.fillStyle = '#ffe66d';
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = subSize * 0.55;
    ctx.fillText(sub, w / 2, base - capSize * 0.82);
    ctx.shadowBlur = 0;
    try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  }
  if (!words) return;
  const size = capSize;
  ctx.font = `400 ${size}px "Bebas Neue", sans-serif`;
  try { ctx.letterSpacing = `${Math.round(size * 0.015)}px`; } catch { /* older canvas */ }
  ctx.lineJoin = 'round';
  ctx.shadowColor = '#ff2e88';
  ctx.shadowBlur = size * 0.3;
  ctx.strokeStyle = '#ff2e88';
  ctx.lineWidth = size * 0.11;
  ctx.strokeText(words, w / 2, base);
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = size * 0.14;
  ctx.strokeStyle = 'rgba(0,240,255,0.95)';
  ctx.lineWidth = Math.max(1, size * 0.028);
  ctx.strokeText(words, w / 2, base);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(words, w / 2, base);
  try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
}

// A pill badge in the top-right corner, Oswald bold with a cyan edge.
export function drawBadge(ctx, label, w, h) {
  if (!label) return;
  const size = Math.round(w * 0.027);
  ctx.font = `700 ${size}px "Oswald", sans-serif`;
  const pad = size * 0.95;
  const bw = ctx.measureText(label).width + pad * 2;
  const bh = size * 1.85;
  const x = w - bw - w * 0.028;
  const y = h * 0.028;
  ctx.save();
  ctx.fillStyle = 'rgba(8,0,22,0.74)';
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, bw, bh, bh / 2);
  else ctx.rect(x, y, bw, bh);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + bw / 2, y + bh / 2 + size * 0.06);
  ctx.restore();
}

// Renders the whole cover onto `canvas` from a state object:
//   photos: [{img, zoom, ox, oy}] — one slot per panel; a missing slot falls
//     back to the first loaded photo, so one photo can fill every panel.
//   layout, gradeKey, caption, subtitle, badge (label text or '').
export function renderCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const grade = GRADES[state.gradeKey] || GRADES.sunset;
  const panels = layoutPanels(state.layout, w, h);
  ctx.fillStyle = '#0d0218';
  ctx.fillRect(0, 0, w, h);
  const first = state.photos.find((p) => p && p.img);
  panels.forEach((rect, i) => {
    const slot = state.photos[i];
    const photo = slot && slot.img ? slot : first;
    if (photo) {
      paintPhoto(ctx, photo, rect);
    } else {
      ctx.fillStyle = i % 2 ? '#2a1638' : '#1c0f2e';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
  });
  tintGrade(ctx, grade, w, h);
  vignette(ctx, w, h);
  filmGrain(ctx, w, h);
  const band = ctx.createLinearGradient(0, h * 0.7, 0, h);
  band.addColorStop(0, 'rgba(8,0,22,0)');
  band.addColorStop(1, 'rgba(8,0,22,0.85)');
  ctx.fillStyle = band;
  ctx.fillRect(0, h * 0.7, w, h * 0.3);
  drawCaption(ctx, state.caption, state.subtitle, w, h);
  drawBadge(ctx, state.badge, w, h);
}
