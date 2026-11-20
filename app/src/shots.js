// Fixed scenes for screenshots: ?shot=editor shows the page with a sample
// photo loaded; ?shot=cover shows the cover alone, drawn by the app's own
// cover engine at the export size. `photo` picks the sample
// (samples/<photo>.jpg) and `caption` the words; `layout`, `grade` and `size`
// pick the cover's look. window.__shotReady is set once painted.
import { EXPORT_SIZES } from './cover.js';

function paintWhenReady() {
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
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
  // One photo fills all panels in the editor shot; the cover shot mixes two
  // samples so the panels read as separate shots of one story.
  if (shot === 'cover' || shot === 'cover-wide' || shot === 'cover-portrait') {
    // Wide grid panels crop vertically, so the photos sit lower (and less
    // zoomed) to keep faces in frame.
    const isGrid = state.layout === 'grid';
    const zoomA = isGrid ? 1.0 : 1.15;
    const zoomB = isGrid ? 1.0 : 1.1;
    const oyA = isGrid ? 0.45 : 0;
    const oyB = isGrid ? 0.4 : -0.03;
    state.photos[0] = { img: photoA, zoom: zoomA, ox: -0.05, oy: oyA };
    state.photos[1] = { img: photoB, zoom: zoomB, ox: 0.04, oy: oyB };
    state.photos[2] = { img: photoA, zoom: isGrid ? 1.0 : 1.35, ox: 0.08, oy: isGrid ? 0.45 : 0.05 };
    state.photos[3] = { img: photoB, zoom: isGrid ? 1.0 : 1.2, ox: -0.06, oy: oyB };
    document.body.classList.add('shot-cover');
    // Draw at the export size itself: the screenshot is the exported cover.
    const size = EXPORT_SIZES[state.sizeKey];
    const canvas = document.getElementById('cover');
    canvas.width = size.width;
    canvas.height = size.height;
    api.redraw();
    paintWhenReady();
    return;
  }
  // Editor scene: one photo across the panels, controls visible.
  api.fillAllPanels(photoA);
  api.redraw();
  paintWhenReady();
}
