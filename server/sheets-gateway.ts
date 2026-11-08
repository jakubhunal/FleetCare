/**
 * FleetCare gateway over Google Sheets.
 *
 * Commands run through the same domain logic as the local (demo) mode
 * (`applyCommand`), so validation and side effects are identical; the
 * resulting workspace diff is written to the sheet by `sheets-store`.
 */
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { ZodError } from "zod";
import { matchAccount } from "./account-auth.mjs";
import { GoogleSheets } from "./google-sheets";
import {
  loadSnapshot,
  normalizeInstants,
  pragueStamp,
  requiredTabs,
  saveChanges,
  type Snapshot,
} from "./sheets-store";
import { applyCommand } from "../src/domain/commands";
import { authorizeCommand } from "../src/domain/access";
import { DomainError, scopedWorkspace } from "../src/domain/rules";
import {
  documentSchema,
  meta,
  roles,
  type Actor,
  type Workspace,
} from "../src/domain/models";
import { commandSchema } from "../src/data/command-schema";
import { fileLimits, validateUpload } from "../src/data/uploads";
import type { Command, UploadInput } from "../src/data/contracts";
import { normalize } from "../src/lib/format";

const env = process.env;
const port = Number(env.PORT || 8787);
const host = env.HOST || "127.0.0.1";
const dataDir = env.DATA_DIR || "./data";
const filesDir = join(dataDir, "files");
if (
  !env.GOOGLE_SHEET_ID ||
  (!env.GOOGLE_APPLICATION_CREDENTIALS && !env.GOOGLE_ACCESS_TOKEN)
) {
  console.error("Set GOOGLE_SHEET_ID and GOOGLE_APPLICATION_CREDENTIALS.");
  process.exit(1);
}
const sheets = new GoogleSheets(env.GOOGLE_SHEET_ID, {
  credentialsPath: env.GOOGLE_APPLICATION_CREDENTIALS,
  accessToken: env.GOOGLE_ACCESS_TOKEN,
});

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const fail = (status: number, message: string): never => {
  throw new HttpError(status, message);
};

// ---------- schema + snapshot cache ----------
let schemaReady: Promise<void> | undefined;
function ensureSchema() {
  schemaReady ??= sheets.ensureSchema(requiredTabs()).then(
    (added) => {
      if (added.length)
        console.log(`Doplněny listy/sloupce: ${added.join(" | ")}`);
    },
    (error) => {
      schemaReady = undefined;
      throw error;
    },
  );
  return schemaReady;
}
let cache: { snapshot: Snapshot; until: number } | undefined;
async function snapshot(fresh = false) {
  await ensureSchema();
  if (!fresh && cache && cache.until > Date.now()) return cache.snapshot;
  const loaded = await loadSnapshot(sheets);
  cache = { snapshot: loaded, until: Date.now() + 15_000 };
  return loaded;
}
let queue: Promise<unknown> = Promise.resolve();
/** One writer at a time: load fresh → mutate → save. */
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn);
  queue = run.catch(() => {});
  return run;
}
async function mutate<T>(
  change: (s: Workspace, snap: Snapshot) => Promise<T> | T,
) {
  return serialized(async () => {
    const snap = await snapshot(true);
    const next = structuredClone(snap.workspace);
    const result = await change(next, snap);
    next.events = [];
    await saveChanges(sheets, snap, next);
    // The sheet now holds exactly `next`; serve reads from it instead of re-reading (Sheets quota is 60 reads/min).
    cache = {
      snapshot: { ...snap, workspace: next },
      until: Date.now() + 15_000,
    };
    return result;
  });
}

