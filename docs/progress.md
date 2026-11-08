# FleetCare — stav předání

## 2026-11-08 — Úprava konce neúplné jízdy řidičem

- U neúplné jízdy může řidič upravit konečné datum i koncový tachometr. Ostatní pole zůstávají uzamčená; konečné datum je při úpravě povinné.
- Ověření: typecheck, lint, produkční build a 79 testů (mimo HTTP testy vyžadující localhost) prošly. UI nebylo dostupné pro ruční kontrolu. Produkční build má stávající upozornění na velké JS chunky.

## 2026-11-08 — Oprávnění řidiče, výběr souborů a stavy zakázek

- Řidičské oprávnění v editoru řidiče se vybírá z hodnot B, BE, C a CE; každý přidaný řádek má vlastní datum platnosti. Volný text kvalifikace zůstává beze změny.
- Z obecného výběru souborů bylo odstraněno focení účtenky, včetně použití při nahrání účtenky i při přikládání dokladů.
- Zahájení jízdy mění přidělenou zakázku z „Přiřazená“ na „Probíhá“. Při zadání konce i koncového tachometru se zakázka změní na „Dokončená“. Neúplná jízda bez koncového tachometru zakázku nedokončí. Přidán doménový test celého přechodu.
- Ověření: typecheck a lint prošly; 87 testů včetně obou přechodů zakázky prošlo; produkční build prošel s dosavadním upozorněním na velké JS chunky. Chromium ověřil desktopový dialog řidiče, volby B/BE/C/CE a samostatná data platnosti pro více řádků; změny formuláře byly zahozeny bez uložení. Mobilní šířku nelze v této relaci nastavit přes připojené UI rozhraní. Commit/push nebyl proveden: žádost o oprávnění k zápisu do Git metadata byla zamítnuta.

- Tankování: formulář i nahrání účtenky vyžadují kladné litry a částku. Kontrolu opakuje doménový příkaz, HTTP command schema a Sheets gateway; mapování ukládá číselné hodnoty do `litres`, `amount_czk` a `ccs_amount_czk`. Typecheck, lint, 48 testů, syntaxe gatewaye i produkční build prošly; UI ověřilo, že prázdné hodnoty zastaví obě cesty před uložením.

- Termíny: formulář vyžaduje vozidlo i datum. Doménový zápis ověřuje, že vozidlo existuje; Sheets gateway odmítne chybějící/neplatné hodnoty a zapíše `vehicle_id` i `valid_until` bez prázdného fallbacku. Typecheck, lint, 47 testů, syntaxe gatewaye, kontrola odeslání prázdného formuláře a produkční build prošly.

- Jízdy: ukončení z FE uloží „Ukončena neúplná“ bez koncového tachometru, jinak „K ověření“; následné úpravy stav nepřepisují. Časy se ukládají jako ISO s pražským offsetem. Typecheck, lint, 48 testů, syntaxe gatewaye a produkční build prošly.

- Přihlášení pro HTTP/Sheets režim přes list `accounts` ověřuje nyní i `active=TRUE`; role `driver`/`fleet`/`management` se mapují na aplikaci a řidič se váže přes `driver_id`. Přihlášený kontext se při obnově zachová a lze se odhlásit. Lokální režim si ponechává přepínač rolí.
- Dockerfile gatewaye nyní kopíruje modul mapující účty, který login endpoint importuje. Po změně je nutné na VPS znovu sestavit a vynutit vytvoření kontejneru `gateway`.

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

- A1: Move order assignment into a suitable-candidates dialog — typecheck a lint prošly.

- A2: Simplify fuel detail and show one action for CCS differences — typecheck a lint prošly.

- A3: Add shared document editing deletion download and type filters — typecheck a lint prošly.

- A4: Present vehicle service plans in a table with dialog-only templates — typecheck a lint prošly.

- A5: Add deadline details and right-aligned list calendar controls — typecheck a lint prošly.

- A6: Use assignment tables with history and vehicle identifiers — typecheck a lint prošly.

