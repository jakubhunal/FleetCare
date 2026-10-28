# Ověření — 28. 10. 2026

## Automatické kontroly

- Strict TypeScript: prošel.
- Čistý samostatný klon: `npm ci --offline` z uzamčených závislostí, typecheck, lint, 31 testů, build a kontrola čistého bundlu prošly. Regenerace smluv nevytvořila rozdíl. Ověřeno v plné cestě Windows; první pokus se zkrácenou TEMP cestou nebyl považován za úspěšné ověření.
- ESLint: prošel.
- Vitest: aktuálně 32 testů v šesti souborech, prošly. HTTP testy použily dočasný skutečný Node server na 127.0.0.1. Dodatečný test ověřuje, že řidiči nejsou dostupné cenové originály objednávek ani servisní faktury.
- Produkční Vite build: prošel. Knihovny PDF, fonty a ExcelJS se načítají až při exportu; Vite upozorňuje na velikost těchto exportních balíků. Nejde o chybu buildu.
- OpenAPI a JSON Schema jsou generované z runtime schémat. `npm run contracts` prošel.
- Čistý build lze kontrolovat pomocí `node scripts/check-clean-build.mjs`; pro demo větev tato kontrola záměrně neplatí.

Testy ověřují prázdný start, unikátní SPZ, perzistenci záznamu a Blob, skutečné znepřístupnění souboru, rollback při selhání zápisu, idempotenci závady/outboxu, přesnou hranici A6 72 h, časové překryvy, stav neúplné/doplněné jízdy, nevracení aktuálního nájezdu, nezávislé svěření/zakázku, pozastavení, vhodnost a chybějící kapacitu, snapshot servisního plánu, letní čas, řidičův rozsah, kanonický náklad, CCS tolerance/více kandidátů, spotřebu s dílčím tankováním, různé měny, nulové km a skutečné XLSX buňky. HTTP část testuje konfiguraci, DTO, operace, upload lifecycle, job, originál, 409/429, síťovou chybu a žádný lokální fallback.

## Skutečně spuštěná aplikace

Vite dev běžel na portu 5173. Produkční preview běželo na jiném originu 4174 pro samostatně prázdné úložiště. Ruční QA používá pouze syntetické testovací záznamy a kopii screenshotu původního prototypu jako testovací přílohu, nikoli osobní dokument. Tyto ruční QA záznamy nejsou v Git zdrojích ani buildu a nevznikají při startu aplikace.

Prohlížečem ověřeno:

1. Založení vozidla s nosností/objemem, česká desetinná čárka, založení řidiče se strukturovaným oprávněním a svěření. Reload zachoval všechny vazby i tachometr.
2. Přepnutí řidiče, samostatná jízda bez zakázky, ukončení bez endKm, pravdivý neúplný stav a A6 až po 72 h. Doplnění 10 045 − 10 000 = 45 km převedlo jízdu K ověření. Reload zachoval i řidičský kontext.
3. Vlastní dokument řidiče: skutečný upload JPG, zobrazení originálu po reloadu, stav not_configured bez vytěžení, cílené potvrzení smazání a odmítnutí původní URL po smazání. Profil zůstal zachován.
4. Globální hledání `1qa0001` našlo `1QA 0001` i související jízdu, bez nutnosti mezer a velikosti písmen. Mobilní vyhledávání je dostupné tlačítkem.
5. Klávesnice: Escape v hledání a v rozepsaném formuláři, potvrzení zahození / pokračování. Rozpracovaná hodnota zůstala zachována. Tabulky mají skutečné odkazy a vnořené odkazy nejsou uvnitř hlavního odkazu řádku.
6. Skutečné stažení PDF a XLSX. XLSX byl otevřen přes openpyxl: datumové buňky mají typ Date, tachometry a km jsou čísla, součet 45 odpovídá záznamu. PDF bylo rasterizováno Popplerem a vizuálně zkontrolováno včetně českých znaků, hlaviček a stránkování; chybějící glyph šipky byl opraven a nový výstup znovu zkontrolován.
7. Čistý produkční start ukázal nuly/prázdné seznamy a žádného implicitního řidiče. Řidičova přímá URL /reports vrátila Nedostatečná oprávnění.
8. Vizuálně zkontrolovaný desktop 1440 px, tablet 768 px a telefon 390 px. Na tabletu a telefonu ověřeno clientWidth = scrollWidth; široké tabulky mají vlastní posuv. Řidič má velké dotykové akce a čitelnou kartu vozidla.

## Hranice ověření

Neproběhlo připojení ostré DB, skutečné autentizace, e-mailů, Make ani OCR. Jejich výsledek není předstírán. Nebyla provedena certifikace WCAG ani test čtečkou obrazovky; proběhla kontrola sémantiky a klávesnice. Produkční kapacitu skutečného backendu a spolehlivost extrakce ověří integrační tým. Velikost úplné kontextové projekce a další růst historie popisuje architecture.md.

Ukázková větev byla vytvořena až z pushnutého `fe-clean-v1`. Její test ověřil opakovatelnost seedu a zachování úprav. V prohlížeči prošlo přiřazení rezervního vozidla a samostatně řidičky k importované zakázce i vyřešení CCS s důvodem; oba výsledky přežily reload. Změna konce reportového období změnila palivo, spotřebu a předběžný součet. Naplněný mobilní řidič neměl vodorovný overflow. Společné opravy vznikají nejprve v main a přenášejí se do demo větve.
