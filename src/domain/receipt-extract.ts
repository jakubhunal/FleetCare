import { z } from "zod";
import {
  cleanValue,
  joinLines,
  parseCzDate,
  parsers as stkParsers,
  valueOf,
  type TextItem,
} from "./stk-extract";
import { dateKey, money, normalize, number } from "../lib/format";

/**
 * Reads a fuel receipt from the text layer of a PDF: the FleetCare form FC-D16
 * "Záznam tankování" (label above value) or an e-receipt with "Label: value"
 * lines. Like the STK reader it only takes what the document states – an
 * unreadable or missing value stays empty and is reported, never guessed.
 */
export const receiptFieldsSchema = z
  .object({
    spz: z.string(),
    vin: z.string(),
    driverName: z.string(),
    date: z.string(),
    time: z.string(),
    amountMinor: z.number().int(),
    currency: z.string(),
    vat: z.enum(["Včetně DPH", "Bez DPH"]),
    litres: z.number(),
    fuel: z.string(),
    km: z.number(),
    station: z.string(),
    receiptNo: z.string(),
    cardNumber: z.string(),
  })
  .partial();
export type ReceiptFields = z.infer<typeof receiptFieldsSchema>;

export const receiptReadSchema = z.object({
  state: z.enum(["completed", "incomplete", "failed", "not_configured"]),
  fields: receiptFieldsSchema,
  missingFields: z.array(z.string()),
  error: z.string(),
});
export type ReceiptExtraction = z.infer<typeof receiptReadSchema> & {
  state: "completed" | "incomplete" | "failed";
};
/** What the app gets back when it asks for a receipt to be read. */
export type ReceiptRead = z.infer<typeof receiptReadSchema>;

const labels = {
  spz: [/^registra[čc]n[ií] zna[čc]ka/i, /^(RZ|SPZ)\b/i],
  vin: [/^VIN\b/i],
  driverName: [/^[řr]idi[čc]\s*:?$/i, /^jm[ée]no [řr]idi[čc]e/i],
  date: [
    /^datum tankov[áa]n[ií]/i,
    /^datum (transakce|n[áa]kupu|prodeje|uskute[čc]n[ěe]n[ií])/i,
    /^datum\s*:?$/i,
  ],
  time: [
    /^[čc]as tankov[áa]n[ií]/i,
    /^[čc]as (transakce|n[áa]kupu|prodeje)/i,
    /^[čc]as\s*:?$/i,
  ],
  amount: [
    /^[čc][áa]stka dle dokladu/i,
    /^celkov[áa] [čc][áa]stka/i,
    /^celkem( k [úu]hrad[ěe])?/i,
    /^k [úu]hrad[ěe]/i,
    /^k zaplacen[ií]/i,
  ],
  currency: [/^m[ěe]na\s*:?$/i],
  vat: [/^z[áa]klad [čc][áa]stky/i],
  litres: [/^objem paliva/i, /^mno[žz]stv[ií]/i, /^po[čc]et litr[ůu]/i],
  fuel: [/^druh paliva/i, /^palivo\s*:?$/i],
  km: [/^tachometr/i, /^stav tachometru/i],
  station: [/^[čc]erpac[ií] stanice/i],
  receiptNo: [
    /^[čc][ií]slo dokladu/i,
    /^[čc][ií]slo (transakce|[úu][čc]tenky)/i,
  ],
  cardNumber: [
    /^identifikace palivov[ée] karty/i,
    /^(palivov[áa]|CCS) karta/i,
    /^[čc][ií]slo (palivov[ée] )?karty/i,
  ],
};

/** Other captions of FC-D16 – a caption is never a value of its neighbour. */
const otherCaptions = [
  /^firma$/i,
  /^I[ČC]O$/i,
  /^intern[ií] ID/i,
  /^skute[čc]n[áa] transakce/i,
  /^pln[áa] n[áa]dr[žz]/i,
  /^(ano|ne|nelze dolo[žz]it)$/i,
  /^[úu]hrada a podklad/i,
  /^zp[ůu]sob [úu]hrady/i,
  /^(CCS|jin[áa] karta|hotov[ěe]|jin[ýy] zp[ůu]sob)$/i,
  /^n[áa]zev nebo ID p[řr][ií]lohy/i,
  /^pozn[áa]mka/i,
  /^zapsal nebo potvrdil/i,
  /^datum z[áa]pisu/i,
];
const isCaption = (s: string) =>
  [...Object.values(labels).flat(), ...otherCaptions].some((r) =>
    r.test(s.trim()),
  );
