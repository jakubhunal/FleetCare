import { describe, expect, it } from "vitest";
import {
  extractReceipt,
  parseLitres,
  parseMoney,
  parseTime,
  receiptMismatches,
} from "../src/domain/receipt-extract";
import type { TextItem } from "../src/domain/stk-extract";
import { receiptPrefill } from "../src/features/fuel-intake";
import { collections } from "../src/domain/models";
import { fixture } from "./factories";

/** Layout of FleetCare form FC-D16 (positions taken from the real PDF). */
const captions: [string, number, number][] = [
  ["Firma", 42, 720],
  ["IČO", 305, 720],
  ["Registrační značka", 42, 676],
  ["VIN", 305, 676],
  ["Řidič", 42, 632],
  ["Interní ID řidiče", 305, 632],
  ["Datum tankování", 42, 557],
  ["Čas tankování", 305, 557],
  ["Částka dle dokladu", 42, 513],
  ["Měna", 217, 513],
  ["Základ částky s nebo bez DPH", 392, 513],
  ["Objem paliva v litrech", 42, 469],
  ["Druh paliva", 217, 469],
  ["Tachometr v km", 392, 469],
  ["Čerpací stanice", 42, 425],
  ["Číslo dokladu nebo transakce", 305, 425],
  ["Identifikace palivové karty", 42, 282],
  ["Název nebo ID přílohy dokladu", 305, 282],
];
const filled: Record<string, string> = {
  Firma: "FleetCare - test aplikace",
  IČO: "Neuvedeno (test)",
  "Registrační značka": "9AZ 9001",
  VIN: "WF0XXXTTGXMK90001",
  Řidič: "Testovací řidič",
  "Interní ID řidiče": "FC-DRV-TEST-01",
  "Datum tankování": "06. 11. 2026",
  "Čas tankování": "07:42",
  "Částka dle dokladu": "2 240,16",
  Měna: "CZK",
  "Základ částky s nebo bez DPH": "Včetně DPH",
  "Objem paliva v litrech": "62,40",
  "Druh paliva": "Motorová nafta",
  "Tachometr v km": "187 056",
  "Čerpací stanice": "Testovací čerpací stanice - Praha",
  "Číslo dokladu nebo transakce": "TEST-PHL-2026-0001",
  "Identifikace palivové karty": "CCS-TEST-0042",
  "Název nebo ID přílohy dokladu": "Bez přílohy - testovací záznam",
};
const form = (values: Record<string, string>): TextItem[] =>
  captions.flatMap(([label, x, y]) => [
    { str: label, x, y, width: label.length * 4.4, page: 1 },
    ...(values[label]
      ? [{ str: values[label], x, y: y - 18, width: 90, page: 1 }]
      : []),
  ]);
const line = (str: string, y: number, x = 40): TextItem => ({
  str,
  x,
  y,
  width: str.length * 5,
  page: 1,
});

describe("receipt extraction", () => {
  it("reads every value of a filled FC-D16 form", () => {
    const r = extractReceipt(form(filled));
    expect(r.state).toBe("completed");
    expect(r.error).toBe("");
    expect(r.fields).toEqual({
      spz: "9AZ 9001",
      vin: "WF0XXXTTGXMK90001",
      driverName: "Testovací řidič",
      date: "2026-11-06",
      time: "07:42",
      amountMinor: 224016,
      currency: "CZK",
      vat: "Včetně DPH",
      litres: 62.4,
      fuel: "Motorová nafta",
      km: 187056,
      station: "Testovací čerpací stanice - Praha",
      receiptNo: "TEST-PHL-2026-0001",
      cardNumber: "CCS-TEST-0042",
    });
  });

  it("never takes a neighbouring caption as a value (blank form)", () => {
    const r = extractReceipt(form({}));
    expect(r.state).toBe("failed");
    expect(r.fields).toEqual({});
    expect(r.error).toContain("nenašli částku, litry ani datum");
  });

  it("reports what is missing and an amount without VAT", () => {
    const r = extractReceipt(
      form({
        ...filled,
        "Čas tankování": "NEDOLOŽENO",
        "Základ částky s nebo bez DPH": "Bez DPH",
      }),
    );
    expect(r.state).toBe("incomplete");
    expect(r.fields.time).toBeUndefined();
    expect(r.missingFields).toEqual(["Čas tankování"]);
    expect(r.error).toContain("V dokumentu chybí: Čas tankování.");
    expect(r.error).toContain("bez DPH");
  });

  it("joins values split into words by the PDF generator", () => {
    const items = form({ ...filled, "Částka dle dokladu": "" });
    items.push(
      { str: "2", x: 42, y: 495, width: 5, page: 1 },
      { str: " ", x: 47, y: 495, width: 2.5, page: 1 },
      { str: "240,16", x: 49.5, y: 495, width: 28, page: 1 },
    );
    expect(extractReceipt(items).fields.amountMinor).toBe(224016);
  });

  it("reads a station e-receipt with one line per value", () => {
    const r = extractReceipt([
      line("Testovací stanice Praha 4", 800),
      line("Datum: 06.11.2026 07:42", 780),
      line("SPZ: 9AZ 9001", 760),
      line("Motorová nafta 62,40 l x 35,90 Kč/l", 740),
      line("Celkem 2 240,16 Kč", 720),
      line("Z toho DPH 21 % 388,79 Kč", 700),
    ]);
    expect(r.state).toBe("completed");
    expect(r.fields).toMatchObject({
      spz: "9AZ 9001",
      date: "2026-11-06",
      time: "07:42",
      litres: 62.4,
      amountMinor: 224016,
      currency: "CZK",
    });
  });

  it("does not pick a date or time when the receipt has several", () => {
    const r = extractReceipt([
      line("SPZ: 9AZ 9001", 760),
      line("06.11.2026 07:42 nákup", 740),
      line("Vytištěno 07.11.2026 08:15", 720),
      line("Celkem 2 240,16 Kč", 700),
    ]);
    expect(r.fields.date).toBeUndefined();
    expect(r.fields.time).toBeUndefined();
    expect(r.missingFields).toEqual([
      "Datum tankování",
      "Čas tankování",
      "Litry",
    ]);
  });

  it("validates numbers instead of guessing", () => {
    expect(parseMoney("2 240,16")).toBe(224016);
    expect(parseMoney("1.234,50 CZK")).toBe(123450);
    expect(parseMoney("2240.16 Kč")).toBe(224016);
    expect(parseMoney("0")).toBeUndefined();
    expect(parseMoney("Včetně DPH")).toBeUndefined();
    expect(parseLitres("62,40 l")).toBe(62.4);
    expect(parseLitres("5000")).toBeUndefined();
    expect(parseTime("7:05")).toBe("07:05");
    expect(parseTime("25:00")).toBeUndefined();
  });
});

