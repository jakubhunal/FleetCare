import { expect, it } from "vitest";
import { editorFields } from "../src/features/editors";
import { ccsOptions } from "../src/lib/status";
import { fuelState, validateFuelCCSState } from "../src/domain/ccs";
import { collections, meta } from "../src/domain/models";
import { applyCommand } from "../src/domain/commands";
import { fixture, manager } from "./factories";
it("CCS select je jen pro správu a používá společnou nabídku", () => {
  const s = fixture();
  for (const role of ["Fleet manažer", "Vedení"] as const)
    expect(
      editorFields("fuels", s, { role, driverId: null }, true).find(
        (f) => f.key === "state",
      )?.options,
    ).toEqual(ccsOptions);
  expect(
    editorFields("fuels", s, { role: "Řidič", driverId: "d1" }, true).some(
      (f) => f.key === "state",
    ),
  ).toBe(false);
});
it("existující save uloží ruční stav, skutečná neshoda má přednost", () => {
  const s = fixture();
  const f = collections.fuels.parse({
    ...meta("fuel"),
    vehicleId: "v1",
    driverId: "d1",
    at: "2026-10-28T10:00:00Z",
    litres: 10,
    amountMinor: 10000,
    full: "Ano",
  });
  s.fuels.push(f);
  expect(fuelState(s, f)).toBe("Čeká na výpis");
  applyCommand(s, manager, {
    type: "save",
    collection: "fuels",
    id: f.id,
    version: f.version,
    data: { state: "Neúplný podklad", correctionReason: "Ověřit účtenku" },
  });
  expect(fuelState(s, s.fuels[0])).toBe("Neúplný podklad");
  expect(() =>
    validateFuelCCSState(s, { ...s.fuels[0], state: "Rozdíl" }),
  ).toThrow(/spárovaného/);
  s.transactions.push(
    collections.transactions.parse({
      ...meta("t"),
      statementId: "st",
      externalId: "ext",
      fuelId: f.id,
      vehicleId: "v1",
      at: f.at,
      litres: 10,
      amountMinor: 20000,
      currency: "CZK",
      state: "Rozdíl",
    }),
  );
  expect(() =>
    validateFuelCCSState(s, { ...s.fuels[0], state: "Rozdíl" }),
  ).not.toThrow();
  expect(fuelState(s, s.fuels[0])).toBe("Rozdíl");
  s.transactions[0].state = "Vyřešeno";
  expect(fuelState(s, s.fuels[0])).toBe("Neúplný podklad");
});
