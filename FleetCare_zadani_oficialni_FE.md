# FleetCare — závazné zadání funkčního frontendu

Verze zadání: 28. 10. 2026. Jazyk aplikace: čeština.

## 1. Co máš vytvořit

Vytvoř **oficiální, plně funkční frontend webové aplikace FleetCare** pro správu vozového parku autodopravní firmy. Vycházej z povedeného existujícího prototypu: zachovej jeho vizuální charakter, přehlednost a návaznosti obrazovek, ale přestav technický základ pro dlouhodobý vývoj a budoucí připojení databáze a automatizací.

**Už nejde o statický klikací prototyp.** Navigace, formuláře, validace, ukládání přes datovou vrstvu, změny stavů, vazby záznamů, vyhledávání, filtrování, přílohy a exporty musí skutečně fungovat. Neodevzdávej obrazovky, kde tlačítka jen zobrazují hlášku „Bude dostupné ve finální aplikaci“.

Databázi a ostré automatizace budou následně připojovat kolegové. Tvým úkolem je dodat kompletní FE, funkční lokální datový adaptér, připravené integrační rozhraní a přesnou dokumentaci pro jejich práci. Nepředstírej, že jsi bez jejich konfigurace zprovoznil Supabase, Google Sheets, Make, OCR nebo odesílání e-mailů.

### 1.1 Podklady a jejich priorita

Referenční podklady při sepsání tohoto zadání:

- původní zadání: `C:/Users/Kubík/Desktop/FleetCare_zadani_staticky_prototyp.md`;
- poznámky ke změnám: `C:/Users/Kubík/Desktop/upravy.md`;
- referenční prototyp: `C:/Users/Kubík/Desktop/InnoFlow/` — zejména `index.html`, `styles.css`, `app.js`, `mock-data.js`, `README.md`, `preview-desktop.jpg` a `preview-mobile.jpg`.

Cesty jsou orientační. Při spuštění úkolu mohou být soubory přiložené jinak nebo v jiném pracovním adresáři. Nejprve najdi skutečně dodané podklady. Pokud prototyp chybí, požádej o něj; nepředstírej jeho prohlédnutí.

**Tento dokument nahrazuje původní zadání prototypu.** Původní zadání a zdrojové soubory používej jako referenci vzhledu a zachovaných procesů. Staré technické požadavky „jen HTML/CSS/vanilla JS“, „bez ukládání“, „mock akce“ a „všude demo data“ už neplatí. Funkce výslovně odstraněné níže nesmíš znovu zařadit podle původních podkladů. Nepřebírej z nich neověřené datumy, servisní intervaly, adresy, ceny ani kontakty jako skutečná firemní data.

### 1.2 Kontext firmy

- Převážně vnitrostátní nákladní doprava, sídlo v Praze, externí nasmlouvané servisy.
- Plánovaný rozsah: 70 vozidel — 15 kamionů, 10 nákladních vozidel, 35 dodávek a 10 osobních aut.
- Přibližně 65 zaměstnanců, z toho 50 řidičů.
- Některá vozidla jsou provozní rezerva. Rezerva není automaticky porucha, odstavení ani nedostupnost.

Tyto počty slouží k návrhu kapacity aplikace. Nezakládej podle nich fiktivní záznamy a nepoužívej je jako aktuální provozní KPI.

### 1.3 Jak při realizaci postupovat

Nejprve projdi dodané zadání, zdrojové soubory a jednotlivé obrazovky referenčního prototypu včetně mobilního řidičského pohledu. Nezačínej pouze z popisu dashboardu nebo screenshotu. Ověř, které stávající části jsou jen statické ukázky.

Připrav krátký realizační plán a potom pokračuj implementací po funkčních celcích. Nezastavuj po návrhu architektury. Nejasnosti, které mění obchodní význam nebo vyžadují chybějící přístup, polož konkrétně; běžná implementační rozhodnutí vyřeš samostatně a zdůvodni v dokumentaci. Průběžně kontroluj soulad s odstraněnými funkcemi, aby se původní rozsah nevracel pod jiným názvem.

Výsledné pořadí předání je závazné: funkční čistý FE → ověření a commit/push čisté verze → oddělená ukázková větev → připomínky a opravy do čistého FE → aktualizace ukázkové větve → čisté předání kolegům.

## 2. Co znamená „funkční FE“ před připojením DB

Dodávka má tři jasně oddělené podoby:

| Podoba | Účel a chování |
|---|---|
| Čistá hlavní verze | Prázdná evidence při prvním spuštění, žádné předvyplněné provozní záznamy. Funkční lokální adaptér umožní založit vlastní data, pracovat s nimi a ověřit FE. |
| Režim připojeného API | Stejné obrazovky a aplikační logika používají HTTP adaptér. Data se čtou a zapisují výhradně přes nakonfigurované rozhraní. Chybějící služba je přiznaná chyba konfigurace, nikdy důvod pro tiché přepnutí na lokální data. |
| Oddělená větev pro vizuální kontrolu | Totožný FE s izolovanými fiktivními daty a označením ukázkového prostředí. Slouží zadavateli ke schválení vzhledu a scénářů. Podrobný postup je v kapitole 10. |

### 2.1 Povinný lokální adaptér

- Implementuj persistentní úložiště v **IndexedDB**, včetně příloh jako `Blob`. LocalStorage používej nejvýše pro drobné preference, nikoli pro dokumenty nebo hlavní evidenci.
- Na čistém profilu vytvoř pouze prázdné struktury a nutné technické nastavení. Žádná vozidla, řidiči, zakázky, jízdy, kontakty servisů, CCS transakce, dokumenty ani simulované události.
- Skutečné ručně založené záznamy musí přežít obnovení stránky. Všechny lokálně podporované operace musí používat stejné doménové rozhraní jako budoucí integrace.
- Režim jasně označ stručnou informací „Lokální režim — data jsou uložena v tomto prohlížeči“. V dokumentaci vysvětli, že nejde o sdílenou firemní DB ani zálohu a data nejsou dostupná na jiném zařízení.
- Při nedostupnosti úložiště, překročení kvóty nebo selhání zápisu zobraz chybu. Úspěch oznam až po dokončeném zápisu.
- Způsob výběru adaptéru nastav jednou v konfigurační vrstvě. Obrazovky o jeho konkrétní implementaci nesmějí rozhodovat.
- V API režimu nezobrazuj po chybě stará lokální data jako výsledek z DB. Cache musí být oddělená podle prostředí, datového zdroje a uživatelského kontextu.
- Lokální uložení dokumentu je funkční upload do lokálního úložiště. **Není to provedené OCR.** Nevyplňuj z něj fiktivně vytěžené hodnoty.

### 2.2 Hranice této dodávky

**Dokonči teď:** všechny obrazovky a povolené uživatelské operace, lokální perzistenci, modely a validace, přílohy a jejich skutečné náhledy, výpočty z dostupných dat, exporty, HTTP klienta podle integrační smlouvy, stavy asynchronních operací, testy a dokumentaci.

**Připrav pro kolegy:** konkrétní kontrakty API a událostí, mapování dat, požadavky na oprávnění, soubory, konflikty zápisů a idempotenci, návrh variant Supabase / Google Sheets a vazeb na Make.

**Není součástí tohoto FE úkolu:** vytvoření a provoz ostré DB, zapojení skutečných schránek, realizace Make scénářů, nasazení OCR poskytovatele ani skutečné přihlášení. Tyto služby vyžadují samostatnou implementaci a konfiguraci. Nedodaná služba nesmí znemožnit dokončení lokálního FE.

## 3. Role a přístup

Použij přesně tři role:

1. **Fleet manažer** — celý provozní pracovní prostor kromě sekce Reporty.
2. **Řidič** — samostatné jednoduché UI zaměřené na vlastní vozidlo, vlastní zakázky, jízdy, závady, tankování, požadavky a vlastní dokumenty.
3. **Vedení** — stejné možnosti jako fleet manažer a navíc Reporty.

Odstraň samostatné role Dispečer, Finance a HR. Potřebné provozní činnosti z jejich původních pohledů přebírá fleet manažer, případně vedení.

### 3.1 Bez přihlášení v této fázi

Zadavatel potvrdil: **zatím bez přihlášení, s přepínačem rolí a přípravou na pozdější zabezpečení**. Neimplementuj login, registraci ani obnovu hesla. Avatar a notifikační zvoneček odstraň.

- Přepínač „Zobrazit jako“ mění uživatelský kontext a odpovídající UI. Sám o sobě nezajišťuje ochranu dat.
- Kontext řeš přes `ActorContext` / poskytovatele identity: role a případný `driverId`. Nezapisuj konkrétního Jana Nováka do komponent.
- V lokálním režimu umožni pro řidičský pohled zvolit již existujícího řidiče. Pokud není založen žádný, zobraz smysluplný prázdný stav. Nevytvářej implicitního fiktivního řidiče.
- Po změně kontextu zruš nebo zneplatni související dotazy a přepni na povolenou trasu. Nesmí krátce probliknout obsah jiné role či jiného řidiče.
- Přímá URL do Reportů není ve FE dostupná fleet manažerovi ani řidiči. Omezení uplatni rovněž v navigaci, globálním hledání, akcích a exportech.
- Pro skutečný provoz s osobními dokumenty musí kolegové doplnit ověřenou identitu a oprávnění v backendu / DB / úložišti. Libovolný `driverId` nebo role poslaná z prohlížeče nesmí později stačit jako důkaz oprávnění.
- Nepublikuj reálné osobní dokumenty do prostředí chráněného pouze přepínačem rolí. Toto je konkrétní hranice předávané verze, ne důvod přidávat nyní přihlašovací obrazovky.

### 3.2 Minimální matice možností

