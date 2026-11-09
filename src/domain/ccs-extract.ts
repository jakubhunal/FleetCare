import type { TextItem } from "./stk-extract";
import { toPragueTimestamp } from "../lib/format";

/**
 * Reads the transaction attachment of a CCS statement ("Příloha k daňovému
 * dokladu") from the text layer of the PDF. The attachment is a list of card
 * blocks: a header with the registration plate and the card number, purchase
 * rows "datum čas stát místo zboží množství … celkem bez DPH DPH %" and a
 * closing "celkem:" row. Every block total is checked against its rows, so a
 * row that could not be read makes the import incomplete instead of silently
 * missing. Values are only taken from the document, never guessed.
 */
export type CcsRow = {
  page: number;
  block: number;
  /** ISO timestamp in UTC. */
  at: string;
  goods: string;
  /** Fuel rows are matched with fuel records; car wash, tolls etc. are not. */
  fuel: boolean;
  quantity: number;
  amountMinor: number;
  currency: string;
};
export type CcsBlock = {
  /** Text of the block header (plate, card number, holder). */
  header: string;
  plate: string | null;
};
export type CcsExtraction = {
  state: "completed" | "incomplete" | "failed";
  number: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  rows: CcsRow[];
  blocks: CcsBlock[];
  problems: string[];
  error?: string;
};

/** Text lines of the page: items on the same height, left to right. */
export function textRows(items: TextItem[]) {
  const sorted = [...items].sort(
    (a, b) => a.page - b.page || b.y - a.y || a.x - b.x,
  );
  const rows: { page: number; y: number; parts: TextItem[] }[] = [];
  for (const item of sorted) {
    const last = rows[rows.length - 1];
    if (last && last.page === item.page && Math.abs(last.y - item.y) <= 2)
      last.parts.push(item);
    else rows.push({ page: item.page, y: item.y, parts: [item] });
  }
  // Generators split one word into several items ("TEST-" "CCS-1992");
  // a space goes only where the PDF leaves a gap.
  return rows
    .map((r) => ({
      page: r.page,
      str: r.parts
        .sort((a, b) => a.x - b.x)
        .reduce(
          (text, p, i, all) =>
            !i
              ? p.str
              : text +
                (p.x - (all[i - 1].x + all[i - 1].width) > 1 ? " " : "") +
                p.str,
          "",
        )
        .replace(/\s+/g, " ")
        .trim(),
    }))
    .filter((r) => r.str);
}

const amount = String.raw`-?\d{1,3}(?:[  ]\d{3})+[.,]\d{2}|-?\d+[.,]\d{2}`;
/** "1 414,70", "1414.70", "-245.53" → minor units. */
export function ccsMoney(raw: string) {
  const v = raw.replace(/[  ]/g, "").replace(",", ".");
  if (!/^-?\d+\.\d{2}$/.test(v)) return undefined;
  return Math.round(Number(v) * 100);
}
const number = (raw: string) => Number(raw.replace(",", "."));

const rowStart =
  /^(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})\s+(\d{1,2})[.:](\d{2})\s+(.+)$/;
const rowTail = new RegExp(
  String.raw`^(?<body>.+?)\s+(?<qty>-?\d+(?:[.,]\d+)?)\s+(?<unitNet>\d+[.,]\d+)\s+(?<unitGross>\d+[.,]\d+)\s+(?<cur>K[čc]|CZK|EUR|[A-Z]{3})\s+(?<total>${amount})\s+(?<net>${amount})\s+(?<vat>${amount})\s+(?<rate>\d{1,2}(?:[.,]\d{1,2})?)\s*%?$`,
  "u",
);
// The goods name ends the row text ("… Pasteurova 2 Natural Plus"); OCR may
// garble the suffix ("Natural Pius"), so only the fuel word itself counts.
// "Benzina" (a station brand) is not "benzín".
const fuelGoods =
  /(?:^|\s)((?:motorov[áa]\s+)?(?:nafta|diesel|natural|nalural|benz[ií]n|ba\s?9[58]|lpg|cng|verva|efecta|e85)(?=$|[\s+]).{0,20})$/iu;
const otherGoods =
  /(?:^|\s)(myt[íi](?:\s+vozu)?|myčka|dálniční\s+známka|mýto|olej|adblue|parkování|kapalina(?:\s+do\s+ostřikovačů)?|zboží|služba)$/iu;
const blockEnd = new RegExp(
  String.raw`^celkem\s*:\s*(?<total>${amount})(?:\s+(?<net>${amount}))?(?:\s+(?<vat>${amount}))?`,
  "iu",
);
const docTotal = new RegExp(
  String.raw`^Celkem(?:\s+za\s+doklad)?\s+(?<total>${amount})(?:\s|$)`,
  "u",
);
const docNumber =
  /(?:Příloha\s+k\s+da[ňn]\.?\s*(?:ov[ée]mu\s+)?dokl(?:\.|adu)?\s*(?:č\.?)?|Číslo\s+(?:dokladu|výpisu)\s*:?)\s*([0-9A-Z][0-9A-Z/-]{3,40})/iu;
const period =
  /(?:Období|uskut\.?\s*zdaň\.?\s*plnění)\s*(?:od\s*[-–—]\s*do)?\s*:?\s*(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})?\s*[-–—]\s*(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})/iu;
