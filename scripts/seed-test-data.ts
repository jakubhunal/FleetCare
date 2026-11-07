/**
 * Marked test data for manual testing (everything is named "TEST …", SPZ 9T0 0001):
 * a driver with a login, a fully described truck assigned to them, three
 * orders in different states, a CCS statement with a price difference and a
 * fault with a planned service (for "Notifikovat řidiče").
 *
 *   FC_API=https://vojtechanton.cz/api/v1 GOOGLE_ACCESS_TOKEN=… GOOGLE_SHEET_ID=… npx vite-node scripts/seed-test-data.ts
 */
import { HttpRepository } from "../src/data/http";
import type { Command } from "../src/data/contracts";
import type { Actor } from "../src/domain/models";
import { localTime, toPragueTimestamp } from "../src/lib/format";
import { addAccount, addCcsTransaction } from "./sheet-fixtures";

const repo = new HttpRepository(
  process.env.FC_API || "http://127.0.0.1:8788/v1",
);
const fleet: Actor = { role: "Fleet manažer", driverId: null };
const run = (command: Command) =>
  repo.execute(fleet, { command, idempotencyKey: crypto.randomUUID() });
const read = () => repo.read(fleet);
const SPZ = "9T0 0001";
const driverEmail = "test.ridic@example.test";
const day = (offset: number, hour: number) => {
  const d = new Date(Date.now() + offset * 86400000);
  return toPragueTimestamp(
    localTime(d.toISOString()).slice(0, 11) +
      String(hour).padStart(2, "0") +
      ":00",
  );
};