| Oblast / operace | Fleet manažer | Řidič | Vedení |
|---|---|---|---|
| Přehled, vozidla, řidiči, zakázky, globální evidence jízd | Ano | Pouze vlastní provozní pohled | Ano |
| Založení a úprava vozidla, přidělení, servisní plán | Ano | Ne | Ano |
| Založení a úprava profilu řidiče, pozastavení / obnovení | Ano | Ne | Ano |
| Nahrát, zobrazit a smazat dokument řidiče | Ano | Jen vlastní | Ano |
| Zahájit / ukončit vlastní jízdu, doplnit její údaje | Ano podle kontextu | Ano | Ano podle kontextu |
| Nahlásit závadu | Ano | U vlastního dostupného vozidla | Ano |
| Zadat tankování / přiložit vlastní účtenku | Ano | Vlastní záznam | Ano |
| Přidat dodací list | Ano | K vlastní zakázce | Ano |
| Přiřadit vozidlo a řidiče zakázce | Ano | Ne | Ano |
| Řešit CCS rozdíl | Ano | Ne | Ano jako manažerská role |
| Ostatní výdaje a globální přehled nákladů | Ano | Ne | Ano |
| Notifikovat řidiče o servisu | Ano | Ne | Ano |
| Nastavení | Ano | Ne | Ano |
| Reporty a jejich export | Ne | Ne | Ano |

Řidiči nezpřístupňuj cizí dokumenty, interní ceny přeprav, celkové náklady firmy ani manažerské poznámky. Technickou přípravu serverového vynucení těchto pravidel popiš v předání.

## 4. Vzhled a společné UX

### 4.1 Vizuální reference

Zachovej rozpoznatelný FleetCare z prototypu:

- tmavě zelený levý sidebar, jemný světlý podklad, bílé panely a decentní zelenožlutý akcent;
- přehlednou hierarchii nadpisů, provozní tabulky, KPI, stavové štítky a detailové záložky;
- střídmé ikony z jedné konzistentní sady;
- mobilní pohled řidiče s velkými hlavními akcemi a kartou vlastního vozidla;
- klidný profesionální vzhled interní B2B aplikace.

Referenční barvy lze převzít jako výchozí tokeny: sidebar `#113c33`, hlavní zelená `#267a5b`, akcent `#d9ee99`, pozadí `#f5f7f5`. Kontrast a přístupnost mají přednost před přesným zachováním odstínů.

Zlepši čitelnost původních drobných textů. Běžný pracovní obsah má být přibližně 14–16 px, sekundární informace obvykle alespoň 12 px; důležité popisky neřeš písmem 8–10 px. Nepřidávej módní efekty, které zhorší orientaci.

### 4.2 Hlavní navigace

Pro fleet manažera:

1. Přehled
2. Vozidla
3. Řidiči
4. Zakázky
5. **Přehled jízd** — nový název globální sekce místo „Kniha jízd“
6. Servis a závady
7. Náklady a CCS
8. Termíny a upozornění
9. Nastavení

Vedení má navíc Reporty. Sekci Dokumenty ke kontrole zcela odstraň. Název „Kniha jízd“ používej pro export či přehled konkrétního vozidla, nikoli jako matoucí název celé evidence všech vozidel.

Řidiči zachovej Moje vozidlo, Moje zakázky, Moje jízdy, Nahlásit závadu, Zadat tankování a Moje požadavky. Vlastní dokumenty zpřístupni přehledně z tohoto pracovního prostoru, například podsekcí „Moje dokumenty“ u profilu / požadavků. Řidič musí mít reálnou cestu k jejich nahrání, zobrazení a smazání.

Horní lišta obsahuje název / drobečkovou navigaci, funkční globální hledání a přepnutí role. Bez avataru a bez zvonečku. Na mobilu musí být hledání dostupné například tlačítkem otevírajícím hledací panel; nesmí prostě zmizet.

### 4.3 Společná pravidla chování

- **Celý řádek záznamu v tabulce je klikací** a otevře jeho detail, nejen drobný odkaz „Detail“. Zachovej sémantickou tabulku a skutečný odkaz v hlavní buňce pro ovládání klávesnicí a otevření do nové záložky. Řádky bez detailu nemusejí předstírat klikatelnost.
- Vnořená tlačítka, odkazy a checkboxy mají vlastní funkci; jejich použití nesmí zároveň otevřít detail řádku. Respektuj označování textu a modifikační klávesy.
- Stavové štítky a chyby nesmí být rozlišeny jen barvou. Použij text a případně ikonu.
- Navigace, detaily a záložky mají stabilní URL. Funguje obnovení detailu, přímý odkaz i Zpět/Vpřed; nakonfiguruj fallback hostingu pro zvolený router.
- Ve všech seznamech fungují relevantní filtry, hledání, řazení a stránkování. Počet výsledků odpovídá skutečně filtrovaným datům. Filtry uchovej při návratu z detailu, ideálně v URL.
- **Globální hledání** hledá napříč povolenými oblastmi: SPZ/VIN/model, jméno řidiče, číslo zakázky/zákazník, jízdy a závady, případně názvy dostupných dokumentů. Výsledky seskup podle typu a odkazuj na konkrétní detail. V API režimu musí být připravené serverové hledání napříč evidencí, nikoli pouze v první načtené stránce.
- Hledání funguje průběžně s krátkým debounce, normalizuje velikost písmen, u textu diakritiku a u SPZ mezery. Umožni Enter, zrušení dotazu i stav bez výsledků; ošetři opožděné odpovědi staršího dotazu.
- Rozliš načítání, skutečně prázdnou evidenci, žádné výsledky filtru, chybu, nedostatečná oprávnění a nenakonfigurovanou službu. Chyba API nesmí vypadat jako „Nemáte žádná vozidla“.
- Formuláře mají jasné popisky, povinná pole, jednotky, smysluplné výchozí hodnoty a chyby u polí. Zpracuj českou desetinnou čárku. Po chybě zachovej vyplněné hodnoty.
- Během ukládání zamez dvojímu odeslání, po úspěchu aktualizuj detail, seznam a související souhrny. U destruktivních akcí vyžaduj cílené potvrzení v aplikaci.
- Rozpracovaný formulář se nezahodí omylem kliknutím mimo dialog. Dialog podporuje klávesnici, Escape podle situace, správu a návrat fokusu i přístupný název.
- Žádná samostatná záložka **Historie** nikde v aplikaci. Starší dokumenty, ukončená přidělení, uzavřené jízdy a závady řeš kontextovým filtrem / switchem „Zobrazit i historické“. Technická dohledatelnost změn v datovém modelu zůstává zachována.
- Čeština, formát `cs-CZ`, Kč, km, l, kg, m³, časové pásmo Europe/Prague. Zobrazené dnešní datum je skutečné datum, nikoli 25. říjen 2026 převzatý z prototypu.
- Responzivní desktop, tablet a mobil. Dotykové cíle hlavních akcí přibližně 44 × 44 px. Stránka nesmí vodorovně přetékat; široká tabulka má vlastní posuv nebo mobilní podobu.
- Zohledni WCAG 2.2 AA, ovládání klávesnicí, viditelný fokus, kontrast, sémantické prvky a omezení animací. Automatická kontrola přístupnosti nenahrazuje ruční ověření klávesnicí.

## 5. Funkční rozsah podle oblastí

### 5.1 Přehled

- KPI pouze ze skutečně dostupných záznamů: vozidla podle stavu, blížící se termíny, otevřené závady, zakázky k přiřazení, neúplné jízdy a nevyřešené CCS rozdíly.
- Prioritní úkoly s vazbou na detail, důvodem, termínem, stavem a odpovědnou osobou / rolí. Nezobrazuj úkoly na kontrolu dokumentů, potvrzení servisního plánu nebo schvalování opravy.
- Přehled blízkých termínů, aktivních zakázek a aktuálního provozu. Bez technického monitoringu Make a bez prezentace demo scénářů.
- Rychlé akce: Přidat vozidlo, Nahrát STK, Přidat řidiče, Nahlásit závadu a Zapsat výdaj. **Nikde Nová zakázka.**
- Odkaz na Reporty / měsíční report pouze pro vedení, včetně případných KPI odkazů a rychlých akcí.
- Prázdný dashboard nabízí relevantní první krok. Není naplněný smyšlenými čísly, grafy, jmény ani falešnými úkoly.

### 5.2 Vozidla a detail vozidla

**Založení vozidla má dvě cesty:**

1. Ruční formulář → validace → uložení vozidla přes datovou vrstvu.
2. Nahrát STK → uložení souboru → asynchronní zpracování přes budoucí Make → vytvoření či aktualizace vozidla a termínu STK.

V API smlouvě rozliš nahrání STK k existujícímu vozidlu a příjem STK pro založení nového vozidla. Do úspěšného zpracování pracuj s identitou dokumentu / požadavku; nezakládej prázdné provozní auto jen proto, aby k němu šel upload připojit. Duplicitní SPZ/VIN musí vést k řešení vazby, nikoli k automatickému vytvoření druhého auta. Opakovaný callback nesmí založit druhý záznam.

Seznam: SPZ, značka/model, kategorie, provozní účel, příznak rezervy, svěřený řidič / nepřiděleno, aktuální doložený nájezd, stav, nejbližší termín a servisní plán. Filtry kategorie, stav, rezerva a řidič; funkční textové hledání.

Základní formulář: SPZ, VIN podle dostupnosti, značka/model/rok, palivo a motorizace, kategorie, provozní účel, rezerva, stav, požadovaná skupina ŘP, doložená nosnost/objem/rozměry/palety/vybavení a případná konfigurace soupravy. Neznámá kapacita je `null` / „Není doloženo“, nikoli nula nebo vymyšlený odhad.

Detail uspořádej do přehledných záložek:

- Přehled
- **Dokumenty**
- Pojištění a termíny
- Servisní plán
- Závady a servis
- Zakázky
- **Jízdy a nájezdy**
- Tankování a náklady
- Přidělení

Oddělení záložek Zakázky a Jízdy a nájezdy je záměrné: **zakázka není jízda**. V aplikaci jsou i osobní a pracovní vozidla s jízdami bez přepravní zakázky, například cestou do servisu.

**Dokumenty vozidla:**

