import { it, expect } from "vitest";
import { fixture } from "./factories";
import { collections, meta } from "../src/domain/models";
import { report } from "../src/domain/analytics";
const scope = {
  from: "2026-10-01",
  to: "2026-10-31",
  vehicleId: "",
  category: "",
  currency: "CZK",
  costType: "all",
};
it("transakci po české půlnoci nezařadí do předchozího UTC dne/měsíce", () => {
  const s = fixture();
  s.fuels.push(
    collections.fuels.parse({
      ...meta(),
      vehicleId: "v1",
      driverId: "d1",
      at: "2026-10-31T23:30:00Z",
      amountMinor: 10000,
      full: "Ano",
    }),
  );
  expect(report(s, scope).actualMinor).toBe(0);
  expect(
    report(s, { ...scope, from: "2026-11-01", to: "2026-11-30" }).actualMinor,
  ).toBe(10000);
});
it("km jízdy přes hranici měsíců nevydává za přesný měsíční jmenovatel", () => {
  const s = fixture();
  s.trips.push(
    collections.trips.parse({
      ...meta(),
      vehicleId: "v1",
      driverId: "d1",
      from: "A",
      to: "B",
      purpose: "Test",
      startAt: "2026-10-31T20:00:00Z",
      endAt: "2026-11-01T03:00:00Z",
      startKm: 100,
      endKm: 200,
      state: "Potvrzena",
    }),
  );
  const r = report(s, scope);
  expect(r.km).toBe(0);
  expect(r.boundaryTrips).toBe(1);
  expect(r.rows[0].costPerKm).toBeNull();
});
