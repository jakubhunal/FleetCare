# FleetCare — stav předání

- Přidání vozidla sjednoceno: tlačítko s chevronem otevře volbu ručního zadání nebo uploadu STK. Stejná volba platí v přehledu i při prvním vozidle; STK existujícího vozidla zůstává v jeho detailu.

- Úprava navigace podle připomínky: odstraněna karta pracovního prostoru, nadpis sekce a spodní provozní štítek/slogan/verze. Změna společná pro main i demo, včetně mobilního menu. Výsledky kontrol a nasazení sledovat v příslušném commitu/Actions.

- GitHub Pages běží na https://jakubhunal.github.io/FleetCare/. Ověřen celý automatický řetězec main → CI → merge/push dema → kontroly → Pages. HTTP version.json se shodoval s HEAD demo větve. Novější push spouští další ověřené nasazení; chyba ponechá poslední funkční verzi.
- Pages QA: desktop 1440 px a mobil 390 px, vyhledání vozidla, reload přímého hash detailu, mobilní navigace a přesun klávesnice k obsahu bez ztráty URL. Jízda 100 500 → 100 510 km byla uložena, zachována po reloadu a ukončena. PDF i XLSX skutečně staženy; XLSX znovu otevřen. Konzole bez chyb, mobil bez vodorovného overflow. Podrobnosti a odkazy na úspěšné Actions jsou v docs/verification.md.
- Pravidla pro kolegy a agenty: CONTRIBUTING.md a AGENTS.md; dokončené celky musí být ověřené, commitnuté a pushnuté. Provoz publikování popisuje docs/deployment.md.

- GitHub: https://github.com/jakubhunal/FleetCare. Čistá větev main; oddělená codex/demo-review. Původní prototyp je v prototype-reference.
- Hotový FE: evidence, role, vazby, validace, IndexedDB a Blob, dokumenty, jízdy, servis, CCS, termíny/plány, reporty, PDF/XLSX a implementovaný HTTP klient. Dokumentace předání je v docs/.
- Čistý základ fe-clean-v1 byl ověřen a pushnut před založením demo větve. Společné opravy vznikly nejprve v main a jsou přenášeny do demo větve. Seed není v main ani jeho buildu.
- Main: 34 testů; demo má navíc test idempotentního seedu (35 celkem). Typecheck, lint a produkční build jsou součástí ověřování. Instalace z lockfile byla samostatně ověřena v čistém klonu.
- UI ověřeno na desktopu/tabletu/mobilu: prázdný start, perzistence vozidla/řidiče/přidělení, vlastní jízda, skutečné soubory a smazání, hledání, klávesnice, PDF rendering a XLSX typy. Demo: přiřazení rezervy, CCS rozhodnutí, reportové filtry, čtyři hlavní mobilní akce a oddělené filtry tabulek. Konzole kontrolovaných produkčních pohledů bez chyb.
- Poslední oprava: české kalendářní datum pro období; jízdy přes měsíční hranici se bez přesného rozdělení km nezahrnují do jmenovatele. Zakázka je časově zařazená jedinou poslední objednanou zastávkou.
- Další krok zadavatele: připomínky k demo větvi podle docs/review-workflow.md. Vzhled není označen za schválený bez jeho vyjádření.
- Další krok kolegů: DB/gateway, ověřená identita a oprávnění, soukromé soubory, Make/OCR/e-maily a integrační akceptace podle docs/backend-handover.md. Žádná ostrá služba není předstíraná.
