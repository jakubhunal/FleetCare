import { createServer } from "node:http";
import { createHash, createSign, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "127.0.0.1";
const sheetId = process.env.GOOGLE_SHEET_ID;
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!sheetId || !credentialsPath) {
  console.error("Set GOOGLE_SHEET_ID and GOOGLE_APPLICATION_CREDENTIALS.");
  process.exit(1);
}

let credentials;
let cachedToken;
async function accessToken() {
  if (!credentials) credentials = JSON.parse(await readFile(credentialsPath, "utf8"));
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const now = Math.floor(Date.now() / 1000);
  const enc = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const unsigned = `${enc({ alg: "RS256", typ: "JWT" })}.${enc({
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const assertion = `${unsigned}.${signer.sign(credentials.private_key, "base64url")}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) throw new Error(`Google OAuth ${response.status}`);
  const body = await response.json();
  cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return cachedToken.value;
}

async function sheet(tab) {
  const token = await accessToken();
  const range = `${encodeURIComponent(tab)}!A:ZZ`;
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (!response.ok) throw new Error(`Sheets API ${response.status} (${tab})`);
  const values = (await response.json()).values || [];
  const headers = (values[0] || []).map((x) => String(x).trim());
  return {
    headers,
    rows: values.slice(1).flatMap((values, index) => {
      if (!values.some((x) => x !== "" && x != null)) return [];
      const data = Object.fromEntries(headers.map((key, i) => [key, values[i] ?? ""]));
      return [{ rowNumber: index + 2, values, data }];
    }),
    lastRow: values.length,
  };
}
async function rows(tab) {
  return (await sheet(tab)).rows.map(({ data }) => data);
}
function column(tab, headers, name) {
  const index = headers.indexOf(name);
  if (index < 0) throw Object.assign(new Error(`Chybí sloupec ${name} v listu ${tab}.`), { status: 422 });
  return index;
}
const columnLabel = (number) => {
  let n = number;
  let label = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
};
async function updateRows(changes) {
  const data = await Promise.all(changes.map(async ({ tab, rowNumber, values: original, data: patch }) => {
    const current = await sheet(tab);
    const headers = current.headers;
    const latest = current.rows.find((row) => row.rowNumber === rowNumber);
    if (!latest || rowVersion(latest.values) !== rowVersion(original)) fail(409, "Řádek tabulky se mezitím změnil. Obnovte data a zkuste to znovu.");
    const values = [...latest.values];
    for (const [key, value] of Object.entries(patch)) values[column(tab, headers, key)] = value ?? "";
    const range = `'${tab}'!A${rowNumber}:${columnLabel(headers.length)}${rowNumber}`;
    return { range, majorDimension: "ROWS", values: [values] };
  }));
  const token = await accessToken();
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ valueInputOption: "RAW", data }),
  });
  if (!response.ok) throw Object.assign(new Error(`Zápis do Sheets selhal (${response.status}).`), { status: response.status === 429 ? 429 : 502 });
  workspaceCache = undefined;
}
async function writeRow(tab, rowNumber, data, existing) {
  await updateRows([{ tab, rowNumber, data, values: existing?.values || [] }]);
}
async function appendRow(tab, data) {
  const state = await sheet(tab);
  const headers = state.headers;
  if (!headers.length) throw Object.assign(new Error(`List ${tab} nemá hlavičku.`), { status: 422 });
  const values = Array(headers.length).fill("");
  for (const [key, value] of Object.entries(data)) values[column(tab, headers, key)] = value ?? "";
  const token = await accessToken();
  const range = `'${tab}'!A:ZZ`;
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ majorDimension: "ROWS", values: [values] }),
  });
  if (!response.ok) throw Object.assign(new Error(`Přidání řádku do Sheets selhalo (${response.status}, ${tab}).`), { status: response.status === 429 ? 429 : 502 });
  workspaceCache = undefined;
}
const val = (row, key, fallback = "") => row[key] === "" || row[key] == null ? fallback : row[key];
const text = (row, key, fallback = "") => String(val(row, key, fallback));
const number = (row, key) => {
  const value = Number(val(row, key, NaN));
  return Number.isFinite(value) ? value : null;
};
const bool = (row, key) => [true, 1, "TRUE", "Ano", "ANO", "true"].includes(val(row, key));
const stamp = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "2000-01-01T00:00:00.000Z" : date.toISOString();
};
const dateOnly = (value) => {
  if (!value) return null;
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString().slice(0, 10);
};
const rowVersion = (row) => Number.parseInt(createHash("sha256").update(JSON.stringify(row)).digest("hex").slice(0, 7), 16) + 1;
const meta = (id, updatedAt = "2000-01-01T00:00:00.000Z", version = 1) => ({
  id: String(id), version, createdAt: updatedAt, updatedAt, source: "import",
});
const split = (value) => String(value || "").split(/[,;]/).map((x) => x.trim()).filter(Boolean);