- Na jednom místě všechny dostupné dokumenty k danému vozidlu: STK, pojištění, servisní doklady a další přílohy. U tankovacích dokladů zobraz vazbu na příslušný záznam, bez kopírování souboru.
- Tlačítko Přidat dokument, skutečný náhled PDF/JPG/PNG, název, typ, datum, platnost / splatnost, zdroj a stav technického zpracování.
- Soubor dokumentu se neupravuje. Žádné „Zkontrolovat“, „Potvrdit údaje“, „Schválit“ ani editor dokumentu. U vozidel nyní nepřidávej mazání dokumentů; požadováno je přidání a zobrazení.
- Metadata potřebná pro provoz je možné opravit ve formuláři souvisejícího záznamu / termínu; nejde o úpravu původního souboru.
- Upozornění na platnost a splatnost se připravují pro e-mail přes Make. Historické dokumenty zobraz filtrem, nikoli záložkou Historie.

**Servisní plán vozidla:**

- Výchozí šablona podle typu / varianty vozidla se nastavuje globálně v Nastavení.
- Při přiřazení šablony k vozidlu předvyplň položky. U konkrétního vozidla lze upravit plán a odlišit tak individuální intervaly.
- Položka: název úkonu, interval km a/nebo času, poslední skutečné provedení, další datum / kilometrová hranice. Nevyplňuj neověřené technické intervaly výrobce jako fakta.
- Globální změna šablony nesmí bezděčně přepsat individuální úpravy. Výchozí pravidlo: šablona slouží k předvyplnění; existující plán se mění až explicitním uložením úpravy u vozidla. Nové přiřazení šablony s přepsáním upozorní na dopad.
- Umožni zaznamenat skutečné provedení položky s datem a km. Tím se přepočítá její další hranice. Tento úkon není nová servisní objednávka ani schvalovací proces.
- **Odstraň Potvrdit plán, stavy čekání na schválení plánu, Zdroj a rozdíly verze i obrazovku porovnávání verzí.** Technické ID šablony / čas změny v datech nejsou uživatelský proces schvalování.

**Další vazby:**

- Jízdy a nájezdy tvoří společný přehled skutečných jízd a údajů tachometru. Zdroje nájezdu a případné rozpory uchovej; nepřepisuj aktuální nájezd starším dokladem.
- Závadu může nahlásit řidič i fleet manažer. **Bez tlačítka Nový servis a bez fotografií závady.**
- Tankování: ručně nebo nahráním / vyfocením účtenky. V detailu vozidla odstraň tlačítko Provozní výdaj / Zapsat provozní výdaj. Ostatní výdaje se zakládají v Náklady a CCS.
- Přidělení: přiřadit, změnit, ukončit; účinnost, důvod a volitelný předávací nájezd. Ukončená přidělení pod filtrem. **Žádný předávací checklist ani A7.**
- Trvalé svěření vozidla a řidič konkrétní zakázky jsou dvě různé vazby. Změna jedné nesmí tiše přepsat druhou.

### 5.3 Řidiči

- Seznam s kontaktem, stavem, oprávněními a jejich platností, kvalifikacemi, svěřeným vozidlem a dostupností. Detail: Přehled, Oprávnění a kvalifikace, Dokumenty, Přidělení, Zakázky a jízdy.
- Funkční založení a úprava profilu bez vymyšlených výchozích osobních údajů. Neúplný profil může být Rozpracovaný; dokončení povinných údajů není schválení dokumentu a nevyžaduje tlačítko Aktivovat.
- Aktivní / Pozastavený řeš **jedním konzistentním ovládacím prvkem** s ikonou pauza / pokračování a jasným textem Pozastavit řidiče / Obnovit řidiče. Stav musí být viditelný a přístupný. Samostatné tlačítko Aktivovat odstranit.
- Pozastavený řidič není vhodný pro nové přiřazení. Jeho již existující zakázky označ jako konflikt k řešení; nemaž je a automaticky je nepřiděluj jinému člověku. Obnovení neodstraňuje ostatní překážky, například propadlé oprávnění.
- Skupiny ŘP a platnosti mohou pocházet z vytěžení i ručního doplnění. Další kvalifikace lze evidovat strukturovanými údaji, pokud je provoz potřebuje; nepřidávej kvůli nim další typy osobních dokumentů.
- Zdravotní způsobilost nejvýše jako stav / platnost, bez diagnóz a bez zdravotních zpráv. Nevytvářej nevyžádaný zdravotní modul.
- Povolené dokumenty jsou **pouze řidičský průkaz** (přední a zadní strana, případně vícestránkové PDF) a **pracovní smlouva**.
- Vlastní dokumenty nahrává řidič, dokumenty řidičů fleet manažer / vedení. Povolené operace: nahrát, zobrazit, smazat. Bez úprav souboru, bez kontroly a schvalování dokumentu.
- Smazání má cílené potvrzení, odstraní dostupnost přílohy a invaliduje náhled. Datový kontrakt rozliší znepřístupnění a případné fyzické odstranění v úložišti. Smazání souboru nesmí automaticky smazat profil nebo tiše zrušit všechny dříve uložené údaje; ovlivněnou úplnost profilu zobraz podle konkrétních polí.

### 5.4 Zakázky

- Zakázky přicházejí **e-mailem**. Budoucí Make zpracuje objednávku a zapíše data do DB; FE je načte.
- **Nikde nezobrazuj Nová zakázka**, ruční založení zakázky ani alternativní průvodce jejím vytvořením. Platí to pro přehled, seznamy, globální akce i formuláře. Technický integrační import není uživatelské tlačítko.
- Umožni upravit / doplnit údaje již importované zakázky a přiřadit vozidlo a řidiče. Chybějící importní data nesmí být nahrazena odhadem.
- Seznam: číslo, zákazník, trasa, časy / časová okna nakládky a vykládky, kapacitní požadavky, přiřazené vozidlo a řidič, stav. Cena jen v manažerském a vedoucím pohledu.
- Detail: **Přehled a Dokumenty**. V přehledu zůstanou zákazník, kontakty, reference, zastávky a objednané časové údaje, náklad, hmotnost/objem/rozměry/palety, vybavení, kvalifikace, cena/měna/DPH a přiřazení.
- **Odstraň Plán a realizace, Jízdy, Výnosy, rozdělování výnosu mezi vozidla a Historii.** Odstranění porovnávání plánu a skutečnosti neznamená odstranění objednané trasy a časů nutných k přiřazení.
- Dokumenty zakázky jsou **pouze objednávka a dodací list / doklad o doručení („dodák“)**. Objednávka přijde importem, dodací list lze skutečně nahrát tlačítkem Přidat doklad o doručení. Podporuj více stran / souborů stejného povoleného typu.
- Zachovej stavy Přijatá, K doplnění, K přiřazení, Přiřazená, Probíhá, Dokončená, Uzavřená a Zrušená. Konflikt přiřazení je přidružený příznak s důvodem, ne záminka zahodit původní provozní stav.
- Dokončení zakázky, ukončení jízdy a nahrání dodacího listu jsou samostatné operace. Jedno nesmí automaticky znamenat, že proběhla všechna ostatní.

**Přiřazení vozidla a řidiče:**

- Zachovej výrazný přehled vhodných kandidátů a samostatně nevhodných s konkrétními důvody. Vozidlo a řidič se vybírají odděleně.
- Implementuj deterministické vyhodnocení z dostupných dat: kategorie, doložená kapacita a vybavení, platná požadovaná oprávnění / kvalifikace, pozastavení řidiče, technický stav vozidla, platnost STK, překryv zakázek a servisní nedostupnosti.
- Neznámé údaje nejsou automaticky splněný požadavek. Zobraz „Nelze vyhodnotit — chybí …“. Nepotřebuješ AI optimalizaci tras ani neověřené dopravní výpočty.
- Zobraz jednoduchou časovou dostupnost podle skutečných dat. Provozní rezerva sama o sobě není důvod vyřazení.
- Uložení musí aktualizovat zakázku a vazby v jednom aplikačním kroku. Lokálně použij transakci, v integrační smlouvě požaduj opětovnou kontrolu konfliktu na serveru při zápisu; samotná FE kontrola neřeší souběh dvou uživatelů.

### 5.5 Přehled jízd

- Globální evidence všech skutečných jízd všech vozidel, filtrování podle období, vozidla, řidiče, stavu a zakázky / samostatného účelu.
- Sloupce: datum, vozidlo, řidič, zakázka nebo účel, skutečné místo a čas od–do, počáteční/koncový tachometr, km, stav a zdroj.
- V horní části této globální sekce nech **pouze tlačítko Export knihy jízd**. Odstraň Import historie, Zahájit jízdu a Přidat historický záznam z této sekce.
- Zahájení / ukončení jízd zůstává v řidičském pracovním prostoru. Opravu a doplnění existující jízdy umožni v jejím detailu podle role. Požadavek jednoho tlačítka v globálním přehledu neruší tyto pracovní postupy.
- Jízda může být bez zakázky, pak má vlastní povinný účel. Pouhé přiřazení zakázky nesmí automaticky vytvořit uskutečněnou jízdu.
- Zachovej stavy Probíhá, Ukončena neúplná, K ověření, Potvrzena a Uzavřena. Úplně ukončená nebo doplněná jízda přejde K ověření; manažer / vedení může potvrdit její údaje a následně ji uzavřít. Jde o původní práci se záznamem jízdy, nikoli návrat odstraněné kontroly dokumentů nebo schvalování oprav. Řidič si vlastní záznam manažersky nepotvrzuje.
- Ukončení s chybějícím koncovým tachometrem uloží skutečný čas ukončení a neúplný stav. Chybějící km nevymýšlej z plánované trasy.
- Kontroly: konec času nejdříve po začátku, koncový tachometr alespoň počáteční, žádný nepovolený překryv jízd stejného vozidla / řidiče, změny starších údajů nevracejí současný nájezd zpět.
- Upozornění A6 připrav pro Make: **až po 72 hodinách od skutečného ukončení konkrétní jízdy bez koncového tachometru, při nejbližší denní kontrole**. Běžící jízda, neaktivní auto ani plánovaná zakázka tuto výzvu nevytvářejí.

**Skutečný export:** PDF pro čtení / tisk, XLSX pro další práci v Excelu; CSV jako doplňková volba, pokud nezvětší zbytečně rozsah. Excel je zde formát souboru, ne další databáze.

