(() => {
  'use strict';

  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- zaglavlje ---------- */
  const header = document.querySelector('[data-header]');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- mobilni izbornik ---------- */
  const menuBtn = document.querySelector('.menu-btn');
  const nav = document.getElementById('site-nav');
  if (menuBtn && nav) {
    const menuBoard = nav.querySelector('canvas[data-board="menu"]');
    const setNav = (open) => {
      menuBtn.setAttribute('aria-expanded', String(open));
      root.classList.toggle('nav-open', open);
      if (open && menuBoard) menuBoard.dispatchEvent(new Event('board:play'));
    };
    menuBtn.addEventListener('click', () => setNav(menuBtn.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) setNav(false); });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && root.classList.contains('nav-open')) { setNav(false); menuBtn.focus(); }
    });
    window.matchMedia('(min-width: 1141px)').addEventListener('change', (e) => { if (e.matches) setNav(false); });
  }

  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

  /* ---------- radno vrijeme uživo (Zagreb, pon–pet 8–16, bez državnih praznika) ---------- */
  const DAYS_ACC = ['nedjelju', 'ponedjeljak', 'utorak', 'srijedu', 'četvrtak', 'petak', 'subotu'];
  const DAYS_SHORT = ['ned.', 'pon.', 'uto.', 'sri.', 'čet.', 'pet.', 'sub.'];
  const FIXED_HOLIDAYS = ['01-01', '01-06', '05-01', '05-30', '06-22', '08-05', '08-15', '11-01', '11-18', '12-25', '12-26'];
  function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return Date.UTC(y, month - 1, day);
  }
  const pad = (n) => String(n).padStart(2, '0');
  function isWorkday(utcDay) {
    const d = new Date(utcDay);
    const wd = d.getUTCDay();
    if (wd === 0 || wd === 6) return false;
    if (FIXED_HOLIDAYS.includes(`${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`)) return false;
    const e = easter(d.getUTCFullYear());
    const DAY = 864e5;
    return utcDay !== e + DAY && utcDay !== e + 60 * DAY; // Uskrsni ponedjeljak, Tijelovo
  }
  function zagrebNow() {
    const parts = {};
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Zagreb', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
    }).formatToParts(new Date()).forEach((p) => { parts[p.type] = Number(p.value); });
    return { day: Date.UTC(parts.year, parts.month - 1, parts.day), min: parts.hour * 60 + parts.minute };
  }
  function openStatus() {
    const { day, min } = zagrebNow();
    const DAY = 864e5;
    // short: kraća inačica za zaglavlje, uvijek uža od mjesta koje joj CSS rezervira
    if (isWorkday(day) && min >= 480 && min < 960) return { open: true, text: 'Otvoreno do 16 h', short: 'Otvoreno do 16 h' };
    if (isWorkday(day) && min < 480) return { open: false, text: 'Otvaramo danas u 8 h', short: 'Otvaramo u 8 h' };
    let next = day + DAY;
    while (!isWorkday(next)) next += DAY;
    if (next === day + DAY) return { open: false, text: 'Otvaramo sutra u 8 h', short: 'Otvaramo sutra u 8 h' };
    const wd = new Date(next).getUTCDay();
    return { open: false, text: `Otvaramo u ${DAYS_ACC[wd]} u 8 h`, short: `Otvaramo ${DAYS_SHORT[wd]} u 8 h` };
  }
  const statusEls = document.querySelectorAll('[data-open-status]');
  if (statusEls.length) {
    const update = () => {
      let s;
      try { s = openStatus(); } catch { return; }
      statusEls.forEach((el) => {
        el.textContent = el.dataset.openStatus === 'short' ? s.short : s.text;
        el.dataset.state = s.open ? 'open' : 'closed';
      });
    };
    update();
    setInterval(update, 60000);
  }

  /* ---------- svjetlosni indikator u izborniku ----------
     Linija svjetla klizi do stavke pod mišem, savije se i zatim izravna, kao lim nakon popravka. */
  const glow = header && header.querySelector('.nav-glow');
  const navList = nav && nav.querySelector('.nav-list');
  if (glow && navList) {
    const path = glow.querySelector('path');
    const links = [...navList.querySelectorAll(':scope > li > .nav-link')];
    const current = links.find((a) => a.matches('[aria-current="page"]') || a.parentElement.querySelector('[aria-current="page"]'));
    const desktop = window.matchMedia('(min-width: 1141px)');
    let shown = null;
    let bend = 0;
    let bendRaf = 0;
    let bendStart = 0;
    let bendFrom = 0;
    const setPath = (k) => path.setAttribute('d', `M0 6 Q50 ${6 + k} 100 6`);
    const settle = (now) => {
      if (!bendStart) bendStart = now;
      const u = Math.min(1, (now - bendStart) / 650);
      bend = bendFrom * Math.exp(-3 * u) * Math.cos(9 * u) * (1 - u);
      setPath(bend);
      bendRaf = u < 1 ? requestAnimationFrame(settle) : 0;
    };
    const moveTo = (link) => {
      if (!desktop.matches) return;
      if (!link) { glow.classList.remove('is-on'); shown = null; return; }
      const hr = header.getBoundingClientRect();
      const lr = link.getBoundingClientRect();
      const inset = 10;
      const from = shown ? shown.getBoundingClientRect().left : null;
      glow.style.left = `${lr.left - hr.left + inset}px`;
      glow.style.width = `${lr.width - inset * 2}px`;
      glow.classList.add('is-on');
      if (shown && shown !== link && !reduceMotion) {
        bendFrom = lr.left > from ? 5 : -5;
        bendStart = 0;
        cancelAnimationFrame(bendRaf);
        bendRaf = requestAnimationFrame(settle);
      }
      shown = link;
    };
    links.forEach((a) => {
      a.addEventListener('pointerenter', () => moveTo(a));
      a.addEventListener('focus', () => moveTo(a));
    });
    navList.addEventListener('pointerleave', () => moveTo(current));
    navList.addEventListener('focusout', (e) => { if (!navList.contains(e.relatedTarget)) moveTo(current); });
    const place = () => {
      glow.style.transition = 'none';
      moveTo(shown || current);
      glow.getBoundingClientRect();
      glow.style.transition = '';
    };
    window.addEventListener('resize', place);
    desktop.addEventListener('change', place);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
    place();
  }

  /* ---------- PDR svjetlosna ploča ----------
     Linije svjetla reflektirane na laku. Ploča se upali (cijevi zatrepere), linije se savijaju oko
     udubljenja, a zatim se udubljenja jedno po jedno izravnaju, s malim "iskakanjem" lima. Na kraju
     preko ravne površine prijeđe odsjaj. Mišem se lim može lagano utisnuti, a dodirom na mobitelu
     nastane udubljenje koje se odmah popravi. */
  function seeded(seed) {
    let s = seed;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }
  function hail(n, seed) {
    const r = seeded(seed);
    return Array.from({ length: n }, () => ({
      x: 0.5 + r() * 0.47, y: 0.08 + r() * 0.84, a: (r() < 0.5 ? -1 : 1) * (14 + r() * 10),
      sx: 0.013 + r() * 0.010, sy: 0.06 + r() * 0.04,
    }));
  }
  const DENTS = {
    naslovna: [
      { x: 0.58, y: 0.26, a: 30, sx: 0.050, sy: 0.095 },
      { x: 0.73, y: 0.47, a: -26, sx: 0.065, sy: 0.105 },
      { x: 0.87, y: 0.24, a: 22, sx: 0.045, sy: 0.080 },
      { x: 0.64, y: 0.71, a: 26, sx: 0.060, sy: 0.090 },
      { x: 0.93, y: 0.60, a: -20, sx: 0.050, sy: 0.100 },
      { x: 0.50, y: 0.52, a: 16, sx: 0.045, sy: 0.085 },
      { x: 0.80, y: 0.83, a: -18, sx: 0.055, sy: 0.070 },
    ],
    // tuča: puno sitnih okruglih udubljenja
    tuca: hail(16, 20240611),
    // udarac vratima: jedno usko, okomito udubljenje i jedno manje
    parking: [
      { x: 0.78, y: 0.52, a: 30, sx: 0.011, sy: 0.30 },
      { x: 0.64, y: 0.32, a: -16, sx: 0.022, sy: 0.12 },
    ],
    kasko: [
      { x: 0.62, y: 0.38, a: 26, sx: 0.040, sy: 0.16 },
      { x: 0.80, y: 0.62, a: -28, sx: 0.050, sy: 0.18 },
      { x: 0.93, y: 0.30, a: 20, sx: 0.030, sy: 0.12 },
    ],
    usluge: [
      { x: 0.58, y: 0.55, a: 22, sx: 0.035, sy: 0.15 },
      { x: 0.70, y: 0.30, a: -20, sx: 0.020, sy: 0.10 },
      { x: 0.82, y: 0.58, a: 30, sx: 0.012, sy: 0.28 },
      { x: 0.93, y: 0.36, a: -24, sx: 0.045, sy: 0.16 },
    ],
    galerija: [
      { x: 0.56, y: 0.40, a: 22, sx: 0.030, sy: 0.14 },
      { x: 0.66, y: 0.70, a: -18, sx: 0.020, sy: 0.10 },
      { x: 0.76, y: 0.34, a: 28, sx: 0.045, sy: 0.17 },
      { x: 0.86, y: 0.66, a: -24, sx: 0.030, sy: 0.14 },
      { x: 0.95, y: 0.40, a: 18, sx: 0.020, sy: 0.12 },
    ],
    'o-nama': [
      { x: 0.70, y: 0.45, a: 26, sx: 0.050, sy: 0.18 },
      { x: 0.88, y: 0.60, a: -22, sx: 0.035, sy: 0.15 },
    ],
    akademija: [
      { x: 0.62, y: 0.55, a: 20, sx: 0.025, sy: 0.12 },
      { x: 0.76, y: 0.38, a: -24, sx: 0.040, sy: 0.16 },
      { x: 0.90, y: 0.60, a: 28, sx: 0.050, sy: 0.18 },
    ],
    kontakt: [{ x: 0.80, y: 0.50, a: 30, sx: 0.050, sy: 0.20 }],
    rezervacija: [{ x: 0.82, y: 0.50, a: 24, sx: 0.040, sy: 0.22 }],
    cta: [{ x: 0.80, y: 0.48, a: 30, sx: 0.050, sy: 0.18 }],
  };

  // vrste ploča: broj linija [široko, usko], debljina [od, do] za široko i usko, područje linija.
  // Pozadinu (tamni lak i plavkasti sjaj) crta CSS na roditelju, pa izgleda isto i prije nego se skripta pokrene;
  // canvas crta samo linije. fade: linije su lijevo prigušene jer je tamo tekst.
  const BOARDS = {
    hero: {
      lines: [9, 9], th: [[3, 17], [4, 12]], start: 'view', threshold: 0, parallax: true, interactive: true, fade: true,
      zone: (W, H, narrow) => (narrow ? [H * 0.05, H * 0.55] : [H * 0.06, H * 0.9]),
    },
    page: {
      lines: [7, 6], th: [[2.2, 9], [1.4, 4.5]], start: 'view', threshold: 0, parallax: true, interactive: true, fade: true,
      zone: (W, H, narrow) => (narrow ? [12, Math.min(H * 0.42, 150)] : [H * 0.08, H * 0.84]),
    },
    band: {
      lines: [6, 6], th: [[2.5, 10], [2, 7]], start: 'view', threshold: 0.35, interactive: true, fade: true,
      zone: (W, H) => [H * 0.08, H * 0.86],
    },
    strip: {
      lines: [4, 4], th: [[1.2, 3.5], [1.2, 3.5]], start: 'none', interactive: true,
      zone: (W, H) => [H * 0.22, H * 0.74],
    },
    // samo izbornik se pali s treptanjem cijevi, jer se otvara na dodir i tu ne kasni ništa
    menu: {
      lines: [7, 7], th: [[2, 8], [2, 8]], start: 'event', ignite: true,
      zone: (W, H) => [H * 0.1, H * 0.82],
    },
  };

  const STEP = 55;        // razmak paljenja susjednih linija (izbornik)
  const FLICK = 180;      // treptanje cijevi (izbornik)
  const RAMP = 320;       // do pune svjetline (izbornik)
  const HOLD = 350;       // koliko se udubljenja vide prije popravka
  const REPAIR = 900;     // trajanje popravka jednog udubljenja
  const GLEAM = 1200;     // odsjaj preko ravne površine
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  // lim se vrati, malo "iskoči" preko ravnine i smiri se
  const spring = (u) => Math.exp(-2.6 * u) * Math.cos(4.5 * u) * (1 - u * u * u);

  let scrollY = window.scrollY;
  const scrollers = new Set();
  window.addEventListener('scroll', () => {
    scrollY = window.scrollY;
    scrollers.forEach((fn) => fn());
  }, { passive: true });

  function initBoard(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cfg = BOARDS[canvas.dataset.board] || BOARDS.page;
    const dents = (DENTS[canvas.dataset.dents] || []).slice().sort((p, q) => p.x - q.x);
    const nMax = Math.max(...cfg.lines);
    const introEnd = cfg.ignite ? (nMax - 1) * STEP + FLICK + RAMP : 0;
    const repairAt = introEnd + HOLD;
    const stagger = dents.length > 1 ? Math.min(220, 1300 / (dents.length - 1)) : 0;
    const gleamAt = dents.length ? repairAt + (dents.length - 1) * stagger + REPAIR * 0.7 : Math.max(0, introEnd - 150);
    const endAt = gleamAt + GLEAM;

    let W = 0;
    let H = 0;
    let raf = 0;
    let visible = false;
    // faza: 'ready' (svjetlo upaljeno, udubljenja se vide, čeka da ploča bude vidljiva),
    // 'run' (popravak), 'done' (ravne linije)
    let phase = reduceMotion || !dents.length || cfg.start === 'none' || cfg.start === 'event' ? 'done' : 'ready';
    let t0 = 0;
    const ptr = { x: 0, y: 0, tx: 0, ty: 0, a: 0, ta: 0, seen: false };
    const view = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    const taps = [];

    function lineLum(i, el) {
      if (phase !== 'run' || !cfg.ignite) return 1;
      let tau = el - i * STEP;
      if (tau <= 0) return 0;
      if (i % 3 === 1) {
        if (tau < 50) return 0.55;
        if (tau < 95) return 0.08;
        if (tau < 140) return 0.7;
        if (tau < FLICK) return 0.15;
      }
      tau -= FLICK;
      return tau <= 0 ? 0 : Math.min(1, tau / RAMP);
    }
    function dentAmp(j, el) {
      if (phase === 'done') return 0;
      if (phase === 'ready') return 1;
      const u = (el - repairAt - j * stagger) / REPAIR;
      if (u <= 0) return 1;
      return u >= 1 ? 0 : spring(u);
    }

    function draw(now) {
      if (!W || !H) return;
      const narrow = W < 760;
      const el = phase === 'run' ? now - t0 : 0;
      const [zTop, zBottom] = cfg.zone(W, H, narrow);
      const zSpan = zBottom - zTop;
      const s = Math.min(1, zSpan / 520);
      const n = cfg.lines[narrow ? 1 : 0];
      const [thin, thick] = cfg.th[narrow ? 1 : 0];
      const thScale = canvas.dataset.board === 'hero' && !narrow ? Math.max(0.35, Math.min(1.2, H / 800)) : 1;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, W, H);

      const warm = (a) => `rgba(255, 243, 220, ${a})`;
      const cool = (a) => `rgba(160, 192, 255, ${a})`;
      const ramp = (fn) => {
        const g = ctx.createLinearGradient(0, 0, W, 0);
        if (narrow || !cfg.fade) {
          g.addColorStop(0, fn(0.45)); g.addColorStop(0.5, fn(0.95)); g.addColorStop(1, fn(0.6));
        } else {
          g.addColorStop(0, fn(0)); g.addColorStop(0.26, fn(0.1)); g.addColorStop(0.55, fn(0.95));
          g.addColorStop(0.86, fn(1)); g.addColorStop(1, fn(0.7));
        }
        return g;
      };
      const light = ramp(warm);
      const halo = ramp(cool);
      const core = ramp((a) => `rgba(255, 255, 255, ${a})`);

      let gleam = null;
      if (phase === 'run' && el > gleamAt && el < endAt) {
        const p = easeInOut((el - gleamAt) / GLEAM);
        const gx = -0.2 * W + p * 1.4 * W;
        const hw = Math.max(60, W * 0.08);
        gleam = ctx.createLinearGradient(gx - hw, 0, gx + hw, hw * 0.7);
        gleam.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gleam.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
        gleam.addColorStop(1, 'rgba(255, 255, 255, 0)');
      }

      // položaji udubljenja u pikselima
      const base = Math.max(W, 720);
      const active = [];
      dents.forEach((k, j) => {
        const amp = dentAmp(j, el);
        if (Math.abs(amp) < 0.002) return;
        active.push({
          X: (narrow ? 0.08 + (k.x - 0.5) * 2 : k.x) * W,
          Y: zTop + k.y * zSpan,
          rx: k.sx * base,
          ry: k.sy * zSpan,
          a: k.a * s * amp,
        });
      });
      for (let i = taps.length - 1; i >= 0; i--) {
        const tp = taps[i];
        const age = now - tp.t;
        if (age > 1200) { taps.splice(i, 1); continue; }
        // utisne se, kratko zadrži i vrati natrag
        const amp = age < 160 ? easeInOut(age / 160) : age < 300 ? 1 : spring((age - 300) / 900);
        active.push({ X: tp.x, Y: tp.y, rx: 34, ry: 40, a: 22 * Math.max(0.6, s) * amp });
      }
      if (ptr.a > 0.05) active.push({ X: ptr.x, Y: ptr.y, rx: 70 * Math.max(0.6, s), ry: 78 * Math.max(0.6, s), a: ptr.a * Math.max(0.6, s) });

      const parallax = cfg.parallax && !reduceMotion ? Math.min(scrollY, H) * 0.16 : 0;
      const tiltY = (view.y - 0.5) * -18 * s;
      const tiltX = (view.x - 0.5) * 22 * s;
      const step = narrow ? 5 : 7;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 0; i < n; i++) {
        const lum = lineLum(i, el);
        if (lum < 0.01) continue;
        const t = (i + 0.5) / n;
        const y0 = zTop + zSpan * Math.pow(t, 1.3) + parallax + tiltY;
        const th = (thin + t * (thick - thin)) * thScale;
        // blagi luk: refleksija na zakrivljenoj haubi, jači prema dnu; pomiče se s kutom gledanja
        const bow = zSpan * 0.055 * t;
        const bowX = (narrow ? 0.5 : 0.68) + (view.x - 0.5) * 0.16;
        const path = new Path2D();
        for (let x = -24; x <= W + 24; x += step) {
          const u = x / W - bowX;
          let y = y0 + bow * u * u * 2 + (x / W - 0.5) * tiltX;
          for (const d of active) {
            const dx = (x - d.X) / d.rx;
            const dy = (y0 - d.Y) / d.ry;
            const q = dx * dx + dy * dy;
            if (q < 14) y += d.a * Math.exp(-0.5 * q) * (0.55 + 1.1 * dy);
          }
          if (x === -24) path.moveTo(x, y); else path.lineTo(x, y);
        }
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = halo; ctx.globalAlpha = 0.05 * lum; ctx.lineWidth = th * 6; ctx.stroke(path);
        ctx.strokeStyle = light; ctx.globalAlpha = 0.14 * lum; ctx.lineWidth = th * 2.4; ctx.stroke(path);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.9 * lum; ctx.lineWidth = th; ctx.stroke(path);
        ctx.strokeStyle = core; ctx.globalAlpha = 0.85 * lum; ctx.lineWidth = Math.max(1, th * 0.32); ctx.stroke(path);
        if (gleam) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = gleam; ctx.globalAlpha = 0.75; ctx.lineWidth = th * 1.8; ctx.stroke(path);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
      ctx.globalAlpha = 1;
    }

    function frame(now) {
      raf = 0;
      let busy = false;
      if (phase === 'run') {
        if (now - t0 >= endAt) phase = 'done';
        else busy = true;
      }
      ptr.x += (ptr.tx - ptr.x) * 0.16;
      ptr.y += (ptr.ty - ptr.y) * 0.16;
      ptr.a += (ptr.ta - ptr.a) * 0.08;
      view.x += (view.tx - view.x) * 0.06;
      view.y += (view.ty - view.y) * 0.06;
      if (Math.abs(ptr.ta - ptr.a) > 0.05 || Math.abs(ptr.tx - ptr.x) > 0.5 || Math.abs(ptr.ty - ptr.y) > 0.5) busy = true;
      if (Math.abs(view.tx - view.x) > 0.002 || Math.abs(view.ty - view.y) > 0.002) busy = true;
      if (taps.length) busy = true;
      draw(now);
      if (busy) kick();
    }
    function kick() { if (!raf && visible) raf = requestAnimationFrame(frame); }
    function play() {
      if (reduceMotion) return;
      phase = 'run';
      t0 = performance.now();
      kick();
    }

    let dpr = 1;
    function resize() {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width;
      H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      draw(performance.now());
    }

    let resizeRaf = 0;
    new ResizeObserver(() => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(resize);
    }).observe(canvas);

    const io = new IntersectionObserver((entries) => {
      const e = entries[entries.length - 1];
      visible = e.isIntersecting;
      if (phase === 'ready' && e.intersectionRatio >= (cfg.threshold || 0) && e.isIntersecting) play();
      if (visible) kick();
    }, { threshold: [0, cfg.threshold || 0, 0.6] });
    io.observe(canvas);

    if (cfg.parallax && !reduceMotion) scrollers.add(() => { if (visible && phase !== 'run') kick(); });
    // svaka ploča se može ponovno pokrenuti (izbornik to radi pri svakom otvaranju)
    canvas.addEventListener('board:play', () => { visible = true; play(); });

    if (cfg.interactive && !reduceMotion) {
      const host = canvas.parentElement;
      host.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const r = canvas.getBoundingClientRect();
        ptr.tx = e.clientX - r.left;
        ptr.ty = e.clientY - r.top;
        if (!ptr.seen) { ptr.x = ptr.tx; ptr.y = ptr.ty; ptr.seen = true; }
        ptr.ta = canvas.dataset.board === 'strip' ? 10 : 22;
        view.tx = Math.max(0, Math.min(1, ptr.tx / r.width));
        view.ty = Math.max(0, Math.min(1, ptr.ty / r.height));
        kick();
      });
      host.addEventListener('pointerleave', () => {
        ptr.ta = 0; ptr.seen = false; view.tx = 0.5; view.ty = 0.5; kick();
      });
      host.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' || e.target.closest('a, button, input, summary, label')) return;
        const r = canvas.getBoundingClientRect();
        taps.push({ x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() });
        if (taps.length > 4) taps.shift();
        kick();
      });
    }

    resize();
  }

  document.querySelectorAll('canvas[data-board]').forEach(initBoard);

  /* ---------- prije / poslije ---------- */
  function initCompare(fig) {
    const range = fig.querySelector('.ba-range');
    const set = (v) => {
      const pos = Math.max(0, Math.min(100, v));
      fig.style.setProperty('--pos', `${pos}%`);
      if (range) range.value = String(Math.round(pos));
    };
    let dragging = false;
    let touched = false;
    const fromEvent = (e) => {
      const r = fig.getBoundingClientRect();
      set(((e.clientX - r.left) / r.width) * 100);
    };
    fig.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      dragging = true;
      touched = true;
      fig.setPointerCapture(e.pointerId);
      fromEvent(e);
    });
    fig.addEventListener('pointermove', (e) => { if (dragging) fromEvent(e); });
    const end = () => { dragging = false; };
    fig.addEventListener('pointerup', end);
    fig.addEventListener('pointercancel', end);
    if (range) range.addEventListener('input', () => { touched = true; set(Number(range.value)); });
    set(range ? Number(range.value) : 50);

    // jednom pokaže da se klizač može povući: lijevo (prije), desno (poslije), natrag na sredinu
    if (fig.hasAttribute('data-ba-demo') && !reduceMotion) {
      const keys = [[0, 50], [750, 16], [1650, 84], [2400, 50]];
      const io = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        let start = 0;
        const tick = (now) => {
          if (touched) return;
          if (!start) start = now + 350;
          const t = now - start;
          if (t < 0) { requestAnimationFrame(tick); return; }
          let k = 1;
          while (k < keys.length - 1 && t > keys[k][0]) k++;
          const [ta, pa] = keys[k - 1];
          const [tb, pb] = keys[k];
          const u = Math.max(0, Math.min(1, (t - ta) / (tb - ta)));
          set(pa + (pb - pa) * easeInOut(u));
          if (t < keys[keys.length - 1][0]) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, { threshold: 0.6 });
      io.observe(fig);
    }
  }
  document.querySelectorAll('.ba').forEach(initCompare);

  /* ---------- recenzije: vodoravna traka kartica ----------
     Traka se lista sama (prst, kotačić, tipkovnica); strelice je pomaknu za jednu karticu
     i ugase se na početku i kraju. Bez automatskog listanja. */
  document.querySelectorAll('[data-reviews]').forEach((root) => {
    const track = root.querySelector('[data-reviews-track]');
    const prev = root.querySelector('[data-reviews-prev]');
    const next = root.querySelector('[data-reviews-next]');
    if (!track || !prev || !next) return;
    const cards = [...track.children];

    const step = () => (cards[1] ? cards[1].offsetLeft - cards[0].offsetLeft : track.clientWidth);
    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      prev.setAttribute('aria-disabled', String(track.scrollLeft <= 2));
      next.setAttribute('aria-disabled', String(track.scrollLeft >= max - 2));
    };
    const go = (dir) => track.scrollBy({ left: dir * step(), behavior: reduceMotion ? 'auto' : 'smooth' });

    prev.addEventListener('click', () => { if (prev.getAttribute('aria-disabled') !== 'true') go(-1); });
    next.addEventListener('click', () => { if (next.getAttribute('aria-disabled') !== 'true') go(1); });
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  });

  /* ---------- karta se učitava tek na klik ---------- */
  document.querySelectorAll('[data-map]').forEach((box) => {
    const btn = box.querySelector('[data-map-load]');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const frame = document.createElement('iframe');
      frame.src = box.dataset.map;
      frame.title = box.dataset.mapTitle || 'Karta';
      frame.loading = 'lazy';
      frame.referrerPolicy = 'no-referrer-when-downgrade';
      frame.allowFullscreen = true;
      box.replaceChildren(frame);
    });
  });
})();