let ws = await read();
if (ws.vehicles.some((v) => v.spz === SPZ)) {
  console.log(`Testovací data už existují (vozidlo ${SPZ}). Nic nezakládám.`);
  process.exit(0);
}
await run({
  type: "save",
  collection: "drivers",
  data: {
    name: "TEST Řidič (Štěpán)",
    phone: "+420 777 000 001",
    email: driverEmail,
    suspended: false,
    licences: [
      { name: "B", validUntil: "2031-03-31" },
      { name: "C", validUntil: "2028-08-31" },
      { name: "C+E", validUntil: "2027-12-31" },
    ],
    qualifications: [{ name: "ADR", validUntil: "2027-06-30" }],
    medicalState: "Způsobilý",
    medicalUntil: "2027-10-31",
  },
});
await run({
  type: "save",
  collection: "vehicles",
  data: {
    spz: SPZ,
    vin: "YS2R4X20005399401",
    model: "TEST Scania R 450",
    year: 2023,
    category: "Kamion",
    purpose: "TEST dálková doprava",
    reserve: false,
    state: "V provozu",
    fuel: "Nafta",
    engine: "Euro 6",
    licence: "C",
    capacityKg: 24000,
    volumeM3: 90,
    pallets: 33,
    dimensions: "13.6 x 2.48 x 2.7",
    equipment: ["ADR", "Hydraulické čelo"],
    configuration: "Tahač + návěs",
    stkUntil: "2027-06-30",
    serviceId: null,
  },
});
await run({
  type: "save",
  collection: "services",
  data: {
    name: "TEST Servis Praha",
    email: "servis.test@example.test",
    phone: "+420 222 000 111",
    address: "Testovací 1, Praha 9",
  },
});
ws = await read();
const driver = ws.drivers.find((d) => d.email === driverEmail)!;
const vehicle = ws.vehicles.find((v) => v.spz === SPZ)!;
await run({
  type: "vehicle.assign",
  vehicleId: vehicle.id,
  version: vehicle.version,
  driverId: driver.id,
  from: day(0, 0),
  reason: "TEST svěření vozidla testovacímu řidiči",
  odometer: 152300,
});
await run({
  type: "save",
  collection: "cards",
  data: {
    number: "TEST-CCS-0001",
    active: true,
    toleranceMinor: 5000,
    bindings: [{ vehicleId: vehicle.id, from: "2026-11-01", to: null }],
  },
});
await run({
  type: "save",
  collection: "deadlines",
  data: {
    title: "TEST STK 9T0 0001",
    type: "STK",
    vehicleId: vehicle.id,
    driverId: null,
    date: "2027-06-30",
    km: null,
    responsible: "Fleet manažer",
    priority: "Střední",
    state: "Plánováno",
    documentId: null,
  },
});
await run({
  type: "save",
  collection: "templates",
  data: {
    name: "TEST Kamion – základní servis",
    category: "Kamion",
    items: [
      {
        id: crypto.randomUUID(),
        name: "Olej a filtry",
        intervalKm: 30000,
        intervalMonths: 12,
        lastKm: null,
        lastDate: null,
        nextKm: null,
        nextDate: null,
      },
      {
        id: crypto.randomUUID(),
        name: "Kontrola brzd",
        intervalKm: null,
        intervalMonths: 6,
        lastKm: null,
        lastDate: null,
        nextKm: null,
        nextDate: null,
      },
    ],
  },
});
const stop = (
  type: "Nakládka" | "Vykládka",
  place: string,
  from: string | null,
  to: string | null,
) => ({
  id: crypto.randomUUID(),
  type,
  place,
  from,
  to,
  contact: "",
  instructions: "",
});
const order = (customer: string, extra: Record<string, unknown>) => ({
  customer,
  contact: "TEST kontakt",
  reference: "",
  cargo: "TEST palety",
  category: "Kamion",
  weightKg: 12000,
  volumeM3: 40,
  pallets: 20,
  dimensions: "",
  equipment: [],
  qualifications: [],
  licence: "C",
  priceMinor: 1850000,
  currency: "CZK",
  vat: 21,
  vehicleId: null,
  driverId: null,
  internalNote: "TEST data pro testování zakázek",
  ...extra,
});
await run({
  type: "save",
  collection: "orders",
  data: order("TEST Morava Logistic s.r.o. (k přiřazení)", {
    state: "K přiřazení",
    stops: [
      stop("Nakládka", "TEST Brno", day(2, 8), day(2, 10)),
      stop("Vykládka", "TEST Ostrava", day(2, 14), day(2, 16)),
    ],
  }),
});
await run({
  type: "save",
  collection: "orders",
  data: order("TEST Alza.cz (přiřazená řidiči)", {
    state: "K přiřazení",
    stops: [
      stop("Nakládka", "TEST Praha", day(1, 7), day(1, 9)),
      stop("Vykládka", "TEST Plzeň", day(1, 12), day(1, 14)),
    ],
  }),
});
await run({
  type: "save",
  collection: "orders",
  data: order("TEST Škoda Auto (k doplnění)", {
    state: "K doplnění",
    category: null,
    weightKg: null,
    stops: [stop("Nakládka", "TEST Mladá Boleslav", null, null)],
  }),
});
ws = await read();
const toAssign = ws.orders.find((o) => o.customer.startsWith("TEST Alza.cz"))!;
await run({
  type: "order.assign",
  id: toAssign.id,
  version: toAssign.version,
  vehicleId: vehicle.id,
  driverId: driver.id,
});
const fuelAt = new Date(
  Math.floor((Date.now() - 86400000) / 60000) * 60000,
).toISOString();
await run({
  type: "save",
  collection: "fuels",
  data: {
    vehicleId: vehicle.id,
    driverId: driver.id,
    at: fuelAt,
    litres: 250,
    amountMinor: 975000,
    currency: "CZK",
    fuel: "Nafta",
    cardId: ws.cards.find((c) => c.number === "TEST-CCS-0001")!.id,
    station: "TEST ORLEN Praha",
    km: 152280,
    full: "Ano",
    state: "Čeká na výpis",
    correctionReason: "",
  },
});
await run({
  type: "save",
  collection: "faults",
  data: {
    vehicleId: vehicle.id,
    driverId: driver.id,
    category: "Brzdová soustava",
    description: "TEST pískají brzdy na návěsu",
    at: day(0, 7),
    km: 152290,
    urgency: "Střední",
    state: "Nahlášena",
    unavailable: false,
    repair: "",
    caseReference: "FC-TEST-1",
  },
});
ws = await read();
const fault = ws.faults.find(
  (f) => f.description === "TEST pískají brzdy na návěsu",
)!;
await run({
  type: "save",
  collection: "faults",
  id: fault.id,
  version: fault.version,
  data: {
    ...fault,
    state: "Naplánován servis",
    serviceId: ws.services.find((s) => s.name === "TEST Servis Praha")!.id,
    serviceFrom: day(3, 8),
    serviceTo: day(3, 16),
  },
});
if (process.env.GOOGLE_ACCESS_TOKEN) {
  const card = ws.cards.find((c) => c.number === "TEST-CCS-0001")!;
  const { statementId } = await addCcsTransaction({
    name: "TEST CCS výpis 11/2026",
    cardId: card.id,
    at: fuelAt,
    litres: 250,
    amountMinor: 990000,
  });
  await run({ type: "ccs.reconcile", statementId });
  await addAccount({
    email: driverEmail,
    password: "test1234",
    role: "driver",
    driverId: driver.id,
  });
  console.log(`Přihlášení řidiče: ${driverEmail} / test1234`);
} else
  console.log(
    "CCS výpis a účet řidiče přeskočeny (chybí GOOGLE_ACCESS_TOKEN).",
  );
console.log(`Hotovo: řidič ${driver.id}, vozidlo ${vehicle.id} (${SPZ}).`);
