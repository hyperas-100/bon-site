/* bon — trading-terminal résumé. Vanilla JS, no build step, no dependencies.
   Views are hash-routed (#/, #/positions, #/pnl, #/receipts, #/skills, #/contact);
   route changes play the "order-flow wipe" on #wipe. Everything degrades to a plain
   stacked page without JS, and to simple cuts with prefers-reduced-motion. */
(function () {
  'use strict';

  // ---------- utils ----------
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function reduce() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function clamp(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function eOut(x) { return 1 - Math.pow(1 - x, 3); }
  function eIn(x) { return x * x * x; }
  function dprOf() { return Math.min(window.devicePixelRatio || 1, 2); }
  function sizeCanvas(c) {
    var b = c.getBoundingClientRect(), d = dprOf();
    var w = Math.max(1, Math.round(b.width)), h = Math.max(1, Math.round(b.height));
    if (c.width !== Math.round(w * d) || c.height !== Math.round(h * d)) { c.width = Math.round(w * d); c.height = Math.round(h * d); }
    var ctx = c.getContext('2d'); ctx.setTransform(d, 0, 0, d, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
  var C = { long: '#2FD282', short: '#F0465A', lime: '#D6FF3B', mute: '#6B7689', grid: 'rgba(255,255,255,0.05)', ink: '#E9EEF5' };

  // ---------- routes ----------
  var ROUTES = { '': 'trade', trade: 'trade', positions: 'positions', pnl: 'pnl', receipts: 'receipts', skills: 'skills', contact: 'contact' };
  var LABEL = { trade: 'TRADE', positions: 'POSITIONS', pnl: 'PNL', receipts: 'RECEIPTS', skills: 'SKILLS', contact: 'OPEN ORDER' };
  var BASE_TITLE = 'Long Ha (Bon) · Web3 social media & community-led growth';
  var TITLES = { trade: BASE_TITLE, positions: 'Positions · Bon', pnl: 'PnL · Bon', receipts: 'Receipts · Bon', skills: 'Skills · Bon', contact: 'Open an order · Bon' };
  var cur = null, busy = false, pending = null;
  function routeFromHash() { var h = (location.hash || '').replace(/^#\/?/, '').split(/[?#&]/)[0].toLowerCase(); return ROUTES[h] || 'trade'; }
  function show(v, focus) {
    $$('.view').forEach(function (el) { el.classList.toggle('on', el.getAttribute('data-view') === v); });
    $$('.nav a').forEach(function (a) {
      var on = a.getAttribute('data-route') === v;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.title = TITLES[v] || BASE_TITLE;
    window.scrollTo(0, 0);
    var prev = cur; cur = v;
    onLeave(prev); onEnter(v);
    if (focus) { var hd = $('#h-' + v); if (hd) { try { hd.focus({ preventScroll: true }); } catch (e) { hd.focus(); } } }
    var an = $('#announce'); if (an) an.textContent = (LABEL[v] || v).toLowerCase() + ' view';
  }
  function go(v) {
    if (v === cur) { window.scrollTo({ top: 0, behavior: reduce() ? 'auto' : 'smooth' }); return; }
    if (busy) { pending = v; return; }
    if (reduce()) { show(v, true); return; }
    busy = true;
    wipe(LABEL[v] || v.toUpperCase(), function () { show(v, true); }, function () {
      busy = false;
      if (pending && pending !== cur) { var p = pending; pending = null; go(p); } else pending = null;
    });
  }

  // ---------- the order-flow wipe ----------
  function scramble(target) {
    var CH = '▲▼$%#+-=<>0123456789ABCDEFX', start = performance.now();
    return function (now) {
      var p = clamp((now - start) / 380), n = Math.floor(p * target.length), s = '';
      for (var i = 0; i < target.length; i++) s += (i < n || target[i] === ' ') ? target[i] : CH[(Math.random() * CH.length) | 0];
      return s;
    };
  }
  function wipe(label, mid, done, opts) {
    opts = opts || {};
    var c = $('#wipe'); if (!c) { mid(); done(); return; }
    c.classList.add('on');
    var S = sizeCanvas(c), ctx = S.ctx, w = S.w, h = S.h;
    var colW = w < 700 ? 9 : 13, n = Math.ceil(w / colW), cols = [];
    for (var i = 0; i < n; i++) {
      var r = Math.random();
      cols.push({ d: (i / n) * 170 + Math.random() * 70, c: r < 0.07 ? C.short : (r < 0.15 ? C.lime : C.long), j: Math.random() });
    }
    var DUR = 270, HOLD = opts.hold != null ? opts.hold : 140;
    var phase = opts.startCovered ? 1 : 0, t0 = performance.now(), t1 = 0, scr = scramble('→ ' + label);
    if (opts.startCovered) { mid(); t1 = t0 + HOLD; }
    var fs = Math.max(24, Math.min(68, w * 0.055));
    function drawLabel(now, alpha) {
      if (alpha <= 0.01) return;
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '500 ' + Math.round(fs * 0.22 + 6) + 'px ' + MONO; ctx.fillStyle = C.mute;
      ctx.fillText('ROUTING ORDER', w / 2, h / 2 - fs * 0.95);
      ctx.font = '700 ' + Math.round(fs) + 'px ' + MONO; ctx.fillStyle = C.lime;
      ctx.shadowColor = 'rgba(214,255,59,0.55)'; ctx.shadowBlur = 24;
      ctx.fillText(scr(now), w / 2, h / 2);
      ctx.shadowBlur = 0;
      var bw = Math.min(260, w * 0.5), p = phase === 0 ? 0.5 : 1;
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(w / 2 - bw / 2, h / 2 + fs * 0.85, bw, 2);
      ctx.fillStyle = C.lime; ctx.fillRect(w / 2 - bw / 2, h / 2 + fs * 0.85, bw * p, 2);
      ctx.globalAlpha = 1;
    }
    function frame(now) {
      ctx.clearRect(0, 0, w, h);
      var all = true, cover = 0;
      for (var i = 0; i < n; i++) {
        var col = cols[i], x = i * colW, p, top, hh;
        if (phase === 0) { p = eOut(clamp((now - t0 - col.d) / DUR)); top = h - p * h; hh = p * h; }
        else { p = now < t1 ? 0 : eIn(clamp((now - t1 - col.d) / DUR)); top = 0; hh = (1 - p) * h; }
        if (p < 1) all = false;
        cover += hh / h;
        if (hh <= 0) continue;
        ctx.fillStyle = '#08120D'; ctx.fillRect(x, top, colW - 1, hh);
        var edge = phase === 0 ? top : top + hh, gl = 26 + col.j * 50;
        var g = ctx.createLinearGradient(0, edge, 0, phase === 0 ? edge + gl : edge - gl);
        g.addColorStop(0, col.c); g.addColorStop(1, 'rgba(8,18,13,0)');
        ctx.globalAlpha = 0.5; ctx.fillStyle = g;
        if (phase === 0) ctx.fillRect(x, edge, colW - 1, Math.min(gl, hh)); else ctx.fillRect(x, Math.max(top, edge - gl), colW - 1, Math.min(gl, hh));
        ctx.globalAlpha = 1; ctx.fillStyle = col.c; ctx.fillRect(x, phase === 0 ? edge : edge - 2, colW - 1, 2);
      }
      // LED rows
      ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#000';
      for (var y = h - 4; y > 0; y -= 4) ctx.fillRect(0, y, w, 1);
      ctx.globalCompositeOperation = 'source-over';
      var cv = cover / n;
      drawLabel(now, phase === 0 ? clamp((cv - 0.35) / 0.4) : clamp(cv * 1.6 - 0.2));
      if (phase === 0 && all) { phase = 1; mid(); t1 = performance.now() + HOLD; }
      else if (phase === 1 && all && now > t1) { ctx.clearRect(0, 0, w, h); c.classList.remove('on'); done(); return; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // ---------- boot ----------
  var bootDone = false;
  function boot(then) {
    var el = $('#boot'), pre = $('#boot-pre'), bar = $('#boot-bar');
    if (!el || document.documentElement.classList.contains('booted')) { bootDone = true; then(false); return; }
    var L = [
      ['> connecting to BON-PERP ', 'ok'],
      ['> syncing X analytics ', 'ok'],
      ['> pulling DefiLlama volume ', 'ok'],
      ['> loading receipts ', '7 fills'],
      ['> margin mode ', 'cross (vibes)'],
      ['> gm.', '']
    ];
    var i = 0, html = '', t = 0, finished = false;
    function pad(s) { var dots = Math.max(3, 34 - s.length); return s + new Array(dots).join('.') + ' '; }
    function finish() {
      if (finished) return; finished = true; bootDone = true;
      clearInterval(t);
      try { sessionStorage.setItem('bonperp_booted', '1'); } catch (e) {}
      window.removeEventListener('keydown', finish); el.removeEventListener('pointerdown', finish);
      then(true);
    }
    t = setInterval(function () {
      if (i < L.length) {
        var l = L[i];
        html += l[1] ? (pad(l[0]) + '<span class="ok">' + l[1] + '</span>\n') : '<span class="l">' + l[0] + '</span>\n';
        pre.innerHTML = html; i++;
        bar.style.width = Math.round(i / L.length * 100) + '%';
      } else { finish(); }
    }, 170);
    window.addEventListener('keydown', finish); el.addEventListener('pointerdown', finish);
  }

  // ---------- career chart (illustrative) ----------
  var career = (function () {
    var c, tip, data = [], frac = 1, raf = 0, live = 0, hover = -1, drawn = 0, geo = null;
    var START = 2021 + 3 / 12, SPAN = 5.5; // Apr 2021 -> Oct 2026
    function era(t) {
      var y = START + t * SPAN;
      if (y < 2025 + 4 / 12) return 'Freelance ×4';
      if (y < 2025 + 6 / 12) return '';
      if (y < 2026 + 4 / 12) return 'Kame · FlowX · Aurum';
      if (y < 2026 + 7.6 / 12) return '';
      return 'Bullet.xyz';
    }
    function gen() {
      var n = 132, s = 20, v = 0.1, out = [];
      function r() { s = (s * 9301 + 49297) % 233280; return s / 233280; }
      for (var i = 0; i < n; i++) {
        var t = i / (n - 1), y = START + t * SPAN, drift;
        if (y < 2022) drift = 0.006; else if (y < 2023) drift = -0.0025; else if (y < 2024) drift = 0.003;
        else if (y < 2025) drift = 0.006; else if (y < 2026) drift = 0.009; else drift = 0.016;
        var o = v; v = Math.max(0.04, Math.min(0.96, v + drift + (r() - 0.48) * 0.035));
        out.push({ o: o, c: v, h: Math.max(o, v) + r() * 0.022, l: Math.min(o, v) - r() * 0.022, t: t });
      }
      return out;
    }
    function lbl(t) { var y = START + t * SPAN, yr = Math.floor(y + 1e-6), mo = Math.min(11, Math.floor((y - yr) * 12 + 1e-6)); return MON[mo] + ' ' + yr; }
    function draw(k) {
      var S = sizeCanvas(c), ctx = S.ctx, w = S.w, h = S.h;
      var from = Math.floor(data.length * (1 - frac)), vis = data.slice(from), n = vis.length;
      var padL = 16, padR = 66, padT = 26, padB = 24, pw = w - padL - padR, ph = h - padT - padB, bw = pw / n;
      var mn = 1, mx = 0; vis.forEach(function (p) { if (p.l < mn) mn = p.l; if (p.h > mx) mx = p.h; });
      var span = (mx - mn) || 1; mn -= span * 0.06; mx += span * 0.1;
      function Y(v) { return padT + ph - (v - mn) / (mx - mn) * ph; }
      geo = { padL: padL, bw: bw, n: n, from: from, w: w, Y: Y, padT: padT, ph: ph };
      ctx.clearRect(0, 0, w, h);
      for (var g = 0; g <= 4; g++) { var gy = Math.round(padT + ph * g / 4) + 0.5; ctx.fillStyle = C.grid; ctx.fillRect(padL, gy, pw, 1); }
      var shown = Math.min(n, k == null ? n : k);
      for (var i = 0; i < shown; i++) {
        var p = vis[i], x = padL + i * bw + bw / 2, up = p.c >= p.o, col = (i === hover) ? C.ink : (up ? C.long : C.short);
        ctx.fillStyle = col; ctx.globalAlpha = (hover >= 0 && i !== hover) ? 0.75 : 1;
        ctx.fillRect(Math.round(x) - 0.5, Y(p.h), 1, Math.max(1, Y(p.l) - Y(p.h)));
        var top = Y(Math.max(p.o, p.c)), hh = Math.max(1.5, Math.abs(Y(p.o) - Y(p.c)));
        ctx.fillRect(x - bw * 0.32, top, Math.max(1, bw * 0.64), hh);
      }
      ctx.globalAlpha = 1;
      // job markers
      ctx.font = '500 10.5px ' + MONO; ctx.textBaseline = 'alphabetic';
      var tiny = w < 560;
      [[0.0, tiny ? '’21' : 'FREELANCE ×4 · ’21'], [(2025 + 6 / 12 - START) / SPAN, tiny ? 'KAME · FLOWX' : 'KAME · FLOWX · AURUM · ’25'], [(2026 + 7.6 / 12 - START) / SPAN, tiny ? 'BULLET' : 'BULLET · ’26']].forEach(function (m) {
        var gi = Math.round(m[0] * (data.length - 1)) - from; if (gi < 0 || gi >= shown) return;
        var x = Math.round(padL + gi * bw + bw / 2) + 0.5, yy = Math.max(12, Y(vis[gi].h) - 12), right = gi > n * 0.5;
        ctx.strokeStyle = 'rgba(214,255,59,0.35)'; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(x, yy + 4); ctx.lineTo(x, padT + ph); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = C.lime; ctx.textAlign = right ? 'right' : 'left'; ctx.fillText(m[1], right ? x - 6 : x + 5, yy);
      });
      // years
      ctx.fillStyle = C.mute; ctx.textAlign = 'center';
      for (var yr = 2022; yr <= 2026; yr++) { var gi2 = Math.round((yr - START) / SPAN * (data.length - 1)) - from; if (gi2 < 1 || gi2 >= n) continue; ctx.fillText(String(yr), padL + gi2 * bw, h - 6); }
      // last price
      if (shown === n) {
        var last = vis[n - 1], ly = Y(last.c);
        ctx.strokeStyle = 'rgba(47,210,130,0.55)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(padL, ly); ctx.lineTo(w - padR, ly); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = C.long; ctx.fillRect(w - padR + 4, ly - 10, 58, 20);
        ctx.fillStyle = '#04130B'; ctx.font = '700 11px ' + MONO; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('ATH', w - padR + 33, ly + 0.5);
      }
      // crosshair
      if (hover >= 0 && hover < n) {
        var hx = Math.round(padL + hover * bw + bw / 2) + 0.5;
        ctx.strokeStyle = 'rgba(233,238,245,0.25)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(hx, padT - 6); ctx.lineTo(hx, padT + ph); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    function animateIn() {
      if (raf) cancelAnimationFrame(raf);
      var n = Math.floor(data.length * frac), t0 = performance.now(), D = reduce() ? 0 : 900;
      (function f(now) { var k = D ? Math.ceil(eOut(clamp((now - t0) / D)) * n) : n; drawn = k; draw(k); if (k < n) raf = requestAnimationFrame(f); else raf = 0; })(t0);
    }
    function tick() {
      if (raf || document.hidden) return;
      var p = data[data.length - 1], nc = Math.max(p.l + 0.004, Math.min(p.h + 0.01, p.c + (Math.random() - 0.4) * 0.008));
      p.c = nc; if (nc > p.h) p.h = nc;
      draw();
      var px = $('#cpx'); if (px) { px.style.transition = 'none'; px.style.color = C.lime; requestAnimationFrame(function () { px.style.transition = 'color .8s'; px.style.color = ''; }); }
    }
    function onMove(ev) {
      if (!geo || raf) return;
      var r = c.getBoundingClientRect(), x = ev.clientX - r.left, i = Math.floor((x - geo.padL) / geo.bw);
      if (i < 0 || i >= geo.n) { leave(); return; }
      if (i !== hover) { hover = i; draw(); }
      var p = data[geo.from + i], e2 = era(p.t);
      tip.innerHTML = lbl(p.t) + (e2 ? ' · <b>' + e2 + '</b>' : '');
      tip.hidden = false;
      var bx = geo.padL + (i + 0.5) * geo.bw, half = tip.offsetWidth / 2 + 4;
      tip.style.left = Math.max(half, Math.min(geo.w - half, bx)) + 'px';
      tip.style.top = Math.max(26, geo.Y(p.h) - 8) + 'px';
    }
    function leave() { tip.hidden = true; if (hover !== -1) { hover = -1; if (!raf) draw(); } }
    return {
      init: function () {
        c = $('#career'); tip = $('#ctip'); if (!c) return;
        data = gen();
        c.addEventListener('pointermove', onMove); c.addEventListener('pointerdown', onMove); c.addEventListener('pointerleave', leave);
        $$('.tf button').forEach(function (b) {
          b.addEventListener('click', function () {
            $$('.tf button').forEach(function (x) { x.classList.toggle('on', x === b); });
            frac = +b.getAttribute('data-tf') || 1; hover = -1; tip.hidden = true; animateIn();
          });
        });
      },
      start: function () { if (!c) return; hover = -1; animateIn(); if (!live) live = setInterval(tick, 1200); },
      stop: function () { if (live) { clearInterval(live); live = 0; } if (raf) { cancelAnimationFrame(raf); raf = 0; } },
      redraw: function () { if (c && !raf) draw(); }
    };
  })();

  // ---------- Bullet perps volume (DefiLlama snapshot in volume-data.js) ----------
  function fmtVol(k) { return k >= 1000 ? '$' + (k / 1000).toFixed(1).replace(/\.0$/, '') + 'M' : '$' + Math.round(k) + 'K'; }
  function volDay(i) { return new Date(Date.parse(window.BULLET_VOL.start + 'T00:00:00Z') + i * 864e5); }
  function drawVolume(c, opts) {
    var V = window.BULLET_VOL; if (!V || !c) return null;
    var S = sizeCanvas(c), ctx = S.ctx, w = S.w, h = S.h; if (w < 20) return null;
    var d = V.d, n = d.length, max = 0, i;
    for (i = 0; i < n; i++) if (d[i] > max) max = d[i];
    var mini = !!opts.mini, sm = w < 560;
    var padL = mini ? 0 : (sm ? 36 : 46), padR = mini ? 0 : 6, padT = mini ? 6 : 30, padB = mini ? 2 : 22;
    var pw = w - padL - padR, ph = h - padT - padB, bw = pw / n, base = padT + ph, top = Math.ceil(max / 10000) * 10000;
    var joinI = Math.round((Date.parse(V.joined) - Date.parse(V.start)) / 864e5), jx = padL + joinI * bw;
    var p = opts.p == null ? 1 : opts.p, hov = opts.hover == null ? -1 : opts.hover;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(47,210,130,0.04)'; ctx.fillRect(jx, padT, padL + pw - jx, ph);
    for (i = 0; i < n; i++) {
      var v = d[i]; if (v == null || v <= 0) continue;
      var lp = clamp(p * 1.7 - (i / n) * 0.7), hh = Math.max(1.5, (v / top) * ph * eOut(lp));
      ctx.fillStyle = i === hov ? C.ink : (i >= n - 3 ? C.lime : (i >= joinI ? C.long : '#253141'));
      ctx.fillRect(padL + i * bw + (bw > 3 ? 0.5 : 0), base - hh, Math.max(1, bw - (bw > 3 ? 1 : 0.3)), hh);
    }
    ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#000';
    var step = mini ? 3 : (sm ? 4 : 5);
    for (var y = base - step; y > padT - step; y -= step) ctx.fillRect(padL, y, pw, 1);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(214,255,59,0.75)'; ctx.setLineDash([3, 3]); ctx.beginPath();
    ctx.moveTo(Math.round(jx) + 0.5, mini ? 0 : padT - 14); ctx.lineTo(Math.round(jx) + 0.5, base); ctx.stroke(); ctx.setLineDash([]);
    if (!mini) {
      ctx.font = '10px ' + MONO; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (var g = 0; g <= top; g += 10000) {
        var gy = Math.round(base - (g / top) * ph) + 0.5;
        ctx.fillStyle = g ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.14)'; ctx.fillRect(padL, gy, pw, 1);
        ctx.fillStyle = C.mute; ctx.fillText(g ? '$' + (g / 1000) + 'M' : '$0', padL - 7, gy);
      }
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      for (i = 0; i < n; i++) { var dt = volDay(i); if (dt.getUTCDate() !== 1) continue; var mx2 = Math.round(padL + i * bw) + 0.5; ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(mx2, base, 1, 5); ctx.fillStyle = C.mute; ctx.fillText(MON[dt.getUTCMonth()].toUpperCase(), mx2 + 3, h - 5); }
      ctx.fillStyle = C.lime; ctx.textBaseline = 'middle'; ctx.fillText('▸ bon joins', jx + 6, padT - 14);
      if (p >= 1) { var lv = d[n - 1]; ctx.textAlign = 'right'; ctx.font = '700 11px ' + MONO; ctx.fillText(fmtVol(lv) + ' / day', padL + pw - (sm ? 6 : 10), Math.max(padT - 14, base - (lv / top) * ph - 12)); }
    }
    return { padL: padL, bw: bw, n: n, w: w };
  }
  var vol = (function () {
    var c, tip, raf = 0, geo = null, hover = -1;
    function draw(anim) {
      if (!c) return;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      var D = (anim && !reduce()) ? 1300 : 0, t0 = performance.now();
      (function f(now) { var p = D ? clamp((now - t0) / D) : 1; geo = drawVolume(c, { p: p, hover: hover }); if (p < 1) raf = requestAnimationFrame(f); else raf = 0; })(t0);
    }
    function at(ev) {
      if (!geo || raf) return;
      var r = c.getBoundingClientRect(), i = Math.floor((ev.clientX - r.left - geo.padL) / geo.bw);
      if (i < 0 || i >= geo.n) { off(); return; }
      if (i !== hover) { hover = i; draw(false); }
      var v = window.BULLET_VOL.d[i], dt = volDay(i);
      tip.innerHTML = MON[dt.getUTCMonth()] + ' ' + dt.getUTCDate() + ' · <b>' + (v == null ? 'no data' : fmtVol(v)) + '</b>';
      tip.hidden = false;
      var bx = geo.padL + (i + 0.5) * geo.bw, half = tip.offsetWidth / 2 + 2;
      tip.style.left = Math.max(half, Math.min(geo.w - half, bx)) + 'px'; tip.style.top = '30px';
    }
    function off() { tip.hidden = true; if (hover !== -1) { hover = -1; if (!raf) draw(false); } }
    return {
      init: function () { c = $('#vol'); tip = $('#vtip'); if (!c) return; c.addEventListener('pointermove', at); c.addEventListener('pointerdown', at); c.addEventListener('pointerleave', off); },
      draw: draw
    };
  })();
  function drawMinis() { $$('canvas[data-mini]').forEach(function (m) { if (m.offsetParent) drawVolume(m, { mini: true }); }); }

  // ---------- count-ups / depth bars ----------
  function fmtN(v, dec) { return dec ? v.toFixed(dec) : String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function countUps(root) {
    var els = $$('[data-count]', root);
    els.forEach(function (el, k) {
      var to = +el.getAttribute('data-to') || 0, dec = +el.getAttribute('data-dec') || 0, pre = el.getAttribute('data-prefix') || '', suf = el.getAttribute('data-suffix') || '';
      if (reduce()) { el.textContent = pre + fmtN(to, dec) + suf; return; }
      var t0 = performance.now() + 180 + k * 80, D = 1200;
      (function f(now) { var p = eOut(clamp((now - t0) / D)); el.textContent = pre + fmtN(to * p, dec) + suf; if (p < 1) requestAnimationFrame(f); })(performance.now());
    });
  }
  function depthBars() {
    var bars = $$('.drow .bar');
    bars.forEach(function (b) { b.style.transition = 'none'; b.style.width = '0'; });
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      bars.forEach(function (b, k) { b.style.transition = ''; b.style.transitionDelay = (200 + k * 70) + 'ms'; b.style.width = b.getAttribute('data-w') + '%'; });
    }); });
  }

  // ---------- order book flicker ----------
  var book = (function () {
    var t = 0;
    function set(jitter) { $$('.book .row i').forEach(function (i) { var d = +i.getAttribute('data-d') || 50; i.style.width = Math.max(8, Math.min(100, d + (jitter ? (Math.random() - 0.5) * 16 : 0))) + '%'; }); }
    return {
      start: function () {
        $$('.book .row i').forEach(function (i) { i.style.transition = 'none'; i.style.width = '0'; });
        requestAnimationFrame(function () { requestAnimationFrame(function () { $$('.book .row i').forEach(function (i) { i.style.transition = ''; }); set(false); }); });
        if (!t && !reduce()) t = setInterval(function () { if (!document.hidden) set(true); }, 1700);
      },
      stop: function () { if (t) { clearInterval(t); t = 0; } }
    };
  })();

  // ---------- recent fills (streams the receipts) ----------
  var fills = (function () {
    var box, data = [], k = 0, t = 0;
    function fd(s) { var d = new Date(s + 'T00:00:00Z'); return MON[d.getUTCMonth()] + ' ' + d.getUTCDate(); }
    function row(item, isNew) {
      var el = document.createElement('a'); el.href = '#/receipts'; el.className = 'fill' + (isNew ? ' new' : '');
      var s = document.createElement('span'); s.className = 's'; s.textContent = 'FILL';
      var tx = document.createElement('span'); tx.className = 't'; tx.textContent = item.r;
      var u = document.createElement('span'); u.className = 'u'; u.textContent = '→ @' + item.to + ' · ' + fd(item.d);
      el.appendChild(s); el.appendChild(tx); el.appendChild(u); return el;
    }
    function push() {
      if (document.hidden || !data.length) return;
      box.insertBefore(row(data[k % data.length], true), box.firstChild); k++;
      while (box.children.length > 4) box.removeChild(box.lastChild);
    }
    return {
      init: function () { box = $('#fills'); try { data = JSON.parse($('#fills-data').textContent); } catch (e) { data = []; } },
      start: function () {
        if (!box || !data.length) return;
        box.innerHTML = ''; k = 0;
        for (var i = 3; i >= 0; i--) box.appendChild(row(data[i % data.length], false));
        k = 4;
        if (!t && !reduce()) t = setInterval(push, 2800);
      },
      stop: function () { if (t) { clearInterval(t); t = 0; } }
    };
  })();

  // ---------- view hooks ----------
  function onEnter(v) {
    if (v === 'trade') { career.start(); book.start(); fills.start(); }
    if (v === 'pnl') { countUps($('#v-pnl')); vol.draw(true); }
    if (v === 'positions') { requestAnimationFrame(drawMinis); }
    if (v === 'skills') depthBars();
  }
  function onLeave(v) {
    if (v === 'trade') { career.stop(); book.stop(); fills.stop(); }
  }

  // ---------- tickets ----------
  var VOICES = [
    ['1×', 'corporate', 'announcements, docs-grade threads, partner posts'],
    ['10×', 'brand-safe', 'clean launch content, a friendly community voice'],
    ['25×', 'CT-native', 'sharp takes and market commentary'],
    ['50×', 'reply-led', 'replies that beat the original post'],
    ['100×', 'full degen', 'memes, shitposts, zero bootlicking']
  ];
  function initTickets() {
    $$('[data-ticket]').forEach(function (tk) {
      var short = $('.short', tk), lev = $('.lev', tk), cta = $('[data-cta]', tk), size = $('input[type=number]', tk);
      short.addEventListener('click', function () {
        tk.classList.remove('shake'); void tk.offsetWidth; tk.classList.add('shake');
        toast('Shorting Bon? Bold. Shorts are disabled on this market.');
      });
      $$('.seg button', tk).forEach(function (b) {
        b.addEventListener('click', function () { $$('.seg button', tk).forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); }); });
      });
      function setLev() {
        var v = VOICES[+lev.value] || VOICES[3];
        $('[data-levx]', tk).textContent = v[0];
        $('[data-voice]', tk).innerHTML = '<b>' + v[1] + '</b> · ' + v[2];
        lev.style.setProperty('--p', (+lev.value / 4 * 100) + '%');
        lev.setAttribute('aria-valuetext', v[0] + ', ' + v[1]);
      }
      lev.addEventListener('input', setLev); setLev();
      size.addEventListener('change', function () { var n = Math.round(+size.value || 20); size.value = Math.max(1, Math.min(60, n)); });
      cta.addEventListener('click', function () {
        if (cta.classList.contains('filled')) return;
        cta.classList.add('filled'); var txt = cta.textContent; cta.textContent = 'Filled ✓ opening Telegram…';
        setTimeout(function () { cta.classList.remove('filled'); cta.textContent = txt; }, 2600);
      });
    });
  }

  // ---------- positions / receipts interactions ----------
  function initPositions() {
    $$('.xbtn').forEach(function (b) {
      b.addEventListener('click', function () {
        var det = document.getElementById(b.getAttribute('aria-controls')); if (!det) return;
        var open = det.hidden; det.hidden = !open;
        b.setAttribute('aria-expanded', open ? 'true' : 'false'); b.textContent = open ? '−' : '+';
        if (open) requestAnimationFrame(drawMinis);
      });
    });
    $$('tr.link').forEach(function (tr) { tr.addEventListener('click', function () { location.hash = tr.getAttribute('data-href') || '#/positions'; }); });
  }
  var twWait = null;
  function withTwitter(cb) {
    if (window.twttr && window.twttr.widgets && window.twttr.widgets.createTweet) { cb(true); return; }
    if (!twWait) {
      twWait = [];
      var s = document.createElement('script'); s.src = 'https://platform.twitter.com/widgets.js'; s.async = true; s.charset = 'utf-8';
      s.onerror = function () { var q = twWait || []; twWait = null; q.forEach(function (f) { f(false); }); };
      document.head.appendChild(s);
      var n = 0, t = setInterval(function () {
        var ok = window.twttr && window.twttr.widgets && window.twttr.widgets.createTweet;
        if (ok || ++n > 100) { clearInterval(t); var q = twWait || []; twWait = null; q.forEach(function (f) { f(!!ok); }); }
      }, 100);
    }
    twWait.push(cb);
  }
  function initReceipts() {
    $$('.load').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.rc'), box = card && $('.embed', card); if (!box) return;
        if (!box.hidden) { box.hidden = true; btn.textContent = 'load original'; return; }
        box.hidden = false; btn.textContent = 'hide original';
        if (box.getAttribute('data-done')) return;
        box.textContent = 'loading the post from X…'; btn.disabled = true;
        var fail = function () { btn.disabled = false; box.textContent = 'X didn’t load here. Use “view on X” instead.'; };
        withTwitter(function (ok) {
          if (!ok) { fail(); return; }
          box.textContent = '';
          window.twttr.widgets.createTweet(btn.getAttribute('data-tweet'), box, { theme: 'dark', dnt: true, align: 'center', conversation: 'all' })
            .then(function (el) { btn.disabled = false; if (el) box.setAttribute('data-done', '1'); else fail(); }, fail);
        });
      });
    });
  }

  // ---------- toast ----------
  var toastT = 0, toastEl = null;
  function toast(m) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); }
    toastEl.textContent = m; document.body.appendChild(toastEl);
    toastEl.style.animation = 'none'; void toastEl.offsetWidth; toastEl.style.animation = '';
    clearTimeout(toastT); toastT = setTimeout(function () { if (toastEl) toastEl.remove(); }, 3400);
  }

  // ---------- command line ----------
  var hist = [], hi = -1;
  function log(text, kind) {
    var L = $('#log'); if (!L) return;
    L.hidden = false;
    var d = document.createElement('div'); d.className = kind || 'out'; d.textContent = text; L.appendChild(d);
    while (L.children.length > 60) L.removeChild(L.firstChild);
    L.scrollTop = L.scrollHeight;
  }
  var ALIAS = { home: 'trade', top: 'trade', trade: 'trade', track: 'positions', work: 'positions', positions: 'positions', jobs: 'positions', experience: 'positions',
    pnl: 'pnl', results: 'pnl', numbers: 'pnl', receipts: 'receipts', pow: 'receipts', replies: 'receipts', fills: 'receipts',
    skills: 'skills', depth: 'skills', contact: 'contact', hire: 'contact', dm: 'contact', order: 'contact', gm: null };
  function route(id) { location.hash = id === 'trade' ? '#/' : '#/' + id; }
  function run(raw) {
    var cmd = (raw || '').trim(); if (!cmd) return;
    hist.push(cmd); log('bon@perp:~$ ' + cmd, 'in');
    var parts = cmd.split(/\s+/), c = parts[0].toLowerCase(), arg = parts.slice(1).join(' ').toLowerCase().replace(/^[~/#]+/, '');
    if (c === 'help' || c === '?') { log('COMMANDS\n  ls                 list the pages\n  cd <page>          trade · positions · pnl · receipts · skills · contact\n  home               back to the dashboard\n  whoami · man\n  gm · wagmi · rekt · long · short\n  sudo hire-me       open an order\n  clear              clear this log  (esc closes it)', 'sys'); return; }
    if (c === 'ls' || c === 'dir') { log('PAGES · cd <name>\n  trade  positions  pnl  receipts  skills  contact', 'sys'); return; }
    if (c === 'cd' || c === 'open' || c === 'go' || c === 'goto') { var id = ALIAS[arg]; if (id) { route(id); log('→ ' + id, 'out'); } else log("no such page: '" + arg + "'. try 'ls'.", 'warn'); return; }
    if (c === 'home') { route('trade'); log('→ trade', 'out'); return; }
    if (c === 'long') { log('going long. opening the order ticket.', 'sys'); route('contact'); return; }
    if (c === 'short') { log("shorts are disabled on this market. you're welcome.", 'warn'); return; }
    if (c === 'gm') { log("gm. it's always morning somewhere on CT.", 'sys'); return; }
    if (c === 'wagmi') { log('we are. (past performance not guaranteed.)', 'out'); return; }
    if (c === 'rekt') { log("position liquidated. just kidding. you're on cross margin.", 'warn'); return; }
    if (c === 'ngmi') { log('not on my timeline.', 'out'); return; }
    if (c === 'whoami') { log('Long Ha (Bon): web3 social media and community-led growth. native VI, English C1.', 'out'); return; }
    if (c === 'man') { log('NAME\n  bon: web3 social media and community-led growth.\nSYNOPSIS\n  bon [--reply-led] [--kol] [--launch] [--crisis-comms]\nBUGS\n  replies faster than is socially acceptable.', 'out'); return; }
    if (c === 'top' || c === 'htop') { log('PID  PROCESS            LOAD\n  1  reply_guy           99%\n  2  kol_dms             71%\n 12  tabs_open           ●●●●●●●●●●●●\n  0  sleep               ERR: not found', 'out'); return; }
    if (c === 'sudo') { if (/hire-?me/.test(arg)) { log('[sudo] no password needed. opening an order.', 'sys'); setTimeout(function () { route('contact'); }, 300); } else log('permission denied. (try: sudo hire-me)', 'out'); return; }
    if (c === 'exit' || c === 'quit') { log('no exit. the market never closes.', 'out'); return; }
    if (c === 'clear' || c === 'cls') { var L = $('#log'); L.innerHTML = ''; L.hidden = true; return; }
    if (ALIAS[c]) { route(ALIAS[c]); log('→ ' + ALIAS[c], 'out'); return; }
    log("command not found: '" + parts[0] + "'. try 'help'.", 'warn');
  }
  function initConsole() {
    var f = $('#cmdform'), inp = $('#cmd'); if (!f || !inp) return;
    f.addEventListener('submit', function (e) { e.preventDefault(); var v = inp.value; inp.value = ''; hi = -1; run(v); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp') { e.preventDefault(); if (hist.length) { hi = Math.min(hist.length - 1, hi + 1); inp.value = hist[hist.length - 1 - hi] || ''; } }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (hi > 0) { hi--; inp.value = hist[hist.length - 1 - hi] || ''; } else { hi = -1; inp.value = ''; } }
    });
    window.addEventListener('keydown', function (e) {
      var a = document.activeElement, typing = a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA');
      if (e.key === '/' && !typing) { e.preventDefault(); inp.focus(); }
      if (e.key === 'Escape') { var L = $('#log'); if (L) L.hidden = true; if (a === inp) inp.blur(); }
    });
    document.addEventListener('pointerdown', function (e) { var L = $('#log'); if (L && !L.hidden && !e.target.closest('#log') && !e.target.closest('.status')) L.hidden = true; });
  }

  // ---------- konami: green candle ----------
  function initKonami() {
    var seq = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'], i = 0;
    window.addEventListener('keydown', function (e) {
      var k = (e.key || '').toLowerCase();
      if (k === seq[i]) { i++; if (i === seq.length) { i = 0; greenCandle(); } } else i = (k === seq[0]) ? 1 : 0;
    });
  }
  function greenCandle() {
    if (reduce()) { toast('GREEN CANDLE · all timeframes'); return; }
    var wrap = document.createElement('div');
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:95;pointer-events:none;overflow:hidden;';
    var chars = ['▲', '▲', '$', '◆', '+', '%', '▮'], cols = [C.long, C.lime, C.long, '#9fe8cc'];
    for (var i = 0; i < 34; i++) {
      var s = document.createElement('span'); s.textContent = chars[(Math.random() * chars.length) | 0];
      s.style.cssText = 'position:absolute;top:-10vh;left:' + (Math.random() * 100).toFixed(1) + '%;font-size:' + (12 + Math.random() * 22).toFixed(0) + 'px;color:' + cols[(Math.random() * cols.length) | 0] + ';text-shadow:0 0 12px currentColor;transition:transform ' + (2.2 + Math.random() * 2.4).toFixed(2) + 's linear ' + (Math.random() * 1.2).toFixed(2) + 's;';
      wrap.appendChild(s);
    }
    var big = document.createElement('div');
    big.style.cssText = 'position:absolute;top:42%;left:50%;transform:translate(-50%,-50%);text-align:center;font-family:' + MONO + ';';
    big.innerHTML = '<div style="font-size:clamp(36px,8vw,88px);font-weight:700;color:#2FD282;text-shadow:0 0 30px rgba(47,210,130,.6)">GREEN CANDLE</div><div style="font-size:12px;letter-spacing:.4em;color:#D6FF3B;margin-top:6px">ALL TIMEFRAMES</div>';
    wrap.appendChild(big); document.body.appendChild(wrap);
    requestAnimationFrame(function () { requestAnimationFrame(function () { $$('span', wrap).forEach(function (s) { s.style.transform = 'translateY(120vh) rotate(380deg)'; }); }); });
    setTimeout(function () { wrap.remove(); }, 5200);
  }

  // ---------- ambient + clock ----------
  function initAmbient() {
    var bg = $('#bg'), q = false, x = 0, y = 0;
    if (!bg || reduce()) return;
    window.addEventListener('pointermove', function (e) {
      x = e.clientX; y = e.clientY; if (q) return; q = true;
      requestAnimationFrame(function () { q = false; bg.style.setProperty('--mx', x + 'px'); bg.style.setProperty('--my', y + 'px'); });
    }, { passive: true });
  }
  function initClock() {
    var el = $('#clock'); if (!el) return;
    function p(n) { return String(n).padStart(2, '0'); }
    function u() { var d = new Date(); el.textContent = p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds()) + ' UTC'; }
    u(); setInterval(u, 1000);
  }

  // ---------- init ----------
  function init() {
    career.init(); vol.init(); fills.init();
    initTickets(); initPositions(); initReceipts(); initConsole(); initKonami(); initAmbient(); initClock();
    var rt = 0;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { if (cur === 'trade') career.redraw(); if (cur === 'pnl') vol.draw(false); if (cur === 'positions') drawMinis(); }, 120);
    });
    window.addEventListener('hashchange', function () { if (bootDone) go(routeFromHash()); });
    boot(function (animated) {
      var v = routeFromHash();
      if (animated && !reduce()) {
        busy = true;
        wipe(LABEL[v], function () { var b = $('#boot'); if (b) b.style.display = 'none'; show(v, false); }, function () { busy = false; if (pending && pending !== cur) { var p = pending; pending = null; go(p); } }, { startCovered: true, hold: 220 });
      } else {
        var b = $('#boot'); if (b) b.style.display = 'none';
        show(v, false);
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
