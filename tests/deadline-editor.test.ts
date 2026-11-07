import { expect, it } from "vitest";
import { deadlineEdit } from "../src/features/deadline-editor";
import { deadlines } from "../src/domain/rules";
import { applyCommand } from "../src/domain/commands";
import { collections, meta } from "../src/domain/models";
import { fixture, manager } from "./factories";

it("edits only dates on manual and derived STK/driver deadlines without changing source data", () => {
  const s = fixture();
  s.vehicles[0].vin = "legacy-import";
  s.deadlines.push(
    collections.deadlines.parse({
      ...meta("manual"),
      title: "Review",
      type: "Servis",
      vehicleId: "v1",
      date: "2030-01-01",
      responsible: "Fleet manažer",
      priority: "Střední",
      state: "Plánováno",
    }),
  );
  for (const id of ["manual", "stk-v1", "d1B"]) {
    const d = deadlines(s).find((d) => d.id === id)!;
    const edit = deadlineEdit(s, d)!;
    expect(edit.fields.map((f) => f.key)).toEqual(["date"]);
    applyCommand(s, manager, edit.command({ date: "2032-02-02" }));
    expect(deadlines(s).find((d) => d.id === id)?.date).toBe("2032-02-02");
  }
  expect(s.vehicles[0].vin).toBe("legacy-import");
  expect(s.deadlines[0].title).toBe("Review");
  expect(s.drivers[0].licences[0].name).toBe("B");
});

it("offers only kilometre threshold for a kilometre-only service plan", () => {
  const s = fixture();
  s.plans.push(
    collections.plans.parse({
      ...meta("plan"),
      vehicleId: "v1",
      items: [{ id: "item", name: "Oil", intervalKm: 10000, nextKm: 20000 }],
    }),
  );
  const edit = deadlineEdit(s, deadlines(s).find((d) => d.id === "item")!)!;
  expect(edit.fields.map((f) => f.key)).toEqual(["km"]);
  applyCommand(s, manager, edit.command({ km: 25000 }));
  expect(s.plans[0].items[0]).toMatchObject({
    nextKm: 25000,
    nextDate: null,
    intervalKm: 10000,
  });
});
