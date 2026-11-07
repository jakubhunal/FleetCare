/**
 * End-to-end check of the Sheets gateway: the frontend data layer sends the
 * same commands as the forms → the gateway writes Google Sheets → the record
 * is read back (and, with GOOGLE_ACCESS_TOKEN + GOOGLE_SHEET_ID, the readable
 * sheet columns are checked too). All created data is marked "TEST".
 *
 *   FC_API=http://127.0.0.1:8788/v1 npx vite-node scripts/gateway-e2e.ts
 */
import assert from "node:assert/strict";
import { HttpRepository } from "../src/data/http";
import type { Command } from "../src/data/contracts";
import type { Actor, Workspace } from "../src/domain/models";
import { activeAssignment } from "../src/domain/rules";
import { fuelState } from "../src/domain/ccs";
import { localTime, toPragueTimestamp } from "../src/lib/format";
import { addCcsTransaction } from "./sheet-fixtures";

const api = process.env.FC_API || "http://127.0.0.1:8788/v1";
const repo = new HttpRepository(api);
const fleet: Actor = { role: "Fleet manažer", driverId: null };
const tag = `TEST e2e ${new Date().toISOString().slice(5, 16).replace("T", " ")}`;
const spz = (n: number) => `9T${n} ${String(Date.now()).slice(-4)}`;
const results: { name: string; ok: boolean; detail?: string }[] = [];
let ws: Workspace;
const read = async (actor = fleet) => (ws = await repo.read(actor));
const run = (command: Command, actor = fleet) =>
  repo.execute(actor, { command, idempotencyKey: crypto.randomUUID() });