let workspaceCache;
let workspaceCacheUntil = 0;
async function workspace() {
  if (workspaceCache && workspaceCacheUntil > Date.now()) return workspaceCache;
  const [vehiclesSheet, driversSheet, deadlinesSheet, tripsSheet, fuelSheet, settingsRaw] = await Promise.all([
    sheet("vehicles"), sheet("drivers"), sheet("deadlines"), sheet("trips"), sheet("fuel"), rows("settings"),
  ]);
  const decorated = (data) => data.rows.map((r) => ({ ...r.data, __rowNumber: r.rowNumber, __version: rowVersion(r.values), __values: r.values }));
  const vehiclesRaw = decorated(vehiclesSheet);
  const driversRaw = decorated(driversSheet);
  const deadlinesRaw = decorated(deadlinesSheet);
  const tripsRaw = decorated(tripsSheet);
  const fuelRaw = decorated(fuelSheet);
  const settings = Object.fromEntries(settingsRaw.map((r) => [r.key, r.value]));
  const vehicles = vehiclesRaw.map((r) => ({
    ...meta(text(r, "vehicle_id"), undefined, r.__version), spz: text(r, "spz"), vin: text(r, "vin"),
    model: text(r, "brand_model"), year: number(r, "year"),
    category: ["Kamion", "Nákladní vozidlo", "Dodávka", "Osobní auto"].includes(text(r, "type")) ? text(r, "type") : "Nákladní vozidlo",
    purpose: text(r, "purpose"), reserve: bool(r, "reserve"), state: ["V provozu", "V servisu", "Odstaveno"].includes(text(r, "state")) ? text(r, "state") : "V provozu",
    fuel: "", engine: "", licence: "", capacityKg: null, volumeM3: null, pallets: null, dimensions: "", equipment: [], configuration: "", stkUntil: null, serviceId: null,
  }));
  const drivers = driversRaw.map((r) => ({
    ...meta(text(r, "driver_id"), undefined, r.__version), name: text(r, "name"), phone: text(r, "phone"), email: text(r, "email"),
    suspended: text(r, "state") !== "Aktivní", licences: split(r.licence).map((name) => ({ name, validUntil: dateOnly(r.licence_valid_until) })),
    qualifications: [], medicalState: "Není doloženo", medicalUntil: null,
  }));
  const assignments = driversRaw.filter((r) => r.vehicle_id).map((r, i) => ({
    ...meta(`sheet-assignment-${i}`), vehicleId: text(r, "vehicle_id"), driverId: text(r, "driver_id"),
    from: "2000-01-01T00:00:00.000Z", to: null, reason: "Přiřazení importované z tabulky", odometer: null,
  }));
  const readings = vehiclesRaw.filter((r) => number(r, "odometer_km") !== null).map((r) => ({
    ...meta(`sheet-reading-${text(r, "vehicle_id")}`), vehicleId: text(r, "vehicle_id"), at: "2000-01-01T00:00:00.000Z",
    km: number(r, "odometer_km"), referenceId: `sheet-odometer-${text(r, "vehicle_id")}`,
  }));
  const deadlines = deadlinesRaw.map((r) => ({
    ...meta(text(r, "deadline_id"), undefined, r.__version), title: text(r, "deadline_type"),
    type: /stk/i.test(text(r, "deadline_type")) ? "STK" : /pojištění/i.test(text(r, "deadline_type")) ? "Pojištění" : "Servis",
    vehicleId: text(r, "vehicle_id") || null, driverId: null, date: dateOnly(r.valid_until), km: number(r, "valid_until_km"),
    responsible: "Fleet manažer", priority: "Střední", state: text(r, "state") === "Splněno" ? "Splněno" : "Plánováno", documentId: null,
  }));
  const trips = tripsRaw.filter((r) => r.start_at).map((r) => ({
    ...meta(text(r, "trip_id"), stamp(r.start_at), r.__version), vehicleId: text(r, "vehicle_id"), driverId: text(r, "driver_id"), orderId: null,
    purpose: text(r, "order_number"), from: text(r, "from"), to: text(r, "to"), startAt: stamp(r.start_at),
    endAt: r.actual_end_at ? stamp(r.actual_end_at) : null, startKm: number(r, "odometer_start") ?? 0,
    endKm: number(r, "odometer_end"), state: ["Probíhá", "Ukončena neúplná", "K ověření", "Potvrzena", "Uzavřena"].includes(text(r, "state")) ? text(r, "state") : "K ověření", note: text(r, "source"),
  }));
  const fuels = fuelRaw.filter((r) => r.vehicle_id && r.driver_id && r.date).map((r) => ({
    ...meta(text(r, "fuel_id"), stamp(r.date), r.__version), vehicleId: text(r, "vehicle_id"), driverId: text(r, "driver_id"), at: stamp(r.date),
    litres: number(r, "litres"), amountMinor: number(r, "ccs_amount_czk") !== null ? Math.round(number(r, "ccs_amount_czk") * 100) : number(r, "amount_czk") === null ? null : Math.round(number(r, "amount_czk") * 100),
    currency: "CZK", fuel: "", cardId: null, station: text(r, "station"), km: null,
    full: bool(r, "full_tank") ? "Ano" : text(r, "full_tank") === "Ne" ? "Ne" : "Není doloženo",
    state: ["Čeká na výpis", "Spárováno", "Rozdíl", "Více kandidátů", "Chybí záznam řidiče", "Neúplný podklad", "Vyřešeno"].includes(text(r, "match_state")) ? text(r, "match_state") : "Čeká na výpis",
    correctionReason: "",
  }));
  workspaceCache = {
    vehicles, drivers, assignments, readings, deadlines, trips, fuels,
    orders: [], faults: [], statements: [], transactions: [], expenses: [], templates: [], plans: [], services: [], cards: [], notifications: [], events: [], documents: [],
    settings: {
      managerEmail: String(settings.manager_email || ""),
      daysBefore: split(settings.a5_levels_days).map(Number).filter(Number.isFinite),
      kmBefore: null,
    },
  };
  workspaceCacheUntil = Date.now() + 30_000;
  return workspaceCache;
}

