// Vice Coast Cover Studio — wires the editor page: pick photos per panel,
// type the caption, choose layout / grade / size / badge, drag a panel's photo
// to position it, scroll to zoom it, and export a PNG. A `?shot=` query sets
// up a fixed scene for a screenshot instead (./shots.js).
import { EXPORT_SIZES, LAYOUTS, GRADES, BADGES, panelRects, drawCover } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
const captionInput = document.getElementById('caption');
const subtitleInput = document.getElementById('subtitle');

const state = {
  photos: [null, null, null, null], // one slot per panel, at most 4 (grid)
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
  return state.layout === 'grid' ? 4 : state.layout === 'fullbleed' ? 1 : 3;
}

function activePhotos() {
  return state.photos.slice(0, panelCount());
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

/** Waits until the vendored display fonts are usable on the canvas. */
export async function loadFonts() {
  await Promise.all([
    document.fonts.load('100px "Bebas Neue"'),
    document.fonts.load('600 40px "Oswald"'),
    document.fonts.load('700 40px "Oswald"'),
    document.fonts.load('400 20px "Montserrat Alternates"'),
  ]);
  await document.fonts.ready;
}

function previewSize() {
  const size = EXPORT_SIZES[state.sizeKey];
  const scale = 640 / Math.max(size.width, size.height);
  return { width: Math.round(size.width * scale), height: Math.round(size.height * scale) };
}

function redraw() {
  const coverMode = document.body.classList.contains('shot-cover');
  const size = EXPORT_SIZES[state.sizeKey];
  const { width, height } = coverMode ? size : previewSize();
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  drawCover(canvas, {
    photos: activePhotos(),
    layout: state.layout,
    gradeKey: state.gradeKey,
    caption: state.caption,
    subtitle: state.subtitle,
    badge: BADGES[state.badgeKey],
  });
  if (coverMode) return; // the exported cover carries no editor guides
  if (state.showSafeZone) drawSafeZone();
  markSelectedPanel();
}

/** 5% safe-zone guides on the preview only — never in the export. */
function drawSafeZone() {
  const ctx = canvas.getContext('2d');
  const m = canvas.width * 0.05;
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 5]);
  ctx.strokeRect(m, m, canvas.width - m * 2, canvas.height - m * 2);
  ctx.restore();
}

/** Outlines the selected panel so the user sees which photo they move. */
function markSelectedPanel() {
  const rects = panelRects(state.layout, canvas.width, canvas.height);
  const rect = rects[state.selected];
  if (!rect) return;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 3;
  ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
  ctx.restore();
}

/** Fills every panel slot with one photo (its own crop per panel). */
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
canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  const rects = panelRects(state.layout, canvas.width, canvas.height);
  const hit = rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  if (hit < 0) return;
  state.selected = hit;
  const photo = state.photos[hit] ?? state.photos.find((p) => p && p.img);
  if (!photo) return;
  dragging = { photo, startX: x, startY: y, ox: photo.ox ?? 0, oy: photo.oy ?? 0, rect: rects[hit] };
  canvas.setPointerCapture(e.pointerId);
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  dragging.photo.ox = Math.max(-0.6, Math.min(0.6, dragging.ox + (x - dragging.startX) / dragging.rect.w));
  dragging.photo.oy = Math.max(-0.6, Math.min(0.6, dragging.oy + (y - dragging.startY) / dragging.rect.h));
  redraw();
});
canvas.addEventListener('pointerup', () => { dragging = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const photo = state.photos[state.selected] ?? state.photos.find((p) => p && p.img);
  if (!photo) return;
  photo.zoom = Math.max(1, Math.min(3, (photo.zoom ?? 1) * (e.deltaY < 0 ? 1.1 : 0.9)));
  redraw();
}, { passive: false });

captionInput.addEventListener('input', () => { state.caption = captionInput.value; redraw(); });
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });

document.getElementById('fill-all').addEventListener('click', async () => {
  const first = state.photos.find((p) => p && p.img);
  if (first) { fillAllPanels(first.img); redraw(); return; }
  const img = await loadImage('samples/pier.jpg');
  fillAllPanels(img);
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

/** Renders the cover at full export size and downloads it as a PNG. */
export function exportCover() {
  const size = EXPORT_SIZES[state.sizeKey];
  const off = document.createElement('canvas');
  off.width = size.width;
  off.height = size.height;
  drawCover(off, {
    photos: activePhotos(),
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
    loadImage, fillAllPanels, redraw, setCaption: (c, s) => {
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
