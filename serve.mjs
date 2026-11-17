// Lokalni pregled: izgradi web, posluži ga i ponovno izgradi kad se nešto promijeni.
//   node serve.mjs         → dist/ na http://localhost:4321/ (kao na ma-no.hr)
//   node serve.mjs --demo  → dist-demo/ na http://localhost:4322/ma-no/ (kao na GitHub Pagesu)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, TARGETS } from './build.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const TARGET = process.argv.includes('--demo') ? 'demo' : 'production';
const { base, out } = TARGETS[TARGET];
const DIST = path.join(ROOT, out);
const PORT = Number(process.env.PORT) || (TARGET === 'demo' ? 4322 : 4321);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
};

build(TARGET);

let timer;
for (const dir of ['src', 'assets']) {
  fs.watch(path.join(ROOT, dir), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => { try { build(TARGET); } catch (e) { console.error(e.message); } }, 120);
  });
}

// kao GitHub Pages: nepostojeća adresa dobije 404.html sa statusom 404
function notFound(res) {
  fs.readFile(path.join(DIST, '404.html'), (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404'); return; }
    res.writeHead(404, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store' }).end(data);
  });
}

http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  // demo živi na podadresi; korijen i adresa bez završne "/" vode na nju
  if (base !== '/' && (url === '/' || url === base.slice(0, -1))) { res.writeHead(302, { Location: base }).end(); return; }
  if (!url.startsWith(base)) { notFound(res); return; }
  let p = '/' + url.slice(base.length);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(DIST, p);
  if (file !== DIST && !file.startsWith(DIST + path.sep)) { res.writeHead(403).end(); return; }
  if (!path.extname(file) && fs.existsSync(path.join(file, 'index.html'))) {
    res.writeHead(301, { Location: url + '/' }).end(); return;
  }
  // dok build zamjenjuje mapu dist/ (ovaj ili drugi proces), datoteka na tren ne postoji ili je zaključana;
  // pričeka se i pokuša ponovno, umjesto da preglednik dobije 404 i npr. zapamti da stranica nema favicon
  const send = (tries) => fs.readFile(file, (err, data) => {
    if (err && tries > 0 && ['ENOENT', 'EPERM', 'EBUSY', 'EACCES'].includes(err.code)) {
      setTimeout(() => send(tries - 1), 60);
      return;
    }
    if (err) { notFound(res); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
  send(6);
}).listen(PORT, () => console.log(`http://localhost:${PORT}${base}`));
