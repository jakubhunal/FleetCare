# Google Sheets gateway na VPS

Gateway v `server/sheets-gateway.mjs` je záměrně samostatný Node proces. Google service-account klíč zůstává na VPS; frontend zná pouze URL gateway. Gateway pro tuto první verzi používá Google Sheets REST API a existující tabulku `FleetCare DB`.

## Mapování současné tabulky

| List | Mapování do FleetCare |
|---|---|
| `vehicles` (`vehicle_id`, `spz`, `brand_model`, `type`, `year`, `vin`, `purpose`, `reserve`, `driver_id`, `odometer_km`, `state`) | Přímo na vozidlo; `brand_model` → model, `type` → kategorie, `odometer_km` → tachometr. |
| `drivers` (`driver_id`, `name`, `phone`, `email`, `state`, `licence`, `licence_valid_until`, `vehicle_id`) | Oprávnění jsou v jedné buňce oddělená čárkou; jedna společná platnost. `vehicle_id` je aktuální přiřazení. |
| `deadlines` (`deadline_id`, `vehicle_id`, `deadline_type`, `valid_until`, `state`) | Datumová připomínka vozidla; název záznamu se ukládá do `deadline_type`. |
| `trips` (`trip_id`, `vehicle_id`, `driver_id`, `order_number`, `start_at`, `actual_end_at`, `from`, `to`, `odometer_start`, `odometer_end`, `km`, `state`, `source`) | Přímé mapování; `km` se při změně koncového tachometru dopočítá. |
| `fuel` (`fuel_id`, `vehicle_id`, `driver_id`, `date`, `litres`, `amount_czk`, `ccs_amount_czk`, `full_tank`, `station`, `match_state`) | Částky CZK se převádějí na/z haléřů; stav párování jde do `match_state`. |
| `settings` (`key`, `value`, `note`) | `manager_email` → e-mail manažera; `a5_levels_days` → dny upozornění. Obě hodnoty se ukládají do existujících řádků. |

Zápisy do existujících sloupců podporují editaci/přidání vozidel a řidičů, termínů a tankování, zahájení jízdy, potvrzení jízdy, přepnutí řidiče, přiřazení vozidla a nastavení manažera/upozornění. Nové řádky dostanou stabilní UUID. Aktualizace mění pouze mapované buňky a zachová ostatní buňky řádku. U ostatních akcí vrátí gateway HTTP 501/422; listy `documents`, `reports`, `errors`, zakázky a další kolekce zatím nejsou provozní evidencí. `file_ref` není přenositelný obsah souboru, proto uploady ani náhledy dokumentů nefungují.

Verze pro konflikt se počítá z aktuálních buněk řádku a kontroluje se při zápisu. Příkazy v jednom běžícím procesu jsou serializované a `Idempotency-Key` je držen 24 hodin v paměti. Pro školní prototyp spusťte jednu instanci gateway; více instancí, restart uprostřed požadavku a ruční souběžné úpravy v Sheets nemají transakční garanci. Workspace cache trvá 30 sekund. Mapování respektuje existující záhlaví a neukládá do tabulky doménové sloupce, které tam nejsou; například historie přiřazení, lékařské údaje, náklady mimo tankování a soubory se proto touto verzí nezapisují.

## Nastavení procesu na VPS

1. V Google Cloud projektu zapnout **Google Sheets API** a vytvořit service account. Vygenerovat JSON klíč a uložit ho na VPS mimo checkout repozitáře, například `/etc/fleetcare/google-service-account.json`; soubor omezit na čtení uživatelem gateway procesu.
2. Sdílet cílovou tabulku s hodnotou `client_email` ze service-account JSON jako **Editor**, protože aplikace zapisuje do buněk. ID tabulky je už ve sdíleném odkazu: `1x9KHpZiofd-2VK1T_LwJ1wRYnW9btzYn9nS6uwHnBPQ`.
3. Spustit gateway proces s proměnnými:

   ```dotenv
   PORT=8787
   GOOGLE_SHEET_ID=1x9KHpZiofd-2VK1T_LwJ1wRYnW9btzYn9nS6uwHnBPQ
   GOOGLE_APPLICATION_CREDENTIALS=/etc/fleetcare/google-service-account.json
   CORS_ORIGIN=https://adresa-frontendu.example
   ```

   V repozitáři není potřeba instalovat další balíček; používá se vestavěný Node.js HTTP server a `fetch`. Bez Dockeru proces standardně poslouchá na `127.0.0.1`; v Docker síti poslouchá na `0.0.0.0` uvnitř kontejneru. Reverse proxy přepošle `/api/v1/*` na gateway `/v1/*` (tedy odstraní prefix `/api`) a frontend servíruje na stejném originu, nebo nastaví přesnou hodnotu `CORS_ORIGIN`.
4. Frontend sestavit s `VITE_DATA_ADAPTER=http` a `VITE_API_BASE_URL=https://adresa-frontendu.example/api/v1`. Tyto proměnné jsou součástí veřejného buildu; nesmějí obsahovat klíč ani token. Změna `VITE_*` vyžaduje nový frontend build.
5. Ověřit `GET /health`, potom `/api/v1/workspace` a v prohlížeči načtení vozidel/řidičů. Google API chyby gateway vypisuje do procesu logu; health endpoint ověřuje jen proces, ne přístup ke Sheets.

Tato změna připravuje čtecí i zapisovací prototyp; nevytváří Google Cloud projekt/service account, nepovoluje API, nesdílí tabulku, nenasazuje VPS ani neinstaluje klíč. Školní tabulka zůstává beze změny — gateway používá její současné záhlaví a při chybějícím sloupci odmítne zápis. Pro další části FleetCare bude třeba rozšířit tabulku o odpovídající listy a případně samostatné úložiště souborů.
