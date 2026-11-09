import { describe, expect, it } from "vitest";
import { ccsMoney, extractCcs } from "../src/domain/ccs-extract";
import { importCcsStatement } from "../src/domain/ccs";
import type { TextItem } from "../src/domain/stk-extract";
import { collections, meta } from "../src/domain/models";
import { fixture } from "./factories";

/** One text item per column, as CCS prints the transaction attachment. */
function page(lines: string[][], pageNo = 1): TextItem[] {
  return lines.flatMap((cols, row) =>
    cols.map((str, col) => ({
      str,
      x: 30 + col * 60,
      y: 780 - row * 14,
      width: 40,
      page: pageNo,
    })),
  );
}
const header = [
  ["Příloha k daň.dokl.č. 6050029/5188965167/2026"],
  ["Datum uskut.zdaň.plnění: 01.10.-31.10.2026"],
  ["VPZ 4AB 2186"],
  ["Karta: 7083 0001 0042"],
  ["Datum", "Čas", "Stát", "Místo", "Název", "Množství", "Celkem"],
];
const row = (
  d: string,
  t: string,
  goods: string,
  qty: string,
  total: string,
) => [
  d,
  t,
  "ČR",
  "Praha 6, Evropská",
  "2",
  goods,
  qty,
  "29.34",
  "35.50",
  "Kč",
  total,
  "0.00",
  "0.00",
  "21.0",
];

describe("CCS statement reading", () => {
  it("reads money in both notations", () => {
    expect(ccsMoney("1414.70")).toBe(141470);
    expect(ccsMoney("1 414,70")).toBe(141470);
    expect(ccsMoney("-950.13")).toBe(-95013);
    expect(ccsMoney("12")).toBeUndefined();
  });
  it("reads card blocks, rows and checks the block total", () => {
    const x = extractCcs(
      page([
        ...header,
        row("02.10.26", "07.16", "Nafta", "43.00", "1414.70"),
        row("05.10.2026", "16:57", "Mytí vozu", "1.00", "250.00"),
        ["celkem:", "1664.70", "0.00", "0.00"],
      ]),
    );
    expect(x.state).toBe("completed");
    expect(x.number).toBe("6050029/5188965167/2026");
    expect([x.periodFrom, x.periodTo]).toEqual(["2026-10-01", "2026-10-31"]);
    expect(x.blocks[0].plate).toBe("4AB 2186");
    expect(x.rows).toHaveLength(2);
    expect(x.rows[0]).toMatchObject({
      at: "2026-10-02T05:16:00.000Z",
      fuel: true,
      quantity: 43,
      amountMinor: 141470,
      currency: "CZK",
    });
    expect(x.rows[1].fuel).toBe(false);
  });
  it("a row that cannot be read makes the statement incomplete", () => {
    const x = extractCcs(
      page([
        ...header,
        row("02.10.26", "07.16", "Nafta", "43.00", "1414.70"),
        ["03.10.26 08.10 ČR Praha Nafta 4 3.0 0 2 7.19 Kč 1 4"],
        ["celkem:", "2828.40", "0.00", "0.00"],
      ]),
    );
    expect(x.state).toBe("incomplete");
    expect(x.error).toMatch(/nepodařilo přečíst/);
    expect(x.error).toMatch(/nesedí součet/);
  });
  it("a date outside the statement period is not taken over", () => {
    const x = extractCcs(
      page([
        ...header,
        row("10.06.16", "16.57", "Nafta", "52.45", "1725.60"),
        ["celkem:", "1725.60"],
      ]),
    );
    expect(x.rows).toHaveLength(0);
    expect(x.state).toBe("failed");
    expect(x.error).toMatch(/mimo období/);
  });
  it("a scan without text layer fails with a reason", () => {
    const x = extractCcs([]);
    expect(x.state).toBe("failed");
    expect(x.error).toMatch(/textovou vrstvu/);
  });
});

describe("CCS statement import", () => {
  function setup() {
    const s = fixture();
    const v = s.vehicles[0];
    v.spz = "4AB 2186";
    s.cards.push(
      collections.cards.parse({
        ...meta("card"),
        number: "7083 0001 0042",
        active: true,
        toleranceMinor: 5000,
        bindings: [{ vehicleId: v.id, from: "2026-01-01", to: null }],
      }),
    );
    s.fuels.push(
      collections.fuels.parse({
        ...meta("fuel"),
        vehicleId: v.id,
        driverId: s.drivers[0].id,
        cardId: "card",
        at: "2026-10-02T05:16:00.000Z",
        amountMinor: 141000,
        currency: "CZK",
        litres: 43,
        full: "Ano",
        state: "Čeká na výpis",
      }),
    );
    s.statements.push(
      collections.statements.parse({
        ...meta("st"),
        name: "vypis.pdf",
        periodFrom: null,
        periodTo: null,
        receivedAt: new Date().toISOString(),
        processing: "not_configured",
      }),
    );
    const x = extractCcs(
      page([
        ...header,
        row("02.10.26", "07.16", "Nafta", "43.00", "1414.70"),
        row("04.10.26", "12.00", "Natural Plus", "20.00", "710.00"),
        row("05.10.26", "16.57", "Mytí vozu", "1.00", "250.00"),
        ["celkem:", "2374.70"],
      ]),
    );
    return { s, x, v };
  }
  it("stores fuel rows, pairs them and fills the statement", () => {
    const { s, x, v } = setup();
    const r = importCcsStatement(s, "st", x);
    expect(r).toMatchObject({ created: 2, known: 0, other: 1 });
    const [paired, missing] = s.transactions;
    expect(paired).toMatchObject({
      cardId: "card",
      vehicleId: v.id,
      fuelId: "fuel",
      state: "Spárováno",
      litres: 43,
    });
    expect(missing.state).toBe("Chybí záznam řidiče");
    expect(s.fuels.find((f) => f.id === "fuel")!.state).toBe("Spárováno");
    expect(s.statements[0]).toMatchObject({
      processing: "completed",
      complete: true,
      externalId: "6050029/5188965167/2026",
      periodFrom: "2026-10-01",
    });
    expect(r.message).toBe(
      "Transakce paliva: 2 (spárováno 1, bez záznamu řidiče 1). Položky mimo palivo (např. mytí), které se nepárují: 1.",
    );
  });
  it("the same transactions are never imported twice", () => {
    const { s, x } = setup();
    importCcsStatement(s, "st", x);
    s.statements.push({ ...s.statements[0], id: "st2" });
    const again = importCcsStatement(s, "st2", x);
    expect(again).toMatchObject({ created: 0, known: 2 });
    expect(s.transactions).toHaveLength(2);
  });
  it("an unknown card leaves the transaction incomplete, not paired", () => {
    const { s, x } = setup();
    s.cards[s.cards.length - 1].number = "JINA-KARTA-99";
    importCcsStatement(s, "st", x);
    expect(s.transactions[0]).toMatchObject({
      cardId: null,
      state: "Neúplný podklad",
    });
  });
});
