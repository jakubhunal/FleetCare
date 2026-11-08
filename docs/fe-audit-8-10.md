# Dávky 8–10

## A — hotovo

Příčina: Back přepisoval pevný `to` z `location.state.returnTo`, který tabulky přidávají pro kontext. Nešlo o history.back (žádný výskyt). Nyní společný Back vykresluje skutečný Link pouze na předaný pevný cíl. Původní umístění i popisky zachovány.

| Umístění | Před | Po |
| --- | --- | --- |
| VehiclePage | returnTo nebo /vehicles | /vehicles |
| DriverPage | returnTo nebo /drivers | /drivers |
| OrderPage | returnTo nebo /orders (/my/orders) | /orders (/my/orders pro řidiče) |
| TripPage | returnTo nebo /trips (/my/trips) | /trips (/my/trips) |
| FaultPage | returnTo nebo /faults (/my/requests) | /faults (/my/requests) |
| DeadlinePage | returnTo nebo /deadlines | /deadlines |
| FuelPage | returnTo nebo /costs/fuel (/my/fuel) | /costs/fuel (/my/fuel) |
| StatementPage | returnTo nebo /costs/statements | /costs/statements |
| TransactionPage | returnTo nebo /statements/:id | /statements/:id |
| ExpensePage | returnTo nebo /costs/expenses | /costs/expenses |
| DocumentPage | návrat z location.state nebo vlastník | ověřený parametr from v URL nebo vlastník |

Dokumenty: DocumentLink a proklik sdílené tabulky předávají zdrojovou cestu i query v URL. Bez kontextu je cílem detail vlastníka (vozidlo/řidič → Dokumenty, ostatní jejich detail, intake → Vozidla). Nepovolené/external/self adresy se nepoužijí. Název cíle se odvozuje z cesty a dostupné entity, nikoli z pomíjivého returnLabel.

Prokliky tabulek a odkazy mezi entitami již používaly push — již hotovo. Tabs používá Link/push (jedna položka na změnu záložky), filtry/sort/stránkování používají replace aktuálního query, aby nezaplnily historii. Další replace: main.tsx přihlášení/odhlášení/změna role a redirect řidiče; documents.tsx odchod po úspěšném smazání; reports.tsx a useHistory změny filtrů. Žádný entity drill-down nepoužívá replace.

Přes aplikační šipku se zachování filtrů/stránky nově neimplementuje. Browser Back uchovává URL záložky a query filtrů/stránky; textové hledání je lokální stav tabulky a jeho obnovení po remountu není zaručené. Aplikace nemá vlastní správu scroll restoration, takže ani scroll nelze garantovat. Toto chování není rozšiřováno.

Typecheck, lint a navigační testy prošly.

## B1/B2 — hotovo

Nový sdílený Autocomplete (původně neexistoval), pro SPZ a jméno. Bez podřádků a chipu vhodnosti; žádný nositel informace nezmizel, neboť se nyní nabízí pouze výsledek Vhodné. Nevhodné i Nelze vyhodnotit se nezobrazují. Výpočet suitability, příkaz order.assign a payload nezměněny. Vymazání/změna vozidla zruší volbu řidiče. Původní tlačítko zůstává disabled, dokud není vybrána vhodná dvojice.

SPZ: prefix bez mezer/velikosti písmen, bez rozšíření na model. Řidič: začátky slov bez diakritiky. Prázdný výsledek Nic nenalezeno; klik, šipky, Enter, Esc a Tab; combobox/listbox ARIA a minimálně 14 px. Další vhodná místa pro pozdější využití: přidělení řidiče vozidlu a selecty vozidla/řidiče v editorech. Ty nebyly měněny. Typecheck, lint a 26 souvisejících testů prošly.

## C1 — hotovo, vlastní CCS panel již hotovo

FuelPage / Srovnání s CCS již nemělo vlastní DocumentList, tlačítko, historii ani prázdný dokumentový stav. Spodní společný DocumentList ovšem přibíral dokumenty výpisů přes relatedOwners. Odstraněno pouze toto přimíchání a jeho mapování. Dokumenty fuel zůstávají se všemi akcemi; transakční částka, rozdíl, stav a proklik zůstávají nezměněné. Rozložení a oddělovače nezměněny, žádná prázdná sekce nevznikla.

Další výskyty zachovány: TransactionPage má dokumenty vlastníka statement na CCS straně a dokumenty fuel na straně řidiče; StatementPage nabízí původní PDF přes DocumentLink. Jde o samostatné pohledy, nikoli sdílenou část FuelPage. U role Řidič již relatedOwners bylo prázdné — již hotovo. Sdílené DocumentList/useUpload a datové vazby se nemažou; po odstranění nezbyl nepoužitý import/hook. Typecheck, lint a 8 souvisejících testů prošly.

## Závěrečné ověření

Typecheck včetně serveru, lint, všech 85 testů / 24 souborů a produkční build prošly. Build pouze upozorňuje na velikost chunků jako dosud. Chromium/Playwright 1440 × 900 a 390 × 900: detail řidiče → proklik zakázky → browser Back obnoví detail řidiče; aplikační šipka vede na Zakázky; pevné cíle a reload detailů; autocomplete SPZ/jména, prefix bez diakritiky, Nic nenalezeno, šipky/Enter a úspěšné uložení; tankování obsahuje účtenku a ne dokument výpisu; dokument má from v URL a po reloadu správný návrat; tankování bez transakce se vykreslí. Konečný průchod bez pageerror. Fiktivní data pouze v dočasném profilu prohlížeče. Backend, modely, API, manifesty a lockfile beze změny.
