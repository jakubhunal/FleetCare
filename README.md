# FleetCare

Funkční český frontend správy vozového parku. Čistá větev `main` startuje bez ukázkových provozních dat. Původní statický prototyp je zachován v tagu `prototype-reference`, závazné zadání v `FleetCare_zadani_oficialni_FE.md`.

**[Otevřít živé demo na GitHub Pages](https://jakubhunal.github.io/FleetCare/)** · [Postup práce přes Git](CONTRIBUTING.md) · [Automatické publikování](docs/deployment.md)

Dokončené změny se vždy commitují a pushují na GitHub. Úspěšně zkontrolovaný `main` se automaticky přenáší do `codex/demo-review`; každý demo push spustí kontroly a publikování nejnovější ověřené verze. Identifikátor nasazeného commitu je v patičce aplikace a ve [version.json](https://jakubhunal.github.io/FleetCare/version.json).

## Spuštění

Node.js 22.12+ nebo 24 LTS a npm. V kořeni repozitáře:

```sh
npm ci
npm run dev
```

Otevřete URL vypsanou Vite, obvykle http://127.0.0.1:5173. Aplikace se nespouští dvojklikem na index.html.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

Build je v dist/. Výchozí produkční server musí mít SPA fallback na index.html pro /vehicles/_, /drivers/_ a další aplikační cesty. Vite dev a preview fallback poskytují. GitHub Pages build používá základ `/FleetCare/` a HashRouter, takže funguje i obnovení přímého odkazu bez serverového fallbacku. `npm run contracts` regeneruje OpenAPI a schéma událostí; `npm run format` sjednotí zdrojový formát.

## Lokální režim a první použití

Výchozí konfigurace je local. Založte vozidlo a řidiče, vyplňte oprávnění a svěřte vozidlo v detailu Přidělení. V horní liště přepněte na Řidič a zvolte existující profil. Řidič může zahájit/ukončit vlastní jízdu, hlásit závadu, zadat tankování a spravovat vlastní povolené dokumenty. Vedení má navíc Reporty; fleet manažer je nemá ani přes přímou URL.

**Lokální režim — data jsou uložena v tomto prohlížeči.** IndexedDB uchovává záznamy i Blob soubory po reloadu. Nejde o sdílenou firemní DB ani zálohu; jiný prohlížeč, zařízení, origin nebo odstranění dat webu znamená jiný/prázdný prostor. LocalStorage obsahuje pouze malou preferenci zvoleného kontextu, nikoli evidenci nebo doklady.

Přepínač rolí není zabezpečení. Skutečné přihlášení, serverové oprávnění a soukromé úložiště musí být doplněny před použitím reálných osobních dokumentů. FE nemá login ani další role.

Zakázky vznikají integračním importem. Čistý produkt nemá ruční založení zakázky ani skrytý seed. STK, ŘP, účtenka nebo CCS PDF se skutečně uloží, ale bez připojené služby je extrakce `not_configured`. Nahrané dokumenty mají skutečné náhledy. E-mailové požadavky nejsou vydávány za odeslané.

## API konfigurace

Zkopírujte .env.example do .env.local a nastavte vlastní gateway:

```dotenv
VITE_DATA_ADAPTER=http
VITE_API_BASE_URL=https://vase-gateway.example.invalid/v1
```

Restartujte Vite. Neplatná/chybějící služba ukáže chybu; neaktivuje lokální fallback. Nikdy nevkládejte privilegované klíče či Make webhook do VITE proměnných. Smlouva HTTP klienta i serverových callbacků je v docs/api-contract.md a docs/openapi.json.

## Google Sheets na VPS

Pro napojení dodané školní tabulky použijte serverovou bránu `npm run gateway:sheets`. Mapování listů, podporované zápisy, service account a proměnné pro VPS jsou v [docs/sheets-vps.md](docs/sheets-vps.md). Současná tabulka zatím nepokrývá všechny části aplikace ani souborové přílohy.

Docker image a celý postup nasazení na VPS jsou popsané v [docs/docker-vps.md](docs/docker-vps.md).

## Ukázková větev

Technicky ověřený čistý bod: `fe-clean-v1`. Větev `codex/demo-review` vzniká až z tohoto bodu a přidává izolovaný idempotentní seed. Spuštění:

```sh
git switch codex/demo-review
npm ci
npm run dev
```

Ukázka má viditelný štítek a jinou IndexedDB. Vynucuje lokální adaptér i při náhodném API nastavení prostředí. Neobsahuje reálné osobní doklady. Opravy patří nejprve do main a teprve pak do demo větve. Demo větev se nikdy neslučuje celá zpět do main. Podrobnosti: docs/review-workflow.md.

## Předání a ověření

- docs/progress.md — průběžný stav a nejbližší kroky.
- docs/verification.md — skutečně provedené kontroly a jejich omezení.
- docs/architecture.md — vrstvy, cache, zvolená projekce dat a soubory.
- docs/data-model.md — entity, typy, vazby a účetní metodika.
- docs/api-contract.md, docs/openapi.json, docs/events.schema.json — integrační smlouvy.
- docs/integrations.md — Make toky, příjemci, deduplikace a model free rozpočtu.
- docs/backend-handover.md — konkrétní práce kolegů pro DB, oprávnění, soubory a automatizace.

Testy používají výhradně izolované fiktivní vstupy a vlastní IndexedDB namespace. HTTP kontraktní testy spouštějí dočasný server na 127.0.0.1; v omezeném sandboxu může být nutné povolit lokální síťové spojení. To není připojení ostrých služeb. Souhrny/reporty nikdy nesčítají měny bez kurzu, odhady oprav ani duplicitní účtenku a CCS.
