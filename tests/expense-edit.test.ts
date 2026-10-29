import { expect, it } from "vitest";
import { applyCommand } from "../src/domain/commands";
import { collections, meta } from "../src/domain/models";
import { fixture, manager } from "./factories";

it("edits an expense without creating a correction and rejects stale versions", () => {
  const s = fixture();
  const expense = collections.expenses.parse({
    ...meta("expense1"),
    vehicleId: "v1",
    category: "Jiné",
    date: "2026-10-29",
    description: "Testovací výdaj",
    amountMinor: 1000,
    currency: "CZK",
    kind: "Výdaj",
  });
  s.expenses.push(expense);
  const command = {
    type: "save" as const,
    collection: "expenses" as const,
    id: expense.id,
    version: expense.version,
    data: { ...expense, amountMinor: 2000 },
  };
  applyCommand(s, manager, command);
  expect(s.expenses).toHaveLength(1);
  expect(s.expenses[0]).toMatchObject({
    amountMinor: 2000,
    kind: "Výdaj",
    originalId: null,
    version: 2,
  });
  expect(() => applyCommand(s, manager, command)).toThrow();
});

it("does not calculate assignment conflicts between overlapping orders", () => {
  const s = fixture();
  s.orders.push({
    ...s.orders[0],
    id: "other-order",
    number: "TEST-002",
    vehicleId: "v1",
    driverId: "d1",
  });
  applyCommand(s, manager, {
    type: "order.assign",
    id: "o1",
    version: 1,
    vehicleId: "v1",
    driverId: "d1",
  });
  expect(s.orders[0]).toMatchObject({
    vehicleId: "v1",
    driverId: "d1",
    state: "Přiřazená",
  });
});
