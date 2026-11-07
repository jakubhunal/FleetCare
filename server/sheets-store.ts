/**
 * Google Sheets persistence for the FleetCare workspace.
 *
 * Every collection lives in one sheet tab. A row holds the complete entity as
 * JSON in the `fc_json` column, so every form field round-trips unchanged, plus
 * readable projection columns (spz, valid_until, …) that people and the Make
 * scenarios read. Rows without `fc_json` (seed data, rows written by Make) are
 * mapped from their readable columns and upgraded to JSON on their first write.
 */
import { createHash } from "node:crypto";
import {
  collections,
  emptyWorkspace,
  settingsSchema,
  tripStatus,
  type Collection,
  type Entity,
  type Workspace,
} from "../src/domain/models";
import { activeAssignment, odometer } from "../src/domain/rules";
import type { GoogleSheets, Cell } from "./google-sheets";

type Data = Record<string, Cell>;
type Projection = Record<string, Cell>;
type Loaded = {
  entity: Record<string, unknown>;
  rows: number[];
  values: Cell[];
};
type Spec = {
  tab: string;
  id: string;
  columns: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each spec projects its own entity type
  project: (e: any, s: Workspace) => Projection;
  legacy?: (rows: LegacyRow[], ctx: LegacyContext) => Loaded[];
};
type LegacyRow = { rowNumber: number; values: Cell[]; data: Data };
type LegacyContext = { tabs: Map<string, SheetTab> };
export type SheetTab = {
  title: string;
  headers: string[];
  rows: { rowNumber: number; values: Cell[] }[];
};
export type Index = Map<
  Collection,
  Map<string, { rows: number[]; values: Cell[] }>
>;
export type Snapshot = {
  workspace: Workspace;
  index: Index;
  tabs: Map<string, SheetTab>;
  settings: Record<string, string>;
};

const JSON_COLUMN = "fc_json";
const EPOCH = "2000-01-01T00:00:00.000Z";

// ---------- value helpers ----------
const isBlank = (v: unknown) => v === "" || v === null || v === undefined;
const text = (d: Data, k: string, fallback = "") =>
  isBlank(d[k]) ? fallback : String(d[k]).trim();
const num = (d: Data, k: string) => {
  if (isBlank(d[k])) return null;
  const n = Number(
    typeof d[k] === "string" ? String(d[k]).replace(",", ".") : d[k],
  );
  return Number.isFinite(n) ? n : null;
};
const bool = (d: Data, k: string) =>
  [true, 1, "TRUE", "true", "Ano", "ANO", "ano"].includes(d[k] as never);
const minor = (d: Data, k: string) => {
  const n = num(d, k);
  return n === null ? null : Math.round(n * 100);
};
const czk = (m: number | null | undefined) =>
  m === null || m === undefined ? "" : m / 100;
const split = (v: unknown) =>
  String(v ?? "")
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter(Boolean);
const oneOf = <T extends string>(
  value: string,
  allowed: readonly T[],
  fallback: T,
): T =>
  (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
const rowVersion = (values: Cell[]) =>
  Number.parseInt(
    createHash("sha256")
      .update(JSON.stringify(values))
      .digest("hex")
      .slice(0, 7),
    16,
  ) + 1;

/** Sheets date serial (days since 1899-12-30) → YYYY-MM-DD. */
const serialDate = (n: number) =>
  new Date(Math.round((n - 25569) * 86400000)).toISOString().slice(0, 10);
export function dateOnly(value: unknown): string | null {
  if (isBlank(value)) return null;
  if (typeof value === "number") return serialDate(value);
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const cz = raw.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
  if (cz) return `${cz[3]}-${cz[2].padStart(2, "0")}-${cz[1].padStart(2, "0")}`;
  const date = new Date(raw);
  return Number.isNaN(date.valueOf()) ? null : pragueDate(date.toISOString());
}
export function stamp(
  value: unknown,
  fallback: string | null = EPOCH,
): string | null {
  if (isBlank(value)) return fallback;
  if (typeof value === "number")
    return new Date(Math.round((value - 25569) * 86400000)).toISOString();
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw))
    return new Date(`${raw}T00:00:00${pragueOffset(raw)}`).toISOString();
  const date = new Date(raw);
  return Number.isNaN(date.valueOf()) ? fallback : date.toISOString();
}

// ---------- Prague time for readable columns ----------
const pragueParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value || "00";
  return {
    y: get("year"),
    m: get("month"),
    d: get("day"),
    h: get("hour"),
    mi: get("minute"),
    s: get("second"),
  };
};
function offsetOf(date: Date) {
  const p = pragueParts(date);
  const local = Date.UTC(+p.y, +p.m - 1, +p.d, +p.h, +p.mi, +p.s);
  const minutes = Math.round(
    (local - Math.floor(date.getTime() / 1000) * 1000) / 60000,
  );
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}
const pragueOffset = (day: string) => offsetOf(new Date(`${day}T12:00:00Z`));
/** ISO instant → "YYYY-MM-DDTHH:mm:ss+01:00" in Prague time (format the Make scenarios already parse). */
export function pragueStamp(value: unknown): Cell {
  if (isBlank(value)) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.valueOf())) return String(value);
  const p = pragueParts(date);
  return `${p.y}-${p.m}-${p.d}T${p.h}:${p.mi}:${p.s}${offsetOf(date)}`;
}
/** ISO instant or date → Prague calendar date (never shifted by the UTC offset). */
export function pragueDate(value: unknown): string {
  if (isBlank(value)) return "";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(raw);
  if (Number.isNaN(date.valueOf())) return raw;
  const p = pragueParts(date);
  return `${p.y}-${p.m}-${p.d}`;
}