- Exportní dialog: období, vozidlo / více vozidel, řidič a výběr relevantních sloupců. Výstup respektuje roli a celý filtrovaný výběr, nikoli jen právě viditelnou stránku.
- PDF má čitelný titul, období, identifikaci vozidla / skupiny, hlavičky tabulky, stránkování a součty doložených km. XLSX má skutečné číselné a datumové buňky, české popisky a správné jednotky.
- Chybějící km jsou prázdné / označené jako chybějící, nikoli nula. Nezaměň počet neúplných jízd se skutečně ujetými kilometry.

### 5.6 Servis a závady

- Jeden přehled závad a jejich řešení externím servisem. **Žádné samostatné servisní požadavky / objednávky, Nový servis ani tlačítko pro jejich vytvoření ze závady.**
- Nahlášení fleet manažerem i řidičem: vozidlo, kategorie, popis, datum/čas, nájezd a oznámená naléhavost. Bez fotografií a bez přílohového pole pro fotky závady.
- Nepřidávej posuzování, schválení / zamítnutí závady ani opravy, automatický návrh priority nebo eskalaci podle cenového limitu.
- Zjednodušené provozní stavy: Nahlášena → Řeší se → Naplánován servis → V servisu → Vyřešena → Uzavřena. Podporuj relevantní změny podle dostupných údajů bez schvalovacího workflow.
- V detailu závady eviduj externí servis, související řidičský kontext, domluvený termín, popis opravy, provozní nedostupnost auta, odhadovanou cenu, měnu, případnou skutečnou cenu a podklady ze servisu. Termín a cena mohou být zatím neznámé.
- **Odhadovaná cena přichází e-mailem od servisu**, budoucí Make ji přiřadí ke konkrétní závadě. Kontrakt musí mít identifikátor případu / reference pro spolehlivé párování odpovědi. Uchovej zdroj a čas získání; nepáruj pouze podle neurčitého názvu vozu.
- U odhadu zobraz původ a datum. Odhad opravy není skutečný výdaj a nesmí vstupovat do doložených nákladů jako uhrazená oprava.
- Pro plánovaný či probíhající servis zaznamenej časovou nedostupnost vozidla a zobraz konflikty zakázek. Nahlášení libovolné drobné závady nesmí automaticky odstavit vozidlo.
- **Notifikovat řidiče** otevře formulář s aktuálním příjemcem, termínem servisu, místem a zprávou; po potvrzení vytvoří požadavek na odeslání e-mailu přes budoucí Make. Před odesláním musí být znám termín a platný příjemce. Není nutný vizuální editor e-mailových šablon.
- Dokončení servisu umožní aktualizovat provozní stav a skutečně provedené položky plánu. Neoznačuj automaticky všechny položky jako provedené.
- Uzavřené závady zobraz filtrem. **Žádná sekce Opakované závady, detekce A9, schvalování A10 ani záložka Historie.**

**Po nahlášení závady vznikají požadavky na tři samostatné e-maily:**

1. Aktuálně přiřazenému řidiči — potvrzení, že byla nahlášena závada jeho vozidla. Pokud hlásil manažer, text nesmí nepravdivě tvrdit, že hlášení podal řidič.
2. Fleet manažerovi — upozornění na nové hlášení konkrétního vozidla.
3. Nasmlouvanému externímu servisu — informace, že vozidlo vyžaduje opravu / domluvení postupu.

Zadavatel potvrdil: **u nepřiděleného vozidla se e-mail řidiči neodesílá**. Příjemce určuj podle přidělení účinného v okamžiku nahlášení a jeho identitu ulož do požadavku, aby pozdější změna řidiče nezměnila adresáta již čekající zprávy.

Chybějící kontakt servisu či manažera nesmí zahodit uloženou závadu. Příslušný požadavek označ jako neodeslatelný kvůli chybějícím údajům; zobraz problém u případu a umožni ho napravit. Neoznamuj společné „odesláno“, pokud se povedla jen část zpráv. Po uložení závady a po doručení e-mailů jde o dva oddělené výsledky.

### 5.7 Náklady, tankování a CCS

Záložky: **Tankování / CCS výpisy / Ostatní výdaje / Přehled nákladů**. Samostatnou záložku Párování a výjimky odstraň; samotné párování a řešení rozdílů zůstává dostupné v detailech transakcí a stavových filtrech.

**Tankování:**

- Řidič i manažer mohou zadat tankování ručně nebo nahrát / vyfotit účtenku. Na mobilu podporuj fotoaparát přes standardní souborový vstup a zároveň běžný výběr souboru.
- Pole: vozidlo, řidič, datum/čas transakce, litry, částka/měna, palivo, CCS karta / bez karty, stanice, tachometr, plná nádrž Ano / Ne / Není doloženo, účtenka.
- Po automatickém zpracování účtenky vznikne / doplní se jeden záznam. Při neúplném zpracování nabídni nový podklad nebo ruční doplnění záznamu bez schvalování dokumentu.
- Řidič vidí vlastní záznam a stav; neřeší CCS neshodu. Manažer / vedení mohou provést odůvodněnou opravu.

**CCS:**

- Výpisy přicházejí e-mailem a zpracuje je budoucí Make. **Import CCS PDF zůstává jako funkční ruční náhradní vstup**, zejména při chybě automatického příjmu.
- Eviduj výpis, období, zdroj e-mail / upload, datum přijetí, úplnost a stav zpracování. Datum přijetí a datum transakce jsou odlišná pole.
- Detail výpisu obsahuje transakce a originální soubor. Detail tankování / CCS transakce ukazuje vedle sebe záznam řidiče, CCS údaje, rozdíl, originální účtenku a výpis.
- Rozdíly smí řešit jen fleet manažer a vedení v jeho manažerském rozsahu. Řidič nedostane toto tlačítko ani příslušný příkaz přes FE datovou vrstvu.
- Zachovej stavy Čeká na výpis, Spárováno, Rozdíl, Chybí záznam řidiče, Neúplný podklad a Vyřešeno. Technickou chybu importu odliš od finančního rozdílu.
- Nejasnou shodu automaticky nepřiděluj. Umožni manažerovi vybrat transakci, opravit údaj s důvodem nebo ponechat případ otevřený. Výsledek a zdrojové vazby musí přežít obnovení stránky.
- **Účtenka a odpovídající CCS transakce jsou dva podklady jednoho nákladu.** Zajisti jediný kanonický náklad a vazby na oba doklady; nesečti je dvakrát. Stejný princip platí pro opakované nahrání PDF i pozdě doručený výpis.
- Dokumentuj, která částka vstupuje do reportu. Nevyřešený rozdíl označ jako předběžný nebo jej odděl od doloženého součtu. Výběr pravidla nesmí zůstat skrytý uvnitř komponenty.
- Tolerance částky je parametr v rámci CCS karet / souvisejícího nastavení, ne nový samostatný modul. Hodnota 0,99 Kč včetně je pouze návrh z původního zadání, ne potvrzené firemní pravidlo.

**Ostatní výdaje:**

- Zakládají se manuálně tlačítkem **Nový výdaj** v této sekci.
- Vozidlo, kategorie servis/pneumatiky/pojištění/mýto/poplatky/jiné, datum výdaje, částka/měna/DPH, popis, příloha a případná úhrada.
- Výdaj, datum úhrady a odhad opravy rozlišuj. Storno / korekce mají vazbu na původní záznam; historie ekonomických údajů se nesmí řešit tichým přepsáním bez dohledatelnosti.
- Souhrny a filtry skutečně počítej z uložených podkladů. Běžný přehled nákladů zůstává i manažerovi; samostatná sekce Reporty je jen pro vedení.

### 5.8 Termíny a upozornění

- Seznam a kalendář s běžným přechodem měsíců a roků, ne napevno říjen / listopad 2026.
- Typy: STK, pojištění, servis podle času/km, platnost oprávnění a chybějící údaje jízd. Navazuj na relevantní dokument / vozidlo / řidiče / jízdu.
- Zachovej přidání a úpravu relevantního ručního termínu manažerem / vedením. Termín odvozený z dokladu či plánu upravuj přes jeho zdroj; nevytvářej vedle něj druhý totožný ruční záznam.
- Termín nebo km hranice, odpovědný, priorita, stav Plánováno / Vyžaduje řešení / Splněno a odkaz na zdroj.
- Termín splněný novým dokumentem nebo servisním záznamem přestane vytvářet stejné aktuální upozornění; starší záznam lze zobrazit filtrem.
- Upozornění e-mailem plánuje a vykonává budoucí automatizace. FE poskytuje kontextová data a zobrazuje skutečně známé výsledky. Žádné spouštění budoucích e-mailů časovačem v prohlížeči.
- Prahy 30/14/7 dní a 500 km před servisem jsou výchozí **návrh k nastavení**, nikoli potvrzená politika firmy. Bez nastaveného pravidla zobraz srozumitelný stav; nevytvářej falešně naplánované odesílání.
- Bez záložky Historie upozornění; případnou dohledatelnost řeš filtrem v kontextu. Nepřidávej schvalovací úkoly odstraněných funkcí.

### 5.9 Reporty — pouze vedení

