import { dateKey } from "../lib/format";
import type { Workspace } from "./models";
export type Scope = {
  from: string;
  to: string;
  vehicleId: string;
  category: string;
  currency: string;
  costType: string;
};
export function canonicalCosts(s: Workspace) {
  const linked = new Set(
    s.transactions.filter((t) => t.fuelId).map((t) => t.fuelId),
  );
  return [
    ...s.fuels
      .filter(
        (f) =>
          !linked.has(f.id) &&
          f.amountMinor !== null &&
          !(
            f.cardId &&
            s.transactions.some(
              (t) =>
                t.cardId === f.cardId &&
                t.vehicleId === f.vehicleId &&
                t.currency === f.currency &&
                dateKey(t.at) === dateKey(f.at),
            )
          ),
      )
      .map((f) => ({
        id: f.id,
        vehicleId: f.vehicleId,
        date: dateKey(f.at),
        amountMinor: f.amountMinor!,
        currency: f.currency,
        category: "Palivo",
        provisional: !!f.cardId,
      })),
    ...s.transactions
      .filter((t) => t.vehicleId)
      .map((t) => ({
        id: t.id,
        vehicleId: t.vehicleId!,
        date: dateKey(t.at),
        amountMinor: t.resolvedMinor ?? t.amountMinor,
        currency: t.currency,
        category: "Palivo",
        provisional: !["Spárováno", "Vyřešeno"].includes(t.state),
      })),
    ...s.expenses.map((e) => ({
      id: e.id,
      vehicleId: e.vehicleId,
      date: e.date,
      amountMinor: e.amountMinor,
      currency: e.currency,
      category: e.category,
      provisional: false,
    })),
  ];
}
export function consumption(
  s: Workspace,
  vehicleId: string,
  from: string,
  to: string,
) {
  const fuels = s.fuels
    .filter(
      (f) =>
        f.vehicleId === vehicleId &&
        dateKey(f.at) >= from &&
        dateKey(f.at) <= to,
    )
    .sort((a, b) => a.at.localeCompare(b.at));
  let anchor: (typeof fuels)[number] | null = null;
  let litres = 0,
    km = 0,
    sum = 0;
  for (const f of fuels) {
    if (!anchor) {
      if (f.full === "Ano" && f.km !== null) anchor = f;
      continue;
    }
    if (f.litres === null) {
      anchor = null;
      litres = 0;
      continue;
    }
    litres += f.litres;
    if (f.full === "Ano" && f.km !== null) {
      if (anchor.km !== null && f.km > anchor.km) {
        km += f.km - anchor.km;
        sum += litres;
      }
      anchor = f;
      litres = 0;
    }
  }
  return km > 0 ? (sum / km) * 100 : null;
}
export function report(s: Workspace, scope: Scope) {
  const vehicles = s.vehicles.filter(
    (v) =>
      (!scope.vehicleId || scope.vehicleId === v.id) &&
      (!scope.category || scope.category === v.category),
  );
  const ids = new Set(vehicles.map((v) => v.id));
  const inPeriod = (d: string) =>
    dateKey(d) >= scope.from && dateKey(d) <= scope.to;
  const costs = canonicalCosts(s).filter(
    (c) =>
      ids.has(c.vehicleId) &&
      inPeriod(c.date) &&
      c.currency === scope.currency &&
      (scope.costType === "all" ||
        (scope.costType === "fuel") === (c.category === "Palivo")),
  );
  const trips = s.trips.filter(
    (t) =>
      ids.has(t.vehicleId) &&
      t.endAt &&
      dateKey(t.startAt) <= scope.to &&
      dateKey(t.endAt) >= scope.from,
  );
  const orders = s.orders.filter(
    (o) =>
      o.vehicleId &&
      ids.has(o.vehicleId) &&
      o.currency === scope.currency &&
      inPeriod(
        o.stops
          .flatMap((x) => [x.to, x.from])
          .filter((x): x is string => !!x)
          .sort()
          .at(-1) || "0000-01-01",
      ),
  );
  const rows = vehicles.map((v) => {
    const c = costs.filter((c) => c.vehicleId === v.id);
    const ts = trips.filter((t) => t.vehicleId === v.id);
    const km = ts.reduce(
      (n, t) =>
        n +
        (t.endKm === null || !inPeriod(t.startAt) || !inPeriod(t.endAt!)
          ? 0
          : t.endKm - t.startKm),
      0,
    );
    const actual = c
      .filter((c) => !c.provisional)
      .reduce((n, c) => n + c.amountMinor, 0);
    return {
      vehicleId: v.id,
      spz: v.spz,
      category: v.category,
      km,
      missing: ts.filter((t) => t.endKm === null).length,
      boundary: ts.filter((t) => !inPeriod(t.startAt) || !inPeriod(t.endAt!))
        .length,
      litres: s.fuels
        .filter((f) => f.vehicleId === v.id && inPeriod(f.at))
        .reduce((n, f) => n + (f.litres ?? 0), 0),
      consumption: consumption(s, v.id, scope.from, scope.to),
      actualMinor: actual,
      provisionalMinor: c
        .filter((c) => c.provisional)
        .reduce((n, c) => n + c.amountMinor, 0),
      costPerKm: km > 0 ? actual / km : null,
      fuelPerKm:
        km > 0
          ? c
              .filter((c) => !c.provisional && c.category === "Palivo")
              .reduce((n, c) => n + c.amountMinor, 0) / km
          : null,
      revenueMinor: orders
        .filter(
          (o) =>
            o.vehicleId === v.id && ["Dokončená", "Uzavřená"].includes(o.state),
        )
        .reduce((n, o) => n + (o.priceMinor ?? 0), 0),
      plannedRevenueMinor: orders
        .filter(
          (o) =>
            o.vehicleId === v.id &&
            !["Dokončená", "Uzavřená", "Zrušená"].includes(o.state),
        )
        .reduce((n, o) => n + (o.priceMinor ?? 0), 0),
      faults: s.faults.filter((f) => f.vehicleId === v.id && inPeriod(f.at))
        .length,
    };
  });
  return {
    rows,
    boundaryTrips: rows.reduce((n, r) => n + r.boundary, 0),
    costs,
    km: rows.reduce((n, r) => n + r.km, 0),
    actualMinor: rows.reduce((n, r) => n + r.actualMinor, 0),
    provisionalMinor: rows.reduce((n, r) => n + r.provisionalMinor, 0),
    revenueMinor: rows.reduce((n, r) => n + r.revenueMinor, 0),
    plannedRevenueMinor: rows.reduce((n, r) => n + r.plannedRevenueMinor, 0),
  };
}
