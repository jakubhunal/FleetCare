# Předání integračnímu týmu

## Co je hotové

FE, role a cesty, lokální IndexedDB adaptér s přílohami, doménové příkazy a validace, přiřazování, jízdy, závady/outbox, náklady/CCS, termíny/plány, reporty a PDF/XLSX. HTTP klient je implementovaný a testovaný proti izolovanému serveru. Konkrétní payloady jsou v OpenAPI a runtime schématech. Není připojená ostrá služba a není implementované skutečné přihlášení.

## Doporučená varianta Supabase

1. Vytvořit projekt ve vhodném bezplatném tarifu a předem ověřit aktuální kvóty, pozastavení a zálohování. Pro vztahová a současně měněná data doporučujeme tuto variantu.
2. Převést každou kolekci z data-model.md na tabulku. Oprávnění, zastávky, položky plánů, provedení a vazby karet lze normalizovat do samostatných tabulek s FK. Všechny tabulky mají UUID PK, version, timestamps a zdroj. Přidat unikátní indexy SPZ/VIN/importní IDs, FK bez nežádoucího kaskádového mazání a indexy časových překryvů.
3. Soubory uložit do soukromého Storage. DB obsahuje storageKey/hash/metadata; nikdy Blob/base64 ani dlouhodobou podepsanou URL. U driver dokumentu rozlišit znepřístupnění, retenční pravidlo a fyzické odstranění. Po smazání odmítnout další čtení; případné dříve vydané podpisy mít krátce platné.
4. Implementovat gateway podle openapi.json. Doménové zápisy, verzi, opětovné vyhodnocení konfliktu, audit a outbox uložit v jedné transakci. Přímý Supabase adaptér je možný později, ale nemá měnit komponenty ani rušit doménová pravidla.
5. Připojit ověřenou identitu a RLS/Storage policies. Řidič získá jen vlastní osobní dokumenty, zakázky a provozní podklady. U zakázky má dodací list, nikoli původní objednávku obsahující cenu; u vozidla STK/pojištění, nikoli servisní faktury. Cenová/firmní data z driver DTO vynechat. Manažer nesmí reportový endpoint/export. Vedení může reporty. Kontrola nesmí důvěřovat role/driverId z FE.
6. Klíče s privilegii patří pouze na server. Ve FE nepoužít service-role/secret klíč. Veřejný publishable klíč neprokazuje identitu.

## Realizovatelná varianta Sheets + Drive

Vytvořit listy přesně podle kolekcí tabulky v data-model.md: vehicles, drivers, assignments, readings, orders, trips, faults, services, templates, plans, fuels, cards, statements, transactions, expenses, deadlines, documents, notifications, events; samostatný list settings (jeden záznam). Základní sloupce každého listu: id, version, createdAt, updatedAt, source a všechny uvedené doménové sloupce. Typy sloupců jsou v JSON Schema komponentách OpenAPI. Žádné lokálně formátované měnové texty nebo české datumové řetězce.

Vnořená pole lze pro první gateway uchovávat jako validovaný JSON: drivers.licences/qualifications, orders.stops/equipment/qualifications, templates.items, plans.items/completions, cards.bindings a events.payload. Druhá možnost jsou podřízené listy s vlastním id a parentId; gateway musí zachovat stejný DTO tvar. Pro analytiku doporučujeme podřízené listy, ne ruční rozdělování seznamu čárkou.

Dokumenty ukládat jako soukromé Drive soubory; documents.storageKey = stabilní identifikátor, nikoli veřejný odkaz. Přenos/čtení souboru musí ověřovat gateway. Service-account JSON, OAuth refresh token ani oprávněné Sheets API nejsou v klientu. Apps Script může být gateway pouze při vyřešené autentizaci, CORS, kvótách a oprávněních; veřejná URL není zabezpečení.

Sheets nemá relační transakce a unikátní FK. FE i Make proto zapisují pouze přes stejnou bránu, která serializuje příkazy, kontroluje verze/idempotenci a vede journal před/po. Více listů aktualizovat dávkou; po přerušení transakční journal idempotentně dokončit. Bez toho nelze tvrdit shodu s atomickým přiřazením a outboxem. Žádná identifikace řádku pořadovým číslem. Při 429 respektovat Retry-After a použít omezený backoff, u zápisů stejný idempotentní klíč. Cache snapshotu podle identity/kontextu/verze a dávkové čtení zabraňují mnoha requestům při každém kliknutí.

## Make / OCR a oprávnění

- Implementovat všechny toky z integrations.md, podepsané callbacky, deduplikaci eventId a messageId/přílohy/hash a ochranu ručních oprav pomocí expectedVersion/fieldVersions.
- Připojit skutečné schránky manažera a servisů; šablony musí správně rozlišit hlášení řidičem a manažerem. U nepřiděleného auta přeskočit příjemce řidiče.
- Nastavit kontakty, servisní šablony, tolerance CCS a termínové prahy podle potvrzené firemní politiky. FE nemá technické intervaly ani firemní kontakty předvyplněné.
- Ověřit extrakci na reálných formátech STK/ŘP/účtenek/objednávek/CCS. Změřit správnost kritických polí a podíl dokončených případů, ne jen modelové confidence. Osobní doklady neposílat do nezabezpečeného review prostředí.
- Obsloužit vyčerpanou kvótu, failed/incomplete a obnovu úlohy bez ztráty originálu. Odhad servisu se nepřevádí na skutečný náklad.
- Naplánovat denní A6 podle skutečného ukončení + 72 h a deduplikovat událost. V prohlížeči se plán nepředstírá.

## Postup zapojení a akceptační testy

1. Spustit gateway s testovací identitou a daty; nastavit local `.env.local`: VITE_DATA_ADAPTER=http a vlastní VITE_API_BASE_URL. Restartovat Vite.
2. Ověřit API chybové stavy proti FE. Vypnutý backend musí ukázat chybu bez lokálního fallbacku. Provést upload/preview i po vypršení prvního přístupového podpisu.
3. Dva souběžní uživatelé přiřadí stejné auto do překryvu: jedna operace uspěje, druhá vrátí 409. Opakování stejného idempotentního příkazu nezaloží další případ/e-mail.
4. Vyzkoušet přímé neoprávněné API čtení cizího dokumentu, ceny zakázky a reportového exportu; backend je musí odmítnout bez ohledu na upravený FE header.
5. Opakovat stejný e-mail a stejné CCS PDF, pozdní callback po ruční opravě, chybějící kontakt a částečnou chybu e-mailů. Prověřit jediný kanonický náklad a správnou auditní stopu.
6. Porovnat PDF/XLSX se všemi filtrovanými zdroji, včetně více stránek a neúplných km. Měřit velikost `/workspace` a dobu sestavení. Při výrazném růstu zavést verzované serverové projekce podle architecture.md.
7. Teprve po bezpečnostním a integračním ověření nasadit reálná osobní data. Reálné přihlášení, služby, monitoring backendu, retenční politika a zálohy jsou konkrétní zbývající práce kolegů.
