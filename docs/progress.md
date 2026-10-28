# FleetCare — průběh

## Dokončeno
- Přečteno závazné zadání; rozebrán původní kód, obrazovky a mobilní UI řidiče.
- Původní prototyp zachován v commitu a tagu `prototype-reference`.
- Ověřeny obě dodané kopie: žádný GitHub remote. Dotaz na cílovou URL odeslán; lokální práce pokračuje.

## Etapy
1. React / strict TypeScript / Vite, doménové modely, IndexedDB, HTTP port, role a sdílené UI.
2. Evidence vozidel a řidičů, vazby, skutečné přílohy a servisní plány.
3. Zakázky, jízdy, závady, náklady, termíny, reporty a exporty.
4. Testy pravidel a HTTP, spuštění a desktop/tablet/mobil QA, dokumentace předání, čistý commit.
5. Až potom samostatná demo větev se seedem a izolovanou DB.

## Kontroly a další krok
- Referenční aplikace skutečně spuštěna a otevřena v prohlížeči.
- První funkční průchod všech hlavních oblastí je implementovaný. React + strict TypeScript, doménové validace, lokální transakce, role, CRUD povolených záznamů, skutečné soubory, exportní knihovny.
- Kontroly: produkční build a lint prošly; 19 doménových / IndexedDB testů prošlo.
- Spuštěno na 127.0.0.1:5173. Desktop prázdného dashboardu vizuálně ověřen; v izolovaném prohlížeči ručně vytvořeno QA vozidlo, ověřena desetinná čárka.
- Remote potvrzen: https://github.com/jakubhunal/FleetCare. Push `main` a `prototype-reference` uspěl.
- Dokončeno: HTTP kontraktní testy, konzistence a asynchronní stavy, vlastní jízda, skutečný upload/náhled/smazání, desktop/tablet/mobil, PDF a XLSX včetně kontroly vykreslení a typů buněk.
- Aktuální kontroly: 31 testů prošlo, typecheck/lint/build prošly. API chyby 409/429 a síťová chyba ověřeny bez lokálního fallbacku. Technické předání v docs/ je hotové.
- Čistý samostatný klon a instalace z lockfile prošly, včetně 31 testů, buildu, lintu, typechecku, kontroly bundlu a smluv beze změny.
- Následuje: čistý tag a push, teprve potom izolovaná demo větev a její vizuální kontrola.
- Žádná ostrá služba není připojena. Čistý tag `fe-clean-v1` byl pushnut před založením demo větve.
- V demo větvi: izolovaný seed a namespace, 32 testů prošlo. Vizuálně ověřeno přiřazení rezervy, CCS rozhodnutí, reporty a mobilní řidič. Podrobnosti v docs/demo-review.md.
