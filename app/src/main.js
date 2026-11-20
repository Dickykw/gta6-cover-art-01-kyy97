// Vice Coast Cover Studio — the editor page for gta6-cover-art-01.
// Wires the controls (photo slots, caption, layout, grade, size, badge),
// the live canvas preview, drag-to-pan / scroll-to-zoom per panel, and the
// PNG export. A `?shot=` query loads a fixed scene for screenshots instead
// (see ./shots.js); the shot scenes draw with the same renderCover engine.
import { EXPORT_SIZES, LAYOUTS, GRADES, BADGES, layoutPanels, renderCover } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
const captionInput = document.getElementById('caption');
const subtitleInput = document.getElementById('subtitle');

const state = {
  photos: [null, null, null, null], // one slot per panel; grid needs all four
  layout: 'triptych',
  gradeKey: 'sunset',
  sizeKey: 'square',
  badgeKey: 'gta6',
  caption: 'Sunset Heist',
  subtitle: 'Vice City',
  selected: 0,
  showSafeZone: true,
};

function panelCount() {
  return LAYOUTS[state.layout].panels;
}

function visiblePhotos() {
  return state.photos.slice(0, panelCount());
}

// Loads an image file or URL into an <img> that the canvas can draw.
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

// Waits until the vendored display fonts are ready to draw on canvas.
export async function loadFonts() {
  await Promise.all([
    document.fonts.load('100px "Bebas Neue"'),
    document.fonts.load('600 40px "Oswald"'),
    document.fonts.load('700 40px "Oswald"'),
    document.fonts.load('400 20px "Montserrat Alternates"'),
  ]);
  await document.fonts.ready;
}

// The preview is the export size scaled to fit a 640px box.
function previewSize() {
  const size = EXPORT_SIZES[state.sizeKey];
  const scale = 640 / Math.max(size.width, size.height);
  return { width: Math.round(size.width * scale), height: Math.round(size.height * scale) };
}

function redraw() {
  const coverOnly = document.body.classList.contains('shot-cover');
  const size = EXPORT_SIZES[state.sizeKey];
  const { width, height } = coverOnly ? size : previewSize();
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  renderCover(canvas, {
    photos: visiblePhotos(),
    layout: state.layout,
    gradeKey: state.gradeKey,
    caption: state.caption,
    subtitle: state.subtitle,
    badge: BADGES[state.badgeKey],
  });
  if (coverOnly) return; // exported covers carry no editor guides
  if (state.showSafeZone) drawSafeZone();
  outlineSelectedPanel();
}

// 5% safe-zone guides on the preview only — never in the export.
function drawSafeZone() {
  const ctx = canvas.getContext('2d');
  const m = canvas.width * 0.05;
  ctx.save();
  ctx.strokeStyle = 'rgba(0,240,255,0.9)';
  ctx.lineWidth = 1;
  ctx.setLineDash([7, 5]);
  ctx.strokeRect(m, m, canvas.width - m * 2, canvas.height - m * 2);
  ctx.restore();
}

// Outlines the selected panel so the user sees which photo they move.
function outlineSelectedPanel() {
  const rects = layoutPanels(state.layout, canvas.width, canvas.height);
  const rect = rects[state.selected];
  if (!rect) return;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 3;
  ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
  ctx.restore();
}

// Puts one photo in every panel slot, each keeping its own crop.
export function fillAllPanels(img) {
  for (let i = 0; i < 4; i++) {
    state.photos[i] = { img, zoom: 1, ox: 0, oy: 0 };
  }
}

async function pickPhoto(slot, file) {
  if (!file) return;
  const img = await loadImage(URL.createObjectURL(file));
  state.photos[slot] = { img, zoom: 1, ox: 0, oy: 0 };
  state.selected = slot;
  redraw();
}

function buildSlotControls() {
  const wrap = document.getElementById('slots');
  wrap.innerHTML = '';
  for (let i = 0; i < panelCount(); i++) {
    const label = document.createElement('label');
    label.className = 'slot';
    label.textContent = `Panel ${i + 1} photo `;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.dataset.slot = String(i);
    input.addEventListener('change', (e) => pickPhoto(i, e.target.files[0]));
    label.appendChild(input);
    wrap.appendChild(label);
  }
}

function buildOptionButtons(containerId, options, current, onPick) {
  const wrap = document.getElementById(containerId);
  wrap.innerHTML = '';
  Object.entries(options).forEach(([key, value]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'opt' + (key === current ? ' active' : '');
    button.textContent = value.label ?? value;
    button.addEventListener('click', () => onPick(key));
    wrap.appendChild(button);
  });
}