/**
 * The frontend compares timestamps as strings (`a.from > now`). Mixed offsets
 * ("+01:00" vs "Z") make an already effective assignment look "Plánováno",
 * so every instant leaving the server is normalized to UTC.
 */
const INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})$/i;
export function normalizeInstants<T>(value: T): T {
  if (typeof value === "string")
    return (INSTANT.test(value) ? new Date(value).toISOString() : value) as T;
  if (Array.isArray(value)) return value.map(normalizeInstants) as T;
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, normalizeInstants(v)]),
    ) as T;
  return value;
}

const base = (id: unknown, version: number, at: string | null = EPOCH) => ({
  id: String(id),
  version,
  createdAt: at || EPOCH,
  updatedAt: at || EPOCH,
  source: "import" as const,
});
const legacyEach =
  (map: (d: Data, r: LegacyRow) => Record<string, unknown> | null) =>
  (rows: LegacyRow[]) =>
    rows.flatMap((r) => {
      const entity = map(r.data, r);
      return entity ? [{ entity, rows: [r.rowNumber], values: r.values }] : [];
    });
const currentDriverVehicle = (s: Workspace, driverId: string) => {
  const now = new Date().toISOString();
  return (
    s.assignments.find(
      (a) => a.driverId === driverId && a.from <= now && (!a.to || a.to > now),
    )?.vehicleId || ""
  );
};
const licenceColumn = (name: string) => {
  const key = name.toUpperCase().replace(/[\s+]/g, "");
  return key === "B"
    ? "licence_b_until"
    : key === "C"
      ? "licence_c_until"
      : key === "CE"
        ? "licence_ce_until"
        : null;
};
const assignmentState = (a: { from: string; to: string | null }) => {
  const now = new Date().toISOString();
  return a.to && a.to <= now
    ? "Ukončeno"
    : a.from > now
      ? "Plánováno"
      : "Aktivní";
};
const documentTypeFromLegacy = (d: Data) => {
  const title = `${text(d, "title")} ${text(d, "document_type")}`;
  if (/stk/i.test(title)) return "STK";
  if (/poji/i.test(title)) return "Pojištění";
  if (/ccs/i.test(title)) return "CCS výpis";
  if (/objedn/i.test(title)) return "Objednávka";
  if (/dodac/i.test(title)) return "Dodací list";
  if (/účten|uctenk/i.test(title)) return "Účtenka";
  if (/servis/i.test(title)) return "Servisní doklad";
  return "Příloha";
};