function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function byId(state, key, id) {
  const found = state.rows.find((row) => String(row.data[key]) === String(id));
  if (!found) fail(404, `Záznam ${id} v listu ${state.tab || "tabulky"} nebyl nalezen.`);
  return found;
}
function expectVersion(row, version) {
  if (!version || rowVersion(row.values) !== version) fail(409, "Záznam byl mezitím změněn v tabulce. Obnovte stránku a změnu zopakujte.");
}
function valuesFor(entity, names) {
  return Object.fromEntries(Object.entries(entity).filter(([key]) => names.includes(key)));
}
const isoDate = (value) => value ? String(value).slice(0, 10) : "";
const money = (minor) => minor == null ? "" : Number(minor) / 100;
function sheetRecord(state, key, id) {
  state.tab = state.tab || "";
  return byId(state, key, id);
}
async function executeCommand(command) {
  if (!command || typeof command !== "object" || typeof command.type !== "string") fail(400, "Neplatný příkaz.");
  if (command.type === "save") {
    const { collection, data } = command;
    if (!data || typeof data !== "object") fail(400, "Chybí data příkazu.");
    const newId = command.id || data.id || randomUUID();
    const update = async (tab, idKey, updateData, createData = updateData) => {
      const state = await sheet(tab); state.tab = tab;
      const existing = command.id ? sheetRecord(state, idKey, command.id) : null;
      if (existing) {
        expectVersion(existing, command.version);
        await writeRow(tab, existing.rowNumber, updateData(existing.data), existing);
      } else {
        const values = Object.fromEntries(Object.entries(createData).map(([k, v]) => [k, typeof v === "function" ? v(null) : v]));
        await appendRow(tab, { [idKey]: newId, ...values });
      }
    };
    if (collection === "vehicles") return update("vehicles", "vehicle_id", (old) => ({
      spz: data.spz, brand_model: data.model, type: data.category, year: data.year,
      vin: data.vin, purpose: data.purpose, reserve: data.reserve ? "TRUE" : "FALSE", state: data.state,
    }), {
      spz: data.spz, brand_model: data.model, type: data.category, year: data.year,
      vin: data.vin, purpose: data.purpose, reserve: data.reserve ? "TRUE" : "FALSE", state: data.state,
      driver_id: "", odometer_km: "",
    });
    if (collection === "drivers") {
      const licences = Array.isArray(data.licences) ? data.licences : [];
      const validDates = [...new Set(licences.map((x) => x.validUntil).filter(Boolean))];
      if (validDates.length > 1) fail(422, "Tabulka má pro řidiče jen jeden sloupec platnosti oprávnění.");
      return update("drivers", "driver_id", () => ({
        name: data.name, phone: data.phone, email: data.email,
        state: data.suspended ? "Pozastavený" : "Aktivní",
        licence: licences.map((x) => x.name).join(", "), licence_valid_until: validDates[0] || "",
      }), {
        name: data.name, phone: data.phone, email: data.email,
        state: data.suspended ? "Pozastavený" : "Aktivní",
        licence: licences.map((x) => x.name).join(", "), licence_valid_until: validDates[0] || "", vehicle_id: "",
      });
    }
    if (collection === "deadlines") return update("deadlines", "deadline_id", () => ({
      vehicle_id: data.vehicleId || "", deadline_type: data.title, valid_until: data.date || "", state: data.state,
    }), { vehicle_id: data.vehicleId || "", deadline_type: data.title, valid_until: data.date || "", state: data.state });
    if (collection === "fuels") return update("fuel", "fuel_id", () => ({
      vehicle_id: data.vehicleId, driver_id: data.driverId, date: isoDate(data.at), litres: data.litres,
      amount_czk: money(data.amountMinor), ccs_amount_czk: money(data.amountMinor),
      full_tank: data.full, station: data.station, match_state: data.state,
    }), {
      vehicle_id: data.vehicleId, driver_id: data.driverId, date: isoDate(data.at), litres: data.litres,
      amount_czk: money(data.amountMinor), ccs_amount_czk: money(data.amountMinor),
      full_tank: data.full, station: data.station, match_state: data.state,
    });
    if (collection === "trips") {
      if (!command.id) fail(422, "Novou jízdu vytvořte příkazem trip.start.");
      return update("trips", "trip_id", () => ({
        vehicle_id: data.vehicleId, driver_id: data.driverId, order_number: data.purpose,
        start_at: data.startAt, actual_end_at: data.endAt || "", from: data.from, to: data.to,
        odometer_start: data.startKm, odometer_end: data.endKm ?? "",
        km: data.endKm == null ? "" : Math.max(0, data.endKm - data.startKm), state: data.state, source: data.note,
      }));
    }
    fail(422, `List tabulky nepodporuje ukládání kolekce ${collection}.`);
  }
  if (command.type === "driver.toggle") {
    const state = await sheet("drivers"); state.tab = "drivers";
    const row = sheetRecord(state, "driver_id", command.id); expectVersion(row, command.version);
    await writeRow("drivers", row.rowNumber, { state: row.data.state === "Aktivní" ? "Pozastavený" : "Aktivní" }, row);
    return;
  }
  if (command.type === "vehicle.assign") {
    const [vehicles, drivers] = await Promise.all([sheet("vehicles"), sheet("drivers")]);
    vehicles.tab = "vehicles"; drivers.tab = "drivers";
    const vehicle = sheetRecord(vehicles, "vehicle_id", command.vehicleId);
    const changes = [];
    const oldDriverId = String(vehicle.data.driver_id || "");
    if (oldDriverId) {
      const oldDriver = drivers.rows.find((x) => String(x.data.driver_id) === oldDriverId);
      if (oldDriver) changes.push({ tab: "drivers", rowNumber: oldDriver.rowNumber, values: oldDriver.values, data: { vehicle_id: "" } });
    }
    if (command.driverId) {
      const nextDriver = sheetRecord(drivers, "driver_id", command.driverId);
      const otherVehicleId = String(nextDriver.data.vehicle_id || "");
      if (otherVehicleId && otherVehicleId !== command.vehicleId) {
        const otherVehicle = vehicles.rows.find((x) => String(x.data.vehicle_id) === otherVehicleId);
        if (otherVehicle) changes.push({ tab: "vehicles", rowNumber: otherVehicle.rowNumber, values: otherVehicle.values, data: { driver_id: "" } });
      }
      changes.push({ tab: "drivers", rowNumber: nextDriver.rowNumber, values: nextDriver.values, data: { vehicle_id: command.vehicleId } });
    }
    changes.push({ tab: "vehicles", rowNumber: vehicle.rowNumber, values: vehicle.values, data: {
      driver_id: command.driverId || "", ...(command.odometer == null ? {} : { odometer_km: command.odometer }),
    } });
    // Keep one update per row; the last patch wins when the old and next driver are the same.
    const unique = new Map(changes.map((x) => [`${x.tab}:${x.rowNumber}`, x]));
    await updateRows([...unique.values()]);
    return;
  }
  if (command.type === "trip.start") {
    const data = command.data || {};
    await appendRow("trips", {
      trip_id: data.id || randomUUID(), vehicle_id: data.vehicleId, driver_id: data.driverId,
      order_number: data.purpose || "", start_at: data.startAt, actual_end_at: "", from: data.from || "", to: "",
      odometer_start: data.startKm, odometer_end: "", km: "", state: "Probíhá", source: "Řidič",
    });
    return;
  }
  if (command.type === "trip.transition") {
    const state = await sheet("trips"); state.tab = "trips";
    const row = sheetRecord(state, "trip_id", command.id); expectVersion(row, command.version);
    await writeRow("trips", row.rowNumber, { state: command.state }, row); return;
  }
  if (command.type === "settings") {
    const state = await sheet("settings"); state.tab = "settings";
    const managerRow = state.rows.find((x) => x.data.key === "manager_email");
    const daysRow = state.rows.find((x) => x.data.key === "a5_levels_days");
    if (!managerRow || !daysRow) fail(422, "V listu settings chybí manager_email nebo a5_levels_days.");
    await updateRows([
      { tab: "settings", rowNumber: managerRow.rowNumber, values: managerRow.values, data: { value: command.data.managerEmail } },
      { tab: "settings", rowNumber: daysRow.rowNumber, values: daysRow.values, data: { value: (command.data.daysBefore || []).join(",") } },
    ]);
    return;
  }
  fail(422, `Příkaz ${command.type} nelze v aktuálních listech uložit.`);
}