const notCaption =
  <T>(parse: (raw: string) => T | undefined) =>
  (raw: string) =>
    isCaption(raw) ? undefined : parse(raw);

/** "2 240,16", "2240.16 Kč", "1.234,50 CZK" → minor units (haléře). */
export function parseMoney(raw: string) {
  const v = cleanValue(raw)
    .replace(/(k[čc]|czk|eur|€|,-)\s*$/i, "")
    .replace(/[\s  ]/g, "");
  let n: number | undefined;
  if (/^\d+([.,]\d{1,2})?$/.test(v)) n = Number(v.replace(",", "."));
  else if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(v))
    n = Number(v.replace(/\./g, "").replace(",", "."));
  else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(v))
    n = Number(v.replace(/,/g, ""));
  return n !== undefined && n > 0 && n < 10_000_000
    ? Math.round(n * 100)
    : undefined;
}

/** "62,40", "62.4 l", "62,40 litrů" → 62.4 (a truck tank holds < 2000 l). */
export function parseLitres(raw: string) {
  const v = cleanValue(raw)
    .replace(/\s*(l|lt|litr[ůuy]?)\.?$/i, "")
    .replace(/[\s  ]/g, "");
  if (!/^\d{1,4}([.,]\d{1,3})?$/.test(v)) return undefined;
  const n = Number(v.replace(",", "."));
  return n > 0 && n < 2000 ? n : undefined;
}