// ---------- collection specs ----------
export const specs: Record<Exclude<Collection, "events">, Spec> = {
  vehicles: {
    tab: "vehicles",
    id: "vehicle_id",
    columns: [
      "spz",
      "brand_model",
      "type",
      "year",
      "vin",
      "purpose",
      "reserve",
      "driver_id",
      "odometer_km",
      "state",
      "stk_valid_until",
      "fuel_type",
    ],
    project: (v, s) => ({
      spz: v.spz,
      brand_model: v.model,
      type: v.category,
      year: v.year ?? "",
      vin: v.vin,
      purpose: v.purpose,
      reserve: v.reserve ? "TRUE" : "FALSE",
      driver_id: activeAssignment(s, v.id)?.driverId || "",
      odometer_km: odometer(s, v.id) ?? "",
      state: v.state,
      stk_valid_until: v.stkUntil || "",
      fuel_type: v.fuel,
    }),
    legacy: legacyEach((d, r) => ({
      ...base(d.vehicle_id, rowVersion(r.values)),
      spz: text(d, "spz", "Bez SPZ"),
      vin: text(d, "vin"),
      model: text(d, "brand_model", "Neuvedeno"),
      year: num(d, "year"),
      category: oneOf(
        text(d, "type"),
        ["Kamion", "Nákladní vozidlo", "Dodávka", "Osobní auto"],
        "Nákladní vozidlo",
      ),
      purpose: text(d, "purpose"),
      reserve: bool(d, "reserve"),
      state: oneOf(
        text(d, "state"),
        ["V provozu", "V servisu", "Odstaveno"],
        "V provozu",
      ),
      fuel: text(d, "fuel_type"),
      stkUntil: dateOnly(d.stk_valid_until),
      serviceId: null,
    })),
  },
  drivers: {
    tab: "drivers",
    id: "driver_id",
    columns: [
      "name",
      "phone",
      "email",
      "state",
      "licence",
      "licence_valid_until",
      "vehicle_id",
      "medical_fitness",
      "medical_valid_until",
      "licence_b_until",
      "licence_c_until",
      "licence_ce_until",
    ],
    project: (d, s) => {
      const licences = d.licences as {
        name: string;
        validUntil: string | null;
      }[];
      const dates = licences
        .map((l) => l.validUntil)
        .filter(Boolean)
        .sort() as string[];
      const perLicence: Projection = {
        licence_b_until: "",
        licence_c_until: "",
        licence_ce_until: "",
      };
      for (const l of licences) {
        const column = licenceColumn(l.name);
        if (column) perLicence[column] = l.validUntil || "";
      }
      return {
        name: d.name,
        phone: d.phone,
        email: d.email,
        state: d.suspended ? "Pozastavený" : "Aktivní",
        licence: licences.map((l) => l.name).join(", "),
        licence_valid_until: dates[0] || "",
        vehicle_id: currentDriverVehicle(s, d.id),
        medical_fitness: d.medicalState,
        medical_valid_until: d.medicalUntil || "",
        ...perLicence,
      };
    },
    legacy: legacyEach((d, r) => {
      const fitness = text(d, "medical_fitness");
      return {
        ...base(d.driver_id, rowVersion(r.values)),
        name: text(d, "name", "Neuvedeno"),
        phone: text(d, "phone"),
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(d, "email"))
          ? text(d, "email")
          : "",
        suspended: text(d, "state") !== "Aktivní",
        licences: split(d.licence).map((name) => {
          const column = licenceColumn(name);
          return {
            name,
            validUntil:
              dateOnly(column ? d[column] : null) ??
              dateOnly(d.licence_valid_until),
          };
        }),
        qualifications: [],
        medicalState: /nezp|ne$/i.test(fitness)
          ? "Nezpůsobilý"
          : /způsob|zpusob|ano|true/i.test(fitness)
            ? "Způsobilý"
            : "Není doloženo",
        medicalUntil: dateOnly(d.medical_valid_until),
      };
    }),
  },
  assignments: {
    tab: "assignments",
    id: "assignment_id",
    columns: [
      "vehicle_id",
      "driver_id",
      "valid_from",
      "valid_to",
      "odometer_km",
      "reason",
      "state",
    ],
    project: (a) => ({
      vehicle_id: a.vehicleId,
      driver_id: a.driverId,
      valid_from: pragueStamp(a.from),
      valid_to: pragueStamp(a.to),
      odometer_km: a.odometer ?? "",
      reason: a.reason,
      state: assignmentState(a),
    }),
    legacy: legacyEach((d, r) =>
      d.vehicle_id && d.driver_id
        ? {
            ...base(d.assignment_id, rowVersion(r.values), stamp(d.valid_from)),
            vehicleId: text(d, "vehicle_id"),
            driverId: text(d, "driver_id"),
            from: stamp(d.valid_from),
            to: stamp(d.valid_to, null),
            reason: text(d, "reason", "Neuvedeno"),
            odometer: num(d, "odometer_km"),
          }
        : null,
    ),
  },
  readings: {
    tab: "readings",
    id: "reading_id",
    columns: ["vehicle_id", "at", "km", "reference_id"],
    project: (r) => ({
      vehicle_id: r.vehicleId,
      at: pragueStamp(r.at),
      km: r.km,
      reference_id: r.referenceId || "",
    }),
  },
  orders: {
    tab: "orders",
    id: "order_id",
    columns: [
      "order_number",
      "customer",
      "from_location",
      "to_location",
      "pickup_date",
      "delivery_date",
      "state",
      "created_at",
      "vehicle_id",
      "driver_id",
    ],
    project: (o) => {
      const first = o.stops[0],
        last = o.stops[o.stops.length - 1];
      return {
        order_number: o.number,
        customer: o.customer,
        from_location: first?.place || "",
        to_location: last?.place || "",
        pickup_date: pragueDate(first?.from),
        delivery_date: pragueDate(last?.to || last?.from),
        state: o.state,
        created_at: pragueStamp(o.createdAt),
        vehicle_id: o.vehicleId || "",
        driver_id: o.driverId || "",
      };
    },
    legacy: legacyEach((d, r) => {
      const id = text(d, "order_id");
      const pickup = dateOnly(d.pickup_date),
        delivery = dateOnly(d.delivery_date);
      return {
        ...base(id, rowVersion(r.values), stamp(d.created_at)),
        number: text(d, "order_number", id),
        customer: text(d, "customer", "Neuvedeno"),
        externalId: "",
        stops: [
          {
            id: `${id}-1`,
            type: "Nakládka",
            place: text(d, "from_location"),
            from: pickup
              ? stamp(`${pickup}T08:00:00${pragueOffset(pickup)}`)
              : null,
            to: null,
          },
          {
            id: `${id}-2`,
            type: "Vykládka",
            place: text(d, "to_location"),
            from: null,
            to: delivery
              ? stamp(`${delivery}T17:00:00${pragueOffset(delivery)}`)
              : null,
          },
        ],
        state: oneOf(
          text(d, "state"),
          [
            "Přijatá",
            "K doplnění",
            "K přiřazení",
            "Přiřazená",
            "Probíhá",
            "Dokončená",
            "Uzavřená",
            "Zrušená",
          ],
          "Přijatá",
        ),
        vehicleId: text(d, "vehicle_id") || null,
        driverId: text(d, "driver_id") || null,
      };
    }),
  },
  trips: {
    tab: "trips",
    id: "trip_id",
    columns: [
      "vehicle_id",
      "driver_id",
      "order_number",
      "start_at",
      "actual_end_at",
      "from",
      "to",
      "odometer_start",
      "odometer_end",
      "km",
      "state",
      "source",
    ],
    project: (t) => ({
      vehicle_id: t.vehicleId,
      driver_id: t.driverId,
      order_number: t.purpose,
      start_at: pragueStamp(t.startAt),
      actual_end_at: pragueStamp(t.endAt),
      from: t.from,
      to: t.to,
      odometer_start: t.startKm,
      odometer_end: t.endKm ?? "",
      km: t.endKm === null ? "" : Math.max(0, t.endKm - t.startKm),
      state: tripStatus(t),
      source: t.note,
    }),
    legacy: legacyEach((d, r) => {
      if (isBlank(d.start_at)) return null;
      const endKm = num(d, "odometer_end");
      const state = text(d, "state");
      return {
        ...base(d.trip_id, rowVersion(r.values), stamp(d.start_at)),
        vehicleId: text(d, "vehicle_id"),
        driverId: text(d, "driver_id"),
        orderId: null,
        purpose: text(d, "order_number"),
        from: text(d, "from", "Neuvedeno"),
        to: text(d, "to"),
        startAt: stamp(d.start_at),
        endAt: stamp(d.actual_end_at, null),
        startKm: num(d, "odometer_start") ?? 0,
        endKm,
        state:
          oneOf(
            state,
            [
              "Probíhá",
              "Ukončena neúplná",
              "K ověření",
              "Potvrzena",
              "Uzavřena",
            ],
            "" as never,
          ) ||
          (isBlank(d.actual_end_at)
            ? "Probíhá"
            : endKm === null
              ? "Ukončena neúplná"
              : "K ověření"),
        note: text(d, "source"),
      };
    }),
  },
  faults: {
    tab: "faults",
    id: "fault_id",
    columns: [
      "vehicle_id",
      "driver_id",
      "reported_at",
      "odometer_km",
      "category",
      "description",
      "urgency",
      "state",
      "unavailable",
      "repair",
      "estimate_czk",
      "actual_czk",
      "case_reference",
    ],
    project: (f) => ({
      vehicle_id: f.vehicleId,
      driver_id: f.driverId || "",
      reported_at: pragueStamp(f.at),
      odometer_km: f.km ?? "",
      category: f.category,
      description: f.description,
      urgency: f.urgency,
      state: f.state,
      unavailable: f.unavailable ? "TRUE" : "FALSE",
      repair: f.repair,
      estimate_czk: czk(f.estimateMinor),
      actual_czk: czk(f.actualMinor),
      case_reference: f.caseReference,
    }),
    legacy: legacyEach((d, r) => ({
      ...base(d.fault_id, rowVersion(r.values), stamp(d.reported_at)),
      vehicleId: text(d, "vehicle_id"),
      driverId: text(d, "driver_id") || null,
      at: stamp(d.reported_at),
      km: num(d, "odometer_km"),
      category: text(d, "category", "Jiné"),
      description: text(d, "description", "Bez popisu").padEnd(3, "."),
      urgency: oneOf(
        text(d, "urgency"),
        ["Nízká", "Střední", "Vysoká"],
        "Střední",
      ),
      state: oneOf(
        text(d, "state"),
        [
          "Nahlášena",
          "Řeší se",
          "Naplánován servis",
          "V servisu",
          "Vyřešena",
          "Uzavřena",
        ],
        "Nahlášena",
      ),
      unavailable: bool(d, "unavailable"),
      repair: text(d, "repair"),
      estimateMinor: minor(d, "estimate_czk"),
      actualMinor: minor(d, "actual_czk"),
      caseReference: text(d, "case_reference"),
    })),
  },
  fuels: {
    tab: "fuel",
    id: "fuel_id",
    columns: [
      "vehicle_id",
      "driver_id",
      "date",
      "litres",
      "amount_czk",
      "full_tank",
      "station",
      "match_state",
      "at",
    ],
    project: (f) => ({
      vehicle_id: f.vehicleId,
      driver_id: f.driverId,
      date: pragueDate(f.at),
      at: pragueStamp(f.at),
      litres: f.litres ?? "",
      amount_czk: czk(f.amountMinor),
      full_tank: f.full,
      station: f.station,
      match_state: f.state,
    }),
    legacy: legacyEach((d, r) =>
      d.vehicle_id && d.driver_id && !isBlank(d.date)
        ? {
            ...base(d.fuel_id, rowVersion(r.values), stamp(d.at || d.date)),
            vehicleId: text(d, "vehicle_id"),
            driverId: text(d, "driver_id"),
            at: stamp(d.at || d.date),
            litres: num(d, "litres"),
            amountMinor: minor(d, "amount_czk") ?? minor(d, "ccs_amount_czk"),
            station: text(d, "station"),
            full: bool(d, "full_tank")
              ? "Ano"
              : text(d, "full_tank") === "Ne"
                ? "Ne"
                : "Není doloženo",
            state: oneOf(
              text(d, "match_state"),
              [
                "Čeká na výpis",
                "Spárováno",
                "Rozdíl",
                "Více kandidátů",
                "Chybí záznam řidiče",
                "Neúplný podklad",
                "Vyřešeno",
              ],
              "Čeká na výpis",
            ),
          }
        : null,
    ),
  },
  statements: {
    tab: "ccs_statements",
    id: "statement_id",
    columns: ["name", "period_from", "period_to", "received_at", "processing"],
    project: (x) => ({
      name: x.name,
      period_from: x.periodFrom || "",
      period_to: x.periodTo || "",
      received_at: pragueStamp(x.receivedAt),
      processing: x.processing,
    }),
  },
  transactions: {
    tab: "ccs_transactions",
    id: "transaction_id",
    columns: [
      "statement_id",
      "external_id",
      "vehicle_id",
      "card_id",
      "at",
      "amount_czk",
      "litres",
      "fuel_id",
      "state",
      "resolved_czk",
      "resolution",
    ],
    project: (t) => ({
      statement_id: t.statementId,
      external_id: t.externalId,
      vehicle_id: t.vehicleId || "",
      card_id: t.cardId || "",
      at: pragueStamp(t.at),
      amount_czk: czk(t.amountMinor),
      litres: t.litres ?? "",
      fuel_id: t.fuelId || "",
      state: t.state,
      resolved_czk: czk(t.resolvedMinor),
      resolution: t.resolution,
    }),
  },
  expenses: {
    tab: "other_expenses",
    id: "expense_id",
    columns: [
      "vehicle_id",
      "date",
      "category",
      "amount_czk",
      "note",
      "created_at",
      "kind",
      "original_id",
    ],
    project: (e) => ({
      vehicle_id: e.vehicleId,
      date: pragueDate(e.date),
      category: e.category,
      amount_czk: czk(e.amountMinor),
      note: e.description,
      created_at: pragueStamp(e.createdAt),
      kind: e.kind,
      original_id: e.originalId || "",
    }),
    legacy: legacyEach((d, r) => {
      const raw = text(d, "category");
      const category = /pneu/i.test(raw)
        ? "Pneumatiky"
        : /mýt|myt/i.test(raw)
          ? "Mýto"
          : /servis/i.test(raw)
            ? "Servis"
            : /poji/i.test(raw)
              ? "Pojištění"
              : /poplat/i.test(raw)
                ? "Poplatky"
                : "Jiné";
      return d.vehicle_id
        ? {
            ...base(d.expense_id, rowVersion(r.values), stamp(d.created_at)),
            vehicleId: text(d, "vehicle_id"),
            category,
            date: dateOnly(d.date) || "",
            amountMinor: minor(d, "amount_czk") ?? 0,
            currency: "CZK",
            vat: null,
            description: text(d, "note", raw || "Výdaj"),
            paidAt: null,
            kind: "Výdaj",
            originalId: null,
          }
        : null;
    }),
  },
  deadlines: {
    tab: "deadlines",
    id: "deadline_id",
    columns: ["vehicle_id", "deadline_type", "valid_until", "state"],
    project: (d) => ({
      vehicle_id: d.vehicleId || "",
      deadline_type: d.title,
      valid_until: d.date || "",
      state: d.state,
    }),
    legacy: legacyEach((d, r) => {
      const title = text(d, "deadline_type", "Termín");
      const state = text(d, "state");
      return {
        ...base(d.deadline_id, rowVersion(r.values)),
        title,
        type: /stk/i.test(title)
          ? "STK"
          : /poji/i.test(title)
            ? "Pojištění"
            : /oprávn|opravn|řidič/i.test(title)
              ? "Oprávnění"
              : "Servis",
        vehicleId: text(d, "vehicle_id") || null,
        driverId: null,
        date: dateOnly(d.valid_until),
        km: num(d, "valid_until_km"),
        responsible: "Fleet manažer",
        priority: "Střední",
        state:
          state === "Splněno"
            ? "Splněno"
            : state === "Vyžaduje řešení"
              ? "Vyžaduje řešení"
              : "Plánováno",
        documentId: null,
      };
    }),
  },
  templates: {
    tab: "service_templates",
    id: "template_id",
    columns: ["name", "category", "items"],
    project: (t) => ({
      name: t.name,
      category: t.category,
      items: t.items.map((i: { name: string }) => i.name).join("; "),
    }),
  },
  plans: {
    tab: "service_plans",
    id: "service_plan_id",
    columns: [
      "vehicle_id",
      "title",
      "interval_km",
      "interval_months",
      "state",
      "created_at",
      "template_id",
    ],
    project: (p) => ({
      vehicle_id: p.vehicleId,
      title: p.items.map((i: { name: string }) => i.name).join("; "),
      interval_km: p.items
        .map((i: { intervalKm: number | null }) => i.intervalKm ?? "–")
        .join("; "),
      interval_months: p.items
        .map((i: { intervalMonths: number | null }) => i.intervalMonths ?? "–")
        .join("; "),
      state: "Aktivní",
      created_at: pragueStamp(p.createdAt),
      template_id: p.templateId || "",
    }),
    // Legacy rows are one plan item per row; the frontend has one plan per vehicle.
    legacy: (rows) => {
      const byVehicle = new Map<string, LegacyRow[]>();
      for (const r of rows)
        if (r.data.vehicle_id)
          byVehicle.set(String(r.data.vehicle_id), [
            ...(byVehicle.get(String(r.data.vehicle_id)) || []),
            r,
          ]);
      return [...byVehicle.entries()].map(([vehicleId, group]) => ({
        entity: {
          ...base(
            group[0].data.service_plan_id,
            rowVersion(group.flatMap((g) => g.values)),
            stamp(group[0].data.created_at),
          ),
          vehicleId,
          templateId: null,
          completions: [],
          items: group.map((g) => ({
            id: text(g.data, "service_plan_id"),
            name: text(g.data, "title", "Servisní úkon"),
            intervalKm: num(g.data, "interval_km"),
            intervalMonths: num(g.data, "interval_months"),
            lastKm: null,
            lastDate: null,
            nextKm: null,
            nextDate: null,
          })),
        },
        rows: group.map((g) => g.rowNumber),
        values: group[0].values,
      }));
    },
  },
  services: {
    tab: "external_services",
    id: "service_id",
    columns: ["service_name", "email", "phone", "address"],
    project: (x) => ({
      service_name: x.name,
      email: x.email,
      phone: x.phone,
      address: x.address,
    }),
    legacy: legacyEach((d, r) => ({
      ...base(d.service_id, rowVersion(r.values)),
      name: text(d, "service_name", "Servis"),
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(d, "email"))
        ? text(d, "email")
        : "",
      phone: text(d, "phone"),
      address: text(d, "address"),
    })),
  },
  cards: {
    tab: "ccs_cards",
    id: "card_id",
    columns: ["card_number", "vehicle_id", "state", "tolerance_czk"],
    project: (c) => {
      const today = pragueDate(new Date().toISOString());
      const binding = c.bindings.find(
        (b: { from: string; to: string | null }) =>
          b.from <= today && (!b.to || b.to >= today),
      );
      return {
        card_number: c.number,
        vehicle_id: binding?.vehicleId || "",
        state: c.active ? "Aktivní" : "Neaktivní",
        tolerance_czk: czk(c.toleranceMinor),
      };
    },
    legacy: legacyEach((d, r) => ({
      ...base(d.card_id, rowVersion(r.values), stamp(d.created_at)),
      number: text(d, "card_number", text(d, "card_id")),
      active: text(d, "state", "Aktivní") === "Aktivní",
      toleranceMinor: minor(d, "tolerance_czk"),
      bindings: d.vehicle_id
        ? [
            {
              vehicleId: text(d, "vehicle_id"),
              from: dateOnly(d.created_at) || "2026-01-01",
              to: null,
            },
          ]
        : [],
    })),
  },
  notifications: {
    tab: "notifications",
    id: "notification_id",
    columns: [
      "aggregate_id",
      "recipient_role",
      "recipient_id",
      "email",
      "subject",
      "state",
      "reason",
      "service_at",
      "created_at",
    ],
    project: (n) => ({
      aggregate_id: n.aggregateId,
      recipient_role: n.recipientRole,
      recipient_id: n.recipientId || "",
      email: n.email || "",
      subject: n.subject,
      state: n.state,
      reason: n.reason,
      service_at: pragueStamp(n.serviceAt),
      created_at: pragueStamp(n.createdAt),
    }),
  },
  documents: {
    tab: "documents",
    id: "document_id",
    columns: [
      "document_type",
      "title",
      "linked_id",
      "source",
      "attachment_name",
      "file_ref",
      "received_at",
      "state",
      "owner_type",
      "vehicle_id",
      "valid_until",
    ],
    project: (d) => ({
      document_type: d.type,
      title: d.name,
      linked_id: d.ownerId,
      source: d.source === "import" ? "Import" : "Aplikace",
      attachment_name: d.name,
      file_ref: d.storageKey.startsWith("drive:")
        ? d.storageKey.slice(6)
        : `vps:${d.storageKey}`,
      received_at: pragueStamp(d.uploadedAt),
      state: d.deletedAt ? "Smazáno" : "Uloženo",
      owner_type: d.ownerType,
      vehicle_id: d.vehicleId || "",
      valid_until: d.validUntil || "",
    }),
    legacy: (rows, ctx) => {
      const ids = (tab: string, column: string) =>
        new Set(
          (ctx.tabs.get(tab)?.rows || []).map((r) =>
            String(r.values[ctx.tabs.get(tab)!.headers.indexOf(column)] ?? ""),
          ),
        );
      const vehicles = ids("vehicles", "vehicle_id"),
        orders = ids("orders", "order_id");
      return legacyEach((d, r) => {
        const linked = text(d, "linked_id");
        const name = text(d, "attachment_name") || text(d, "title", "Dokument");
        const ownerType = vehicles.has(linked)
          ? "vehicle"
          : orders.has(linked)
            ? "order"
            : "intake";
        return {
          ...base(d.document_id, rowVersion(r.values), stamp(d.received_at)),
          ownerType,
          ownerId: ownerType === "intake" ? "intake" : linked,
          vehicleId: ownerType === "vehicle" ? linked : null,
          type: documentTypeFromLegacy(d),
          name: text(d, "title", name),
          mime: /\.(jpe?g)$/i.test(name)
            ? "image/jpeg"
            : /\.png$/i.test(name)
              ? "image/png"
              : "application/pdf",
          size: 0,
          storageKey: `drive:${text(d, "file_ref")}`,
          hash: "",
          uploadedAt: stamp(d.received_at),
          validUntil: null,
          dueAt: null,
          fileState: "stored",
          extraction: "not_configured",
          jobId: null,
          error:
            text(d, "state") === "Chyba"
              ? "Zpracování dokladu skončilo chybou."
              : "",
          deletedAt: null,
        };
      })(rows);
    },
  },
};
const persisted = Object.keys(specs) as (keyof typeof specs)[];
export const requiredTabs = () => [
  ...persisted.map((c) => ({
    tab: specs[c].tab,
    headers: [specs[c].id, ...specs[c].columns, JSON_COLUMN],
  })),
  { tab: "settings", headers: ["key", "value", "note"] },
];