- A7: Show accessible field-specific validation including repeated service items — typecheck a lint prošly.

- A8: Upload an expense attachment directly from its creation form — typecheck a lint prošly.

- A9: Set global body text to 16px and minimum small text to 14px — typecheck a lint prošly.

- B1: Share table toolbars and consistent history switches — typecheck a lint prošly.

- B2: Use a shared add-method dropdown for vehicles and fuel — typecheck a lint prošly.

- B3: Use application file pickers for uploads and camera receipts — typecheck a lint prošly.

- B4: Label the CCS PDF action while retaining one transaction table — typecheck a lint prošly.

- B5: Make the cost overview the first and default costs tab — typecheck a lint prošly.

- B6: Use a secondary edit action with a pencil on expense details — typecheck a lint prošly.

- B7: Add a single-service Contacts tab and tabular CCS cards — typecheck a lint prošly.

- B8: Add explicit recipient editing and secondary fault actions — typecheck a lint prošly.

- B9: Move dashboard quick actions directly below the heading — typecheck a lint prošly.

- B10: Position toast notifications at the top center — typecheck a lint prošly.

- B11: Tabulate driver tasks and align driver table actions — typecheck a lint prošly.

- C1: Remove informational banners while preserving actionable warnings — typecheck a lint prošly.

- C2: Remove the workspace eyebrow from shared page headings — typecheck a lint prošly.

- C3: Remove the shared page footer — typecheck a lint prošly.

- C4: Mark destructive row and confirmation actions in red — typecheck a lint prošly.

- C5: Color required-field markers red through shared form labels — typecheck a lint prošly.

- C6: Simplify edit and download labels consistently — typecheck a lint prošly.

- C7: Keep tab labels free of hover underlines — typecheck a lint prošly.

- C8: Place reports before settings in management navigation — typecheck a lint prošly.

- C9: Reserve green buttons for primary page actions — typecheck a lint prošly.

- Test document permissions metadata versions and recipient changes — typecheck a lint prošly.

- A7 follow-up: Validate export periods at their date fields — typecheck a lint prošly.

- A7 follow-up: Preserve API field errors and surface unmapped validation failures — typecheck a lint prošly.

- Keep empty-table messages fully visible on small screens — typecheck a lint prošly.

- A7 follow-up: Collect numeric errors and validate attachments before saving — typecheck a lint prošly.

- B1 follow-up: Place list creation actions inside shared table toolbars — typecheck a lint prošly.

- A6 follow-up: Keep status filtering in the merged driver operations table — typecheck a lint prošly.

### Dokončení UX/FE iterace A1–C9

Všechny body nového UX zadání implementovány na `codex/ux-refinements` s jednotlivými commity a pushi. Finální aplikační commit `7fffcfc` prošel 43 testy, typecheckem, lintem, produkčním buildem, kontrolou čistého produktu a kontraktů. Ověřeny desktopové/mobilní scénáře i produkční preview a skutečný export XLSX. Kompletní report je v `docs/ux-refinements.md`, včetně dvou nutných nových příkazů pro metadata dokumentu a příjemce a rozhodnutí o jednom servisním kontaktu. Podmínka zahájení jízdy řidiče zůstává nezměněná. Připraveno k revizi; main ani veřejné demo se v této iteraci neměnily.

### Následný regresní průchod UX změn

Na žádost uživatele znovu ověřen `f2efa8c`: 43 testů, lint, typecheck, build, čistý produkt a kontrakty prošly. Desktop/mobil navíc prošly skutečným ukládáním a editací servisního kontaktu, CCS karty a její vazby i změnou/ukončením přidělení s historií. Zopakovány byly dokumenty, přílohy včetně selhání a opakování, CCS, dialogy, validace a skutečný produkční export XLSX. Žádná oprava aplikačního kódu nebyla nutná; podrobný záznam je v `docs/verification.md`. Větev zůstává připravená k revizi a případnému sloučení do main.

### 30. 10. 2026 — Kontrola omezeného zadání detailu vozidla

