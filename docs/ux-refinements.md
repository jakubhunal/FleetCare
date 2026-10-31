# UX/FE úpravy — 29. 10. 2026

Pracovní větev: `codex/ux-refinements`, základ `main` na `8601803`. Každý bod A1–C9 má vlastní commit a push; dodatečná ověření a opravy jsou v dalších samostatných commitech. Změny zatím nejsou sloučené do `main` ani publikované do dema.

## Přehled implementace

| Bod | Výsledek | Hlavní soubory |
| --- | --- | --- |
| A1 | Přiřazení zakázky v dialogu, radio výběr pouze vhodných kandidátů, potvrzení a ochrana rozepsaných změn. Samostatná stránka přiřazení odstraněna. | `operations.tsx`, `main.tsx` |
| A2 | Jednosloupcový detail tankování: souhrn, srovnání CCS, jedna společná tabulka dokumentů. Jedna akce pro nevyřešené rozdíly; shodné podklady ji nezobrazují. | `costs.tsx`, `documents.tsx` |
| A3 | Typ Pojištění v uploadu a filtrování. Sdílený detail dokumentu umožňuje náhled, úpravu metadat, potvrzené smazání a stažení. | `documents.tsx`, dokumentové příkazy |
| A4 | Tabulka úkonů s intervaly a posledním/dalším provedením, malá tužka v řádku. Výběr šablony pouze v editoru plánu. | `fleet.tsx`, `editors.tsx` |
| A5 | Segmented control Seznam/Kalendář a historie vpravo u tabulky. Řádek otevírá detail termínu; úprava je až v něm. Přidání termínu má plus. | `overview.tsx`, `main.tsx`, `ui.tsx` |
| A6 | Tabulky přidělení pro vozidlo i řidiče, období/stav/km, historie přes switch a červené ukončení. Tabulka zakázek/jízd zachovává chip typu a filtry typu i stavu. | `fleet.tsx`, `tables.tsx` |
| A7 | Sdílená validace povinných a číselných polí, červené rámečky a konkrétní zprávy s `aria-invalid`/`aria-describedby`. Opakované servisní intervaly, období exportu i soubory mají chyby u příslušných polí. HTTP chyby polí se neztrácejí. | `ui.tsx`, `editors.tsx`, `reports.tsx`, `http.ts` |
| A8 | Příloha přímo při založení výdaje, validace před uložením a opakování selhaného uploadu bez druhého výdaje. | `editors.tsx`, `ui.tsx` |
| A9 | Globální tokeny: základ 16 px, malé texty nejméně 14 px včetně mobilu. | `global.css` |
| B1 | Společný toolbar: hledání vlevo, akce a skutečné switche historie vpravo. Používají ho dokumenty, přidělení, závady, termíny a seznamy vozidel/řidičů/nákladů. | `ui.tsx`, `tables.tsx`, příslušné stránky |
| B2 | Stejný dropdown `ChoiceButton` pro přidání vozidla a tankování, s chevronem a zavřením přes Escape/kliknutí mimo. | `ui.tsx`, `vehicle-intake.tsx`, `costs.tsx` |
| B3 | Sdílený `FilePicker`: aplikační tlačítko, drag & drop, seznam souborů a volitelná kamera. Použit v dokumentech, STK, účtenkách a příloze výdaje. | `ui.tsx`, `documents.tsx`, `fuel-intake.tsx` |
| B4 | Detail CCS má jednu tabulku transakcí a jasné tlačítko Zobrazit výpis (PDF). | `costs.tsx` |
| B5 | Přehled nákladů je první a výchozí záložka. | `costs.tsx` |
| B6 | Hlavička výdaje obsahuje bílé Upravit s tužkou. | `costs.tsx` |
| B7 | Nové Kontakty pro jeden externí servis a běžná tabulka CCS karet. Ostatní nastavení nezměněno mimo výslovně požadované odstranění informačních bannerů C1. | `settings.tsx` |
| B8 | Změnit příjemce otevírá editor e-mailu, notifikace má zvoneček a úprava závady je bílá s tužkou. | `operations.tsx`, příkaz `notification.recipient` |
| B9 | Rychlé akce jsou hned pod nadpisem Přehledu. | `overview.tsx` |
| B10 | Toasty nahoře uprostřed, s odpovídajícím příchodem a podporou omezených animací. | `global.css` |
| B11 | Moje úkoly v tabulce, pumpa u tankování, akce u řidičových tabulek v jejich toolbarech. Podmínky zahájení jízdy zachovány. | `driver-tasks.tsx`, `overview.tsx`, `layout.tsx` |
| C1 | Odstraněny uvedené čistě informační bannery. Chyby a připomínka doplnění tachometru s odkazem zůstávají. | příslušné stránky |
| C2 | Odstraněn eyebrow Pracovní prostor ze sdílené hlavičky. | `ui.tsx` |
| C3 | Odstraněna patička aplikace. | `layout.tsx` |
| C4 | Destruktivní akce, koše a potvrzení ukončení přidělení mají červenou variantu. | `editors.tsx`, `fleet.tsx`, `ui.tsx` |
| C5 | Červené hvězdičky přes sdílené formulářové komponenty. | `ui.tsx`, `global.css` |
| C6 | Požadované kratší texty úprav a Stáhnout v exportu. | `operations.tsx`, `fleet.tsx`, `reports.tsx` |
| C7 | Text záložek se při hoveru nepodtrhává. | `global.css` |
| C8 | Vedení má Reporty před posledním Nastavením. | `layout.tsx` |
| C9 | Sekundární úpravy a globální hledání jsou bílé; zelená tlačítka označují primární akce. | sdílená tlačítka a stránky |