const plate =
  /\b(?:VPZ|SPZ|RZ|Registrační\s+značka)\s*:?\s*([0-9A-Z]{1,3}(?:[ -]?[0-9A-Z]{2,5})(?:[ -]?[0-9A-Z]{1,4})?)\b/u;
const day = (d: string, m: string, y: string) =>
  `${y.length === 2 ? "20" + y : y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;

export function extractCcs(items: TextItem[]): CcsExtraction {
  const lines = textRows(items);
  const result: CcsExtraction = {
    state: "failed",
    number: null,
    periodFrom: null,
    periodTo: null,
    rows: [],
    blocks: [],
    problems: [],
  };
  if (!lines.length)
    return {
      ...result,
      error:
        "PDF nemá textovou vrstvu (sken nebo fotografie). Výpis nelze přečíst, vyžádejte si od CCS elektronické PDF.",
    };
  const all = lines.map((l) => l.str).join("\n");
  result.number = all.match(docNumber)?.[1] || null;
  const p = all.match(period);
  if (p) {
    result.periodTo = day(p[4], p[5], p[6]);
    result.periodFrom = day(p[1], p[2], p[3] || p[6]);
  }
  let header: string[] = [];
  let blockRows: CcsRow[] = [];
  let blockTotal = 0;
  let unreadable = 0;
  let total: number | undefined;
  result.blocks.push({ header: "", plate: null });
  for (const line of lines) {
    const end = line.str.match(blockEnd);
    if (end?.groups) {
      const stated = ccsMoney(end.groups.total);
      if (blockRows.length && stated !== undefined && stated !== blockTotal)
        result.problems.push(
          `Na straně ${line.page} nesedí součet karty (${(stated / 100).toFixed(2)} ve výpisu, přečteno ${(blockTotal / 100).toFixed(2)}).`,
        );
      // The header can follow the rows on the page; take it now.
      const block = result.blocks[result.blocks.length - 1];
      block.header = header.join(" ");
      block.plate = block.header.match(plate)?.[1] || null;
      header = [];
      blockRows = [];
      blockTotal = 0;
      result.blocks.push({ header: "", plate: null });
      continue;
    }
    const docSum = line.str.match(docTotal);
    if (docSum?.groups && total === undefined)
      total = ccsMoney(docSum.groups.total);
    const start = line.str.match(rowStart);
    if (!start) {
      header.push(line.str);
      continue;
    }
    const tail = start[6].match(rowTail)?.groups;
    const date = day(start[1], start[2], start[3]);
    const time = `${start[4].padStart(2, "0")}:${start[5]}`;
    let at: string | undefined;
    try {
      at = new Date(toPragueTimestamp(`${date}T${time}`)).toISOString();
    } catch {
      at = undefined;
    }
    const amountMinor = tail ? ccsMoney(tail.total) : undefined;
    if (
      !tail ||
      !at ||
      Number.isNaN(Date.parse(at)) ||
      +start[4] > 23 ||
      amountMinor === undefined
    ) {
      unreadable++;
      result.problems.push(
        `Řádek na straně ${line.page} se nepodařilo přečíst: „${line.str.slice(0, 80)}“.`,
      );
      continue;
    }
    blockTotal += amountMinor;
    if (
      (result.periodFrom && date < result.periodFrom) ||
      (result.periodTo && date > result.periodTo)
    ) {
      result.problems.push(
        `Transakce ${start[1]}.${start[2]}.${start[3]} na straně ${line.page} je mimo období výpisu, nebyla převzata.`,
      );
      continue;
    }
    const fuel = tail.body.match(fuelGoods);
    const other = tail.body.match(otherGoods);
    const row: CcsRow = {
      page: line.page,
      block: result.blocks.length - 1,
      at,
      goods: (fuel?.[1] || other?.[1] || "").trim(),
      fuel: !!fuel,
      quantity: number(tail.qty),
      amountMinor,
      currency: /^K[čc]$/i.test(tail.cur) ? "CZK" : tail.cur,
    };
    blockRows.push(row);
    result.rows.push(row);
  }
  // Header lines after the last "celkem:" belong to no rows.
  const last = result.blocks[result.blocks.length - 1];
  if (blockRows.length) {
    last.header = header.join(" ");
    last.plate = last.header.match(plate)?.[1] || null;
    result.problems.push(
      "U poslední karty chybí řádek „celkem“, výpis může být neúplný.",
    );
  } else result.blocks.pop();
  const sum = result.rows.reduce((a, r) => a + r.amountMinor, 0);
  if (total !== undefined && result.rows.length && total !== sum && !unreadable)
    result.problems.push(
      `Součet převzatých transakcí ${(sum / 100).toFixed(2)} nesouhlasí s celkem dokladu ${(total / 100).toFixed(2)}. Chybí strany nebo transakční příloha.`,
    );
  if (!result.rows.length) {
    result.error = result.problems.length
      ? result.problems.join(" ")
      : "V PDF nebyla nalezena žádná transakce. Nahrajte výpis CCS včetně transakční přílohy (rozpis nákupů po kartách).";
    return result;
  }
  result.state = result.problems.length ? "incomplete" : "completed";
  if (result.problems.length) result.error = result.problems.join(" ");
  return result;
}
