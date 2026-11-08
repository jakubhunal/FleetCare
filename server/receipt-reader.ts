import {
  extractReceipt,
  requiredReceiptFields,
  type ReceiptExtraction,
} from "../src/domain/receipt-extract";
import { pdfTextItems } from "./stk-reader";

export async function readReceipt(
  data: Uint8Array,
  mime: string,
): Promise<ReceiptExtraction> {
  const missingFields = Object.values(requiredReceiptFields);
  if (mime !== "application/pdf")
    return {
      state: "failed",
      fields: {},
      missingFields,
      error:
        "Z fotografie údaje automaticky nečteme. Vyplňte je ručně podle účtenky, nebo nahrajte PDF.",
    };
  try {
    return extractReceipt(await pdfTextItems(data));
  } catch (error) {
    console.error("Čtení účtenky selhalo:", (error as Error).message);
    return {
      state: "failed",
      fields: {},
      missingFields,
      error: "PDF se nepodařilo přečíst. Vyplňte údaje ručně podle účtenky.",
    };
  }
}