function refreshOptions() {
  buildOptionButtons('layouts', LAYOUTS, state.layout, (key) => {
    state.layout = key;
    state.selected = 0;
    buildSlotControls();
    refreshOptions();
    redraw();
  });
  buildOptionButtons('grades', GRADES, state.gradeKey, (key) => {
    state.gradeKey = key;
    refreshOptions();
    redraw();
  });
  const sizeOptions = Object.fromEntries(
    Object.entries(EXPORT_SIZES).map(([k, v]) => [k, { label: v.label }]),
  );
  buildOptionButtons('sizes', sizeOptions, state.sizeKey, (key) => {
    state.sizeKey = key;
    refreshOptions();
    redraw();
  });
  buildOptionButtons('badges', BADGES, state.badgeKey, (key) => {
    state.badgeKey = key;
    refreshOptions();
    redraw();
  });
}

// Drag a panel's photo to pan it; scroll over it to zoom it.
let dragging = null;

function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}

canvas.addEventListener('pointerdown', (e) => {
  const { x, y } = canvasPoint(e);
  const rects = layoutPanels(state.layout, canvas.width, canvas.height);
  const hit = rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  if (hit < 0) return;
  state.selected = hit;
  const photo = state.photos[hit] ?? state.photos.find((p) => p && p.img);
  if (!photo) return;
  dragging = { photo, startX: x, startY: y, ox: photo.ox || 0, oy: photo.oy || 0, rect: rects[hit] };
  canvas.setPointerCapture(e.pointerId);
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const { x, y } = canvasPoint(e);
  dragging.photo.ox = Math.max(-0.6, Math.min(0.6, dragging.ox + (x - dragging.startX) / dragging.rect.w));
  dragging.photo.oy = Math.max(-0.6, Math.min(0.6, dragging.oy + (y - dragging.startY) / dragging.rect.h));
  redraw();
});
canvas.addEventListener('pointerup', () => { dragging = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const photo = state.photos[state.selected] ?? state.photos.find((p) => p && p.img);
  if (!photo) return;
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  photo.zoom = Math.max(1, Math.min(3, (photo.zoom || 1) * factor));
  redraw();
}, { passive: false });

captionInput.addEventListener('input', () => { state.caption = captionInput.value; redraw(); });
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });

document.getElementById('fill-all').addEventListener('click', async () => {
  const first = state.photos.find((p) => p && p.img);
  if (first) {
    fillAllPanels(first.img);
    redraw();
    return;
  }
  fillAllPanels(await loadImage('samples/pier.jpg'));
  redraw();
});
document.getElementById('sample-pier').addEventListener('click', async () => {
  fillAllPanels(await loadImage('samples/pier.jpg'));
  redraw();
});
document.getElementById('sample-boulevard').addEventListener('click', async () => {
  fillAllPanels(await loadImage('samples/boulevard.jpg'));
  redraw();
});
document.getElementById('safezone').addEventListener('change', (e) => {
  state.showSafeZone = e.target.checked;
  redraw();
});

// Renders the cover at the full export size and downloads it as a PNG.
export function exportCover() {
  const size = EXPORT_SIZES[state.sizeKey];
  const off = document.createElement('canvas');
  off.width = size.width;
  off.height = size.height;
  renderCover(off, {
    photos: visiblePhotos(),
    layout: state.layout,
    gradeKey: state.gradeKey,
    caption: state.caption,
    subtitle: state.subtitle,
    badge: BADGES[state.badgeKey],
  });
  off.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-coast-cover-${size.width}x${size.height}.png`;
    a.click();
    statusEl.textContent = `Saved vice-coast-cover-${size.width}x${size.height}.png`;
  }, 'image/png');
}
document.getElementById('export').addEventListener('click', exportCover);

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  buildSlotControls();
  refreshOptions();
  loadFonts().then(() => runShot(shot, new URLSearchParams(location.search), state, {
    loadImage,
    fillAllPanels,
    redraw,
    setCaption: (c, s) => {
      state.caption = c;
      state.subtitle = s ?? '';
      captionInput.value = c;
      subtitleInput.value = s ?? '';
    },
  }));
} else {
  loadFonts().then(() => {
    buildSlotControls();
    refreshOptions();
    redraw();
  });
}
