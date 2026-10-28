# Pravidla práce na FleetCare

Tato pravidla platí pro celý repozitář a všechny další agenty.

- Závazné produktové zadání: `FleetCare_zadani_oficialni_FE.md`. Původní prototyp je vizuální reference, ne náhrada zadání.
- Veškerou práci vést přes Git. Před změnami ověřit `git status`, aktuální větev a remote. Cílový repozitář je `https://github.com/jakubhunal/FleetCare.git`.
- Každý dokončený funkční celek ověřit, commitnout s výstižnou zprávou a pushnout na GitHub. Práce není předaná, pokud existuje pouze lokálně. Při selhání pushnutí uvést konkrétní překážku; netvrdit, že je změna na GitHubu.
- Společné opravy vyvíjet v čistém `main` nebo v pracovní větvi `codex/*` určené k začlenění do `main`. Respektovat ochrany větví a používat PR, pokud jsou vyžadovány. Nepřepisovat cizí změny a neprovádět force push.
- `main` musí startovat bez provozních ukázkových dat. Seed, demo bootstrap a demo DB patří výhradně do `codex/demo-review`. Nikdy neslučovat celou demo větev zpět do `main`.
- GitHub Pages publikují pouze ověřenou `codex/demo-review`. Po úspěšných kontrolách nejnovějšího `main` workflow automaticky merguje změny do demo větve, pushne je a spustí Pages. Při konfliktu ho vyřešit běžným Gitem, ověřit a pushnout demo; automatizace konflikt nesmí obcházet.
- Před dokončením spustit typecheck, lint, testy a produkční build; u změn UI spustit aplikaci a ověřit dotčené scénáře, desktop i mobil podle rozsahu. Pro Pages ověřit také `/FleetCare/` a obnovení hlubokého hash odkazu.
- Po pushnutí změn určených pro demo zkontrolovat GitHub Actions a skutečnou nasazenou verzi přes `/FleetCare/version.json`. Úspěšný push ani lokální build samy neprokazují úspěšné nasazení.
- Průběžně aktualizovat `docs/progress.md`. Předání obsahuje commity/větve, výsledky kontrol, případné překážky a nejbližší kroky.
- Nepředstírat připojenou DB, přihlášení ani Make.com. Nedávat klíče, tokeny, `.env.local`, reálné doklady či osobní provozní data do Gitu nebo veřejného dema.

Postup pro kolegy: `CONTRIBUTING.md`. Publikování a řešení chyb: `docs/deployment.md`.