Všechny nově vyjmenované prvky detailu vozidla jsou již odstraněné v `VehiclePage` / `ServicePlan`. Úprava vozidla, individuálního plánu, výběr šablony a Dokumenty zůstaly zachované. Prošly lint, typecheck, 43 testů, build a cílená kontrola Chromium desktop/mobil včetně uploadu/náhledu/stažení pojištění. Aplikační kód a vzhled se neměnily; nový commit obsahuje pouze report kontroly v `docs/verification.md` a tento záznam.

### 31. 10. 2026 — Drobné UX opravy po průchodu aplikací

- Sdílený `FieldLabel` v `components/ui.tsx` sjednocuje labely `Form` i `Field`; nezalomitelná mezera váže červenou hvězdičku k poslednímu slovu.
- `Button` přidává existující Pencil pouze textům obsahujícím Upravit bez již přítomné tužky (CCS karta, šablona, kontakt, termín). Odkaz Upravit termín mimo Button dostal ikonu ručně; ikonové tlačítko individuálního plánu má aria-label již nyní.
- Sdílený `DocumentPage` používá Back se zachováním původní cesty, filtrů a kontextového názvu. Dokumenty se otevírají z vozidla, řidiče a jeho pracovního prostoru, zakázky, závady, tankování, výdaje a CCS transakce/výpisu. Dva přímé vstupy (STK ve vozidlech, PDF výpisu) používají společný DocumentLink. Ruční návrat na jednotlivých stránkách nebyl potřeba. Při přímém otevření bez navigačního kontextu se použije vlastník dokumentu.
- Toasty se automaticky zavírají po 7000 ms (`TOAST_DURATION_MS`), i opakovaná stejná zpráva obnoví čas. Ruční zavření zůstává. Chyby formulářů jsou nadále trvalé Notice, nikoli toasty.
- Připomínka koncového tachometru v přehledu řidiče používá stejnou červenou variantu Notice jako detail jízdy; akční odkaz zůstává.
- Jediná neakční hláška o uložených provozních záznamech byla odstraněna ze společného Dashboard pro Fleet manažera a Vedení. Další výskyt stejné hlášky nenalezen, ostatní bannery zachovány.
- Společná definice editoru jízd používá Místo od a Začátek. Ponecháno: Skutečné místo do, Skutečný konec, Skutečný čas transakce, Skutečný průběh; rovněž Skutečná cena a popis Skutečně uskutečněné jízdy.
- Palivo vozidla má nový formulářový číselník Nafta/Benzín/LPG/CNG/Elektro/Hybrid. Existoval pouze string, nikoli enum. API, backend a datové modely se neměnily; starší vlastní hodnotu select zachová. Palivo tankování zůstává beze změny.
- Bez sdílené komponenty pro konkrétní obsah: odstranění hlášky Dashboard a lokální texty editoru, nabídka paliva vozidla; vzhled a layout jinak zachovány.
- Otevřená otázka: Značka / model je povinný volný text, ponechán. Doporučení: ponechat text kvůli různým modelům a historickým datům; případný číselník značek zavést odděleně s mapováním starých hodnot, nikoli tichou náhradou kombinovaného pole.
- Ověření: typecheck, lint, všech 43 testů a produkční build prošly (původní upozornění na velikost JS chunků). Chromium ověřil desktop/mobil 1440/375 px ve formuláři vozidla, select paliva, skutečné uložení a automatické zavření toastu. Navíc prohlížeč ověřil 78 povinných labelů sdílených editorů vozidel, řidičů, zakázek, jízd, závad, tankování, výdajů, termínů a nastavení v šířkách 320/1200 px. Ověření všech provozních scénářů s externími službami není součástí této změny.

- Upřesnění návratu z dokumentu: při návratu na detail vozidla zobrazuje společný DocumentPage text „Detail vozidla“ místo SPZ, včetně přímých vstupů s returnLabel. Cíl odkazu zůstává zachován.

