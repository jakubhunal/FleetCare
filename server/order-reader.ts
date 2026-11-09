import { extractOrder, requiredOrderFields } from "../src/domain/order-extract";
import type { OrderExtraction } from "../src/domain/order-extract";
import { pdfTextItems } from "./stk-reader";

export async function readOrder(data: Uint8Array): Promise<OrderExtraction> {
  try {
    return extractOrder(await pdfTextItems(data));
  } catch (error) {
    console.error("Čtení objednávky selhalo:", (error as Error).message);
    return {
      state: "failed",
      fields: {},
      missingFields: Object.values(requiredOrderFields) as string[],
      error:
        "PDF objednávky se nepodařilo přečíst. Údaje doplňte ručně podle přílohy.",
    };
  }
}
