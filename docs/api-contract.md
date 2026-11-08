# HTTP smlouva

Strojově čitelná část: [openapi.json](openapi.json). Doménové příkazy: `src/data/contracts.ts` a runtime `src/data/command-schema.ts`. DTO: `src/domain/models.ts`. `npm run contracts` regeneruje OpenAPI a JSON Schema událostí ze stejných runtime schémat.

Základ URL nastaví `VITE_API_BASE_URL`, např. vlastní gateway s prefixem `/v1`. Do FE patří jen veřejná URL. `credentials: include` připravuje session cookie; před skutečným provozem doplnit ověřenou identitu, HttpOnly/Secure/SameSite, CSRF ochranu a povolené CORS origins. Header `X-Actor-Context` je `encodeURIComponent(JSON.stringify({role,driverId}))`, pouze výběr kontextu. Server jej nikdy nesmí přijmout jako autentizaci.

| Volání klienta | Endpoint a výsledek                                                                                                                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| read           | GET /workspace → Workspace. Konzistentní seznamy i detaily dostupných entit bez Blob. Obsah musí být úplný pro deklarovaný provozní rozsah; jinak vraťte přiznanou chybu rozsahu, ne zkrácený seznam. |
| identities     | GET /actor-options → [{id,name}] dostupných řidičských kontextů                                                                                                                                       |
| search         | POST /search {query} → [{id,type,title,subtitle,path}]; hledání přes celou povolenou evidenci, bezpečné vnitřní cesty                                                                                 |
| execute        | POST /commands + Idempotency-Key → 204 až po dokončené transakci; typ příkazu v JSON                                                                                                                  |
| upload         | POST /uploads → {uploadId}; PUT /uploads/:id/content s binárním tělem; POST /uploads/:id/complete → 202/200 {jobId,state,missingFields?,error?}                                                       |
| job            | GET /jobs/:id → skutečný stav; queued/processing/completed/incomplete/failed/not_configured                                                                                                           |
| file           | GET /documents/:id/content → oprávněný PDF/JPEG/PNG stream; žádná trvale uložená expirovaná URL                                                                                                       |

`save` nese collection, data, u změny id a očekávanou version. Povolené kolekce: vehicles, drivers, orders (pouze existující importovaný záznam), trips (pouze existující záznam), faults, fuels, expenses (pouze nový výdaj/korekce), deadlines, templates, plans, services, cards. Žádný obecný delete entit. Kompletní entitu server validuje stejným schématem po spojení s původními daty.

Samostatné příkazy: `driver.toggle`, `vehicle.assign`, `order.assign`, `trip.start`, `trip.transition`, `plan.apply`, `plan.complete`, `fault.notify`, `notification.retry`, `ccs.reconcile`, `ccs.resolve`, `document.delete`, `document.link` a `settings`. Formáty v OpenAPI jsou závazné. Příklad:

```json
{
  "type": "order.assign",
  "id": "order-uuid",
  "version": 3,
  "vehicleId": "vehicle-uuid",
  "driverId": "driver-uuid"
}
```

Server před zápisem opakuje kontrolu dostupnosti a oprávnění uvnitř transakce. Překryv / změněná version → 409. Neznámá kapacita není splněný požadavek. Součástí jedné transakce je změna, audit a outbox. Nové idempotentní klíče server váže na ověřenou identitu, operaci a hash payloadu; opakování stejného klíče s jiným payloadem musí vrátit 409. Nemá se podruhé založit závada, náklad, dokument ani e-mail.

## Projekce, filtry a exporty

Současný kontrakt používá úplnou kontextovou projekci `/workspace`, cachovanou v klientu. UI řadí, filtruje a stránkuje po 10 řádcích; všechny exporty pracují s celým filtrovaným výběrem. Rozsah reportu tvoří from/to, vehicleId, category, currency a costType. Kniha jízd dále driverId, více vozidel a výběr sloupců. Změny parametrů mění souhrny i tabulky. Text globálního hledání se posílá v POST těle, ne jako osobní údaj v URL.

Gateway pro Sheets má načíst potřebné listy dávkově, vytvořit indexy a udržovat inkrementální snapshot. Pro další růst historie přidat v nové verzi portu explicitní query/detail/report/export projekce se serverovým stránkováním; současné FE nesmí dostat první stránku místo úplného snapshotu. Nejde o uživatelskou sekci nastavení integrací.

## Upload a soukromé soubory

Vstup obsahuje ownerType/ownerId, volitelné vehicleId, povolený typ, platnost/splatnost a `{name,mime,size}`. Intake STK má ownerType `intake`, ownerId `new`; po úspěchu vznikne nebo se naváže vozidlo. Existující STK používá ownerType `vehicle` a konkrétní ID. Dodací list jen owner order, osobní dokumenty jen driver a typ Řidičský průkaz / Pracovní smlouva. Řidič smí vlastní dokumenty, vlastní tankování a vlastní zakázku. Výdaj má ownerType expense. CCS ruční upload vytvoří výpis až při dokončeném uložení.

Idempotency-Key jednotlivých souborů má stabilní příponu `-index`, `-content`, `-complete`. Klient automaticky neopakuje zápisy po chybě. Uživatel může zopakovat stejnou rozpracovanou operaci se stejným klíčem. Upload session musí jít obnovit. Server kontroluje MIME, signaturu, velikost, vlastnictví, kvótu, hash a obsah; nesmí servírovat HTML/SVG jako dokument. Limit běžné přílohy je 20 MB a 10 souborů, extrakční cesty nejvýše 5 MB na soubor.

## Chyby a asynchronní zpracování

Chyba má `{code?,message,fieldErrors?,correlationId?}`. Použité stavy: 401, 403, 404, 409, 413, 415, 422, 429 (Retry-After), 503. Klient má 20 s timeout, podporuje AbortSignal a po chybě nikdy nečte IndexedDB jako náhradní API výsledek. API DTO se validuje Zodem za běhu; neplatné DTO je chyba, ne prázdná evidence.

OCR neběží uvnitř dlouhého formulářového requestu. Dokončení uploadu vrací identitu úlohy; metadata dokumentu obsahují jobId a perzistentní stav. FE používá omezený backoff při otevřeném detailu a nabízí obnovení. Callback běží Make → backend i po zavření prohlížeče. Původní ruční opravu chrání expectedVersion / fieldVersions; starý callback nesmí přepsat novější hodnotu. Duplicitní e-mail identifikovat messageId + attachmentId/hash, nikoli názvem souboru nebo SPZ.

## Automaticky ověřeno

Izolovaný Node HTTP server v `tests/http.test.ts` ověřuje read, identity, search, commands/idempotency header, upload/content/complete, jobs, content, chybná DTO, 409, 429, síťovou chybu a omezení řidiče. Není to připojená ostrá DB. V prostředí Codex může test lokálního síťového spojení vyžadovat síťové oprávnění sandboxu.

### Připomenutí údajů jízdy

Příkaz `trip.notify` (`id`, `email`, `message`) je určen správě (Fleet manažer/Vedení). Je povolen jen u neukončené/neúplné jízdy nebo nesrovnalosti tachometru. Vytváří stejný záznam `notifications` jako `fault.notify`: příjemcem je řidič jízdy, `aggregateId` je ID jízdy, `serviceAt` je null. Stávající Make e-mailová brána doručí požadavek, pokud je nastavená. Lokální režim zachová `not_configured`; nejde o důkaz odeslání. Bez nových polí a nového kanálu; externí implementace API musí tento nový příkaz podporovat.
