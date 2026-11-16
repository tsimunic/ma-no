# MA-NO Car Repairs – novi web

Statični web (HTML/CSS/JS, bez ovisnosti) s istim sadržajem kao ma-no.hr i novim dizajnom.

## Pokretanje

```bash
npm run dev     # izgradi dist/ i posluži na http://localhost:4321, ponovno gradi na svaku promjenu
npm run build   # samo izgradi dist/ za objavu
```

Za objavu se kopira sadržaj mape `dist/` na hosting. URL-ovi su isti kao na starom webu
(`/usluge/`, `/kontakt/`, `/popravak-auta-od-tuce/` …), pa postojeći linkovi i Google rezultati i dalje rade.

## Struktura

- `src/layout.html` – zajednički `<head>`, header i footer
- `src/partials/` – header, footer (CTA, osiguranja), kartice usluga, razlozi, bočna kartica „Besplatna procjena”
- `src/pages/` – po jedna datoteka za svaku stranicu; na vrhu je JSON s naslovom, opisom i putanjom
- `assets/` – CSS, JS i slike (preuzete sa starog weba)
- `build.mjs` – slaže stranice, dodaje schema.org podatke (AutoRepair i FAQ), `sitemap.xml` i `robots.txt`

`{{booking}}` u predlošcima zamjenjuje se putanjom `/rezervacija-termina/` (definirana u `build.mjs`),
pa svi gumbi „Rezerviraj termin” vode na stranicu za rezervacije.

## Rezervacije (tAInica widget)

Stranica `src/pages/rezervacija-termina.html` sadrži tAInica widget u načinu „cijela stranica”
(`data-embed="page"`, `month_view`). Na toj stranici nema trake „Besplatna procjena” (`"hideCta": true`).

- Widget trenutačno koristi **dev** adrese (`dev-widget.tainica.hr`, `tainica-gateway-demo…`). Prije objave
  zamijeniti ih produkcijskim kodom iz postavki widgeta.
- Domena weba (npr. `https://ma-no.hr`) mora biti među dopuštenim parent originima instalacije.
- Crvena boja widgeta zadana je u `assets/css/style.css` (`--tainica-widget-color`), spremnik je širok najviše 900 px,
  a `color-scheme: light` drži widget u svijetloj temi.
- Naslov u zaglavlju widgeta, logo, tema i lokacije postavljaju se u tAInici (instalacija widgeta), ne na webu.

## Logo

Mapa `logo/` sadrži znak (MN) i logo s natpisom, kao SVG i PNG:

- `…-za-tamnu-pozadinu` – bijeli N i bijeli natpis (header, footer, tamne podloge)
- `…-za-svijetlu-pozadinu` – tamni N (#141922) i tamni natpis (dokumenti, bijele podloge, widget)
- `ma-no-znak-prilagodljivi.svg` – N mijenja boju prema svijetloj/tamnoj temi preglednika (koristi se kao favicon)

Znak je vektorski precrtan s postojeće ikone weba ma-no.hr, a natpis je u fontu Archivo pretvoren u krivulje,
pa datoteke ne ovise o instaliranim fontovima. Web koristi `assets/img/ma-no-znak.svg`, `favicon.svg`,
`favicon-32.png` (tamna pločica, za preglednike bez SVG favicona), `apple-touch-icon.png` i `favicon.ico`
(build ga kopira u korijen, `/favicon.ico`).

Adrese ikona u `<head>` dobivaju `?v=` izračunat iz sadržaja datoteka. Chrome adresu ikone koja je jednom vratila 404
više ne dohvaća do tvrdog osvježavanja (Ctrl+F5), pa nova adresa nakon promjene ikone osigurava da se prikaže.

## Build

`build.mjs` gradi u privremenu mapu i tek je gotovu zamijeni s `dist/`, pa `dist/` nikad nije poluprazan, ni kad
dva dev servera (ili dev server i `npm run build`) grade u isto vrijeme. Dev server kratko pričeka i ponovi zahtjev
ako datoteka baš tada nedostaje. Nakon izmjene `build.mjs` ili `serve.mjs` dev server treba ponovno pokrenuti.

## Plutajući gumb (tAInica)

tAInica chatbot (plutajući gumb „Pišite nam”) ugrađen je u `src/layout.html`, odmah prije `</body>`, pa je na svim
stranicama. Stari WhatsApp gumb namjerno nije prenesen.

- `data-position="bottom-right"` drži gumb dolje desno i ima prednost pred položajem zadanim u aplikaciji tAInica
  (tamo je bio postavljen lijevo).
- Boja gumba dolazi iz iste varijable `--tainica-widget-color` kao kalendar rezervacija.
- I chatbot koristi **dev** adrese. Dopuštene domene instalacije su `http://localhost:4321` i `https://tsimunic.github.io`;
  prije objave na `https://ma-no.hr` treba dodati tu domenu u tAInici (i zamijeniti dev kod produkcijskim).
