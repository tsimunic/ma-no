// Gradi statični web u dist/ iz src/layout.html, src/partials/*.html i src/pages/*.html.
// Svaka stranica počinje JSON blokom u HTML komentaru: <!-- { "title": ..., "path": "/usluge/" } -->
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'src');

// Gdje se web objavljuje.
// - production: vlastita domena, web u korijenu (https://ma-no.hr/), indeksira se.
// - demo: GitHub Pages na podadresi https://tsimunic.github.io/ma-no/, svaka stranica dobije noindex.
// site je bez "/" na kraju; base je putanja weba na domeni, s "/" na oba kraja.
export const TARGETS = {
  production: { site: 'https://ma-no.hr', base: '/', indexable: true, out: 'dist' },
  demo: { site: 'https://tsimunic.github.io/ma-no', base: '/ma-no/', indexable: false, out: 'dist-demo' },
};

const BOOKING = '/rezervacija-termina/';

const business = (SITE) => ({
  '@context': 'https://schema.org',
  '@type': 'AutoRepair',
  name: 'MA-NO Car Repairs',
  url: `${SITE}/`,
  image: `${SITE}/assets/img/slide-1.webp`,
  logo: `${SITE}/assets/img/ma-no-znak-512.png`,
  telephone: '+385981659925',
  email: 'info@ma-no.hr',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Ljubljanska avenija 2b (Z Centar, garaža -1)',
    addressLocality: 'Zagreb',
    postalCode: '10000',
    addressCountry: 'HR',
  },
  openingHoursSpecification: [{
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    opens: '08:00',
    closes: '16:00',
  }],
  areaServed: ['Zagreb', 'Split', 'Zadar', 'Rijeka', 'Osijek', 'Slavonski Brod'],
  sameAs: [
    'https://www.facebook.com/MaNoCarRepairs/',
    'https://www.instagram.com/ma_no_car_repairs/',
  ],
});

