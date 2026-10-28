# Ukázková kontrola

Tato větev vznikla z pushnutého `fe-clean-v1` (78d2dbb). Demo změna obsahuje pouze konfigurační vynucení lokálního adaptéru, samostatný seed, jeho test a tento záznam. Hlavní FE je sdílený s main.

Databáze `fleetcare-demo-review-v1`, marker `demo-seed-v1`. První start vytvoří 4 vozidla, 3 řidiče, 4 zakázky, 3 jízdy, závady, CCS situace a jednoznačně fiktivní PDF podklady. Žádný skutečný OCR ani e-mail se nespouští. Všechny osoby/kontakty/částky a výsledky zpracování jsou ukázkové. Připojení API je v této větvi vynuceně vypnuté.

Testy: 35 prošlo po synchronizaci s čistým FE včetně opakovaného seedu a zachování uživatelské úpravy. Typecheck, lint a produkční build prošly. V prohlížeči byl skutečně proveden výběr rezervního DAF a samostatně Evy Testovací pro zakázku DEMO-2026-001; uložení zůstalo po reloadu. CCS rozdíl DEMO-TX-82 byl vyřešen s důvodem a částkou 4 000 Kč, zachoval se originál 4 050 Kč i vazba na účtenku. Report po změně konce období změnil podklady paliva, spotřebu a předběžné náklady. Telefon 390 px: zelená karta řidiče, dotykové akce a nulové vodorovné přetékání.

Tyto QA změny jsou pouze v izolovaném kontrolním prohlížeči; zdrojový seed zachovává původní případy pro první spuštění zadavatele. Návrat k původní sadě je explicitní odstranění pouze této demo DB v DevTools. Čisté DB `fleetcare-clean-v1` se nedotýkat.

Opravy objevené při review se provedou nejprve v main a následně přenesou mergem main → codex/demo-review. Demo seed se nikdy neslučuje do main.

Společný finální základ: main / fe-clean-v1.2. Dodatečně ověřeno předvyplněné přiřazení po reloadu, nezávislé filtry zakázek a jízd a čtyři hlavní mobilní akce. Finální produkční pohled bez chyb v konzoli.

