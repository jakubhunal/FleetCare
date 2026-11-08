import { readFile } from "node:fs/promises";
import { getDocumentProxy } from "unpdf";
import {
  extractStk,
  requiredStkFields,
  type StkExtraction,
  type TextItem,
} from "../src/domain/stk-extract";

/** Positioned text of the first pages of a PDF (empty for scans). */
export async function pdfTextItems(data: Uint8Array, maxPages = 5) {
  const pdf = await getDocumentProxy(data);
  const items: TextItem[] = [];
  try {
    for (let p = 1; p <= Math.min(pdf.numPages, maxPages); p++) {
      const content = await (await pdf.getPage(p)).getTextContent();
      for (const it of content.items)
        if ("str" in it && it.str.trim())
          items.push({
            str: it.str,
            x: it.transform[4],
            y: it.transform[5],
            width: it.width,
            page: p,
          });
    }
  } finally {
    await pdf.destroy();
  }
  return items;
}

export async function readStk(
  path: string,
  mime: string,
): Promise<StkExtraction> {
  const missingFields = Object.values(requiredStkFields);
  if (mime !== "application/pdf")
    return {
      state: "failed",
      fields: {},
      missingFields,
      error:
        "Z fotografie údaje automaticky nečteme. Vyplňte je ručně podle protokolu, nebo nahrajte PDF.",
    };
  try {
    return extractStk(await pdfTextItems(new Uint8Array(await readFile(path))));
  } catch (error) {
    console.error("Čtení STK selhalo:", (error as Error).message);
    return {
      state: "failed",
      fields: {},
      missingFields,
      error: "PDF se nepodařilo přečíst. Vyplňte údaje ručně podle protokolu.",
    };
  }
}
