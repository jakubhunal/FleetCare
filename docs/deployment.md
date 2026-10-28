# GitHub Pages — nejnovější ověřené demo

Adresa: https://jakubhunal.github.io/FleetCare/. Publikuje se pouze `codex/demo-review`. Čistý `main` neobsahuje seed a není přímo veřejným demem.

## Automatické aktualizace

- Push do `codex/demo-review` spustí `Deploy demo to GitHub Pages` (`pages.yml`). Proběhne instalace z lockfile, typecheck, lint, testy, kontrola generovaných kontraktů a produkční build. Až potom se publikuje `dist/` přes oficiální Pages Actions.
- Push do `main` spustí `Frontend checks`. Po úspěchu workflow `Sync verified main to demo` ověří, že jde stále o nejnovější `main`, merguje ho do demo větve a normálně pushne merge commit. Explicitně vyvolá Pages workflow, protože push pomocí `GITHUB_TOKEN` sám další push workflow nespouští.
- Novější demo nasazení zruší rozpracované starší nasazení. Při chybě kontrol nebo konfliktu se nepublikuje rozbitý build; zůstane poslední úspěšná verze. Chybu je nutné opravit a pushnout. Vždy jde tedy o nejnovější **úspěšně ověřenou a nasazenou** demo verzi, nikoli neuloženou lokální práci.
- Automatizace neprovádí merge demo → main, force push ani změnu uživatelských dat. Současný push kolegy může bezpečně odmítnout automatický push; přenos je potom nutné zopakovat po aktualizaci větve.

Veřejný `/FleetCare/version.json` obsahuje celý nasazený commit a větev. Stejný commit je zkráceně vidět v patičce aplikace s odkazem na GitHub. Při ověřování použijte nové načtení bez cache a porovnejte s HEAD demo větve; nasazení trvá obvykle několik minut. Aplikace nemá service worker, který by držel starou verzi.

## Konfigurace

V GitHub Settings → Pages musí být Source nastaveno na **GitHub Actions**. Prostředí `github-pages` musí povolovat nasazení z `codex/demo-review`; případné ochrany větví musí umožnit automatický merge push do demo větve. CI používá standardní `GITHUB_TOKEN`, bez vlastního PAT ve zdrojích. Pages job má pouze potřebná oprávnění k publikování, sync workflow potřebuje `contents: write` a `actions: write`.

Pages build nastavuje `VITE_BASE_PATH=/FleetCare/`, `VITE_ROUTER_MODE=hash` a `VITE_BUILD_SHA` na skutečný zdrojový commit. Odkazy mají tvar `/FleetCare/#/vehicles/...`; jejich reload nepotřebuje serverový SPA fallback. Lokální vývoj bez těchto proměnných používá běžné URL přes BrowserRouter. Demo vždy vynucuje lokální datový adaptér.

Pro místní kontrolu stejného buildu v PowerShellu na demo větvi:

```powershell
$env:VITE_BASE_PATH = '/FleetCare/'
$env:VITE_ROUTER_MODE = 'hash'
$env:VITE_BUILD_SHA = git rev-parse HEAD
npm run build
npm run preview
```

Otevřete `/FleetCare/` na vypsané adrese. Po kontrole odstraňte tyto tři procesní proměnné nebo otevřete nový terminál pro standardní lokální vývoj. Žádná z těchto proměnných není tajný údaj.

## Ruční opakování a chyby

V Actions otevřete `Deploy demo to GitHub Pages` → Run workflow a vyberte **codex/demo-review**. Spuštění na jiné větvi se úmyslně přeskočí. Běžná aktualizace vyžaduje pouze commit a push, nikoli ruční upload souborů do Pages.

Při chybě nejprve přečtěte neúspěšný krok v Actions. Merge konflikt vyřešte podle `CONTRIBUTING.md`. Pokud už `main` v demu je, sync workflow nic nepřepisuje; případné opakování publikování spusťte přímo Pages workflow. Nikdy nemažte demo seed ani nepublikujte ručně čistý build jako náhradu dema.

Postup odpovídá [oficiální dokumentaci Pages Actions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
