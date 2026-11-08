import { expect, it } from "vitest";
import { deadlines } from "../src/domain/rules";
import { collections, meta } from "../src/domain/models";
import { fixture } from "./factories";
it("odvozené názvy obsahují účel i podmět a nemění zdrojová data", () => {
  const s = fixture();
  s.drivers[0].qualifications = [
    { name: "Profesní způsobilost", validUntil: "2030-11-08" },
  ];
  s.drivers[0].licences.push({ name: "C+E", validUntil: "2030-11-08" });
  s.documents.push(
    collections.documents.parse({
      ...meta("insurance"),
      ownerType: "vehicle",
      ownerId: "v1",
      vehicleId: "v1",
      type: "Pojištění",
      name: "Doklad",
      mime: "application/pdf",
      size: 100,
      storageKey: "test",
      hash: "hash",
      uploadedAt: "2026-11-08T00:00:00Z",
      validUntil: "2030-11-08",
      fileState: "stored",
      extraction: "not_required",
    }),
  );
  s.documents.push({
    ...s.documents[0],
    id: "stk-doc",
    type: "STK",
    validUntil: "2031-11-08",
  });
  s.plans.push(
    collections.plans.parse({
      ...meta("plan"),
      vehicleId: "v1",
      items: [{ id: "oil", name: "Výměna oleje", nextKm: 20000 }],
    }),
  );
  s.deadlines.push(
    collections.deadlines.parse({
      ...meta("manual"),
      title: "Vlastní kontrola",
      type: "Servis",
      vehicleId: "v1",
      responsible: "Fleet manažer",
      priority: "Střední",
      state: "Plánováno",
    }),
  );
  s.trips.push(
    collections.trips.parse({
      ...meta("trip"),
      vehicleId: "v1",
      driverId: "d1",
      from: "A",
      startAt: "2026-01-01T00:00:00Z",
      endAt: "2026-01-01T01:00:00Z",
      startKm: 0,
      state: "Ukončena neúplná",
    }),
  );
  const before = structuredClone(s);
  const titles = Object.fromEntries(
    deadlines(s, new Date("2026-11-08T00:00:00Z")).map((d) => [d.id, d.title]),
  );
  expect(titles).toMatchObject({
    "stk-v1": "Platnost STK – 1QA 0001",
    "doc-insurance": "Platnost pojištění – 1QA 0001",
    "doc-stk-doc": "Platnost STK – 1QA 0001",
    d1B: "Platnost řidičského oprávnění B – Testovací řidič",
    "d1C+E": "Platnost řidičského oprávnění C+E – Testovací řidič",
    "d1Profesní způsobilost":
      "Platnost kvalifikace Profesní způsobilost – Testovací řidič",
    oil: "Servisní plán: Výměna oleje – 1QA 0001",
    manual: "Vlastní kontrola",
    "a6-trip": "Doplnit koncový tachometr",
  });
  expect(s).toEqual(before);
});
