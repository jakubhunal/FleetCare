import { Link } from "react-router";
import { useFleet } from "../app/context";
import { Badge, DataTable } from "../components/ui";
import {
  activeAssignment,
  driverState,
  odometer,
  orderConflict,
} from "../domain/rules";
import type {
  Records,
  Vehicle,
  Driver,
  Order,
  Trip,
  Fault,
} from "../domain/models";
import { date, money, number } from "../lib/format";
export const optionPairs = (a: readonly string[]): [string, string][] =>
  a.map((x) => [x, x]);
export function VRef({ id }: { id: string | null }) {
  const { s, actor } = useFleet();
  return id ? (
    <Link to={actor.role === "Řidič" ? "/my/vehicle" : `/vehicles/${id}`}>
      {s.vehicles.find((v) => v.id === id)?.spz || "Není dostupné"}
    </Link>
  ) : (
    <>Nepřiděleno</>
  );
}
export function DRef({ id }: { id: string | null }) {
  const { s, actor } = useFleet();
  const d = s.drivers.find((d) => d.id === id);
  return id ? (
    actor.role === "Řidič" ? (
      <>{d?.name || "Není dostupný"}</>
    ) : (
      <Link to={`/drivers/${id}`}>{d?.name || "Není dostupný"}</Link>
    )
  ) : (
    <>Nepřiděleno</>
  );
}
export function VehicleTable({ rows }: { rows: Vehicle[] }) {
  const { s } = useFleet();
  return (
    <DataTable
      prefix="vehicles."
      rows={rows}
      path={(v) => `/vehicles/${v.id}`}
      search={(v) =>
        v.spz +
        " " +
        v.vin +
        " " +
        v.model +
        " " +
        s.drivers.find((d) => d.id === activeAssignment(s, v.id)?.driverId)
          ?.name
      }
      filters={[
        {
          key: "category",
          label: "Všechny kategorie",
          options: optionPairs([
            "Kamion",
            "Nákladní vozidlo",
            "Dodávka",
            "Osobní auto",
          ]),
          value: (v) => v.category,
        },
        {
          key: "state",
          label: "Všechny stavy",
          options: optionPairs(["V provozu", "V servisu", "Odstaveno"]),
          value: (v) => v.state,
        },
        {
          key: "reserve",
          label: "Rezerva",
          options: [
            ["yes", "Ano"],
            ["no", "Ne"],
          ],
          value: (v) => (v.reserve ? "yes" : "no"),
        },
        {
          key: "driver",
          label: "Všichni řidiči",
          options: s.drivers.map((d) => [d.id, d.name]),
          value: (v) => activeAssignment(s, v.id)?.driverId || "",
        },
      ]}
      columns={[
        {
          key: "spz",
          label: "Vozidlo",
          sort: (v) => v.spz,
          render: (v) => (
            <>
              <strong>{v.spz}</strong>
              <small>{v.model}</small>
            </>
          ),
        },
        {
          key: "category",
          label: "Kategorie / účel",
          sort: (v) => v.category,
          render: (v) => (
            <>
              {v.category}
              <small>
                {v.purpose || "Účel není uveden"} ·{" "}
                {v.reserve ? "Rezerva" : "Běžný provoz"}
              </small>
            </>
          ),
        },
        {
          key: "driver",
          label: "Svěřený řidič",
          render: (v) => (
            <DRef id={activeAssignment(s, v.id)?.driverId || null} />
          ),
        },
        {
          key: "km",
          label: "Doložený nájezd",
          sort: (v) => odometer(s, v.id),
          render: (v) => number(odometer(s, v.id), "km"),
        },
        {
          key: "state",
          label: "Stav",
          sort: (v) => v.state,
          render: (v) => <Badge value={v.state} />,
        },
        {
          key: "due",
          label: "STK / servisní plán",
          sort: (v) => v.stkUntil,
          render: (v) => (
            <>
              {date(v.stkUntil)}
              <small>
                {s.plans.some((p) => p.vehicleId === v.id)
                  ? "Plán nastaven"
                  : "Plán není nastaven"}
              </small>
            </>
          ),
        },
      ]}
    />
  );
}
export function DriverTable({ rows }: { rows: Driver[] }) {
  const { s } = useFleet();
  return (
    <DataTable
      prefix="drivers."
      rows={rows}
      path={(d) => `/drivers/${d.id}`}
      search={(d) => d.name + " " + d.email + " " + d.phone}
      filters={[
        {
          key: "state",
          label: "Všechny stavy",
          options: optionPairs(["Aktivní", "Rozpracovaný", "Pozastavený"]),
          value: driverState,
        },
      ]}
      columns={[
        {
          key: "name",
          label: "Řidič / kontakt",
          sort: (d) => d.name,
          render: (d) => (
            <>
              <strong>{d.name}</strong>
              <small>
                {d.phone || "Telefon není uveden"} ·{" "}
                {d.email || "E-mail není uveden"}
              </small>
            </>
          ),
        },
        {
          key: "state",
          label: "Stav profilu",
          sort: driverState,
          render: (d) => <Badge value={driverState(d)} />,
        },
        {
          key: "licence",
          label: "Oprávnění / platnost",
          render: (d) =>
            d.licences.length
              ? d.licences.map((l) => (
                  <small key={l.name}>
                    {l.name} · {date(l.validUntil)}
                  </small>
                ))
              : "Není doloženo",
        },
        {
          key: "qualifications",
          label: "Kvalifikace",
          render: (d) =>
            d.qualifications.map((q) => q.name).join(", ") || "Není doloženo",
        },
        {
          key: "vehicle",
          label: "Svěřená vozidla",
          render: (d) =>
            s.assignments
              .filter(
                (a) =>
                  a.driverId === d.id &&
                  a.from <= new Date().toISOString() &&
                  (!a.to || a.to > new Date().toISOString()),
              )
              .map((a) => (
                <small key={a.id}>
                  <VRef id={a.vehicleId} />
                </small>
              )),
        },
        {
          key: "availability",
          label: "Aktuální provoz",
          render: (d) =>
            d.suspended
              ? "Pozastaven"
              : s.trips.some(
                    (t) => t.driverId === d.id && t.state === "Probíhá",
                  )
                ? "Na trase"
                : "Bez probíhající jízdy",
        },
      ]}
    />
  );
}
export function OrderTable({ rows }: { rows: Order[] }) {
  const { s, actor } = useFleet();
  return (
    <DataTable
      prefix="orders."
      rows={rows}
      path={(o) => `/orders/${o.id}`}
      search={(o) =>
        o.number +
        " " +
        o.customer +
        " " +
        o.stops.map((x) => x.place).join(" ")
      }
      filters={[
        {
          key: "state",
          label: "Všechny stavy",
          options: optionPairs([
            "Přijatá",
            "K doplnění",
            "K přiřazení",
            "Přiřazená",
            "Probíhá",
            "Dokončená",
            "Uzavřená",
            "Zrušená",
          ]),
          value: (o) => o.state,
        },
      ]}
      columns={[
        {
          key: "number",
          label: "Zakázka / zákazník",
          sort: (o) => o.number,
          render: (o) => (
            <>
              <strong>{o.number}</strong>
              <small>{o.customer}</small>
            </>
          ),
        },
        {
          key: "route",
          label: "Trasa a časová okna",
          render: (o) =>
            o.stops.map((x) => (
              <small key={x.id}>
                {x.place} · {date(x.from, true)} — {date(x.to, true)}
              </small>
            )),
        },
        {
          key: "capacity",
          label: "Požadavky",
          render: (o) => (
            <>
              {o.category || "Není doloženo"}
              <small>
                {number(o.weightKg, "kg")} · {number(o.volumeM3, "m³")} ·{" "}
                {number(o.pallets, "palet")}
              </small>
            </>
          ),
        },
        {
          key: "assignment",
          label: "Vozidlo / řidič",
          render: (o) => (
            <>
              <VRef id={o.vehicleId} />
              <small>
                <DRef id={o.driverId} />
              </small>
            </>
          ),
        },
        {
          key: "state",
          label: "Stav",
          sort: (o) => o.state,
          render: (o) => (
            <>
              <Badge value={o.state} />
              {actor.role !== "Řidič" && orderConflict(s, o) && (
                <small className="field-error">Konflikt přiřazení</small>
              )}
            </>
          ),
        },
        ...(actor.role !== "Řidič"
          ? [
              {
                key: "price",
                label: "Cena bez DPH",
                sort: (o: Order) => o.priceMinor,
                render: (o: Order) => money(o.priceMinor, o.currency),
              },
            ]
          : []),
      ]}
    />
  );
}
export function TripsTable({ rows }: { rows: Trip[] }) {
  const { s } = useFleet();
  return (
    <DataTable
      prefix="trips."
      rows={rows}
      path={(t) => `/trips/${t.id}`}
      search={(t) =>
        [
          t.from,
          t.to,
          t.purpose,
          s.vehicles.find((v) => v.id === t.vehicleId)?.spz,
          s.drivers.find((d) => d.id === t.driverId)?.name,
          s.orders.find((o) => o.id === t.orderId)?.number,
        ].join(" ")
      }
      filters={[
        {
          key: "state",
          label: "Všechny stavy",
          options: optionPairs([
            "Probíhá",
            "Ukončena neúplná",
            "K ověření",
            "Potvrzena",
            "Uzavřena",
          ]),
          value: (t) => t.state,
        },
        {
          key: "vehicle",
          label: "Všechna vozidla",
          options: s.vehicles.map((v) => [v.id, v.spz]),
          value: (t) => t.vehicleId,
        },
        {
          key: "driver",
          label: "Všichni řidiči",
          options: s.drivers.map((d) => [d.id, d.name]),
          value: (t) => t.driverId,
        },
        {
          key: "purpose",
          label: "Všechny účely",
          options: [
            ["order", "Se zakázkou"],
            ["standalone", "Samostatná jízda"],
          ],
          value: (t) => (t.orderId ? "order" : "standalone"),
        },
      ]}
      columns={[
        {
          key: "date",
          label: "Datum / vozidlo",
          sort: (t) => t.startAt,
          render: (t) => (
            <>
              <strong>{date(t.startAt)}</strong>
              <small>
                {s.vehicles.find((v) => v.id === t.vehicleId)?.spz ||
                  "Není dostupné"}
              </small>
            </>
          ),
        },
        {
          key: "driver",
          label: "Řidič / účel",
          render: (t) => (
            <>
              <DRef id={t.driverId} />
              <small>
                {t.orderId ? (
                  <Link to={`/orders/${t.orderId}`}>
                    {s.orders.find((o) => o.id === t.orderId)?.number}
                  </Link>
                ) : (
                  t.purpose
                )}
              </small>
            </>
          ),
        },
        {
          key: "route",
          label: "Skutečný průběh",
          render: (t) => (
            <>
              {t.from} → {t.to || "Na trase"}
              <small>
                {date(t.startAt, true)} — {date(t.endAt, true)}
              </small>
            </>
          ),
        },
        {
          key: "odometer",
          label: "Tachometr od–do",
          render: (t) => (
            <>
              {number(t.startKm)} → {number(t.endKm, "km")}
            </>
          ),
        },
        {
          key: "km",
          label: "Km",
          sort: (t) => (t.endKm === null ? null : t.endKm - t.startKm),
          render: (t) =>
            number(t.endKm === null ? null : t.endKm - t.startKm, "km"),
        },
        {
          key: "state",
          label: "Stav / zdroj",
          sort: (t) => t.state,
          render: (t) => (
            <>
              <Badge value={t.state} />
              <small>{t.source === "manual" ? "Ruční záznam" : t.source}</small>
            </>
          ),
        },
      ]}
    />
  );
}
export function FaultTable({ rows }: { rows: Fault[] }) {
  const { s } = useFleet();
  return (
    <DataTable
      prefix="faults."
      rows={rows}
      path={(f) => `/faults/${f.id}`}
      search={(f) =>
        f.description +
        " " +
        f.category +
        " " +
        s.vehicles.find((v) => v.id === f.vehicleId)?.spz
      }
      filters={[
        {
          key: "state",
          label: "Všechny stavy",
          options: optionPairs([
            "Nahlášena",
            "Řeší se",
            "Naplánován servis",
            "V servisu",
            "Vyřešena",
            "Uzavřena",
          ]),
          value: (f) => f.state,
        },
      ]}
      columns={[
        {
          key: "title",
          label: "Závada",
          sort: (f) => f.description,
          render: (f) => (
            <>
              <strong>{f.description}</strong>
              <small>{f.category}</small>
            </>
          ),
        },
        {
          key: "vehicle",
          label: "Vozidlo / hlášení",
          render: (f) => (
            <>
              <VRef id={f.vehicleId} />
              <small>{date(f.at, true)}</small>
            </>
          ),
        },
        {
          key: "priority",
          label: "Oznámená naléhavost",
          sort: (f) => f.urgency,
          render: (f) => f.urgency,
        },
        {
          key: "service",
          label: "Domluvený servis",
          sort: (f) => f.serviceFrom,
          render: (f) => (
            <>
              {date(f.serviceFrom, true)}
              <small>
                {f.unavailable ? "Vozidlo nedostupné" : "Bez blokace vozidla"}
              </small>
            </>
          ),
        },
        {
          key: "state",
          label: "Stav",
          sort: (f) => f.state,
          render: (f) => <Badge value={f.state} />,
        },
      ]}
    />
  );
}
export function FuelTable({ rows }: { rows: Records["fuels"][] }) {
  return (
    <DataTable
      prefix="fuels."
      rows={rows}
      path={(f) => `/fuels/${f.id}`}
      search={(f) => f.station + " " + f.at + " " + f.fuel}
      filters={[
        {
          key: "state",
          label: "Všechny stavy",
          options: optionPairs([
            "Čeká na výpis",
            "Spárováno",
            "Rozdíl",
            "Více kandidátů",
            "Chybí záznam řidiče",
            "Neúplný podklad",
            "Vyřešeno",
          ]),
          value: (f) => f.state,
        },
      ]}
      columns={[
        {
          key: "date",
          label: "Tankování",
          sort: (f) => f.at,
          render: (f) => (
            <>
              <strong>{date(f.at, true)}</strong>
              <small>{f.station || "Stanice není uvedena"}</small>
            </>
          ),
        },
        {
          key: "vehicle",
          label: "Vozidlo / řidič",
          render: (f) => (
            <>
              <VRef id={f.vehicleId} />
              <small>
                <DRef id={f.driverId} />
              </small>
            </>
          ),
        },
        {
          key: "litres",
          label: "Množství / palivo",
          sort: (f) => f.litres,
          render: (f) => (
            <>
              {number(f.litres, "l")}
              <small>{f.fuel || "Není doloženo"}</small>
            </>
          ),
        },
        {
          key: "amount",
          label: "Částka vč. DPH",
          sort: (f) => f.amountMinor,
          render: (f) => money(f.amountMinor, f.currency),
        },
        {
          key: "km",
          label: "Tachometr / do plna",
          sort: (f) => f.km,
          render: (f) => (
            <>
              {number(f.km, "km")}
              <small>{f.full}</small>
            </>
          ),
        },
        {
          key: "state",
          label: "CCS stav",
          sort: (f) => f.state,
          render: (f) => <Badge value={f.state} />,
        },
      ]}
    />
  );
}
