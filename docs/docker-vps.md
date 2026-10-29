# Přenos a spuštění FleetCare na VPS přes Docker

Postup předpokládá Debian/Ubuntu, doménu směrovanou na VPS a přístup přes SSH. Nasazení spouští tři služby: Caddy pro veřejné HTTPS, Nginx pro frontend/API proxy a Node gateway pro Google Sheets. Gateway není publikovaná na internet; kontejnery komunikují v Docker síti. Google service-account JSON se mountuje jako Compose secret a není součástí image.

## 1. Připravte Google přístup

V Google Cloud zapněte Google Sheets API, vytvořte service account a stáhněte jeho JSON klíč. Tabulku sdílejte s jeho `client_email` jako Editor. Tento gateway ukládá pouze do sloupců existujících listů; podporované zápisy a omezení jsou v [sheets-vps.md](sheets-vps.md).

## 2. Nainstalujte Docker Engine a Compose

Postupujte podle oficiálního návodu pro [Debian](https://docs.docker.com/engine/install/debian/) nebo [Ubuntu](https://docs.docker.com/engine/install/ubuntu/). Nainstalujte také Compose plugin (balíček `docker-compose-plugin`) a ověřte:

```sh
sudo docker version
sudo docker compose version
```

## 3. Přeneste aktuální zdrojové soubory

Přenos proveďte z počítače, kde máte tento upravený pracovní strom. Změny zatím nejsou na GitHubu, proto samotný `git clone` nestačí. Na VPS nejprve připravte adresář a přidělte ho svému uživateli:

```sh
sudo mkdir -p /opt/fleetcare/app /opt/fleetcare/secrets
sudo chown -R "$USER":"$USER" /opt/fleetcare
```

Z místního počítače zkopírujte projekt bez `.git`, závislostí, buildu a lokálních env souborů. Nahraďte `uzivatel` a `vps.example.com` svými hodnotami:

```sh
rsync -av --exclude=.git --exclude=node_modules --exclude=dist --exclude='.env*' \
  /home/vojta/FleetCare/ uzivatel@vps.example.com:/opt/fleetcare/app/
```

## 4. Umístěte service-account klíč a vytvořte konfiguraci

Zkopírujte klíč samostatně mimo checkout, například:

```sh
scp /cesta/lokalni/google-service-account.json uzivatel@vps.example.com:/opt/fleetcare/secrets/google-service-account.json
```

Na VPS omezte přístup k souboru a připravte Compose env soubor:

```sh
chmod 600 /opt/fleetcare/secrets/google-service-account.json
cd /opt/fleetcare/app
cp deploy/fleetcare.env.example .env.docker
```

Upravte `/opt/fleetcare/app/.env.docker`, pokud je cesta ke klíči jiná. Má obsahovat:

```dotenv
GOOGLE_SHEET_ID=1x9KHpZiofd-2VK1T_LwJ1wRYnW9btzYn9nS6uwHnBPQ
GOOGLE_SERVICE_ACCOUNT_FILE=/opt/fleetcare/secrets/google-service-account.json
FLEETCARE_DOMAIN=app.vasedomena.cz
```

Nedávejte service-account JSON do `/opt/fleetcare/app` ani do Git repozitáře.

## 5. Sestavte a spusťte

Na VPS:

```sh
cd /opt/fleetcare/app
sudo docker compose --env-file .env.docker config
sudo docker compose --env-file .env.docker up --build -d
sudo docker compose --env-file .env.docker ps
sudo docker compose --env-file .env.docker logs --tail=100 gateway web proxy
```

Veřejný Caddy přijímá porty 80/443 a předává doménu Nginxu. Nginx servíruje frontend a předává `/api/v1/*` gateway. Frontend používá relativní `/api/v1`, takže není třeba měnit build pro každou doménu. Compose navíc zpřístupňuje web na `127.0.0.1:8080` pro lokální diagnostiku; gateway port 8787 není publikován.

## 6. Připojte doménu přes HTTPS

DNS `A` záznam domény musí ukazovat na IP VPS. Pokud máte `AAAA` záznam, musí ukazovat na správnou IPv6 adresu VPS; jinak jej odstraňte. V `.env.docker` nastavte `FLEETCARE_DOMAIN` na přesný název domény. Přiložený `deploy/Caddyfile` předává provoz na interní službu `web:80` a Caddy automaticky obstará certifikát.

Povolte příchozí porty **80/tcp** a **443/tcp** ve firewallu poskytovatele VPS a případném firewallu serveru. Porty 8080 a 8787 ponechte neveřejné. Caddy získá certifikát, pokud DNS ukazuje na VPS a je dosažitelný na portech 80/443; certifikáty a stav ukládá do pojmenovaných Docker volumes. [Požadavky Caddy na automatické HTTPS](https://caddyserver.com/docs/automatic-https).

Pokud později zjistíš, že už na VPS běží jiný veřejný web/proxy, nepouštěj Caddy kontejner na stejných portech. V tom případě odstraň službu `proxy` z Compose a nastav existující proxy na `127.0.0.1:8080`.

## 7. Ověřte propojení a aktualizujte aplikaci

Na VPS ověřte proxy lokálně:

```sh
curl -fsS https://app.vasedomena.cz/api/health
curl -fsS https://app.vasedomena.cz/api/v1/workspace
```

Pak otevřete `https://app.vasedomena.cz` (nahraďte skutečnou doménou), zkuste načtení evidence a vytvořte testovací změnu v podporované části. Změny se ukládají přímo do odpovídajícího listu. Chyba 403 obvykle znamená, že tabulka není sdílená s service accountem jako Editor; 501/422 značí akci nebo pole bez odpovídajícího listu/sloupce.

Při další změně zdrojů přeneste upravené soubory znovu přes `rsync` a spusťte:

```sh
cd /opt/fleetcare/app
sudo docker compose --env-file .env.docker up --build -d
```

Sestavení frontendového image proběhne na VPS. Tabulka je jediné datové úložiště této integrace; Docker volumes pro aplikační data nejsou potřeba. Pro návrat k předchozímu buildu zatím použijte Git/backup zdrojů a sestavte předchozí verzi; Compose konfigurace automatické verzování image nezavádí.
