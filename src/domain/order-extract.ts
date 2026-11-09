import { toPragueTimestamp } from "../lib/format";
import {
  cleanValue,
  joinLines,
  parseCzDate,
  valueOf,
  type TextItem,
} from "./stk-extract";

/**
 * Reads a transport order (FleetCare form FC-D08 "Objednávka nákladní
 * přepravy", or an order with "Label: value" lines) from the PDF text layer.
 * Only what the document states is taken; anything missing is listed so the
 * order is created as "K doplnění" instead of being guessed.
 */
export type OrderFields = {
  number?: string;
  customer?: string;
  reference?: string;
  contact?: string;
  loadPlace?: string;
  loadFrom?: string;
  loadTo?: string;
  unloadPlace?: string;
  unloadFrom?: string;
  unloadTo?: string;
  cargo?: string;
  weightKg?: number;
  volumeM3?: number;
  pallets?: number;
  dimensions?: string;
  equipment?: string;
  priceMinor?: number;
  currency?: string;
};
export type OrderExtraction = {
  state: "completed" | "incomplete" | "failed";
  fields: OrderFields;
  missingFields: string[];
  error?: string;
};

const labels: Record<keyof OrderFields, RegExp[]> = {
  number: [/^Číslo objednávky/i, /^Objednávka\s+č\.?\s*:/i],
  customer: [/^Objednatel\s+název/i, /^Objednatel\s*:/i, /^Zákazník/i],
  reference: [/^Reference zákazníka/i],
  contact: [/^Kontaktní osoba objednatele/i],
  loadPlace: [/^Přesná adresa nakládky/i, /^(Místo|Adresa) nakládky/i],
  loadFrom: [/^Okno nakládky od/i, /^Datum nakládky/i],
  loadTo: [/^Okno nakládky do/i],
  unloadPlace: [/^Přesná adresa vykládky/i, /^(Místo|Adresa) vykládky/i],
  unloadFrom: [/^Okno vykládky od/i, /^Datum vykládky/i],
  unloadTo: [/^Okno vykládky do/i],
  cargo: [/^Druh a popis přepravované zásilky/i, /^Popis zásilky/i],
  weightKg: [/^Hrubá hmotnost/i, /^Hmotnost/i],
  volumeM3: [/^Objem/i],
  pallets: [/^Paletová místa/i, /^Počet palet/i],
  dimensions: [/^Rozměry/i],
  equipment: [/^Požadované vybavení vozidla/i],
  priceMinor: [/^Dohodnutá cena/i, /^Cena\s*:/i],
  currency: [/^Měna/i],
};
/** Other texts of the FC-D08 form; an empty field must not take them as its value. */
const formTexts = [
  /^FleetCare/i,
  /^Objednávka nákladní přepravy/i,
  /^Zadání přepravy/i,
  /^FC-D08/i,
  /^Vyplňte podle/i,
  /^Objednávka a smluvní strany/i,
  /^Datum vystavení/i,
  /^Objednatel$/i,
  /^IČO/i,
  /^Fakturační adresa/i,
  /^Telefon nebo e-mail/i,
  /^Dopravce/i,
  /^Sídlo dopravce/i,
  /^Nakládka$/i,
  /^Vykládka$/i,
  /^Odesílatel/i,
  /^Příjemce/i,
  /^Kontaktní osoba/i,
  /^Strana \d/i,
  /^Zásilka a požadavky/i,
  /^Počet kusů/i,
  /^Značky a čísla/i,
  /^Pokyny k manipulaci/i,
  /^Přiložené zvláštní/i,
  /^Cena a přijetí/i,
  /^Částka s DPH/i,
  /^Splatnost/i,
  /^Další náklady/i,
  /^Odkaz na smlouvu/i,
  /^Datum a čas přijetí/i,
  /^Potvrdil za dopravce/i,
  /^Přijetí objednávky nepotvrzuje/i,
  /^Řidiče a vozidlo/i,
  /^Za dopravce/i,
  /^Tyto události/i,
];
const all = [...Object.values(labels).flat(), ...formTexts];
const isFormText = (s: string) => all.some((r) => r.test(s.trim()));

const text = (raw: string) => cleanValue(raw) || undefined;
const amount = (raw: string) => {
  const m = cleanValue(raw)
    .replace(/[  ]/g, "")
    .match(/^(\d+(?:[.,]\d+)?)/);
  return m ? Number(m[1].replace(",", ".")) : undefined;
};
/** "12. 11. 2026 08:00" → ISO timestamp (Prague time). */
const when = (raw: string) => {
  const date = parseCzDate(raw);
  if (!date) return undefined;
  const t = cleanValue(raw).match(/(\d{1,2})[:.](\d{2})(?!\.\d)/g);
  const time = t?.length ? t[t.length - 1].replace(".", ":") : "00:00";
  try {
    return new Date(
      toPragueTimestamp(`${date}T${time.padStart(5, "0")}`),
    ).toISOString();
  } catch {
    return undefined;
  }
};
const money = (raw: string) => {
  const v = cleanValue(raw)
    .replace(/[  ]/g, "")
    .replace(/(Kč|CZK|EUR|€)$/i, "")
    .replace(",", ".");
  return /^\d+(\.\d{1,2})?$/.test(v) ? Math.round(Number(v) * 100) : undefined;
};
const parse: { [K in keyof OrderFields]: (raw: string) => OrderFields[K] } = {
  number: text,
  customer: text,
  reference: text,
  contact: text,
  loadPlace: text,
  loadFrom: when,
  loadTo: when,
  unloadPlace: text,
  unloadFrom: when,
  unloadTo: when,
  cargo: text,
  weightKg: amount,
  volumeM3: amount,
  pallets: amount,
  dimensions: text,
  equipment: text,
  priceMinor: money,
  currency: (raw) =>
    cleanValue(raw)
      .toUpperCase()
      .match(/^(CZK|EUR|KČ)/)?.[1]
      ?.replace("KČ", "CZK"),
};
/** Without these the dispatcher cannot assign the order. */
export const requiredOrderFields: Partial<Record<keyof OrderFields, string>> = {
  customer: "objednatel",
  loadPlace: "adresa nakládky",
  loadFrom: "termín nakládky",
  unloadPlace: "adresa vykládky",
};

export function extractOrder(items: TextItem[]): OrderExtraction {
  const words = joinLines(items);
  if (!words.length)
    return {
      state: "failed",
      fields: {},
      missingFields: Object.values(requiredOrderFields),
      error:
        "Objednávka nemá textovou vrstvu (sken nebo fotografie). Údaje doplňte ručně podle přiloženého PDF.",
    };
  const fields: OrderFields = {};
  for (const key of Object.keys(labels) as (keyof OrderFields)[]) {
    const value = valueOf(
      words,
      labels[key],
      parse[key] as (raw: string) => never,
      isFormText,
    );
    if (value !== undefined) (fields as Record<string, unknown>)[key] = value;
  }
  const missingFields = Object.entries(requiredOrderFields)
    .filter(([k]) => fields[k as keyof OrderFields] === undefined)
    .map(([, label]) => label!);
  return {
    state: missingFields.length ? "incomplete" : "completed",
    fields,
    missingFields,
  };
}
