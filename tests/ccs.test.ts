import { it, expect } from "vitest";
import { fixture } from "./factories";
import { collections, meta } from "../src/domain/models";
import { reconcileCCS } from "../src/domain/ccs";
import { canonicalCosts } from "../src/domain/analytics";
function ccsFixture() {
  const s = fixture();
  s.cards.push(
    collections.cards.parse({
      ...meta("card"),
      number: "TEST-CARD",
      active: true,
      toleranceMinor: 99,
      bindings: [{ vehicleId: "v1", from: "2026-01-01", to: null }],
    }),
  );
  s.transactions.push(
    collections.transactions.parse({
      ...meta("tx"),
      statementId: "st",
      externalId: "EXT-1",
      vehicleId: "v1",
      cardId: "card",
      at: "2026-10-28T10:00:00Z",
      amountMinor: 10099,
      currency: "CZK",
      litres: 10,
      state: "Čeká na výpis",
    }),
  );
  s.fuels.push(
    collections.fuels.parse({
      ...meta("fuel"),
      vehicleId: "v1",
      driverId: "d1",
      cardId: "card",
      at: "2026-10-28T10:00:00Z",
      amountMinor: 10000,
      currency: "CZK",
      litres: 10,
      full: "Ano",
    }),
  );
  return s;
}
it("tolerance karty je včetně hranice a jediný náklad bere částku CCS", () => {
  const s = ccsFixture();
  reconcileCCS(s, "st");
  expect(s.transactions[0].state).toBe("Spárováno");
  expect(canonicalCosts(s)).toMatchObject([
    { amountMinor: 10099, provisional: false },
  ]);
});
it("nejednoznačná shoda není automaticky spojena a není dvojí předběžný náklad", () => {
  const s = ccsFixture();
  s.fuels.push({ ...s.fuels[0], id: "another" });
  reconcileCCS(s, "st");
  expect(s.transactions[0].state).toBe("Neúplný podklad");
  expect(s.transactions[0].fuelId).toBeNull();
  expect(canonicalCosts(s)).toHaveLength(1);
});
it("bez potvrzené tolerance nevydává shodu za rozhodnutou", () => {
  const s = ccsFixture();
  s.cards[0].toleranceMinor = null;
  reconcileCCS(s, "st");
  expect(s.transactions[0].state).toBe("Neúplný podklad");
});