- Upřesnění popisků společného editoru jízdy: Počáteční místo, Začáteční datum, Konečné místo, Konečné datum. První dva názvy platí i při zahájení jízdy. Typy polí a ostatní texty mimo editor zůstávají zachovány.

- Sjednocení umístění potvrzovacího toastu: sdílený styl používá 50vw místo 50 %, včetně mobilního pravidla. Střed se tak odvozuje z plné šířky viewportu bez posunu podle přítomnosti svislého scrollbaru na delším Přehledu. Vzhled, horní odsazení a čas zavření zůstávají zachovány.

## UX dávka 2
Práce na codex/ux-batch-2; audit a výsledky v docs/ux-batch-2.md. A1/A3 vyžadují rozhodnutí o Sheets integraci; model ani API nebyly změněny.

UX dávka 2: implementovány společné komponenty, řidičské formuláře/úkoly, upozornění, sjednocení nájezdu a reportů. Podrobný stav A–F v docs/ux-batch-2.md. Kontroly: 50 testů prošlo, typecheck/lint/build prošly; Chromium ověřil dialog, upload a mobil. A1/A3 vyžadují potvrzenou integraci Sheets, jméno manažera není v Actor API. Finální větev codex/ux-batch-2-cloud.

## FE audit — dávka 3

Na aktuální větvi `work` dokončeny A1–A8 a B1/B3/B4 v samostatných commitech; B2 již hotovo. Report, příčina VIN, inventura historie a rozhodnutí: [fe-audit-3.md](fe-audit-3.md). Typecheck, lint a 61 testů prošly; Chromium ověřil formuláře, časy, historii a navigaci v šířkách 1440/390 px. Model ani API nezměněny, jediná doménová oprava se týká nezměněného VIN. Předání obsahuje závěrečný build/test a výsledek pushe na `origin/work`; veřejné demo se touto dávkou nenasazuje.
### 4. 11. 2026 — Opravy Sheets gatewaye

- Účty s `active` odlišným od TRUE se nepřihlásí.
- Závady se načítají a ukládají do listu `faults`; historie přidělení se načítá z `assignments`, při změně se předchozí záznam uzavře a nový přidá. Při přiřazení kamionu/nákladního vozidla gateway vyžaduje skupinu C nebo CE.
- Příkaz `vehicle.assign` nese verzi vozidla; doménová kontrola i Sheets gateway vrací konflikt 409 při zastaralé verzi. HTTP klient zobrazuje hlášku o obnovení detailu.
- Ověřeno: `node --check` obou modulů gatewaye, typecheck, lint, všech 50 testů a produkční build. Testy potřebovaly povolený localhost kvůli svému HTTP serveru. Produkční build má dosavadní upozornění na velké JS chunky. Skutečná tabulka ani nasazená gateway nebyly dostupné pro integrační ověření.

## Oprava CI po sloučení dávky 3 do main

Na `main` forku `UnsweetenedLemonade/FleetCare` reprodukována chyba TS2300: při sloučení zůstaly v `src/features/fleet.tsx` duplicitní importy z `react-router` a `lucide-react`. Importy sjednoceny při zachování `useNavigate`, `Plus` i `Trash2`; chování aplikace se nemění. Ověření: typecheck včetně serveru, lint, 61 testů, produkční build a regenerace kontraktů bez rozdílu vůči uloženým schématům. Oprava je určena k pushnutí na `origin/main` a následnému opakování kontroly PR do hlavního repozitáře.

## FE audit — dávka 4

1. Detail dokumentu vozidla po úspěšném smazání přesměruje na `/vehicles/:id/documents`; cíl je zachycen před smazáním a stávající `run` invaliduje workspace i souborovou cache. Dříve zůstal na detailu s hlášením „Dokument není dostupný“. Ostatní vlastníci (řidič, zakázka, výdaj, tankování, závada, CCS výpis, intake) zůstávají beze změny na detailu smazaného dokumentu; mazání ze seznamu dokumentů řidiče zůstává v seznamu. Bez změny toastu, API, modelu nebo backendu. Typecheck včetně serveru, lint a 61 testů prošly. Chromium 1440/390 px ověřil přesměrování, aktivní záložku, zmizení souboru po reloadu, zachování chybového dialogu při selhání zápisu i původní chování ostatních vlastníků.

