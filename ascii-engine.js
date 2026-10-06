/* Adapted from cudam321.com (https://github.com/cudam321/cudam321.com), MIT License © 2026 Cudam — see LICENSE. */
/* ascii-engine.js — image -> dense ASCII (colored or mono) + a calm auto-rotating ASCII globe.
   Self-contained, no deps. Renders live to a <canvas>. Respects prefers-reduced-motion,
   pauses when off-screen / tab hidden. Ports the proven Python pipeline (img2ascii / globe_ascii).

   API:
     AsciiArt.globe(targetCanvasOrEl, { textureSrc, color, monoColor, fontSize, maxCols,
                                        secondsPerRotation, gamma, stars })
     AsciiArt.image(targetCanvasOrEl, { src, color, monoColor, fontSize, maxCols, gamma })
   Each returns a handle: { destroy() }. */
(function () {
  'use strict';
  var RAMP = " .`'^\":;Il!i~+_-?]/\\|()1{}tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
  var FONT = function (px) { return px + 'px ui-monospace, "SF Mono", Menlo, Consolas, monospace'; };
  var reduceMotion = function () {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };

  function asCanvas(target) {
    if (target && target.tagName === 'CANVAS') return target;
    var c = document.createElement('canvas');
    c.style.display = 'block'; c.style.width = '100%'; c.style.height = '100%';
    target.appendChild(c);
    return c;
  }

  // size the backing store to the element box at capped DPR; returns {ctx, w, h}
  // NOTE: use offsetWidth/Height (layout box, transform-immune) not getBoundingClientRect —
  // the hero globe is CSS-scaled up to ~15x during the scroll dive, and a transformed rect
  // would size the canvas past the browser's max and blank it. Hard-capped as a backstop.
  function fit(canvas, fontSize, transparent) {
    var box = canvas.getBoundingClientRect();
    var w = Math.max(1, Math.min(2600, canvas.offsetWidth || Math.round(box.width)));
    var h = Math.max(1, Math.min(2600, canvas.offsetHeight || Math.round(box.height || box.width)));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    var ctx = canvas.getContext('2d', { alpha: !!transparent });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textBaseline = 'top';
    ctx.font = FONT(fontSize);
    return { ctx: ctx, w: w, h: h };
  }

  function loadImage(src, cb) {
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () { cb(null, img); };
    img.onerror = function (e) { cb(e || new Error('load failed'), null); };
    img.src = src;
  }

  // sample an image into an RGBA byte buffer at (sw, sh)
  function sample(img, sw, sh) {
    var c = document.createElement('canvas'); c.width = sw; c.height = sh;
    var x = c.getContext('2d');
    x.drawImage(img, 0, 0, sw, sh);
    return x.getImageData(0, 0, sw, sh).data;
  }

  // procedural fallback texture so a failed image load never blanks the globe
  function procTex(w, h) {
    var d = new Uint8ClampedArray(w * h * 4);
    function hash(x, y) { var n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return n - Math.floor(n); }
    function vnoise(x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      var a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), e = hash(xi + 1, yi + 1);
      var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + e * u * v;
    }
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var nx = x / w * 8, ny = y / h * 5;
        var val = vnoise(nx, ny) * 0.6 + vnoise(nx * 2, ny * 2) * 0.3 + vnoise(nx * 4, ny * 4) * 0.1;
        var i = (y * w + x) * 4, pole = Math.abs(y / h - 0.5) > 0.43;
        if (pole) { d[i] = 228; d[i + 1] = 236; d[i + 2] = 244; }
        else if (val > 0.52) { d[i] = 54 + val * 40; d[i + 1] = 96 + val * 50; d[i + 2] = 60; }
        else { d[i] = 20; d[i + 1] = 56 + val * 30; d[i + 2] = 104 + val * 40; }
        d[i + 3] = 255;
      }
    }
    return d;
  }

  function quant(v) { return (v > 255 ? 255 : v) & 0xF0; } // coarsen color so adjacent cells share fillStyle

  // ---- shared cell renderer: draws a grid of {char,color} efficiently ----
  function makeGridDrawer(ctx, cols, rows, cw, ch, bg) {
    var n = RAMP.length - 1;
    return {
      n: n,
      clear: function () { if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, cols * cw, rows * ch); } else { ctx.clearRect(0, 0, cols * cw, rows * ch); } },
      // cellFn(cx,ry) -> [char, r,g,b] or null
      paint: function (cellFn, colorOn, monoColor) {
        if (!colorOn) ctx.fillStyle = monoColor;
        var prev = '';
        for (var ry = 0; ry < rows; ry++) {
          var y = ry * ch;
          for (var cx = 0; cx < cols; cx++) {
            var cell = cellFn(cx, ry);
            if (!cell) continue;
            if (colorOn) {
              var s = 'rgb(' + quant(cell[1]) + ',' + quant(cell[2]) + ',' + quant(cell[3]) + ')';
              if (s !== prev) { ctx.fillStyle = s; prev = s; }
            }
            ctx.fillText(cell[0], cx * cw, y);
          }
        }
      }
    };
  }

  function metrics(ctx, fontSize) {
    var cw = ctx.measureText('M').width || fontSize * 0.6;
    var ch = Math.round(fontSize * 1.12);
    return { cw: cw, ch: ch };
  }

  function lifecycle(canvas, onVisible, onHidden) {
    var io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { e.isIntersecting ? onVisible() : onHidden(); });
      }, { threshold: 0.01 });
      io.observe(canvas);
    }
    function vis() { document.hidden ? onHidden() : onVisible(); }
    document.addEventListener('visibilitychange', vis);
    return function () { if (io) io.disconnect(); document.removeEventListener('visibilitychange', vis); };
  }

  var AsciiArt = {
    /* calm auto-rotating ASCII globe (live sphere projection) */
    globe: function (target, opts) {
      opts = opts || {};
      var canvas = asCanvas(target);
      var fontSize = opts.fontSize || 11;
      var colorOn = opts.color !== false;
      var monoColor = opts.monoColor || '#dfe7f0';
      var gamma = opts.gamma || 0.9;
      var secPerRot = opts.secondsPerRotation || 24; // calm (~2x slower than the 2s preview-loop feel)
      var maxCols = opts.maxCols || (window.innerWidth < 720 ? 84 : 150);
      var transparent = opts.transparent === true;
      var bg = transparent ? null : (opts.background || '#05070D');
      var ramp = opts.ramp || RAMP;   // optional custom glyph ramp (dark -> bright)
      var TW = 512, TH = 256;
      var raf = 0, running = false, theta = 0, last = 0, acc = 0, destroyed = false;
      var teardown = function () {};

      loadImage(opts.textureSrc || 'images/market.jpg', function (err, img) {
        if (destroyed) return;
        var tdata;
        try { tdata = (err || !img) ? procTex(TW, TH) : sample(img, TW, TH); }
        catch (e) { tdata = procTex(TW, TH); }

        function build() {
          var f = fit(canvas, fontSize, transparent);
          var m = metrics(f.ctx, fontSize);
          var cw = m.cw, ch = m.ch;
          var cols = Math.max(40, Math.min(maxCols, Math.round(f.w / cw)));
          var rows = Math.max(20, Math.round(f.h / ch));
          var Wd = cols * cw, Hd = rows * ch;
          var cxc = Wd / 2, cyc = Hd / 2, R = Math.min(Wd, Hd) / 2 * 0.97;

          // precompute per-cell geometry (independent of rotation)
          var N = cols * rows;
          var NX = new Float32Array(N), NYa = new Float32Array(N), Z = new Float32Array(N),
              LAT = new Float32Array(N), LIGHT = new Float32Array(N), MASK = new Uint8Array(N);
          var stars = [];
          for (var ry = 0; ry < rows; ry++) {
            for (var cx = 0; cx < cols; cx++) {
              var i = ry * cols + cx;
              var nx = (cx * cw + cw / 2 - cxc) / R;
              var ny = -(ry * ch + ch / 2 - cyc) / R;
              var r2 = nx * nx + ny * ny;
              if (r2 <= 1) {
                var z = Math.sqrt(1 - r2);
                MASK[i] = 1; NX[i] = nx; NYa[i] = ny; Z[i] = z;
                LAT[i] = Math.asin(Math.max(-1, Math.min(1, ny)));
                LIGHT[i] = Math.max(0.42, Math.min(1.15, 0.48 + 0.60 * z + (nx * -0.18 + ny * 0.12)));
              } else if (opts.stars !== false && ((cx * 92821 + ry * 53987) % 53) === 0) {
                stars.push([cx, ry]); // deterministic sparse starfield
              }
            }
          }

          var drawer = makeGridDrawer(f.ctx, cols, rows, cw, ch, bg);
          var n = drawer.n, TWO_PI = Math.PI * 2;

          function render(th) {
            drawer.clear();
            // stars (cheap, fixed)
            f.ctx.fillStyle = '#5a6478';
            for (var s = 0; s < stars.length; s++) f.ctx.fillText('.', stars[s][0] * cw, stars[s][1] * ch);
            drawer.paint(function (cx, ry) {
              var i = ry * cols + cx;
              if (!MASK[i]) return null;
              var z = Z[i];
              var lon = Math.atan2(NX[i], z) + th;
              var u = (lon / TWO_PI + 0.5); u = u - Math.floor(u);
              var v = 0.5 - LAT[i] / Math.PI;
              var tx = (u * (TW - 1)) | 0, ty = (v * (TH - 1)) | 0;
              var p = (ty * TW + tx) * 4, lg = LIGHT[i];
              var r = tdata[p] * lg, g = tdata[p + 1] * lg, b = tdata[p + 2] * lg;
              var L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
              if (L < 7) return null;
              var ch_ = ramp[Math.min(ramp.length - 1, (Math.pow(L / 255, gamma) * ramp.length) | 0)];
              if (ch_ === ' ') return null;
              return [ch_, r * 1.08, g * 1.08, b * 1.08];
            }, colorOn, monoColor);
          }

          return render;
        }

        var render = build();
        function loop(now) {
          if (destroyed) return;
          var dt = (now - last) / 1000; last = now;
          if (dt > 0.25) dt = 0.25;
          acc += dt;
          if (acc >= 1 / 30) { // cap ~30fps
            theta += (Math.PI * 2 / secPerRot) * acc; acc = 0;
            render(theta);
          }
          raf = requestAnimationFrame(loop);
        }
        function start() { if (running || destroyed) return; running = true; last = performance.now(); acc = 0; raf = requestAnimationFrame(loop); }
        function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
        function revive() { if (destroyed) return; render = build(); if (reduceMotion()) render(0.6); else { running = false; start(); } }
        // a backgrounded canvas can have its 2D backing store discarded (shows blank/broken); rebuild + repaint on restore/return
        canvas.addEventListener('contextlost', function (e) { e.preventDefault(); stop(); }, false);
        canvas.addEventListener('contextrestored', revive, false);

        if (reduceMotion()) { render(0.6); }
        else { start(); }

        var off = lifecycle(canvas, function () { if (reduceMotion()) render(theta); else { running = false; start(); } }, stop);
        var ro = ('ResizeObserver' in window) ? new ResizeObserver(function () {
          render = build(); if (!running && reduceMotion()) render(0.6);
        }) : null;
        if (ro) ro.observe(canvas);
        teardown = function () { stop(); off(); if (ro) ro.disconnect(); };
      });

      return { destroy: function () { destroyed = true; teardown(); } };
    },

    /* static dense ASCII from any image (colored or mono) */
    image: function (target, opts) {
      opts = opts || {};
      var canvas = asCanvas(target);
      var fontSize = opts.fontSize || 10;
      var colorOn = opts.color !== false;
      var monoColor = opts.monoColor || '#dfe7f0';
      var gamma = opts.gamma || 0.9;
      var maxCols = opts.maxCols || (window.innerWidth < 720 ? 90 : 200);
      var transparent = opts.transparent === true;
      var bg = transparent ? null : (opts.background || '#05070D');
      var destroyed = false, teardown = function () {};

      loadImage(opts.src, function (err, img) {
        if (err || destroyed) return;
        function build() {
          var f = fit(canvas, fontSize, transparent);
          var m = metrics(f.ctx, fontSize), cw = m.cw, ch = m.ch;
          // grid must fit the box: clamp to maxCols but never force more cells than fit (small tiles were overflowing)
          var cols = Math.min(maxCols, Math.max(8, Math.round(f.w / cw)));
          var rows = Math.max(6, Math.round(f.h / ch));
          var data = sample(img, cols, rows);
          var drawer = makeGridDrawer(f.ctx, cols, rows, cw, ch, bg), n = drawer.n;
          drawer.clear();
          drawer.paint(function (cx, ry) {
            var p = (ry * cols + cx) * 4;
            var r = data[p], g = data[p + 1], b = data[p + 2];
            var L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            if (L < 6) return null;
            var c = RAMP[(Math.pow(L / 255, gamma) * n) | 0];
            if (c === ' ') return null;
            return [c, r * 1.08, g * 1.08, b * 1.08];
          }, colorOn, monoColor);
        }
        build();
        var ro = ('ResizeObserver' in window) ? new ResizeObserver(build) : null;
        if (ro) ro.observe(canvas);
        teardown = function () { if (ro) ro.disconnect(); };
      });

      return { destroy: function () { destroyed = true; teardown(); } };
    }
  };

  window.AsciiArt = AsciiArt;
})();
