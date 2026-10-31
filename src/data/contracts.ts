import type { Actor, Collection, Document, Workspace } from "../domain/models";
export type EditableCollection = Extract<
  Collection,
  | "vehicles"
  | "drivers"
  | "orders"
  | "trips"
  | "faults"
  | "fuels"
  | "expenses"
  | "deadlines"
  | "templates"
  | "plans"
  | "services"
  | "cards"
>;
export type Command =
  | { type: "ccs.reconcile"; statementId: string }
  | {
      type: "save";
      collection: EditableCollection;
      data: Record<string, unknown>;
      id?: string;
      version?: number;
    }
  | { type: "settings"; data: Workspace["settings"] }
  | { type: "driver.toggle"; id: string; version: number }
  | {
      type: "vehicle.assign";
      vehicleId: string;
      driverId: string | null;
      from: string;
      reason: string;
      odometer: number | null;
    }
  | {
      type: "order.assign";
      id: string;
      version: number;
      vehicleId: string;
      driverId: string;
    }
  | { type: "trip.start"; data: Record<string, unknown> }
  | {
      type: "trip.transition";
      id: string;
      version: number;
      state: "Potvrzena" | "Uzavřena";
    }
  | {
      type: "plan.apply";
      vehicleId: string;
      templateId: string;
      replace: boolean;
    }
  | {
      type: "plan.complete";
      planId: string;
      itemId: string;
      date: string;
      km: number;
      version: number;
    }
  | {
      type: "fault.notify";
      id: string;
      email: string;
      serviceAt: string;
      place: string;
      message: string;
    }
  | { type: "notification.retry"; id: string }
  | {
      type: "notification.recipient";
      id: string;
      version: number;
      email: string;
    }
  | {
      type: "ccs.resolve";
      transactionId: string;
      fuelId: string | null;
      amountMinor: number;
      reason: string;
      version: number;
    }
  | {
      type: "document.update";
      id: string;
      version: number;
      name: string;
      validUntil: string | null;
      dueAt: string | null;
    }
  | { type: "document.delete"; id: string }
  | { type: "document.link"; id: string; vehicleId: string };
export type CommandEnvelope = { command: Command; idempotencyKey: string };
export type UploadInput = {
  ownerType: Document["ownerType"];
  ownerId: string;
  vehicleId?: string | null;
  type: Document["type"];
  validUntil?: string | null;
  dueAt?: string | null;
  files: File[];
  idempotencyKey: string;
};
export type SearchResult = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  path: string;
};
export type JobStatus = {
  jobId: string;
  state:
    | "not_configured"
    | "queued"
    | "processing"
    | "completed"
    | "incomplete"
    | "failed";
  missingFields?: string[];
  error?: string;
};
export interface Repository {
  readonly mode: "local" | "http";
  read(actor: Actor, signal?: AbortSignal): Promise<Workspace>;
  identities(signal?: AbortSignal): Promise<{ id: string; name: string }[]>;
  execute(
    actor: Actor,
    input: CommandEnvelope,
    signal?: AbortSignal,
  ): Promise<void>;
  search(
    actor: Actor,
    query: string,
    signal?: AbortSignal,
  ): Promise<SearchResult[]>;
  upload(actor: Actor, input: UploadInput, signal?: AbortSignal): Promise<void>;
  file(actor: Actor, id: string, signal?: AbortSignal): Promise<Blob>;
  job(actor: Actor, id: string, signal?: AbortSignal): Promise<JobStatus>;
}
