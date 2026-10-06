/* Adapted from cudam321.com (https://github.com/cudam321/cudam321.com), MIT License © 2026 Cudam — see LICENSE. */
/* galaxy.js — live ASCII spiral galaxy (liquidity-map palette: mint arms, amber core, red liquidation flecks) (3D particle render → dense colored ASCII).
   Port of scripts/galaxy_ascii.py: log-spiral arms + exp disk + bulge + HII, rotated in 3D
   under a viewing tilt, accumulated to a small supersampled buffer, box-blurred for gas,
   golden core glow, asinh stretch (lifts faint arms), saturation, then drawn as ASCII.
   Calm auto-rotate. Gated on visibility + reduced-motion. Optional cursor-dim spotlight.
   API:  const g = Galaxy.mount(elOrCanvas, opts); g.setActive(bool); g.setPointer(x,y); g.destroy();
   opts: { cols, fontSize, secondsPerRotation, particles, seed, background } */
(function () {
  'use strict';
  var RAMP = " .`'^\":;Il!i~+_-?]/\\|()1{}tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
  var INCL = 38 * Math.PI / 180, SPAN = 2.1;   // INCL is just the starting tilt; pitch tumbles freely (full 360°)

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function asCanvas(t) {
    if (t && t.tagName === 'CANVAS') return t;
    var c = document.createElement('canvas');
    c.style.cssText = 'display:block;width:100%;height:100%';
    t.appendChild(c); return c;
  }
  var reduce = function () { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; };

  // build particle arrays once
  function makeParticles(seed, nDisk, nBulge) {
    var rnd = mulberry32(seed);
    var g = function () { var u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2831853 * v); };
    var N = nDisk + nBulge;
    var X = new Float32Array(N), Y = new Float32Array(N), Z = new Float32Array(N);
    var CR = new Float32Array(N), CG = new Float32Array(N), CB = new Float32Array(N), BRI = new Float32Array(N);
    var i;
    for (i = 0; i < nDisk; i++) {
      var r = Math.min(1.25, Math.max(0.03, -0.37 * Math.log(rnd() + 1e-9)));
      var arm = (rnd() < 0.5 ? 0 : Math.PI);
      var base = arm + 3.1 * Math.log(r + 0.22);
      var diffuse = rnd() < 0.16;
      var off = g() * (diffuse ? 0.85 : 0.075 + 0.03 * r);
      var th = base + off;
      X[i] = r * Math.cos(th); Y[i] = r * Math.sin(th);
      Z[i] = g() * (0.05 * Math.exp(-r * 1.3) + 0.012);
      var armness = Math.exp(-(off * off) / (2 * 0.22 * 0.22));
      // base cool-blue → warm center → bluer arms
      var warm = Math.max(0, Math.min(1, 1 - r / 0.55));
      var cr = 0.10 * (1 - warm) + 0.99 * warm, cg = 0.46 * (1 - warm) + 0.74 * warm, cb = 0.40 * (1 - warm) + 0.30 * warm;
      var a = armness * 0.55;
      cr = cr * (1 - a) + 0.24 * a; cg = cg * (1 - a) + 0.98 * a; cb = cb * (1 - a) + 0.66 * a;
      var b = (0.16 + 1.10 * armness) * (0.62 + 0.50 * Math.exp(-r * 0.50));
      if (rnd() < 0.010 && armness > 0.55 && r > 0.22 && r < 1.0) { cr = 1.0; cg = 0.26; cb = 0.36; b *= 3.4; }
      CR[i] = cr; CG[i] = cg; CB[i] = cb; BRI[i] = b;
    }
    for (; i < N; i++) {                                   // central bulge
      var br = Math.abs(g() * 0.155), bt = rnd() * 6.2831853;
      X[i] = br * Math.cos(bt); Y[i] = br * Math.sin(bt); Z[i] = g() * 0.055;
      CR[i] = 0.99; CG[i] = 0.80; CB[i] = 0.42; BRI[i] = 0.55 * Math.exp(-br * 3.1) + 0.10;
    }
    return { X: X, Y: Y, Z: Z, CR: CR, CG: CG, CB: CB, BRI: BRI, N: N };
  }

  function boxblur(buf, W, H, rad) {                        // separable, in-place-ish
    var tmp = new Float32Array(W * H), x, y, k, s, n = 2 * rad + 1;
    for (y = 0; y < H; y++) { var row = y * W; for (x = 0; x < W; x++) { s = 0; for (k = -rad; k <= rad; k++) { var xx = x + k; if (xx < 0) xx = 0; else if (xx >= W) xx = W - 1; s += buf[row + xx]; } tmp[row + x] = s / n; } }
    for (x = 0; x < W; x++) { for (y = 0; y < H; y++) { s = 0; for (k = -rad; k <= rad; k++) { var yy = y + k; if (yy < 0) yy = 0; else if (yy >= H) yy = H - 1; s += tmp[yy * W + x]; } buf[y * W + x] = s / n; } }
  }

  var Galaxy = {
    mount: function (target, opts) {
      opts = opts || {};
      var canvas = asCanvas(target);
      var bg = opts.background || '#06080C';
      var sm = window.innerWidth < 760;
      var coarse = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);   // touch device → no drag, lighter cadence
      var fInt = coarse ? 1 / 20 : 1 / 30;                                              // render cadence (mobile renders less often)
      var fontSize = opts.fontSize || (sm ? 9 : 11);
      var secPerRot = opts.secondsPerRotation || 120;
      var P = makeParticles(opts.seed || 7, opts.particles || (sm ? 16000 : 42000), sm ? 6000 : 16000);
      var n_ramp = RAMP.length - 1;
      var SS = 3;                                           // supersample for the accumulation buffer
      var cols, rows, BW, BH, cw, ch, ctx, dpr, Rb, Gb, Bb, glow, gas, gag, gab, ax, ay, bx, by, cssW, cssH, offX, offY, raf = 0, last = 0, acc = 0;
      var yaw = 0.4, pitch = coarse ? (30 * Math.PI / 180) : INCL, yawVel = 0, pitchVel = 0, dragging = false;   // orbit camera; mobile starts a touch more face-on
      var autoSpin = 6.2831853 / secPerRot;                                         // ambient rotation the inertia settles back into (gated live by reduce() in step)
      var onFrame = opts.onFrame || null, onInteract = opts.onInteract || null, interacted = false;
      var active = false, destroyed = false, spot = false, mpx = -1, mpy = -1, wantActive = false, hidden = false;

      function build() {
        // offsetWidth/Height are transform-immune — the reveal CSS-scales #galaxy-wrap, so getBoundingClientRect would inflate the buffer (the old "earth" bug)
        var W = Math.max(1, canvas.offsetWidth | 0), H = Math.max(1, (canvas.offsetHeight || canvas.offsetWidth) | 0);
        cssW = W; cssH = H;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = W * dpr; canvas.height = H * dpr;
        ctx = canvas.getContext('2d', { alpha: coarse });   // mobile: transparent so the void shows the nebula glow + starfield, not a black box
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.textBaseline = 'top'; ctx.font = fontSize + 'px ui-monospace,"SF Mono",Menlo,Consolas,monospace';
        cw = ctx.measureText('M').width || fontSize * 0.6; ch = Math.round(fontSize * 1.12);
        cols = Math.max(40, Math.min(opts.maxCols || (sm ? 110 : 460), Math.round(W / cw)));   // 460 fills wide desktops (was 240 → unpainted band on anything >~1584px)
        rows = Math.max(20, Math.round(H / ch));
        offX = Math.round((W - cols * cw) / 2); offY = Math.round((H - rows * ch) / 2);          // center the grid: fills the viewport, stays centered if capped on a huge screen
        BW = cols * SS; BH = rows * SS;
        Rb = new Float32Array(BW * BH); Gb = new Float32Array(BW * BH); Bb = new Float32Array(BW * BH);
        gas = new Float32Array(BW * BH); gag = new Float32Array(BW * BH); gab = new Float32Array(BW * BH);   // persistent blur scratch (no per-frame allocation)
        glow = new Float32Array(BW * BH);
        // particle→buffer mapping. desktop: stretch to fill the box (legacy). mobile: uniform scale so the disk stays ROUND and fills the screen.
        if (coarse) {
          var ppu = Math.max(W, H) * 0.66 / SPAN;          // px per galaxy unit — round + large (overflows the short edge, cropped)
          ax = ppu / cw * SS; ay = ppu / ch * SS;
        } else {
          ax = BW / SPAN; ay = BH / SPAN;
        }
        bx = BW / 2; by = BH / 2;
        var exu = SPAN * ax, eyu = SPAN * ay;                // galaxy extent in buffer cells → keep the core glow proportional in both modes
        var gx = bx, gy = by, sxg = exu * 0.06, syg = eyu * 0.075;
        for (var y = 0; y < BH; y++) for (var x = 0; x < BW; x++) {
          var dx = (x - gx) / sxg, dy = (y - gy) / syg; glow[y * BW + x] = Math.exp(-(dx * dx + dy * dy));
        }
      }

      function render() {
        Rb.fill(0); Gb.fill(0); Bb.fill(0);
        var cA = Math.cos(yaw), sA = Math.sin(yaw), ci = Math.cos(pitch), si = Math.sin(pitch), i, X = P.X, Y = P.Y, Z = P.Z, CR = P.CR, CG = P.CG, CB = P.CB, BRI = P.BRI;
        for (i = 0; i < P.N; i++) {
          var xr = X[i] * cA - Y[i] * sA, yr = X[i] * sA + Y[i] * cA;
          var y2 = yr * ci - Z[i] * si, z2 = yr * si + Z[i] * ci;
          var be = BRI[i] * (0.6 + 0.55 * Math.max(0, Math.min(1, (z2 + 0.8) / 1.6)));
          var sx = (xr * ax + bx) | 0, sy = (y2 * ay + by) | 0;
          if (sx < 0 || sx >= BW || sy < 0 || sy >= BH) continue;
          var idx = sy * BW + sx; Rb[idx] += CR[i] * be; Gb[idx] += CG[i] * be; Bb[idx] += CB[i] * be;
        }
        gas.set(Rb); gag.set(Gb); gab.set(Bb);
        boxblur(gas, BW, BH, 2); boxblur(gag, BW, BH, 2); boxblur(gab, BW, BH, 2);
        // tone: gas*0.8 + points, + golden core glow, asinh stretch, saturate  (gains tuned for this buffer)
        var GAIN = 4.2, ash = Math.asinh(13);
        if (coarse) ctx.clearRect(0, 0, cssW, cssH);   // transparent void (mobile)
        else { ctx.fillStyle = bg; ctx.fillRect(0, 0, cssW, cssH); }   // fill the FULL canvas — wide screens never show an unpainted band
        for (var ry = 0; ry < rows; ry++) {
          for (var cx = 0; cx < cols; cx++) {
            // average the SSxSS block
            var r = 0, gg = 0, b = 0, gl = 0, syb = ry * SS, sxb = cx * SS, a, q;
            for (a = 0; a < SS; a++) for (q = 0; q < SS; q++) {
              var bi = (syb + a) * BW + (sxb + q);
              r += gas[bi] * 0.8 + Rb[bi]; gg += gag[bi] * 0.8 + Gb[bi]; b += gab[bi] * 0.8 + Bb[bi]; gl += glow[bi];
            }
            var inv = 1 / (SS * SS);
            r = r * inv * GAIN + gl * inv * 1.0; gg = gg * inv * GAIN + gl * inv * 0.85; b = b * inv * GAIN + gl * inv * 0.58;
            // asinh stretch
            r = Math.asinh(r * 13) / ash; gg = Math.asinh(gg * 13) / ash; b = Math.asinh(b * 13) / ash;
            var L = (r + gg + b) / 3;
            if (L < 0.07) continue;
            r = Math.min(1, L + (r - L) * 1.85); gg = Math.min(1, L + (gg - L) * 1.85); b = Math.min(1, L + (b - L) * 1.85);
            var lum = Math.max(r, gg, b);
            var chi = (Math.pow(Math.min(1, lum), 0.85) * n_ramp) | 0;
            var c = RAMP[chi]; if (c === ' ') continue;
            ctx.fillStyle = 'rgb(' + (r * 255 | 0) + ',' + (gg * 255 | 0) + ',' + (b * 255 | 0) + ')';
            ctx.fillText(c, offX + cx * cw, offY + ry * ch);
          }
        }
        if (spot && mpx >= 0) {                             // cursor-dim spotlight
          var rect = canvas.getBoundingClientRect();        // visual rect (may be CSS-scaled by the reveal)
          if (rect.width && rect.height) {
            var fx = (mpx - rect.left) / rect.width, fy = (mpy - rect.top) / rect.height;  // normalize 0..1
            if (fx >= -0.05 && fx <= 1.05 && fy >= -0.05 && fy <= 1.05) {
              var lx = fx * cssW, ly = fy * cssH;            // cursor in full-canvas coords
              var R = Math.min(cssW, cssH) * 0.20;
              var grd = ctx.createRadialGradient(lx, ly, 0, lx, ly, R);
              grd.addColorStop(0, 'rgba(6,8,12,0.82)'); grd.addColorStop(1, 'rgba(6,8,12,0)');
              ctx.fillStyle = grd; ctx.fillRect(0, 0, cssW, cssH);
            }
          }
        }
        if (onFrame) onFrame(project);   // let the host place embedded nodes through the SAME camera
      }

      // map a 3D galaxy-space point to normalized canvas coords (0..1) + toward-camera depth
      function project(x, y, z) {
        var cA = Math.cos(yaw), sA = Math.sin(yaw), ci = Math.cos(pitch), si = Math.sin(pitch);
        var xr = x * cA - y * sA, yr = x * sA + y * cA;
        var y2 = yr * ci - z * si, z2 = yr * si + z * ci;
        var fx = (xr / SPAN) + 0.5, fy = (y2 / SPAN) + 0.5;
        return { x: (offX + fx * cols * cw) / cssW, y: (offY + fy * rows * ch) / cssH, depth: z2, face: Math.abs(ci) };   // canvas fraction (matches the centered grid); face: 1=flat-on, 0=edge-on
      }

      function step(dt) {
        if (!dragging) {
          var k = 1 - Math.exp(-dt / 0.8);          // ease the extra velocity away; yaw settles back into ambient spin
          yawVel += ((reduce() ? 0 : autoSpin) - yawVel) * k;
          pitchVel += (0 - pitchVel) * k;
          yaw += yawVel * dt;
          pitch += pitchVel * dt;
        }
      }
      function loop(now) {
        if (destroyed) return;
        var dt = Math.min(0.25, (now - last) / 1000); last = now; acc += dt;
        if (acc >= fInt) {
          step(acc); if (active) render(); acc = 0;
          if (reduce() && !dragging && Math.abs(yawVel) < 2e-4 && Math.abs(pitchVel) < 2e-4) { raf = 0; return; }  // idle under reduced-motion → stop the loop
        }
        raf = requestAnimationFrame(loop);
      }
      function ensureLoop() { if (raf || destroyed) return; last = performance.now(); acc = fInt; raf = requestAnimationFrame(loop); }

      function upd() { active = wantActive && !hidden; }
      build(); render();
      if (!reduce()) { last = performance.now(); raf = requestAnimationFrame(loop); }

      var ro = ('ResizeObserver' in window) ? new ResizeObserver(function () { build(); render(); }) : null;
      if (ro) ro.observe(canvas);

      // ---- drag to orbit / re-perspective (desktop / fine-pointer only — touch devices scroll normally) ----
      var dragId = -1, lx = 0, ly = 0, lt = 0, moved = 0, dbox = null, swallowUntil = 0;
      function commit(e) {                                   // a tap stays a tap / a vertical swipe stays a scroll until this fires
        dragging = true; yawVel = 0; pitchVel = 0;
        dbox = canvas.getBoundingClientRect();               // cache once; stable for the drag → no per-move reflow
        try { canvas.setPointerCapture(e.pointerId); } catch (er) {}
        canvas.style.cursor = 'grabbing';
        ensureLoop();
        if (!interacted) { interacted = true; if (onInteract) onInteract(); }
      }
      function onDown(e) {
        if (!active || dragId !== -1) return;                // ignore secondary pointers while one is already down
        dragId = e.pointerId; moved = 0; lx = e.clientX; ly = e.clientY; lt = performance.now();
      }
      function onMove(e) {
        if (e.pointerId !== dragId) return;
        if (!dragging) {
          moved += Math.abs(e.clientX - lx) + Math.abs(e.clientY - ly);
          lx = e.clientX; ly = e.clientY;
          if (moved < 6) return;                             // below threshold: don't steal the tap or the vertical scroll
          commit(e); lt = performance.now();
        }
        var w = dbox.width || 1, h = dbox.height || 1;
        var dx = e.clientX - lx, dy = e.clientY - ly;
        var now = performance.now(), dtm = Math.max(0.008, (now - lt) / 1000);
        var dyaw = dx / w * Math.PI * 1.4, dpitch = dy / h * Math.PI * 1.1;
        yaw += dyaw; pitch += dpitch;                        // both axes free — full 360° tumble in any direction
        yawVel = dyaw / dtm; pitchVel = dpitch / dtm;        // carry the release velocity into inertia
        lx = e.clientX; ly = e.clientY; lt = now;
      }
      function onUp(e) {
        if (e.pointerId !== dragId) return;
        if (dragging) {
          var cap = 6.0;                                     // a hard flick shouldn't spin to a blur
          yawVel = yawVel < -cap ? -cap : (yawVel > cap ? cap : yawVel);
          pitchVel = pitchVel < -cap ? -cap : (pitchVel > cap ? cap : pitchVel);
          swallowUntil = performance.now() + 300;            // a drag must never open a section, even where WebKit doesn't redirect the click under capture
        }
        dragging = false; dragId = -1; canvas.style.cursor = 'grab';
        try { canvas.releasePointerCapture(e.pointerId); } catch (er) {}
      }
      function onClickCapture(e) {
        if (performance.now() < swallowUntil) { swallowUntil = 0; e.stopPropagation(); e.preventDefault(); }
      }
      if (!coarse) {                                          // drag only on fine pointers; mobile keeps native scroll + avoids the drag-render jank
        canvas.style.touchAction = 'pan-y';
        canvas.style.cursor = 'grab';
        canvas.addEventListener('pointerdown', onDown);
        canvas.addEventListener('pointermove', onMove);
        canvas.addEventListener('pointerup', onUp);
        canvas.addEventListener('pointercancel', onUp);
        window.addEventListener('click', onClickCapture, true);
      }
      var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
      function onReduceChange() { if (!reduce()) ensureLoop(); }   // reduce turned back off → resume ambient motion
      if (mq && mq.addEventListener) mq.addEventListener('change', onReduceChange);
      function onVis() {
        hidden = document.hidden; upd();
        if (!hidden && !reduce() && !destroyed) {           // force a fresh loop on return (don't trust the paused rAF)
          last = performance.now(); acc = 0;
          if (raf) cancelAnimationFrame(raf);
          raf = requestAnimationFrame(loop);
        }
      }
      document.addEventListener('visibilitychange', onVis);

      return {
        setActive: function (b) { wantActive = b; upd(); if (active && !raf) ensureLoop(); },   // scroll-reveal state from app.js
        setPointer: function (x, y) { mpx = x; mpy = y; },          // page coords (clientX/clientY)
        setSpotlight: function (b) { spot = b; },
        project: project,
        repaint: function () { render(); },
        destroy: function () {
          destroyed = true; if (raf) cancelAnimationFrame(raf); if (ro) ro.disconnect();
          document.removeEventListener('visibilitychange', onVis);
          canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
          canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
          window.removeEventListener('click', onClickCapture, true);
          if (mq && mq.removeEventListener) mq.removeEventListener('change', onReduceChange);
        }
      };
    }
  };
  window.Galaxy = Galaxy;
})();