2. Ze sdíleného editoru servisního plánu odstraněn jediný výskyt věty „Výběr šablony předvyplní úkony. Změny se uloží až potvrzením formuláře.“ včetně `<small>`. Tím opraveno přidání i úprava plánu. Label a select Šablona zachovány; odkaz aria-describedby ani samostatný i18n řetězec zde nebyly. Typecheck, lint a 61 testů prošly; Chromium 1440/390 px ověřil oba dialogy, výběr šablony, předvyplnění úkonů i uložení.

3. Jediný aktivní výskyt tlačítka „Vytvořit individuální plán“ v toolbaru servisního plánu vozidla přejmenován na „Přidat servisní plán“. Sdílený Button automaticky doplňuje stávající ikonu plus; handler, umístění a styly nezměněny. Titulek dialogu již správný, žádné staré aria-label/title/testovací selektory ani text prázdného stavu nenalezeny. Historický záznam původního názvu v `docs/ux-batch-2.md` ponechán. Typecheck, lint a 61 testů prošly. Chromium 1440/390 px ověřil nový název, právě jednu ikonu plus, otevření správného dialogu, vytvoření i následnou úpravu plánu. Všechny tři body jsou hotovo; žádné změny backendu, modelu, API ani knihoven. Na závěr následuje build, testy a push aktuální větve main.

### Rozšíření návratu po smazání na všechny dokumenty

Sdílený detail dokumentu po úspěšném smazání nyní vždy opustí smazaný detail. U vozidla zůstává cílem jeho záložka Dokumenty; ostatní vlastníci používají původní kontext návratu včetně stavu tabulky, při přímém vstupu existující cíl vlastníka (řidič, zakázka, výdaj, tankování, závada, CCS výpis, intake → Vozidla). Řidič se s vlastním dokumentem vrací do `/my/documents`. Kontext odkazující zpět na detail dokumentu se nepoužije. Navigace nahrazuje smazaný detail v historii a probíhá až po úspěšném `run` s invalidací cache. Selhání ponechá stávající chybový dialog a původní stránku. Mazání ze seznamu dokumentů řidiče nadále zůstává v seznamu. Bez změny API, modelů či backendu.

Ověření: typecheck včetně serveru, lint, 61 testů a build prošly. Chromium 1440/390 px ověřil všechny typy vlastníků, kontextový návrat a stav tabulky, přímý vstup v roli Řidič, aktivní Dokumenty vozidla, zmizení souboru po reloadu a nasimulovanou chybu zápisu bez navigace.

## FE audit — dávka 5

1. Nový plán používá oddělený dialog se sdílenými PlanItems, Form a ViewToggle. Výchozí režim Šablona obsahuje pouze skutečné šablony a prázdnou volbu; Individuální plán skrývá dropdown. Změna režimu s úkony nebo vybranou šablonou vyžaduje potvrzení, zrušení data zachová. Prázdný seznam nabízí text pro přepnutí. Helper již odstraněn v dávce 4, nevrací se. Dialog úpravy zůstává původní s dropdownem a volbou Individuální plán. Typecheck, lint a 61 testů prošly; Chromium 1440/390 px ověřil režimy, potvrzení, klávesnici, velikost textu ≥14 px, předvyplnění, uložení, prázdné šablony a nezměněnou úpravu.

