# FleetCare — stav předání

- Oprava diagnostiky HTTP konfigurace: `HttpRepository` nyní při neplatné/nezadané URL uvádí `VITE_API_BASE_URL`, jak očekává test i konfigurace aplikace. Ověřeno typecheck, lint, všech 36 testů a produkční build.

- Připraven Node gateway pro školní Google Sheet `FleetCare DB`: mapuje podle existujících záhlaví vozidla, řidiče, termíny, jízdy, tankování a vybraná nastavení. Zapisuje do těchto listů, kontroluje změnu řádku před uložením a přijímá idempotency key. Zápisy nepokrytých entit a souborů zůstávají vypnuté, protože v tabulce nemají příslušné listy/sloupce. Konfigurace VPS a přesné limity jsou v `docs/sheets-vps.md`. Service account musí mít v tabulce roli Editor; jeho klíč zůstává mimo repozitář.
- Přidána Docker Compose konfigurace pro frontend/Nginx a Sheets gateway; návod na přenos pracovního stromu, service-account secret, spuštění a HTTPS proxy je v `docs/docker-vps.md`. Frontend používá relativní `/api/v1` a gateway binduje na Docker síť. Ověřeno typecheck, lint, build, `node --check` a `docker compose config`; image nebyl sestaven ani spuštěn bez VPS credentials.

- Role se přepíná pod logem v levé navigaci, na mobilu v otevřeném menu. Vyhledávání zachovává chování i pozici s maximální šířkou 800 px. Jednotný chevron všech běžných selectů je 14 px od pravého okraje, text má vyhrazených 44 px; nativní ovládání a režim vysokého kontrastu zůstávají zachované.

- Hlavička: odstraněny drobečky a text Zobrazit jako. Vyhledávání přímo v inputu, výsledky pod polem bez dialogu, lupa/Enter a podmíněný křížek. Escape, šipky a Tab podporují ovládání bez myši; změna stránky/role resetuje hledání. Aktuální umístění role a limit šířky viz výše.
- Kontrola inline hledání: typecheck, lint, 36 testů a build prošly. Produkční náhled i Pages ověřeny na desktopu a 390px mobilu: přímé psaní bez dialogu, odeslání lupou/Enterem, prázdný výsledek, křížek a Escape se zachováním dotazu. Nad demo daty prošlo hledání SPZ bez mezer, výběr výsledku šipkou/Enterem, detail a omezení podle role; mobil bez vodorovného přetečení.

- Moje požadavky přejmenováno na Moje úkoly: pouze vlastní ukončené jízdy bez koncového tachometru a skutečně naplánovaný servis aktuálně dostupných vozidel. Bez tabulky hlášení a odkazu na dokumenty. Termín, SPZ, provozní místo servisu a odkaz na detail; splněné položky automaticky mizí podle zdrojových záznamů.

- Řidičova úvodní stránka je v navigaci Přehled. Datum a pozdrav patří jen na přehled; ostatní sekce mají vlastní nadpis. Odstraněn 1000px limit řidičova obsahu, který nyní využívá celou šířku stejného kontejneru jako fleet manažer.

- Přidání vozidla sjednoceno: tlačítko s ikonou plus, bez chevronu, otevře dialog s volbou ručního zadání nebo uploadu STK. Chevron je vyhrazen skutečným rozbalovacím nabídkám. Stejná volba platí v přehledu i při prvním vozidle; STK existujícího vozidla zůstává v jeho detailu.

- Úprava navigace podle připomínky: odstraněna karta pracovního prostoru, nadpis sekce a spodní provozní štítek/slogan/verze. Změna společná pro main i demo, včetně mobilního menu. Výsledky kontrol a nasazení sledovat v příslušném commitu/Actions.

- GitHub Pages běží na https://jakubhunal.github.io/FleetCare/. Ověřen celý automatický řetězec main → CI → merge/push dema → kontroly → Pages. HTTP version.json se shodoval s HEAD demo větve. Novější push spouští další ověřené nasazení; chyba ponechá poslední funkční verzi.
- Pages QA: desktop 1440 px a mobil 390 px, vyhledání vozidla, reload přímého hash detailu, mobilní navigace a přesun klávesnice k obsahu bez ztráty URL. Jízda 100 500 → 100 510 km byla uložena, zachována po reloadu a ukončena. PDF i XLSX skutečně staženy; XLSX znovu otevřen. Konzole bez chyb, mobil bez vodorovného overflow. Podrobnosti a odkazy na úspěšné Actions jsou v docs/verification.md.
- Pravidla pro kolegy a agenty: CONTRIBUTING.md a AGENTS.md; dokončené celky musí být ověřené, commitnuté a pushnuté. Provoz publikování popisuje docs/deployment.md.