async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`OK   ${name}`);
  } catch (error) {
    results.push({
      name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
    console.log(
      `NOK  ${name}\n     ${error instanceof Error ? error.message : error}`,
    );
  }
}
async function rejects(fn: () => Promise<unknown>, pattern: RegExp) {
  try {
    await fn();
  } catch (error) {
    assert.match(String((error as Error).message), pattern);
    return;
  }
  assert.fail(`Očekávané odmítnutí (${pattern}) nenastalo.`);
}
// Optional direct look into the sheet (what a tester sees in FleetCare DB).
async function sheetRow(tab: string, idColumn: string, id: string) {
  const { GOOGLE_ACCESS_TOKEN: token, GOOGLE_SHEET_ID: sheet } = process.env;
  if (!token || !sheet) return null;
  let response!: Response;
  for (let attempt = 0; attempt < 4; attempt++) {
    response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheet}/values/${encodeURIComponent(`'${tab}'!A:ZZ`)}?valueRenderOption=UNFORMATTED_VALUE`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (response.status !== 429) break;
    await new Promise((r) => setTimeout(r, 15000));
  }
  const values = ((await response.json()) as { values: unknown[][] }).values;
  const headers = values[0].map(String);
  const row = values.find((r) => String(r[headers.indexOf(idColumn)]) === id);
  assert.ok(row, `Řádek ${id} v listu ${tab} chybí.`);
  return Object.fromEntries(
    headers.map((h, i) => [h, row![i] ?? ""]),
  ) as Record<string, unknown>;
}
const minutesAgo = (n: number) =>
  toPragueTimestamp(localTime(new Date(Date.now() - n * 60000).toISOString()));
const latest = <T extends { createdAt: string }>(list: T[]) =>
  [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1)!;

const vehicle = {
  spz: spz(1),
  vin: "",
  model: `${tag} Volvo FH`,
  year: 2022,
  category: "Kamion",
  purpose: tag,
  reserve: false,
  state: "V provozu",
  fuel: "Nafta",
  engine: "Euro 6",
  licence: "C",
  capacityKg: 18000,
  volumeM3: 80,
  pallets: 33,
  dimensions: "13.6 x 2.45 x 2.7",
  equipment: ["Hydraulické čelo", "ADR"],
  configuration: "Tahač + návěs",
  stkUntil: "2027-05-31",
  serviceId: null,
};
let vehicleId = "",
  driverA = "",
  driverB = "";

await step(
  "T1 vozidlo: všechna pole vč. platnosti STK se uloží a vrátí",
  async () => {
    await run({ type: "save", collection: "vehicles", data: vehicle });
    const v = (await read()).vehicles.find((x) => x.spz === vehicle.spz);
    assert.ok(v, "Vozidlo se po uložení nenačetlo.");
    vehicleId = v.id;
    for (const [key, value] of Object.entries(vehicle))
      assert.deepEqual(v[key as keyof typeof v], value, `pole ${key}`);
    const row = await sheetRow("vehicles", "vehicle_id", v.id);
    if (row) assert.equal(row.stk_valid_until, "2027-05-31");
  },
);

await step(
  "T3 řidič: zdravotní způsobilost + dvě oprávnění s různou platností",
  async () => {
    const make = (n: string) => ({
      name: `${tag} řidič ${n}`,
      phone: "+420 777 000 00" + n.length,
      email: `test.ridic.${n.toLowerCase()}@example.test`,
      suspended: false,
      licences: [
        { name: "B", validUntil: "2030-01-15" },
        { name: "C", validUntil: "2028-06-30" },
      ],
      qualifications: [{ name: "ADR", validUntil: "2027-03-01" }],
      medicalState: "Způsobilý",
      medicalUntil: "2027-09-30",
    });
    await run({ type: "save", collection: "drivers", data: make("A") });
    await run({ type: "save", collection: "drivers", data: make("BB") });
    await read();
    const a = ws.drivers.find((d) => d.name === `${tag} řidič A`)!,
      b = ws.drivers.find((d) => d.name === `${tag} řidič BB`)!;
    assert.ok(a && b, "Řidiči se nenačetli.");
    driverA = a.id;
    driverB = b.id;
    assert.deepEqual(a.licences, make("A").licences);
    assert.deepEqual(a.qualifications, make("A").qualifications);
    assert.equal(a.medicalState, "Způsobilý");
    assert.equal(a.medicalUntil, "2027-09-30");
    const row = await sheetRow("drivers", "driver_id", a.id);
    if (row) {
      assert.equal(row.licence_b_until, "2030-01-15");
      assert.equal(row.licence_c_until, "2028-06-30");
      assert.equal(row.medical_valid_until, "2027-09-30");
    }
  },
);

await step(
  "T10 přidělení: uloží se, předchozí se ukončí, aktuální je Aktivní (ne Plánováno) u vozidla i řidiče",
  async () => {
    await read();
    await run({
      type: "vehicle.assign",
      vehicleId,
      version: ws.vehicles.find((v) => v.id === vehicleId)!.version,
      driverId: driverA,
      from: minutesAgo(30),
      reason: `${tag} první`,
      odometer: 120000,
    });
    await read();
    await run({
      type: "vehicle.assign",
      vehicleId,
      version: ws.vehicles.find((v) => v.id === vehicleId)!.version,
      driverId: driverB,
      from: minutesAgo(0),
      reason: `${tag} výměna`,
      odometer: 120050,
    });
    await read();
    const mine = ws.assignments.filter((a) => a.vehicleId === vehicleId);
    assert.equal(mine.length, 2, "Historie má mít 2 přidělení.");
    const first = mine.find((a) => a.driverId === driverA)!,
      second = mine.find((a) => a.driverId === driverB)!;
    assert.ok(first.to, "Předchozí přidělení není ukončené.");
    const now = new Date().toISOString();
    const badge = (a: { from: string; to: string | null }) =>
      a.to && a.to <= now ? "Ukončeno" : a.from > now ? "Plánováno" : "Aktivní";
    assert.equal(
      badge(second),
      "Aktivní",
      "Právě platné přidělení se zobrazuje jako " + badge(second),
    );
    assert.equal(badge(first), "Ukončeno");
    assert.equal(activeAssignment(ws, vehicleId)?.driverId, driverB);
    const v = await sheetRow("vehicles", "vehicle_id", vehicleId),
      d = await sheetRow("drivers", "driver_id", driverB);
    if (v && d) {
      assert.equal(v.driver_id, driverB);
      assert.equal(d.vehicle_id, vehicleId);
      assert.equal(
        (await sheetRow("drivers", "driver_id", driverA))!.vehicle_id,
        "",
      );
    }
  },
);

await step(
  "T11 přidělení od zítřka je Plánováno, dnešní zůstává aktivní",
  async () => {
    await read();
    const tomorrow = toPragueTimestamp(
      localTime(new Date(Date.now() + 86400000).toISOString()),
    );
    await run({
      type: "vehicle.assign",
      vehicleId,
      version: ws.vehicles.find((v) => v.id === vehicleId)!.version,
      driverId: driverA,
      from: tomorrow,
      reason: `${tag} plán`,
      odometer: null,
    });
    await read();
    const planned = ws.assignments.find(
      (a) => a.vehicleId === vehicleId && a.reason === `${tag} plán`,
    )!;
    assert.ok(
      planned.from > new Date().toISOString(),
      "Budoucí přidělení není v budoucnu.",
    );
    assert.equal(
      activeAssignment(ws, vehicleId)?.driverId,
      driverB,
      "Dnešní řidič by měl platit do zítřka.",
    );
  },
);

await step("T4 závada: datum a čas hlášení se uloží přesně", async () => {
  const at = minutesAgo(90);
  await run({
    type: "save",
    collection: "faults",
    data: {
      vehicleId,
      driverId: null,
      category: "Brzdová soustava",
      description: `${tag} pískají brzdy`,
      at,
      km: 120060,
      urgency: "Střední",
      state: "Nahlášena",
      unavailable: false,
      repair: "",
      caseReference: "FC-TEST",
    },
  });
  await read();
  const f = ws.faults.find((x) => x.description === `${tag} pískají brzdy`)!;
  assert.equal(Date.parse(f.at), Date.parse(at), "Čas závady se posunul.");
  const row = await sheetRow("faults", "fault_id", f.id);
  if (row)
    assert.equal(
      String(row.reported_at).slice(0, 16),
      at.slice(0, 16),
      "V tabulce je jiný čas než ve formuláři.",
    );
});

await step(
  "T15 Notifikovat řidiče: vznikne požadavek pro aktuálního řidiče s výsledkem odeslání",
  async () => {
    await read();
    const f = ws.faults.find((x) => x.description === `${tag} pískají brzdy`)!;
    const from = new Date(Date.now() + 2 * 86400000).toISOString(),
      to = new Date(Date.now() + 3 * 86400000).toISOString();
    await run({
      type: "save",
      collection: "faults",
      id: f.id,
      version: f.version,
      data: {
        ...f,
        state: "Naplánován servis",
        serviceFrom: from,
        serviceTo: to,
      },
    });
    await read();
    const email = ws.drivers.find((d) => d.id === driverB)!.email;
    await run({
      type: "fault.notify",
      id: f.id,
      email,
      serviceAt: from,
      place: "Servis TEST Praha",
      message: `${tag} přistavte vozidlo do servisu.`,
    });
    await read();
    const n = ws.notifications.find(
      (x) => x.aggregateId === f.id && x.serviceAt,
    )!;
    assert.ok(n, "Požadavek na notifikaci nevznikl.");
    assert.equal(n.recipientId, driverB, "Příjemce není aktuální řidič.");
    assert.equal(n.email, email);
    console.log(`     stav notifikace: ${n.state} – ${n.reason}`);
    if (process.env.EXPECT_MAIL) assert.equal(n.state, "sent", n.reason);
  },
);

await step("T5 tankování: litry, částka, čas, stanice", async () => {
  const at = minutesAgo(10);
  await run({
    type: "save",
    collection: "fuels",
    data: {
      vehicleId,
      driverId: driverB,
      at,
      litres: 312.4,
      amountMinor: 1218436,
      currency: "CZK",
      fuel: "Nafta",
      cardId: null,
      station: `${tag} ORLEN`,
      km: 120070,
      full: "Ano",
      state: "Čeká na výpis",
      correctionReason: "",
    },
  });
  await read();
  const f = ws.fuels.find((x) => x.station === `${tag} ORLEN`)!;
  assert.ok(f, "Tankování se nenačetlo.");
  assert.deepEqual(
    [f.litres, f.amountMinor, f.km, f.full, Date.parse(f.at)],
    [312.4, 1218436, 120070, "Ano", Date.parse(at)],
  );
  const row = await sheetRow("fuel", "fuel_id", f.id);
  if (row) assert.deepEqual([row.litres, row.amount_czk], [312.4, 12184.36]);
});

await step("T6 termín: datum se uloží bez posunu", async () => {
  await run({
    type: "save",
    collection: "deadlines",
    data: {
      title: `${tag} STK`,
      type: "STK",
      vehicleId,
      driverId: null,
      date: "2026-12-01",
      km: null,
      responsible: "Fleet manažer",
      priority: "Vysoká",
      state: "Plánováno",
      documentId: null,
    },
  });
  await read();
  const d = ws.deadlines.find((x) => x.title === `${tag} STK`)!;
  assert.equal(d.date, "2026-12-01");
  assert.equal(d.priority, "Vysoká");
  const row = await sheetRow("deadlines", "deadline_id", d.id);
  if (row) assert.equal(row.valid_until, "2026-12-01");
});

await step(
  "T7 servisní plán: šablona s položkami → plán vozidla → splnění položky",
  async () => {
    const items = [
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
        name: "Brzdy",
        intervalKm: null,
        intervalMonths: 6,
        lastKm: null,
        lastDate: null,
        nextKm: null,
        nextDate: null,
      },
    ];
    await run({
      type: "save",
      collection: "templates",
      data: { name: `${tag} šablona`, category: "Kamion", items },
    });
    await read();
    const t = ws.templates.find((x) => x.name === `${tag} šablona`)!;
    assert.equal(t.items.length, 2);
    await run({
      type: "plan.apply",
      vehicleId,
      templateId: t.id,
      replace: true,
    });
    await read();
    const p = ws.plans.find((x) => x.vehicleId === vehicleId)!;
    assert.ok(p, "Plán vozidla se neuložil.");
    assert.equal(p.templateId, t.id);
    await run({
      type: "plan.complete",
      planId: p.id,
      itemId: p.items[0].id,
      date: "2026-11-07",
      km: 120080,
      version: p.version,
    });
    await read();
    const done = ws.plans.find((x) => x.id === p.id)!;
    assert.deepEqual(
      [
        done.items[0].lastKm,
        done.items[0].nextKm,
        done.items[0].nextDate,
        done.completions.length,
      ],
      [120080, 150080, "2027-11-07", 1],
    );
    if (await sheetRow("service_plans", "service_plan_id", p.id))
      assert.ok(true);
  },
);

await step("T8 ostatní výdaj + storno", async () => {
  await run({
    type: "save",
    collection: "expenses",
    data: {
      vehicleId,
      category: "Mýto",
      date: "2026-11-06",
      amountMinor: 145000,
      currency: "CZK",
      vat: 21,
      description: `${tag} mýto D1`,
      paidAt: "2026-11-07",
      kind: "Výdaj",
      originalId: null,
    },
  });
  await read();
  const e = ws.expenses.find((x) => x.description === `${tag} mýto D1`)!;
  assert.deepEqual(
    [e.amountMinor, e.vat, e.paidAt, e.category],
    [145000, 21, "2026-11-07", "Mýto"],
  );
  await run({
    type: "save",
    collection: "expenses",
    data: {
      vehicleId,
      category: "Mýto",
      date: "2026-11-07",
      amountMinor: -145000,
      currency: "CZK",
      vat: 21,
      description: `${tag} storno mýta`,
      paidAt: null,
      kind: "Storno",
      originalId: e.id,
    },
  });
  await read();
  assert.ok(
    ws.expenses.some((x) => x.kind === "Storno" && x.originalId === e.id),
  );
  const row = await sheetRow("other_expenses", "expense_id", e.id);
  if (row) assert.equal(row.amount_czk, 1450);
});

let cardId = "";
await step("T9 CCS karta s vazbou na vozidlo + externí servis", async () => {
  const number = `TEST-CCS-${String(Date.now()).slice(-6)}`;
  await run({
    type: "save",
    collection: "cards",
    data: {
      number,
      active: true,
      toleranceMinor: 500,
      bindings: [{ vehicleId, from: "2026-11-01", to: null }],
    },
  });
  await run({
    type: "save",
    collection: "services",
    data: {
      name: `${tag} Servis Praha`,
      email: "servis.test@example.test",
      phone: "+420 222 000 111",
      address: "Testovací 1, Praha",
    },
  });
  await read();
  const c = ws.cards.find((x) => x.number === number)!;
  cardId = c.id;
  assert.deepEqual(
    [c.toleranceMinor, c.bindings[0].vehicleId],
    [500, vehicleId],
  );
  const s = ws.services.find((x) => x.name === `${tag} Servis Praha`)!;
  assert.deepEqual(
    [s.email, s.phone, s.address],
    ["servis.test@example.test", "+420 222 000 111", "Testovací 1, Praha"],
  );
  const row = await sheetRow("ccs_cards", "card_id", c.id);
  if (row) assert.equal(row.vehicle_id, vehicleId);
});

await step(
  "T14 tachometr: koncový ≤ počáteční server odmítne i mimo formulář",
  async () => {
    const startAt = minutesAgo(5);
    await run({
      type: "trip.start",
      data: {
        vehicleId,
        driverId: driverB,
        orderId: null,
        purpose: `${tag} jízda`,
        from: "Praha",
        to: "",
        startAt,
        startKm: 120100,
        note: "",
      },
    });
    await read();
    const t = ws.trips.find((x) => x.purpose === `${tag} jízda`)!;
    const end = { ...t, endAt: new Date().toISOString(), to: "Kolín" };
    await rejects(
      () =>
        run({
          type: "save",
          collection: "trips",
          id: t.id,
          version: t.version,
          data: { ...end, endKm: 120050 },
        }),
      /tachometr/i,
    );
    await rejects(
      () =>
        run({
          type: "save",
          collection: "trips",
          id: t.id,
          version: t.version,
          data: { ...end, endKm: 120100 },
        }),
      /tachometr/i,
    );
    await run({
      type: "save",
      collection: "trips",
      id: t.id,
      version: t.version,
      data: { ...end, endKm: 120160 },
    });
    await read();
    const saved = ws.trips.find((x) => x.id === t.id)!;
    assert.deepEqual([saved.endKm, saved.state], [120160, "K ověření"]);
    const row = await sheetRow("trips", "trip_id", t.id);
    if (row) assert.deepEqual([row.km, row.state], [60, "K ověření"]);
  },
);

await step("T16 zakázka: založení, zastávky, posádka", async () => {
  const stops = [
    {
      id: crypto.randomUUID(),
      type: "Nakládka",
      place: "TEST Brno",
      from: new Date(Date.now() + 86400000).toISOString(),
      to: null,
      contact: "p. Novák",
      instructions: "Rampa 3",
    },
    {
      id: crypto.randomUUID(),
      type: "Vykládka",
      place: "TEST Ostrava",
      from: null,
      to: new Date(Date.now() + 2 * 86400000).toISOString(),
      contact: "",
      instructions: "",
    },
  ];
  await run({
    type: "save",
    collection: "orders",
    data: {
      customer: `${tag} zákazník s.r.o.`,
      contact: "",
      reference: "OBJ-TEST-1",
      stops,
      cargo: "Palety",
      category: "Kamion",
      weightKg: 12000,
      volumeM3: 40,
      pallets: 20,
      dimensions: "",
      equipment: ["ADR"],
      qualifications: [],
      licence: "C",
      priceMinor: 1850000,
      currency: "CZK",
      vat: 21,
      vehicleId: null,
      driverId: null,
      state: "K přiřazení",
      internalNote: tag,
    },
  });
  await read();
  const o = ws.orders.find((x) => x.customer === `${tag} zákazník s.r.o.`)!;
  assert.ok(o, "Zakázka se neuložila.");
  assert.match(o.number, /^ZK-\d{4}-\d{3}$/);
  assert.deepEqual(
    o.stops.map((s) => s.place),
    ["TEST Brno", "TEST Ostrava"],
  );
  await run({
    type: "order.assign",
    id: o.id,
    version: o.version,
    vehicleId,
    driverId: driverB,
  });
  await read();
  const assigned = ws.orders.find((x) => x.id === o.id)!;
  assert.deepEqual(
    [assigned.vehicleId, assigned.driverId, assigned.state],
    [vehicleId, driverB, "Přiřazená"],
  );
  const row = await sheetRow("orders", "order_id", o.id);
  if (row)
    assert.deepEqual(
      [row.from_location, row.to_location, row.vehicle_id],
      ["TEST Brno", "TEST Ostrava", vehicleId],
    );
});

await step(
  "T18 řidič: vidí jen svoje, smí zahájit jízdu u svého vozidla a nahlásit závadu",
  async () => {
    const driver: Actor = { role: "Řidič", driverId: driverB };
    const mine = await repo.read(driver);
    assert.deepEqual(
      mine.vehicles.map((v) => v.id),
      [vehicleId],
    );
    assert.ok(mine.drivers.every((d) => d.id === driverB));
    assert.equal(mine.expenses.length, 0);
    await run(
      {
        type: "save",
        collection: "faults",
        data: {
          vehicleId,
          driverId: driverB,
          category: "Jiné",
          description: `${tag} řidič hlásí`,
          at: minutesAgo(1),
          km: null,
          urgency: "Nízká",
          state: "Nahlášena",
          unavailable: false,
          repair: "",
          caseReference: "FC-TEST-R",
        },
      },
      driver,
    );
    await rejects(
      () =>
        run(
          {
            type: "save",
            collection: "vehicles",
            data: { ...vehicle, spz: spz(7) },
          },
          driver,
        ),
      /oprávnění/i,
    );
    assert.ok(
      (await read()).faults.some(
        (f) => f.description === `${tag} řidič hlásí` && f.driverId === driverB,
      ),
    );
  },
);

await step(
  "Dokumenty: Přidat vozidlo → Nahrát STK, náhled, přiřazení k vozidlu",
  async () => {
    const pdf = new File(
      [`%PDF-1.4\n% ${tag}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n`],
      "TEST-STK.pdf",
      { type: "application/pdf" },
    );
    await repo.upload(fleet, {
      ownerType: "intake",
      ownerId: "new",
      type: "STK",
      files: [pdf],
      idempotencyKey: crypto.randomUUID(),
    });
    await read();
    const doc = latest(
      ws.documents.filter(
        (d) => d.name === "TEST-STK.pdf" && d.ownerType === "intake",
      ),
    );
    assert.ok(doc, "Dokument se po nahrání nezobrazil.");
    const blob = await repo.file(fleet, doc.id);
    assert.equal(
      await blob.text(),
      await pdf.text(),
      "Náhled vrací jiný obsah.",
    );
    await run({ type: "document.link", id: doc.id, vehicleId });
    await read();
    assert.equal(
      ws.documents.find((d) => d.id === doc.id)!.vehicleId,
      vehicleId,
    );
    const row = await sheetRow("documents", "document_id", doc.id);
    if (row) assert.equal(row.linked_id, vehicleId);
  },
);

await step(
  "T13 CCS: spárování výpisu, ruční vyřešení rozdílu se uloží, seznam i detail mají stejný stav",
  async () => {
    if (!process.env.GOOGLE_ACCESS_TOKEN)
      return console.log(
        "     (přeskočeno: CCS výpis lze vložit jen přímo do tabulky, chybí GOOGLE_ACCESS_TOKEN)",
      );
    const at = new Date(
      Math.floor(Date.now() / 60000) * 60000 - 20 * 60000,
    ).toISOString();
    await run({
      type: "save",
      collection: "fuels",
      data: {
        vehicleId,
        driverId: driverB,
        at,
        litres: 250,
        amountMinor: 975000,
        currency: "CZK",
        fuel: "Nafta",
        cardId,
        station: `${tag} CCS stanice`,
        km: null,
        full: "Ano",
        state: "Čeká na výpis",
        correctionReason: "",
      },
    });
    const { statementId, transactionId } = await addCcsTransaction({
      name: `${tag} CCS výpis`,
      cardId,
      at,
      litres: 250,
      amountMinor: 990000,
    });
    await run({ type: "ccs.reconcile", statementId });
    await read();
    const f = ws.fuels.find((x) => x.station === `${tag} CCS stanice`)!;
    let t = ws.transactions.find((x) => x.id === transactionId)!;
    assert.deepEqual(
      [t.fuelId, t.state, f.state, fuelState(ws, f)],
      [f.id, "Rozdíl", "Rozdíl", "Rozdíl"],
      "Spárování s rozdílem 150 Kč",
    );
    await run({
      type: "ccs.resolve",
      transactionId,
      fuelId: f.id,
      amountMinor: 990000,
      reason: `${tag} ručně ověřeno s účtenkou`,
      version: t.version,
    });
    await read();
    t = ws.transactions.find((x) => x.id === transactionId)!;
    const after = ws.fuels.find((x) => x.id === f.id)!;
    assert.deepEqual(
      [t.state, t.resolution, after.state, fuelState(ws, after)],
      ["Vyřešeno", `${tag} ručně ověřeno s účtenkou`, "Vyřešeno", "Vyřešeno"],
    );
    const row = await sheetRow(
      "ccs_transactions",
      "transaction_id",
      transactionId,
    );
    if (row) assert.equal(row.state, "Vyřešeno");
    if (row)
      assert.equal(
        (await sheetRow("fuel", "fuel_id", f.id))!.match_state,
        "Vyřešeno",
      );
  },
);

await step("Souběh: uložení se starou verzí server odmítne (409)", async () => {
  await read();
  const v = ws.vehicles.find((x) => x.id === vehicleId)!;
  await run({
    type: "save",
    collection: "vehicles",
    id: v.id,
    version: v.version,
    data: { ...v, purpose: `${tag} upraveno` },
  });
  await rejects(
    () =>
      run({
        type: "save",
        collection: "vehicles",
        id: v.id,
        version: v.version,
        data: { ...v, purpose: `${tag} přepis` },
      }),
    /Konflikt verze/,
  );
});

await step(
  "T17 smazání vozidla: s historií odmítne, bez historie smaže i termíny",
  async () => {
    await read();
    const v = ws.vehicles.find((x) => x.id === vehicleId)!;
    await rejects(
      () => run({ type: "vehicle.delete", id: v.id, version: v.version }),
      /historii/,
    );
    await run({
      type: "save",
      collection: "vehicles",
      data: { ...vehicle, spz: spz(2), model: `${tag} ke smazání` },
    });
    await read();
    const extra = ws.vehicles.find((x) => x.model === `${tag} ke smazání`)!;
    await run({
      type: "save",
      collection: "deadlines",
      data: {
        title: `${tag} smazat`,
        type: "STK",
        vehicleId: extra.id,
        driverId: null,
        date: "2026-12-24",
        km: null,
        responsible: "Fleet manažer",
        priority: "Nízká",
        state: "Plánováno",
        documentId: null,
      },
    });
    await read();
    await run({
      type: "vehicle.delete",
      id: extra.id,
      version: ws.vehicles.find((x) => x.id === extra.id)!.version,
    });
    await read();
    assert.ok(
      !ws.vehicles.some((x) => x.id === extra.id),
      "Vozidlo po smazání zůstalo.",
    );
    assert.ok(
      !ws.deadlines.some((x) => x.vehicleId === extra.id),
      "Termín smazaného vozidla zůstal.",
    );
  },
);

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} OK${failed.length ? ` – NOK: ${failed.map((f) => f.name.split(" ")[0]).join(", ")}` : ""}`,
);
process.exit(failed.length ? 1 : 0);
