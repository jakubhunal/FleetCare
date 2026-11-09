import { z } from "zod";

/**
 * Reads vehicle data from the text layer of an STK document (FleetCare form
 * FC-D02 "Evidenční list STK" or a protocol with a similar label/value
 * layout). Values are only taken from what the document states: a field
 * that is missing, "NEDOLOŽENO" or fails validation stays empty and is
 * reported as missing, never guessed.
 */
export type TextItem = {
  str: string;
  x: number;
  y: number;
  width: number;
  page: number;
};

export const stkFieldsSchema = z
  .object({
    spz: z.string(),
    vin: z.string(),
    model: z.string(),
    category: z.enum(["Kamion", "Nákladní vozidlo", "Dodávka", "Osobní auto"]),
    stkUntil: z.string(),
    inspectionDate: z.string(),
    odometerKm: z.number(),
    result: z.string(),
    protocolNo: z.string(),
  })
  .partial();
export type StkFields = z.infer<typeof stkFieldsSchema>;

export type StkExtraction = {
  state: "completed" | "incomplete" | "failed";
  fields: StkFields;
  missingFields: string[];
  error: string;
};

const labels = {
  spz: [/^registra[čc]n[ií] zna[čc]ka/i, /^(RZ|SPZ)\b/i],
  vin: [/^VIN\b/i, /^identifika[čc]n[ií] [čc][ií]slo vozidla/i],
  stkUntil: [
    /^p[řr][ií][šs]t[ií] (technick[áa] )?prohl[ií]dka/i,
    /^platnost (technick[ée] prohl[ií]dky |STK )?do/i,
    /^datum p[řr][ií][šs]t[ií]/i,
  ],
  inspectionDate: [/^datum (technick[ée] )?prohl[ií]dky/i],
  odometerKm: [/^tachometr/i, /^stav (po[čc][ií]tadla|tachometru)/i],
  scope: [/^rozsah prohl[ií]dky/i, /^kategorie vozidla/i, /^druh vozidla/i],
  result: [/^v[ýy]sledek/i, /^hodnocen[ií] technick[ée]/i],
  protocolNo: [
    /^[čc][ií]slo protokolu/i,
    /^eviden[čc]n[ií] [čc][ií]slo protokolu/i,
  ],
};
const allLabels = Object.values(labels).flat();
const isLabel = (s: string) => allLabels.some((r) => r.test(s.trim()));

/** Drops "(fiktivní)"-style remarks; "NEDOLOŽENO" and dashes mean no value. */
export function cleanValue(raw: string) {
  const v = raw
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return /^(nedolo[žz]eno|nen[ií] dolo[žz]eno|neuvedeno|nevypln[ěe]no|[-–—]+)$/i.test(
    v,
  )
    ? ""
    : v;
}

