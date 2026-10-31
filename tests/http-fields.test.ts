import { expect, it } from "vitest";
import { HttpRepository } from "../src/data/http";
import { manager } from "./factories";
it("preserves gateway field errors so forms can display each affected field", async () => {
  const repo = new HttpRepository(
    "https://gateway.example.test/v1",
    async () =>
      new Response(
        JSON.stringify({
          message: "Neplatná pole",
          fieldErrors: { spz: "SPZ již existuje", vin: "Neplatný VIN" },
        }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      ),
  );
  await expect(
    repo.execute(manager, {
      idempotencyKey: "test",
      command: { type: "save", collection: "vehicles", data: {} },
    }),
  ).rejects.toMatchObject({
    status: 422,
    fieldErrors: { spz: "SPZ již existuje", vin: "Neplatný VIN" },
  });
});
