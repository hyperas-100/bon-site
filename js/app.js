/* app.js — Bon's site.
   Scroll cinematic (market planet -> monogram -> wormhole -> liquidity map), section overlays,
   command console, results count-up, flight game wiring.

   The scroll-cinematic / galaxy-node projection / wormhole structure is adapted from
   cudam321.com (https://github.com/cudam321/cudam321.com), MIT License © 2026 Cudam — see LICENSE.
   All copy, data and commands below are Bon's own. No framework; runs after DOM parse (defer). */
(function () {
  'use strict';

  // ---------- data ----------
  var META = {
    track:   { t: 'The Long Position', n: '01', sub: 'where I\'ve worked' },
    results: { t: 'The PnL',           n: '02', sub: 'the numbers' },
    skills:  { t: 'Character Sheet',   n: '03', sub: 'what I do' },
    contact: { t: 'Open Order',        n: '04', sub: 'say gm' }
  };
  var TOTAL = Object.keys(META).length;
  var ROOMS = {
    home: '__home', hero: '__home', top: '__home',
    track: 'track', work: 'track', career: 'track', jobs: 'track', experience: 'track', long: 'track',
    results: 'results', pnl: 'results', numbers: 'results', metrics: 'results',
    skills: 'skills', sheet: 'skills', character: 'skills', stats: 'skills',
    contact: 'contact', hire: 'contact', dm: 'contact', order: 'contact', hello: 'contact', hi: 'contact'
  };

  // the flight: four stops climbing a rising chart (level = chart height 0..1)
  var SYS = [
    { label: 'Freelance ’21–’25', color: [255, 190, 90], size: 11, level: 0.10, seed: 3, mono: '×4',  stat: '0 → 800k+ users' },
    { label: 'Kame · Sei',        color: [46, 230, 166], size: 10, level: 0.42, seed: 5, mono: 'KM',  stat: '~800% KOL efficiency' },
    { label: 'FlowX · Aurum',     color: [110, 200, 240], size: 8, level: 0.66, seed: 7, mono: 'F+A', stat: 'KOL + full-stack growth' },
    { label: 'Bullet.xyz ’26',    color: [255, 120, 150], size: 13, level: 0.95, seed: 9, mono: 'BX', live: true, stat: '1M monthly impressions' }
  ];

  // ---------- module state ----------
  var E = {};
  var state = { lang: 'en', section: null };
  var history_ = [], hi_ = -1;
  var sceneHandles = [];
  var gx = null;
  var COARSE = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  var sbg = null;
  var flight = null;
  var scrollQ = false;
  var toastEl = null, tt = 0, gt = 0;
  var wormActive = false, wormWarp = 1, wormDestroyed = false, wormBuild = null;
  var sfRaf = 0, sfMake = null, clockT = 0, bootT = 0, bootEnded = false;
  var countRaf = 0;

  function reduce() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function $(id) { return document.getElementById(id); }

  function cacheEls() {
    E.root = $('root'); E.sf = $('starfield'); E.globe = $('globe');
    E.galaxy = $('galaxy'); E.galaxyWrap = $('galaxy-wrap'); E.clock = $('clock');
    E.bootEl = $('boot-pre'); E.boot = $('boot'); E.input = $('cmd-input');
    E.logEl = $('cmd-log'); E.stage = $('stage'); E.earthWrap = $('earth-wrap');
    E.worm = $('wormhole'); E.face = $('face'); E.faceWrap = $('face-wrap'); E.heroText = $('hero-text'); E.tagEl = $('tagline');
    E.overlay = $('overlay'); E.secCounter = $('sec-counter');
  }

  function whenEngine(cb) {
    if (window.AsciiArt) return cb();
    var n = 0, t = setInterval(function () {
      if (window.AsciiArt) { clearInterval(t); cb(); } else if (++n > 240) clearInterval(t);
    }, 50);
  }
  function whenGalaxy(cb) {
    if (window.Galaxy) return cb();
    var n = 0, t = setInterval(function () {
      if (window.Galaxy) { clearInterval(t); cb(); } else if (++n > 240) clearInterval(t);
    }, 50);
  }

  // ---------- ascii art (market planet + monogram) ----------
  function mountHero() {
    if (!E.globe) return;
    var sm = window.innerWidth < 760;
    window.AsciiArt.globe(E.globe, {
      textureSrc: 'images/market.jpg', color: true, monoColor: '#9fe8cc', ramp: ' .:-=+|*#%@',
      fontSize: sm ? 9 : 11, maxCols: sm ? 96 : 180, secondsPerRotation: 30,
      gamma: 0.8, transparent: true
    });
    if (E.face) window.AsciiArt.image(E.face, { src: 'images/mark.jpg', color: true, fontSize: sm ? 6 : 8, maxCols: sm ? 130 : 240, gamma: 0.8, transparent: true });
  }
  function mountSectionArt(sec) {
    if (!sec) return;
    if (!window.AsciiArt) { whenEngine(function () { mountSectionArt(sec); }); return; }
    var sm = window.innerWidth < 760;
    var els = sec.querySelectorAll('[data-art]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el._mounted) continue;
      var kind = el.getAttribute('data-art'), h = null;
      if (kind === 'portrait') {
        el.textContent = ''; el.style.padding = '0'; el.style.display = 'block';
        h = window.AsciiArt.image(el, { src: 'images/mark.jpg', color: true, fontSize: 4, maxCols: 130, gamma: 0.8, transparent: true });
      } else if (kind === 'trajectory' && window.Trajectory) {
        h = flight = window.Trajectory.mount(el, { systems: SYS, onDock: onDock });
        wireFlight();
      }
      if (h) { el._mounted = true; sceneHandles.push(h); }
    }
  }

  // ---------- the flight: reflect the docked stop into the HUD + dossier ----------
  function onDock(i, stat) {
    var st = $('traj-stat'); if (st) st.textContent = stat || '—';
    var sec = $('traj-sector'); if (sec) sec.textContent = ('0' + (i + 1)).slice(-2) + ' / 0' + SYS.length;
    var loc = $('traj-loc'), sys = SYS[i]; if (loc && sys) loc.textContent = sys.label.toUpperCase();
    var info = document.querySelector('#traj-data .sys-info[data-i="' + i + '"]'), dos = $('traj-dossier');
    if (info && dos) dos.innerHTML = info.innerHTML;
    var dots = document.querySelectorAll('#traj-progress [data-i]');
    for (var j = 0; j < dots.length; j++) { var dj = +dots[j].getAttribute('data-i'); dots[j].className = (dj === i ? 'on' : (dj < i ? 'done' : '')); }
    if (i > 0) { var pr = $('traj-prompt'); if (pr) pr.classList.add('hide'); }
  }
  function wireFlight() {
    function hold(id, d) {
      var b = $(id); if (!b) return;
      var on = function (e) { e.preventDefault(); if (flight) flight.thrust(d); };
      var off = function () { if (flight) flight.thrust(0); };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off);
      b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
    }
    hold('traj-warp', 1); hold('traj-back', -1);
    var dots = document.querySelectorAll('#traj-progress [data-i]');
    for (var i = 0; i < dots.length; i++) (function (el) { el.addEventListener('click', function () { if (flight) flight.warpTo(+el.getAttribute('data-i')); }); })(dots[i]);
  }

  // ---------- results: count-up + decorative sparklines ----------
  function sparkFor(idx, rising) {
    var bars = '▁▂▃▄▅▆▇█', n = 16, out = '', v = 0.25;
    var s = 17 + idx * 31;
    function r() { s = (s * 9301 + 49297) % 233280; return s / 233280; }
    for (var i = 0; i < n; i++) {
      v += (rising ? 0.045 : 0.02) + (r() - 0.46) * 0.22;
      v = Math.max(0.05, Math.min(1, v));
      var ch = bars.charAt(Math.min(7, Math.floor(v * 8)));
      out += (i >= n - 3) ? '<span class="hi">' + ch + '</span>' : ch;
    }
    return out;
  }
  function renderSparks() {
    var cards = document.querySelectorAll('.pnl-card');
    for (var i = 0; i < cards.length; i++) {
      var sp = cards[i].querySelector('.pnl-spark'); if (sp) sp.innerHTML = sparkFor(i, true);
      var num = cards[i].querySelector('.pnl-num'); if (num && cards[i].getAttribute('data-up')) num.classList.add('up');
      cards[i].style.animationDelay = cards[i].style.getPropertyValue('--d') || '0ms';
    }
  }
  function fmtCard(card, v) {
    var dec = +card.getAttribute('data-dec') || 0;
    return (card.getAttribute('data-prefix') || '') + (dec ? v.toFixed(dec) : String(Math.round(v))) + (card.getAttribute('data-suffix') || '');
  }
  function runCounts() {
    var cards = document.querySelectorAll('#pnl-grid .pnl-card');
    if (countRaf) { cancelAnimationFrame(countRaf); countRaf = 0; }
    var to = [], i;
    for (i = 0; i < cards.length; i++) to.push(+cards[i].getAttribute('data-to') || 0);
    if (reduce()) { for (i = 0; i < cards.length; i++) cards[i].querySelector('.pnl-num').textContent = fmtCard(cards[i], to[i]); return; }
    var t0 = performance.now(), DUR = 1100;
    function tick(now) {
      var done = true;
      for (var k = 0; k < cards.length; k++) {
        var delay = k * 70, p = Math.max(0, Math.min(1, (now - t0 - delay) / DUR));
        var e = 1 - Math.pow(1 - p, 3);
        cards[k].querySelector('.pnl-num').textContent = fmtCard(cards[k], to[k] * e);
        if (p < 1) done = false;
      }
      if (!done) countRaf = requestAnimationFrame(tick); else countRaf = 0;
    }
    countRaf = requestAnimationFrame(tick);
  }
  function renderStatBars() {
    var bars = document.querySelectorAll('.stat-bar[data-lv]');
    for (var i = 0; i < bars.length; i++) {
      var lv = Math.max(0, Math.min(10, +bars[i].getAttribute('data-lv') || 0)), on = '', off = '';
      for (var k = 0; k < lv; k++) on += '▮';
      for (k = lv; k < 10; k++) off += '▮';
      bars[i].innerHTML = on + '<span class="off">' + off + '</span>';
    }
  }

  // ---------- galaxy (liquidity map) ----------
  // each pair lives at a real point on the disk [radius, angle, height] and orbits WITH the map when you drag it
  var GAL_ANCHORS = {
    track:   [0.42, 0.35, 0],
    results: [0.72, 1.90, 0],
    skills:  [0.55, 3.50, 0],
    contact: [0.78, 5.00, 0]
  };
  var galNodes = null, galHint = null, galHintGone = false;
  function initGalaxyNodes() {
    galNodes = [];
    var btns = document.querySelectorAll('#galaxy-wrap .galaxy-node');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i], a = GAL_ANCHORS[b.getAttribute('data-go')];
      if (!a) continue;
      galNodes.push({ el: b, x: a[0] * Math.cos(a[1]), y: a[0] * Math.sin(a[1]), z: a[2] });
      b.style.willChange = 'transform,opacity';
    }
    galHint = $('galaxy-hint');
  }
  function positionGalaxyNodes(project) {
    if (!galNodes || COARSE) return;
    for (var i = 0; i < galNodes.length; i++) {
      var n = galNodes[i], p = project(n.x, n.y, n.z);
      var t = (p.depth + 0.7) / 1.4; t = t < 0 ? 0 : (t > 1 ? 1 : t);
      var edge = (p.face - 0.10) / 0.26; edge = edge < 0 ? 0 : (edge > 1 ? 1 : edge);
      var s = n.el.style;
      s.left = (p.x * 100).toFixed(2) + '%';
      s.top = (p.y * 100).toFixed(2) + '%';
      s.transform = 'translate(-50%,-50%) scale(' + (0.86 + 0.20 * t).toFixed(3) + ')';
      s.opacity = ((0.55 + 0.45 * t) * edge).toFixed(3);
      s.pointerEvents = edge < 0.15 ? 'none' : 'auto';
      s.zIndex = (100 + (p.depth * 80 | 0));
    }
  }
  function hideGalaxyHint() { if (galHintGone) return; galHintGone = true; if (galHint) galHint.style.opacity = '0'; }
  function mountGalaxy() {
    if (!E.galaxy) return;
    whenGalaxy(function () {
      gx = window.Galaxy.mount(E.galaxy, { secondsPerRotation: 120, background: '#06080C', onFrame: positionGalaxyNodes, onInteract: hideGalaxyHint });
      applyScroll();
    });
  }

  // ---------- wormhole (ticker rain) ----------
  function initWormhole() {
    var c = E.worm; if (!c) return;
    var ctx = c.getContext('2d', { alpha: false });
    var CHARS = "▲▼+-$%0123456789<>=.";
    var COLS = ['#2d5a52', '#2EE6A6', '#FF5C7A', '#FFBE5A'];
    var W, H, dpr, pts, cx, cy;
    function build() {
      var box = c.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(box.width || window.innerWidth)); H = Math.max(1, Math.round(box.height || window.innerHeight));
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      cx = W / 2; cy = H / 2;
      var N = Math.round(Math.min(640, W * H / 2050)); pts = [];
      for (var i = 0; i < N; i++) pts.push({ a: Math.random() * Math.PI * 2, z: Math.random(), sp: 0.45 + Math.random() * 1.2, ch: CHARS[(Math.random() * CHARS.length) | 0], col: (Math.random() * 4) | 0, ar: 0.62 + Math.random() * 0.48 });
    }
    build();
    var raf = 0, last = 0;
    function draw(now) {
      if (wormDestroyed) return;
      var dt = (now - last) / 1000; last = now; if (!(dt > 0) || dt > 0.05) dt = 0.016;
      if (!wormActive) { raf = requestAnimationFrame(draw); return; }
      ctx.fillStyle = '#06080C'; ctx.fillRect(0, 0, W, H);
      var warp = wormWarp || 1, baseR = Math.min(W, H) * 0.058;
      for (var k = 0; k < pts.length; k++) {
        var p = pts[k];
        p.z -= p.sp * dt * 0.42 * warp; if (p.z <= 0.02) { p.z = 1; p.a = Math.random() * Math.PI * 2; p.ch = CHARS[(Math.random() * CHARS.length) | 0]; p.col = (Math.random() * 4) | 0; }
        var inv = 1 / p.z, r = (inv - 1) * baseR;
        var x = cx + Math.cos(p.a) * r, y = cy + Math.sin(p.a) * r * p.ar;
        if (x < -30 || x > W + 30 || y < -30 || y > H + 30) continue;
        var b = Math.min(1, (1 - p.z) * 1.95); if (b < 0.05) continue;
        ctx.globalAlpha = b; ctx.font = Math.min(56, 6 + inv * 3.2).toFixed(0) + 'px ui-monospace, Menlo, monospace'; ctx.fillStyle = COLS[p.col];
        ctx.fillText(p.ch, x, y);
      }
      ctx.globalAlpha = 1; raf = requestAnimationFrame(draw);
    }
    last = performance.now(); raf = requestAnimationFrame(draw);
    if ('ResizeObserver' in window) { var ro = new ResizeObserver(function () { build(); }); ro.observe(c); }
    wormBuild = build;
  }

  // ---------- scroll cinematic ----------
  function applyScroll() {
    if (!E.stage) return;
    var max = Math.max(1, (document.documentElement.scrollHeight - window.innerHeight));
    var P = Math.min(1, Math.max(0, (window.scrollY || window.pageYOffset || 0) / max));
    var cl = function (x) { return x < 0 ? 0 : (x > 1 ? 1 : x); };
    var eIn = cl(P / 0.28), dx = (1 - eIn) * 27, baseScale = 0.82 + eIn * 0.42;
    var eThru = cl((P - 0.28) / 0.18), thru = 1 + eThru * eThru * 11, sc = baseScale * thru;
    var eOp = 1 - cl((P - 0.40) / 0.10);
    if (E.earthWrap) { E.earthWrap.style.transform = 'translate(calc(-50% + ' + dx.toFixed(2) + 'vw), -50%) scale(' + sc.toFixed(3) + ')'; E.earthWrap.style.opacity = Math.max(0, eOp).toFixed(3); }
    if (E.tagEl) { var full = E.tagEl.getAttribute('data-full') || ''; var keep = Math.round(full.length * (1 - cl(P / 0.14))); E.tagEl.textContent = keep >= full.length ? full : full.slice(0, Math.max(0, keep)); }
    if (E.heroText) { E.heroText.style.opacity = (1 - cl(P / 0.18)).toFixed(3); E.heroText.style.pointerEvents = P > 0.04 ? 'none' : 'auto'; }
    var wOp = cl((P - 0.40) / 0.10) * (1 - cl((P - 0.72) / 0.08));
    if (E.worm) E.worm.style.opacity = wOp.toFixed(3);
    wormActive = wOp > 0.02; wormWarp = 0.6 + 1.7 * cl((P - 0.40) / 0.30);
    if (E.faceWrap) {
      var fIn = cl((P - 0.42) / 0.07), fOut = cl((P - 0.50) / 0.10);
      E.faceWrap.style.opacity = Math.max(0, Math.min(fIn, 1 - fOut)).toFixed(3);
      E.faceWrap.style.transform = 'scale(' + (0.92 + 0.40 * fIn + 3.6 * fOut).toFixed(3) + ')';
    }
    var gOp = cl((P - 0.70) / 0.18);
    if (E.galaxyWrap) { E.galaxyWrap.style.opacity = gOp.toFixed(3); E.galaxyWrap.style.transform = 'scale(' + (1.22 - gOp * 0.22).toFixed(3) + ')'; E.galaxyWrap.style.pointerEvents = gOp > 0.85 ? 'auto' : 'none'; E.galaxyWrap.inert = gOp <= 0.85; }
    if (gx) { gx.setActive(gOp > 0.04); gx.setSpotlight(gOp > 0.82); }
  }
  function onScroll() { if (scrollQ) return; scrollQ = true; requestAnimationFrame(function () { scrollQ = false; applyScroll(); }); }
  function onMouse(e) { if (gx) gx.setPointer(e.clientX, e.clientY); }

  // ---------- starfield ----------
  function initStarfield() {
    var c = E.sf; if (!c) return;
    var ctx = c.getContext('2d'); var W, H, dpr, stars;
    function make() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      c.style.width = W + 'px'; c.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(Math.min(220, W * H / 8600)); stars = [];
      for (var i = 0; i < n; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, z: Math.random(), r: Math.random() * 1.2 + 0.25, tw: Math.random() * 6.28, sp: 0.5 + Math.random() * 1.7 });
    }
    make(); sfMake = make;
    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var a = reduce() ? (0.32 + s.z * 0.5) : (0.26 + 0.52 * (0.5 + 0.5 * Math.sin(t * 0.001 * s.sp + s.tw))) * (0.42 + s.z * 0.6);
        ctx.globalAlpha = Math.min(1, a);
        ctx.fillStyle = s.z > 0.86 ? '#cfeee2' : (s.z > 0.52 ? '#9fb8b0' : '#5f7470');
        var sz = s.r * (s.z > 0.86 ? 1.7 : 1); ctx.fillRect(s.x, s.y, sz, sz);
      }
      ctx.globalAlpha = 1; if (!reduce()) sfRaf = requestAnimationFrame(draw);
    }
    if (reduce()) draw(0); else sfRaf = requestAnimationFrame(draw);
  }
  function onResize() { if (sfMake) sfMake(); if (wormBuild) wormBuild(); applyScroll(); }

  // ---------- clock ----------
  function startClock() {
    var p = function (n) { return String(n).padStart(2, '0'); };
    function upd() { if (!E.clock) return; var d = new Date(); E.clock.textContent = p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds()) + ' UTC'; }
    upd(); clockT = setInterval(upd, 1000);
  }

  // ---------- boot ----------
  function hideBoot() { if (E.boot) E.boot.style.display = 'none'; }
  function initBoot() {
    if (bootEnded) { hideBoot(); return; }
    var lines = ['> opening the feed…', '', '> syncing venues ............ ok', '> loading track record ...... 4 stops', '> candles ................... green', '', '> gm.'];
    var i = 0, buf = '';
    bootT = setInterval(function () {
      if (i < lines.length) { buf += lines[i] + '\n'; if (E.bootEl) E.bootEl.textContent = buf; i++; }
      else { clearInterval(bootT); bootT = 0; endBoot(900); }
    }, 215);
    var skip = function () { endBoot(0); };
    window.addEventListener('keydown', skip, { once: true });
    window.addEventListener('pointerdown', skip, { once: true });
    window.addEventListener('wheel', skip, { once: true, passive: true });
  }
  function endBoot(delay) {
    if (bootEnded) return; bootEnded = true;
    try { sessionStorage.setItem('bon_booted', '1'); } catch (e) {}
    if (bootT) { clearInterval(bootT); bootT = 0; }
    setTimeout(hideBoot, delay);
  }
  function skipBoot() { endBoot(0); }


  // ---------- toast ----------
  function toast(m) {
    if (!m) return;
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.setAttribute('role', 'status');
      toastEl.style.cssText = 'position:fixed;left:50%;bottom:72px;z-index:90;transform:translateX(-50%);background:rgba(8,11,15,0.96);border:1px solid rgba(46,230,166,0.3);color:#cfeee2;font-size:13px;padding:11px 18px;max-width:90vw;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,0.5);animation:brise .3s ease;';
    }
    toastEl.textContent = m;
    if (!toastEl.isConnected) (E.root || document.body).appendChild(toastEl);
    clearTimeout(tt); tt = setTimeout(function () { if (toastEl) toastEl.remove(); }, 3600);
  }

  // ---------- navigation / section overlay ----------
  function openSection(id) {
    if (!META[id]) return false;
    try { document.documentElement.style.overflow = 'hidden'; } catch (e) {}
    var secs = E.overlay.querySelectorAll('.section');
    for (var i = 0; i < secs.length; i++) secs[i].classList.remove('active');
    var sec = $('sec-' + id);
    if (sec) sec.classList.add('active');
    if (E.secCounter) E.secCounter.textContent = META[id].n + ' / 0' + TOTAL;
    E.overlay.classList.add('open');
    E.overlay.scrollTop = 0;
    state.section = id;
    mountSectionArt(sec);
    var hideBg = (id === 'track');   // the flight draws its own background
    if (sbg) { sbg.setVariant(id); sbg.setActive(!hideBg); }
    var bgc = $('overlay-bg-canvas'); if (bgc) bgc.style.display = hideBg ? 'none' : '';
    var obg = E.overlay && E.overlay.querySelector('.overlay-bg'); if (obg) obg.style.display = hideBg ? 'none' : '';
    if (flight) flight.setActive(id === 'track');
    if (id === 'results') runCounts();
    return true;
  }
  function closeSection() {
    try { document.documentElement.style.overflow = ''; } catch (e) {}
    if (state.section != null) {
      E.overlay.classList.remove('open');
      var a = E.overlay.querySelector('.section.active');
      if (a) a.classList.remove('active');
      state.section = null;
    }
    if (sbg) sbg.setActive(false);
    if (flight) flight.setActive(false);
    if (countRaf) { cancelAnimationFrame(countRaf); countRaf = 0; }
    applyScroll();
  }
  function goMap() { closeSection(); var max = Math.max(0, (document.documentElement.scrollHeight - window.innerHeight)); window.scrollTo({ top: max, behavior: reduce() ? 'auto' : 'smooth' }); }
  function goHero() { closeSection(); window.scrollTo({ top: 0, behavior: reduce() ? 'auto' : 'smooth' }); }

  // ---------- command console ----------
  function lineStyle(k) {
    var base = 'white-space:pre-wrap;font-size:12.5px;line-height:1.55;margin:1px 0;';
    if (k === 'in') return base + 'color:#5fa391;';
    if (k === 'sys') return base + 'color:#2EE6A6;';
    if (k === 'warn') return base + 'color:#FFBE5A;';
    return base + 'color:#aeb9c9;';
  }
  function printLine(text, kind) {
    if (!E.logEl) return;
    var d = document.createElement('div');
    d.style.cssText = lineStyle(kind); d.textContent = text;
    E.logEl.appendChild(d);
    while (E.logEl.childNodes.length > 70) E.logEl.removeChild(E.logEl.firstChild);
    requestAnimationFrame(function () { if (E.logEl) E.logEl.scrollTop = E.logEl.scrollHeight; });
  }
  function run(raw) {
    var cmd = (raw || '').trim(); if (!cmd) return;
    history_.push(cmd); printLine('guest@bon:~$ ' + cmd, 'in');
    var parts = cmd.split(/\s+/); var c = parts[0].toLowerCase(); var arg = parts.slice(1).join(' ');
    if (c === 'help' || c === '?') { printLine("COMMANDS\n  ls · map           list / open the market map\n  cd <pair>          open a pair: track, results, skills, contact\n  back · home        leave a pair / jump to the top\n  whoami · man\n  top · gm · wagmi · rekt · long · short\n  sudo hire-me       open the contact pair\n  clear              clear this log\n  (a few commands are undocumented.)", 'sys'); return; }
    if (c === 'ls' || c === 'dir') { printLine("PAIRS — type 'cd <name>'\n  track · results · skills · contact", 'sys'); return; }
    if (c === 'map') { goMap(); printLine('→ the market map', 'out'); return; }
    if (c === 'back') { closeSection(); printLine('→ back to the map', 'out'); return; }
    if (c === 'home') { goHero(); printLine('→ top of the feed', 'out'); return; }
    if (c === 'cd' || c === 'goto' || c === 'open' || c === 'go') {
      var key = (arg || '').toLowerCase().replace(/^[~/]+/, ''); var id = ROOMS[key];
      if (id === '__home') { goHero(); printLine('→ home', 'out'); }
      else if (id && openSection(id)) { printLine('→ ' + id, 'out'); }
      else printLine("no such pair: '" + arg + "'. try 'ls'.", 'warn');
      return;
    }
    if (c === 'long') { printLine('going long. opening the track record.', 'sys'); openSection('track'); return; }
    if (c === 'short') { printLine('shorting your doubts: +100% PnL. (not financial advice.)', 'out'); return; }
    if (ROOMS[c]) { if (ROOMS[c] === '__home') { goHero(); } else openSection(ROOMS[c]); printLine('→ ' + c, 'out'); return; }
    if (c === 'whoami') { printLine('Long Ha (Bon): web3 social media and community-led growth. native VI, English C1.', 'out'); return; }
    if (c === 'top' || c === 'htop') { printLine('PID  PROCESS            LOAD\n  1  reply_guy           99%\n  2  kol_dms             71%\n 12  tabs_open           ●●●●●●●●●●●●\n  0  sleep               ERR: not found', 'out'); return; }
    if (c === 'gm') { printLine("gm. it's always morning somewhere on CT.", 'sys'); return; }
    if (c === 'wagmi') { printLine('we are. (past performance not guaranteed.)', 'out'); return; }
    if (c === 'rekt') { printLine("position liquidated. just kidding. you're on cross margin.", 'warn'); return; }
    if (c === 'ngmi') { printLine('not on my timeline.', 'out'); return; }
    if (c === 'sudo') {
      if (/hire-?me/.test(arg)) { printLine('[sudo] no password needed. opening the order ticket.', 'sys'); setTimeout(function () { openSection('contact'); }, 350); }
      else printLine('permission denied. (try: sudo hire-me)', 'out');
      return;
    }
    if (c === 'man') { printLine("NAME\n  bon: web3 social media and community-led growth.\nSYNOPSIS\n  bon [--reply-led] [--kol] [--async]\nBUGS\n  replies faster than is socially acceptable.", 'out'); return; }
    if (c === 'theme') { printLine('one theme here: the night market.', 'out'); return; }
    if (c === 'exit' || c === 'quit') { printLine('no exit. the feed never closes.', 'out'); return; }
    if (c === 'clear' || c === 'cls') { E.logEl.innerHTML = ''; return; }
    printLine("command not found: '" + parts[0] + "'. try 'help'.", 'warn');
  }
  function onInputKey(e) {
    if (e.key === 'Enter') { var v = e.target.value; e.target.value = ''; hi_ = -1; run(v); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (history_.length) { hi_ = Math.min(history_.length - 1, hi_ + 1); e.target.value = history_[history_.length - 1 - hi_] || ''; } }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (hi_ > 0) { hi_--; e.target.value = history_[history_.length - 1 - hi_] || ''; } else { hi_ = -1; e.target.value = ''; } }
  }
  function runHelp() { run('help'); if (E.input) E.input.focus(); }

  // ---------- konami: green candle ----------
  function initKonami() {
    var seq = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
    var i = 0;
    window.addEventListener('keydown', function (e) {
      var k = (e.key || '').toLowerCase();
      if (k === seq[i]) { i++; if (i === seq.length) { i = 0; greenCandle(); } }
      else { i = (k === seq[0]) ? 1 : 0; }
    });
  }
  function greenCandle() {
    if (reduce()) { toast('GREEN CANDLE. (reduced motion: imagine the confetti)'); return; }
    var chars = ['▲', '▲', '$', '◆', '+', '%', '★', '▮'];
    var cols = ['#2EE6A6', '#FFBE5A', '#9fe8cc', '#2EE6A6'];
    var wrap = document.createElement('div');
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:95;pointer-events:none;overflow:hidden;';
    for (var i = 0; i < 32; i++) {
      var left = Math.random() * 100, dur = 2.4 + Math.random() * 2.7, delay = Math.random() * 1.3, size = 12 + Math.random() * 22;
      var s = document.createElement('span');
      s.textContent = chars[(Math.random() * chars.length) | 0];
      s.style.cssText = 'position:absolute;top:-12vh;left:' + left.toFixed(2) + '%;font-size:' + size.toFixed(0) + 'px;color:' + cols[(Math.random() * cols.length) | 0] + ';animation:bconfetti ' + dur.toFixed(2) + 's linear ' + delay.toFixed(2) + 's forwards;text-shadow:0 0 12px currentColor;';
      wrap.appendChild(s);
    }
    var big = document.createElement('div');
    big.style.cssText = 'position:absolute;top:42%;left:50%;transform:translate(-50%,-50%);text-align:center;';
    big.innerHTML = '<div style="font-family:\'Space Mono\',monospace;font-size:clamp(36px,8vw,88px);font-weight:700;color:#2EE6A6;text-shadow:0 0 30px rgba(46,230,166,0.6);">GREEN CANDLE</div><div style="font-family:\'Space Mono\',monospace;font-size:12px;letter-spacing:.4em;color:#FFBE5A;text-transform:uppercase;margin-top:6px;">all timeframes</div>';
    wrap.appendChild(big);
    (E.root || document.body).appendChild(wrap);
    toast('GREEN CANDLE · all timeframes');
    clearTimeout(gt); gt = setTimeout(function () { wrap.remove(); }, 5400);
  }

  // ---------- global keys ----------
  function initGlobalKeys() {
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.section != null) { closeSection(); }
      else if (e.key === '/' && document.activeElement !== E.input) { e.preventDefault(); if (E.input) E.input.focus(); }
    });
  }

  // ---------- event wiring ----------
  function bindInput() { if (E.input) E.input.addEventListener('keydown', onInputKey); }
  function bindClicks() {
    document.addEventListener('click', function (e) {
      var go = e.target.closest('[data-go]');
      if (go) { openSection(go.getAttribute('data-go')); return; }
      var act = e.target.closest('[data-act]');
      if (act) {
        var a = act.getAttribute('data-act');
        if (a === 'map') goMap();
        else if (a === 'home') goHero();
        else if (a === 'help') runHelp();
        else if (a === 'back-close') closeSection();
        else if (a === 'skip-boot') skipBoot();
      }
    });
  }

  // ---------- init ----------
  function init() {
    cacheEls();
    var booted = false; try { booted = !!sessionStorage.getItem('bon_booted'); } catch (e) {}
    if (reduce() || booted) { bootEnded = true; hideBoot(); }
    renderStatBars();
    renderSparks();
    whenEngine(mountHero);
    initStarfield();
    initWormhole();
    initGalaxyNodes();
    mountGalaxy();
    if (window.SpaceBG) { var bgc = $('overlay-bg-canvas'); if (bgc) sbg = window.SpaceBG.mount(bgc, { variant: 'track' }); }
    startClock();
    initKonami();
    initGlobalKeys();
    bindInput();
    bindClicks();
    initBoot();
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mousemove', onMouse, { passive: true });
    applyScroll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