export function parseCzDate(raw: string) {
  const v = cleanValue(raw);
  let y: number, m: number, d: number;
  const cz = v.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  const iso = v.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (cz) [d, m, y] = [+cz[1], +cz[2], +cz[3]];
  else if (iso) [y, m, d] = [+iso[1], +iso[2], +iso[3]];
  else return undefined;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return undefined;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export const parsers = {
  spz: (raw: string) => {
    const v = cleanValue(raw).toUpperCase();
    return /^[A-Z0-9][A-Z0-9 -]{3,8}[A-Z0-9]$/.test(v) && /\d/.test(v)
      ? v
      : undefined;
  },
  vin: (raw: string) => {
    const v = cleanValue(raw).replace(/\s/g, "").toUpperCase();
    return /^[A-HJ-NPR-Z0-9]{17}$/.test(v) ? v : undefined;
  },
  date: parseCzDate,
  km: (raw: string) => {
    const v = cleanValue(raw)
      .replace(/km$/i, "")
      .replace(/[\s.  ]/g, "");
    return /^\d{1,7}$/.test(v) ? Number(v) : undefined;
  },
  text: (raw: string) => cleanValue(raw) || undefined,
};

/** Value of a label: the item right below it (form layout) or right of it. */
export function valueOf<T>(
  items: TextItem[],
  patterns: RegExp[],
  parse: (raw: string) => T | undefined,
  labelTest: (s: string) => boolean = isLabel,
): T | undefined {
  for (const label of items) {
    if (!patterns.some((r) => r.test(label.str.trim()))) continue;
    const inline = label.str.split(":").slice(1).join(":");
    const below = items
      .filter(
        (i) =>
          i.page === label.page &&
          Math.abs(i.x - label.x) <= 12 &&
          label.y - i.y > 4 &&
          label.y - i.y <= 35 &&
          !labelTest(i.str),
      )
      .sort((a, b) => b.y - a.y);
    const right = items
      .filter(
        (i) =>
          i.page === label.page &&
          Math.abs(i.y - label.y) <= 2 &&
          i.x >= label.x + label.width &&
          !labelTest(i.str),
      )
      .sort((a, b) => a.x - b.x);
    for (const candidate of [inline, below[0]?.str, right[0]?.str]) {
      if (!candidate?.trim()) continue;
      const value = parse(candidate);
      if (value !== undefined) return value;
    }
  }
  return undefined;
}

export function categoryFrom(text: string): StkFields["category"] {
  // The EU category code (M1, N1–N3) decides; words only when it is missing.
  const code = text.toUpperCase().match(/\b(M1|N1|N2|N3)\b/)?.[1];
  if (code)
    return (
      {
        M1: "Osobní auto",
        N1: "Dodávka",
        N2: "Nákladní vozidlo",
        N3: "Kamion",
      } as const
    )[code];
  if (/\bN3\b|tah[aá][čc]|n[aá]v[ěe]s/i.test(text)) return "Kamion";
  if (/\bN2\b|n[aá]kladn[ií]/i.test(text)) return "Nákladní vozidlo";
  if (/\bN1\b|dod[aá]vk/i.test(text)) return "Dodávka";
  if (/\bM1\b|osobn[ií]/i.test(text)) return "Osobní auto";
  return undefined;
}

/** Manufacturer from the VIN prefix (WMI, ISO 3780) – a fact, not a guess. */
const wmi: Record<string, string> = {
  TMB: "Škoda",
  TMP: "Škoda",
  WVW: "Volkswagen",
  WV1: "Volkswagen",
  WV2: "Volkswagen",
  WV3: "Volkswagen",
  WAU: "Audi",
  WBA: "BMW",
  WDB: "Mercedes-Benz",
  WDD: "Mercedes-Benz",
  WDF: "Mercedes-Benz",
  W1K: "Mercedes-Benz",
  W1N: "Mercedes-Benz",
  W1V: "Mercedes-Benz",
  W1T: "Mercedes-Benz",
  WF0: "Ford",
  WMA: "MAN",
  VF1: "Renault",
  VF6: "Renault Trucks",
  VF3: "Peugeot",
  VF7: "Citroën",
  ZFA: "Fiat",
  ZCF: "Iveco",
  YV1: "Volvo",
  YV2: "Volvo",
  YS2: "Scania",
  XLR: "DAF",
  TMA: "Hyundai",
  VSS: "SEAT",
  U5Y: "Kia",
  JTD: "Toyota",
  SB1: "Toyota",
  VNK: "Toyota",
  W0L: "Opel",
  W0V: "Opel",
  VSK: "Nissan",
  SJN: "Nissan",
  UU1: "Dacia",
};
export const manufacturerFromVin = (vin: string) =>
  wmi[vin.slice(0, 3).toUpperCase()];

export const requiredStkFields = {
  spz: "SPZ",
  vin: "VIN",
  model: "Značka / model",
  category: "Kategorie",
  stkUntil: "Platnost STK do",
} as const;

/**
 * PDF generators differ: some emit a whole field value as one text item,
 * others one item per word ("86", " ", "012"). Neighbouring items on the same
 * line are joined into one phrase; a wide gap (another column) splits them.
 */
export function joinLines(items: TextItem[], maxGap = 12): TextItem[] {
  const sorted = [...items].sort(
    (a, b) => a.page - b.page || b.y - a.y || a.x - b.x,
  );
  const lines: TextItem[] = [];
  for (const item of sorted) {
    const last = lines[lines.length - 1];
    const gap = last ? item.x - (last.x + last.width) : Infinity;
    if (
      last &&
      last.page === item.page &&
      Math.abs(last.y - item.y) <= 2 &&
      gap <= maxGap &&
      gap > -2
    ) {
      const space = gap > 1.5 && !/\s$/.test(last.str) && !/^\s/.test(item.str);
      last.str += (space ? " " : "") + item.str;
      last.width = item.x + item.width - last.x;
    } else lines.push({ ...item });
  }
  return lines
    .map((l) => ({ ...l, str: l.str.replace(/\s+/g, " ").trim() }))
    .filter((l) => l.str);
}

export function extractStk(items: TextItem[]): StkExtraction {
  const words = joinLines(items);
  if (!words.length)
    return {
      state: "failed",
      fields: {},
      missingFields: Object.values(requiredStkFields),
      error:
        "Soubor nemá textovou vrstvu (sken nebo fotografie). Údaje vyplňte ručně podle protokolu.",
    };
  const fields: StkFields = {
    spz: valueOf(words, labels.spz, parsers.spz),
    vin: valueOf(words, labels.vin, parsers.vin),
    stkUntil: valueOf(words, labels.stkUntil, parsers.date),
    inspectionDate: valueOf(words, labels.inspectionDate, parsers.date),
    odometerKm: valueOf(words, labels.odometerKm, parsers.km),
    result: valueOf(words, labels.result, parsers.text),
    protocolNo: valueOf(words, labels.protocolNo, parsers.text),
  };
  fields.vin ??= words.map((w) => parsers.vin(w.str)).find(Boolean);
  fields.category =
    categoryFrom(valueOf(words, labels.scope, parsers.text) || "") ||
    categoryFrom(
      words
        .map((w) => w.str)
        .join(" ")
        .match(/\b[MN][1-3]\b/)?.[0] || "",
    );
  if (fields.vin) fields.model = manufacturerFromVin(fields.vin);
  for (const key of Object.keys(fields) as (keyof StkFields)[])
    if (fields[key] === undefined) delete fields[key];
  const missingFields = Object.entries(requiredStkFields)
    .filter(([key]) => fields[key as keyof StkFields] === undefined)
    .map(([, label]) => label);
  if (!fields.spz && !fields.vin)
    return {
      state: "failed",
      fields,
      missingFields,
      error:
        "V dokumentu jsme nenašli SPZ ani VIN. Údaje vyplňte ručně podle protokolu.",
    };
  return {
    state: missingFields.length ? "incomplete" : "completed",
    fields,
    missingFields,
    error: missingFields.length
      ? `V dokumentu chybí: ${missingFields.join(", ")}.`
      : "",
  };
}
