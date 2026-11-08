import { describe, expect, it } from "vitest";
import { editorFields } from "../src/features/editors";
import { fixture, manager } from "./factories";

describe("Nabídka zakázek při zahájení jízdy", () => {
  it("řidiči nabídne jen jeho zakázky ve stavu Přiřazená", () => {
    const s = fixture();
    s.orders[0].driverId = "d1";
    s.orders[0].vehicleId = "v1";
    s.orders[0].state = "Přiřazená";
    s.orders.push({
      ...s.orders[0],
      id: "o2",
      number: "TEST-002",
      state: "Dokončená",
    });
    s.orders.push({
      ...s.orders[0],
      id: "o3",
      number: "TEST-003",
      driverId: "d2",
      state: "Přiřazená",
    });

    const orderField = editorFields(
      "trips",
      s,
      { role: "Řidič", driverId: "d1" },
      false,
      true,
    ).find((field) => field.key === "orderId");

    expect(orderField?.options).toEqual([["o1", "TEST-001"]]);
  });

  it("nabídky v ostatních formulářích tím nezúží", () => {
    const s = fixture();
    s.orders[0].driverId = "d1";
    s.orders.push({
      ...s.orders[0],
      id: "o2",
      number: "TEST-002",
      state: "Dokončená",
    });

    const startTrip = editorFields("trips", s, manager, false, true).find(
      (field) => field.key === "orderId",
    );
    const regularTrip = editorFields("trips", s, {
      role: "Řidič",
      driverId: "d1",
    }).find((field) => field.key === "orderId");

    expect(startTrip?.options).toHaveLength(2);
    expect(regularTrip?.options).toHaveLength(2);
  });
});
