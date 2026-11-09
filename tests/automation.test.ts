import { describe, expect, it } from "vitest";
import { a5Items, a5Level } from "../src/domain/automation";
import { collections, meta } from "../src/domain/models";
import { fixture } from "./factories";

const now = new Date("2026-11-08T05:00:00.000Z"); // 06:00 in Prague, when M2 runs
const inDays = (n: number) =>
  new Date(Date.UTC(2026, 10, 8 + n)).toISOString().slice(0, 10);

describe("A5 for the daily Make run", () => {
  it("uses the same levels as M2", () => {
    expect([-1, 0, 7, 8, 14, 15, 30, 31].map(a5Level)).toEqual([
      "overdue",
      "7d",
      "7d",
      "14d",
      "14d",
      "30d",
      "30d",
      null,
    ]);
  });
  it("covers what the Termíny page shows, not only manual deadlines", () => {
    const s = fixture();
    s.settings.managerEmail = "fleet@example.test";
    for (const v of s.vehicles) v.stkUntil = null;
    s.plans = [];
    s.vehicles[0].stkUntil = inDays(21);
    s.drivers[0].licences = [{ name: "C", validUntil: inDays(5) }];
    s.drivers[0].qualifications = [];
    s.deadlines.push(
      collections.deadlines.parse({
        ...meta("dl-old"),
        title: "Servis 87 000 km",
        type: "Servis",
        vehicleId: s.vehicles[1]?.id || s.vehicles[0].id,
        driverId: null,
        date: inDays(-6),
        km: null,
        responsible: "Fleet manažer",
        priority: "Střední",
        state: "Plánováno",
        documentId: null,
      }),
      collections.deadlines.parse({
        ...meta("dl-far"),
        title: "Pojistka",
        type: "Pojištění",
        vehicleId: s.vehicles[0].id,
        driverId: null,
        date: inDays(60),
        km: null,
        responsible: "Fleet manažer",
        priority: "Střední",
        state: "Plánováno",
        documentId: null,
      }),
    );
    const items = a5Items(s, now);
    const v = s.vehicles[0];
    expect(
      items.find((i) => i.vehicle_id === v.id && i.deadline_type === "STK"),
    ).toMatchObject({
      item_key: `A5:${v.id}:stk-${v.id}:${inDays(21)}`,
      vehicle_spz: v.spz,
      valid_until: inDays(21),
      level: "30d",
      manager_email: "fleet@example.test",
    });
    expect(
      items.find((i) => i.deadline_type === "řidičské oprávnění C"),
    ).toMatchObject({
      level: "7d",
      vehicle_spz: s.drivers[0].name,
      label: `řidič ${s.drivers[0].name}`,
    });
    // A manual deadline keeps the key the Sheets gateway used before.
    expect(items.find((i) => i.valid_until === inDays(-6))).toMatchObject({
      item_key: `A5:${s.vehicles[1]?.id || v.id}:Servis 87 000 km:${inDays(-6)}`,
      level: "overdue",
    });
    expect(items.some((i) => i.valid_until === inDays(60))).toBe(false);
  });
  it("a deadline already met is not reminded", () => {
    const s = fixture();
    for (const v of s.vehicles) v.stkUntil = null;
    s.plans = [];
    for (const d of s.drivers) d.licences = d.qualifications = [];
    s.deadlines = [
      collections.deadlines.parse({
        ...meta("dl"),
        title: "Servis",
        type: "Servis",
        vehicleId: s.vehicles[0].id,
        driverId: null,
        date: inDays(3),
        km: null,
        responsible: "Fleet manažer",
        priority: "Střední",
        state: "Splněno",
        documentId: null,
      }),
    ];
    expect(a5Items(s, now).filter((i) => i.valid_until === inDays(3))).toEqual(
      [],
    );
  });
});
