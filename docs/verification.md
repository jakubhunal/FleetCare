# Ověření — 28. 10. 2026

## Automatické kontroly

- Strict TypeScript: prošel.
- Čistý samostatný klon: `npm ci --offline` z uzamčených závislostí, typecheck, lint, 31 testů, build a kontrola čistého bundlu prošly. Regenerace smluv nevytvořila rozdíl. Ověřeno v plné cestě Windows; první pokus se zkrácenou TEMP cestou nebyl považován za úspěšné ověření.
- ESLint: prošel.
- Vitest: aktuálně 34 testů v sedmi souborech, prošly. HTTP testy použily dočasný skutečný Node server na 127.0.0.1. Dodatečný test ověřuje, že řidiči nejsou dostupné cenové originály objednávek ani servisní faktury.
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

Doplněny testy české půlnoci a jízdy přes hranici měsíců. Výnos zakázky používá jedinou poslední objednanou zastávku pro časové zařazení; nejde o doložený účetní okamžik doručení. Demo přidává jeden samostatný test seedu (35 celkem).

## GitHub Pages — skutečné veřejné nasazení

GitHub Pages jsou nastavené na GitHub Actions, nasazovací prostředí povoluje `codex/demo-review`. Ověřeno na https://jakubhunal.github.io/FleetCare/ dne 28. 10. 2026:

- Čistý commit `4e853a3` prošel [Frontend checks](https://github.com/jakubhunal/FleetCare/actions/runs/40709315128). Lokálně také typecheck, lint, všech 34 testů, build a regenerace kontraktů bez rozdílu.
- [Sync verified main to demo](https://github.com/jakubhunal/FleetCare/actions/runs/40709408751) úspěšně provedl merge a push `99e6c69` do demo větve a explicitně vyvolal Pages workflow. Rozdíl proti main stále tvořilo jen pět souborů demo konfigurace, seedu, testu a dokumentace.
- [Build a skutečné Pages nasazení](https://github.com/jakubhunal/FleetCare/actions/runs/40709433305) prošly, včetně 35 demo testů. `/FleetCare/version.json` vrátil HTTP 200 a přesný commit `99e6c69a99c6fc79341bcd9e973636e3e7afd26b`, shodný s demo HEAD a odkazem v patičce. Jde o zaznamenaný ověřovací bod; další push automaticky publikuje novější commit.
- Desktop 1440 px a telefon 390 px: načtení naplněného přehledu, hledání `1DE 1004`, detail Škoda Octavia a reload jeho přímé hash URL. Reload nevrátil 404 ani neztratil detail.
- Mobil: výběr Karla Ukázkového, navigace přes menu, zahájení samostatné testovací jízdy, perzistence po reloadu včetně zvoleného kontextu, ukončení s tachometrem 100 510 − 100 500 = 10 km. Výsledek se promítl do reportu. Tyto QA úpravy existují jen v testovacím prohlížeči, nikoli v Git seedu.
- Klávesnicový odkaz Přejít k obsahu zaměřil `main`, hash trasy zůstal zachován. Mobilní dokument měl clientWidth = scrollWidth = 375 px uvnitř 390px viewportu se svislým posuvníkem.
- Z veřejného dema byly skutečně staženy PDF (21 407 B, `%PDF-1.3`) i XLSX (7 191 B). XLSX byl znovu načten přes ExcelJS, list FleetCare měl 8 řádků a 8 sloupců. Ověřeno také načtení odložených exportních modulů z `/FleetCare/assets/`.
- Konzole těchto veřejných scénářů neobsahovala chyby ani varování. Snímky desktopu a mobilu jsou lokálně v ignorované složce `test-results/pages/`.

Publikování aktualizuje zdroj aplikace; nepřepisuje lokální IndexedDB návštěvníků a nepřipojuje žádnou DB nebo externí integraci.

## 29. 10. 2026 — Opakovaná kontrola po odstranění prvků UI

Ověřen kód `c25daef` na větvi `codex/ux-remove-extra-controls` v cloudovém prostředí, Node.js 24.19.0. Typecheck, lint, všech 38 testů v devíti souborech a produkční build prošly. Přetrvává upozornění Vite na velké chunky, build neselhává.

Chromium s izolovanými fiktivními daty, desktop 1440 px a mobil 390 px:

- Detaily vozidla (přehled, plán, závady, náklady), řidiče, zakázky, nákladové stránky, CCS, výdaj, termíny a detail závady se načetly; požadované odstraněné prvky se nezobrazují.
- Řidičovy zakázky a běžné jízdy jsou v jediné tabulce a obě testovací položky jsou dostupné. Záložka Dokumenty a upload zůstávají dostupné.
- Výdaj lze upravit bez korekčních polí; změna popisu přežila reload. Editor zakázky má dva body trasy bez tlačítek na přidání/odebrání a lze jej uložit.
- Existující individuální servisní plán lze otevřít, změnit název úkonu a uložit; změna přežila reload.
- Pojištění: skutečný upload syntetického PNG přes UI, zobrazení v dokumentech vozidla po reloadu, otevření náhledu a stažení originálu se shodnými bajty. První pokus kontroly selhal na příliš přesném selektoru odkazu (přístupný název obsahuje i typ dokumentu); po opravě testovacího selektoru prošel bez zásahu do aplikace.
- CCS: skutečný import syntetického platného PDF přes UI, detail s jedinou tabulkou transakcí, otevření původního dokumentu z nového odkazu, iframe náhled a stažení originálu po reloadu se shodnými bajty. Bez běhových chyb v kontrolovaných dokumentových scénářích.

Nenalezena chyba aplikace v těchto scénářích. Nejde o ověření všech kombinací vstupů ani ostrého HTTP backendu, OCR, e-mailů, Make či veřejného nasazení. Mobilní kontrola použila Chromium s rozměry telefonu, nikoli fyzické zařízení. Zůstává známé chování nového editoru: při uložení starší zakázky s více body trasy se zachová první a poslední bod (viz progress.md).

## 29. 10. 2026 — UX/FE refinements A1–C9

Větev `codex/ux-refinements`, aplikační commit `7fffcfc`: prošly typecheck, lint, 43 testů v 11 souborech, produkční build, kontrola čistého produktu a generování kontraktů bez rozdílu. Chromium desktop 1440 px a mobil 390 px ověřilo nové dialogy, tabulky, historii, konkrétní chyby polí, dokumentové uploady/stažení, přílohu výdaje včetně opakování selhání bez duplicity a řidičův prostor. Produkční preview prošlo založením vozidla, reloadem, přímými SPA cestami a skutečným XLSX exportem. Podrobný report, vlastní rozhodnutí, změny API a hranice ověření jsou v [ux-refinements.md](ux-refinements.md). Nenasazováno; externí integrace nebyly ověřeny.

## 29. 10. 2026 — Následné ověření dotčených funkcionalit na žádost uživatele

Znovu ověřena větev `codex/ux-refinements` na commitu `f2efa8c` (aplikační kód `7fffcfc`). Výchozí pracovní strom byl čistý; nebyla nutná žádná oprava aplikace.

- Typecheck, lint, všech 43 testů v 11 souborech a produkční build prošly. Regenerace API kontraktů nevytvořila rozdíl; kontrola čistého produktu bez demo dat také prošla. Build nadále hlásí existující upozornění na velikost chunků.
- Chromium zopakovalo přiřazení zakázky v dialogu a persistenci, shodné/rozdílné CCS podklady a vyřešení rozdílu, individuální plán a šablonu, detail/editaci termínu a kalendář, tabulky přidělení a historii, dropdowny, nákladový přehled, konkrétní chyby polí a období exportu.
- Znovu ověřeno založení výdaje s přílohou, upload/filtrování/úprava/smazání pojištění, skutečné stažení originálních bajtů přílohy a CCS PDF, změna příjemce, řidičovy úkoly a navigace Vedení.
- Úmyslná chyba zápisu přílohy do IndexedDB následovaná opakováním skončila právě jedním výdajem a jednou přílohou. Chybějící/neplatná účtenka zobrazila chybu u souboru a nevytvořila tankování. Ověřena horní středová pozice toastu.
- Nové doplňkové funkční scénáře prošly samostatně při šířkách 1440 i 390 px: založení a editace jediného servisního kontaktu; založení CCS karty, přiřazení časové vazby k vozidlu, změna tolerance a deaktivace; změna svěřeného řidiče, ukončení přidělení, správný výchozí filtr a zobrazení historie z detailu vozidla i řidiče. Hodnoty byly po reloadu ověřeny v UI i u CCS karty v uložených datech.
- Čerstvě sestavené produkční preview znovu prošlo přímými SPA cestami, založením vozidla, reloadem a detailem, výchozím nákladovým přehledem a skutečným stažením XLSX.

V otestovaných scénářích nebyla nalezena rozbitá funkce ani běhová chyba prohlížeče. Všechna provozní data byla fiktivní a izolovaná v dočasných kontextech prohlížeče. Výsledek se týká lokálního adaptéru a testovaného HTTP kontraktu; ostrý backend, Google Sheets, OCR, e-maily, Make a nasazení nebyly ověřovány. Mobilní scénáře používají Chromium s rozměry telefonu, nikoli fyzické zařízení.

## 30. 10. 2026 — Cílená kontrola odstranění prvků detailu vozidla

Prověřeno nové zadání omezené na detail vozidla na větvi `codex/ux-refinements`, commit `b1be20a`. Všechny požadované prvky již byly odstraněné; žádné další změny aplikačního kódu, textů, barev, rozložení nebo stylů nebyly potřeba.

- `src/features/fleet.tsx`, `VehiclePage`: není záložka Pojištění a termíny ani její obsah, tlačítka Upravit provozní údaj STK / Přidat pojištění / termín, hlavičkový upload STK, hlášení závady v záložce Závady a servis ani zadání tankování v záložce Tankování a náklady. Původní cesta záložky `terms` zobrazí existující stav nedostupné části detailu.
- `ServicePlan` ve stejném souboru: chybí Přiřadit šablonu i Zaznamenat provedení včetně jejich obrazovkových handlerů. Stávající úprava individuálního plánu (tužka v řádku) a výběr šablony v editoru jsou zachované.
- Zachována současná akce Upravit informace o vozidle. `DocumentList`, `useEditors`, `useUpload`, datové modely a sdílené/API příkazy `plan.apply` / `plan.complete` zůstaly nedotčené; slouží i dalším místům nebo kompatibilitě existujícího kontraktu. Upload STK v Dokumentech a při přidávání vozidla není hlavičková akce detailu a nebyl odstraňován.
- Lint, typecheck, všech 43 testů v 11 souborech a produkční build prošly. Zůstává existující upozornění Vite na velké chunky.
- Chromium 1440 px a 390 px s izolovanými fiktivními daty ověřilo nepřítomnost všech uvedených prvků na dotčených záložkách, zachovanou úpravu vozidla/plánu a výběr šablony. Dokumenty prošly skutečným nahráním pojištění, reloadem, otevřením náhledu a stažením originálu se shodnými bajty; bez běhových chyb.

Nově se nic dalšího neodstraňovalo. Nejasná místa nevyžadující další zásah nebyla zjištěna. Ověření se týká lokálního adaptéru; externí integrace a veřejné nasazení nebyly testovány ani měněny.
