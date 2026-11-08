import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import {
  statusMaps,
  statusMetadata,
  assignmentState,
  type StatusEntity,
} from "../src/lib/status";
import { StatusChip } from "../src/components/status-chip";
it("všechny entity používají stejný chip a centrální popisek/barvu", () => {
  for (const entity of Object.keys(statusMaps) as StatusEntity[])
    for (const [value, expected] of Object.entries(statusMaps[entity])) {
      const html = renderToStaticMarkup(
        createElement(StatusChip, { entity, value }),
      );
      expect(html).toContain(`class="badge ${expected.variant}"`);
      expect(html).toContain(expected.label);
      expect(statusMetadata(entity, value)).toEqual(expected);
    }
});
it("stav přidělení je stejný pro vozidlo, řidiče i dialog a oddělený od otevřeného konce období", () => {
  const now = "2026-11-08T12:00:00Z";
  expect(assignmentState({ from: "2026-01-01", to: null }, now)).toBe(
    "Aktivní",
  );
  expect(assignmentState({ from: "2027-01-01", to: null }, now)).toBe(
    "Plánováno",
  );
  expect(assignmentState({ from: "2026-01-01", to: now }, now)).toBe(
    "Ukončeno",
  );
});
it("neztotožní selhání zpracování dokumentu a odeslání e-mailu", () => {
  expect(statusMetadata("processing", "failed").label).toBe(
    "Zpracování selhalo",
  );
  expect(statusMetadata("notification", "failed").label).toBe(
    "Odeslání selhalo",
  );
});
