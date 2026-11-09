import { extractCcs, type CcsExtraction } from "../src/domain/ccs-extract";
import { pdfTextItems } from "./stk-reader";

/** A CCS statement has the transaction attachment after the summary pages. */
const maxPages = 120;

export async function readCcs(data: Uint8Array): Promise<CcsExtraction> {
  try {
    return extractCcs(await pdfTextItems(data, maxPages));
  } catch (error) {
    console.error("Čtení výpisu CCS selhalo:", (error as Error).message);
    return {
      state: "failed",
      number: null,
      periodFrom: null,
      periodTo: null,
      rows: [],
      blocks: [],
      problems: [],
      error:
        "PDF se nepodařilo přečíst. Zkontrolujte, že jde o nepoškozené PDF výpisu CCS.",
    };
  }
}