export function parseTime(raw: string) {
  const m = cleanValue(raw).match(/^(\d{1,2}):(\d{2})(:\d{2})?$/);
  if (!m || +m[1] > 23 || +m[2] > 59) return undefined;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

const parseCurrency = (raw: string) => {
  const v = cleanValue(raw).toUpperCase();
  if (/^(K[ČC]|CZK)$/.test(v)) return "CZK";
  if (/^(EUR|€)$/.test(v)) return "EUR";
  return /^[A-Z]{3}$/.test(v) ? v : undefined;
};
const parseVat = (raw: string) => {
  const v = cleanValue(raw);
  if (/^(v[čc]etn[ěe]|v[čc]\.)\s*DPH/i.test(v)) return "Včetně DPH" as const;
  if (/^bez\s*DPH/i.test(v)) return "Bez DPH" as const;
  return undefined;
};
const parseName = (raw: string) => {
  const v = cleanValue(raw);
  return /^\p{L}[\p{L} .'-]{1,60}$/u.test(v) ? v : undefined;
};

export const requiredReceiptFields = {
  vehicle: "SPZ nebo VIN",
  date: "Datum tankování",
  time: "Čas tankování",
  litres: "Litry",
  amountMinor: "Částka",
} as const;

/** "Celkem 2 240,16 Kč" in a single piece of text, as e-receipts print it. */
function sameLine<T>(
  lines: TextItem[],
  patterns: RegExp[],
  parse: (raw: string) => T | undefined,
) {
  for (const line of lines)
    for (const pattern of patterns) {
      const m = line.str.match(pattern);
      if (!m) continue;
      const value = parse(line.str.slice(m[0].length).replace(/^[\s:=]+/, ""));
      if (value !== undefined) return value;
    }
  return undefined;
}

/** A value that appears exactly once in the document (one date, one time). */
function onlyOne<T>(texts: string[], pattern: RegExp, parse: (s: string) => T) {
  const found = new Set(
    texts.flatMap((t) => [...t.matchAll(pattern)].map((m) => parse(m[0]))),
  );
  found.delete(undefined as T);
  return found.size === 1 ? [...found][0] : undefined;
}

export function extractReceipt(items: TextItem[]): ReceiptExtraction {
  const lines = joinLines(items);
  if (!lines.length)
    return {
      state: "failed",
      fields: {},
      missingFields: Object.values(requiredReceiptFields),
      error:
        "Soubor nemá textovou vrstvu (sken nebo fotografie). Údaje vyplňte ručně podle účtenky.",
    };
  // Free text after a caption on the same line is only taken behind a colon
  // (valueOf); "Číslo dokladu nebo transakce" must not become a number.
  const read = <T>(
    patterns: RegExp[],
    parse: (raw: string) => T | undefined,
    freeText = false,
  ) =>
    valueOf(lines, patterns, notCaption(parse)) ??
    (freeText ? undefined : sameLine(lines, patterns, notCaption(parse)));
  const fields: ReceiptFields = {
    spz: read(labels.spz, stkParsers.spz),
    vin: read(labels.vin, stkParsers.vin),
    driverName: read(labels.driverName, parseName, true),
    date: read(labels.date, parseCzDate),
    time: read(labels.time, parseTime),
    amountMinor: read(labels.amount, parseMoney),
    currency: read(labels.currency, parseCurrency),
    vat: read(labels.vat, parseVat),
    litres: read(labels.litres, parseLitres),
    fuel: read(labels.fuel, stkParsers.text, true),
    km: read(labels.km, stkParsers.km),
    station: read(labels.station, stkParsers.text, true),
    receiptNo: read(labels.receiptNo, stkParsers.text, true),
    cardNumber: read(labels.cardNumber, stkParsers.text, true),
  };
  const texts = lines.map((l) => l.str);
  // Receipts without labels: a date or time is only used when it is the only
  // one in the document, litres only next to a litre unit.
  fields.date ??= onlyOne(
    texts,
    /\b\d{1,2}\.\s*\d{1,2}\.\s*\d{4}\b/g,
    parseCzDate,
  );
  fields.time ??= onlyOne(texts, /\b\d{1,2}:\d{2}(:\d{2})?\b/g, parseTime);
  fields.litres ??= onlyOne(
    texts,
    /\b\d{1,4}[.,]\d{1,3}\s*(l|litr[ůuy]?)\b/gi,
    parseLitres,
  );
  fields.currency ??= /(?<![\p{L}\d])(K[čc]|CZK)(?!\p{L})/u.test(
    texts.join(" "),
  )
    ? "CZK"
    : undefined;
  for (const key of Object.keys(fields) as (keyof ReceiptFields)[])
    if (fields[key] === undefined) delete fields[key];

  const missingFields = Object.entries(requiredReceiptFields)
    .filter(([key]) =>
      key === "vehicle"
        ? !fields.spz && !fields.vin
        : fields[key as keyof ReceiptFields] === undefined,
    )
    .map(([, label]) => label);
  if (
    fields.amountMinor === undefined &&
    fields.litres === undefined &&
    !fields.date
  )
    return {
      state: "failed",
      fields,
      missingFields,
      error:
        "V dokumentu jsme nenašli částku, litry ani datum tankování. Údaje vyplňte ručně podle účtenky.",
    };
  const problems = [
    ...(missingFields.length
      ? [`V dokumentu chybí: ${missingFields.join(", ")}.`]
      : []),
    ...(fields.vat === "Bez DPH"
      ? ["Částka na dokladu je bez DPH, doplňte částku včetně DPH."]
      : []),
  ];
  return {
    state: problems.length ? "incomplete" : "completed",
    fields,
    missingFields,
    error: problems.join(" "),
  };
}

/**
 * Differences between a receipt and the fuel record it is attached to, as
 * readable phrases ("částka 2 240,16 Kč"). Only values read from the receipt
 * are compared; a value the receipt does not state is not a difference.
 */
export function receiptMismatches(
  fuel: {
    at: string;
    litres: number | null;
    amountMinor: number | null;
    currency?: string;
  },
  vehicle: { spz: string; vin: string } | undefined,
  fields: ReceiptFields,
) {
  const out: string[] = [];
  const plain = (v = "") => normalize(v).replace(/-/g, "");
  if (
    vehicle &&
    ((fields.spz && plain(fields.spz) !== plain(vehicle.spz)) ||
      (fields.vin && vehicle.vin && plain(fields.vin) !== plain(vehicle.vin)))
  )
    out.push(`vozidlo ${fields.spz || fields.vin}`);
  if (fields.date && fuel.at && fields.date !== dateKey(fuel.at))
    out.push(`datum ${fields.date.split("-").reverse().join(". ")}`);
  if (
    fields.litres !== undefined &&
    fuel.litres !== null &&
    Math.abs(fields.litres - fuel.litres) > 0.005
  )
    out.push(`litry ${number(fields.litres, "l")}`);
  if (
    fields.amountMinor !== undefined &&
    fields.vat !== "Bez DPH" &&
    fuel.amountMinor !== null &&
    (fields.amountMinor !== fuel.amountMinor ||
      (fields.currency && fields.currency !== (fuel.currency || "CZK")))
  )
    out.push(`částka ${money(fields.amountMinor, fields.currency || "CZK")}`);
  return out;
}
