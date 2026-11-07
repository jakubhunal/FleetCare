# FleetCare FE — potvrzení mazání (dávka 6)

## Inventura a výsledek

Prohledány texty Smazat/Odstranit/Odebrat/Vymazat, ikony koše, `delete`/`remove`/`clear`/`splice`, filtrování editačních seznamů a příkazová/HTTP vrstva. Existující veřejné mutace pro skutečné smazání jsou `document.delete` a `vehicle.delete`. Nové akce ani endpointy nebyly přidány.

| Místo | Původní stav | Výsledek |
| --- | --- | --- |
| Detail dokumentu vozidla | Potvrzení existovalo | Rozšířeno na společné přístupné potvrzení; po úspěchu stále Dokumenty příslušného vozidla |
| Detail dokumentu řidiče | Potvrzení existovalo | Totéž; zachován kontextový návrat, pro Řidiče přímý návrat na Moje dokumenty |
| Moje dokumenty → detail (Řidič) | Potvrzení existovalo | Totéž, zachována kontrola vlastnictví |
| Detail dokumentu zakázky | Potvrzení existovalo | Totéž; návrat zachován |
| Detail dokumentu výdaje | Potvrzení existovalo | Totéž; návrat zachován |
| Detail dokladu tankování | Potvrzení existovalo | Totéž; návrat zachován |
| Detail podkladu závady/servisu | Potvrzení existovalo | Totéž; návrat zachován |
| Detail dokumentu CCS výpisu/transakce | Potvrzení existovalo | Totéž; návrat zachován |
| Detail STK pro založení vozidla (`intake`) | Potvrzení existovalo | Totéž; návrat na Vozidla zachován |
| Koš v seznamu dokumentů řidiče, včetně Moje dokumenty | Potvrzení existovalo | Společné potvrzení; po úspěchu zůstává seznam |
| Detail vozidla → Smazat vozidlo | Potvrzení existovalo | Společné potvrzení včetně názvu/SPZ a dosavadního vysvětlení závislostí; návrat na Vozidla zachován |
| Uložený úkon při úpravě servisního plánu | Bez potvrzení | Nově společné Odebrat úkon? s názvem; Zrušit zachová řádek |
| Uložený úkon při úpravě servisní šablony | Bez potvrzení | Totéž |
| Uložené oprávnění řidiče | Bez potvrzení | Nově společné Odebrat oprávnění? s názvem |
| Uložená kvalifikace řidiče | Bez potvrzení | Nově společné Odebrat kvalifikaci? s názvem |
| Uložená časová vazba CCS karty na vozidlo | Bez potvrzení | Nově společné Odebrat vazbu? s číslem karty a SPZ |

Původní potvrzení dokumentů a vozidla bránila okamžitému smazání, ale nesplňovala celý nový požadavek (role alertdialog, bezpečný fokus, klik mimo a jednotný popisek tlačítka). Proto jsou označena jako rozšířená, nikoli jako kompletně „již hotovo“. Všechna nalezená relevantní místa jsou po úpravě hotová.

## Místa bez samostatné akce smazání

Aplikace nenabízí samostatné smazání celého servisního plánu, šablony, termínu, CCS karty, externího servisu/kontaktu, výdaje, tankování, závady, zakázky, jízdy ani řidiče. Zde nebylo co obalovat potvrzením; nepřidávalo se nové mazání. Odebrání uložených řádků těchto formulářů je pokryto výše. Smazání vozidla zahrnuje jeho plánovací závislosti v jedné již existující akci a jednom potvrzení. Samostatné hromadné mazání nebylo nalezeno.

## Záměrně vynecháno

- Nově přidaný, dosud neuložený úkon plánu/šablony, oprávnění/kvalifikace nebo vazba karty: jde pouze o pracovní řádek. Uložení ještě neproběhlo a potvrzení není potřeba. Rozlišení uložených a nových řádků zůstává správné i po jejich úpravě nebo odebrání jiného řádku.
- Odebrání vybraného souboru v `FilePicker` před uploadem: nemaže se soubor z úložiště.
- Odebrání řádku „Dny před termínem“ v Nastavení: jde o úpravu rozpracovaného formuláře; výslovná výjimka zadání.
- Vymazání hledaného textu, parametrů filtrování/stránkování, odstranění event listenerů, cache React Query, odhlášení a expirace serverové idempotency cache: technický stav, nikoli mazání provozního záznamu.
- Filtrování již smazaných/historických záznamů v seznamech samo nic nemaže.

