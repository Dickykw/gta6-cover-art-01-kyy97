// Fixed scenes for the entry's screenshots, driven by a `?shot=` query:
//   ?shot=editor — the editor page with a sample photo loaded in the panels.
//   ?shot=cover / cover-portrait / cover-wide — the cover alone, drawn by the
//     app's own renderCover engine at the export size, so the screenshot IS
//     the exported cover. `photo` / `photo2` pick the samples
//     (samples/<name>.jpg), `caption` / `subtitle` the words, `layout`,
//     `grade`, `badge` and `size` the look. window.__shotReady is set once
//     the scene is painted, so a headless browser knows when to shoot.
import { EXPORT_SIZES } from './cover.js';

function markReady() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}

export async function runShot(shot, query, state, api) {
  const caption = query.get('caption') ?? 'Sunset Heist';
  const subtitle = query.get('subtitle') ?? 'Vice City';
  state.layout = query.get('layout') ?? 'triptych';
  state.gradeKey = query.get('grade') ?? 'sunset';
  state.badgeKey = query.get('badge') ?? 'gta6';
  const sizeKey = query.get('size') ?? 'square';
  state.sizeKey = sizeKey in EXPORT_SIZES ? sizeKey : 'square';
  api.setCaption(caption, subtitle);

  const photoA = await api.loadImage(`samples/${query.get('photo') ?? 'pier'}.jpg`);
  const photoB = await api.loadImage(`samples/${query.get('photo2') ?? 'boulevard'}.jpg`);

  if (shot === 'cover' || shot === 'cover-portrait' || shot === 'cover-wide') {
    // Two samples mixed across the panels, so each panel reads as a different
    // shot of one story. Grid panels crop tall, so the photos sit lower and
    // less zoomed there to keep the subject in frame.
    const isGrid = state.layout === 'grid';
    const zoomA = isGrid ? 1.0 : 1.15;
    const zoomB = isGrid ? 1.0 : 1.1;
    const oyA = isGrid ? 0.8 : 0;
    const oyB = isGrid ? 0.95 : -0.03;
    state.photos[0] = { img: photoA, zoom: zoomA, ox: -0.05, oy: oyA };
    state.photos[1] = { img: photoB, zoom: zoomB, ox: 0.04, oy: oyB };
    state.photos[2] = { img: photoA, zoom: isGrid ? 1.0 : 1.35, ox: 0.08, oy: isGrid ? 0.8 : 0.05 };
    state.photos[3] = { img: photoB, zoom: isGrid ? 1.0 : 1.2, ox: -0.06, oy: oyB };
    document.body.classList.add('shot-cover');
    const size = EXPORT_SIZES[state.sizeKey];
    const canvas = document.getElementById('cover');
    canvas.width = size.width;
    canvas.height = size.height;
    api.redraw();
    markReady();
    return;
  }
  // Editor scene: one photo across every panel, controls visible.
  api.fillAllPanels(photoA);
  api.redraw();
  markReady();
}
