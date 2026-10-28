# Čistá a ukázková větev

`main` je čistý FE. První start nemá vozidla, řidiče, zakázky, dokumenty ani simulované události. Původní prototyp je dohledatelný přes `prototype-reference`, jeho mock-data.js se nesmí vrátit do zdrojů nebo buildu. První čistý ověřený bod je označen `fe-clean-v1`; pozdější opravy jsou v historii `main` a dalších čistých tagech.

`codex/demo-review` se zakládá až z ověřeného a pushnutého čistého bodu. Přidává pouze oddělený seed a bootstrap; používá stejné obrazovky, doménové modely i repository. Konfigurace v této větvi vynutí lokální adaptér, jiný IndexedDB namespace a viditelný štítek „Ukázková data — prostředí pro schválení“. V čisté aplikaci není přepínač demo/prázdný stav.

Review se spustí stejným způsobem: `git switch codex/demo-review`, `npm ci`, `npm run dev`. Seed je idempotentní, po reloadu nepřepisuje provedené úpravy. Obnovení celé demo sady se provádí explicitním smazáním izolované demo DB v nástrojích prohlížeče, nikoli přepnutím hlavní aplikace do falešného režimu.

Připomínku posílat jako: obrazovka/URL, vybraná role/řidič, konkrétní kroky, očekávaný a skutečný výsledek, případně snímek. Oprava FE vždy patří nejprve do main. Po úspěšném CI nejnovějšího main automatizace provede merge a push do demo větve a spustí nové Pages nasazení; seed zůstává pouze v demo commitu. Případný konflikt vyřeší kolega přes Git podle CONTRIBUTING.md. **Demo větev nikdy nemergovat ani nesquashovat celou zpět do main.**

Po uživatelském schválení vznikne další čistý předávací tag. Do té doby je čistý FE technicky ověřený kandidát k převzetí; nevydává se za uživatelovo schválení vzhledu. Kolegům předat čistý tag/main, zadavateli demo větev a https://jakubhunal.github.io/FleetCare/. Podrobnosti publikování a kontroly skutečné verze jsou v docs/deployment.md. Pages nepřipojují DB ani automatizace.