2. Individuální plán po validaci nabídne „Chcete uložit jako šablonu?“; Ne uloží pouze plán, Ano vyžaduje Název šablony včetně odmítnutí whitespace. Esc/křížek před ukládáním vrací do formuláře bez zápisu. Šablona používá stejná pole name/category/items jako Nastavení; kategorii přebírá z vozidla. Existující pravidlo unikátnosti názvu není, nebylo přidáno. Režim Šablona ukládá přímo. API nemá atomický dvojzápis: helper předem validuje a zmrazí oba payloady, uloží nejdřív šablonu, pak plán s jejím templateId. Při částečném nebo nejistém výsledku explicitní chyba uvádí, co je/může být uloženo. Stejné idempotency klíče a zachovaný stav pokusu umožní opakování bez duplicit; po potvrzeném prvním zápisu se opakuje jen plán. Backend, schémata ani API neměněny. Stávající run invaliduje workspace po každém zápisu. Chromium 1440/390 px ověřil nový záznam bez reloadu v Nastavení → Servisní plány, dropdownu úpravy i přidání plánu dalšímu vozidlu. Ověřeny Ne/Ano, pole s chybou, zrušení dotazu a chyba druhého zápisu s úspěšným opakováním. Typecheck, lint a 66 testů (5 nových pro skutečné IndexedDB ukládání a retry) prošly.

3. V individuálním režimu nového plánu je Uložit disabled, dokud items.length není alespoň 1; po odebrání posledního úkonu je znovu disabled. Form dostal volitelný submitDisabled s výchozí false a ochranou i pro submit událost; používá jej pouze tento dialog. Sdílený vzor „disabled dokud není dirty“ v aplikaci není, nebyl zaveden. Režim Šablona nadále umožňuje Uložit bez výběru, stejně jako před změnou. Typecheck, lint a všech 66 testů prošly; Chromium 1440/390 px ověřil disabled/enabled, přidání/odebrání, validaci polí i zachování režimu Šablona. Body 1–3 hotovo; odstranění pomocné věty bylo již hotovo. Bez nových knihoven a bez změn backendu, modelů nebo API. Závěrečný postup: build, testy a push main na origin forku.

Drobné doladění otázky „Chcete uložit jako šablonu?“: posun o 4 px výše a odstup 16 px od následujících tlačítek/pole, pouze pro tuto otázku. Typecheck, lint, 66 testů a build prošly; Chromium ověřil odstup na desktopu i mobilu.

### Povinné intervaly úkonu a konkrétní chyby

Sdílené PlanItems označuje oba intervaly červenou hvězdičkou a vysvětluje podmínku „Vyplňte alespoň jeden interval: kilometry nebo měsíce.“ Zachováno stávající pravidlo alespoň jedné kladné hodnoty, nikoli nová povinnost obou intervalů. Přístupnost vyjadřuje podmíněné aria-required. Chyby jsou specifické pro kilometry/měsíce. Sdílená validace formuláře nyní průběžně přepočítává chyby i ve vnořených polích, takže nezůstávají červené po opravě hodnot. Platí pro přidání/úpravu plánu i šablony. Backend, modely a API beze změny. Typecheck, lint, 67 testů a build prošly; Chromium ověřil hvězdičky, obě zprávy, průběžnou opravu i uložení s jediným intervalem při šířkách 1440/390 px.

### Režimy i při úpravě servisního plánu

Přidání i úprava používají společný ServicePlanDialog. Úprava inicializuje režim podle uloženého templateId: bez vazby Individuální plán, s vazbou Šablona a vybraný uložený záznam. Úkony se při otevření berou z plánu, nikoli znovu ze šablony, takže se zachovají individuální úpravy. Přepnutí režimu s daty vyžaduje stejné potvrzení jako při vytvoření; dropdown již neobsahuje Individuální plán. Uložení úpravy používá stávající id/version a zachovává historii provedených servisů; nabídka vytvoření nové šablony nadále patří jen k novému plánu. Backend, modely a API beze změn. Typecheck, lint, 67 testů a build prošly. Chromium při 1440/390 px ověřil oba počáteční režimy, uložené upravené úkony, zrušení/potvrzení přepnutí, změnu režimu po uložení a znovuotevření i zachování completions. Regresně ověřeno také přidání plánu, nabídka Ne/Ano, validace názvu, částečné selhání/retry a obnovování šablon bez reloadu.