## Rozhodnutí a kompatibilita

- V dostupných souborech nebyl použitelný samostatný prototyp detailu tankování; použit požadovaný jednosloupcový návrh bez nové knihovny.
- Rozdíl tankování se vyhodnocuje podle částky, měny, litrů, času a doložené vazby karty/vozidla. Již vyřešená transakce znovu nenabízí řešení. Při více rozdílech zůstává jedno vstupní tlačítko a transakce se vybírá v dialogu. Nespojené podklady zůstávají dostupné přes detail transakce.
- Tabulka servisního plánu má řádky jednotlivých úkonů jednoho individuálního plánu vozidla. Tužka otevírá editor tohoto plánu. Volba šablony mění pouze rozepsaný formulář; databáze se mění až po potvrzení.
- Odvozené termíny mají vlastní detail, ale jejich změna vede přes zdrojový záznam; nevytváří se druhý ruční termín. Opraveny byly odkazy na odstraněné záložky vozidla a řidiče.
- Dokumentu se upravuje název, platnost a splatnost. Originální obsah ani uložený hash se při editaci nemění. Manažer může spravovat dokumenty všech typů; řidič mění a maže pouze vlastní osobní dokumenty, ostatní dostupné dokumenty může zobrazit/stáhnout.
- Kontakty zobrazují první existující externí servis a umožňují jej upravit, případně založit první. Pokud starší data obsahují více servisů, ostatní záznamy a historické vazby se nemažou. Nevznikla migrace ani nová globální konfigurace preferovaného servisu.
- Účtenka přiložená k výdaji se ukládá jako existující typ Příloha. Zápis výdaje a upload jsou dvě operace: při selhání uploadu formulář umožňuje opakování bez duplicitního výdaje. Tento případ byl výslovně otestován.
- Podmínka zahájení jízdy u řidiče zůstává otevřeným produktovým rozhodnutím a nebyla změněna.
- Rychlé akce a Komunikační požadavky zachovány. Sdílené funkce z minulé iterace nebyly dále odstraňovány: upload STK je dostupný ve způsobu přidání a dokumentech, účtenky přes dropdown a řidičův prostor, metodika zůstává v samostatných Reportech. Datová oprávnění a servisní/API příkazy zůstávají pro kompatibilitu.