// U predlošcima su lokalne poveznice apsolutne od korijena (href="/usluge/", src="/assets/…"). Na podadresi
// (GitHub Pages: /ma-no/) dobiju njezin prefiks, inače bi tražile korijen domene. "//" (vanjske adrese) se ne dira.
// Putanje u CSS-u i JS-u moraju zato biti relativne ili data: adrese.
function withBase(html, base) {
  if (base === '/') return html;
  return html.replace(/(\s(?:href|src|action|poster)=["'])\/(?!\/)/g, `$1${base}`);
}

const read = (p) => fs.readFileSync(p, 'utf8');

function loadPartials() {
  const dir = path.join(SRC, 'partials');
  const out = {};
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.html')) out[path.basename(f, '.html')] = read(path.join(dir, f));
  }
  return out;
}

function includePartials(html, partials, depth = 0) {
  if (depth > 4) return html;
  return html.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => {
    if (!(name in partials)) throw new Error(`Nepoznat partial: ${name}`);
    return includePartials(partials[name], partials, depth + 1);
  });
}

function parsePage(file) {
  const raw = read(file);
  const m = raw.match(/^\s*<!--\s*(\{[\s\S]*?\})\s*-->\s*/);
  if (!m) throw new Error(`Stranica nema meta blok: ${file}`);
  return { meta: JSON.parse(m[1]), body: raw.slice(m[0].length) };
}

const stripTags = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function faqSchema(html) {
  const items = [...html.matchAll(/<details class="faq-item"[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>\s*<div class="faq-a">([\s\S]*?)<\/div>\s*<\/details>/g)];
  if (!items.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(([, q, a]) => ({
      '@type': 'Question',
      name: stripTags(q),
      acceptedAnswer: { '@type': 'Answer', text: stripTags(a) },
    })),
  };
}

const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

// Verzija ikona prema sadržaju datoteka (?v=...). Chrome adresu ikone koja je jednom vratila 404 više ne dohvaća
// do tvrdog osvježavanja; nova adresa to zaobiđe, a mijenja se i sama kad se ikona promijeni.
function iconVersion() {
  const h = crypto.createHash('sha1');
  for (const f of ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png']) h.update(fs.readFileSync(path.join(ROOT, 'assets', 'img', f)));
  return h.digest('hex').slice(0, 8);
}

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// stari dist/ se preimenuje u stranu, gotova nova mapa dođe na njegovo mjesto, a stari se tek onda briše.
// Na Windowsu preimenovanje zna kratko pasti dok poslužitelj čita datoteku, pa se pokušava ponovno.
function swapIntoDist(out, DIST) {
  for (let i = 0; i < 40; i++) {
    const old = `${DIST}.old-${process.pid}-${Date.now()}-${i}`;
    try {
      fs.renameSync(DIST, old);
    } catch (e) {
      if (e.code !== 'ENOENT') { sleep(50); continue; }
    }
    try {
      fs.renameSync(out, DIST);
    } catch {
      sleep(50);
      continue;
    }
    fs.rmSync(old, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    return;
  }
  throw new Error(`Nije uspjela zamjena mape ${path.basename(DIST)}/ (je li otvorena u drugom programu?)`);
}

// ostaci prekinutih buildova (dist.tmp-*, dist-demo.old-* …) starijih od minute
function cleanLeftovers() {
  for (const name of fs.readdirSync(ROOT)) {
    if (!/^dist(-demo)?\.(tmp|old)-/.test(name)) continue;
    const p = path.join(ROOT, name);
    try {
      if (Date.now() - fs.statSync(p).mtimeMs > 60000) fs.rmSync(p, { recursive: true, force: true });
    } catch { /* drugi proces je upravo makne */ }
  }
}

export function build(target = 'production') {
  const t0 = Date.now();
  if (!TARGETS[target]) throw new Error(`Nepoznat cilj builda: ${target}`);
  const { site: SITE, base, indexable, out } = TARGETS[target];
  const DIST = path.join(ROOT, out);
  const partials = loadPartials();
  const layout = read(path.join(SRC, 'layout.html'));
  const pagesDir = path.join(SRC, 'pages');
  const iconV = iconVersion();

  // gradi u privremenu mapu i tek gotovu zamijeni s dist/, da dist/ nikad nije poluprazan
  // (npr. kad dva dev servera ili dev server i "npm run build" grade u isto vrijeme)
  cleanLeftovers();
  const OUT = `${DIST}.tmp-${process.pid}-${t0}`;
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const urls = [];
  let pages = 0;
  for (const f of fs.readdirSync(pagesDir).filter((f) => f.endsWith('.html'))) {
    const { meta, body } = parsePage(path.join(pagesDir, f));
    const content = includePartials(body, partials);

    const schemas = [];
    if (meta.path === '/') schemas.push(business(SITE));
    const faq = faqSchema(content);
    if (faq) schemas.push(faq);

    // demo se cijeli drži izvan tražilica; na pravoj domeni samo stranice s "noindex": true (npr. 404)
    let robots = '';
    if (!indexable) robots = '\n  <meta name="robots" content="noindex, nofollow">';
    else if (meta.noindex) robots = '\n  <meta name="robots" content="noindex">';

    const vars = {
      site: SITE,
      booking: BOOKING,
      robots,
      iconV,
      title: meta.title,
      description: meta.description,
      canonical: SITE + meta.path,
      bodyClass: meta.bodyClass || '',
      jsonld: schemas.map(jsonLd).join('\n  '),
    };

    // "hideCta": true u meta bloku skida traku "Besplatna procjena" (npr. na stranici rezervacije)
    let html = layout
      .replace('{{content}}', () => content)
      .replace('{{ctaBand}}', () => (meta.hideCta ? '' : '{{> cta-band}}'));
    html = includePartials(html, partials);
    html = html.replace(/\{\{(\w+)\}\}/g, (all, key) => (key in vars ? vars[key] : all));
    if (meta.nav) {
      html = html.replaceAll(`data-nav="${meta.nav}"`, `data-nav="${meta.nav}" aria-current="page"`);
    }
    const leftover = html.match(/\{\{[^}]+\}\}/);
    if (leftover) throw new Error(`Nezamijenjen placeholder ${leftover[0]} u ${f}`);
    html = withBase(html, base);

    // "path": "/404.html" se zapisuje kao datoteka (GitHub Pages i većina hostinga je vraćaju za nepostojeće adrese),
    // a "/usluge/" kao usluge/index.html
    const file = meta.path.endsWith('.html') ? path.join(OUT, meta.path) : path.join(OUT, meta.path, 'index.html');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
    pages++;
    if (!meta.noindex) urls.push(SITE + meta.path);
  }

  fs.cpSync(path.join(ROOT, 'assets'), path.join(OUT, 'assets'), { recursive: true });
  // /favicon.ico u korijenu: traže ga Google, čitači RSS-a i preglednici kad ne pročitaju <link rel="icon">
  fs.copyFileSync(path.join(ROOT, 'assets', 'img', 'favicon.ico'), path.join(OUT, 'favicon.ico'));

  // sitemap i robots.txt samo za pravu domenu: demo se ne indeksira, a robots.txt na podadresi tražilice ionako ne čitaju
  if (indexable) {
    const today = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
        .map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
    fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
  }

  swapIntoDist(OUT, DIST);
  console.log(`Izgrađeno ${pages} stranica u ${out}/ za ${SITE}/ (${Date.now() - t0} ms)`);
}

// node build.mjs → dist/ za ma-no.hr;  node build.mjs --demo → dist-demo/ za GitHub Pages
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build(process.argv.includes('--demo') ? 'demo' : 'production');
}