## Sdílené řešení, texty a přístupnost

Dosavadní `Confirm` byl zobecněn do společného `ActionConfirmation`. Dosavadní nedestruktivní `Confirm` ho dál používá se svými původními texty/chováním; destruktivní `DeleteConfirmation` a `useConfirmDelete` používají tutéž implementaci. Hook umožňuje potvrzení nad rozpracovaným editorem bez nahrazení a ztráty jeho stavu.

Destruktivní dialog má `alertdialog`, unikátní `aria-labelledby`/`aria-describedby`, výchozí fokus Zrušit, návrat fokusu na spouštěč a zrušení křížkem, Esc nebo klikem mimo. Nevolá handler před potvrzením. Reference na probíhající operaci brání dvojímu spuštění i před aktualizací React stavu. Během operace je potvrzení v průběhu a zavření zakázáno, aby zůstalo otevřené do dokončení. Chyba se zobrazí červeně a umožní opakování. Stávající toast a následná navigace se neměnily. Ošetřeno i přebrání fokusu vloženým PDF prohlížečem v Chromium.

Výjimky v názvech tlačítek:

- Skutečné smazání dokumentu/vozidla: **Smazat**.
- Odebrání uloženého úkonu/oprávnění/kvalifikace/vazby: **Odebrat**, stejně jako původní akce. Dialog uvádí, že změna se uloží až potvrzením rodičovského formuláře. Před tím lze editor zahodit; neuvádí se nepravdivé tvrzení o nevratnosti.
- V průběhu destruktivní operace: **Probíhá…**.

Nevratnost dokumentů: příkaz označí metadata dokumentu `deletedAt`, ale lokální repository zároveň fyzicky odstraní obsah souboru z tabulky `files` a nemá akci obnovy. Proto se u dokumentů zobrazuje upozornění na nevratnost. Vozidlo a jeho plánovací záznamy se odstraňují fyzicky, upozornění platí i zde.

## Akce, které nejsou mazání

Pozastavit/Obnovit řidiče již má vlastní potvrzení a nebylo funkčně změněno. Zahodit neuložené změny a přepnutí režimu plánu s rozpracovanými úkony mají vlastní potvrzení a zůstaly zachované. Ukončení/změna přidělení je samostatný formulář s výslovným uložením, nikoli smazání; další potvrzení nebylo přidáno. Ostatní stavové akce (potvrzení/uzavření jízdy, změny stavů zakázky či závady) nebyly měněny. Doporučení k případnému samostatnému UX posouzení: ukončování a změny stavů, pokud má produkt požadovat ještě další potvrzení nad jejich současným formulářem/akcí.

## Ověření a limity

Typecheck včetně serveru, lint a všech 67 stávajících testů prošly po logických skupinách. Závěrečný build a testy jsou součástí předání. Bez nových knihoven a beze změn backendu, datových modelů nebo API.

Skutečné Chromium/Playwright, izolovaná syntetická data, šířky 1440/390 px:

- Otevření potvrzení bez volání mutace; obsah názvu položky, role a ARIA vazby, bezpečný fokus.
- Zrušit, Esc, křížek i backdrop bez smazání; opakované otevření a návrat fokusu.
- Simulované čekání, nemožnost zavřít během mazání a jediný handler přes opakované kliknutí.
- Simulovaná chyba: otevřený dialog a červené chybové hlášení; následné úspěšné smazání a správná navigace.
- Dokument v detailu i seznamu, vozidlo; navíc dokumentové mazání v rolích Řidič a Vedení vedle Fleet manažera. Úspěšné smazání vozidla potvrzeno také počtem volání a zmizením záznamu.
- Každý nově pokrytý typ uloženého řádku: plán, šablona, oprávnění, kvalifikace, vazba CCS. Klik ani potvrzení řádku nevolají API před uložením rodičovského formuláře. Zrušení zachová řádek; Odebrat odstraní pouze po potvrzení.
- Každý odpovídající nově přidaný pracovní řádek se odebere bez potvrzení.

Externí HTTP/Sheets služba nebyla k dispozici pro integrační test; potvrzení je před sdílenou mutací, tedy společné pro lokální i HTTP adaptér. Nebylo prováděno nasazení veřejného dema.

## Commity

- `b9dc754` — `feat(ui): unify accessible confirmations for destructive actions`
- Následující commit obsahuje potvrzení odebrání uložených řádků a tento report; jeho hash a výsledek pushe jsou v předání úkolu.
