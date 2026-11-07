# Google Sheets gateway na VPS

## Verze 2 (7. 11. 2026): stejná logika jako lokální režim

Gateway (`server/sheets-gateway.ts`) už nemá vlastní ruční mapování. Každý příkaz projde stejnou doménovou logikou jako lokální režim (`applyCommand` v `src/domain/commands.ts`), takže validace (tachometr, přidělení, plány, CCS karty, zakázky…) platí i při přímém volání API. Postup: načíst všechny listy → `applyCommand` → zapsat změněné záznamy.

- **Úložiště**: každý list má sloupec `fc_json` s celým záznamem (všechna pole formulářů se vrátí beze ztráty). Čitelné sloupce (spz, valid_until, state…) se při každém zápisu dopočítají, takže je dál čte Make (A5/A6, report) i člověk. Řádky bez `fc_json` (seed, zápisy z Make) se čtou z čitelných sloupců a na JSON se převedou při první změně. Ruční úprava čitelného sloupce u řádku s `fc_json` se v aplikaci neprojeví.
- **Listy**: chybějící listy a sloupce gateway založí při startu (`readings`, `ccs_statements`, `ccs_transactions`, `service_templates`, `notifications` a sloupce `fc_json` aj. na konci existujících listů; pořadí existujících sloupců se nemění). Zakázky, výdaje, servis, plány a CCS karty používají listy `orders`, `other_expenses`, `external_services`, `service_plans`, `ccs_cards`.
- **Časy**: API vrací všechny časy v UTC (`…Z`), protože FE je porovnává jako text. Čitelné sloupce v tabulce jsou v pražském čase s posunem (`2026-11-07T10:00:00+01:00`), data bez posunu (`2026-11-07`).
- **Dokumenty**: `POST /v1/uploads` → `PUT /v1/uploads/:id/content` → `POST /v1/uploads/:id/complete`, náhled `GET /v1/documents/:id/content`. Soubory jsou na disku gateway (`DATA_DIR`, v Dockeru volume `gateway_data:/data`), záznam v listu `documents`. Doklady z e-mailu (Make) mají odkaz na Drive ve `file_ref`.
- **E-mail** („Notifikovat řidiče“, opakování, změna příjemce): gateway pošle `POST MAIL_WEBHOOK_URL` s obálkou `{contract_version, operation: "fc_email_send", idempotency_key, run_id, payload: {to, subject, body, html, notification_id, original_to}}`, hlavička `x-fc-key` = `MAIL_WEBHOOK_KEY` (volitelné). Make (Sheets Gateway, větev „E-mail · odeslat“) odešle Gmailem a vrátí `{ok: true}`. Výsledek (`sent` / `failed` + důvod) se uloží k notifikaci. Adresy `@example.test` se posílají na `settings.test_email_override`.
- **Smazání vozidla**: příkaz `vehicle.delete` (`{type, id, version}`). Vozidlo s jízdami, tankováním, výdaji, závadami, CCS transakcemi nebo zakázkami smazat nelze (hláška doporučí stav Odstaveno). Jinak se smaže i s termíny, plánem, přiděleními a stavy tachometru, vazby karet se odeberou, dokumenty se označí jako smazané.
- **Limity**: Sheets API povoluje 60 čtení a 60 zápisů za minutu; gateway čte max. jednou za 15 s, po zápisu odpovídá z uloženého stavu a při 429 to zkusí znovu. Jedna instance, příkazy serializované. Role uživatele se dál bere z hlavičky `X-Actor-Context` (školní prototyp, bez session).

### Nasazení verze 2

```sh
cd /opt/fleetcare/app && git pull
# do .env.docker doplnit (URL webhooku Sheets Gateway v Make):
#   MAIL_WEBHOOK_URL=https://hook.eu1.make.com/...
sudo docker compose --env-file .env.docker up --build -d
sudo docker compose logs gateway --tail 20   # „Doplněny listy/sloupce: …“ při prvním startu
curl -s https://<domena>/api/v1/health
```

Ověření celého řetězce (zakládá data označená TEST): `FC_API=https://<domena>/api/v1 npx vite-node scripts/gateway-e2e.ts`; s `GOOGLE_ACCESS_TOKEN` a `GOOGLE_SHEET_ID` kontroluje i řádky v tabulce. Testovací data pro ruční testy: `scripts/seed-test-data.ts`.

## Verze 1 (původní popis)

Gateway v `server/sheets-gateway.mjs` je záměrně samostatný Node proces. Google service-account klíč zůstává na VPS; frontend zná pouze URL gateway. Gateway pro tuto první verzi používá Google Sheets REST API a existující tabulku `FleetCare DB`.

## Mapování současné tabulky

| List                                                                                                                                                                 | Mapování do FleetCare                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vehicles` (`vehicle_id`, `spz`, `brand_model`, `type`, `year`, `vin`, `purpose`, `reserve`, `driver_id`, `odometer_km`, `state`)                                    | Přímo na vozidlo; `brand_model` → model, `type` → kategorie, `odometer_km` → tachometr.                                                                                                                                                       |
| `drivers` (`driver_id`, `name`, `phone`, `email`, `state`, `licence`, `licence_valid_until`, `vehicle_id`)                                                           | Oprávnění jsou v jedné buňce oddělená čárkou; jedna společná platnost. `vehicle_id` je aktuální přiřazení.                                                                                                                                    |
| `deadlines` (`deadline_id`, `vehicle_id`, `deadline_type`, `valid_until`, `state`)                                                                                   | Datumová připomínka vozidla; název záznamu se ukládá do `deadline_type`.                                                                                                                                                                      |
| `trips` (`trip_id`, `vehicle_id`, `driver_id`, `order_number`, `start_at`, `actual_end_at`, `from`, `to`, `odometer_start`, `odometer_end`, `km`, `state`, `source`) | Přímé mapování; `km` se při změně koncového tachometru dopočítá.                                                                                                                                                                              |
| `fuel` (`fuel_id`, `vehicle_id`, `driver_id`, `date`, `litres`, `amount_czk`, `ccs_amount_czk`, `full_tank`, `station`, `match_state`)                               | Částky CZK se převádějí na/z haléřů; stav párování jde do `match_state`.                                                                                                                                                                      |
| `settings` (`key`, `value`, `note`)                                                                                                                                  | `manager_email` → e-mail manažera; `a5_levels_days` → dny upozornění. Obě hodnoty se ukládají do existujících řádků.                                                                                                                          |
| `accounts` (`account_id`, `email`, `password`, `role`, `driver_id`, `active`)                                                                                        | Přihlášení porovnává e-mail bez ohledu na velikost písmen a heslo jako text. Role `driver`, `fleet`, `management` se mapují na `Řidič`, `Fleet manažer`, `Vedení`; u řidiče se používá `driver_id`. Sloupec `active` se v prototypu ignoruje. |

Gateway poskytuje `POST /v1/auth/login` pro přihlášení k listu `accounts`. List musí mít přesně uvedené hlavičky; účet řidiče potřebuje vyplněné `driver_id`, které odpovídá `driver_id` v listu `drivers`.

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
