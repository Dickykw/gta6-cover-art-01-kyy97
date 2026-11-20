// Vice Coast Cover Studio — the cover engine for gta6-cover-art-01.
// Draws a multi-panel GTA-style poster cover onto any 2D canvas: several photo
// panels (one photo or several, each cropped and positioned), a Vice City
// sunset or neon colour grade, bold Bebas Neue caption lettering with a neon
// stroke, and a small corner badge. Pure canvas, no network, no library.

export const EXPORT_SIZES = {
  square: { label: '1080 x 1080', width: 1080, height: 1080 },
  portrait: { label: '1080 x 1350', width: 1080, height: 1350 },
  wide: { label: '1920 x 1080', width: 1920, height: 1080 },
};

export const LAYOUTS = {
  triptych: { label: 'Triptych — 3 panels' },
  hero: { label: 'Hero + 2 panels' },
  grid: { label: 'Grid — 4 panels' },
  fullbleed: { label: 'Full bleed — 1 photo' },
};

export const GRADES = {
  sunset: { label: 'Sunset Vice', stops: ['#ffd319', '#ff7b3d', '#ff2e88', '#7b2ff7', '#2b1a5e'] },
  neon: { label: 'Neon Night', stops: ['#00f0ff', '#ff2e88', '#7b2ff7', '#12002e'] },
  gold: { label: 'Palm Gold', stops: ['#fff3b0', '#ffb703', '#fb8500', '#6d28d9'] },
  noir: { label: 'Mono Noir', stops: ['#e8e8e8', '#9a9a9a', '#3a3a3a', '#0a0a0a'] },
};

export const BADGES = {
  gta6: 'GTA-6',
  coast: 'VICE COAST',
  makefun: 'MADE WITH MAKE.FUN',
  none: '',
};

/** Panel rectangles for a layout, in canvas pixels. Gutters stay proportional. */
export function panelRects(layout, w, h) {
  const g = Math.max(4, Math.round(w * 0.008)); // white gutter
  const titleH = Math.round(h * 0.24); // caption band along the foot
  const top = h - titleH;
  if (layout === 'fullbleed') return [{ x: 0, y: 0, w, h: top }];
  if (layout === 'grid') {
    const cw = (w - g) / 2;
    const ch = (top - g) / 2;
    return [
      { x: 0, y: 0, w: cw, h: ch },
      { x: cw + g, y: 0, w: cw, h: ch },
      { x: 0, y: ch + g, w: cw, h: ch },
      { x: cw + g, y: ch + g, w: cw, h: ch },
    ];
  }
  if (layout === 'hero') {
    const left = Math.round(w * 0.62);
    const right = w - left - g;
    const rh = (top - g) / 2;
    return [
      { x: 0, y: 0, w: left, h: top },
      { x: left + g, y: 0, w: right, h: rh },
      { x: left + g, y: rh + g, w: right, h: rh },
    ];
  }
  // triptych: three vertical panels
  const cw = (w - g * 2) / 3;
  return [
    { x: 0, y: 0, w: cw, h: top },
    { x: cw + g, y: 0, w: cw, h: top },
    { x: (cw + g) * 2, y: 0, w: cw, h: top },
  ];
}

/** Draws one photo into a panel rect, cover-fit, with zoom and pan offsets. */
export function drawPanelPhoto(ctx, photo, rect) {
  if (!photo || !photo.img) return;
  const img = photo.img;
  const zoom = photo.zoom ?? 1;
  const scale = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * zoom;
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  const ox = (photo.ox ?? 0) * rect.w;
  const oy = (photo.oy ?? 0) * rect.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.drawImage(img, rect.x + (rect.w - pw) / 2 + ox, rect.y + (rect.h - ph) / 2 + oy, pw, ph);
  ctx.restore();
}

/** Washes the whole cover in the grade's sunset/neon gradient (overlay). */
export function applyGrade(ctx, grade, w, h) {
  const grad = ctx.createLinearGradient(0, 0, w * 0.25, h);
  grade.stops.forEach((color, i) => grad.addColorStop(i / (grade.stops.length - 1), color));
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.5;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  // Warm wash rising from the foot, so the caption band glows.
  const warm = ctx.createLinearGradient(0, h * 0.45, 0, h);
  warm.addColorStop(0, 'rgba(255, 110, 60, 0)');
  warm.addColorStop(1, 'rgba(255, 46, 136, 0.35)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, w, h);
}

/** Deterministic film grain, so two renders of one state match. */
export function applyGrain(ctx, w, h, seed = 7) {
  let s = seed;
  const next = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  ctx.save();
  ctx.globalAlpha = 0.035;
  const step = Math.max(3, Math.round(w / 300));
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const v = next() > 0.5 ? 255 : 0;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, step, step);
    }
  }
  ctx.restore();
}

