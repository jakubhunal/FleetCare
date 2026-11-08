import { describe, expect, it } from "vitest";
import {
  extractStk,
  parseCzDate,
  type TextItem,
} from "../src/domain/stk-extract";
import {
  matchingVehicle,
  stkIntakeNotice,
} from "../src/features/vehicle-intake";
import { fixture } from "./factories";

/** Layout of FleetCare form FC-D02: value 21 pt below its label. */
const form = (values: Record<string, string>): TextItem[] => {
  const rows: [string, number, number][] = [
    ["Registrační značka", 42, 645],
    ["VIN", 305, 645],
    ["Číslo protokolu", 42, 601],
    ["Datum prohlídky", 305, 601],
    ["Druh prohlídky", 42, 513],
    ["Rozsah prohlídky", 305, 513],
    ["Tachometr dle protokolu v km", 42, 438],
    ["Výsledek přesně dle originálu", 305, 438],
    ["Příští prohlídka do", 42, 394],
    ["Zdrojové pole nebo stránka termínu", 305, 394],
  ];
  return rows.flatMap(([label, x, y]) => [
    { str: label, x, y, width: label.length * 4.5, page: 1 },
    ...(values[label]
      ? [{ str: values[label], x: x + 1, y: y - 21, width: 80, page: 1 }]
      : []),
  ]);
};

describe("STK extraction", () => {
  it("reads a complete FC-D02 form", () => {
    const r = extractStk(
      form({
        "Registrační značka": "9T0 0001",
        VIN: "TMBJR7NS4L1234567",
        "Datum prohlídky": "05. 11. 2026",
        "Rozsah prohlídky": "Nákladní automobil N1",
        "Tachometr dle protokolu v km": "120 300",
        "Výsledek přesně dle originálu": "Způsobilé",
        "Příští prohlídka do": "04. 11. 2028",
        "Zdrojové pole nebo stránka termínu": "Protokol str. 1",
      }),
    );
    expect(r).toMatchObject({
      state: "completed",
      missingFields: [],
      fields: {
        spz: "9T0 0001",
        vin: "TMBJR7NS4L1234567",
        model: "Škoda",
        category: "Dodávka",
        stkUntil: "2028-11-04",
        inspectionDate: "2026-11-05",
        odometerKm: 120300,
        result: "Způsobilé",
      },
    });
  });

  it("never fills an undocumented value (sample from the tests)", () => {
    const r = extractStk(
      form({
        "Registrační značka": "1AB 2345 (fiktivní)",
        VIN: "TMBAB7NE0J0123456 (fiktivní)",
        "Rozsah prohlídky": "Osobní automobil M1",
        "Výsledek přesně dle originálu": "NEDOLOŽENO",
        "Příští prohlídka do": "NEDOLOŽENO",
        "Zdrojové pole nebo stránka termínu": "Protokol nebyl předložen",
      }),
    );
    expect(r.state).toBe("incomplete");
    expect(r.fields).toMatchObject({
      spz: "1AB 2345",
      vin: "TMBAB7NE0J0123456",
      category: "Osobní auto",
    });
    expect(r.fields.stkUntil).toBeUndefined();
    expect(r.fields.result).toBeUndefined();
    expect(r.missingFields).toEqual(["Platnost STK do"]);
  });

  it("fails truthfully without a text layer or vehicle identity", () => {
    expect(extractStk([]).state).toBe("failed");
    expect(
      extractStk([{ str: "Faktura", x: 0, y: 0, width: 30, page: 1 }]).state,
    ).toBe("failed");
  });

  it("joins word-by-word PDF text and reads a label-left table", () => {
    const words = (str: string, x: number, y: number) =>
      str.split(/(\s)/).reduce<TextItem[]>((acc, w) => {
        const prev = acc[acc.length - 1];
        const at = prev ? prev.x + prev.width : x;
        return [...acc, { str: w, x: at, y, width: w.length * 5, page: 1 }];
      }, []);
    const r = extractStk([
      ...words("Registrační značka", 40, 700),
      ...words("5T7 4411", 220, 700),
      ...words("Identifikační číslo vozidla (VIN)", 40, 680),
      ...words("YS2R4X20005123456", 220, 680),
      ...words("Kategorie vozidla", 40, 660),
      ...words("N3 – nákladní automobil, tahač", 220, 660),
      ...words("Platnost technické prohlídky do", 40, 640),
      ...words("3.11.2027", 220, 640),
      ...words("Stav počítadla", 40, 620),
      ...words("412 380 km", 220, 620),
    ]);
    expect(r).toMatchObject({
      state: "completed",
      fields: {
        spz: "5T7 4411",
        vin: "YS2R4X20005123456",
        model: "Scania",
        category: "Kamion",
        stkUntil: "2027-11-03",
        odometerKm: 412380,
      },
    });
  });

  it("reads 'Label: value' lines", () => {
    const line = (str: string, y: number): TextItem => ({
      str,
      x: 40,
      y,
      width: str.length * 5,
      page: 1,
    });
    const r = extractStk([
      line("Registrační značka: 2AC 7788", 700),
      line("VIN: WF0XXXTTGXKA12345", 685),
      line("Rozsah prohlídky: N1", 670),
      line("Příští prohlídka do: 2028-01-31", 655),
    ]);
    expect(r.fields).toMatchObject({
      spz: "2AC 7788",
      model: "Ford",
      category: "Dodávka",
      stkUntil: "2028-01-31",
    });
  });

  it("rejects invalid dates", () => {
    expect(parseCzDate("31. 02. 2027")).toBeUndefined();
    expect(parseCzDate("1.3.2027")).toBe("2027-03-01");
  });

  it("finds an existing vehicle by VIN or SPZ and explains the result", () => {
    const car = { ...fixture().vehicles[0], spz: "1AB 2345", vin: "" };
    const job = {
      jobId: "d1",
      state: "incomplete" as const,
      fields: { spz: "1ab2345" },
      missingFields: ["VIN"],
    };
    expect(matchingVehicle([car], job)?.id).toBe(car.id);
    expect(stkIntakeNotice(job)).toContain("V dokumentu chybí: VIN");
    expect(stkIntakeNotice({ jobId: "x", state: "not_configured" })).toContain(
      "není v tomto režimu připojené",
    );
  });
});
