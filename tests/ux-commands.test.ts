import { describe, expect, it } from "vitest";
import { applyCommand } from "../src/domain/commands";
import { authorizeCommand } from "../src/domain/access";
import { collections, meta } from "../src/domain/models";
import { fixture, manager } from "./factories";

function withDocument() {
  const s = fixture();
  s.documents.push(
    collections.documents.parse({
      ...meta("doc1"),
      ownerType: "vehicle",
      ownerId: "v1",
      vehicleId: "v1",
      type: "Pojištění",
      name: "Test.png",
      mime: "image/png",
      size: 10,
      storageKey: "original-file",
      hash: "test-hash",
      uploadedAt: "2026-10-29T09:00:00Z",
      fileState: "stored",
      extraction: "not_required",
    }),
  );
  return s;
}
describe("Document metadata management", () => {
  it("updates metadata with version checking and preserves original storage", () => {
    const s = withDocument();
    const cmd = {
      type: "document.update" as const,
      id: "doc1",
      version: 1,
      name: "Pojištění.png",
      validUntil: "2027-01-01",
      dueAt: null,
    };
    applyCommand(s, manager, cmd);
    expect(s.documents[0]).toMatchObject({
      name: "Pojištění.png",
      version: 2,
      storageKey: "original-file",
      hash: "test-hash",
      validUntil: "2027-01-01",
    });
    expect(() => applyCommand(s, manager, cmd)).toThrow();
  });
  it("allows manager deletion of vehicle documents but denies driver changes", () => {
    const s = withDocument();
    const driver = { role: "Řidič" as const, driverId: "d1" };
    expect(() =>
      applyCommand(s, driver, { type: "document.delete", id: "doc1" }),
    ).toThrow();
    expect(s.documents[0].deletedAt).toBeNull();
    applyCommand(s, manager, { type: "document.delete", id: "doc1" });
    expect(s.documents[0].deletedAt).not.toBeNull();
    expect(() =>
      applyCommand(s, manager, {
        type: "document.update",
        id: "doc1",
        version: 2,
        name: "X",
        validUntil: null,
        dueAt: null,
      }),
    ).toThrow();
  });
  it("allows a driver to update only their own personal document", () => {
    const s = withDocument();
    Object.assign(s.documents[0], {
      ownerType: "driver",
      ownerId: "d1",
      vehicleId: null,
      type: "Řidičský průkaz",
    });
    const cmd = {
      type: "document.update" as const,
      id: "doc1",
      version: 1,
      name: "Průkaz.png",
      validUntil: null,
      dueAt: null,
    };
    const driver = { role: "Řidič" as const, driverId: "d1" };
    authorizeCommand(driver, cmd);
    applyCommand(s, driver, cmd);
    expect(s.documents[0].name).toBe("Průkaz.png");
    expect(() =>
      applyCommand(s, { ...driver, driverId: "d2" }, { ...cmd, version: 2 }),
    ).toThrow();
  });
});
describe("Communication recipient changes", () => {
  it("validates email, respects version and never claims a notification was sent", () => {
    const s = fixture();
    s.notifications.push(
      collections.notifications.parse({
        ...meta("n1"),
        aggregateId: "fault1",
        recipientRole: "manager",
        email: "old@example.test",
        subject: "Test",
        message: "Test",
        state: "failed",
      }),
    );
    const cmd = {
      type: "notification.recipient" as const,
      id: "n1",
      version: 1,
      email: "new@example.test",
    };
    expect(() =>
      applyCommand(s, manager, { ...cmd, email: "invalid" }),
    ).toThrow();
    expect(() =>
      authorizeCommand({ role: "Řidič", driverId: "d1" }, cmd),
    ).toThrow();
    applyCommand(s, manager, cmd);
    expect(s.notifications[0]).toMatchObject({
      email: "new@example.test",
      state: "not_configured",
      version: 2,
    });
    expect(() => applyCommand(s, manager, cmd)).toThrow();
    s.notifications[0].state = "sent";
    expect(() => applyCommand(s, manager, { ...cmd, version: 2 })).toThrow();
    expect(s.notifications[0].email).toBe("new@example.test");
  });
});