// ---------- load ----------
export async function loadSnapshot(sheets: GoogleSheets): Promise<Snapshot> {
  const titles = [
    ...new Set([...persisted.map((c) => specs[c].tab), "settings"]),
  ];
  const tabs = await sheets.readTabs(titles);
  const workspace = emptyWorkspace();
  const index: Index = new Map();
  const ctx: LegacyContext = { tabs };
  for (const collection of persisted) {
    const spec = specs[collection];
    const tab = tabs.get(spec.tab);
    const entries = new Map<string, { rows: number[]; values: Cell[] }>();
    index.set(collection, entries);
    if (!tab) continue;
    const jsonAt = tab.headers.indexOf(JSON_COLUMN);
    const loaded: Loaded[] = [];
    const legacy: LegacyRow[] = [];
    for (const row of tab.rows) {
      const json = jsonAt >= 0 ? row.values[jsonAt] : "";
      if (!isBlank(json)) {
        try {
          loaded.push({
            entity: JSON.parse(String(json)),
            rows: [row.rowNumber],
            values: row.values,
          });
        } catch {
          console.warn(
            `Neplatný ${JSON_COLUMN} v ${spec.tab}!${row.rowNumber}, řádek přeskočen.`,
          );
        }
      } else {
        const data = Object.fromEntries(
          tab.headers.map((h, i) => [h, row.values[i] ?? ""]),
        ) as Data;
        if (!isBlank(data[spec.id])) legacy.push({ ...row, data });
      }
    }
    if (spec.legacy) loaded.push(...spec.legacy(legacy, ctx));
    const list = workspace[collection] as Entity[];
    for (const item of loaded) {
      const parsed = collections[collection].safeParse(
        normalizeInstants(item.entity),
      );
      if (!parsed.success) {
        console.warn(
          `Řádek ${spec.tab}!${item.rows.join(",")} neodpovídá schématu, přeskočen: ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}`,
        );
        continue;
      }
      if (entries.has(parsed.data.id)) {
        console.warn(
          `Duplicitní ${spec.id} ${parsed.data.id} v ${spec.tab}, ponechán první řádek.`,
        );
        continue;
      }
      entries.set(parsed.data.id, { rows: item.rows, values: item.values });
      list.push(parsed.data as Entity);
    }
  }
  synthesizeLegacyLinks(workspace, tabs);
  const settings = Object.fromEntries(
    (tabs.get("settings")?.rows || []).map((r) => [
      String(r.values[0] ?? ""),
      String(r.values[1] ?? ""),
    ]),
  );
  const managerEmail = settingsSchema.shape.managerEmail.safeParse(
    settings.manager_email || "",
  );
  workspace.settings = {
    managerEmail: managerEmail.success ? managerEmail.data : "",
    daysBefore: settings.a5_levels_days
      ? split(settings.a5_levels_days)
          .map(Number)
          .filter((n) => Number.isInteger(n) && n >= 0)
      : null,
    kmBefore:
      settings.km_before && Number.isFinite(Number(settings.km_before))
        ? Number(settings.km_before)
        : null,
  };
  return { workspace, index, tabs, settings };
}

