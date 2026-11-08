# Make a navazující služby

Žádný webhook, schránka, OCR, Supabase ani Google účet není v této dodávce připojen. Lokální `not_configured` je záměrný pravdivý výsledek. Uložení souboru není vytěžení, přijetí požadavku není odeslání e-mailu. Neexistuje prohlížečový časovač odesílající budoucí zprávy.

Runtime schéma integračních událostí je v `src/integrations/contracts.ts`, JSON Schema v `events.schema.json`. Doporučený backend endpoint `/integration-events` je serverová smlouva, FE jej nevolá. Podpis callbacku, deduplikaci, transakce a outbox musí implementovat kolegové.

| Tok                 | Konkrétní vazby a pravidla                                                                                                                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| STK                 | documentId + jobId + intake/existing vehicleId; SPZ/VIN ověřit proti unikátním indexům. Duplicitní identita znamená navázání/konflikt, ne druhé auto. Zápis vozidla, STK a zdroje nájezdu atomicky.                  |
| Řidičský průkaz     | driverId + všechny strany/PDF + jobId; kvalifikace a platnosti se zapíší po automatických kontrolách, bez schválení dokumentu. Nečitelný podklad zůstane incomplete/failed.                                          |
| Pracovní smlouva    | soukromé uložení a přístup, extrakce není potřebná                                                                                                                                                                   |
| Účtenka             | fuelId nebo intake úloha + documentId; jedna transakce tankování, nikoli další výdaj za OCR. Ruční doplnění je chráněno verzí.                                                                                       |
| Objednávka e-mailem | messageId + attachmentId + externalId → Order a zdrojová Objednávka. FE ji může doplnit, nesmí zakládat novou.                                                                                                       |
| Dodací list         | owner order + documentId; samostatné dokončení zakázky a ukončení jízdy                                                                                                                                              |
| CCS                 | messageId nebo ruční upload + SHA-256 → Statement; transakce s unikátním externím ID. Datum přijetí se nerovná datu transakce. Jediný náklad dle vazeb, ne součet obou podkladů.                                     |
| Závada              | faultId + caseReference → tři samostatné komunikační požadavky ve společném outboxu. Řidič se určí podle přidělení v okamžiku hlášení a uloží se snapshot jeho identity/e-mailu. Bez přidělení skipped_no_recipient. |
| Odpověď servisu     | faultId/caseReference + messageId; estimateMinor, currency, receivedAt, source, případný serviceFrom/To. Odhad není actualMinor ani uhrazený Expense.                                                                |
| Notifikovat řidiče  | aktuální příjemce, známý termín, místo, zpráva. Požadavek má vlastní stav, FE neslibuje odeslání.                                                                                                                    |
| Denní termíny / A6  | indexovaný výběr splatných zdrojů, idempotentní klíč sourceId + typ + prahová událost. A6 pouze skutečně ukončená jízda bez endKm a alespoň 72 h, při nejbližší denní kontrole.                                      |
| Měsíční report      | jen vedení, konkrétní období/měna/rozsah, uložit úplnost a zdroje. Automatické rozesílání je další služba.                                                                                                           |

Stavy komunikace: not_configured → queued → sending → sent / failed, případně skipped_no_recipient. `sent` znamená potvrzení poskytovatele, nikoli prokázané doručení do schránky. Chybějící manažerský nebo servisní kontakt nesmí zahodit závadu; po doplnění lze požadavek obnovit. Pozdější změna svěření nesmí změnit adresáta již připravené zprávy řidiči.

CCS lokálně používá konzervativní shodu: známá karta a její historická vazba, stejné vozidlo/měna, shodný skutečný čas a doložené litry. Tolerance částky musí být explicitně nastavena. Hranice je včetně. Nejednoznačná shoda se nikdy automaticky nespojí a používá stav Neúplný podklad. Fuzzy časová tolerance není potvrzená firemní politika; případné rozšíření musí mít vlastní schválené pravidlo a testy.

## Free tarify a rozpočtový model

Dodávka žádnou placenou službu neaktivuje. Limity uvedené v zadání jsou návrhový podklad, nikoli nově ověřený příslib kapacity. Před skutečným zapojením ověřit aktuální [Make tarify](https://www.make.com/en/pricing), [soubory](https://help.make.com/working-with-files), [Supabase tarify](https://supabase.com/pricing) a [Sheets kvóty](https://developers.google.com/workspace/sheets/api/limits), zapsat datum a konkrétní limity. OCR poskytovatel zatím není vybrán; bezplatnost ani přesnost nejsou zaručeny.

Výpočet měsíční spotřeby: Σ (počet dokumentů každého typu × měřené kredity příjem/uložení/extrakce/validace/zápis) + počet e-mailů × měřené kroky + počet CCS transakcí × měřené kroky + dávkové kontroly + retry + rezerva. Pro test rozpočtu vést tabulku typ, objem/měsíc, průměrné kroky, spotřeba extrakce, počet výjimek a 20% ilustrační rezerva. Všechny vstupy nejprve změřit na reprezentativním vzorku. Například samotných 70 × 30 individuálních denních operací = 2 100, před dalšími kroky; z toho nelze dovodit, že Make Free stačí.

Návrh dvou scénářů: (1) společný event intake z gateway přes jeden trigger s rozvětvením podle eventType; (2) plánovaný dávkový běh, který inkrementálně vyzvedne schránku, projde změněné termíny/A6 a měsíční úlohy. Nezávislé e-mailové triggry se nepředstírají v jediném scénáři. Přesný interval určí integrační tým podle změřené spotřeby a limitu aktivních scénářů. Běžné čtení FE nejde přes Make.

Při kvótě zachovat originál a pravdivý čekající/chybový stav; retry pouze idempotentně. Dávky a kurzory omezují API požadavky, ale každá navazující Make operace může mít vlastní spotřebu. Bezplatné možnosti při nedostatku kapacity jsou nižší frekvence dávkových kontrol a funkční ruční cesty. Žádný automatický upgrade na placený tarif ani keep-alive proti pravidlům Supabase.
