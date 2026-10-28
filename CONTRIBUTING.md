# Společná práce přes Git

Jediný společný zdroj kódu je [GitHub FleetCare](https://github.com/jakubhunal/FleetCare). Každá dokončená změna musí být commitnutá a pushnutá. Lokální složka ani zaslaný ZIP nenahrazují předání přes Git.

## Běžná změna

1. Zkontrolujte `git status`, `git remote -v` a aktuální větev. Rozpracovanou práci nejdřív bezpečně commitněte do své větve; nepřepisujte změny kolegů.
2. Aktualizujte čistý základ pomocí `git switch main` a `git pull --ff-only origin main`.
3. Založte pracovní větev, například `git switch -c codex/oprava-terminu`.
4. Implementujte ucelenou změnu. Aktualizujte stručně `docs/progress.md`.
5. Spusťte `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. Změnu UI zkontrolujte ve spuštěné aplikaci včetně mobilu, pokud ho ovlivňuje. Změny kontraktů regenerujte přes `npm run contracts`.
6. Vybrané soubory přidejte pomocí `git add`, vytvořte výstižný commit a proveďte `git push -u origin codex/oprava-terminu`. Další dokončené celky průběžně commitujte a pushujte.
7. Založte PR do `main`, nechte projít kontroly a začleňte ho podle pravidel týmu. Bez ochrany větve může pověřený správce pushnout ověřený celek přímo do `main`.
8. Zkontrolujte Actions: `Frontend checks` → `Sync verified main to demo` → `Deploy demo to GitHub Pages`. Úspěch ověřte na [demu](https://jakubhunal.github.io/FleetCare/) a porovnáním [version.json](https://jakubhunal.github.io/FleetCare/version.json) s nejnovějším commitem demo větve.

Nečekejte se všemi commity až na konec projektu. Při předání musí být změny dohledatelné na remote; případné selhání pushnutí nebo nasazení výslovně uveďte. Nepoužívejte force push do společných větví.

## Čistý produkt a veřejné demo

`main` zůstává čistý, připravený pro napojení DB a automatizací. `codex/demo-review` přidává jen izolovaná fiktivní data. Společné opravy patří nejprve do `main`; po úspěšném CI se automaticky mergují do dema a nasazují. Změny pouze demo dat se commitují a pushují přímo do demo větve, což také spustí nasazení.

**Nikdy nemergujte celou demo větev do `main`.** Pokud automatický přenos narazí na konflikt, proveďte `git fetch origin`, `git switch codex/demo-review`, `git pull --ff-only origin codex/demo-review` a `git merge origin/main`. Konflikt vyřešte se zachováním demo izolace, spusťte kontroly, commitněte a pushněte. Poslední funkční Pages verze zůstává do úspěšného nasazení dostupná.

Veřejné demo uchovává vlastní změny každého návštěvníka pouze v jeho prohlížeči. Git push aktualizuje aplikaci, nikoli obsah uživatelovy IndexedDB. Seed po reloadu nepřepisuje provedené úpravy. Do repozitáře a dema nepatří reálné osobní dokumenty, tajné klíče ani `.env.local`.

Podrobnosti: [nasazení](docs/deployment.md), [oddělení větví](docs/review-workflow.md), [backend předání](docs/backend-handover.md).
