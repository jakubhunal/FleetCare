import Dexie, { type Table } from "dexie";
import {
  emptyWorkspace,
  meta,
  parseWorkspace,
  documentSchema,
  type Actor,
  type Workspace,
} from "../domain/models";
import { applyCommand } from "../domain/commands";
import { DomainError, manager, scopedWorkspace } from "../domain/rules";
import { normalize } from "../lib/format";
import type {
  CommandEnvelope,
  JobStatus,
  Repository,
  SearchResult,
  UploadInput,
} from "./contracts";
import { validateUpload } from "./uploads";
import { authorizeCommand } from "../domain/access";
import { commandSchema } from "./command-schema";

export class FleetDatabase extends Dexie {
  state!: Table<{ id: string; data: Workspace }, string>;
  files!: Table<{ id: string; blob: Blob }, string>;
  operations!: Table<{ id: string; at: string }, string>;
  constructor(name = "fleetcare-clean-v1") {
    super(name);
    this.version(1).stores({ state: "id", files: "id", operations: "id" });
  }
}
export class LocalRepository implements Repository {
  readonly mode = "local" as const;
  constructor(public db = new FleetDatabase()) {}
  private async full() {
    const record = await this.db.state.get("workspace");
    return record ? parseWorkspace(record.data) : emptyWorkspace();
  }
  async read(actor: Actor) {
    return scopedWorkspace(await this.full(), actor);
  }
  async identities() {
    return (await this.full()).drivers.map(({ id, name }) => ({ id, name }));
  }
  async execute(actor: Actor, input: CommandEnvelope) {
    commandSchema.parse(input.command);
    authorizeCommand(actor, input.command);
    await this.db.transaction(
      "rw",
      [this.db.state, this.db.files, this.db.operations],
      async () => {
        if (await this.db.operations.get(input.idempotencyKey)) return;
        const s = await this.full();
        applyCommand(s, actor, input.command);
        if (input.command.type === "document.delete") {
          const doc = s.documents.find(
            (d) =>
              d.id ===
              (input.command.type === "document.delete"
                ? input.command.id
                : ""),
          );
          if (doc) await this.db.files.delete(doc.storageKey);
        }
        await this.db.state.put({ id: "workspace", data: s });
        await this.db.operations.put({
          id: input.idempotencyKey,
          at: new Date().toISOString(),
        });
      },
    );
  }
  async search(actor: Actor, query: string) {
    return searchWorkspace(await this.read(actor), query);
  }
  async upload(actor: Actor, input: UploadInput) {
    validateUpload(input);
    const blobs = await Promise.all(
      input.files.map(async (f) => ({ file: f, hash: await hash(f) })),
    );
    // Local (demo) mode has no extraction service: report it truthfully.
    const jobs: JobStatus[] = [];
    await this.db.transaction(
      "rw",
      [this.db.state, this.db.files, this.db.operations],
      async () => {
        if (await this.db.operations.get(input.idempotencyKey)) return;
        const s = await this.full(),
          scope = scopedWorkspace(s, actor);
        const ownerExists =
          input.ownerType === "intake" ||
          (input.ownerType === "vehicle" &&
            scope.vehicles.some((x) => x.id === input.ownerId)) ||
          (input.ownerType === "driver" &&
            scope.drivers.some((x) => x.id === input.ownerId)) ||
          (input.ownerType === "order" &&
            scope.orders.some((x) => x.id === input.ownerId)) ||
          (input.ownerType === "fault" &&
            scope.faults.some((x) => x.id === input.ownerId)) ||
          (input.ownerType === "fuel" &&
            scope.fuels.some((x) => x.id === input.ownerId)) ||
          (input.ownerType === "expense" &&
            scope.expenses.some((x) => x.id === input.ownerId)) ||
          (input.ownerType === "statement" && actor.role !== "Řidič");
        if (!ownerExists)
          throw new DomainError("Vlastník dokumentu není dostupný.");
        if (
          actor.role === "Řidič" &&
          !["driver", "order", "fuel"].includes(input.ownerType)
        )
          throw new DomainError(
            "K nahrání dokumentu nemáte oprávnění.",
            undefined,
            403,
          );
        if (
          input.ownerType === "driver" &&
          actor.role === "Řidič" &&
          input.ownerId !== actor.driverId
        )
          throw new DomainError("Cizí dokument není dostupný.", undefined, 403);
        for (const { file, hash: fingerprint } of blobs) {
          if (
            s.documents.some(
              (d) =>
                !d.deletedAt &&
                d.hash === fingerprint &&
                d.type === input.type &&
                ((input.ownerType === "statement" &&
                  d.ownerType === "statement") ||
                  (d.ownerId === input.ownerId &&
                    d.ownerType === input.ownerType)),
            )
          )
            continue;
          let ownerId = input.ownerId;
          if (input.ownerType === "statement") {
            manager(actor);
            const statement = {
              ...meta(),
              name: file.name,
              periodFrom: null,
              periodTo: null,
              receivedAt: new Date().toISOString(),
              complete: false,
              processing: "not_configured" as const,
              error: "Extrakce CCS není připojena.",
              externalId: null,
            };
            s.statements.push(statement);
            ownerId = statement.id;
          }
          const m = meta(),
            doc = documentSchema.parse({
              ...m,
              ownerType: input.ownerType,
              ownerId,
              vehicleId:
                input.vehicleId ||
                (input.ownerType === "vehicle" ? ownerId : null),
              type: input.type,
              name: file.name,
              mime: file.type,
              size: file.size,
              storageKey: m.id,
              hash: fingerprint,
              uploadedAt: m.createdAt,
              validUntil: input.validUntil || null,
              dueAt: input.dueAt || null,
              fileState: "stored",
              extraction: [
                "Pracovní smlouva",
                "Příloha",
                "Dodací list",
                "Servisní doklad",
                "Pojištění",
              ].includes(input.type)
                ? "not_required"
                : "not_configured",
              jobId: null,
              error: "",
              deletedAt: null,
            });
          await this.db.files.put({ id: doc.storageKey, blob: file });
          s.documents.push(doc);
          jobs.push({
            jobId: doc.id,
            state:
              doc.extraction === "not_required" ? "completed" : "not_configured",
          });
        }
        await this.db.state.put({ id: "workspace", data: s });
        await this.db.operations.put({
          id: input.idempotencyKey,
          at: new Date().toISOString(),
        });
      },
    );
    return jobs;
  }
  async file(actor: Actor, id: string) {
    const s = await this.read(actor),
      doc = s.documents.find((d) => d.id === id && !d.deletedAt);
    if (!doc) throw new DomainError("Dokument není dostupný.", undefined, 404);
    const entry = await this.db.files.get(doc.storageKey);
    if (!entry) throw new DomainError("Originální soubor chybí v úložišti.");
    return entry.blob;
  }
  async job(actor: Actor, id: string) {
    void actor;
    return { jobId: id, state: "not_configured" as const };
  }
  async readReceipt(actor: Actor, file: File) {
    void actor;
    void file;
    return {
      state: "not_configured" as const,
      fields: {},
      missingFields: [],
      error: "Čtení účtenek není v tomto režimu připojené.",
    };
  }
}
async function hash(blob: Blob) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await blob.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export function searchWorkspace(s: Workspace, query: string): SearchResult[] {
  const q = normalize(query);
  if (!q) return [];
  return [
    ...s.vehicles.map((v) => ({
      id: v.id,
      type: "Vozidla",
      title: v.spz,
      subtitle: v.model + " " + v.vin,
      path: `/vehicles/${v.id}`,
    })),
    ...s.drivers.map((d) => ({
      id: d.id,
      type: "Řidiči",
      title: d.name,
      subtitle: d.email,
      path: `/drivers/${d.id}`,
    })),
    ...s.orders.map((o) => ({
      id: o.id,
      type: "Zakázky",
      title: o.number,
      subtitle: o.customer + " " + o.stops.map((x) => x.place).join(" → "),
      path: `/orders/${o.id}`,
    })),
    ...s.trips.map((t) => ({
      id: t.id,
      type: "Jízdy",
      title: t.from + " → " + (t.to || "Na trase"),
      subtitle:
        t.purpose +
        " " +
        t.startAt +
        " " +
        s.vehicles.find((v) => v.id === t.vehicleId)?.spz,
      path: `/trips/${t.id}`,
    })),
    ...s.faults.map((f) => ({
      id: f.id,
      type: "Závady",
      title: f.description,
      subtitle:
        f.category + " " + s.vehicles.find((v) => v.id === f.vehicleId)?.spz,
      path: `/faults/${f.id}`,
    })),
    ...s.documents
      .filter((d) => !d.deletedAt)
      .map((d) => ({
        id: d.id,
        type: "Dokumenty",
        title: d.name,
        subtitle: d.type,
        path: `/documents/${d.id}`,
      })),
  ].filter((x) => normalize(x.title + " " + x.subtitle).includes(q));
}