- Náklady podle vozidla, kategorie a období; doložené km, palivo, spotřeba, palivové a provozní náklady/km, zakázky, výnosy z dostupných cen, servis a závady.
- Využití vozidel zobraz jen s jasnou definicí dostupného času a dostatečnými podklady. Pokud je definice / vstup neúplný, ukaž „Nelze vyhodnotit“, ne smyšlené procento.
- Výnos vozidla odvozuj z jednoznačného přiřazení zakázky. Rozdělování výnosů mezi více vozidel se v tomto rozsahu neimplementuje; nejednoznačné případy odděl od součtu podle vozidel.
- Filtry musí současně změnit tabulku, KPI, grafy i export. Neopakuj chybu prototypu, kde graf zůstane z pevného ukázkového měsíce.
- Měsíční manažerský report s obdobím, zdroji a informací o úplnosti. Skutečný export PDF / XLSX; automatické rozesílání je budoucí integrace.
- Spotřebu počítej jen z vhodného doloženého úseku mezi tankováními do plna a odpovídajících nájezdů. Prosté litry v měsíci dělené libovolnými km nepovažuj za doloženou spotřebu. Dílčí tankování mezi dvěma plnými musí výpočet správně zahrnout.
- Náklady/km mají stejné období, rozsah vozidel, měnu a doložený jmenovatel. Nulové či chybějící km vedou k „Nelze vyhodnotit“. Nesčítej různé měny bez doloženého kurzu; podporuj jejich oddělení.
- Rozliš plánované a uskutečněné výnosy, odhady a skutečné náklady, částky s / bez DPH podle deklarované metodiky. **Rozdíl výnosů a vybraných provozních nákladů není čistý zisk.**
- Odstraň reportování úspěšnosti Make, projektový benefit case, investici, provozní rozpočet a ROI. Tyto části prototypu nejsou požadovanou provozní funkcí FE.

### 5.10 Nastavení

Zobraz **pouze tři části**:

1. **Termíny a servis** — časové/km prahy a potřebné provozní kontakty pro servisní upozornění.
2. **Servisní plány** — šablony podle typu / varianty vozidla, položky a intervaly; funkční založení a úprava.
3. **CCS karty** — identifikace karty, aktivní / neaktivní, vazba na vozidlo s účinností od–do a související tolerance párování.

Kontakty fleet manažera a externích servisů, nutné pro výše uvedené e-maily, spravuj v rámci Termíny a servis; výběr konkrétního nasmlouvaného servisu umožni u vozidla / závady. Nevytvářej kvůli tomu čtvrtou hlavní sekci nastavení.

Odstraň Automatizace, Monitoring, Integrace jako uživatelskou sekci, Role a oprávnění, samostatné Provozní číselníky, pravidla opakovaných závad a schvalovací limity. Technická konfigurace konektorů patří do prostředí a dokumentace, nikoli do produktového nastavení. Potřebné běžné seznamy kategorií mohou být součástí datového modelu bez vlastní administrační obrazovky.

## 6. Dokumenty a automatizace: konkrétní pravidla

### 6.1 Běžné případy automaticky, člověk jen u výjimky

Cílem není kontrolovat každý dokument člověkem. **Nevracej do aplikace frontu Dokumenty ke kontrole, porovnávání vytěžených polí s originálem ani povinné potvrzení každého dokladu.**

Po budoucím připojení funguje běžný průchod takto:

`nahrání / příjem e-mailu → uložení originálu → zpracování → automatické kontroly → zapsání úplných údajů → aktualizace FE`

- Make je orchestrátor. Samotné rozpoznání zajistí zvolený OCR / extrakční nástroj. Jeho konkrétní výběr a přesnost nejsou vyřešeny samotným použitím Make.
- Kontroly zahrnou povinná pole, datové typy, věrohodné rozsahy, návaznost datumů, součty a konzistenci vazeb SPZ/VIN/osoba/částka. Formátově platný údaj ještě není záruka věcné správnosti; číselné „confidence“ od AI nepovažuj samo o sobě za důkaz.
- Úspěšné a úplné zpracování rovnou doplní příslušný záznam, bez ručního schvalování. Automatický zápis nesmí bez pravidel přepsat novější manuální opravu nebo připojit dokument jiné osobě / vozidlu.
- Při nečitelném podkladu, chybějících údajích, rozporu či nejisté identitě zachovej originál a pravdivý stav Chybí údaje / Zpracování selhalo u konkrétního dokumentu a související evidence. Nabídni nový podklad nebo ruční doplnění / opravu dat ve formuláři záznamu. U neúspěšného založení ze STK může oprávněný uživatel navázat na ruční založení vozidla.
- Oprava strukturovaného údaje není úprava originálního souboru ani schválení dokumentu. Uchovej původ změny a vazbu na podklad. Při opakovaném zpracování nesmí starý callback vrátit ruční opravu zpět.
- Neúplnost rozhoduj podle konkrétních dat: chybějící důležitá kapacita / oprávnění / datum nemají být ve vhodnosti považovány za splněné.
- Před ostrou integrací je nutné ověřit extrakci na reprezentativním vzorku skutečných typů a kvalit dokumentů a změřit správnost kritických polí i podíl automaticky dokončených případů. To je úkol integračního týmu popsaný v předání, nikoli nová kontrolní sekce aplikace.
- Neslibuj stoprocentní OCR ani nulovou lidskou práci. Pokud konkrétní typ dokladu nelze zpracovat dostatečně spolehlivě zdarma, zachovej funkční ruční cestu tam, kde je požadovaná, a omezení otevřeně zdokumentuj. U zakázek neobcházej zákaz ručního založení: neúspěšný příjem řeší integrační tým / opakovaný import, FE umožňuje doplnit již založený neúplný záznam.

### 6.2 Soubory a stavy

- PDF, JPG/JPEG a PNG, více stran u vhodných dokumentů; náhled skutečně nahraného souboru, nikdy ilustrační papír vydávaný za originál.
- Rozliš životní cyklus souboru (`uploading`, `stored`, `upload_failed`) a extrakční úlohy (`not_configured`, `queued`, `processing`, `completed`, `incomplete`, `failed`). Pracovní smlouva / běžná příloha nemusí potřebovat extrakci vůbec.
- Úspěšné uložení souboru není úspěšné vytěžení. FE nesmí přeskočit z výběru souboru na hotová smyšlená pole.
- Zobraz průběh či stav, možnost opakovat podporovanou operaci a konkrétní důvod chyby. Stav musí být obnovitelný po reloadu.
- Limity počtu / velikosti a MIME typy nastav centrálně podle úložiště a integrační cesty. Kontrola ve FE slouží uživateli, backend ji později musí zopakovat.
- Pro Make Free počítej s limitem 5 MB na zpracovávaný soubor; nevydávej větší povolenou kapacitu úložiště za možnost takový soubor také vytěžit. Na limit upozorni před odesláním. Nedělej z placené komprese či převodu formátů závislost FE.
- Ukládej identifikátor, typ, původní název, MIME, velikost, vlastnickou vazbu, zdroj, čas, storage klíč, případný otisk souboru, stav a identifikátor úlohy. Binární dokumenty nepatří do tabulkových buněk ani do Git repozitáře.
- V API režimu používej soukromé úložiště a časově omezený přístup k dokumentům. Do DB ukládej stabilní storage klíč, nikoli expirovanou podepsanou URL jako trvalý odkaz. Náhledy a dočasná `ObjectURL` správně uvolňuj.
- Odmítnuté / nepodporované soubory neotevírej jako spustitelné HTML/SVG. Citlivý obsah nepatří do URL vyhledávání, analytiky ani chybových logů.

### 6.3 Integrační hranice

Obrazovky nesmějí přímo volat Make webhook, Google API nebo konkrétní DB tabulku. Používej aplikační služby a vyměnitelné adaptéry:

`UI → aplikační operace / validace → repository a integrační porty → lokální adaptér nebo HTTP adaptér → budoucí backend / integrační brána → DB, soubory a Make`

Pro budoucí Supabase lze zdokumentovat i přímý klientský adaptér s ověřenou identitou a správným RLS. To ale neznamená vložit do prohlížeče privilegovaný klíč. Preferuj nyní jednu stabilní HTTP smlouvu společnou pro obě zvažované datové varianty, aby se komponenty nemusely přepisovat.

Připrav konkrétní typy a mapování nejméně pro:

| Tok | Výsledek / požadovaný kontrakt |
|---|---|
| Nahrání STK | Příjem pro nové nebo existující vozidlo, soubor, identita úlohy, vazba výsledku a termín STK |
| ŘP | Přední / zadní strana či PDF, vlastník, aktualizace oprávnění bez schvalovacího kroku |
| Pracovní smlouva | Uložení a zpřístupnění souboru; extrakci nevyžaduj bez konkrétního účelu |
| Tankovací účtenka | Vytvoření / doplnění tankování, ochrana proti duplicitě |
| Objednávka z e-mailu | Příjem externě vytvořené zakázky, zdrojová objednávka a stav úplnosti |
| Dodací list | Příloha vlastní zakázky bez falešného automatického uzavření přepravy |
| CCS e-mail / ruční PDF | Výpis, transakce, úplnost, párovací stav a jediný náklad |
| Nahlášení závady | Uložení závady a oddělené požadavky pro řidiče, manažera a servis |
| Odpověď servisu | Spolehlivé přiřazení cenového odhadu / termínu ke konkrétnímu případu |
| Notifikovat řidiče | Požadavek e-mailu s termínem, příjemcem a odděleným stavem odeslání |
| Denní termíny a A6 | Výběr splatných událostí bez opakovaného vytváření totožných požadavků |
| Měsíční report | Datové podklady a případný budoucí požadavek na rozeslání, jen pro vedení |

V dokumentaci popiš minimálně:

- konkrétní endpointy pro seznam/detail/vytvoření/úpravy povolených entit a samostatné doménové příkazy, například pozastavení řidiče, přiřazení zakázky, ukončení jízdy a vyřešení CCS rozdílu;
- parametry hledání, filtrů, řazení, stránkování a exportu celého filtrovaného výběru;
- vytváření uploadu, přenos souboru a dokončení uploadu; oddělení souboru, vlastníka a zpracovací úlohy;
- formát odpovědi asynchronní operace, například HTTP 202 s `jobId`, a získání výsledku; žádné čekání na OCR uvnitř dlouhého požadavku formuláře;
- výsledek dokončení, chyby, chybějící pole, duplicitní příjem a konfliktní verzi záznamu;
- zrušení / timeout / opakování požadavku. Automatické opakování zápisu pouze s idempotentním klíčem; jinak hrozí dvojí závada, náklad nebo e-mail;
- řešení souběhu `version` / `updatedAt` nebo ETag a odpověď 409 při konfliktu; nepřepisovat změnu kolegy bez upozornění;
- přenos identity a serverové ověření oprávnění, bez důvěry v ručně zvolenou roli;
- callback z Make do budoucího backendu, ne do otevřené stránky uživatele. Zpracování musí doběhnout i po zavření prohlížeče;
- deduplikaci podle ID události, ID zprávy + přílohy a případně otisku. Samotný stejný název souboru nebo SPZ není dostatečný klíč.

