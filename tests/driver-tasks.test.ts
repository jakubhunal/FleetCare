import { expect, it } from "vitest";
import { fixture } from "./factories";
import { collections, meta } from "../src/domain/models";
import { scopedWorkspace } from "../src/domain/rules";
import { driverTasks } from "../src/domain/driver-tasks";

function workspace() {
  const s = fixture();
  s.assignments.push({
    ...meta(),
    vehicleId: "v1",
    driverId: "d1",
    from: "2020-01-01T00:00:00Z",
    to: null,
    reason: "Test",
    odometer: null,
  });
  s.trips.push(
    collections.trips.parse({
      ...meta("t1"),
      vehicleId: "v1",
      driverId: "d1",
      from: "Praha",
      to: "Brno",
      startAt: "2026-10-24T08:00:00Z",
      endAt: "2026-10-24T12:00:00Z",
      startKm: 100,
      state: "Ukončena neúplná",
    }),
  );
  s.faults.push(
    collections.faults.parse({
      ...meta("f1"),
      vehicleId: "v1",
      driverId: "other-reporter",
      category: "Brzdy",
      description: "Kontrola brzd",
      at: "2026-10-24T08:00:00Z",
      urgency: "Střední",
      state: "Naplánován servis",
      serviceId: "service1",
      serviceFrom: "2026-10-29T09:00:00Z",
      caseReference: "CASE-1",
    }),
  );
  s.services.push(
    collections.services.parse({
      ...meta("service1"),
      name: "Testovací servis",
      email: "service@example.test",
      phone: "",
      address: "Testovací 1",
    }),
    collections.services.parse({
      ...meta("unrelated"),
      name: "Jiný servis",
      email: "",
      phone: "",
      address: "Jiná 2",
    }),
  );
  return s;
}

it("úkoly řidiče obsahují vlastní neúplnou jízdu a domluvený servis jeho vozidla s místem", () => {
  const s = workspace();
  const scope = scopedWorkspace(s, { role: "Řidič", driverId: "d1" });
  expect(scope.services.map((x) => x.id)).toEqual(["service1"]);
  const tasks = driverTasks(scope, "d1");
  expect(tasks.map((x) => x.id)).toEqual(["trip:t1", "service:f1"]);
  expect(tasks[1].place).toContain("Testovací 1");
  expect(tasks[1].path).toBe("/faults/f1");
  s.trips[0].endKm = 120;
  s.faults[0].state = "Vyřešena";
  expect(driverTasks(s, "d1")).toEqual([]);
});

it("úkol nevznikne z pouhého hlášení, bez termínu, pro cizí jízdu ani pro dříve svěřené auto", () => {
  const s = workspace();
  s.trips[0].driverId = "other";
  s.faults[0].state = "Nahlášena";
  expect(driverTasks(s, "d1")).toEqual([]);
  s.faults[0].state = "Naplánován servis";
  s.faults[0].serviceFrom = null;
  expect(driverTasks(s, "d1")).toEqual([]);
  s.faults[0].serviceFrom = "2026-10-29T09:00:00Z";
  s.assignments[0].to = "2020-02-01T00:00:00Z";
  s.faults[0].driverId = "d1";
  expect(
    driverTasks(scopedWorkspace(s, { role: "Řidič", driverId: "d1" }), "d1"),
  ).toEqual([]);
  expect(driverTasks(s, null)).toEqual([]);
});
