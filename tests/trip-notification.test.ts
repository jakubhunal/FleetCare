import { expect, it } from "vitest";
import {
  canNotifyTrip,
  tripNotificationReason,
} from "../src/domain/trip-notification";
import { applyCommand } from "../src/domain/commands";
import { commandSchema } from "../src/data/command-schema";
import { authorizeCommand } from "../src/domain/access";
import { collections, meta } from "../src/domain/models";
import { fixture, manager } from "./factories";
const trip = () =>
  collections.trips.parse({
    ...meta("t"),
    vehicleId: "v1",
    driverId: "d1",
    from: "A",
    to: "B",
    startAt: "2026-10-28T10:00:00Z",
    startKm: 100,
    state: "Probíhá",
  });
it("jen správa může připomenout neukončenou, neúplnou či nesrovnalou jízdu", () => {
  const t = trip();
  const variants = [
    t,
    { ...t, state: "Ukončena neúplná" as const, endAt: "2026-10-28T11:00:00Z" },
    {
      ...t,
      state: "K ověření" as const,
      endAt: "2026-10-28T11:00:00Z",
      endKm: 100,
    },
    {
      ...t,
      state: "K ověření" as const,
      endAt: "2026-10-28T11:00:00Z",
      endKm: 99,
    },
  ];
  for (const v of variants) {
    expect(canNotifyTrip(manager, v)).toBe(true);
    expect(canNotifyTrip({ role: "Vedení", driverId: null }, v)).toBe(true);
    expect(canNotifyTrip({ role: "Řidič", driverId: "d1" }, v)).toBe(false);
  }
  expect(tripNotificationReason(variants[0])).toContain("ukončení");
  expect(tripNotificationReason(variants[1])).toContain("doplnění koncového");
  expect(tripNotificationReason(variants[2])).toContain("nesrovnalosti");
  expect(canNotifyTrip(manager, { ...variants[2], endKm: 110 })).toBe(false);
});
it("použije stejný outbox, neprohlašuje e-mail za odeslaný a hlídá oprávnění", () => {
  const s = fixture();
  s.trips.push(trip());
  const cmd = {
    type: "trip.notify" as const,
    id: "t",
    email: "driver@example.test",
    message: "Doplňte jízdu.",
  };
  expect(commandSchema.safeParse(cmd).success).toBe(true);
  expect(() =>
    authorizeCommand({ role: "Řidič", driverId: "d1" }, cmd),
  ).toThrow();
  expect(() =>
    applyCommand(s, { role: "Řidič", driverId: "d1" }, cmd),
  ).toThrow();
  applyCommand(s, manager, cmd);
  expect(s.notifications).toHaveLength(1);
  expect(s.notifications[0]).toMatchObject({
    aggregateId: "t",
    recipientId: "d1",
    state: "not_configured",
    serviceAt: null,
    message: cmd.message,
  });
  expect(() => applyCommand(s, manager, { ...cmd, email: "bad" })).toThrow();
  s.trips[0] = {
    ...s.trips[0],
    state: "K ověření",
    endAt: "2026-10-28T11:00:00Z",
    endKm: 110,
  };
  expect(() => applyCommand(s, manager, cmd)).toThrow(/ukončené/);
});