Příklad tvaru události — skutečné kontrakty rozpracuj podle modelů, nepřebírej tento příklad jako univerzální schéma pro vše:

```json
{
  "eventId": "uuid",
  "schemaVersion": 1,
  "eventType": "fault.reported",
  "occurredAt": "ISO-8601-UTC",
  "aggregateId": "fault-uuid",
  "aggregateVersion": 1,
  "correlationId": "request-uuid",
  "idempotencyKey": "stabilni-klic-operace",
  "payload": {
    "vehicleId": "vehicle-uuid",
    "assignedDriverIdAtReport": null,
    "externalServiceId": "service-partner-uuid"
  }
}
```

Události a e-mailové požadavky musí být trvale evidované na straně budoucího backendu. Doporuč vzor outbox: uložit provozní změnu a požadavek na automatizaci společně, poté nezávisle doručovat. FE má volat jednu aplikační operaci, nikoli postupně „uložit závadu“ a „snad se podaří zavolat Make“ bez evidence neúspěchu.

U e-mailu rozliš `not_configured`, `queued`, `sending`, `sent`, `failed`, `skipped_no_recipient`. „Požadavek přijat“ neznamená „E-mail odeslán“. Ani přijetí poskytovatelem neznamená doložené doručení do schránky. Lokální režim nepřepne zprávu sám od sebe na `sent`.

Žádný skutečný tajný webhook, token, Google service-account JSON, e-mailové heslo, Supabase secret / service-role klíč ani OAuth refresh token nesmí skončit ve FE bundlu, proměnné `VITE_*`, Git historii nebo ukázkovém souboru prostředí.

## 7. Architektura a kvalita kódu

### 7.1 Doporučený technický základ

Pro tento rozsah použij **React + TypeScript ve strict režimu + Vite** a běžný router. Vhodné jsou TanStack Query pro asynchronní data, React Hook Form a Zod pro formuláře / validaci, přístupné sdílené UI komponenty a jednotná sada ikon. Můžeš zvolit srovnatelně kvalitní alternativu, ale volbu stručně zdůvodni a zachovej všechny požadavky.

Použij stabilní kompatibilní verze ověřené při realizaci, jeden package manager a commitovaný lockfile. Není požadováno spouštění dvojklikem na `index.html`; instalace závislostí a build jsou nyní v pořádku. Vývoj a předání musí fungovat bez placené komponentové knihovny nebo placeného účtu.

Prototyp nepřenášej jako jeden obří soubor renderující HTML řetězci. Převáděj jeho použitelné vzory do komponent a doménových funkcí. Nekopíruj rozsáhlé bloky obrazovek pro jednotlivé role ani neudržuj druhou implementaci aplikace pro demo větev.

### 7.2 Přiměřená struktura

Použij například tuto organizaci; přizpůsob ji skutečnému rozsahu bez zbytečných abstrakcí:

```text
src/
  app/                 router, layout, providers, konfigurace, ActorContext
  components/ui/       tabulka, dialog, formulářová pole, badge, stavové komponenty
  features/
    dashboard/
    vehicles/
    drivers/
    orders/
    trips/
    faults/
    costs/
    documents/         společná práce se soubory, nikoli menu kontroly dokumentů
    deadlines/
    reports/
    settings/
  domain/              modely, přechody stavů, validace a výpočty
  data/
    contracts/         repository / query / command rozhraní a DTO
    local/             IndexedDB, transakce a migrace lokálního schématu
    http/              API klient, mapování DTO, normalizace chyb
  integrations/        typy úloh, událostí a notifikací, bez tajných přístupů
  lib/                 datumy, peníze, formátování, exporty
  styles/              tokeny a globální styl
tests/                 jednotkové, integrační a koncové testy
docs/                  architektura, datový model, integrace, předání
```

- Sdílej skutečně stejné prvky a pravidla. Nevytvářej univerzální komponentu s desítkami přepínačů pro nesouvisející formuláře.
- Prezentační komponenty nepočítají účetní souhrny a neobsahují přístup k DB. Validace, výpočty, stavové přechody a oprávnění mají jedno místo pravdy.
- Změny propaguj do všech souvisejících pohledů přes datovou vrstvu a invalidaci dotazů. Nepřepočítávej stejnou obchodní logiku odlišně v dashboardu, detailu a reportu.
- Vstup z API validuj za běhu. TypeScript sám neověří data přijatá ze Sheets nebo Make.
- Žádné neodůvodněné `any`, vypínání lint pravidel, tiché `catch`, prázdné handlery, chybné React klíče nebo potlačování skutečných chyb.
- Dodaná implementace nesmí mít TODO místo požadované FE funkce. Místa čekající na budoucí backend musejí být konkrétně popsaná a vracet pravdivý stav konfigurace, nikoli falešný úspěch.

### 7.3 Datový model a konzistence

Navrhni a popiš minimálně tyto entity a jejich vazby:

| Skupina | Entity / zásadní vztahy |
|---|---|
| Vozidla | Vehicle, VehicleAssignment, OdometerReading, Insurance / termíny |
| Řidiči | Driver, oprávnění a kvalifikace, vazby na dokumenty a přidělení |
| Zakázky | Order, OrderStop, přiřazení vozidla a řidiče; zdrojová objednávka |
| Provoz | Trip s volitelným `orderId` a vlastním účelem |
| Servis | Fault se servisními údaji a dostupností; ExternalService; ServicePlanTemplate, VehicleServicePlan, provedení položek |
| Náklady | FuelRecord, CCSCard, časová vazba karty, CCSStatement, CCSTransaction, vazba párování, Expense / kanonický náklad, korekce |
| Dokumenty | Document / soubory a vazby k povoleným vlastníkům; zpracovací úloha |
| Upozornění | Deadline / úkol, NotificationRequest a technická integrační událost |

Nevytvářej samostatnou entitu uživatelských servisních požadavků se schvalováním jen proto, že ji měl prototyp. Technické záznamy servisního provedení mohou existovat pro správný výpočet plánu, bez obnovení odstraněného modulu.

- Stabilní ID, ideálně UUID, nikdy index řádku Google Sheets. Rozliš ID a člověkem čitelné číslo zakázky / SPZ.
- `createdAt`, `updatedAt`, verze a zdroj změny podle potřeby. Technickou stopu připrav, ale nevytvářej z ní záložky Historie.
- Doménové stavy jako explicitní hodnoty a povolené přechody; texty a barvy z centralizovaného mapování, nikoli regex nad českým popiskem.
- Datumové údaje bez času ukládej jako `YYYY-MM-DD`; události jako UTC timestamp a zobrazuj v Europe/Prague. Převod musí zvládnout letní čas a neodsunout platnost dokumentu o den.
- Peníze jako celé nejmenší měnové jednotky nebo řízený přesný decimal; ne nepřesné sčítání formátovaných řetězců. Měna je samostatná, `null` není nula.
- Množství, km, hmotnost a objem jsou typovaná čísla s jednotkou definovanou modelem. Formátování patří na výstup.
- U časových vazeb používej datum účinnosti. CCS karta i vozidlo mohou mít jinou historickou vazbu než dnes.
- Neodstraňuj navázané provozní záznamy kaskádově jen kvůli změně řidiče, dokumentu nebo kartě. Nové obecné mazání všech evidencí není požadováno.

## 8. Připravenost na Supabase nebo Google Sheets

Nerozhoduj za zadavatele závazně o DB a neimplementuj pro jistotu dva nehotové backendy. FE musí být nezávislý na úložišti. V dokumentaci doporuč pro vztahová a souběžně měněná data Supabase, ale zachovej realizovatelný popis varianty Google Sheets.

### 8.1 Supabase

- Modely mapovatelné do relačních tabulek s vazbami, unikátními omezeními, indexy a transakcemi. Zvlášť soubory v soukromém Storage.
- Budoucí autentizace a RLS / Storage policies musí vynucovat řidičova oprávnění i mimo FE. Tajný serverový klíč se do klienta nevkládá; veřejný publishable klíč sám neidentifikuje uživatele.
- Zdokumentuj doporučené tabulky a omezení; SQL návrh / migrace mohou být součástí předání, pokud nejsou vydávané za připojenou ostrou DB.
- Počítej s kvótami, soubory, přenosem a pozastavením projektu. Žádné obcházení limitů umělými keep-alive požadavky.

### 8.2 Google Sheets na Google Drive

- List pro entitu, stabilní ID, typované sloupce, explicitní cizí ID a data ve strojově čitelném formátu. Předání musí obsahovat konkrétní seznam listů, sloupců a mapování DTO.
- Dokumenty jsou samostatné soubory na Drive / jiném soukromém úložišti. Sheets obsahuje identifikátory a metadata, nikoli base64 dokumenty.
- Privilegované čtení/zápis musí zajišťovat důvěryhodná integrační brána, například vhodně navržené API nebo Apps Script se zabezpečeným přístupem. Nevystavuj veřejně celou tabulku ani service-account klíč v prohlížeči. Ověř možnosti zvolené varianty, včetně autentizace, CORS a kvót; Apps Script není automaticky bezpečný jen proto, že má URL.
- Uveď omezení souběhu, integrity vztahů a transakcí. Zápisy ze FE i Make musí sdílet pravidla verzí / idempotence a jedno místo rozhodování; nezávislé přepisování buněk podle pořadí řádků není přijatelný návrh.
- Filtry, stránkování, hledání a výpočty může zajišťovat brána. Komponenty nesmějí předpokládat, že si při každém kliknutí stáhnou celou tabulku.
- Vytvoř návrh dávkových operací a cachování pro omezení API požadavků. Neošetřené chyby 429 nebo ztracené aktualizace nesmějí být „vlastností Sheets“.

### 8.3 HTTP adaptér dodaný s FE

