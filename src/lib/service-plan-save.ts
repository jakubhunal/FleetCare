import { z } from "zod";
import { collections, meta, type Records } from "../domain/models";
import type { Command } from "../data/contracts";
import { DomainError } from "../domain/rules";

export function planIntervalErrors(
  km: unknown,
  months: unknown,
): Record<string, string> {
  if (Number(km) > 0 || Number(months) > 0) return {};
  return {
    intervalKm:
      "Zadejte interval v kilometrech větší než 0, nebo vyplňte interval v měsících.",
    intervalMonths:
      "Zadejte interval v měsících větší než 0, nebo vyplňte interval v kilometrech.",
  };
}

export function planFormErrors(
  values: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const rows = new Set(
    Object.keys(values).flatMap(
      (key) => key.match(/^items\.(\d+)\.interval(?:Km|Months)$/)?.[1] || [],
    ),
  );
  for (const row of rows)
    for (const [field, message] of Object.entries(
      planIntervalErrors(
        values[`items.${row}.intervalKm`],
        values[`items.${row}.intervalMonths`],
      ),
    ))
      errors[`items.${row}.${field}`] = message;
  return errors;
}

export function validatePlanItems(items: Records["plans"]["items"]) {
  const issues: z.core.$ZodIssue[] = [];
  items.forEach((item, index) => {
    for (const [field, message] of Object.entries(
      planIntervalErrors(item.intervalKm, item.intervalMonths),
    ))
      issues.push({ code: "custom", path: ["items", index, field], message });
  });
  if (issues.length) throw new z.ZodError(issues);
}

/** The API has no batch save. Freeze both payloads and reuse keys across retries. */
export function individualPlanSave(input: {
  key: string;
  vehicleId: string;
  category: string;
  items: Records["plans"]["items"];
  templateName?: string;
}) {
  validatePlanItems(input.items);
  if (input.templateName !== undefined && !input.templateName.trim())
    throw new DomainError("Vyplňte název šablony.", "name");
  const template =
    input.templateName === undefined
      ? null
      : collections.templates.parse({
          ...meta(input.key + "-template"),
          name: input.templateName,
          category: input.category,
          items: structuredClone(input.items),
        });
  const plan = collections.plans.parse({
    ...meta(input.key + "-plan"),
    vehicleId: input.vehicleId,
    templateId: template?.id || null,
    items: structuredClone(input.items),
  });
  const progress = { templateAttempted: false, templateSaved: false };
  return {
    progress,
    async save(run: (command: Command, key: string) => Promise<void>) {
      if (template && !progress.templateSaved) {
        progress.templateAttempted = true;
        await run(
          { type: "save", collection: "templates", data: template },
          input.key + "-template",
        );
        progress.templateSaved = true;
      }
      await run(
        { type: "save", collection: "plans", data: plan },
        input.key + "-plan",
      );
    },
  };
}