## FE audit — dávka 6: potvrzení mazání

Společný Confirm byl zobecněn do ActionConfirmation; DeleteConfirmation/useConfirmDelete přidávají destruktivní variantu nad stávajícím Dialog. Dokumenty (detail všech vlastníků a řidičský seznam) i vozidlo již potvrzení měly, ale bylo doplněno alertdialog, jednoznačné Smazat, unikátní ARIA vazby, bezpečný fokus, návrat fokusu, backdrop/Esc/křížek, blokování dvojkliku a zavření při probíhající operaci. Neúspěch ponechá dialog s chybou. PDF náhled již nemůže přebrat fokus z potvrzení. Návraty po smazání dokumentů a původní toast zůstávají. U dokumentu je metadata záznam měkce smazán, lokální soubor je však fyzicky odstraněn, proto je zde upozornění na nevratnost; vozidlo a jeho plánovací závislosti se mažou fyzicky. Nedestruktivní Confirm pro pozastavení/obnovení řidiče zachovává původní texty a chování. Typecheck, lint a 67 testů prošly; Chromium 1440/390 px ověřil otevření bez zápisu, všechny způsoby zrušení a fokus, chybu, čekání, jediný handler po potvrzení, detail/seznam dokumentů a vozidlo. Doplňkově ověřeno mazání v rolích Řidič i Vedení a příslušné návraty.

Dávka 6 — dokončení: uložené úkony plánu/šablony, oprávnění/kvalifikace a vazby CCS karet používají stejný useConfirmDelete. Nové pracovní řádky, vybrané soubory před uploadem a dny upozornění jsou záměrně bez potvrzení. Potvrzení odebere uložený řádek pouze z formuláře; API se volá až uložením rodičovského formuláře. Plná inventura, výjimky v názvech tlačítek, nevratnost, nepřítomné samostatné akce mazání a doporučení: [fe-audit-6.md](fe-audit-6.md). Typecheck, lint, 67 testů a produkční build prošly. Chromium 1440/390 px ověřil každý nový typ odebrání včetně odlišení pracovních řádků, zrušení a nulového počtu mutací před uložením. Modely, API ani backend se neměnily.

Drobné zkrácení textů potvrzení: na přání odstraněna věta „Změna se uloží až potvrzením formuláře.“ ze všech tří sdílených popisů (úkony plánů/šablon, oprávnění/kvalifikace, vazby CCS karet). Potvrzení i ukládání beze změny. Ověřeno typecheckem, lintem, 67 testy, buildem a Chromium kontrolou odebrání uložených řádků na desktopu i mobilu.

Dávka 7 / bod 1: centrální CCS nabídka, popisky a barvy; bezpečný fallback historických hodnot, nejednoznačné párování jako neúplný podklad. Sdílený stav tankování a položka Stav již existovaly. Kompatibilní model/API ponechány. Podrobnosti a výjimky: docs/fe-audit-7.md. Typecheck, lint a související testy prošly.

Dávka 7 / bod 2: správní editor tankování má CCS stav; předvyplnění efektivním stavem a stejné sdílené volby, u řidiče pole není. Existující save/cache invalidace, bez nového datového pole. Odvozený skutečný rozdíl má přednost, nepodložený Rozdíl odmítá chyba pole. Typecheck, lint a 8 souvisejících testů prošly; viz docs/fe-audit-7.md.

Dávka 7 / bod 3: sdílená notifikace jízdy/závady, podmínky neukončené/neúplné/nesrovnalé jízdy a správních rolí. Stejný Form, outbox a Make webhook; nový minimální příkaz trip.notify bez změny datových polí. Lokální stav nepředstírá odeslání. Podrobnosti: docs/fe-audit-7.md.
Bod 3: typecheck, lint a 36 souvisejících testů prošly; kontrakty regenerovány.

