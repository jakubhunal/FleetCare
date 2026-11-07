import { afterEach, expect, it } from "vitest";
import { individualPlanSave } from "../src/lib/service-plan-save";
import { FleetDatabase, LocalRepository } from "../src/data/local";
import type { Command } from "../src/data/contracts";
import { collections, meta } from "../src/domain/models";
import { fixture, manager } from "./factories";

const databases: FleetDatabase[] = [];
afterEach(async () => {
  for (const db of databases.splice(0)) await db.delete();
});
async function setup() {
  const db = new FleetDatabase("plan-save-test-" + crypto.randomUUID());
  databases.push(db);
  const repo = new LocalRepository(db);
  await db.state.put({ id: "workspace", data: fixture() });
  const run = (command: Command, idempotencyKey: string) =>
    repo.execute(manager, { command, idempotencyKey });
  const input = {
    key: crypto.randomUUID(),
    vehicleId: "v1",
    category: "Dodávka",
    items: collections.plans.parse({
      ...meta(),
      vehicleId: "v1",
      items: [{ id: "item", name: "Oil", intervalKm: 10000 }],
    }).items,
  };
  return { repo, run, input };
}
it("saves only the vehicle plan when the user chooses No", async () => {
  const { repo, run, input } = await setup();
  await individualPlanSave(input).save(run);
  const s = await repo.read(manager);
  expect(s.templates).toHaveLength(0);
  expect(s.plans).toHaveLength(1);
  expect(s.plans[0].templateId).toBeNull();
});
it("creates a template with settings-compatible properties and links the vehicle plan", async () => {
  const { repo, run, input } = await setup();
  const attempt = individualPlanSave({
    ...input,
    templateName: "  Shared plan  ",
  });
  input.items[0].name = "Later UI edit";
  await attempt.save(run);
  const s = await repo.read(manager);
  expect(s.templates).toHaveLength(1);
  expect(s.templates[0]).toMatchObject({
    name: "Shared plan",
    category: "Dodávka",
  });
  expect(s.templates[0].items[0].name).toBe("Oil");
  expect(s.plans[0].templateId).toBe(s.templates[0].id);
});
it("rejects a blank template name before saving either record", async () => {
  const { repo, input } = await setup();
  expect(() => individualPlanSave({ ...input, templateName: "   " })).toThrow();
  const s = await repo.read(manager);
  expect(s.templates).toHaveLength(0);
  expect(s.plans).toHaveLength(0);
});
it("tracks partial success and retries only the plan without creating another template", async () => {
  const { repo, run, input } = await setup();
  const attempt = individualPlanSave({ ...input, templateName: "Shared plan" });
  await expect(
    attempt.save(async (command, key) => {
      if (command.type === "save" && command.collection === "plans")
        throw new Error("Plan unavailable");
      await run(command, key);
    }),
  ).rejects.toThrow("Plan unavailable");
  expect(attempt.progress).toEqual({
    templateAttempted: true,
    templateSaved: true,
  });
  let s = await repo.read(manager);
  expect(s.templates).toHaveLength(1);
  expect(s.plans).toHaveLength(0);
  await attempt.save(run);
  s = await repo.read(manager);
  expect(s.templates).toHaveLength(1);
  expect(s.plans).toHaveLength(1);
});
it("reuses the same payload and idempotency key after a lost template response", async () => {
  const { repo, run, input } = await setup();
  const attempt = individualPlanSave({ ...input, templateName: "Shared plan" });
  await expect(
    attempt.save(async (command, key) => {
      await run(command, key);
      throw new Error("Response lost");
    }),
  ).rejects.toThrow("Response lost");
  expect(attempt.progress).toEqual({
    templateAttempted: true,
    templateSaved: false,
  });
  await attempt.save(run);
  const s = await repo.read(manager);
  expect(s.templates).toHaveLength(1);
  expect(s.plans).toHaveLength(1);
});

it("shows field-specific interval errors and clears both once either interval is positive", async () => {
  const { planFormErrors, planIntervalErrors } = await import(
    "../src/lib/service-plan-save"
  );
  const missing = planFormErrors({
    "items.0.intervalKm": "",
    "items.0.intervalMonths": "",
  });
  expect(missing["items.0.intervalKm"]).toMatch(
    /^Zadejte interval v kilometrech/,
  );
  expect(missing["items.0.intervalMonths"]).toMatch(
    /^Zadejte interval v měsících/,
  );
  expect(
    planFormErrors({
      "items.0.intervalKm": "257",
      "items.0.intervalMonths": "76",
    }),
  ).toEqual({});
  expect(planIntervalErrors(10000, null)).toEqual({});
  expect(planIntervalErrors(null, 12)).toEqual({});
  expect(
    planFormErrors({
      "items.0.intervalKm": "257",
      "items.1.intervalKm": "0",
      "items.1.intervalMonths": "",
    }),
  ).toEqual({
    "items.1.intervalKm": expect.stringMatching(
      /^Zadejte interval v kilometrech/,
    ),
    "items.1.intervalMonths": expect.stringMatching(
      /^Zadejte interval v měsících/,
    ),
  });
});
