# FE audit 7

## 1. CCS — hotovo

Před úpravou: seznam/detail tankování již používaly `fuelState`, položka Stav v detailu již hotovo; nabídky byly duplikované, bez centrálních metadat.

Seznam doložen v `FleetCare_zadani_oficialni_FE.md`, §5.7 (původně ř. 322). Aktuální nabídka podle této dávky: Čeká na výpis, Spárováno, Rozdíl, Chybí záznam řidiče, Neúplný podklad, Vyřešeno. Jediný zdroj FE popisků, barev a selectů/filtrů: `src/lib/status.ts`; společný `StatusChip` používají tankování i transakce. Stejný FuelTable/FuelPage slouží všem rolím.

Historický nejednoznačný stav a neznámé hodnoty se v UI zobrazí i filtrují jako Neúplný podklad. Týká se starých tankování a CCS transakcí, včetně přehledu priorit. Automatické párování při nejednoznačné shodě již ukládá Neúplný podklad, nikdy svévolně nepřiřadí kandidáta. Žádná migrace dat.

Kompatibilní výjimka z odstranění textu: starý literál zůstává výhradně v existujícím `matchStates` datovém schématu, kompatibilním čtení `match_state` v `server/sheets-store.ts` a generovaných API/event schématech. Odstranění by porušilo výslovný požadavek neměnit model/API a znemožnilo načtení starých záznamů. Není v nabídce, filtru, chipu ani nové hodnotě párování. Závazný seznam v zadání aktualizován podle této dávky.

Rozdíl se zobrazuje pouze při existující spojené transakci s nevyřešenými rozdíly. Samotná stará uložená hodnota Rozdíl bez důkazu se zobrazí jako Čeká na výpis (bez spojení) / Spárováno (se spojením). Rozhodnutí o rozdílu nemění kanonický náklad.

Kontroly: typecheck, lint a související CCS/UX testy.

## 2. Editace tankování — hotovo

Před úpravou: správní dialog neměl CCS select. Nyní Upravit údaje otevře společný editor s předvyplněným efektivním CCS stavem a nabídkou z bodu 1. Pole je pouze pro Fleet manažera a Vedení; Řidič stav již viděl v seznamu/detailu, ale neupravoval ho, proto mu nové správní pole nepřidáváme. Při založení tankování se chování nemění.

Ruční změna používá existující `FuelRecord.state` a příkaz `save`, ne nové pole. Uložená hodnota je výchozí; existující nevyřešený rozdíl spojené transakce má v UI vždy přednost. Zvolit Rozdíl bez odpovídajícího spojení/neshody editor odmítne červenou chybou pole. Ruční volba nemění stav transakce, neřeší finanční neshodu a neobchází samostatné CCS rozhodnutí. Existující invalidace workspace po `run` již hotovo; detail i tabulka čtou stejný zdroj. Bez změny API/modelu/serveru. Kontroly: typecheck, lint, 8 souvisejících testů.

## 3. Notifikace jízdy — hotovo

Před úpravou: pouze závada podporovala ruční notifikaci. Sdílené `NotifyDriverAction`, `NotifyDialog` a `NotificationRequests` nyní slouží závadě i jízdě. Bílé sekundární tlačítko se zvonečkem je první akcí hlavičky jízdy; jen pro správu a jen když jízda probíhá/nemá konec, chybí koncový tachometr, nebo počáteční tachometr není menší než koncový. Příjemce je řidič jízdy, nikoli dnešní přidělení vozidla. Výchozí zpráva odpovídá situaci.

Používá stávající Form (pending blokace a červené chyby), notifikační úložiště, stavové chipy a Make e-mailový webhook; tlačítko má po uložení dvousekundovou blokaci. Úspěch potvrzuje uložení požadavku a odkazuje na skutečný stav doručení, nikoli na domnělé odeslání. V lokálním režimu je vidět Služba není připojena; výpadky HTTP zachovají chybový dialog. Změna příjemce zůstává ve stávajícím mechanismu.

Nutný minimální zásah do API/BE: nový příkaz `trip.notify` v `src/data/contracts.ts`, `src/data/command-schema.ts`, handler v `src/domain/commands.ts`, zařazení do stávajícího odesílání v `server/sheets-gateway.ts` (včetně nalezení vozidla jízdy), regenerovaný `docs/openapi.json`. `fault.notify` vyžaduje existující závadu a termín servisu a nelze ho korektně použít pro jízdu. Modely a pole notifikací beze změny. Externí gateway mimo repozitář musí nový příkaz doplnit; skutečné doručení e-mailu bez připojené služby nelze ověřit.

## 4. Sjednocení stavů — hotovo (shodné části již hotovo)

Všechny stavové chipy používají `StatusChip`, stejnou třídu `.badge` a metadata `statusMaps` pro konkrétní entitu v `src/lib/status.ts`. Původní duplicitní `Badge` odstraněn. Existující barvy zůstávají; nepřidáváme stavy.

