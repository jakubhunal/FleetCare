import { describe, expect, it } from "vitest";
import { extractOrder } from "../src/domain/order-extract";
import { createOrderFromMail } from "../src/domain/order-intake";
import type { TextItem } from "../src/domain/stk-extract";
import { fixture } from "./factories";

/** FC-D08 layout: label, value 12 pt below; two columns. */
function form(pairs: [string, string][]): TextItem[] {
  return pairs.flatMap(([label, value], i) => {
    const x = 40 + (i % 2) * 260;
    const y = 760 - Math.floor(i / 2) * 40;
    return [
      { str: label, x, y, width: 120, page: 1 },
      ...(value ? [{ str: value, x, y: y - 12, width: 150, page: 1 }] : []),
    ];
  });
}
const lines = (rows: string[]): TextItem[] =>
  rows.map((str, i) => ({ str, x: 40, y: 780 - i * 14, width: 300, page: 1 }));

describe("Objednávka z e-mailu", () => {
  it("přečte formulář FC-D08", () => {
    const x = extractOrder(
      form([
        ["Číslo objednávky", "OBJ-1"],
        ["Objednatel název", "Morava Packaging s.r.o."],
        ["Přesná adresa nakládky", "Průmyslová 12, Olomouc"],
        ["Okno nakládky od", "12. 11. 2026 07:00"],
        ["Přesná adresa vykládky", "K Letišti 5, Praha 6"],
        ["Hrubá hmotnost kg", "8 400"],
        ["Dohodnutá cena", "18 500,00"],
        ["Měna", "CZK"],
      ]),
    );
    expect(x.state).toBe("completed");
    expect(x.fields).toMatchObject({
      number: "OBJ-1",
      customer: "Morava Packaging s.r.o.",
      loadFrom: "2026-11-12T06:00:00.000Z",
      weightKg: 8400,
      priceMinor: 1850000,
      currency: "CZK",
    });
  });
  it("přečte i řádky „Popisek: hodnota“", () => {
    const x = extractOrder(
      lines([
        "Objednávka č.: 2026/118",
        "Objednatel: Kovo Brno a.s.",
        "Místo nakládky: Brno, Vídeňská 1",
        "Datum nakládky: 13.11.2026 6:30",
        "Místo vykládky: Plzeň, Borská 3",
      ]),
    );
    expect(x.state).toBe("completed");
    expect(x.fields.customer).toBe("Kovo Brno a.s.");
    expect(x.fields.loadFrom).toBe("2026-11-13T05:30:00.000Z");
  });
  it("prázdný formulář nic nevymyslí a vypíše, co chybí", () => {
    const x = extractOrder(
      form([
        ["Číslo objednávky", ""],
        ["Datum vystavení", ""],
        ["Objednatel název", ""],
        ["IČO", ""],
        ["Přesná adresa nakládky", ""],
        ["Okno nakládky od", ""],
      ]),
    );
    expect(x.fields).toEqual({});
    expect(x.state).toBe("incomplete");
    expect(x.missingFields).toContain("objednatel");
  });
  it("vznikne zakázka: úplná k přiřazení, neúplná k doplnění", () => {
    const s = fixture();
    const full = createOrderFromMail(
      s,
      extractOrder(
        lines([
          "Objednatel: Kovo Brno a.s.",
          "Místo nakládky: Brno",
          "Datum nakládky: 13.11.2026 6:30",
          "Místo vykládky: Plzeň",
        ]),
      ),
      { fileName: "obj.pdf", receivedAt: "2026-11-09T08:00:00.000Z" },
    );
    expect(full).toMatchObject({
      state: "K přiřazení",
      customer: "Kovo Brno a.s.",
    });
    expect(full.stops.map((x) => [x.type, x.place])).toEqual([
      ["Nakládka", "Brno"],
      ["Vykládka", "Plzeň"],
    ]);
    const partial = createOrderFromMail(
      s,
      extractOrder(lines(["Objednatel: X"])),
      {
        fileName: "obj2.pdf",
        receivedAt: "2026-11-09T08:00:00.000Z",
      },
    );
    expect(partial.state).toBe("K doplnění");
    expect(partial.internalNote).toMatch(/Doplňte: adresa nakládky/);
    expect(partial.number).not.toBe(full.number);
  });
});