/** Darkens the corners so the panels read as one poster. */
export function applyVignette(ctx, w, h) {
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(10,0,20,0.45)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

/** Fits one line of text to a width, shrinking the font until it fits. */
export function fitFont(ctx, text, family, weight, startSize, maxWidth) {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

/** The caption: huge Bebas Neue capitals, neon outline + glow + white fill.
 *  The baseline sits a fixed margin above the foot, so the lettering never
 *  runs off the canvas whatever the export size. */
export function drawCaption(ctx, caption, subtitle, w, h) {
  const text = (caption || '').trim().toUpperCase();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (!text && !(subtitle && subtitle.trim())) return;
  const size = fitFont(ctx, text || 'W', '"Bebas Neue", sans-serif', 400, Math.round(w * 0.17), w * 0.92);
  const yCap = h - h * 0.045; // caption baseline, 4.5% above the foot
  if (subtitle && subtitle.trim()) {
    const sub = subtitle.trim().toUpperCase();
    const subSize = fitFont(ctx, sub, '"Oswald", sans-serif', 600, Math.round(w * 0.045), w * 0.86);
    ctx.font = `600 ${subSize}px "Oswald", sans-serif`;
    ctx.fillStyle = '#ffe66d';
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = subSize * 0.5;
    ctx.fillText(sub, w / 2, yCap - size * 0.92);
    ctx.shadowBlur = 0;
  }
  if (!text) return;
  ctx.font = `400 ${size}px "Bebas Neue", sans-serif`;
  ctx.lineJoin = 'round';
  // Neon stroke: hot pink glow, then a cyan hairline, then the white fill.
  ctx.shadowColor = '#ff2e88';
  ctx.shadowBlur = size * 0.28;
  ctx.strokeStyle = '#ff2e88';
  ctx.lineWidth = size * 0.10;
  ctx.strokeText(text, w / 2, yCap);
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = size * 0.12;
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.9)';
  ctx.lineWidth = size * 0.03;
  ctx.strokeText(text, w / 2, yCap);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, w / 2, yCap);
}

/** Small corner badge, top right, in Oswald with a neon edge. */
export function drawBadge(ctx, label, w, h) {
  if (!label) return;
  const size = Math.round(w * 0.028);
  ctx.font = `700 ${size}px "Oswald", sans-serif`;
  const padX = size * 0.9;
  const tw = ctx.measureText(label).width;
  const bw = tw + padX * 2;
  const bh = size * 1.9;
  const x = w - bw - w * 0.03;
  const y = h * 0.03;
  ctx.save();
  ctx.fillStyle = 'rgba(10, 0, 25, 0.72)';
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = Math.max(2, size * 0.08);
  ctx.beginPath();
  ctx.roundRect(x, y, bw, bh, bh / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + bw / 2, y + bh / 2 + size * 0.05);
  ctx.restore();
}

/**
 * Draws the whole cover. `state` carries:
 * photos: [{img, zoom, ox, oy}] — one per panel slot, missing slots fall back
 *   to the first photo; layout, gradeKey, caption, subtitle, badge label.
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const grade = GRADES[state.gradeKey] ?? GRADES.sunset;
  const rects = panelRects(state.layout, w, h);
  ctx.fillStyle = '#0d0218';
  ctx.fillRect(0, 0, w, h);
  const first = state.photos.find((p) => p && p.img);
  rects.forEach((rect, i) => {
    const photo = (state.photos[i] && state.photos[i].img) ? state.photos[i] : first;
    if (photo) drawPanelPhoto(ctx, photo, rect);
    else {
      ctx.fillStyle = i % 2 ? '#2b1838' : '#1d1030';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
  });
  applyGrade(ctx, grade, w, h);
  applyVignette(ctx, w, h);
  applyGrain(ctx, w, h);
  // Caption band: a dark foot so the lettering always reads.
  const band = ctx.createLinearGradient(0, h * 0.72, 0, h);
  band.addColorStop(0, 'rgba(10, 0, 25, 0)');
  band.addColorStop(1, 'rgba(10, 0, 25, 0.82)');
  ctx.fillStyle = band;
  ctx.fillRect(0, h * 0.72, w, h * 0.28);
  drawCaption(ctx, state.caption, state.subtitle, w, h);
  drawBadge(ctx, state.badge, w, h);
}
