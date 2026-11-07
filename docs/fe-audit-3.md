# FleetCare FE — dávka 3

Větev: `work` (aktuální větev zachována podle zadání). Remote: `UnsweetenedLemonade/FleetCare`; odkazy na `jakubhunal` v původních instrukcích nebyly použity pro změnu remote. Zadání obsahovalo A1–A8 a B1–B4, žádné body C/D.

## Výsledek po bodech

| Bod | Stav | Před změnou a výsledek |
| --- | --- | --- |
| A1 | Hotovo | Upload i úprava dokumentu zobrazovaly obě data. Sdílená mapa nyní volí právě jedno pole podle existujícího typu. STK používá „Platnost STK do“. Nový dokument má skryté datum prázdné; při úpravě se původní skryté datum zachová. |
| A2 | Hotovo | SPZ, model, kategorie a stav již byly povinné; VIN a STK nebyly. Při ručním založení je nyní povinných všech šest polí. Používá se původní `stkUntil`, sdílené hvězdičky a červené chyby `Form`. Stavový select již existoval. |
| A3 | Hotovo | Formát VIN se kontroloval při každém uložení, i při nezměněné hodnotě z importu. Nově se formát i unikátnost kontrolují při vytvoření nebo skutečné změně VIN. Původní hodnota se nenormalizuje. Regresní testy i prohlížeč ověřily změnu pouze STK. |
| A4 | Hotovo | Kvalifikace byly i v přidání řidiče. V přidání se již nezobrazují ani neodesílají. Oprávnění a úprava existujících kvalifikací zůstaly zachované. |
| A5 | Hotovo | Pole nedostupnosti odstraněno ze sdíleného editoru závady; editor tuto hodnotu neodesílá. Původní hodnota a její zobrazení „Provozní nedostupnost“ v detailu zůstávají. |
| A6 | Hotovo | Přidání termínu již neobsahuje odpovědnou osobu. Existující schéma vyžaduje neprázdnou hodnotu, proto se posílá dosavadní výchozí „Fleet manažer“. |
| A7 | Hotovo | Ruční termín otevíral celý editor, odvozené termíny odkazovaly na zdroj. „Upravit termín“ nyní otevírá pouze datum, případně existující km hranici. Změna se uloží do původního zdrojového záznamu a detail se obnoví bez navigace. „Vyřešit“ u chybějícího tachometru zůstává. |
| A8 | Hotovo | Průběžná přísná kontrola ve formulářích chyběla. Jedna funkce `odometerErrors` se používá přes sdílený `Form` při úpravě/ukončení jízdy i doplnění tachometru. Rovnost nebo nižší konečný stav zobrazí červenou chybu u `endKm` a zabrání uložení. Zahájení jízdy koncový stav neobsahuje, není tedy co porovnávat. |
| B1 | Hotovo | Na kartě vozidla tlačítko chybělo. Primární „Nahlásit závadu“ s plus otevírá existující dialog přes stávající `defaults`, vozidlo je předvyplněné a editovatelné. Dialog ponechá uživatele v původním detailu vozidla. |
| B2 | Již hotovo | Žádné zadané pole nechybělo ani se chybně nemapovalo: popis je nadpis, detail obsahuje vozidlo, okamžik hlášení, kategorii, naléhavost, tachometr, stav, servis, interval od–do, opravu a skutečnou cenu v měně. Zobrazuje i integrační odhad, jeho původ a přijetí. Čas už používá Europe/Prague. Ověřeno v prohlížeči pro letní i zimní čas bez posunu; aplikace zde nebyla změněna. |
| B3 | Hotovo | Všechny čtyři původní implementace měnily řádky správně, ale žádná neresetovala stránku. Nyní používají společný `useHistory`/`historyRows` a reset odpovídajícího parametru stránky. Řádky, počty i stránkování vycházejí ze stejných dat; poloha a vzhled přepínačů beze změny. |
| B4 | Hotovo | Požadovaný popisek byl přítomen v seznamu termínů a byl odstraněn. Varianta s jinou pomlčkou nebyla nalezena. Text „Odvozený termín se upravuje ve zdrojovém záznamu.“ v detailu zůstal zachovaný. |

## Příčina VIN

Kontrola unikátnosti již před opravou správně obsahovala `x.id !== v.id`; vozidlo nebylo duplicitou samo sobě. Regulární výraz již dovoloval malá písmena, ale nepovoloval mezery ani nestandardní délku původních importovaných hodnot. Editor VIN neztrácel a nijak jej neupravoval, ale odesílal jej znovu mezi editovanými poli. Lokální příkaz `save` následně bezpodmínečně kontroloval formát celého výsledného záznamu. Proto selhala i změna pouhého STK u existujícího nestandardního VIN. Testy reprodukují tuto cestu s celým formulářovým payloadem. Nejde o plošné uvolnění formátu: změněné neplatné i duplicitní VIN se nadále odmítají. Konkrétní původní testerův záznam nebyl k dispozici; příčina je ověřena reprodukcí tohoto mechanismu v kódu.

## Mapování data dokumentu a další rozhodnutí

