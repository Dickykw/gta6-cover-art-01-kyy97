// main.js — UI wiring for the Palm & Pistol Cover Studio.
// Loads the 7 sample photos, renders CoverArt.render() into the on-page
// canvas, and wires the controls: editable title/subtitle/tagline, 5 grades,
// per-panel photo upload, and PNG export in 3 sizes (1024, 2048, 512 px).
// Query params: ?export=dataurl  -> render once, then write the PNG data URL
//   into #export-output (used by headless verification, no download dialog).

(function () {
  'use strict';

  var SAMPLES = {
    driver: 'samples/driver.jpg',
    fixer: 'samples/fixer.jpg',
    mechanic: 'samples/mechanic.jpg',
    captain: 'samples/captain.jpg',
    rider: 'samples/rider.jpg',
    boss: 'samples/boss.jpg',
    lookout: 'samples/lookout.jpg',
  };

  var EXPORT_SIZES = [
    { label: '1024 × 576 (standard)', w: 1024, h: 576, file: 'palm-and-pistol-1024.png' },
    { label: '2048 × 1152 (large)',   w: 2048, h: 1152, file: 'palm-and-pistol-2048.png' },
    { label: '512 × 288 (small)',     w: 512,  h: 288,  file: 'palm-and-pistol-512.png' },
  ];

  var state = CoverArt.cloneState(null);
  var images = {};
  var canvas = null;
  var statusEl = null;

  function $(id) { return document.getElementById(id); }

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  function loadImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  function renderAll() {
    if (!canvas) return;
    var info = CoverArt.render(canvas, images, state, 1024, 576);
    setStatus('Rendered ' + info.roles + ' characters · grade: ' + state.grade +
      ' · ' + info.width + '×' + info.height);
  }

  function download(url, filename) {
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function exportPNG(size) {
    var off = document.createElement('canvas');
    CoverArt.render(off, images, state, size.w, size.h);
    return off.toDataURL('image/png');
  }

  function buildPanelList() {
    var list = $('panel-list');
    if (!list) return;
    list.innerHTML = '';
    CoverArt.ROLES.forEach(function (role) {
      var row = document.createElement('div');
      row.className = 'panel-row';
      var label = document.createElement('span');
      label.className = 'panel-label';
      label.textContent = role.label + (role.hero ? ' ★ hero' : '');
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.setAttribute('aria-label', 'Replace photo for ' + role.label);
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (!file) return;
        var url = URL.createObjectURL(file);
        loadImage(url).then(function (img) {
          if (img) {
            images[role.id] = img;
            renderAll();
            setStatus(role.label + ' photo replaced from your upload.');
          }
        });
      });
      var reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'mini-btn';
      reset.textContent = 'Reset';
      reset.addEventListener('click', function () {
        loadImage(SAMPLES[role.id]).then(function (img) {
          images[role.id] = img;
          renderAll();
        });
      });
      row.appendChild(label);
      row.appendChild(input);
      row.appendChild(reset);
      list.appendChild(row);
    });
  }

  function buildGradeButtons() {
    var wrap = $('grade-buttons');
    if (!wrap) return;
    wrap.innerHTML = '';
    CoverArt.GRADE_ORDER.forEach(function (g) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'grade-btn' + (state.grade === g ? ' active' : '');
      b.textContent = g.charAt(0).toUpperCase() + g.slice(1);
      b.addEventListener('click', function () {
        state.grade = g;
        wrap.querySelectorAll('.grade-btn').forEach(function (el) {
          el.classList.toggle('active', el.textContent.toLowerCase() === g);
        });
        renderAll();
      });
      wrap.appendChild(b);
    });
  }

  function buildExportButtons() {
    var wrap = $('export-buttons');
    if (!wrap) return;
    wrap.innerHTML = '';
    EXPORT_SIZES.forEach(function (size) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'export-btn';
      b.textContent = 'PNG ' + size.label;
      b.addEventListener('click', function () {
        download(exportPNG(size), size.file);
        setStatus('Exported ' + size.file + ' (' + size.w + '×' + size.h + ').');
      });
      wrap.appendChild(b);
    });
  }

  function bindTextInputs() {
    var map = { 'title-input': 'title', 'subtitle-input': 'subtitle', 'tagline-input': 'tagline' };
    Object.keys(map).forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.value = state[map[id]];
      el.addEventListener('input', function () {
        state[map[id]] = el.value || CoverArt.DEFAULT_STATE[map[id]];
        renderAll();
      });
    });
  }

  function params() {
    var out = {};
    var q = window.location.search.replace(/^\?/, '');
    q.split('&').forEach(function (pair) {
      var kv = pair.split('=');
      if (kv[0]) out[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
    });
    return out;
  }

  function init() {
    canvas = $('poster');
    statusEl = $('status');
    bindTextInputs();
    buildGradeButtons();
    buildExportButtons();
    buildPanelList();
    var keys = Object.keys(SAMPLES);
    var loads = keys.map(function (k) { return loadImage(SAMPLES[k]); });
    Promise.all(loads).then(function (imgs) {
      keys.forEach(function (k, i) { images[k] = imgs[i]; });
      var p = params();
      if (p.grade && CoverArt.GRADE_ORDER.indexOf(p.grade) !== -1) {
        state.grade = p.grade;
        buildGradeButtons();
      }
      renderAll();
      if (p.export === 'dataurl') {
        // Headless verification path: put the exported PNG data URL in the DOM.
        var out = $('export-output');
        if (out) out.textContent = exportPNG(EXPORT_SIZES[0]);
        document.title = 'EXPORT_READY';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