describe("receipt against the fuel record", () => {
  const fuel = {
    at: "2026-11-06T06:42:00.000Z",
    litres: 62.4,
    amountMinor: 224016,
    currency: "CZK",
  };
  const car = { spz: "9AZ 9001", vin: "WF0XXXTTGXMK90001" };
  const fields = extractReceipt(form(filled)).fields;

  it("finds no difference when the record matches", () => {
    expect(receiptMismatches(fuel, car, fields)).toEqual([]);
    // 23:30 UTC is already the next day in Prague.
    expect(
      receiptMismatches(
        { ...fuel, at: "2026-11-05T23:30:00.000Z" },
        car,
        fields,
      ),
    ).toEqual([]);
  });

  it("names every value that differs", () => {
    const diffs = receiptMismatches(
      { ...fuel, litres: 60, amountMinor: 200000, at: "2026-11-07T10:00:00Z" },
      { spz: "1QA 0001", vin: "" },
      fields,
    );
    expect(diffs).toHaveLength(4);
    expect(diffs[0]).toBe("vozidlo 9AZ 9001");
    expect(diffs.join(", ")).toMatch(
      /datum 06\. 11\. 2026.*litry 62,4 l.*částka 2\s240,16\sKč/,
    );
  });
});

describe("fuel form filled from a receipt", () => {
  const read = () => extractReceipt(form(filled));
  const workspace = () => {
    const s = fixture();
    s.vehicles[0] = { ...s.vehicles[0], spz: "9AZ 9001" };
    s.cards.push(
      collections.cards.parse({
        id: "c1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        version: 1,
        number: "CCS-TEST-0042",
        active: true,
        toleranceMinor: null,
        bindings: [],
      }),
    );
    return s;
  };
  const manager = { role: "Fleet manažer" as const, driverId: null };

  it("selects the vehicle, driver and card from the records", () => {
    const s = workspace();
    const p = receiptPrefill(s, manager, read());
    expect(p.values).toMatchObject({
      vehicleId: s.vehicles[0].id,
      driverId: s.drivers[0].id,
      at: "2026-11-06T07:42",
      litres: "62,4",
      amountMinor: "2240,16",
      fuel: "Motorová nafta",
      km: 187056,
      station: "Testovací čerpací stanice - Praha",
      cardId: "c1",
    });
    expect(p.extra).toEqual(["fuel", "km", "station", "cardId"]);
    expect(p.notice).toContain("Z účtenky jsme načetli: vozidlo 9AZ 9001");
  });

  it("leaves unknown vehicles to the user and keeps a driver's own record", () => {
    const s = fixture();
    const p = receiptPrefill(
      s,
      { role: "Řidič", driverId: s.drivers[0].id },
      read(),
    );
    expect(p.values.vehicleId).toBeUndefined();
    expect(p.values.driverId).toBeUndefined();
    expect(p.values.cardId).toBeUndefined();
    expect(p.notice).toContain("Vozidlo 9AZ 9001 z účtenky nemáte přidělené");
  });

  it("tells a manager that the receipt's vehicle is not in the records", () => {
    const p = receiptPrefill(fixture(), manager, read());
    expect(p.values.vehicleId).toBeUndefined();
    expect(p.notice).toContain("Vozidlo 9AZ 9001 z účtenky není v evidenci");
  });

  it("does not fill an amount without VAT or a half-known time", () => {
    const r = extractReceipt(
      form({
        ...filled,
        "Čas tankování": "",
        "Základ částky s nebo bez DPH": "Bez DPH",
      }),
    );
    const p = receiptPrefill(workspace(), manager, r);
    expect(p.values.amountMinor).toBeUndefined();
    expect(p.values.at).toBe("");
    expect(p.notice).toContain("Na účtence chybí: Čas tankování.");
    expect(p.notice).toContain("bez DPH");
  });

  it("explains a failed or unavailable reading", () => {
    const s = fixture();
    expect(
      receiptPrefill(s, manager, {
        state: "failed",
        fields: {},
        missingFields: [],
        error: "Z fotografie údaje automaticky nečteme.",
      }).notice,
    ).toContain("nešlo načíst. Z fotografie");
    expect(
      receiptPrefill(s, manager, {
        state: "not_configured",
        fields: {},
        missingFields: [],
        error: "",
      }).notice,
    ).toContain("není v tomto režimu připojené");
  });
});