- STK → `validUntil`, „Platnost STK do“.
- Pojištění, Řidičský průkaz, Pracovní smlouva → `validUntil`, „Platnost do“.
- Účtenka, CCS výpis, Servisní doklad, Objednávka → `dueAt`, „Splatnost“. Servisní doklad a objednávka jsou nejednoznačné; zvolena splatnost jako u finančního podkladu. Existující typ faktury není v modelu.
- Příloha a Dodací list → volitelné `validUntil`, „Platnost do“. Nemají jednoznačnou finanční povahu; nezaváděl se nový typ ani povinné datum.
- U závady použit požadovaný sjednocený název „Nahlásit závadu“.
- Dialog termínu zapisuje datum přímo do ručního termínu, STK vozidla, dokumentu, platnosti oprávnění/kvalifikace nebo položky servisního plánu. Kilometrový plán nabízí jeho km hranici; odvozený úkol tachometru si ponechává původní „Vyřešit“.

## Inventura přepínačů historie

Každý níže uvedený výskyt před změnou filtroval aktuální/aktuální + historické správně; společná vada byla ponechané stránkování. Po změně všechny používají stejný mechanismus a reset na stránku 1. Přepínače bez smysluplné definice historie nebyly nalezeny; nové přepínače se nepřidávaly.

| Tabulka / výskyt | Existující definice historického záznamu | Před → po |
| --- | --- | --- |
| Dokumenty vozidla | Uplynulé `validUntil`; smazané jsou vždy vyloučené | Filtr funkční, bez resetu → společný filtr + reset |
| Dokumenty řidiče | Totéž | Totéž |
| Moje dokumenty (Řidič) | Totéž, nad oprávněným výběrem dokumentů | Totéž |
| Dokumenty zakázky | Totéž | Totéž |
| Podklady závady / servisu | Totéž | Totéž |
| Dokumenty tankování včetně souvisejících CCS podkladů | Totéž | Totéž |
| Dokumenty CCS transakce (vlastník statement) | Totéž | Totéž |
| Dokumenty připojeného tankování v detailu CCS transakce | Totéž | Totéž |
| Dokumenty výdaje | Totéž | Totéž |
| Přidělení vozidla | Ukončené `to <= nyní` | Totéž |
| Přidělení řidiče | Totéž | Totéž |
| Servis a závady (hlavní seznam) | Stav `Uzavřena` | Totéž |
| Termíny a upozornění (seznam i kalendář) | Stav `Splněno` podle stávající projekce | Totéž |

Splatnost sama o sobě dokument nearchivuje. Zachována stávající definice historie; žádný nový význam „historický“ nebyl zaveden. Další použití FaultTable v detailu vozidla a řidičském přehledu přepínač nemělo a nedostalo ho.

## Rozsah a ověření

Bez nových knihoven, bez změn datových schémat, API smluv, HTTP adaptéru nebo serveru. Jediná změna doménových pravidel je nutná oprava podmínky VIN v lokálním `applyCommand`; backendová validace tachometrů nebyla změněna.

Po každém implementovaném bodu proběhly typecheck, lint a všechny existující testy (postupně 51 až 61). Závěrečný stav: 16 testových souborů, 61 úspěšných testů; typecheck, lint a produkční build úspěšné. Build nadále upozorňuje na existující velké chunky.

Chromium/Playwright, izolované kontexty s fiktivními daty, desktop 1440 px i mobil 390 px:

- Povinná pole vozidla, červené chyby, zachování původního VIN po změně STK.
- Absence kvalifikací při přidání řidiče a nedostupnosti při úpravě závady.
- Hlášení závady z vozidla, editovatelný předvýběr, skutečné uložení a zachování původní stránky.
- Časy závady a servisního intervalu před a po uložení v letním i zimním pražském čase.
- Založení termínu bez odpovědné osoby, ruční a odvozené STK termíny v malém dialogu bez navigace.
- Doplnění tachometru i řidičské ukončení jízdy: průběžná chyba při rovnosti, blokování uložení, odstranění chyby po zadání vyšší hodnoty.
- Přepínání historie, změny počtu a reset parametrů stránky u dokumentů vozidla/řidiče/zakázky, obou přidělení, hlavního seznamu závad a termínů. Ostatní dokumentové výskyty používají tutéž otestovanou komponentu.
- Dokumentový upload a editace: jedno datum, přepnutí typu, uložení správného data a prázdné skryté hodnoty.

Externí Sheets/HTTP služba ani veřejné demo nebyly cílem a nebyly nasazovány. Push směřuje na aktuální `work`, nikoli do demo větve.

## Implementační commity

| Bod | Commit | Zpráva |
| --- | --- | --- |
| A1 | `3dcbc3b` | `fix(documents): show one date field per document type` |
| A2 | `a1696b0` | `fix(vehicles): require VIN and STK for manual creation` |
| A3 | `0ee98bf` | `fix(vehicles): validate VIN only when changed` |
| A4 | `2426f3c` | `fix(drivers): omit qualifications during creation` |
| A5 | `8d52a8b` | `fix(defects): remove unavailability control from editor` |
| A6 | `14d08ad` | `fix(deadlines): omit responsible person from creation` |
| A7 | `7d25260` | `fix(deadlines): edit source dates in a focused dialog` |
| A8 | `cbfa747` | `fix(trips): validate odometer ranges inline across dialogs` |
| B1 | `5fa8396` | `feat(defects): report defects from the vehicle tab` |
| B2 | — | Již hotovo, bez změny |
| B3 | `1ea971a` | `refactor(tables): unify history filtering and reset pagination` |
| B4 | `ea5fc6d` | `fix(deadlines): remove derived-source caption from list` |

Výsledek pushe a hash závěrečného reportovacího commitu jsou uvedeny v předání úkolu.