Dávka 7 / bod 4: jediný StatusChip a centrální mapy všech stavových entit, shodné popisky/barvy/typografie seznamu a detailu. Doplněny položky Stav do mřížek a sjednocena přidělení v dialogu; již shodné části pouze převedeny na společnou komponentu. Trvá je nadále otevřený konec období, typ Zakázka/Jízda zůstává text. Inventura před/po a záměrně odlišné významy: docs/fe-audit-7.md.
Bod 4: typecheck, lint a 12 souvisejících testů prošly.

Dávka 7 / bod 5: společné srozumitelné názvy odvozených termínů z FE projekce, bez změny uložených dat. Platnost STK/pojištění/oprávnění/kvalifikace a hranice servisního plánu obsahují jasný účel a podmět; ruční názvy a Doplnit koncový tachometr beze změny. Kalendář má ellipsis a plný title. Hledání/řazení již sdílelo název. Podrobnosti: docs/fe-audit-7.md.
Bod 5: typecheck, lint a 25 souvisejících testů prošly. Chromium 1440/390 px ověřil CCS editaci/validaci a cache, podmínky notifikace i skrytí správních polí řidiči, shodný chip přidělení a nové názvy termínů v seznamu/kalendáři/detailu bez běhových chyb.

Dávka 7 — závěr: všech 5 bodů dokončeno v 5 samostatných commitech na feat/fe-audit-7. Typecheck (i server), lint, všech 81 testů/22 souborů, build a opakovatelná regenerace kontraktů prošly. Chromium desktop/mobil ověřil také chybu služby, jeden pokus při dvojkliku, úspěšné opakování a krátkou blokaci notifikačního tlačítka. Konečný průchod bez běhových chyb. Datové modely a závislosti beze změny; jediným rozšířením API je nutný trip.notify. Podrobná inventura a kompatibilní výjimky: docs/fe-audit-7.md.

Dávka 8: sdílený Back respektuje pevný cíl; dokumentový kontext přenesen do ověřeného URL parametru. Prokliky již používaly push. Typecheck, lint a navigační testy prošly; inventura a omezení obnovy stavu v docs/fe-audit-8-10.md.

Dávka 9: přiřazení zakázky používá společný přístupný autocomplete, jen vhodné kandidáty a žádné pomocné podřádky. Výpočet vhodnosti a payload beze změny. Typecheck, lint a 26 souvisejících testů prošly; viz docs/fe-audit-8-10.md.

Dávka 10: v detailu tankování odstraněno přimíchávání CCS dokumentů do tabulky řidiče; samotný CCS panel už vlastní dokumenty neměl. Ostatní dokumentové pohledy, data a layout zachovány. Typecheck, lint a 8 souvisejících testů prošly; viz docs/fe-audit-8-10.md.
Dávky 8–10 závěr: všech 85 testů, typecheck, lint a produkční build prošly. Chromium 1440/390 px ověřil hierarchické šipky versus browser Back, reload, dokumentový URL kontext, autocomplete včetně klávesnice a uložení i oddělení dokladů tankování. Bez běhových chyb. Backend/modely/API/závislosti nezměněny.

Dávka 11 / bod 1: sdílené otevření PDF v detailu i tabulce CCS výpisů; poslední ikonový sloupec, disabled bez dokumentu, URL návrat na seznam. Typecheck, lint a související testy prošly. Podrobnosti: docs/fe-audit-11.md.

Dávka 11 / bod 2: odstraněn DocumentList pouze z levého CCS panelu TransactionPage dle screenshotu; obě navigační cesty a správní role sdílejí tuto komponentu. Předchozí dávka tento samostatný pohled výslovně ponechávala mimo rozsah. Doklady řidiče a otevření PDF výpisu zachovány, bez změny dat/API/modelů. Viz docs/fe-audit-11.md.
Dávka 11: oba body prošly typecheckem, lintem a souvisejícími testy; celá sada 86 testů/25 souborů prošla. Chromium ověřil oba správní kontexty a obě cesty k transakci na desktopu/mobilu, disabled PDF akci, návrat po reloadu a zachování dokladů řidiče bez běhových chyb. Žádný zásah do backendu/modelů/API ani závislostí.
