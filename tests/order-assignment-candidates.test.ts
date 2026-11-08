import { describe, expect, it } from "vitest";
import {
  collections,
  meta,
} from "../src/domain/models";
import {
  orderAssignmentCandidates,
  orderAssignmentConflicts,
} from "../src/domain/rules";
import { fixture } from "./factories";

describe("Páry řidič–vozidlo při přiřazení zakázky", () => {
  it("nabízí pouze aktuální přidělení a vyhodnotí pár dohromady", () => {
    const s = fixture();
    s.assignments.push(
      collections.assignments.parse({
        ...meta("a1"),
        vehicleId: "v1",
        driverId: "d1",
        from: "2026-01-01T00:00:00Z",
        to: null,
        reason: "Testovací přidělení",
      }),
      collections.assignments.parse({
        ...meta("a2"),
        vehicleId: "v1",
        driverId: "d1",
        from: "2027-01-01T00:00:00Z",
        to: null,
        reason: "Budoucí přidělení",
      }),
    );

    const candidates = orderAssignmentCandidates(
      s,
      s.orders[0],
      "2026-11-08T12:00:00Z",
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      vehicle: { id: "v1" },
      driver: { id: "d1" },
      result: { state: "Vhodné", reasons: [] },
      conflicts: [],
    });
  });

  it("označí pár obsazený jinou otevřenou zakázkou, ne dokončenou", () => {
    const s = fixture();
    s.orders.push(
      collections.orders.parse({
        ...s.orders[0],
        ...meta("o2"),
        number: "TEST-002",
        vehicleId: "v1",
        driverId: "d1",
        state: "Přiřazená",
      }),
    );

    expect(orderAssignmentConflicts(s, "o1", "v1", "d1")).toMatchObject([
      { id: "o2", number: "TEST-002", state: "Přiřazená" },
    ]);
    s.orders[1].state = "Dokončená";
    expect(orderAssignmentConflicts(s, "o1", "v1", "d1")).toEqual([]);
  });
});