/** Old rows store the current driver and odometer on the vehicle only; expose them as frontend records. */
function synthesizeLegacyLinks(s: Workspace, tabs: Map<string, SheetTab>) {
  const tab = tabs.get("vehicles");
  if (!tab) return;
  const col = (name: string) => tab.headers.indexOf(name);
  const jsonAt = col(JSON_COLUMN);
  for (const row of tab.rows) {
    if (jsonAt >= 0 && !isBlank(row.values[jsonAt])) continue;
    const vehicleId = String(row.values[col("vehicle_id")] ?? "");
    if (!s.vehicles.some((v) => v.id === vehicleId)) continue;
    const km = Number(row.values[col("odometer_km")]);
    if (
      col("odometer_km") >= 0 &&
      !isBlank(row.values[col("odometer_km")]) &&
      Number.isFinite(km) &&
      !s.readings.some((r) => r.vehicleId === vehicleId)
    )
      s.readings.push({
        ...base(`sheet-reading-${vehicleId}`, 1),
        vehicleId,
        at: EPOCH,
        km,
        referenceId: `sheet-odometer-${vehicleId}`,
      });
    const driverId = String(row.values[col("driver_id")] ?? "");
    if (
      driverId &&
      s.drivers.some((d) => d.id === driverId) &&
      !activeAssignment(s, vehicleId) &&
      !s.assignments.some((a) => a.id === `sheet-assignment-${vehicleId}`)
    )
      s.assignments.push({
        ...base(`sheet-assignment-${vehicleId}`, 1),
        vehicleId,
        driverId,
        from: EPOCH,
        to: null,
        reason: "Převzato z tabulky",
        odometer: null,
      });
  }
}