Implementuj klienta podle konkrétní dokumentované smlouvy včetně všech operací skutečně používaných FE. Ověř ho automatickými testy s izolovanými odpověďmi testovacího serveru; to není připojení ostré DB.

Nedostupnou nebo neznámou konfiguraci detekuj při inicializaci. Prázdná třída s metodami `TODO` není připravený adaptér. Naopak server pro obě DB a skutečné Make scénáře nejsou požadovanou součástí této dodávky.

## 9. Bezplatné tarify a provozní rozpočet

**Pouze free verze, bez automatické aktivace placených služeb.** Nepoužívej trial s budoucí povinnou platbou jako trvalé řešení. Před skutečnou integrací znovu ověř aktuální podmínky z oficiálních zdrojů a zapiš datum ověření.

Orientačně ověřeno při přípravě zadání 28. 10. 2026:

| Služba | Limity důležité pro návrh |
|---|---|
| Make Free | 1 000 kreditů měsíčně, nejvýše 2 aktivní scénáře, nejkratší interval plánovaného běhu 15 minut, maximální běh scénáře 5 minut, zpracovávaný soubor nejvýše 5 MB. Spotřeba závisí na modulech, počtu záznamů a způsobu extrakce. |
| Supabase Free | Přibližně 500 MB DB, 1 GB souborového úložiště, 5 GB egress, nejvýše 2 aktivní projekty; pozastavení po týdnu neaktivity. Free nelze zaměňovat za garantovaný provoz se zálohami placeného tarifu. |
| Google Sheets API | Standardně 300 čtení i 300 zápisů za minutu na projekt, 60 pro každou z těchto kategorií na uživatele/projekt. Dávkování, cache a reakce na 429 jsou součást návrhu. Další použité Google služby mají vlastní limity. |

