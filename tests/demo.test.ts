import { it, expect } from "vitest";
import { FleetDatabase } from "../src/data/local";
import { demoId, ensureDemoSeed } from "../src/demo/seed";
import { suitability } from "../src/domain/rules";
it("izolovaný seed je opakovatelný a nepřepíše úpravy", async () => {
  const db = new FleetDatabase("fleetcare-demo-test-" + crypto.randomUUID());
  const file = async () =>
    new Blob(["%PDF-1.7\nSYNTHETIC"], { type: "application/pdf" });
  await ensureDemoSeed(db, file);
  const first = await db.state.get("workspace");
  expect(first?.data.vehicles).toHaveLength(4);
  const s = first!.data;
  expect(suitability(s, s.orders[0], s.vehicles[0], s.drivers[0]).state).toBe(
    "Vhodné",
  );
  s.vehicles[0].purpose = "Zachovat úpravu";
  await db.state.put({ id: "workspace", data: s });
  await ensureDemoSeed(db, file);
  expect((await db.state.get("workspace"))?.data.vehicles[0].purpose).toBe(
    "Zachovat úpravu",
  );
  expect(
    (await db.state.get("workspace"))?.data.vehicles.find(
      (v) => v.id === demoId(2),
    )?.reserve,
  ).toBe(true);
  await db.delete();
});
