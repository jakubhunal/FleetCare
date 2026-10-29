import {
  collections,
  emptyWorkspace,
  meta,
  settingsSchema,
  type Actor,
  type Collection,
  type Entity,
  type Workspace,
} from "./models";
import {
  activeAssignment,
  availableVehicles,
  DomainError,
  manager,
  suitability,
  validateTrip,
} from "./rules";
import { normalize } from "../lib/format";
import type { Command } from "../data/contracts";
import { reconcileCCS } from "./ccs";
const ensure = (condition: unknown, message: string, field?: string) => {
  if (!condition) throw new DomainError(message, field);
};
function version(actual: number, expected: number | undefined) {
  if (actual !== expected)
    throw new DomainError(
      "Záznam se mezitím změnil. Obnovte detail a změnu zopakujte.",
      undefined,
      409,
    );
}
function find<K extends Collection>(
  s: Workspace,
  key: K,
  id: string,
): Workspace[K][number] {
  const record = s[key].find((x) => x.id === id);
  if (!record) throw new DomainError("Záznam neexistuje.", undefined, 404);
  return record;
}
function touch<T extends Entity>(record: T): T {
  return {
    ...record,
    updatedAt: new Date().toISOString(),
    version: record.version + 1,
  };
}
function readKm(
  s: Workspace,
  vehicleId: string,
  km: number | null,
  at: string,
  referenceId: string,
) {
  if (km === null) return;
  const existing = s.readings.find((r) => r.referenceId === referenceId);
  if (existing) Object.assign(existing, touch(existing), { km, at });
  else s.readings.push({ ...meta(), vehicleId, km, at, referenceId });
}
export function applyCommand(
  s: Workspace,
  actor: Actor,
  command: Command,
): void {
  const before = structuredClone(s);
  const c = command;
  if (c.type === "save") {
    const list = s[c.collection] as Entity[];
    const old = c.id ? list.find((x) => x.id === c.id) : undefined;
    if (c.id && !old)
      throw new DomainError("Záznam není dostupný.", undefined, 404);
    if (old) version(old.version, c.version);
    if (c.collection === "orders")
      ensure(old, "Zakázky se přijímají pouze integračním importem.");
    if (c.collection === "trips")
      ensure(old, "Jízdu je třeba zahájit v pracovním prostoru řidiče.");
    if (actor.role === "Řidič") {
      ensure(
        ["trips", "fuels", "faults"].includes(c.collection),
        "K této evidenci nemáte oprávnění.",
      );
      if (old) {
        ensure(
          "driverId" in old && old.driverId === actor.driverId,
          "Cizí záznam nelze upravit.",
        );
        ensure(
          c.collection !== "faults",
          "Řešení závady spravuje fleet manažer.",
        );
      } else
        ensure(
          c.collection === "fuels" || c.collection === "faults",
          "Operace není povolena.",
        );
    }
    const parsed = collections[c.collection].parse({
      ...old,
      ...c.data,
      ...(old
        ? {
            id: old.id,
            createdAt: old.createdAt,
            version: old.version + 1,
            updatedAt: new Date().toISOString(),
          }
        : { ...meta(), ...c.data }),
    });
    if (c.collection === "vehicles") {
      const v = collections.vehicles.parse(parsed);
      ensure(
        !s.vehicles.some(
          (x) => x.id !== v.id && normalize(x.spz) === normalize(v.spz),
        ),
        "Vozidlo s touto SPZ už existuje.",
        "spz",
      );
      ensure(
        !v.vin || /^[A-HJ-NPR-Z0-9]{17}$/i.test(v.vin),
        "VIN musí mít 17 platných znaků.",
        "vin",
      );
      ensure(
        !v.vin ||
          !s.vehicles.some(
            (x) => x.id !== v.id && normalize(x.vin) === normalize(v.vin),
          ),
        "VIN již patří jinému vozidlu.",
        "vin",
      );
    }
    if (c.collection === "trips") {
      const t = collections.trips.parse(parsed);
      if (actor.role === "Řidič") {
        const original = collections.trips.parse(old);
        ensure(
          original.state !== "Potvrzena" && original.state !== "Uzavřena",
          "Potvrzenou jízdu upravuje manažer.",
        );
        ensure(
          t.driverId === actor.driverId && t.vehicleId === original.vehicleId,
          "Nelze změnit vlastníka jízdy.",
        );
      }
      ensure(
        old && "state" in old && old.state !== "Uzavřena",
        "Uzavřenou jízdu nelze měnit.",
      );
      ensure(
        s.vehicles.some((v) => v.id === t.vehicleId) &&
          s.drivers.some((d) => d.id === t.driverId),
        "Neplatná vazba jízdy.",
      );
      if (t.orderId)
        ensure(
          s.orders.some(
            (o) =>
              o.id === t.orderId &&
              o.driverId === t.driverId &&
              o.vehicleId === t.vehicleId,
          ),
          "Zakázka nepatří této posádce.",
          "orderId",
        );
      validateTrip(s, t);
      t.state = t.endAt
        ? t.endKm !== null && !!t.to
          ? "K ověření"
          : "Ukončena neúplná"
        : "Probíhá";
      Object.assign(parsed, t);
      readKm(s, t.vehicleId, t.endKm, t.endAt || t.startAt, t.id + "-end");
    }
    if (c.collection === "fuels") {
      const f = collections.fuels.parse(parsed);
      ensure(
        s.vehicles.some((v) => v.id === f.vehicleId) &&
          s.drivers.some((d) => d.id === f.driverId),
        "Vyberte existující vozidlo a řidiče.",
      );
      if (actor.role === "Řidič") {
        ensure(
          f.driverId === actor.driverId,
          "Tankování musí patřit vybranému řidiči.",
        );
        ensure(
          !old || !s.transactions.some((t) => t.fuelId === f.id),
          "Spárovaný záznam opravuje manažer.",
        );
        ensure(
          availableVehicles(s, actor.driverId).some(
            (v) => v.id === f.vehicleId,
          ),
          "Vozidlo není dostupné řidiči.",
        );
      }
      if (old && actor.role !== "Řidič")
        ensure(
          f.correctionReason.trim(),
          "Uveďte důvod opravy.",
          "correctionReason",
        );
      readKm(s, f.vehicleId, f.km, f.at, f.id);
    }
    if (c.collection === "faults") {
      const f = collections.faults.parse(parsed);
      ensure(
        s.vehicles.some((v) => v.id === f.vehicleId),
        "Vyberte existující vozidlo.",
        "vehicleId",
      );
      if (actor.role === "Řidič") {
        ensure(
          f.driverId === actor.driverId &&
            availableVehicles(s, actor.driverId).some(
              (v) => v.id === f.vehicleId,
            ),
          "Závadu lze nahlásit u vlastního dostupného vozidla.",
        );
        ensure(f.state === "Nahlášena", "Řidič pouze hlásí závadu.");
      }
      if (old) {
        const previous = collections.faults.parse(old);
        const allowed: Record<string, string[]> = {
          Nahlášena: ["Nahlášena", "Řeší se", "Naplánován servis"],
          "Řeší se": ["Řeší se", "Naplánován servis", "V servisu", "Vyřešena"],
          "Naplánován servis": [
            "Naplánován servis",
            "Řeší se",
            "V servisu",
            "Vyřešena",
          ],
          "V servisu": ["V servisu", "Vyřešena"],
          Vyřešena: ["Vyřešena", "Uzavřena", "Řeší se"],
          Uzavřena: ["Uzavřena"],
        };
        ensure(
          allowed[previous.state].includes(f.state),
          "Tento přechod stavu závady není povolen.",
          "state",
        );
      }
      if (f.unavailable || ["Naplánován servis", "V servisu"].includes(f.state))
        ensure(
          f.serviceFrom && f.serviceTo && f.serviceTo > f.serviceFrom,
          "Doplňte platné období servisní nedostupnosti.",
          "serviceTo",
        );
      if (!old) faultOutbox(s, actor, f.id, f.vehicleId, f.at, f.serviceId);
    }
    if (c.collection === "expenses") {
      const e = collections.expenses.parse(parsed);
      ensure(
        s.vehicles.some((v) => v.id === e.vehicleId),
        "Vyberte existující vozidlo.",
        "vehicleId",
      );
      if (e.kind !== "Výdaj") {
        const original = s.expenses.find((x) => x.id === e.originalId);
        ensure(original, "Vyberte původní výdaj.", "originalId");
        ensure(
          original?.vehicleId === e.vehicleId &&
            original?.currency === e.currency,
          "Korekce musí mít stejné vozidlo a měnu jako originál.",
        );
        if (e.kind === "Storno")
          ensure(
            e.amountMinor < 0,
            "Storno musí mít zápornou částku.",
            "amountMinor",
          );
        ensure(e.description.trim(), "Popište důvod korekce.", "description");
      } else ensure(e.amountMinor > 0, "Výdaj musí být kladný.", "amountMinor");
    }
    if (c.collection === "plans" || c.collection === "templates") {
      const p =
        c.collection === "plans"
          ? collections.plans.parse(parsed)
          : collections.templates.parse(parsed);
      for (const item of p.items) {
        ensure(
          (item.intervalKm ?? 0) > 0 || (item.intervalMonths ?? 0) > 0,
          "U každého úkonu nastavte interval km nebo měsíců.",
        );
      }
      if (c.collection === "plans") {
        const plan = collections.plans.parse(parsed);
        ensure(
          s.vehicles.some((v) => v.id === plan.vehicleId),
          "Vyberte existující vozidlo.",
        );
        ensure(
          !s.plans.some(
            (x) => x.vehicleId === plan.vehicleId && x.id !== plan.id,
          ),
          "Vozidlo už má individuální plán.",
        );
      }
    }
    if (c.collection === "cards") {
      const card = collections.cards.parse(parsed);
      ensure(
        !s.cards.some(
          (x) =>
            x.id !== card.id && normalize(x.number) === normalize(card.number),
        ),
        "Karta už existuje.",
        "number",
      );
      for (const a of card.bindings) {
        ensure(
          s.vehicles.some((v) => v.id === a.vehicleId),
          "Neplatné vozidlo karty.",
        );
        ensure(
          !a.to || a.to >= a.from,
          "Konec vazby musí následovat po začátku.",
        );
      }
      for (let i = 0; i < card.bindings.length; i++)
        for (let j = i + 1; j < card.bindings.length; j++) {
          const a = card.bindings[i],
            b = card.bindings[j];
          ensure(
            !(a.from <= (b.to || "9999") && b.from <= (a.to || "9999")),
            "Časové vazby karty se překrývají.",
          );
        }
    }
    if (c.collection === "deadlines") {
      const d = collections.deadlines.parse(parsed);
      ensure(d.date || d.km !== null, "Vyplňte datum nebo km hranici.", "date");
    }
    if (c.collection === "orders") {
      const o = collections.orders.parse(parsed);
      for (const stop of o.stops) {
        ensure(
          !stop.from || !stop.to || stop.to >= stop.from,
          "Konec časového okna předchází začátku.",
        );
      }
    }
    if (old) list[list.findIndex((x) => x.id === old.id)] = parsed;
    else list.push(parsed);
  } else if (c.type === "ccs.reconcile") {
    manager(actor);
    find(s, "statements", c.statementId);
    reconcileCCS(s, c.statementId);
  } else if (c.type === "settings") {
    manager(actor);
    s.settings = settingsSchema.parse(c.data);
  } else if (c.type === "driver.toggle") {
    manager(actor);
    const d = find(s, "drivers", c.id);
    version(d.version, c.version);
    Object.assign(d, touch(d), { suspended: !d.suspended });
  } else if (c.type === "vehicle.assign") {
    manager(actor);
    find(s, "vehicles", c.vehicleId);
    ensure(c.reason.trim(), "Vyplňte důvod.", "reason");
    if (c.driverId) {
      const d = find(s, "drivers", c.driverId);
      ensure(
        !d.suspended,
        "Pozastavenému řidiči nelze nově svěřit vozidlo.",
        "driverId",
      );
    }
    for (const a of s.assignments)
      if (a.vehicleId === c.vehicleId && (!a.to || a.to > c.from)) {
        ensure(
          a.from <= c.from,
          "Účinnost koliduje s budoucím přidělením.",
          "from",
        );
        Object.assign(a, touch(a), { to: c.from });
      }
    if (c.driverId)
      s.assignments.push({
        ...meta(),
        vehicleId: c.vehicleId,
        driverId: c.driverId,
        from: c.from,
        to: null,
        reason: c.reason,
        odometer: c.odometer,
      });
    readKm(
      s,
      c.vehicleId,
      c.odometer,
      c.from,
      "assignment-" + crypto.randomUUID(),
    );
  } else if (c.type === "order.assign") {
    manager(actor);
    const o = find(s, "orders", c.id);
    version(o.version, c.version);
    const result = suitability(
      s,
      o,
      find(s, "vehicles", c.vehicleId),
      find(s, "drivers", c.driverId),
    );
    ensure(result.state === "Vhodné", result.reasons.join(" · "));
    Object.assign(o, touch(o), {
      vehicleId: c.vehicleId,
      driverId: c.driverId,
      state: ["Přijatá", "K doplnění", "K přiřazení"].includes(o.state)
        ? "Přiřazená"
        : o.state,
    });
  } else if (c.type === "trip.start") {
    const t = collections.trips.parse({
      ...meta(),
      ...c.data,
      endAt: null,
      endKm: null,
      state: "Probíhá",
    });
    find(s, "vehicles", t.vehicleId);
    const d = find(s, "drivers", t.driverId);
    ensure(!d.suspended, "Pozastavený řidič nemůže zahájit jízdu.", "driverId");
    if (actor.role === "Řidič")
      ensure(
        t.driverId === actor.driverId &&
          availableVehicles(s, actor.driverId).some(
            (v) => v.id === t.vehicleId,
          ),
        "Jízdu lze zahájit pouze u vlastního vozidla.",
      );
    if (t.orderId)
      ensure(
        s.orders.some(
          (o) =>
            o.id === t.orderId &&
            o.driverId === t.driverId &&
            o.vehicleId === t.vehicleId,
        ),
        "Zakázka není přiřazena této posádce.",
        "orderId",
      );
    validateTrip(s, t);
    s.trips.push(t);
    readKm(s, t.vehicleId, t.startKm, t.startAt, t.id + "-start");
  } else if (c.type === "trip.transition") {
    manager(actor);
    const t = find(s, "trips", c.id);
    version(t.version, c.version);
    ensure(
      c.state === "Potvrzena"
        ? t.state === "K ověření"
        : t.state === "Potvrzena",
      "Nepovolený přechod stavu jízdy.",
    );
    Object.assign(t, touch(t), { state: c.state });
  } else if (c.type === "plan.apply") {
    manager(actor);
    find(s, "vehicles", c.vehicleId);
    const template = find(s, "templates", c.templateId),
      old = s.plans.find((p) => p.vehicleId === c.vehicleId);
    ensure(!old || c.replace, "Existující individuální plán by byl přepsán.");
    const items = template.items.map((x) => ({
      ...x,
      id: crypto.randomUUID(),
    }));
    if (old) Object.assign(old, touch(old), { templateId: template.id, items });
    else
      s.plans.push({
        ...meta(),
        vehicleId: c.vehicleId,
        templateId: template.id,
        items,
        completions: [],
      });
  } else if (c.type === "plan.complete") {
    manager(actor);
    const p = find(s, "plans", c.planId);
    version(p.version, c.version);
    const i = p.items.find((x) => x.id === c.itemId);
    ensure(i, "Položka plánu neexistuje.");
    if (i) {
      i.lastDate = c.date;
      i.lastKm = c.km;
      i.nextKm = i.intervalKm ? c.km + i.intervalKm : null;
      const next = new Date(c.date + "T12:00:00Z");
      if (i.intervalMonths)
        next.setUTCMonth(next.getUTCMonth() + i.intervalMonths);
      i.nextDate = i.intervalMonths ? next.toISOString().slice(0, 10) : null;
    }
    p.completions.push({
      id: crypto.randomUUID(),
      itemId: c.itemId,
      date: c.date,
      km: c.km,
    });
    Object.assign(p, touch(p));
    readKm(
      s,
      p.vehicleId,
      c.km,
      c.date + "T12:00:00Z",
      p.id + "-" + c.itemId + "-" + c.date,
    );
  } else if (c.type === "fault.notify") {
    manager(actor);
    const f = find(s, "faults", c.id);
    ensure(f.serviceFrom && c.serviceAt, "Nejdříve doplňte termín servisu.");
    ensure(
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email),
      "Doplňte platného příjemce.",
      "email",
    );
    const a = activeAssignment(s, f.vehicleId);
    ensure(a, "Vozidlu není svěřen řidič.");
    s.notifications.push({
      ...meta(),
      aggregateId: f.id,
      recipientRole: "driver",
      recipientId: a?.driverId || null,
      email: c.email,
      subject: "Termín servisu",
      message: c.message,
      serviceAt: c.serviceAt,
      place: c.place,
      state: "not_configured",
      reason: "E-mailová služba není připojena.",
    });
  } else if (c.type === "notification.retry") {
    manager(actor);
    const n = find(s, "notifications", c.id);
    ensure(
      !["sent", "sending", "skipped_no_recipient"].includes(n.state),
      "Tento požadavek nelze opakovat.",
    );
    if (n.recipientRole === "service" && !n.recipientId) {
      const fault = s.faults.find((f) => f.id === n.aggregateId);
      n.recipientId =
        fault?.serviceId ||
        s.vehicles.find((v) => v.id === fault?.vehicleId)?.serviceId ||
        null;
    }
    const email =
      n.recipientRole === "manager"
        ? s.settings.managerEmail
        : n.recipientRole === "service"
          ? s.services.find((x) => x.id === n.recipientId)?.email
          : s.drivers.find((x) => x.id === n.recipientId)?.email;
    ensure(email, "Nejprve doplňte kontakt příjemce.");
    Object.assign(n, touch(n), {
      email,
      state: "not_configured",
      reason: "Kontakt doplněn. E-mailová služba není připojena.",
    });
  } else if (c.type === "ccs.resolve") {
    manager(actor);
    const t = find(s, "transactions", c.transactionId);
    version(t.version, c.version);
    ensure(c.reason.trim(), "Uveďte důvod vyřešení.", "reason");
    if (c.fuelId) {
      const f = find(s, "fuels", c.fuelId);
      ensure(f.currency === t.currency, "Měny podkladů musí být stejné.");
      ensure(
        !s.transactions.some((x) => x.id !== t.id && x.fuelId === f.id),
        "Tankování je spojeno s jinou transakcí.",
      );
      ensure(
        !t.vehicleId || t.vehicleId === f.vehicleId,
        "Podklady patří jinému vozidlu.",
      );
      Object.assign(f, touch(f), { state: "Vyřešeno" });
      t.vehicleId = f.vehicleId;
    }
    Object.assign(t, touch(t), {
      fuelId: c.fuelId,
      resolvedMinor: c.amountMinor,
      state: "Vyřešeno",
      resolution: c.reason,
    });
  } else if (c.type === "document.delete") {
    const d = find(s, "documents", c.id);
    ensure(
      d.ownerType === "driver",
      "Mazání je povoleno pouze u osobních dokumentů.",
    );
    if (actor.role === "Řidič")
      ensure(d.ownerId === actor.driverId, "Cizí dokument není dostupný.");
    Object.assign(d, touch(d), { deletedAt: new Date().toISOString() });
  } else if (c.type === "document.link") {
    manager(actor);
    const d = find(s, "documents", c.id);
    ensure(d.ownerType === "intake", "Dokument už má vlastníka.");
    find(s, "vehicles", c.vehicleId);
    Object.assign(d, touch(d), {
      ownerType: "vehicle",
      ownerId: c.vehicleId,
      vehicleId: c.vehicleId,
    });
  }
  for (const key of Object.keys(collections) as Collection[]) {
    if (key === "events") continue;
    for (const next of s[key]) {
      const previous = before[key].find((x) => x.id === next.id);
      if (previous && next.version !== previous.version)
        s.events.push({
          ...meta(),
          eventType: "record.changed",
          aggregateId: next.id,
          correlationId: crypto.randomUUID(),
          idempotencyKey: next.id + "-" + next.version,
          schemaVersion: 1,
          payload: { collection: key, actor, before: previous, after: next },
        });
    }
  }
}
function faultOutbox(
  s: Workspace,
  actor: Actor,
  id: string,
  vehicleId: string,
  at: string,
  serviceId: string | null,
) {
  const vehicle = s.vehicles.find((v) => v.id === vehicleId);
  const assignment = activeAssignment(s, vehicleId, at);
  const driver = s.drivers.find((d) => d.id === assignment?.driverId);
  const service = s.services.find(
    (x) => x.id === (serviceId || vehicle?.serviceId),
  );
  const recipients = [
    {
      role: "driver" as const,
      id: driver?.id || null,
      email: driver?.email || null,
    },
    {
      role: "manager" as const,
      id: null,
      email: s.settings.managerEmail || null,
    },
    {
      role: "service" as const,
      id: service?.id || null,
      email: service?.email || null,
    },
  ];
  for (const r of recipients)
    s.notifications.push({
      ...meta(),
      aggregateId: id,
      recipientRole: r.role,
      recipientId: r.id,
      email: r.email,
      subject: "Nahlášena závada · " + vehicle?.spz,
      message: `Závadu nahlásil ${actor.role === "Řidič" ? "řidič" : "fleet manažer / vedení"}. Reference případu: ${id}.`,
      serviceAt: null,
      place: "",
      state:
        r.role === "driver" && !r.id
          ? "skipped_no_recipient"
          : "not_configured",
      reason:
        r.role === "driver" && !r.id
          ? "V okamžiku hlášení není přidělen řidič."
          : !r.email
            ? "Chybí kontakt příjemce."
            : "E-mailová služba není připojena.",
    });
  s.events.push({
    ...meta(),
    eventType: "fault.reported",
    aggregateId: id,
    correlationId: crypto.randomUUID(),
    idempotencyKey: id,
    schemaVersion: 1,
    payload: {
      vehicleId,
      assignedDriverIdAtReport: driver?.id || null,
      externalServiceId: service?.id || null,
    },
  });
}
export function ensureReferences(s: Workspace) {
  const keys = Object.keys(emptyWorkspace()).filter(
    (k) => k !== "settings",
  ) as Collection[];
  for (const key of keys) {
    const ids = s[key].map((x) => x.id);
    ensure(
      ids.length === new Set(ids).size,
      "Duplicitní identifikátor v " + key,
    );
  }
}