Zdroje: [Make — tarify](https://www.make.com/en/pricing), [Make — kredity](https://help.make.com/credits), [Make — práce se soubory](https://help.make.com/working-with-files), [Supabase — tarify](https://supabase.com/pricing), [Supabase — klíče a jejich oprávnění](https://supabase.com/docs/guides/getting-started/api-keys), [Google Sheets — kvóty](https://developers.google.com/workspace/sheets/api/limits).

**Z těchto limitů nelze automaticky vyvodit, že celý provoz 70 vozidel a 50 řidičů bude zdarma kapacitně zvládnutelný.** Nejde o příslib objemu zpracování.

Pro integrační tým připrav konkrétní rozpočtový model: počet dokumentů podle typu × počet zpracovacích kroků / kreditů, e-maily, importy a transakce CCS, pravidelné kontroly, retry a rezerva. Ilustrační výpočet odděl od skutečně změřené spotřeby. Samotných 70 vozidel × 30 denních individuálních operací znamená 2 100 operací ještě před dalšími kroky; proto neprojektuj naivní modul pro každý vůz při každé kontrole.

Návrhově lze uvažovat o dvou scénářích:

1. **Událostní příjem** — dokumenty a požadavky na komunikaci s větvením podle typu události.
2. **Dávková kontrola** — denní příjem e-mailů, termíny, chybějící km a případné měsíční úlohy.

Jde o návrh k ověření proveditelnosti, ne o hotový Make blueprint. Oddělené e-mailové spouštěče a různé typy událostí se nesmějí řešit předpokladem, že jeden scénář má libovolný počet nezávislých triggerů. Popiš konkrétní způsob směrování / společného příjmu v budoucí integraci.

- Běžné čtení FE nesměřuj přes Make; zbytečně by spotřebovávalo kredity.
- Preferuj dávky, inkrementální příjem podle uloženého kurzoru, deduplikaci a nejmenší účelný počet čtení. Dávka neznamená automaticky jediný kredit za všechny následné záznamy; je nutné změřit skutečný běh.
- Původní denní příjem e-mailů je přijatelný návrh. Uživatel musí vědět, že příjem po běhu čeká na další kontrolu. Přesný čas nemá být pevně napsaný v komponentě a nesmí se vydávat za nakonfigurovaný plán.
- FE po vlastní změně aktualizuje příslušná data. Na asynchronní úlohu se může ptát omezeným backoffem při otevřeném detailu, s pauzou v neaktivní záložce a ukončením po výsledku. Neprováděj trvalý agresivní polling celé evidence ani Make.
- OCR / AI může spotřebovávat další kredity či mít jiný placený tarif. Nevyžaduj placené API třetí strany a neslibuj automatické vytěžování zdarma bez ověření konkrétního nástroje a objemu.
- Když se free limit vyčerpá, zachovej uložená data a pravdivý stav čekání / chyby. Žádný tichý přechod na placený tarif, ztráta dokumentu nebo falešné dokončení.
- Pokud celý požadovaný provoz do limitů nevejde, zdokumentuj měřený nedostatek a bezplatné možnosti omezení frekvence / dávkování / ručního postupu. Nepřekračuj rozpočet ani potichu neškrtni funkce FE.

## 10. Git, GitHub a ukázková větev

Výsledný projekt musí být na **GitHubu zadavatele**. Veškeré smysluplné změny zdrojů, konfigurace, dokumentace, lockfile a potřebných assetů průběžně commituj a pushuj. Neodkládej celou historii do jediného finálního commitu.

### 10.1 Bezpečný začátek a průběžná práce

1. Zkontroluj pracovní adresář, existující Git historii, remote a necommitované změny. Nic neresetuj a cizí práci nepřepisuj. Původní prototyp zachovej dohledatelně v původní historii / referenčním bodu; nenechávej jeho mock data přibalená do nové produkční aplikace.
2. Použij existující určený repozitář. Pokud cílový repozitář nebo účet není zjistitelný, polož jednu konkrétní otázku na GitHub URL / cílový účet a možnost založení soukromého repozitáře. Do vyjasnění pokračuj lokálně. Nevymýšlej účet, nepublikuj projekt do cizího repozitáře.
3. Je-li nutné vytvořit nový repozitář, výchozí požadavek je soukromý. Veřejnou publikaci či změnu viditelnosti bez výslovného zadání neprováděj. Použij existující přihlášení; nechtěj token ve zprávě ani ho nevypisuj do logu.
4. Hlavní čistou větev označuj jako `main`, pokud repozitář používá jinou výchozí větev, respektuj ji. Běžné pracovní větve pojmenuj například `codex/fe-foundation`, `codex/vehicles-drivers` apod.; neprováděj zbytečné přejmenování existující historie.
5. Commituj logické ověřené kroky: základ projektu, jednotlivé funkční celky, opravy a dokumentaci. Po každém dokončeném kroku pushni pracovní větev. Nedělej commit po každém znaku, ale žádná odevzdaná změna nesmí zůstat pouze v lokálním necommitovaném stavu.
6. Používej srozumitelné zprávy commitů. Žádný force push, přepis sdílené historie ani odstranění starých větví bez potřeby a domluvy. Při chráněné větvi postupuj přes PR a respektuj pravidla repozitáře.
7. `.gitignore` musí vyloučit tajemství, reálné doklady / osobní data, lokální IndexedDB exporty, zálohy, `node_modules` a zbytečné generované soubory. Dokumentované příklady prostředí obsahují pouze neplatné / prázdné hodnoty.
8. Při chybě ověření nebo pushi problém nezamlčuj. Ulož práci lokálně a uveď, co přesně čeká na přístup / vyřešení. Nevydávej lokální commit za nahrání na GitHub.

### 10.2 Čistá verze a vizuální kontrola s daty

Zadavatel potřebuje prohlédnout naplněné UI, ale kolegům předat aplikaci **bez ukázkových provozních dat**. Použij tento postup:

1. **Nejprve dokonči a otestuj čistou verzi.** Na prázdném úložišti je skutečně prázdná a nenatahuje skrytý seed. Commitni, pushni a označ její konkrétní commit; můžeš přidat nekolidující tag typu `fe-clean-v1`.
2. Z tohoto konkrétního commitu založ **`codex/demo-review`**. Pokud již existuje, nejprve zjisti její účel a stav; nepřepisuj ji naslepo.
3. Teprve v této větvi přidej izolovaný seed a minimální kód k jeho spuštění, v samostatném commitu. Fiktivní záznamy a demo bootstrap nejsou součástí čisté větve ani jejího buildu. Původní `mock-data.js` se v čisté verzi nenačítá.
4. Vizuální větev musí používat **tentýž FE a stejné repository rozhraní**, bez kopie obrazovek. Seed dodá jen malou smysluplnou sadu propojených dat.
5. Ukázkové prostředí zřetelně označ „Ukázková data — prostředí pro schválení“. Použij jiné jméno IndexedDB / namespace, aby přepnutí větve nepomíchalo lokální skutečně zadané údaje s demo sadou.
6. Vizuální větev vynuť do izolovaného lokálního adaptéru. Nesíťuj na ostrou DB, Make ani e-mailovou službu, ani kdyby v prostředí náhodou byly jejich přístupy. Simulované výsledky integrace jsou přípustné pouze zde a musí být označené.
7. Seed musí být opakovatelný bez násobení záznamů a nesmí při každém reloadu mazat úpravy, které si zadavatel při kontrole provede. Reset demo sady může být explicitní vývojová akce jen v této větvi.
8. **Opravy FE z připomínek zapracuj do čisté pracovní větve**, otestuj, commitni a pushni. Poté přenes čisté opravy do `codex/demo-review` mergem z čisté větve nebo cíleným cherry-pickem. Pokud zadavatel píše připomínky ve vlákně otevřeném nad demo větví, stále odděl opravy aplikace od seed commitu.
9. **Demo větev nikdy neslučuj celá do `main`.** Zvláště ne přímým mergem / squash mergem všech demo změn. Seed a simulátory by se tím dostaly do čisté verze.
10. Po schválení vytvoř nový čistý předávací commit / tag, pushni jej a znovu ověř prázdný start i nepřítomnost seedů v produkčním bundlu. Kolegům předej čistou větev / tag; zadavateli ponech ukázkovou větev pro další kontrolu.

Minimální diagram směru změn:

```text
main / čistá FE větev:   čistý základ ── oprava UI ── oprava funkce ── předání kolegům
                              ╲             ╲             ╲
codex/demo-review:              seed ───── aktualizace ───── aktualizace
```

Do čisté aplikace nepřidávej přepínač „Demo / Prázdný stav“, výchozí mock účet ani automatický návrat k demo datům při chybě API. **Prázdná data jsou normální stav, nikoli jiná implementace obrazovky.** Nutné syntetické testovací vstupy / továrny mohou existovat pouze v izolovaných testech, nesmějí se importovat do běžící aplikace ani přidávat provozní seed při jejím startu.

V demo větvi předveď alespoň: vozidlo s řidičem i nepřidělenou rezervu, platný a blížící se termín, ukončenou neúplnou jízdu, samostatnou jízdu bez zakázky, pozastaveného řidiče, přiřaditelnou a konfliktní zakázku, závadu s odhadem servisu, různé CCS situace, dokument v úspěšném i chybovém zpracování a prázdný filtrovaný výsledek. Žádné reálné osobní průkazy ani osobní údaje.

Nahrání zdrojů na GitHub není automaticky požadavek na veřejný hosting aplikace. GitHub Pages či jiné nasazení nepovažuj za hotové připojení DB a nezveřejňuj kvůli prezentaci skutečné dokumenty.

## 11. Testování a kritéria převzetí

Použij smysluplné testy pravidel a hlavních procesů, ne stovky testů potvrzujících pouze vlastní implementaci. Doporučeně Vitest / Testing Library a Playwright nebo srovnatelné nástroje. Používej výhradně izolovaná testovací úložiště a fiktivní vstupy.

### 11.1 Povinné technické kontroly

- [ ] Instalace z lockfile a spuštění podle README fungují v čistém checkoutu.
- [ ] Projde typecheck, lint, relevantní automatické testy a produkční build.
- [ ] V hlavních scénářích nejsou neošetřené chyby v konzoli, rozbité routy, chybějící soubory ani nefunkční akce.
- [ ] Klíčové obrazovky jsou vizuálně ověřené na desktopu, tabletu a telefonu, například kolem 1440, 768 a 390 px; i se skutečně prázdnou evidencí.
- [ ] Lze aplikaci ovládat klávesnicí včetně řádků tabulky, hledání a dialogů. Vnořené akce v řádku neotevírají nechtěný detail.
- [ ] Záznam i příloha přežijí reload lokálního režimu. Ošetřené selhání úložiště nezobrazuje falešný úspěch.
- [ ] Kontrakt HTTP adaptéru pokrývá používané operace a testy odhalí nesprávné DTO, síťovou chybu, 409, 429 i neplatnou konfiguraci.
- [ ] HTTP chyba neaktivuje lokální fallback; přepnutí prostředí / role / řidiče neukáže data z cizí cache.
- [ ] Produkční build čisté verze neobsahuje seed, runtime demo simulátory, skutečné doklady ani přístupová tajemství.

### 11.2 Povinné funkční scénáře

1. Na čistém profilu aplikace ukáže prázdnou evidenci. Založím vozidlo a řidiče, upravím je, přiřadím vozidlo a po reloadu zůstane stejný stav. Nikde se nepřidají demo záznamy.
2. Řidiče pozastavím a stejným prvkem obnovím. Pozastavení se promítne do vhodnosti přiřazení a konfliktů, ale nezmaže provozní záznamy.
3. Řidič nahraje vlastní ŘP / smlouvu, zobrazí skutečný soubor a může jej smazat. Nedostane se k dokumentům jiného řidiče přes menu, hledání ani přímou FE URL.
4. Nahraji STK / účtenku. Soubor se skutečně uloží a zobrazí. V nepřipojeném režimu je pravdivě uvedeno, že extrakce není nastavena; žádné vymyšlené automaticky přečtené údaje. Asynchronní úspěch / neúplnost / chybu ověř v testech a ve vizuální větvi bez skutečného volání Make.
5. U již importované zakázky vyberu vozidlo a řidiče. Důvody vhodnosti odpovídají uloženým podkladům; chybějící kapacita, pozastavený řidič a servisní kolize nejsou označeny jako vhodné. Po uložení se aktualizuje seznam i detail.
6. Řidič zahájí a ukončí jízdu bez zakázky. Při chybějícím koncovém tachometru zůstane jízda neúplná; po doplnění se správně dopočítají km. Test A6 rozliší hranici 72 h, běžící jízdu a skutečné ukončení.
7. Hlášení závady se uloží a má tři oddělené komunikační požadavky. U nepřiděleného auta je požadavek řidiči vynechán, ostatní se nezahodí. Opakování stejného příkazu nesmí vytvořit další závadu / stejné zprávy.
8. Detail závady přijme přes testovaný kontrakt odhad servisu a aktualizuje jej jako odhad, ne skutečný náklad. Notifikace řidiči vyžaduje známý termín a příjemce a nezobrazuje odeslání bez potvrzení služby.
9. V detailu tankování otevřu originální účtenku i CCS výpis. Neshodu řeší manažer / vedení, řidič tuto možnost nemá. Shoda 1:1 tvoří jeden náklad; opakovaný import téhož výpisu nevytvoří duplicitu.
10. Globální hledání i filtry najdou existující záznamy, fungují s českou diakritikou a normalizovanou SPZ; po kliknutí otevřou správný detail a respektují roli.
11. Z přehledu jízd stáhnu platný PDF a XLSX soubor se správným filtrovaným obsahem a českými znaky. Export zahrne i další stránky výsledků a správně označí chybějící km.
12. Reporty vidí jen vedení. Změna období upraví grafy, KPI, tabulku i export. Dělení nulou, smíšené měny, neúplný palivový úsek a dvojí náklad jsou pokryté testy.
13. Vypršení technické URL náhledu lze napravit novým oprávněným přístupem; URL není jediným uloženým identifikátorem dokumentu. Technicky chybové stavy nezaměňuji za prázdnou evidenci.

Scénáře vyžadující importovaná data testuj izolovanými fixture vstupy / testovacím serverem a v demo větvi. Kvůli testu nepřidávej do čistého produktu tlačítko na ruční vytvoření zakázky ani skrytý seed.

### 11.3 Kontrola odstraněných funkcí

- [ ] Nikde Nová zakázka, ruční založení zakázky nebo demo přepínač.
- [ ] Nikde Dokumenty ke kontrole, Potvrdit údaje dokumentu, Ověřit dokumenty nebo aktivace řidiče samostatným tlačítkem.
- [ ] Nikde Potvrdit plán, Zdroj a rozdíly verze nebo schvalování servisního plánu.
- [ ] Nikde Nový servis, servisní požadavky / objednávky, schvalování oprav A10, opakované závady A9 nebo posouzení závady.
- [ ] Nikde předávací checklist A7, fotografie závad ani A11.
- [ ] Žádné záložky Historie, Plán a realizace, Jízdy / Výnosy u zakázky nebo Párování a výjimky v Nákladech.
- [ ] Žádné role Dispečer / Finance / HR, avatar, zvoneček, uživatelský monitoring Make nebo nastavení integrací.
- [ ] Globální přehled jízd má pouze hlavní akci Export knihy jízd; detail vozidla nemá akci Provozní výdaj.
- [ ] Odstraněné funkce nezůstaly dostupné starou routou, globálním hledáním nebo nepoužívaným dialogem z prototypu.

## 12. Dokumentace a výsledné předání

Součást Git repozitáře:

- `README.md` — instalace, spuštění, build, příkazy kontrol, lokální režim, přepínání rolí, API konfigurace a výslovné hranice bez přihlášení / ostrých služeb.
- `docs/architecture.md` — zvolený stack, odpovědnosti vrstev, směrování dat, cache, identity a souborů; stručné zdůvodnění důležitých voleb.
- `docs/data-model.md` — entity, pole, ID, vztahy, stavy, omezení, časové vazby a význam `null` / částek / datumů.
- `docs/api-contract.md` a strojově čitelná smlouva, ideálně OpenAPI pro HTTP část + JSON Schema / TypeScript pro události — konkrétní payloady, příklady neplatných stavů, chyby, idempotence, souběh a uploady.
- `docs/integrations.md` — jednotlivé Make toky, příjemci e-mailů, mapování zdrojů, callbacky, pravidla proti duplicitám, lokální vs. skutečné zpracování, limity a rozpočet free variant.
- `docs/backend-handover.md` — konkrétní postup připojení Supabase a alternativy Sheets/Drive, potřebné tabulky / listy / úložiště, kde doplnit adaptér / server, oprávnění a testy napojení. Odděl hotový FE od práce, kterou kolegové ještě musejí udělat.
- `docs/review-workflow.md` — čistá větev/tag, větev `codex/demo-review`, spuštění ukázky, izolace dat, přenos připomínek a zákaz přenosu seedu do hlavní větve.
- Bezpečný příklad konfigurace a zamčené závislosti; případné CI pro typecheck, lint, testy a build v rámci dostupných bezplatných možností repozitáře.

Dokumentaci drž v souladu s implementací. Neslibuj endpoint, validaci nebo ochranu, která ve skutečnosti neexistuje. Pokud nemůžeš dokončit push, připojení či test kvůli chybějícímu přístupu, uveď konkrétní překážku a dokonči ostatní nezávislou práci.

V závěrečném předání zadavateli stručně uveď:

1. Odkaz na GitHub, čistou větev / commit / tag a ukázkovou větev.
2. Přesné příkazy, jak spustit čistou aplikaci a jak naplněnou verzi pro kontrolu.
3. Co jsi skutečně otestoval a co čeká na budoucí DB / Make / zabezpečení.
4. Jak má zadavatel posílat připomínky a jak se opravy dostanou do obou větví bez demo dat v hlavní verzi.
5. Co konkrétně předat kolegům a kde najdou integrační smlouvu.

**Hotovo znamená funkční, udržovatelný a vizuálně dotažený FE s čistým datovým základem, připraveným rozhraním pro integrace a dohledatelnou Git historií. Samotný hezký prototyp, nefunkční tlačítka ani nezdokumentované „backend se dodělá“ nejsou splnění zadání.**
