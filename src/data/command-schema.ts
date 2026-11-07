import { z } from "zod";
import { settingsSchema } from "../domain/models";
const commandUnion = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ccs.reconcile"), statementId: z.string() }),
  z.object({
    type: z.literal("save"),
    collection: z.enum([
      "vehicles",
      "drivers",
      "orders",
      "trips",
      "faults",
      "fuels",
      "expenses",
      "deadlines",
      "templates",
      "plans",
      "services",
      "cards",
    ]),
    data: z.record(z.string(), z.unknown()),
    id: z.string().optional(),
    version: z.number().int().positive().optional(),
  }),
  z.object({ type: z.literal("settings"), data: settingsSchema }),
  z.object({
    type: z.literal("driver.toggle"),
    id: z.string(),
    version: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("vehicle.assign"),
    vehicleId: z.string(),
    version: z.number().int().positive(),
    driverId: z.string().nullable(),
    from: z.iso.datetime({ offset: true }),
    reason: z.string().min(1),
    odometer: z.number().nonnegative().nullable(),
  }),
  z.object({
    type: z.literal("vehicle.delete"),
    id: z.string(),
    version: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("order.assign"),
    id: z.string(),
    version: z.number().int().positive(),
    vehicleId: z.string(),
    driverId: z.string(),
  }),
  z.object({
    type: z.literal("trip.start"),
    data: z.record(z.string(), z.unknown()),
  }),
  z.object({
    type: z.literal("trip.transition"),
    id: z.string(),
    version: z.number().int().positive(),
    state: z.enum(["Potvrzena", "Uzavřena"]),
  }),
  z.object({
    type: z.literal("plan.apply"),
    vehicleId: z.string(),
    templateId: z.string(),
    replace: z.boolean(),
  }),
  z.object({
    type: z.literal("plan.complete"),
    planId: z.string(),
    itemId: z.string(),
    date: z.iso.date(),
    km: z.number().nonnegative(),
    version: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("fault.notify"),
    id: z.string(),
    email: z.email(),
    serviceAt: z.iso.datetime({ offset: true }),
    place: z.string(),
    message: z.string().min(1),
  }),
  z.object({ type: z.literal("notification.retry"), id: z.string() }),
  z.object({
    type: z.literal("notification.recipient"),
    id: z.string(),
    version: z.number().int().positive(),
    email: z.email(),
  }),
  z.object({
    type: z.literal("ccs.resolve"),
    transactionId: z.string(),
    fuelId: z.string().nullable(),
    amountMinor: z.number().int().nonnegative(),
    reason: z.string().min(1),
    version: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("document.update"),
    id: z.string(),
    version: z.number().int().positive(),
    name: z.string().trim().min(1),
    validUntil: z.iso.date().nullable(),
    dueAt: z.iso.date().nullable(),
  }),
  z.object({ type: z.literal("document.delete"), id: z.string() }),
  z.object({
    type: z.literal("document.link"),
    id: z.string(),
    vehicleId: z.string(),
  }),
]);
export const commandSchema = commandUnion.superRefine((command, ctx) => {
  if (command.type !== "save" || command.collection !== "fuels") return;
  if (
    typeof command.data.litres !== "number" ||
    !Number.isFinite(command.data.litres) ||
    command.data.litres <= 0
  )
    ctx.addIssue({
      code: "custom",
      path: ["litres"],
      message: "Zadejte počet litrů.",
    });
  if (
    typeof command.data.amountMinor !== "number" ||
    !Number.isInteger(command.data.amountMinor) ||
    command.data.amountMinor <= 0
  )
    ctx.addIssue({
      code: "custom",
      path: ["amountMinor"],
      message: "Zadejte částku tankování.",
    });
});
