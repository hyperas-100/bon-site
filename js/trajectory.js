/* Adapted from cudam321.com (https://github.com/cudam321/cudam321.com), MIT License © 2026 Cudam — see LICENSE. */
/* trajectory.js — one-button warp-flight through a career chart (adapted engine: planets climb a rising price line).
   Hold WARP (space / arrow / the on-screen button) and the ship cinematically warps along an
   on-rails path from planet to planet; each dock blooms a dossier and ticks a REACH counter.
   You cannot get lost or misfly. Dense nebula + parallax starfields that stretch into warp
   streaks + pre-rendered shaded ASCII planets that grow with each role.
   Trajectory.mount(canvas, { systems, onDock }) -> { setActive, thrust(dir), warpTo(i), destroy }
   system: { label, color:[r,g,b], size, level 0..1 (chart height), stat (HUD text), mono (planet letters), seed, live }
   No deps. Pauses when inactive/hidden; respects prefers-reduced-motion. */
(function () {
  'use strict';
  var RAMP = " .:-=+*oxX#%@&";
  var SHIP = ["  ▄█▄", " ▟███▙", "▐██◉██▌ ➤", " ▜███▛", "  ▀█▀"];
  function reduce() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function rnd(s) { var x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function hash(x, y) { var n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return n - Math.floor(n); }
  function vnoise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), e = hash(xi + 1, yi + 1);
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + e * u * v;
  }
  function fbm(x, y) { return vnoise(x, y) * 0.6 + vnoise(x * 2.03, y * 2.03) * 0.28 + vnoise(x * 4.01, y * 4.01) * 0.12; }
  function easeWarp(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }   // ease-in-out cubic
  function lerp(a, b, t) { return a + (b - a) * t; }

  function mount(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d', { alpha: true });
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var systems = opts.systems || [];
    var onDock = opts.onDock || function () {};
    var W = 1, H = 1, worldW = 1, worldH = 1;
    var pts = [], D = [], planets = [], nebula = null, stars = [];
    var cur = 0, warping = false, wprog = 0, wfrom = 0, wto = 0, d = 0, dir = 0, dwell = 0, streak = 0;
    var camx = 0, camy = 0, t = 0, active = false, hidden = !!document.hidden, destroyed = false, raf = 0, last = 0, acc = 0, trail = [];

    function growthNorm(reach) { return Math.log(1 + reach / 8) / Math.log(1 + 400 / 8); }   // 0..1 (log scaled)

    function preNebula() {
      var nv = document.createElement('canvas'); nv.width = W; nv.height = H;
      var c = nv.getContext('2d'); var fs = 15, cw = fs * 0.6, ch = fs * 1.05;
      c.font = fs + 'px ui-monospace, Menlo, monospace'; c.textBaseline = 'top';
      var cols = Math.ceil(W / cw), rows = Math.ceil(H / ch);
      var pal = [[0, 6, 22, 24], [0.4, 14, 82, 70], [0.7, 130, 74, 40], [1, 40, 150, 112]];
      for (var ry = 0; ry < rows; ry++) for (var cx = 0; cx < cols; cx++) {
        var v = fbm(cx * 0.05, ry * 0.085); v = (v - 0.52) / 0.42; if (v <= 0.12) continue;   // wispy clouds with dark gaps, not a wall
        var col, i; for (i = 1; i < pal.length; i++) { if (v <= pal[i][0]) break; } i = Math.min(i, pal.length - 1);
        var a = pal[i - 1], b = pal[i], k = (v - a[0]) / ((b[0] - a[0]) || 1);
        col = [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k];
        c.fillStyle = 'rgba(' + (col[0] | 0) + ',' + (col[1] | 0) + ',' + (col[2] | 0) + ',' + (0.16 + 0.2 * v).toFixed(2) + ')';
        c.fillText(RAMP[Math.min(13, (v * 13) | 0)], cx * cw, ry * ch);
      }
      return nv;
    }
    function prePlanet(sys) {
      var Rc = (sys.size != null ? sys.size : Math.round(5 + growthNorm(sys.reach || 0) * 16)) + (sys.live ? 2 : 0);
      var fs = 7, cw = fs * 0.62, ch = fs * 0.92, Rpx = Rc * 7, pad = 7;
      var cv = document.createElement('canvas'); cv.width = Math.round(Rpx * 2 + pad * 2); cv.height = cv.width;
      var c = cv.getContext('2d'); c.font = fs + 'px ui-monospace, Menlo, monospace'; c.textBaseline = 'middle'; c.textAlign = 'center';
      var col = sys.color || [150, 180, 210], cx0 = cv.width / 2, cy0 = cv.height / 2, sd = sys.seed || 1;
      var cols = Math.ceil(Rpx / cw), rows = Math.ceil(Rpx / ch), logoG = null, lN = 0;
      // render the round sphere (visual space); a loaded logo is EMBOSSED into the planet's own surface + colour
      function paint() {
        c.clearRect(0, 0, cv.width, cv.height); c.font = fs + 'px ui-monospace, Menlo, monospace';
        for (var dy = -rows; dy <= rows; dy++) for (var dx = -cols; dx <= cols; dx++) {
          var vx = dx * cw, vy = dy * ch, nx = vx / Rpx, ny = vy / Rpx, r2 = nx * nx + ny * ny; if (r2 > 1) continue;
          var z = Math.sqrt(1 - r2), lon = Math.atan2(nx, z), lat = Math.asin(Math.max(-1, Math.min(1, ny)));
          var tex = fbm(lon * 2.2 + sd * 9, lat * 2.6 + sd * 3) * 0.6 + fbm(lon * 5 + sd, lat * 5) * 0.4;
          var light = Math.max(0.12, (-nx * 0.45 - ny * 0.4 + z * 0.85)), br = Math.min(1, light * (0.55 + 0.7 * tex));
          var r = col[0], g = col[1], b = col[2];
          if (logoG) {
            var lr = 0.6 * (sys.logoScale || 1), lx = nx / lr * 0.5 + 0.5, ly = ny / lr * 0.5 + 0.5;   // sits inside the planet
            if (lx >= 0 && lx < 1 && ly >= 0 && ly < 1) {
              var L = logoG[((ly * lN) | 0) * lN + ((lx * lN) | 0)];
              if (L > 0.42) {   // ONLY the logo's bright mark embosses; its background never touches the planet (no rectangular edge)
                br = Math.min(1, br * (1 + 0.8 * L));
                r = r * 0.5 + 135; g = g * 0.5 + 135; b = b * 0.5 + 135;
              }
            }
          }
          c.fillStyle = 'rgb(' + Math.min(255, r * br + 22) + ',' + Math.min(255, g * br + 22) + ',' + Math.min(255, b * br + 22) + ')';
          c.fillText(RAMP[Math.max(1, Math.min(13, (br * 13) | 0))], cx0 + vx, cy0 + vy);
        }
        if (!sys.logo && sys.mono) { c.font = '700 ' + Math.round(Rpx * 0.62) + 'px "Space Mono", ui-monospace, monospace'; c.fillStyle = 'rgba(244,248,252,0.96)'; c.fillText(sys.mono, cx0, cy0 + 1); }
      }
      paint();
      if (!sys.logo && sys.mono && document.fonts && document.fonts.load) { document.fonts.load('700 ' + Math.round(Rpx * 0.62) + 'px "Space Mono"').then(function () { paint(); }, function () {}); }
      return { cv: cv, R: Rpx, w: cv.width, h: cv.height };
    }
    function buildStars() {
      stars = [];
      [[0.16, 70, 86, 110, 0.5], [0.4, 70, 130, 160, 0.7], [0.78, 50, 180, 210, 0.95]].forEach(function (dl, li) {
        var n = Math.round(W * H / 7000 * (li + 1)), arr = [];
        for (var i = 0; i < n; i++) arr.push({ x: rnd(i + li * 70) * W, y: rnd(i + li * 131 + 9) * H, b: 0.3 + rnd(i + li) * 0.6 });
        stars.push({ f: dl[0], col: [dl[1], dl[2], dl[3]], a: dl[4], s: arr });
      });
    }
    function size() {
      W = Math.max(1, Math.min(2600, canvas.offsetWidth || 900));
      H = Math.max(1, Math.min(2000, canvas.offsetHeight || 460));
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      worldW = Math.max(W * 2.4, systems.length * 230); worldH = H * 1.25;
      pts = []; D = [0]; var n = systems.length;
      for (var i = 0; i < n; i++) {
        var x = (0.07 + (n > 1 ? i / (n - 1) : 0) * 0.86) * worldW;
        var lv = systems[i].level != null ? systems[i].level : growthNorm(systems[i].reach || 0);
        var y = (0.74 - lv * 0.5 + (i % 2 ? 0.04 : -0.04)) * worldH;
        pts.push({ x: x, y: y });
        if (i > 0) D[i] = D[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      }
      planets = systems.map(prePlanet);
      nebula = preNebula(); buildStars();
      d = D[cur]; snapCam();
    }
    function shipAt(dist) {
      if (dist <= D[0]) return { x: pts[0].x, y: pts[0].y, a: Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) };
      var last2 = D.length - 1; if (dist >= D[last2]) return { x: pts[last2].x, y: pts[last2].y, a: Math.atan2(pts[last2].y - pts[last2 - 1].y, pts[last2].x - pts[last2 - 1].x) };
      for (var i = 1; i < D.length; i++) if (dist <= D[i]) { var k = (dist - D[i - 1]) / ((D[i] - D[i - 1]) || 1); return { x: lerp(pts[i - 1].x, pts[i].x, k), y: lerp(pts[i - 1].y, pts[i].y, k), a: Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x) }; }
      return { x: pts[0].x, y: pts[0].y, a: 0 };
    }

    function setF(r, g, b, a) { ctx.fillStyle = 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + a + ')'; }
    function drawNebula() {
      if (!nebula) return; var ox = -(camx * 0.12) % W, oy = -(camy * 0.12) % H; if (ox > 0) ox -= W; if (oy > 0) oy -= H;
      for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) ctx.drawImage(nebula, ox + i * W, oy + j * H);
    }
    function drawStars() {
      for (var li = 0; li < stars.length; li++) {
        var L = stars[li], ox = -camx * L.f, oy = -camy * L.f; ox = ((ox % W) + W) % W; oy = ((oy % H) + H) % H;
        var stretch = streak * L.f * 60;
        ctx.font = (li === 2 ? 12 : 10) + 'px ui-monospace, Menlo, monospace';
        for (var i = 0; i < L.s.length; i++) {
          var s = L.s[i], px = (s.x + ox) % W, py = (s.y + oy) % H, tw = L.a * s.b;
          if (stretch > 2) { ctx.strokeStyle = 'rgba(' + L.col[0] + ',' + L.col[1] + ',' + L.col[2] + ',' + (tw * 0.9) + ')'; ctx.lineWidth = li === 2 ? 1.4 : 0.8; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - stretch, py - stretch * 0.18); ctx.stroke(); }
          else { setF(L.col[0], L.col[1], L.col[2], tw * (0.6 + 0.4 * Math.sin(t * 1.4 + i))); ctx.fillText(li === 2 ? '+' : '.', px, py); }
        }
      }
    }
    function drawPath() {
      ctx.font = '11px ui-monospace, Menlo, monospace';
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i], segs = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 16));
        for (var s2 = 0; s2 <= segs; s2++) {
          var k = s2 / segs, px = lerp(a.x, b.x, k) - camx, py = lerp(a.y, b.y, k) - camy;
          if (px < -20 || px > W + 20) continue;
          var done = D[i - 1] + k * (D[i] - D[i - 1]) < d - 4;
          var fl = 0.5 + 0.5 * Math.sin(t * 3 - (D[i - 1] + k * 60) * 0.08);
          if (done) setF(46, 230, 166, 0.34); else setF(120, 134, 158, 0.16 + fl * 0.12);
          ctx.fillText(done ? '·' : '·', px, py);
        }
      }
    }
    function drawPlanets() {
      for (var i = 0; i < planets.length; i++) {
        var p = planets[i], px = pts[i].x - camx, py = pts[i].y - camy - p.R * 0.66; if (px < -p.w - 40 || px > W + p.w + 40) continue;
        var co = systems[i].color, pop = (i === cur) ? (1 + 0.05 * Math.sin(t * 3)) : 1, gR = p.R * (i === cur ? 2.0 : 1.5);
        // dark backing clears the nebula so the planet reads cleanly, then a colored atmosphere glow
        setF(6, 8, 12, 0.74); ctx.beginPath(); ctx.arc(px, py, p.R * 1.2, 0, 6.283); ctx.fill();
        var gr = ctx.createRadialGradient(px, py, p.R * 0.55, px, py, gR);
        gr.addColorStop(0, 'rgba(' + (co[0] | 0) + ',' + (co[1] | 0) + ',' + (co[2] | 0) + ',' + (i === cur ? 0.34 : 0.2) + ')');
        gr.addColorStop(1, 'rgba(' + (co[0] | 0) + ',' + (co[1] | 0) + ',' + (co[2] | 0) + ',0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(px, py, gR, 0, 6.283); ctx.fill();
        var dw = p.w * pop, dh = p.h * pop;
        ctx.drawImage(p.cv, px - dw / 2, py - dh / 2, dw, dh);
        if (systems[i].live) { ctx.font = '10px ui-monospace,monospace'; setF(255, 120, 140, 0.6 + 0.4 * Math.sin(t * 4)); ctx.fillText('◉ LIVE', px, py - p.R - 10); }
        ctx.font = "11px 'Space Mono', ui-monospace, monospace";
        setF(i <= cur ? 234 : 150, i <= cur ? 240 : 162, i <= cur ? 248 : 188, i === cur ? 1 : (i < cur ? 0.85 : 0.55));
        ctx.fillText(systems[i].label, px, py + p.R + 14);
      }
    }
    function drawShip() {
      var sp = shipAt(d), px = sp.x - camx, py = sp.y - camy;
      trail.push({ x: px, y: py }); if (trail.length > 16) trail.shift();
      for (var i = 0; i < trail.length; i++) { var tp = trail[i], al = i / trail.length * 0.5 * (0.4 + streak); ctx.font = (4 + i * 0.3) + 'px monospace'; setF(46, 230, 166, al); ctx.fillText('·', tp.x, tp.y); }
      ctx.save(); ctx.translate(px, py); ctx.scale(dir < 0 ? -1 : 1, 1);   // face the travel direction (flip when warping back)
      var fs = 7, cw = fs * 0.62, ch2 = fs * 0.92;
      if (streak > 0.05 || dwell <= 0) { ctx.font = (fs + 1) + 'px monospace'; for (var f = 0; f < 4; f++) { setF(255, 190, 90, (0.7 - f * 0.16) * (0.5 + 0.5 * Math.sin(t * 40 + f) + streak)); ctx.fillText(f % 2 ? '≡' : '=', -(20 + f * 5) * cw / 2, 0); } }
      ctx.font = fs + 'px ui-monospace, Menlo, monospace';
      var ox = -(SHIP[0].length) * cw / 2, oy = -(SHIP.length) * ch2 / 2;
      for (var ry = 0; ry < SHIP.length; ry++) for (var cx = 0; cx < SHIP[ry].length; cx++) { var c = SHIP[ry][cx]; if (c === ' ') continue; if (c === '◉') setF(255, 190, 90, 1); else if (c === '➤') setF(234, 240, 248, 1); else setF(46, 230, 166, 1); ctx.fillText(c, ox + cx * cw, oy + ry * ch2); }
      ctx.restore();
    }

    function fmt(k) { return k >= 1000 ? (k / 1000).toFixed(1).replace(/\.0$/, '') + 'M' : k + 'k'; }
    function emitDock() { var s = systems[cur] || {}; onDock(cur, s.stat != null ? s.stat : '', warping); }
    function snapCam() { var sp = shipAt(d); camx = Math.max(0, Math.min(worldW - W, sp.x - W * 0.42)); camy = Math.max(-H * 0.15, Math.min(worldH - H * 0.85, sp.y - H / 2)); }
    function jump(i) { cur = Math.max(0, Math.min(systems.length - 1, i)); d = D[cur]; warping = false; streak = 0; trail = []; snapCam(); emitDock(); frame(); }

    function startWarp(to) {
      if (warping) return; to = Math.max(0, Math.min(systems.length - 1, to)); if (to === cur) return;
      wfrom = D[cur]; wto = D[to]; wprog = 0; warping = true; dir = to > cur ? 1 : -1; cur = to;
    }
    function step(dt) {
      if (warping) {
        wprog += dt / 1.15; if (wprog >= 1) { wprog = 1; warping = false; d = wto; dwell = 0.55; trail = []; emitDock(); }
        else { d = lerp(wfrom, wto, easeWarp(wprog)); }
        streak = warping ? Math.min(1, Math.sin(wprog * Math.PI) * 1.3) : streak * 0.9;
      } else { streak *= 0.86; if (streak < 0.02) streak = 0; if (dwell > 0) dwell -= dt; }
      // chained auto-warp while holding
      if (!warping && dwell <= 0 && thrustDir !== 0) startWarp(cur + (thrustDir > 0 ? 1 : -1));
      var sp = shipAt(d), tcx = sp.x - W * 0.42, tcy = sp.y - H / 2;
      camx += (tcx - camx) * Math.min(1, dt * 3.2); camy += (tcy - camy) * Math.min(1, dt * 3.2);
      camx = Math.max(0, Math.min(worldW - W, camx)); camy = Math.max(-H * 0.15, Math.min(worldH - H * 0.85, camy));
    }
    function frame() { ctx.fillStyle = '#06080C'; ctx.fillRect(0, 0, W, H); drawNebula(); drawStars(); drawPath(); drawPlanets(); drawShip(); }
    function loop(now) { if (destroyed) return; var dt = (now - last) / 1000; last = now; if (dt > 0.05) dt = 0.05; t += dt; step(dt); frame(); if (active && !hidden) raf = requestAnimationFrame(loop); else raf = 0; }
    function run() { if (raf || destroyed || !active || hidden) return; last = performance.now(); raf = requestAnimationFrame(loop); }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

    var thrustDir = 0;
    var KF = { ' ': 1, Spacebar: 1, ArrowRight: 1, d: 1, ArrowUp: 1, w: 1, ArrowLeft: -1, a: -1, ArrowDown: -1, s: -1 };
    function kd(e) { if (!active) return; var el = document.activeElement; if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return; var v = KF[e.key]; if (v) { thrustDir = v; e.preventDefault(); if (reduce()) jump(cur + (v > 0 ? 1 : -1)); } }
    function ku(e) { if (KF[e.key]) thrustDir = 0; }
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    function onVis() { hidden = !!document.hidden; if (hidden) stop(); else run(); }
    document.addEventListener('visibilitychange', onVis);
    canvas.addEventListener('contextlost', function (e) { e.preventDefault(); stop(); }, false);
    canvas.addEventListener('contextrestored', function () { size(); frame(); if (active && !hidden) run(); }, false);
    var ro = ('ResizeObserver' in window) ? new ResizeObserver(function () { size(); frame(); }) : null;
    if (ro) ro.observe(canvas);
    size(); emitDock(); frame();

    return {
      setActive: function (b) { active = !!b; thrustDir = 0; if (reduce()) { frame(); return; } if (active) run(); else stop(); },
      thrust: function (dvr) { thrustDir = dvr; if (reduce() && dvr) jump(cur + (dvr > 0 ? 1 : -1)); },
      warpTo: function (i) { if (reduce()) jump(i); else startWarp(i); },
      destroy: function () { destroyed = true; stop(); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); document.removeEventListener('visibilitychange', onVis); if (ro) ro.disconnect(); }
    };
  }
  window.Trajectory = { mount: mount };
})();
