import {
  collections,
  emptyWorkspace,
  meta,
  type Workspace,
} from "../domain/models";
import type { FleetDatabase } from "../data/local";
import { buildPdf } from "../lib/export";
import { today, toUtc } from "../lib/format";
export const demoId = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export function demoWorkspace(base = today()): Workspace {
  const s = emptyWorkspace();
  const day = (offset: number) => {
    const d = new Date(base + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  const at = (offset: number, hour: string) => toUtc(day(offset) + "T" + hour);
  const vehicle = (n: number, data: Record<string, unknown>) =>
    collections.vehicles.parse({ ...meta(demoId(n)), ...data });
  const driver = (n: number, data: Record<string, unknown>) =>
    collections.drivers.parse({ ...meta(demoId(n)), ...data });
  s.services.push(
    collections.services.parse({
      ...meta(demoId(90)),
      name: "Ukázkový Truck servis",
      email: "servis@example.test",
      phone: "000 000 090",
      address: "Fiktivní servisní areál · Praha",
    }),
  );
  s.settings = {
    managerEmail: "fleet@example.test",
    daysBefore: [30, 14, 7],
    kmBefore: 500,
  };
  s.vehicles.push(
    vehicle(1, {
      spz: "1DE 1001",
      model: "Mercedes-Benz Actros 1845",
      year: 2021,
      category: "Kamion",
      purpose: "Vnitrostátní přepravy",
      fuel: "Nafta",
      engine: "Ukázková konfigurace",
      licence: "C+E",
      capacityKg: 24000,
      volumeM3: 90,
      pallets: 33,
      equipment: ["Plachta"],
      dimensions: "13,6 × 2,45 × 2,7",
      configuration: "Tahač a návěs",
      stkUntil: day(20),
      serviceId: demoId(90),
    }),
    vehicle(2, {
      spz: "1DE 1002",
      model: "DAF XF 480",
      year: 2020,
      category: "Kamion",
      purpose: "Provozní rezerva",
      reserve: true,
      licence: "C+E",
      capacityKg: 26000,
      volumeM3: 95,
      pallets: 33,
      equipment: ["Plachta"],
      dimensions: "13,6 × 2,45 × 2,7",
      stkUntil: day(220),
      serviceId: demoId(90),
    }),
    vehicle(3, {
      spz: "1DE 1003",
      model: "Ford Transit",
      year: 2022,
      category: "Dodávka",
      purpose: "Regionální rozvoz",
      state: "V servisu",
      licence: "B",
      capacityKg: 1200,
      volumeM3: 12,
      pallets: 4,
      stkUntil: day(170),
      serviceId: demoId(90),
    }),
    vehicle(4, {
      spz: "1DE 1004",
      model: "Škoda Octavia",
      year: 2023,
      category: "Osobní auto",
      purpose: "Pracovní cesty",
      licence: "B",
      stkUntil: day(320),
    }),
  );
  s.drivers.push(
    driver(11, {
      name: "Karel Ukázkový",
      email: "karel@example.test",
      phone: "000 000 011",
      licences: [
        { name: "C+E", validUntil: day(730) },
        { name: "B", validUntil: day(730) },
      ],
      medicalState: "Způsobilý",
      medicalUntil: day(300),
    }),
    driver(12, {
      name: "Eva Testovací",
      email: "eva@example.test",
      phone: "000 000 012",
      licences: [
        { name: "C+E", validUntil: day(600) },
        { name: "B", validUntil: day(600) },
      ],
    }),
    driver(13, {
      name: "Pavel Fiktivní",
      email: "pavel@example.test",
      phone: "000 000 013",
      suspended: true,
      licences: [{ name: "B", validUntil: day(500) }],
    }),
  );
  s.assignments.push(
    ...[
      [1, 11],
      [3, 13],
      [4, 12],
    ].map(([v, d], i) =>
      collections.assignments.parse({
        ...meta(demoId(20 + i)),
        vehicleId: demoId(v),
        driverId: demoId(d),
        from: at(-30, "08:00"),
        reason: "Ukázkové stálé svěření",
        odometer: [98000, 78000, 49000][i],
      }),
    ),
  );
  const stops = (
    offset: number,
    from: string,
    to: string,
    start = "08:00",
    end = "12:00",
  ) => [
    {
      id: crypto.randomUUID(),
      type: "Nakládka",
      place: from,
      from: at(offset, start),
      to: at(offset, start),
      contact: "Fiktivní kontakt skladu",
      instructions: "Ukázková objednaná časová okna",
    },
    {
      id: crypto.randomUUID(),
      type: "Vykládka",
      place: to,
      from: at(offset, end),
      to: at(offset, end),
      contact: "",
      instructions: "",
    },
  ];
  const order = (n: number, data: Record<string, unknown>) =>
    collections.orders.parse({
      ...meta(demoId(n)),
      source: "import",
      externalId: "demo-mail-" + n,
      number: "DEMO-2026-" + String(n - 30).padStart(3, "0"),
      customer: "Ukázkové obaly s.r.o.",
      category: "Kamion",
      weightKg: 18000,
      volumeM3: 66,
      pallets: 28,
      equipment: ["Plachta"],
      licence: "C+E",
      priceMinor: 1840000,
      currency: "CZK",
      vat: 21,
      state: "K přiřazení",
      ...data,
    });
  s.orders.push(
    order(31, { stops: stops(1, "Praha", "Brno") }),
    order(32, {
      customer: "Testovací díly s.r.o.",
      stops: stops(1, "Praha", "Liberec", "09:00", "11:00"),
      category: "Dodávka",
      weightKg: 800,
      volumeM3: 8,
      pallets: 3,
      equipment: [],
      licence: "B",
      priceMinor: 640000,
      vehicleId: demoId(3),
      driverId: demoId(13),
      state: "Přiřazená",
    }),
    order(33, {
      customer: "Fiktivní logistika a.s.",
      stops: stops(-1, "Praha", "Plzeň"),
      priceMinor: 1200000,
      vehicleId: demoId(1),
      driverId: demoId(11),
      state: "Dokončená",
    }),
    order(34, {
      customer: "Ukázková neúplná objednávka",
      stops: stops(7, "Praha", "Jihlava"),
      weightKg: null,
      priceMinor: null,
      state: "K doplnění",
    }),
  );
  s.trips.push(
    collections.trips.parse({
      ...meta(demoId(41)),
      vehicleId: demoId(1),
      driverId: demoId(11),
      orderId: demoId(33),
      from: "Praha",
      to: "Plzeň",
      startAt: at(-1, "08:00"),
      endAt: at(-1, "12:00"),
      startKm: 100000,
      endKm: 100320,
      state: "Potvrzena",
    }),
    collections.trips.parse({
      ...meta(demoId(42)),
      vehicleId: demoId(1),
      driverId: demoId(11),
      purpose: "Návrat z rozvozu",
      from: "Brno",
      to: "Praha",
      startAt: at(-4, "13:00"),
      endAt: at(-4, "17:00"),
      startKm: 99600,
      state: "Ukončena neúplná",
    }),
    collections.trips.parse({
      ...meta(demoId(43)),
      vehicleId: demoId(4),
      driverId: demoId(12),
      purpose: "Samostatná cesta do servisu",
      from: "Praha",
      to: "Benešov",
      startAt: at(-2, "09:00"),
      endAt: at(-2, "10:00"),
      startKm: 50060,
      endKm: 50100,
      state: "Potvrzena",
    }),
  );
  s.faults.push(
    collections.faults.parse({
      ...meta(demoId(51)),
      vehicleId: demoId(3),
      driverId: demoId(13),
      category: "Brzdová soustava",
      description: "Vibrace při brzdění",
      at: at(-2, "10:30"),
      km: 80000,
      urgency: "Vysoká",
      state: "V servisu",
      serviceId: demoId(90),
      serviceFrom: at(0, "08:00"),
      serviceTo: at(3, "16:00"),
      unavailable: true,
      estimateMinor: 4280000,
      estimateAt: at(-1, "14:00"),
      estimateSource: "Ukázková simulace e-mailu externího servisu",
      currency: "CZK",
      caseReference: "DEMO-SERVIS-051",
    }),
    collections.faults.parse({
      ...meta(demoId(52)),
      vehicleId: demoId(1),
      driverId: demoId(11),
      category: "Karoserie",
      description: "Poškozený kryt zpětného zrcátka",
      at: at(-1, "15:30"),
      km: 100320,
      urgency: "Nízká",
      state: "Nahlášena",
      caseReference: "DEMO-SERVIS-052",
    }),
  );
  for (const f of s.faults)
    for (const recipientRole of ["driver", "manager", "service"] as const) {
      const d = s.drivers.find((d) => d.id === f.driverId);
      s.notifications.push(
        collections.notifications.parse({
          ...meta(),
          aggregateId: f.id,
          recipientRole,
          recipientId:
            recipientRole === "driver"
              ? d?.id
              : recipientRole === "service"
                ? demoId(90)
                : null,
          email:
            recipientRole === "driver"
              ? d?.email
              : recipientRole === "manager"
                ? "fleet@example.test"
                : "servis@example.test",
          subject: "Ukázková závada · " + f.caseReference,
          message: "Fiktivní požadavek. Žádný e-mail nebyl odeslán.",
          state: "not_configured",
          reason: "Ukázkové prostředí — služba není připojena.",
        }),
      );
    }
  s.cards.push(
    ...[1, 3].map((v, i) =>
      collections.cards.parse({
        ...meta(demoId(60 + i)),
        number: "DEMO-CCS-" + (i + 1),
        active: true,
        toleranceMinor: i ? 0 : 99,
        bindings: [{ vehicleId: demoId(v), from: day(-365), to: null }],
      }),
    ),
  );
  const fuel = (
    n: number,
    offset: number,
    vehicle: number,
    driver: number,
    litres: number,
    amountMinor: number,
    km: number,
    full: string,
    state: string,
  ) =>
    collections.fuels.parse({
      ...meta(demoId(n)),
      vehicleId: demoId(vehicle),
      driverId: demoId(driver),
      at: at(offset, "15:00"),
      litres,
      amountMinor,
      currency: "CZK",
      fuel: "Nafta",
      cardId: demoId(vehicle === 1 ? 60 : 61),
      station: "Ukázková čerpací stanice",
      km,
      full,
      state,
    });
  s.fuels.push(
    fuel(71, -5, 1, 11, 200, 850000, 99400, "Ano", "Spárováno"),
    fuel(72, -3, 1, 11, 100, 400000, 99700, "Ne", "Rozdíl"),
    fuel(73, 0, 1, 11, 180, 720000, 100500, "Ano", "Čeká na výpis"),
    fuel(74, -2, 3, 13, 45, 180000, 80000, "Ano", "Více kandidátů"),
    fuel(75, -2, 3, 13, 45, 180000, 80000, "Ano", "Více kandidátů"),
  );
  s.statements.push(
    collections.statements.parse({
      ...meta(demoId(80)),
      source: "import",
      name: "Ukázkový CCS výpis",
      periodFrom: base.slice(0, 7) + "-01",
      periodTo: base,
      receivedAt: at(0, "08:00"),
      complete: true,
      processing: "completed",
      externalId: "DEMO-STATEMENT-80",
    }),
  );
  const tx = (
    n: number,
    fuelId: number | null,
    vehicle: number,
    offset: number,
    amountMinor: number,
    litres: number,
    state: string,
  ) =>
    collections.transactions.parse({
      ...meta(demoId(n)),
      source: "import",
      statementId: demoId(80),
      externalId: "DEMO-TX-" + n,
      vehicleId: demoId(vehicle),
      cardId: demoId(vehicle === 1 ? 60 : 61),
      at: at(offset, "15:00"),
      amountMinor,
      currency: "CZK",
      litres,
      fuelId: fuelId ? demoId(fuelId) : null,
      state,
    });
  s.transactions.push(
    tx(81, 71, 1, -5, 850000, 200, "Spárováno"),
    tx(82, 72, 1, -3, 405000, 100, "Rozdíl"),
    tx(83, null, 3, -1, 220000, 55, "Chybí záznam řidiče"),
    tx(84, null, 3, -2, 180000, 45, "Více kandidátů"),
  );
  s.expenses.push(
    collections.expenses.parse({
      ...meta(demoId(101)),
      vehicleId: demoId(3),
      category: "Pneumatiky",
      date: day(-10),
      amountMinor: 1840000,
      currency: "CZK",
      vat: 21,
      description: "Ukázková výměna pneumatik",
      paidAt: day(-9),
      kind: "Výdaj",
    }),
    collections.expenses.parse({
      ...meta(demoId(102)),
      vehicleId: demoId(1),
      category: "Mýto",
      date: day(-2),
      amountMinor: 320000,
      currency: "CZK",
      vat: 21,
      description: "Ukázkový náklad mýta",
      kind: "Výdaj",
    }),
  );
  const item = {
    id: demoId(111),
    name: "Ukázkový pravidelný úkon",
    intervalKm: 50000,
    intervalMonths: 12,
    lastKm: 50500,
    lastDate: day(-360),
    nextKm: 100500,
    nextDate: day(5),
  };
  s.templates.push(
    collections.templates.parse({
      ...meta(demoId(110)),
      name: "Fiktivní šablona pro kontrolu UI",
      category: "Kamion",
      items: [item],
    }),
  );
  s.plans.push(
    collections.plans.parse({
      ...meta(demoId(112)),
      vehicleId: demoId(1),
      templateId: demoId(110),
      items: [{ ...item, id: demoId(113) }],
    }),
  );
  s.deadlines.push(
    collections.deadlines.parse({
      ...meta(demoId(120)),
      title: "Ukázkové pojištění · 1DE 1004",
      type: "Pojištění",
      vehicleId: demoId(4),
      date: day(60),
      responsible: "Fleet manažer",
      priority: "Střední",
      state: "Plánováno",
    }),
  );
  for (const t of s.trips) {
    s.readings.push(
      collections.readings.parse({
        ...meta(),
        vehicleId: t.vehicleId,
        at: t.startAt,
        km: t.startKm,
        referenceId: t.id + "-start",
      }),
    );
    if (t.endKm !== null)
      s.readings.push(
        collections.readings.parse({
          ...meta(),
          vehicleId: t.vehicleId,
          at: t.endAt,
          km: t.endKm,
          referenceId: t.id + "-end",
        }),
      );
  }
  for (const f of s.fuels)
    if (f.km !== null)
      s.readings.push(
        collections.readings.parse({
          ...meta(),
          vehicleId: f.vehicleId,
          at: f.at,
          km: f.km,
          referenceId: f.id,
        }),
      );
  return s;
}
export async function ensureDemoSeed(
  db: FleetDatabase,
  makeBlob: () => Promise<Blob> = () =>
    buildPdf({
      title: "UKÁZKOVÝ PODKLAD FLEETCARE",
      subtitle: "Fiktivní soubor pro vizuální kontrolu — není platný doklad",
      columns: ["Prostředí", "Obsah"],
      rows: [
        [
          "Demo review",
          "Tento soubor není skutečný STK, účtenka, objednávka ani osobní průkaz.",
        ],
      ],
      footer: "Všechny výsledky zpracování v ukázkové sadě jsou simulované.",
    }),
) {
  if (await db.operations.get("demo-seed-v1")) return;
  const blob = await makeBlob();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await blob.arrayBuffer(),
  );
  const hash = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  await db.transaction("rw", [db.state, db.files, db.operations], async () => {
    if (await db.operations.get("demo-seed-v1")) return;
    const s = demoWorkspace();
    const fileKey = demoId(200);
    await db.files.put({ id: fileKey, blob });
    const docs = [
      {
        n: 201,
        ownerType: "vehicle",
        ownerId: demoId(1),
        vehicleId: demoId(1),
        type: "STK",
        name: "Ukázkový zpracovaný STK.pdf",
        extraction: "completed",
        error: "",
      },
      {
        n: 202,
        ownerType: "vehicle",
        ownerId: demoId(3),
        vehicleId: demoId(3),
        type: "STK",
        name: "Ukázkový nečitelný podklad.pdf",
        extraction: "failed",
        error: "Ukázková simulace: datum prohlídky nelze spolehlivě získat.",
      },
      {
        n: 203,
        ownerType: "statement",
        ownerId: demoId(80),
        vehicleId: null,
        type: "CCS výpis",
        name: "Ukázkový CCS výpis.pdf",
        extraction: "completed",
        error: "",
      },
      {
        n: 204,
        ownerType: "fuel",
        ownerId: demoId(72),
        vehicleId: demoId(1),
        type: "Účtenka",
        name: "Ukázková účtenka s rozdílem.pdf",
        extraction: "completed",
        error: "",
      },
      {
        n: 205,
        ownerType: "order",
        ownerId: demoId(31),
        vehicleId: null,
        type: "Objednávka",
        name: "Ukázková objednávka.pdf",
        extraction: "completed",
        error: "",
      },
    ];
    for (const d of docs)
      s.documents.push(
        collections.documents.parse({
          ...meta(demoId(d.n)),
          ...d,
          source: "import",
          mime: "application/pdf",
          size: blob.size,
          storageKey: fileKey,
          hash,
          uploadedAt: new Date().toISOString(),
          fileState: "stored",
        }),
      );
    await db.state.put({ id: "workspace", data: s });
    await db.operations.put({
      id: "demo-seed-v1",
      at: new Date().toISOString(),
    });
  });
}