- GitHub: https://github.com/jakubhunal/FleetCare. Čistá větev main; oddělená codex/demo-review. Původní prototyp je v prototype-reference.
- Hotový FE: evidence, role, vazby, validace, IndexedDB a Blob, dokumenty, jízdy, servis, CCS, termíny/plány, reporty, PDF/XLSX a implementovaný HTTP klient. Dokumentace předání je v docs/.
- Čistý základ fe-clean-v1 byl ověřen a pushnut před založením demo větve. Společné opravy vznikly nejprve v main a jsou přenášeny do demo větve. Seed není v main ani jeho buildu.
- Main: 36 testů; demo má navíc test idempotentního seedu (37 celkem). Typecheck, lint a produkční build jsou součástí ověřování. Nové testy ověřují vznik/zánik řidičových úkolů a přístup jen k relevantním servisním kontaktům. Instalace z lockfile byla samostatně ověřena v čistém klonu.
- UI ověřeno na desktopu/tabletu/mobilu: prázdný start, perzistence vozidla/řidiče/přidělení, vlastní jízda, skutečné soubory a smazání, hledání, klávesnice, PDF rendering a XLSX typy. Demo: přiřazení rezervy, CCS rozhodnutí, reportové filtry, čtyři hlavní mobilní akce a oddělené filtry tabulek. Konzole kontrolovaných produkčních pohledů bez chyb.
- Poslední oprava: české kalendářní datum pro období; jízdy přes měsíční hranici se bez přesného rozdělení km nezahrnují do jmenovatele. Zakázka je časově zařazená jedinou poslední objednanou zastávkou.
- Další krok zadavatele: připomínky k demo větvi podle docs/review-workflow.md. Vzhled není označen za schválený bez jeho vyjádření.
- Další krok kolegů: DB/gateway, ověřená identita a oprávnění, soukromé soubory, Make/OCR/e-maily a integrační akceptace podle docs/backend-handover.md. Žádná ostrá služba není předstíraná.

## 2026-10-29 — Odstranění přebytečných prvků FE

- Detail vozidla (`fleet.tsx`): odstraněna záložka Pojištění a termíny, upload STK v hlavičce, přiřazení šablony a záznam provedení servisu, tlačítka hlášení závady a tankování. Dokumenty, výběr šablony a individuální plán zachovány.
- Detail řidiče: odstraněna záložka oprávnění a údaje zdravotní způsobilosti z přehledu. `DriverOperationsTable` v `tables.tsx` sjednocuje zakázky a běžné jízdy bez zakázky, s chipem typu a jedním filtrem; jízdy navázané na zakázku zůstávají v jejím detailu.
- Zakázky (`operations.tsx`, `overview.tsx`, `tables.tsx`, `rules.ts`): odstraněna signalizace konfliktů i výpočet časových překryvů mezi zakázkami. Sdílená kontrola vhodnosti kandidátů (kapacity, oprávnění, stav vozidla a servisní dostupnost) zachována pro přiřazování. Editor trasy (`editors.tsx`) má jen začátek a cíl, bez přidávání/odebírání zastávek; při uložení starší vícestopé zakázky zachová první a poslední bod. Importované historické trasy a datový model zůstávají kompatibilní.
- Detail závady: odstraněno obnovení příjemce i související stav a handler. Karta komunikace zůstává.
- Náklady (`costs.tsx`, `reports.tsx`): odstraněn upload účtenky v hlavičce, metodika pouze v nákladovém přehledu, spuštění párování CCS a karta původního souboru. Originální CCS dokument je dostupný odkazem na jeho existující detail. Odstraněno vytváření korekcí, příslušná pole a odkaz na původní výdaj; tabulka dokumentů se u výdaje bez dokumentů nevykresluje. Dostupná je úprava výdaje; odstraněn zákaz editace v lokálním command handleru, kontrola verzí zůstává.
- Termíny (`overview.tsx`): odstraněn sloupec Akce; nový detail termínu se v této iteraci nezavádí.
- Zachováno: dokumentové úložiště, datové modely, HTTP klient, historické korekce a API příkazy párování/šablon/komunikace kvůli kompatibilitě. Nastavení, kontakty, rychlé akce, styly, historie, patička a ostatní sdílená místa beze změn. Metodika v samostatných Reportech a upload účtenek v řidičově pracovním prostoru zůstávají.
- Ověření: lint, typecheck, produkční build a 38 testů; Chromium desktop 1440 px a mobil 390 px, odstranění prvků, jedna tabulka řidiče, dokumenty vozidla, persistence editovaného výdaje. Build nadále hlásí existující upozornění na velké chunky.
- Omezení: živý HTTP backend, produkční data a Pages nebyly ověřovány ani nasazovány. Další iterace musí rozhodnout o kartě komunikace a doplnit detail termínu. Větev `codex/ux-remove-extra-controls` je určena k revizi a začlenění do main.

### Následná funkční kontrola na žádost uživatele

Znovu ověřen commit `c25daef`: typecheck, lint, 38 testů a produkční build prošly. Dotčené obrazovky prošly kontrolami Chromium desktop/mobil. Navíc ověřena persistence úpravy servisního plánu, skutečný upload a stažení pojištění a import/otevření/stažení originálního CCS PDF. Výsledek a omezení jsou v `docs/verification.md`; nebyla nutná oprava aplikačního kódu. Záznam ověření je uložen na stejné pracovní větvi.
