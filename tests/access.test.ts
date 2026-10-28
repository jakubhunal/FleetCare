import { it, expect } from "vitest";
import { fixture } from "./factories";
import { collections, meta } from "../src/domain/models";
import { scopedWorkspace } from "../src/domain/rules";
it("řidič nedostane cenový originál objednávky ani servisní fakturu vozidla", () => {
  const s = fixture();
  s.orders[0].driverId = "d1";
  s.orders[0].vehicleId = "v1";
  s.assignments.push({
    ...meta(),
    vehicleId: "v1",
    driverId: "d1",
    from: "2020-01-01T00:00:00Z",
    to: null,
    reason: "Test",
    odometer: null,
  });
  for (const [id, ownerType, ownerId, type] of [
    ["original", "order", "o1", "Objednávka"],
    ["pod", "order", "o1", "Dodací list"],
    ["invoice", "vehicle", "v1", "Servisní doklad"],
    ["stk", "vehicle", "v1", "STK"],
  ] as const)
    s.documents.push(
      collections.documents.parse({
        ...meta(id),
        ownerType,
        ownerId,
        type,
        name: id + ".pdf",
        mime: "application/pdf",
        size: 10,
        storageKey: id,
        hash: id,
        uploadedAt: new Date().toISOString(),
        fileState: "stored",
        extraction: "not_required",
      }),
    );
  const view = scopedWorkspace(s, { role: "Řidič", driverId: "d1" });
  expect(view.documents.map((d) => d.id)).toEqual(["pod", "stk"]);
  expect(view.orders[0].priceMinor).toBeNull();
});