const processedKeys = new Map();
let writeQueue = Promise.resolve();
function serializedWrite(fn) {
  const result = writeQueue.then(fn);
  writeQueue = result.catch(() => {});
  return result;
}

const server = createServer(async (req, res) => {
  const cors = process.env.CORS_ORIGIN;
  if (cors && req.headers.origin === cors) {
    res.setHeader("Access-Control-Allow-Origin", cors);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key, X-Actor-Context");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
    res.setHeader("Vary", "Origin");
  }
  if (req.method === "OPTIONS") { res.writeHead(204).end(); return; }
  try {
    if (req.method === "GET" && req.url === "/health") { res.writeHead(200, { "content-type": "application/json" }).end('{"ok":true}'); return; }
    if (req.method === "GET" && req.url === "/v1/workspace") {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(await workspace())); return;
    }
    if (req.method === "GET" && req.url === "/v1/actor-options") {
      const data = await rows("drivers");
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(data.map((r) => ({ id: text(r, "driver_id"), name: text(r, "name") })))); return;
    }
    if (req.method === "POST" && req.url === "/v1/search") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const query = String(JSON.parse(body || "{}").query || "").trim().toLocaleLowerCase("cs-CZ");
      const data = await workspace();
      const results = [
        ...data.vehicles.map((x) => ({ id: x.id, type: "Vozidlo", title: x.spz, subtitle: x.model, path: `/vehicles/${x.id}` })),
        ...data.drivers.map((x) => ({ id: x.id, type: "Řidič", title: x.name, subtitle: x.phone, path: `/drivers/${x.id}` })),
        ...data.trips.map((x) => ({ id: x.id, type: "Jízda", title: x.purpose || "Jízda", subtitle: x.from, path: `/trips/${x.id}` })),
        ...data.deadlines.map((x) => ({ id: x.id, type: "Termín", title: x.title, subtitle: x.date || "", path: "/deadlines" })),
      ].filter((x) => `${x.title} ${x.subtitle}`.toLocaleLowerCase("cs-CZ").includes(query));
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(results.slice(0, 50))); return;
    }
    if (req.method === "POST" && req.url === "/v1/commands") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const command = JSON.parse(body || "{}");
      const key = req.headers["idempotency-key"];
      if (typeof key !== "string" || !key) fail(400, "Chybí hlavička Idempotency-Key.");
      const hash = createHash("sha256").update(JSON.stringify(command)).digest("hex");
      await serializedWrite(async () => {
        const cached = processedKeys.get(key);
        if (cached) {
          if (cached.hash !== hash) fail(409, "Idempotency-Key už byl použit pro jiný příkaz.");
          return;
        }
        await executeCommand(command);
        processedKeys.set(key, { hash, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
        for (const [cachedKey, entry] of processedKeys) if (entry.expiresAt < Date.now()) processedKeys.delete(cachedKey);
      });
      res.writeHead(204).end(); return;
    }
    if (req.url?.startsWith("/v1/") && req.method !== "GET") {
      res.writeHead(501, { "content-type": "application/json" }).end(JSON.stringify({ code: "not_supported_by_sheet", message: "Tato operace nemá odpovídající list nebo sloupce v současné školní tabulce." })); return;
    }
    res.writeHead(404, { "content-type": "application/json" }).end('{"message":"Not found"}');
  } catch (error) {
    console.error(error);
    const status = error.status || 502;
    if (status === 429) res.setHeader("Retry-After", "30");
    res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify({ message: error.status ? error.message : "Nepodařilo se komunikovat s Google Sheets." }));
  }
});
server.listen(port, host, () => console.log(`FleetCare Sheets gateway listening on ${host}:${port}`));
