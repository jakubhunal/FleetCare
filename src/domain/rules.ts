import type { Actor, Driver, Order, Trip, Vehicle, Workspace } from "./models";
import { normalize, today } from "../lib/format";
export class DomainError extends Error {
  constructor(
    message: string,
    public field?: string,
    public status = 422,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
export function manager(actor: Actor) {
  if (actor.role === "Řidič")
    throw new DomainError("K této operaci nemáte oprávnění.", undefined, 403);
}
export const activeAssignment = (
  s: Workspace,
  vehicleId: string,
  at = new Date().toISOString(),
) =>
  s.assignments.find(
    (a) => a.vehicleId === vehicleId && a.from <= at && (!a.to || a.to > at),
  );
export function availableVehicles(s: Workspace, driverId: string | null) {
  if (!driverId) return [];
  const ids = new Set([
    ...s.assignments
      .filter(
        (a) =>
          a.driverId === driverId &&
          a.from <= new Date().toISOString() &&
          (!a.to || a.to > new Date().toISOString()),
      )
      .map((a) => a.vehicleId),
    ...s.orders
      .filter(
        (o) =>
          o.driverId === driverId &&
          !["Uzavřená", "Zrušená", "Dokončená"].includes(o.state),
      )
      .map((o) => o.vehicleId),
  ]);
  return s.vehicles.filter((v) => ids.has(v.id));
}
export function odometer(s: Workspace, vehicleId: string) {
  const values = s.readings.filter((r) => r.vehicleId === vehicleId);
  return values.length ? Math.max(...values.map((r) => r.km)) : null;
}
export function driverState(d: Driver) {
  return d.suspended
    ? "Pozastavený"
    : d.email && d.phone && d.licences.length
      ? "Aktivní"
      : "Rozpracovaný";
}
export function overlap(
  a: string,
  b: string | null,
  c: string,
  d: string | null,
) {
  return a < (d || "9999") && c < (b || "9999");
}
export function orderWindow(o: Order) {
  const starts = o.stops.map((x) => x.from).filter((x): x is string => !!x);
  const ends = o.stops.map((x) => x.to).filter((x): x is string => !!x);
  return { from: starts.sort()[0] || null, to: ends.sort().at(-1) || null };
}
export type Suitability = {
  state: "Vhodné" | "Nevhodné" | "Nelze vyhodnotit";
  reasons: string[];
};
export function suitability(
  s: Workspace,
  o: Order,
  v: Vehicle | null,
  d: Driver | null,
): Suitability {
  const bad: string[] = [],
    missing: string[] = [];
  const w = orderWindow(o);
  const through = (w.to || new Date().toISOString()).slice(0, 10);
  if (!w.from || !w.to) missing.push("časová okna zakázky");
  if (v) {
    if (v.state !== "V provozu") bad.push("Technický stav: " + v.state);
    if (!v.stkUntil) missing.push("platnost STK");
    else if (v.stkUntil < through) bad.push("STK není platná po celé období");
    if (!o.category) missing.push("požadovaná kategorie");
    else if (v.category !== o.category) bad.push("Nevyhovující kategorie");
    const capacities = [
      ["nosnost", o.weightKg, v.capacityKg],
      ["objem", o.volumeM3, v.volumeM3],
      ["palety", o.pallets, v.pallets],
    ] as const;
    for (const [name, need, have] of capacities) {
      if (need === null) missing.push("požadavek: " + name);
      else if (need > 0 && have === null)
        missing.push("doložená kapacita: " + name);
      else if (have !== null && need > have)
        bad.push("Nedostatečná kapacita: " + name);
    }
    for (const item of o.equipment)
      if (!v.equipment.some((e) => normalize(e) === normalize(item)))
        bad.push("Chybí vybavení: " + item);
    if (o.dimensions) {
      const parse = (text: string) =>
        text
          .toLowerCase()
          .replace(/m/g, "")
          .split(/[×x]/)
          .map((x) => Number(x.trim().replace(",", ".")));
      const need = parse(o.dimensions),
        have = parse(v.dimensions);
      if (
        need.length !== 3 ||
        have.length !== 3 ||
        [...need, ...have].some((x) => !Number.isFinite(x) || x <= 0)
      )
        missing.push("rozměry délka × šířka × výška v metrech");
      else if (need.some((x, i) => x > have[i]))
        bad.push("Rozměry nákladu přesahují doložený nákladový prostor");
    }
    if (
      w.from &&
      w.to &&
      s.faults.some(
        (f) =>
          f.vehicleId === v.id &&
          f.unavailable &&
          f.serviceFrom &&
          overlap(w.from!, w.to, f.serviceFrom, f.serviceTo) &&
          !["Vyřešena", "Uzavřena"].includes(f.state),
      )
    )
      bad.push("Servisní nedostupnost v čase zakázky");
  }
  if (d) {
    if (d.suspended) bad.push("Řidič je pozastaven");
    const requirements = Array.from(
      new Set([o.licence, v?.licence || ""].filter(Boolean)),
    );
    if (!requirements.length) missing.push("požadovaná skupina ŘP");
    for (const required of requirements) {
      const e = d.licences.find(
        (e) => normalize(e.name) === normalize(required),
      );
      if (!e || !e.validUntil) missing.push("platné oprávnění " + required);
      else if (e.validUntil < through)
        bad.push("Propadlé oprávnění " + required);
    }
    for (const name of o.qualifications) {
      const q = d.qualifications.find(
        (q) => normalize(q.name) === normalize(name),
      );
      if (!q?.validUntil) missing.push("platnost kvalifikace " + name);
      else if (q.validUntil < through) bad.push("Propadlá kvalifikace " + name);
    }
    if (d.medicalState === "Nezpůsobilý")
      bad.push("Řidič není zdravotně způsobilý");
  }
  return {
    state: bad.length
      ? "Nevhodné"
      : missing.length
        ? "Nelze vyhodnotit"
        : "Vhodné",
    reasons: [...bad, ...missing.map((x) => "Chybí " + x)],
  };
}
export function validateTrip(s: Workspace, t: Trip) {
  if (!t.orderId && !t.purpose.trim())
    throw new DomainError(
      "Jízda bez zakázky musí mít vlastní účel.",
      "purpose",
    );
  if (t.endAt && t.endAt <= t.startAt)
    throw new DomainError("Konec musí být po začátku jízdy.", "endAt");
  if (t.endKm !== null && t.endKm < t.startKm)
    throw new DomainError(
      "Koncový tachometr nesmí být nižší než počáteční.",
      "endKm",
    );
  if (
    s.trips.some(
      (x) =>
        x.id !== t.id &&
        (x.vehicleId === t.vehicleId || x.driverId === t.driverId) &&
        overlap(t.startAt, t.endAt, x.startAt, x.endAt),
    )
  )
    throw new DomainError(
      "Jízda se překrývá s jízdou vozidla nebo řidiče.",
      "startAt",
    );
}
export function a6Due(t: Trip, at = new Date()) {
  return (
    !!t.endAt &&
    t.endKm === null &&
    at.getTime() - Date.parse(t.endAt) >= 72 * 3600000
  );
}
export function scopedWorkspace(s: Workspace, actor: Actor): Workspace {
  if (actor.role !== "Řidič") return s;
  const vehicles = availableVehicles(s, actor.driverId);
  const ids = new Set(vehicles.map((v) => v.id));
  const trips = s.trips.filter((t) => t.driverId === actor.driverId);
  const orders = s.orders
    .filter((o) => o.driverId === actor.driverId)
    .map((o) => ({ ...o, priceMinor: null, internalNote: "" }));
  const fuels = s.fuels.filter((f) => f.driverId === actor.driverId);
  const faults = s.faults
    .filter((f) => f.driverId === actor.driverId || ids.has(f.vehicleId))
    .map((f) => ({
      ...f,
      estimateMinor: null,
      actualMinor: null,
      estimateSource: null,
    }));
  const docs = s.documents.filter(
    (d) =>
      !d.deletedAt &&
      ((d.ownerType === "driver" && d.ownerId === actor.driverId) ||
        (d.ownerType === "order" &&
          d.type === "Dodací list" &&
          orders.some((o) => o.id === d.ownerId)) ||
        (d.ownerType === "fuel" && fuels.some((f) => f.id === d.ownerId)) ||
        (d.ownerType === "vehicle" &&
          ["STK", "Pojištění"].includes(d.type) &&
          ids.has(d.ownerId))),
  );
  return {
    ...s,
    vehicles,
    drivers: s.drivers.filter((d) => d.id === actor.driverId),
    assignments: s.assignments.filter((a) => a.driverId === actor.driverId),
    readings: s.readings.filter((r) => ids.has(r.vehicleId)),
    trips,
    orders,
    fuels,
    faults,
    documents: docs,
    expenses: [],
    statements: [],
    transactions: [],
    templates: [],
    services: s.services.filter((service) =>
      faults.some((f) => ids.has(f.vehicleId) && f.serviceId === service.id),
    ),
    cards: [],
    notifications: [],
    events: [],
    plans: [],
    deadlines: s.deadlines.filter(
      (x) =>
        x.driverId === actor.driverId ||
        (!!x.vehicleId && ids.has(x.vehicleId)),
    ),
    settings: { managerEmail: "", daysBefore: null, kmBefore: null },
  };
}
export function deadlines(s: Workspace, now = new Date()) {
  const result = s.deadlines.map((x) => ({
    id: x.id,
    title: x.title,
    date: x.date,
    km: x.km,
    state:
      x.date &&
      ((x.type === "STK" &&
        !!x.vehicleId &&
        (s.vehicles.find((v) => v.id === x.vehicleId)?.stkUntil || "") >
          x.date) ||
        s.documents.some(
          (d) =>
            !d.deletedAt &&
            d.vehicleId === x.vehicleId &&
            d.type === x.type &&
            !!d.validUntil &&
            d.validUntil > x.date!,
        ))
        ? "Splněno"
        : x.state,
    owner: x.responsible,
    path: x.vehicleId
      ? `/vehicles/${x.vehicleId}/terms`
      : x.driverId
        ? `/drivers/${x.driverId}/licences`
        : "/deadlines",
    derived: false,
  }));
  for (const doc of s.documents) {
    if (
      doc.deletedAt ||
      !["STK", "Pojištění"].includes(doc.type) ||
      !doc.vehicleId
    )
      continue;
    const term = doc.dueAt || doc.validUntil;
    if (!term) continue;
    if (
      s.documents.some(
        (d) =>
          d.id !== doc.id &&
          !d.deletedAt &&
          d.vehicleId === doc.vehicleId &&
          d.type === doc.type &&
          (d.dueAt || d.validUntil || "") > term,
      )
    )
      continue;
    if (
      doc.type === "STK" &&
      s.vehicles.find((v) => v.id === doc.vehicleId)?.stkUntil === term
    )
      continue;
    if (
      result.some(
        (x) =>
          x.date === term &&
          s.deadlines.find((d) => d.id === x.id)?.documentId === doc.id,
      )
    )
      continue;
    result.push({
      id: "doc-" + doc.id,
      title:
        doc.type +
        " · " +
        (s.vehicles.find((v) => v.id === doc.vehicleId)?.spz || doc.name),
      date: term,
      km: null,
      state: term < today() ? "Vyžaduje řešení" : "Plánováno",
      owner: "Fleet manažer",
      path: `/documents/${doc.id}`,
      derived: true,
    });
  }
  for (const v of s.vehicles)
    if (v.stkUntil)
      result.push({
        id: "stk-" + v.id,
        title: "STK · " + v.spz,
        date: v.stkUntil,
        km: null,
        state: v.stkUntil < today() ? "Vyžaduje řešení" : "Plánováno",
        owner: "Fleet manažer",
        path: `/vehicles/${v.id}/terms`,
        derived: true,
      });
  for (const d of s.drivers)
    for (const l of [...d.licences, ...d.qualifications])
      if (l.validUntil)
        result.push({
          id: d.id + l.name,
          title: l.name + " · " + d.name,
          date: l.validUntil,
          km: null,
          state: l.validUntil < today() ? "Vyžaduje řešení" : "Plánováno",
          owner: d.name,
          path: `/drivers/${d.id}/licences`,
          derived: true,
        });
  for (const plan of s.plans)
    for (const item of plan.items)
      if (item.nextDate || item.nextKm !== null)
        result.push({
          id: item.id,
          title:
            item.name +
            " · " +
            s.vehicles.find((v) => v.id === plan.vehicleId)?.spz,
          date: item.nextDate,
          km: item.nextKm,
          state:
            (item.nextDate && item.nextDate < today()) ||
            (item.nextKm !== null &&
              (odometer(s, plan.vehicleId) ?? -1) >= item.nextKm)
              ? "Vyžaduje řešení"
              : "Plánováno",
          owner: "Fleet manažer",
          path: `/vehicles/${plan.vehicleId}/plan`,
          derived: true,
        });
  for (const t of s.trips)
    if (a6Due(t, now))
      result.push({
        id: "a6-" + t.id,
        title: "Doplnit koncový tachometr",
        date: new Date(Date.parse(t.endAt!) + 72 * 3600000)
          .toISOString()
          .slice(0, 10),
        km: null,
        state: "Vyžaduje řešení",
        owner: s.drivers.find((d) => d.id === t.driverId)?.name || "Řidič",
        path: `/trips/${t.id}`,
        derived: true,
      });
  return result.sort((a, b) =>
    (a.date || "9999").localeCompare(b.date || "9999"),
  );
}