// ---------- e-mail through the Make webhook ----------
const escapeHtml = (v: string) =>
  v.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const mailCommands = new Set([
  "fault.notify",
  "trip.notify",
  "notification.retry",
  "notification.recipient",
]);
async function deliverNotifications(
  before: Workspace,
  after: Workspace,
  settings: Record<string, string>,
) {
  const previous = new Map(
    before.notifications.map((n) => [n.id, JSON.stringify(n)]),
  );
  for (const n of after.notifications) {
    if (
      previous.get(n.id) === JSON.stringify(n) ||
      n.state !== "not_configured" ||
      !n.email
    )
      continue;
    const now = new Date().toISOString();
    if (!env.MAIL_WEBHOOK_URL) {
      Object.assign(n, {
        reason:
          "E-mailová služba není na serveru nastavena (MAIL_WEBHOOK_URL).",
      });
      continue;
    }
    const override = settings.test_email_override;
    const to =
      /@example\.test$/i.test(n.email) && override ? override : n.email;
    const fault = after.faults.find((f) => f.id === n.aggregateId);
    const trip = after.trips.find((t) => t.id === n.aggregateId);
    const vehicle = after.vehicles.find(
      (v) => v.id === (fault?.vehicleId || trip?.vehicleId),
    );
    const lines = [
      "Dobrý den,",
      "",
      n.message,
      "",
      ...(n.serviceAt
        ? [
            `Termín servisu: ${String(pragueStamp(n.serviceAt)).slice(0, 16).replace("T", " ")}`,
          ]
        : []),
      ...(n.place ? [`Místo: ${n.place}`] : []),
      ...(vehicle ? [`Vozidlo: ${vehicle.spz} (${vehicle.model})`] : []),
      ...(to !== n.email
        ? ["", `(Testovací provoz: původní příjemce ${n.email}.)`]
        : []),
      "",
      "FleetCare",
    ];
    try {
      const response = await fetch(env.MAIL_WEBHOOK_URL, {
        method: "POST",
        signal: AbortSignal.timeout(20_000),
        headers: {
          "content-type": "application/json",
          ...(env.MAIL_WEBHOOK_KEY ? { "x-fc-key": env.MAIL_WEBHOOK_KEY } : {}),
        },
        body: JSON.stringify({
          contract_version: "1.0",
          operation: "fc_email_send",
          idempotency_key: `${n.id}:${n.version}`,
          run_id: `gateway-${Date.now()}`,
          payload: {
            notification_id: n.id,
            to,
            original_to: n.email,
            subject: `FleetCare: ${n.subject}`,
            body: lines.join("\n"),
            html: lines.map(escapeHtml).join("<br>"),
          },
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        errors?: { message?: string }[];
        message?: string;
      };
      if (!response.ok || body.ok !== true)
        throw new Error(
          body.errors?.[0]?.message ||
            body.message ||
            `HTTP ${response.status}`,
        );
      Object.assign(n, {
        state: "sent",
        updatedAt: now,
        reason: `Odesláno ${String(pragueStamp(now)).slice(0, 16).replace("T", " ")} na ${to}${to !== n.email ? ` (testovací adresa místo ${n.email})` : ""}.`,
      });
    } catch (error) {
      Object.assign(n, {
        state: "failed",
        updatedAt: now,
        reason: `Odeslání selhalo: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }
}

// ---------- uploads (ported from LocalRepository.upload) ----------
type UploadSession = {
  actor: Actor;
  input: UploadInput;
  file: { name: string; mime: string; size: number };
  stored?: { path: string; hash: string; size: number };
  result?: { jobId: string; state: string };
};
const uploads = new Map<string, UploadSession>();
const uploadKeys = new Map<string, string>();
function addDocument(
  s: Workspace,
  actor: Actor,
  session: UploadSession,
  storageKey: string,
) {
  const { input, file, stored } = session;
  const scope = scopedWorkspace(s, actor);
  const owners: Record<string, boolean> = {
    intake: true,
    vehicle: scope.vehicles.some((x) => x.id === input.ownerId),
    driver: scope.drivers.some((x) => x.id === input.ownerId),
    order: scope.orders.some((x) => x.id === input.ownerId),
    fault: scope.faults.some((x) => x.id === input.ownerId),
    fuel: scope.fuels.some((x) => x.id === input.ownerId),
    expense: scope.expenses.some((x) => x.id === input.ownerId),
    statement: actor.role !== "Řidič",
  };
  if (!owners[input.ownerType])
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
  const duplicate = s.documents.find(
    (d) =>
      !d.deletedAt &&
      d.hash === stored!.hash &&
      d.type === input.type &&
      ((input.ownerType === "statement" && d.ownerType === "statement") ||
        (d.ownerId === input.ownerId && d.ownerType === input.ownerType)),
  );
  if (duplicate) return { doc: duplicate, duplicate: true };
  let ownerId = input.ownerId;
  if (input.ownerType === "statement") {
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
  const m = meta(storageKey);
  const doc = documentSchema.parse({
    ...m,
    ownerType: input.ownerType,
    ownerId,
    vehicleId:
      input.vehicleId || (input.ownerType === "vehicle" ? ownerId : null),
    type: input.type,
    name: file.name,
    mime: file.mime,
    size: stored!.size,
    storageKey,
    hash: stored!.hash,
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
  s.documents.push(doc);
  return { doc, duplicate: false };
}

// ---------- search ----------
function search(s: Workspace, query: string) {
  const q = normalize(query);
  if (!q) return [];
  return [
    ...s.vehicles.map((v) => ({
      id: v.id,
      type: "Vozidla",
      title: v.spz,
      subtitle: `${v.model} ${v.vin}`,
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
      subtitle: `${o.customer} ${o.stops.map((x) => x.place).join(" → ")}`,
      path: `/orders/${o.id}`,
    })),
    ...s.trips.map((t) => ({
      id: t.id,
      type: "Jízdy",
      title: `${t.from} → ${t.to || "Na trase"}`,
      subtitle: `${t.purpose} ${s.vehicles.find((v) => v.id === t.vehicleId)?.spz || ""}`,
      path: `/trips/${t.id}`,
    })),
    ...s.faults.map((f) => ({
      id: f.id,
      type: "Závady",
      title: f.description,
      subtitle: `${f.category} ${s.vehicles.find((v) => v.id === f.vehicleId)?.spz || ""}`,
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
  ]
    .filter((x) => normalize(`${x.title} ${x.subtitle}`).includes(q))
    .slice(0, 50);
}

// ---------- HTTP helpers ----------
async function body(req: IncomingMessage, limit = 1024 * 1024) {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) fail(413, "Požadavek je příliš velký.");
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return fail(400, "Neplatný JSON.");
  }
}
function actorOf(req: IncomingMessage, required = true): Actor | null {
  const raw = req.headers["x-actor-context"];
  if (!raw)
    return required
      ? fail(401, "Chybí přihlášený uživatel (X-Actor-Context).")
      : null;
  try {
    const value = JSON.parse(decodeURIComponent(String(raw)));
    if (roles.includes(value.role))
      return { role: value.role, driverId: value.driverId ?? null };
  } catch {
    /* handled below */
  }
  return fail(400, "Neplatná hlavička X-Actor-Context.");
}
const json = (res: ServerResponse, status: number, value: unknown) =>
  res
    .writeHead(status, { "content-type": "application/json; charset=utf-8" })
    .end(JSON.stringify(value));
const processed = new Map<string, { hash: string; expiresAt: number }>();

const server = createServer(async (req, res) => {
  const cors = env.CORS_ORIGIN;
  if (cors && req.headers.origin === cors) {
    res.setHeader("Access-Control-Allow-Origin", cors);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Idempotency-Key, X-Actor-Context",
    );
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
    res.setHeader("Vary", "Origin");
  }
  if (req.method === "OPTIONS") return void res.writeHead(204).end();
  const path = (req.url || "/").split("?")[0];
  try {
    if (req.method === "GET" && path === "/health")
      return json(res, 200, { ok: true });
    if (req.method === "POST" && path === "/v1/auth/login") {
      const input = await body(req);
      const email = String(input.email || "")
        .trim()
        .toLocaleLowerCase("en-US");
      const password = String(input.password || "");
      if (!email || !password) fail(400, "Zadejte e-mail a heslo.");
      const tabs = await sheets.readTabs(["accounts"]);
      const tab = tabs.get("accounts")!;
      const accounts = tab.rows.map((r) =>
        Object.fromEntries(tab.headers.map((h, i) => [h, r.values[i] ?? ""])),
      );
      const actor = matchAccount(accounts, email, password);
      if (!actor) fail(401, "E-mail nebo heslo není správné.");
      return json(res, 200, actor);
    }
    if (req.method === "GET" && path === "/v1/workspace") {
      const actor = actorOf(req, false);
      const { workspace } = await snapshot();
      return json(
        res,
        200,
        actor ? scopedWorkspace(workspace, actor) : workspace,
      );
    }
    if (req.method === "GET" && path === "/v1/actor-options") {
      const { workspace } = await snapshot();
      return json(
        res,
        200,
        workspace.drivers.map(({ id, name }) => ({ id, name })),
      );
    }
    if (req.method === "POST" && path === "/v1/search") {
      const actor = actorOf(req);
      const { workspace } = await snapshot();
      return json(
        res,
        200,
        search(
          scopedWorkspace(workspace, actor!),
          String((await body(req)).query || ""),
        ),
      );
    }
    if (req.method === "POST" && path === "/v1/commands") {
      const actor = actorOf(req)!;
      const raw = await body(req);
      const key = req.headers["idempotency-key"];
      if (typeof key !== "string" || !key)
        fail(400, "Chybí hlavička Idempotency-Key.");
      const command = normalizeInstants(commandSchema.parse(raw)) as Command;
      authorizeCommand(actor, command);
      const hash = createHash("sha256")
        .update(JSON.stringify(raw))
        .digest("hex");
      const cached = processed.get(key as string);
      if (cached) {
        if (cached.hash !== hash)
          fail(409, "Idempotency-Key už byl použit pro jiný příkaz.");
        return void res.writeHead(204).end();
      }
      await mutate(async (next, snap) => {
        applyCommand(next, actor, command);
        if (mailCommands.has(command.type))
          await deliverNotifications(snap.workspace, next, snap.settings);
      });
      processed.set(key as string, {
        hash,
        expiresAt: Date.now() + 86_400_000,
      });
      for (const [k, v] of processed)
        if (v.expiresAt < Date.now()) processed.delete(k);
      return void res.writeHead(204).end();
    }
    if (req.method === "POST" && path === "/v1/uploads") {
      const actor = actorOf(req)!;
      const input = await body(req);
      const key = String(req.headers["idempotency-key"] || "");
      if (key && uploadKeys.has(key))
        return json(res, 201, { uploadId: uploadKeys.get(key) });
      const file = {
        name: String(input.file?.name || "dokument"),
        mime: String(input.file?.mime || ""),
        size: Number(input.file?.size || 0),
      };
      const upload: UploadInput = {
        ownerType: input.ownerType,
        ownerId: String(input.ownerId || ""),
        vehicleId: input.vehicleId || null,
        type: input.type,
        validUntil: input.validUntil || null,
        dueAt: input.dueAt || null,
        idempotencyKey: key || randomUUID(),
        files: [{ name: file.name, type: file.mime, size: file.size } as File],
      };
      if (
        !documentSchema.shape.ownerType.safeParse(upload.ownerType).success ||
        !documentSchema.shape.type.safeParse(upload.type).success
      )
        fail(422, "Neplatný typ dokumentu nebo vlastníka.");
      validateUpload(upload);
      const uploadId = randomUUID();
      uploads.set(uploadId, { actor, input: upload, file });
      if (key) uploadKeys.set(key, uploadId);
      return json(res, 201, { uploadId });
    }
    const content = path.match(/^\/v1\/uploads\/([^/]+)\/content$/);
    if (req.method === "PUT" && content) {
      const session =
        uploads.get(decodeURIComponent(content[1])) ||
        fail(404, "Nahrávání nebylo nalezeno.");
      await mkdir(filesDir, { recursive: true });
      const target = join(filesDir, `${decodeURIComponent(content[1])}.upload`);
      const hash = createHash("sha256");
      let size = 0;
      const out = createWriteStream(target);
      try {
        for await (const chunk of req) {
          size += chunk.length;
          if (size > fileLimits.storageBytes)
            fail(413, "Soubor překračuje limit úložiště 20 MB.");
          hash.update(chunk);
          if (!out.write(chunk))
            await new Promise<void>((r) => out.once("drain", () => r()));
        }
      } finally {
        await new Promise<void>((r) => out.end(() => r()));
      }
      if (!size) {
        await rm(target, { force: true });
        fail(422, "Soubor je prázdný.");
      }
      session.stored = { path: target, hash: hash.digest("hex"), size };
      return void res.writeHead(204).end();
    }
    const complete = path.match(/^\/v1\/uploads\/([^/]+)\/complete$/);
    if (req.method === "POST" && complete) {
      const session =
        uploads.get(decodeURIComponent(complete[1])) ||
        fail(404, "Nahrávání nebylo nalezeno.");
      if (session.result) return json(res, 200, session.result);
      if (!session.stored) fail(409, "Soubor ještě nebyl nahrán.");
      const storageKey = randomUUID();
      const { doc, duplicate } = await mutate((next) =>
        addDocument(next, session.actor, session, storageKey),
      );
      if (duplicate) await rm(session.stored!.path, { force: true });
      else await rename(session.stored!.path, join(filesDir, storageKey));
      session.result = {
        jobId: doc.id,
        state:
          doc.extraction === "not_required" || duplicate
            ? "completed"
            : "not_configured",
      };
      return json(res, 200, session.result);
    }
    const file = path.match(/^\/v1\/documents\/([^/]+)\/content$/);
    if (req.method === "GET" && file) {
      const actor = actorOf(req)!;
      const { workspace } = await snapshot();
      const doc = scopedWorkspace(workspace, actor).documents.find(
        (d) => d.id === decodeURIComponent(file[1]) && !d.deletedAt,
      );
      if (!doc) fail(404, "Dokument není dostupný.");
      if (doc!.storageKey.startsWith("drive:"))
        fail(
          404,
          doc!.storageKey.length > 6
            ? `Soubor je uložen na Google Drive: ${doc!.storageKey.slice(6)}`
            : "Soubor dokladu není v úložišti aplikace.",
        );
      const data = await readFile(
        join(filesDir, doc!.storageKey.replace(/[^\w-]/g, "")),
      ).catch(() => fail(404, "Originální soubor chybí v úložišti."));
      return void res
        .writeHead(200, {
          "content-type": doc!.mime,
          "content-length": data.length,
        })
        .end(data);
    }
    const job = path.match(/^\/v1\/jobs\/([^/]+)$/);
    if (req.method === "GET" && job)
      return json(res, 200, {
        jobId: decodeURIComponent(job[1]),
        state: "not_configured",
      });
    return json(res, 404, { message: "Not found" });
  } catch (error) {
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      return json(res, 422, {
        message: issue?.message || "Neplatná data.",
        fieldErrors: Object.fromEntries(
          error.issues.map((i) => [i.path.join("."), i.message]),
        ),
      });
    }
    if (error instanceof DomainError)
      return json(res, error.status, {
        message: error.message,
        ...(error.field || error.fieldErrors
          ? {
              fieldErrors: error.fieldErrors || {
                [error.field!]: error.message,
              },
            }
          : {}),
      });
    const status = (error as { status?: number }).status;
    if (error instanceof HttpError || status) {
      if (status === 429) res.setHeader("Retry-After", "30");
      return json(res, status || 500, { message: (error as Error).message });
    }
    console.error(error);
    return json(res, 502, {
      message: "Nepodařilo se komunikovat s Google Sheets.",
    });
  }
});

server.listen(port, host, () => {
  console.log(`FleetCare Sheets gateway listening on ${host}:${port}`);
  ensureSchema().catch((error) =>
    console.error(
      "Kontrola listů selhala, zkusí se znovu při prvním požadavku:",
      error.message,
    ),
  );
});
