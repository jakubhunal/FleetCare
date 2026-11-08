# Dávka 11

## 1 — hotovo

Před úpravou měla tabulka CCS výpisů pouze proklik řádku; PDF odkaz byl jen v detailu. Nový poslední sloupec bez hlavičky používá sdílený StatementPdfLink s existujícím DocumentLink, FileText ikonou a stejnou stránkou `/documents/:id` jako detail. Detail i tabulka sdílejí také filtr nesmazaných dokumentů vlastníka statement. Nová implementace náhledu/stažení nevzniká. DocumentLink vloží návratovou cestu do URL: z tabulky na seznam CCS výpisů, i po reloadu. Odkaz zastavuje propagaci; funguje klávesnice i standardní otevření odkazu v novém panelu. Bez dokumentu je disabled s title Soubor není k dispozici.

Detail dříve nabízel všechny nesmazané dokumenty, neoznačoval jeden jako hlavní. Zachováno: detail nabízí všechny ve stejném pořadí; tabulka otevírá první z nich. Žádná nová definice historických verzí. Akce by se mohla hodit v jiných tabulkách s přílohou, například u výdajů; ty se nemění. Typecheck, lint a související testy prošly.

## 2 — hotovo

Screenshot identifikuje `TransactionPage` na `/transactions/:id`, levý Panel CCS transakce. Předchozí dávka 10 se omezovala na FuelPage a podle tehdejšího výslovného pokynu ponechávala samostatný TransactionPage mimo rozsah. Nešlo o jinou roli nebo parametr téže části: jde o jinou stránkovou komponentu. Nyní odstraněn její DocumentList s ownerType statement včetně celé jeho tabulky, hledání, historie a prázdného stavu. Žádný nový oddělovač či mezera.

Inventura: FuelPage / Srovnání s CCS již nemá dokumentovou část; jeho DocumentList vlastníka fuel zůstává. TransactionPage / CCS transakce nyní nemá dokumenty; TransactionPage / Záznam řidiče si ponechává dokumenty fuel a odkaz Otevřít tankování. StatementPage nadále nabízí původní PDF přes sdílený odkaz z bodu 1. Další CCS dokumentová část nenalezena. Všechny cesty i správní role používají jediný TransactionPage. Samostatný DocumentList nebyl sdílený CCS wrapper, takže odstraněn pouze jeho call-site; import DocumentList zůstává potřebný pro doklady řidiče a výdaje. Žádné nepoužité hooky, překlady či dotazy nezbyly. Data, vztahy, API, modely a údaje transakce nezměněny.

## Ověření

Po každém bodu prošel typecheck včetně serveru, lint a související testy. Závěrečná sada: 86 testů / 25 souborů, vše prošlo. Chromium/Playwright pro Fleet manažera i Vedení, desktop 1440 a mobil 390 px: otevření dokumentové stránky přímo z řádku bez návštěvy detailu výpisu, disabled bez souboru, správný návrat na seznam po reloadu; zachovaný PDF odkaz v detailu výpisu; vstup k transakci přes výpis i tankování bez dokumentové sekce na CCS straně, zachovaná tabulka na straně řidiče; nespárovaná transakce bez dokumentů se vykreslí. Konečné průchody bez běhových chyb. Data prohlížeče jsou izolovaná fiktivní. Kontrola obsahové správnosti PDF nebyla předmětem změny; používá se stávající náhled dokumentu.
Produkční build prošel; pouze dosavadní upozornění na velikost chunků.
