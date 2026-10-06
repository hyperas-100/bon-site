/* Adapted from cudam321.com (https://github.com/cudam321/cudam321.com), MIT License © 2026 Cudam — see LICENSE. */
/* space-bg.js — animated ASCII backgrounds, one variant per section (track / results / skills / contact).
   SpaceBG.mount(canvas, {variant}) -> { setVariant(name), setActive(bool), destroy() }
   A dim monospace ASCII field rendered behind the overlay content. Pauses when inactive,
   tab-hidden, or prefers-reduced-motion. No dependencies. */
(function () {
  'use strict';
  var FIELD = " .:-=+*oxX#%@&";              // density ramp (dark -> bright)
  var STARC = ['·', '.', '*', '+', '✦', '•'];
  function reduce() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function rnd(s) { var x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function hash(x, y) { var n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return n - Math.floor(n); }
  function vnoise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  }
  function fbm(x, y) { return vnoise(x, y) * 0.6 + vnoise(x * 2.03, y * 2.03) * 0.28 + vnoise(x * 4.01, y * 4.01) * 0.12; }
  function ramp(stops, t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    for (var i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        var a = stops[i - 1], b = stops[i], k = (t - a[0]) / ((b[0] - a[0]) || 1);
        return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k];
      }
    }
    var l = stops[stops.length - 1]; return [l[1], l[2], l[3]];
  }
  var PAL = {
    full:   [[0, 14, 18, 50], [0.4, 24, 110, 140], [0.7, 175, 70, 155], [1, 245, 210, 160]],
    violet: [[0, 20, 18, 46], [0.5, 135, 100, 215], [1, 165, 220, 240]],
    cyan:   [[0, 12, 36, 60], [0.6, 50, 165, 195], [1, 195, 240, 245]]
  };
  var CONF = {
    track:   { kind: 'warp',  col: [46, 230, 166], spd: 1 },
    results: { kind: 'grid',  col: [255, 190, 90], spd: 0.6 },
    skills:  { kind: 'orbit', col: [46, 230, 166], spd: 0.7 },
    contact: { kind: 'radar', col: [46, 230, 166], spd: 0.7 }
  };

  function mount(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d', { alpha: true });
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var fontSize = opts.fontSize || (window.innerWidth < 760 ? 14 : 16);
    var variant = opts.variant || 'track';
    var W = 1, H = 1, cw = 9, ch = 16, cols = 10, rows = 10;
    var t = 0, last = 0, raf = 0, active = false, hidden = !!document.hidden, destroyed = false;
    var parts = [], bstars = [];
    function cfg() { return CONF[variant] || CONF.track; }

    function resize() {
      var box = canvas.getBoundingClientRect();
      W = Math.max(1, Math.round(box.width)); H = Math.max(1, Math.round(box.height || window.innerHeight));
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = fontSize + 'px ui-monospace, "SF Mono", Menlo, monospace';
      ctx.textBaseline = 'top';
      cw = ctx.measureText('M').width || fontSize * 0.6;
      ch = Math.round(fontSize * 1.05);
      cols = Math.ceil(W / cw) + 1; rows = Math.ceil(H / ch) + 1;
      bstars = []; var bn = Math.round(cols * rows * 0.03);
      for (var i = 0; i < bn; i++) bstars.push({ x: rnd(i * 1.7) * cols, y: rnd(i * 2.3 + 5) * rows, b: 0.18 + rnd(i * 3.1) * 0.4, ph: rnd(i) * 6.28, c: rnd(i + 4) < 0.12 ? '+' : '.' });
      initParts();
    }
    function newWarp(i) { return { a: rnd(i * 2.7) * 6.283, r: rnd(i * 1.3) * 0.5, sp: 0.4 + rnd(i * 3.1) * 1.6 }; }
    function newComet(i) { return { x: -rnd(i) * cols * 0.7 - 4, y: rnd(i + 3) * rows * 0.85, vx: 0.35 + rnd(i + 1) * 0.5, len: 7 + ((rnd(i + 2) * 11) | 0) }; }
    function initParts() {
      parts = []; var c = cfg(), i, n;
      if (c.kind === 'stars') { n = Math.round(cols * rows * 0.08);
        for (i = 0; i < n; i++) parts.push({ x: rnd(i) * cols, y: rnd(i + 9) * rows, z: 0.3 + rnd(i + 5) * 0.7, c: STARC[(rnd(i + 2) * STARC.length) | 0] }); }
      else if (c.kind === 'warp') { for (i = 0; i < 280; i++) parts.push(newWarp(i)); }
      else if (c.kind === 'comet') { for (i = 0; i < 12; i++) parts.push(newComet(i)); }
      else if (c.kind === 'orbit') { for (i = 0; i < 95; i++) parts.push({ a: rnd(i) * 6.283, r: 0.08 + rnd(i + 3) * 0.92, sp: (0.15 + rnd(i + 7) * 0.7) * (rnd(i + 1) < 0.5 ? -1 : 1), e: 0.42 + rnd(i + 4) * 0.22, c: STARC[(rnd(i + 2) * 4) | 0] }); }
      else if (c.kind === 'rise') { n = Math.round(cols * 1.1);
        for (i = 0; i < n; i++) parts.push({ x: rnd(i) * cols, y: rnd(i + 2) * rows, sp: 0.25 + rnd(i + 5) * 0.7, c: STARC[(rnd(i + 3) * 4) | 0] }); }
    }
    function setF(r, g, b, al) { ctx.fillStyle = 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + al + ')'; }
    function streak(a) {
      var d = ((a % 6.283) + 6.283) % 6.283;
      if (d < 0.39 || (d > 2.75 && d < 3.53) || d > 5.89) return '—';
      if ((d > 1.18 && d < 1.96) || (d > 4.32 && d < 5.10)) return '|';
      if ((d > 0.39 && d < 1.18) || (d > 3.53 && d < 4.32)) return '\\';
      return '/';
    }
    function drawBaseStars() {
      for (var i = 0; i < bstars.length; i++) { var s = bstars[i], tw = s.b * (0.55 + 0.45 * Math.sin(t * 1.2 + s.ph)); setF(150, 178, 210, tw); ctx.fillText(s.c, s.x * cw, s.y * ch); }
    }

    function drawNebula() {
      var c = cfg(), pal = PAL[c.pal] || PAL.full, sc = 0.055, ox = t * 0.06 * c.spd, oy = t * 0.024 * c.spd;
      for (var ry = 0; ry < rows; ry++) {
        for (var cx = 0; cx < cols; cx++) {
          var v = fbm(cx * sc + ox, ry * sc * 1.7 + oy); v = (v - 0.36) / 0.44;
          if (v <= 0.1) continue;
          var col = ramp(pal, v), ci = (v * (FIELD.length - 1)) | 0;
          setF(col[0], col[1], col[2], 0.55);
          ctx.fillText(FIELD[ci > 13 ? 13 : ci], cx * cw, ry * ch);
        }
      }
    }
    function drawWave() {
      var c = cfg(), k = c.col;
      for (var ry = 0; ry < rows; ry++) {
        var y = ry / rows;
        for (var cx = 0; cx < cols; cx++) {
          var x = cx / cols;
          var v = Math.sin(x * 13 - t * 1.5 * c.spd) * Math.cos(y * 7 + t * 0.6) + Math.sin((x + y) * 9 + t) * 0.8 + Math.sin(x * 5 - t * 0.9);
          v = (v + 2.8) / 5.6;
          var band = Math.abs(y - 0.5 - 0.18 * Math.sin(x * 8 - t * 1.2));
          if (v < 0.5 && band > 0.16) continue;
          var ci = (v * (FIELD.length - 1)) | 0; if (ci < 1) continue;
          var g = band < 0.06 ? 1.25 : 0.7;
          setF(k[0], k[1], k[2], Math.min(0.85, 0.5 * v * g));
          ctx.fillText(FIELD[ci > 13 ? 13 : ci], cx * cw, ry * ch);
        }
      }
    }
    function drawGrid() {
      var c = cfg(), k = c.col, scan = (t * c.spd * 6) % (rows + 10) - 5;
      for (var ry = 0; ry < rows; ry++) {
        for (var cx = 0; cx < cols; cx++) {
          if (cx % 6 !== 0 && ry % 3 !== 0) continue;
          var node = (cx % 6 === 0 && ry % 3 === 0);
          var dd = Math.abs(ry - scan), al = dd < 6 ? (1 - dd / 6) * 0.8 : 0.16;
          if (!node && al < 0.22) continue;
          setF(k[0], k[1], k[2], node ? 0.3 + al * 0.7 : al * 0.55);
          ctx.fillText(node ? '+' : '·', cx * cw, ry * ch);
        }
      }
    }
    function drawRadar() {
      var c = cfg(), k = c.col, cx0 = cols / 2, cy0 = rows / 2, ang = t * c.spd * 0.7, asp = ch / cw, maxR = Math.max(cols, rows);
      for (var ringi = 1; ringi <= 3; ringi++) { var rr = ringi / 3 * Math.min(cols, rows) * 0.46; for (var a = 0; a < 6.283; a += 0.11) { var px = cx0 + Math.cos(a) * rr, py = cy0 + Math.sin(a) * rr / asp; setF(k[0], k[1], k[2], 0.14); ctx.fillText('·', px * cw, py * ch); } }
      for (var tr = 0; tr < 10; tr++) { var aa = ang - tr * 0.08, al = (1 - tr / 10) * 0.75; for (var r = 0; r < maxR; r += 1) { var px2 = cx0 + Math.cos(aa) * r, py2 = cy0 + Math.sin(aa) * r / asp; if (px2 < 0 || px2 >= cols || py2 < 0 || py2 >= rows) break; setF(k[0], k[1], k[2], al); ctx.fillText(tr === 0 ? '+' : '·', px2 * cw, py2 * ch); } }
      for (var bi = 0; bi < 12; bi++) { var ba = rnd(bi) * 6.283, br = (0.2 + rnd(bi + 5) * 0.7) * Math.min(cols, rows) * 0.46; var bx = cx0 + Math.cos(ba) * br, by = cy0 + Math.sin(ba) * br / asp; var lit = ((ba - ang) % 6.283 + 6.283) % 6.283; var bl = lit < 1.3 ? (1 - lit / 1.3) : 0; setF(190, 255, 225, 0.18 + bl * 0.75); ctx.fillText('✦', bx * cw, by * ch); }
    }
    function drawStars(dt) {
      var c = cfg(), k = c.col;
      for (var i = 0; i < parts.length; i++) { var p = parts[i];
        p.x -= dt * c.spd * p.z * 1.7; if (p.x < 0) { p.x += cols; p.y = rnd(i + (t | 0)) * rows; }
        setF(k[0], k[1], k[2], 0.3 + p.z * 0.55); ctx.fillText(p.c, p.x * cw, p.y * ch); }
    }
    function drawWarp(dt) {
      var c = cfg(), k = c.col, cx0 = cols / 2, cy0 = rows / 2;
      for (var i = 0; i < parts.length; i++) { var p = parts[i];
        p.r += dt * c.spd * (0.25 + p.sp) * 0.2; if (p.r > 0.85) { parts[i] = newWarp(i + (t * 13 | 0)); parts[i].r = 0.02; continue; }
        var px = cx0 + Math.cos(p.a) * p.r * cols, py = cy0 + Math.sin(p.a) * p.r * rows;
        if (px < 0 || px >= cols || py < 0 || py >= rows) continue;
        setF(k[0], k[1], k[2], Math.min(1, p.r * 2.2) * 0.85);
        ctx.fillText(p.r > 0.3 ? streak(p.a) : '·', px * cw, py * ch); }
    }
    function drawComet(dt) {
      var c = cfg(), k = c.col;
      for (var i = 0; i < parts.length; i++) { var p = parts[i];
        p.x += dt * c.spd * p.vx * 28; if (p.x - p.len > cols) { parts[i] = newComet(i + (t * 7 | 0)); parts[i].x = -parts[i].len; continue; }
        for (var s = 0; s < p.len; s++) { var px = p.x - s, py = p.y + s * 0.45; if (px < 0 || px >= cols || py >= rows) continue; var al = (1 - s / p.len) * 0.85; setF(k[0], k[1], k[2], al); ctx.fillText(s === 0 ? '✦' : (s < 3 ? '*' : '·'), px * cw, py * ch); } }
    }
    function drawOrbit(dt) {
      var c = cfg(), k = c.col, cx0 = cols / 2, cy0 = rows / 2;
      for (var i = 0; i < parts.length; i++) { var p = parts[i]; p.a += dt * c.spd * p.sp * 0.3;
        var px = cx0 + Math.cos(p.a) * p.r * cols * 0.46, py = cy0 + Math.sin(p.a) * p.r * p.e * rows * 0.9;
        if (px < 0 || px >= cols || py < 0 || py >= rows) continue;
        setF(k[0], k[1], k[2], 0.35 + (1 - p.r) * 0.5); ctx.fillText(p.c, px * cw, py * ch); }
      setF(255, 205, 120, 0.7); ctx.fillText('⊙', cx0 * cw, cy0 * ch);
    }
    function drawRise(dt) {
      var c = cfg(), k = c.col;
      for (var i = 0; i < parts.length; i++) { var p = parts[i]; p.y -= dt * c.spd * p.sp * 1.5; p.x += Math.sin(t * 0.5 + i) * 0.02;
        if (p.y < 0) { p.y += rows; p.x = rnd(i + (t | 0)) * cols; }
        setF(k[0], k[1], k[2], 0.3 + p.sp * 0.55); ctx.fillText(p.c, p.x * cw, p.y * ch); }
    }

    function frame(dt) {
      ctx.clearRect(0, 0, W, H);
      var kind = cfg().kind;
      if (kind !== 'nebula') drawBaseStars();
      if (kind === 'nebula') drawNebula();
      else if (kind === 'wave') drawWave();
      else if (kind === 'grid') drawGrid();
      else if (kind === 'radar') drawRadar();
      else if (kind === 'stars') drawStars(dt);
      else if (kind === 'warp') drawWarp(dt);
      else if (kind === 'comet') drawComet(dt);
      else if (kind === 'orbit') drawOrbit(dt);
      else if (kind === 'rise') drawRise(dt);
    }

    var acc = 0, FPS = 30;
    function loop(now) {
      if (destroyed) return;
      var dt = (now - last) / 1000; last = now; if (dt > 0.1) dt = 0.1;
      acc += dt;
      if (acc >= 1 / FPS) { t += acc; frame(acc); acc = 0; }
      if (active && !hidden) raf = requestAnimationFrame(loop); else raf = 0;
    }
    function run() { if (raf || destroyed || !active || hidden) return; last = performance.now(); raf = requestAnimationFrame(loop); }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    function onVis() { hidden = !!document.hidden; if (hidden) stop(); else run(); }

    document.addEventListener('visibilitychange', onVis);
    canvas.addEventListener('contextlost', function (e) { e.preventDefault(); stop(); }, false);
    canvas.addEventListener('contextrestored', function () { resize(); frame(0); if (active && !hidden) run(); }, false);
    var ro = ('ResizeObserver' in window) ? new ResizeObserver(function () { resize(); if (!active || reduce()) frame(0); }) : null;
    if (ro) ro.observe(canvas);
    resize();
    if (reduce()) { frame(0); }

    return {
      setVariant: function (v) { if (v === variant) return; variant = v; t = rnd((v || '').length + 1) * 40; initParts(); if (active && !reduce()) frame(0); },
      setActive: function (b) { active = !!b; if (reduce()) { frame(0); return; } if (active) run(); else stop(); },
      destroy: function () { destroyed = true; stop(); document.removeEventListener('visibilitychange', onVis); if (ro) ro.disconnect(); }
    };
  }

  window.SpaceBG = { mount: mount };
})();