| Entita | Před | Po |
| --- | --- | --- |
| Tankování | Seznam/detail již stejný `fuelState`, Stav v detailu již hotovo | Společný CCS chip/metadata pro všechny role; beze změny popisků aktuální nabídky |
| CCS transakce | Raw stav, samostatný chip v detailu; řešení i bez neshody | Stejný vyhodnocený stav ve filtru/seznamu/detailu; Stav v mřížce; Rozdíl a řešení jen při spojené nevyřešené neshodě |
| Přidělení vozidla/řidiče | Oba detaily již sdílely tabulku a stejné Aktivní/Plánováno/Ukončeno | Společná funkce `assignmentState` a metadata; dialog ukazuje Stav současného přidělení, pokud existuje |
| Jízdy | Stejný popisek/barva již hotovo, chip nad mřížkou | Stejný chip, samostatná položka Stav |
| Zakázky | Stejný popisek/barva již hotovo, chip jen v hero | Sdílený chip, navíc Stav v mřížce |
| Závady | Stejný popisek/barva již hotovo, samostatný chip | Sdílený chip, Stav v mřížce |
| Termíny | Seznam/detail včetně Stav již hotovo | Pouze převod na centrální komponentu/metadata |
| Dokumenty | Seznam/detail stejné chipy souboru a extrakce již hotovo | Sdílený chip; v detailu Stav a Stav zpracování v mřížce |
| CCS výpisy | Stav zpracování v seznamu; v detailu chyběl | Shodný chip ve Stav v nové mřížce metadat výpisu |
| CCS karty | Aktivní/Neaktivní jako prostý text; editační dialog bez chipu | Sdílený chip v tabulce a Stav v dialogu; boolean otázka formuláře zůstává Ano/Ne |
| Vozidla | Hero/seznam již shodné | Sdílený chip, navíc Stav v mřížce |
| Řidiči | Hero/seznam shodné, v mřížce Stav profilu prostým textem | Sdílený chip i pod popiskem Stav v mřížce |
| Notifikace | `queued`/`failed` používaly dokumentové popisky | Samostatná mapa: Čeká na odeslání / Odeslání selhalo, dokumenty ponechávají Čeká na zpracování / Zpracování selhalo |

Záměrně nesloučeno: Trvá v datovém intervalu je otevřený konec, Aktivní je časově vyhodnocený stav; datum může být i budoucí. Zdravotní způsobilost řidiče není stav profilu. U dokumentů je uložení souboru jiný stav než extrakce, u CCS výpisů je úplnost jiná než zpracování. Stav tankování a stav transakce zůstávají dvě uložené hodnoty; zobrazení skutečné neshody má společné pravidlo důkazu. Typ Zakázka/Jízda v kombinované tabulce zůstává prostý text. Dialog přidělení nezavádí ruční stav: ukazuje stav existujícího aktuálního přidělení, nové se jako dosud odvozuje z dat od–do.

## 5. Názvy termínů — hotovo

Názvy odvozených termínů vznikají v FE funkci `deadlines()`; nyní přes společné `deadlineTitle` (`src/lib/deadline-titles.ts`). Uložené názvy, data, kategorie a API se nemění. Stejná projekce napájí dashboard, seznam, kalendář, detail a jejich navigační kontext. Hledání i řazení již používaly `d.title` — již hotovo, nyní přirozeně používají nové názvy.

| Existující odvozený typ | Nový název |
| --- | --- |
| STK vozidla / STK dokumentu | Platnost STK – [SPZ] |
| Pojištění dokumentu | Platnost pojištění – [SPZ] |
| Řidičské oprávnění | Platnost řidičského oprávnění [kategorie] – [jméno] |
| Kvalifikace | Platnost kvalifikace [název] – [jméno] |
| Časová/km hranice položky servisního plánu | Servisní plán: [název úkonu] – [SPZ] |

U servisních hranic zůstává konkrétní název úkonu (např. Výměna oleje), aby různé položky nesplynuly do nerozlišitelných prohlídek. Termín Servisní plán už aplikace používá. Při chybějícím vozidle zůstává název úkonu bez domýšlené SPZ; u dokumentu je zachován existující fallback na název dokumentu. Lékařskou platnost dosavadní generátor termínů nevytváří, proto nový typ nepřidáváme.

Výjimky beze změny: vlastní ručně pojmenované termíny a Doplnit koncový tachometr. Kalendář má jednořádkové ellipsis a `title` s celým názvem. Žádné přejmenování dat ani změna zdrojových dokladů.

## Závěrečné ověření

- Typecheck včetně serveru, lint: prošly po každém bodu a nad celým výsledkem.
- Celá sada: 22 souborů, 81 testů, vše prošlo. Produkční build prošel; stávající upozornění na velikost chunků zůstává.
- Regenerace OpenAPI/event kontraktů je opakovatelná bez dalšího diffu.
- Chromium / Playwright, 1440 × 900 a 390 × 900: skutečné uložení CCS stavu a obnovení seznamu, původní hodnota v selectu, šest voleb, červené pole a zpráva pro nepodložený Rozdíl, fallback historického stavu; podmínky notifikace všech tří problémových jízd a skrytí pro řádnou jízdu/řidiče; správný příjemce a situační zpráva; simulované selhání zápisu zachovává dialog a chybu, dvojklik spustí jen jednu probíhající operaci, následné opakování uloží jediný požadavek; dvousekundová blokace tlačítka; po uložení skutečný lokální stav Služba není připojena. Shodný chip přidělení v obou detailech a dialogu. Nový název termínu v seznamu, hledání, kalendáři s ellipsis/title a titulku detailu. Bez běhových chyb v konečném průchodu. Prohlížeč používá izolovaná fiktivní data v dočasném profilu.
- Datové modely, dependency manifest/lockfile a trvalá provozní data nezměněny. Mimo nový příkaz notifikace zůstává API stejné. Sdílené párování CCS nyní vrací Neúplný podklad místo rušeného nejednoznačného stavu; nejde o změnu schématu. Načítání starých dat je zachováno.
- Omezení: skutečné odeslání e-mailu přes Make bez připojené služby neověřeno. Externí API musí podporovat nový příkaz `trip.notify`. Tato dávka nepublikuje demo ani nezasahuje do větve main.