// ---------- save ----------
const cellsEqual = (a: Projection, b: Projection) =>
  JSON.stringify(a) === JSON.stringify(b);
/** Writes every entity whose JSON or readable columns changed between `before` and `after`. */
export async function saveChanges(
  sheets: GoogleSheets,
  snapshot: Snapshot,
  after: Workspace,
) {
  const before = snapshot.workspace;
  const updates: { tab: string; rowNumber: number; values: Cell[] }[] = [];
  const appends = new Map<string, Cell[][]>();
  let changed = 0;
  for (const collection of persisted) {
    const spec = specs[collection];
    const tab = snapshot.tabs.get(spec.tab);
    if (!tab)
      throw Object.assign(new Error(`Chybí list ${spec.tab}.`), {
        status: 500,
      });
    const index = snapshot.index.get(collection)!;
    const previous = new Map(
      (before[collection] as Entity[]).map((e) => [e.id, e]),
    );
    const toRow = (entity: Entity, base: Cell[]) => {
      const values = [...base];
      while (values.length < tab.headers.length) values.push("");
      const cells: Projection = {
        [spec.id]: entity.id,
        ...spec.project(entity, after),
        [JSON_COLUMN]: JSON.stringify(entity),
      };
      for (const [key, value] of Object.entries(cells)) {
        const at = tab.headers.indexOf(key);
        if (at >= 0) values[at] = value ?? "";
      }
      return values;
    };
    const nextIds = new Set<string>();
    for (const entity of after[collection] as Entity[]) {
      nextIds.add(entity.id);
      const location = index.get(entity.id);
      const old = previous.get(entity.id);
      if (!location) {
        appends.set(spec.tab, [
          ...(appends.get(spec.tab) || []),
          toRow(entity, []),
        ]);
        changed++;
        continue;
      }
      if (
        old &&
        JSON.stringify(old) === JSON.stringify(entity) &&
        cellsEqual(spec.project(old, before), spec.project(entity, after))
      )
        continue;
      updates.push({
        tab: spec.tab,
        rowNumber: location.rows[0],
        values: toRow(entity, location.values),
      });
      for (const extra of location.rows.slice(1))
        updates.push({
          tab: spec.tab,
          rowNumber: extra,
          values: Array(tab.headers.length).fill(""),
        });
      changed++;
    }
    for (const [id, location] of index)
      if (!nextIds.has(id) && previous.has(id)) {
        for (const rowNumber of location.rows)
          updates.push({
            tab: spec.tab,
            rowNumber,
            values: Array(tab.headers.length).fill(""),
          });
        changed++;
      }
  }
  if (JSON.stringify(before.settings) !== JSON.stringify(after.settings)) {
    const tab = snapshot.tabs.get("settings")!;
    const wanted: Record<string, string> = {
      manager_email: after.settings.managerEmail,
      a5_levels_days: (after.settings.daysBefore || []).join(","),
      km_before:
        after.settings.kmBefore === null ? "" : String(after.settings.kmBefore),
    };
    for (const [key, value] of Object.entries(wanted)) {
      const row = tab.rows.find((r) => String(r.values[0]) === key);
      if (row)
        updates.push({
          tab: "settings",
          rowNumber: row.rowNumber,
          values: [key, value, ...row.values.slice(2)],
        });
      else
        appends.set("settings", [
          ...(appends.get("settings") || []),
          [key, value, "Nastavení z aplikace"],
        ]);
    }
    changed++;
  }
  if (updates.length) await sheets.updateRows(updates);
  for (const [tab, rows] of appends) await sheets.appendRows(tab, rows);
  return changed;
}