## Nutné změny příkazů a oprávnění

Beze změny schématu uložených entit, migrací, závislostí a lockfilu. Server Google Sheets nebyl upravován.

- Nový `document.update`: `id`, `version`, `name`, `validUntil`, `dueAt`. Lokální executor kontroluje verzi, smazaný stav a vlastnictví osobního dokumentu řidiče.
- Existující `document.delete` nově dovoluje manažerům smazat i jiné než osobní dokumenty. Řidičovo oprávnění zůstává omezené na jeho osobní dokumenty.
- Nový `notification.recipient`: `id`, `version`, `email`. Pouze manažerské role, platný e-mail, kontrola verze. Odeslané/odesílané požadavky nelze změnit. Změna nevydává e-mail za odeslaný; stav zůstává `not_configured`.
- HTTP adaptér zachovává již smluvně podporované `fieldErrors` z odpovědi gateway a formuláře je mapují na pole. Rozšířen pouze chybový objekt `DomainError`, nikoli model uložených dat.
- Aktualizovaný `docs/openapi.json` je generovaný ze schémat. Pro HTTP režim musí cílový backend implementovat oba nové příkazy a odpovídající oprávnění; samotné FE je do externího backendu nepřenáší.

## Ověření

Na finálním aplikačním commitu `7fffcfc`:

- Typecheck a lint prošly po každém implementačním commitu.
- Všech **43 testů v 11 souborech** prošlo. Nové testy pokrývají změnu metadat a ochranu originálu, vlastnictví a mazání dokumentů, verze, změnu příjemce a přenos HTTP chyb jednotlivých polí.
- Produkční build, regenerace kontraktů bez rozdílu a `scripts/check-clean-build.mjs` prošly. Zůstává existující upozornění Vite na velikost chunků.
- Chromium 1440 px a 390 px: dotčené stránky, tabulky bez vodorovného přetékání celé stránky, základní font 16 px, navigace Vedení a řidičovy úkoly. Široké tabulky mají vlastní posuv. Prázdný stav tabulky byl upraven tak, aby se na mobilu nemusel vodorovně posouvat.
- Dialog přiřazení: filtr vhodných kandidátů, uložení, reload a zachování URL detailu.
- Tankování: shodná data bez akce, rozdílná s jednou akcí a uložení řešení.
- Dokumenty: upload a filtrování pojištění, metadata po reloadu, potvrzené smazání. Originální příloha výdaje i CCS PDF byly skutečně staženy a porovnány bajt po bajtu.
- Plán: konkrétní chyby obou intervalů, uložení po opravě a výběr šablony v editoru. Termín: detail, editace, reload a přepnutí kalendáře.
- Formuláře: souběžné chyby více číselných a povinných polí, vazby `aria-describedby`, mobilní opakované úkony bez přetékání dialogu. Export označuje oba chybné konce období.
- Selhání uploadu přílohy bylo v izolovaném prohlížeči úmyslně vyvoláno v IndexedDB; opakování vytvořilo právě jeden výdaj a jednu přílohu. Chybějící/neplatná účtenka nevytvořila tankování a zobrazila chybu u pickeru. Toast po uložení byl ověřen nahoře uprostřed.
- Produkční preview: přímé SPA cesty, skutečné založení vozidla, reload a detail, výchozí nákladový přehled a skutečné stažení XLSX z produkčních dynamických chunků.

Testy používají výhradně izolovaná fiktivní data. Ostrý HTTP backend, Google Sheets, OCR, e-maily, Make a veřejné Pages nebyly připojovány ani ověřovány. Mobilní kontrola použila rozměry telefonu v Chromium, nikoli fyzické zařízení. Produkční nasazení a začlenění do main jsou další krok.
